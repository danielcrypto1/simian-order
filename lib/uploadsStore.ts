import fs from "node:fs";
import path from "node:path";

// Local dev: writes to <repo>/public/uploads/, Next.js serves at /uploads/<name>.
// Vercel: writes to /tmp/uploads/ (ephemeral per-instance) and serves via the
// /api/uploads/file/<name> route. For durable cross-instance uploads on
// Vercel, swap saveUpload/readFile/deleteUpload here to Vercel Blob — same
// shape, ~30 lines of change.

const isVercel = process.env.VERCEL === "1";
const STORAGE_DIR = isVercel
  ? "/tmp/uploads"
  : path.join(process.cwd(), "public", "uploads");

export const PUBLIC_URL_PREFIX = isVercel
  ? "/api/uploads/file/"
  : "/uploads/";

const INDEX_FILE = "_index.json";

export type UploadKind = "image" | "json";

export type UploadEntry = {
  name: string;
  kind: UploadKind;
  size: number;
  contentType: string;
  uploadedAt: string;
  url: string;
  // For JSON: parsed metadata fields surfaced for preview
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  } | null;
};

function ensureDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function readIndex(): UploadEntry[] {
  try {
    const p = path.join(STORAGE_DIR, INDEX_FILE);
    if (!fs.existsSync(p)) return [];
    const t = fs.readFileSync(p, "utf8").trim();
    if (!t) return [];
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? (parsed as UploadEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: UploadEntry[]): void {
  ensureDir();
  fs.writeFileSync(
    path.join(STORAGE_DIR, INDEX_FILE),
    JSON.stringify(entries, null, 2),
    "utf8"
  );
}

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
  } catch { /* fall through */ }
  return null;
}

export type SaveResult =
  | { ok: true; entry: UploadEntry }
  | { ok: false; error: string };

export function saveUpload(
  name: string,
  buf: Uint8Array,
  contentType: string
): SaveResult {
  const cleanName = sanitizeName(name);
  if (!cleanName || cleanName === INDEX_FILE) return { ok: false, error: "invalid_name" };

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

  ensureDir();
  fs.writeFileSync(path.join(STORAGE_DIR, cleanName), buf);

  const entries = readIndex();
  const idx = entries.findIndex((e) => e.name === cleanName);
  const entry: UploadEntry = {
    name: cleanName,
    kind,
    size: buf.byteLength,
    contentType,
    uploadedAt: new Date().toISOString(),
    url: PUBLIC_URL_PREFIX + cleanName,
    metadata,
  };
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  writeIndex(entries);

  return { ok: true, entry };
}

export function listUploads(): UploadEntry[] {
  return readIndex().filter((e) => e.name !== INDEX_FILE);
}

export function readFileFromStore(name: string): { buf: Buffer; contentType: string } | null {
  const cleanName = sanitizeName(name);
  if (!cleanName || cleanName === INDEX_FILE) return null;
  const filePath = path.join(STORAGE_DIR, cleanName);
  if (!fs.existsSync(filePath)) return null;
  const entries = readIndex();
  const entry = entries.find((e) => e.name === cleanName);
  return {
    buf: fs.readFileSync(filePath),
    contentType: entry?.contentType ?? "application/octet-stream",
  };
}

export function deleteUpload(name: string): boolean {
  const cleanName = sanitizeName(name);
  if (!cleanName || cleanName === INDEX_FILE) return false;
  const filePath = path.join(STORAGE_DIR, cleanName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.name === cleanName);
  if (idx < 0) return false;
  entries.splice(idx, 1);
  writeIndex(entries);
  return true;
}
