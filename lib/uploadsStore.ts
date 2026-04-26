import fs from "node:fs";
import path from "node:path";

// Three-tier store for admin uploads:
//
//   1. Gist (preferred on Vercel): when APPLICATIONS_GIST_ID +
//      APPLICATIONS_GIST_TOKEN are set, binary files are stored as
//      base64-encoded gist files (`upload_<name>`) plus a JSON index
//      (`_uploads_index.json`). Cross-instance consistent. Each file is
//      capped at ~700 KB raw (gist file limit is ~1 MB; base64 inflates ~33%).
//      For larger assets, replace this tier with Vercel Blob.
//
//   2. File local: writes to <repo>/public/uploads/, served at /uploads/<name>
//      by Next.js's static handler.
//
//   3. File ephemeral: when neither gist nor a writeable public/ exists
//      (Vercel without gist), falls back to /tmp/uploads/. Per-instance,
//      lost on cold start.
//
// Public URL prefix is chosen so admin previews always render:
//   gist  → /api/uploads/file/<name>   (proxy decodes base64 from gist)
//   local → /uploads/<name>            (Next static)
//   /tmp  → /api/uploads/file/<name>   (proxy reads /tmp)

const GIST_ID = process.env.APPLICATIONS_GIST_ID;
const GIST_TOKEN = process.env.APPLICATIONS_GIST_TOKEN;
export const USE_GIST = Boolean(GIST_ID && GIST_TOKEN);

const isVercel = process.env.VERCEL === "1";
const STORAGE_DIR = isVercel
  ? "/tmp/uploads"
  : path.join(process.cwd(), "public", "uploads");

export const PUBLIC_URL_PREFIX =
  USE_GIST || isVercel ? "/api/uploads/file/" : "/uploads/";

export const MAX_BYTES = USE_GIST ? 700 * 1024 : 5 * 1024 * 1024;

const INDEX_LOCAL = "_index.json";
const INDEX_GIST = "_uploads_index.json";
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;
const GIST_FILE_PREFIX = "upload_";

export type UploadKind = "image" | "json";

export type UploadEntry = {
  name: string;
  kind: UploadKind;
  size: number;
  contentType: string;
  uploadedAt: string;
  url: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  } | null;
};

// ───── Helpers ─────────────────────────────────────────────────────────

export function sanitizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/^[._-]+/, "")
    .slice(0, 128);
}

export function detectKind(name: string, contentType: string): UploadKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json") || contentType === "application/json") return "json";
  if (/(\.jpe?g|\.png)$/.test(lower)) return "image";
  if (/^image\/(jpeg|png)$/i.test(contentType)) return "image";
  return null;
}

function isJpeg(buf: Uint8Array): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}
function isPng(buf: Uint8Array): boolean {
  return (
    buf.length > 7 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  );
}
export function validateImage(buf: Uint8Array): boolean {
  return isJpeg(buf) || isPng(buf);
}

function parseMetadata(buf: Uint8Array): UploadEntry["metadata"] {
  try {
    const obj = JSON.parse(new TextDecoder().decode(buf));
    if (obj && typeof obj === "object") {
      return {
        name: typeof obj.name === "string" ? obj.name : undefined,
        description: typeof obj.description === "string" ? obj.description : undefined,
        image: typeof obj.image === "string" ? obj.image : undefined,
        attributes: Array.isArray(obj.attributes) ? obj.attributes : undefined,
      };
    }
  } catch {}
  return null;
}

// ───── Local file backend ─────────────────────────────────────────────

function ensureLocalDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
function readLocalIndex(): UploadEntry[] {
  try {
    const p = path.join(STORAGE_DIR, INDEX_LOCAL);
    if (!fs.existsSync(p)) return [];
    const t = fs.readFileSync(p, "utf8").trim();
    if (!t) return [];
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? (parsed as UploadEntry[]) : [];
  } catch {
    return [];
  }
}
function writeLocalIndex(entries: UploadEntry[]): void {
  ensureLocalDir();
  fs.writeFileSync(
    path.join(STORAGE_DIR, INDEX_LOCAL),
    JSON.stringify(entries, null, 2)
  );
}

// ───── Gist backend ───────────────────────────────────────────────────

