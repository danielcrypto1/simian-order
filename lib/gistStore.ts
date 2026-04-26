import fs from "node:fs";
import path from "node:path";

// Generic JSON-blob store with two backends:
//
//   - GitHub private Gist (preferred): when APPLICATIONS_GIST_ID +
//     APPLICATIONS_GIST_TOKEN are set, reads/writes go to a single private
//     Gist via the GitHub API. Multiple files (applications.json,
//     referrals.json, …) live in the same Gist.
//   - File (fallback): writes to `<repo>/data/<name>` locally or
//     `/tmp/<name>` on Vercel single-instance.
//
// Concurrency: gist writes are last-write-wins with no optimistic locking.
// Acceptable for this traffic level; for high-write workloads swap to KV.

const GIST_ID = process.env.APPLICATIONS_GIST_ID;
const GIST_TOKEN = process.env.APPLICATIONS_GIST_TOKEN;
export const USE_GIST = Boolean(GIST_ID && GIST_TOKEN);

const isVercel = process.env.VERCEL === "1";
const FILE_DIR = isVercel ? "/tmp" : path.join(process.cwd(), "data");

function fileFor(name: string): string {
  return path.join(FILE_DIR, name);
}

function ensureFileDir(): void {
  if (!fs.existsSync(FILE_DIR)) fs.mkdirSync(FILE_DIR, { recursive: true });
}

function readFile<T>(name: string, fallback: T): T {
  try {
    const p = fileFor(name);
    if (!fs.existsSync(p)) return fallback;
    const text = fs.readFileSync(p, "utf8").trim();
    if (!text) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function writeFile<T>(name: string, value: T): void {
  ensureFileDir();
  fs.writeFileSync(fileFor(name), JSON.stringify(value, null, 2), "utf8");
}

async function readGist<T>(name: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });
    if (!r.ok) return fallback;
    const j = (await r.json()) as { files?: Record<string, { content?: string }> };
    const content = j.files?.[name]?.content?.trim();
    if (!content) return fallback;
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeGist<T>(name: string, value: T): Promise<void> {
  const body = {
    files: { [name]: { content: JSON.stringify(value, null, 2) } },
  };
  const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GIST_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`gist_write_failed_${r.status}: ${t.slice(0, 200)}`);
  }
}

export async function readJSON<T>(name: string, fallback: T): Promise<T> {
  return USE_GIST ? readGist(name, fallback) : readFile(name, fallback);
}

export async function writeJSON<T>(name: string, value: T): Promise<void> {
  if (USE_GIST) await writeGist(name, value);
  else writeFile(name, value);
}
