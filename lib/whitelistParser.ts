import * as XLSX from "xlsx";

export type RawRow = {
  wallet?: unknown;
  phase?: unknown;
  maxMint?: unknown;
};

export type ParsedRow = {
  wallet: string;
  phase: "GTD" | "FCFS";
  maxMint: number;
};

export type ValidationError = { row: number; reason: string };

export type ParseResult = {
  ok: boolean;
  rows: ParsedRow[];
  errors: ValidationError[];
};

export function isWallet(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function splitCSVLine(line: string): string[] {
  // Minimal CSV: handles simple quoted fields and commas inside quotes.
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCSV(text: string): RawRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    wallet: header.indexOf("wallet"),
    phase: header.indexOf("phase"),
    maxMint: header.indexOf("maxmint"),
  };
  if (idx.wallet < 0 || idx.phase < 0 || idx.maxMint < 0) {
    throw new Error("header_missing_columns: expected wallet,phase,maxMint");
  }
  return lines.slice(1).map((line) => {
    const cells = splitCSVLine(line);
    return {
      wallet: cells[idx.wallet],
      phase: cells[idx.phase],
      maxMint: cells[idx.maxMint],
    };
  });
}

export async function parseFileBuffer(buf: ArrayBuffer, filename: string): Promise<RawRow[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCSV(new TextDecoder().decode(buf));
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("empty_workbook");
    const sheet = wb.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
  }
  throw new Error("unsupported_file_type: only .csv, .xlsx, .xls");
}

export function validateRows(raw: RawRow[]): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: ValidationError[] = [];
  raw.forEach((r, i) => {
    const rowNum = i + 2; // 1-indexed + header offset.
    const wallet = String(r.wallet ?? "").trim();
    const phase = String(r.phase ?? "").trim().toUpperCase();
    const maxMint = Number(r.maxMint);
    if (!wallet) {
      errors.push({ row: rowNum, reason: "wallet_missing" });
      return;
    }
    if (!isWallet(wallet)) {
      errors.push({ row: rowNum, reason: "invalid_wallet" });
      return;
    }
    if (phase !== "GTD" && phase !== "FCFS") {
      errors.push({ row: rowNum, reason: "invalid_phase (expected GTD or FCFS)" });
      return;
    }
    if (!Number.isFinite(maxMint) || !Number.isInteger(maxMint) || maxMint < 1) {
      errors.push({ row: rowNum, reason: "invalid_max_mint (expected positive integer)" });
      return;
    }
    rows.push({ wallet: wallet.toLowerCase(), phase, maxMint });
  });
  // Dedup within upload — last wins.
  const seen = new Map<string, ParsedRow>();
  for (const r of rows) seen.set(r.wallet, r);
  return { ok: errors.length === 0, rows: Array.from(seen.values()), errors };
}