async function gistGetAllFiles(): Promise<Record<string, { content?: string }>> {
  const r = await fetch(GIST_URL, {
    headers: {
      Authorization: `Bearer ${GIST_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`gist_read_${r.status}`);
  const j = (await r.json()) as { files?: Record<string, { content?: string }> };
  return j.files ?? {};
}

async function gistPatch(
  files: Record<string, { content: string } | null>
): Promise<void> {
  const r = await fetch(GIST_URL, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GIST_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`gist_write_${r.status}: ${t.slice(0, 160)}`);
  }
}

async function readGistIndex(): Promise<UploadEntry[]> {
  try {
    const files = await gistGetAllFiles();
    const content = files[INDEX_GIST]?.content?.trim();
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as UploadEntry[]) : [];
  } catch {
    return [];
  }
}

async function readGistBinary(name: string): Promise<Buffer | null> {
  try {
    const files = await gistGetAllFiles();
    const content = files[GIST_FILE_PREFIX + name]?.content;
    if (!content) return null;
    return Buffer.from(content, "base64");
  } catch {
    return null;
  }
}

// ───── Public API ─────────────────────────────────────────────────────

export type SaveResult =
  | { ok: true; entry: UploadEntry }
  | { ok: false; error: string };

export async function saveUpload(
  name: string,
  buf: Uint8Array,
  contentType: string
): Promise<SaveResult> {
  const cleanName = sanitizeName(name);
  if (!cleanName || cleanName === INDEX_LOCAL || cleanName === INDEX_GIST) {
    return { ok: false, error: "invalid_name" };
  }
  const kind = detectKind(cleanName, contentType);
  if (!kind) return { ok: false, error: "unsupported_type" };
  if (kind === "image" && !validateImage(buf)) {
    return { ok: false, error: "invalid_image_bytes" };
  }
  let metadata: UploadEntry["metadata"] = null;
  if (kind === "json") {
    try {
      JSON.parse(new TextDecoder().decode(buf));
    } catch {
      return { ok: false, error: "invalid_json" };
    }
    metadata = parseMetadata(buf);
  }

  const entry: UploadEntry = {
    name: cleanName,
    kind,
    size: buf.byteLength,
    contentType,
    uploadedAt: new Date().toISOString(),
    url: PUBLIC_URL_PREFIX + cleanName,
    metadata,
  };

  if (USE_GIST) {
    const entries = await readGistIndex();
    const idx = entries.findIndex((e) => e.name === cleanName);
    if (idx >= 0) entries[idx] = entry;
    else entries.unshift(entry);
    await gistPatch({
      [GIST_FILE_PREFIX + cleanName]: { content: Buffer.from(buf).toString("base64") },
      [INDEX_GIST]: { content: JSON.stringify(entries, null, 2) },
    });
  } else {
    ensureLocalDir();
    fs.writeFileSync(path.join(STORAGE_DIR, cleanName), buf);
    const entries = readLocalIndex();
    const idx = entries.findIndex((e) => e.name === cleanName);
    if (idx >= 0) entries[idx] = entry;
    else entries.unshift(entry);
    writeLocalIndex(entries);
  }

  return { ok: true, entry };
}

export async function listUploads(): Promise<UploadEntry[]> {
  const all = USE_GIST ? await readGistIndex() : readLocalIndex();
  return all.filter((e) => e.name !== INDEX_LOCAL && e.name !== INDEX_GIST);
}

export async function readFileFromStore(
  name: string
): Promise<{ buf: Buffer; contentType: string } | null> {
  const cleanName = sanitizeName(name);
  if (!cleanName) return null;

  if (USE_GIST) {
    const entries = await readGistIndex();
    const entry = entries.find((e) => e.name === cleanName);
    if (!entry) return null;
    const buf = await readGistBinary(cleanName);
    if (!buf) return null;
    return { buf, contentType: entry.contentType };
  }

  const filePath = path.join(STORAGE_DIR, cleanName);
  if (!fs.existsSync(filePath)) return null;
  const entries = readLocalIndex();
  const entry = entries.find((e) => e.name === cleanName);
  return {
    buf: fs.readFileSync(filePath),
    contentType: entry?.contentType ?? "application/octet-stream",
  };
}

/** Wipes all uploads (binaries + index). Returns count of files cleared. */
export async function clearAllUploads(): Promise<number> {
  if (USE_GIST) {
    const entries = await readGistIndex();
    if (entries.length === 0) {
      // Still empty the index just in case.
      await gistPatch({ [INDEX_GIST]: { content: "[]" } });
      return 0;
    }
    const files: Record<string, { content: string } | null> = {
      [INDEX_GIST]: { content: "[]" },
    };
    for (const e of entries) {
      files[GIST_FILE_PREFIX + e.name] = null as unknown as { content: string };
    }
    await gistPatch(files);
    return entries.length;
  }

  // Local file backend.
  const entries = readLocalIndex();
  for (const e of entries) {
    const fp = path.join(STORAGE_DIR, e.name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  writeLocalIndex([]);
  return entries.length;
}

export async function deleteUpload(name: string): Promise<boolean> {
  const cleanName = sanitizeName(name);
  if (!cleanName) return false;

  if (USE_GIST) {
    const entries = await readGistIndex();
    const idx = entries.findIndex((e) => e.name === cleanName);
    if (idx < 0) return false;
    entries.splice(idx, 1);
    // Setting a file to null in the PATCH payload deletes it from the gist.
    await gistPatch({
      [GIST_FILE_PREFIX + cleanName]: null as unknown as { content: string },
      [INDEX_GIST]: { content: JSON.stringify(entries, null, 2) },
    });
    return true;
  }

  const filePath = path.join(STORAGE_DIR, cleanName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const entries = readLocalIndex();
  const idx = entries.findIndex((e) => e.name === cleanName);
  if (idx < 0) return false;
  entries.splice(idx, 1);
  writeLocalIndex(entries);
  return true;
}
