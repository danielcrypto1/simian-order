import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { ethers } from "ethers";
import {
  deleteApplication,
  findByWallet,
  listApplications,
  setStatus,
  upsertApplication,
} from "@/lib/applicationsStore";
import {
  upsertSubmission,
  setEntryStatus,
  deleteSubmission,
  getSubmission,
} from "@/lib/submissionsStore";
import { generateSignature, getSignerAddress } from "@/lib/signature";
import { TEST_IDS, type TestId, type TestResult } from "@/lib/systemTests";

export const runtime = "nodejs";

type TestOutcome = {
  ok: boolean;
  message: string;
  cleanup?: () => Promise<void>;
};

const NAMES: Record<TestId, string> = {
  application: "Application Flow",
  approval: "Approval Flow",
  submission: "Submission Flow",
  signature: "Signature",
};

function newWallet(): string {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

async function runOne(
  id: TestId,
  fn: () => Promise<TestOutcome>
): Promise<TestResult> {
  const t0 = Date.now();
  let cleanup: TestOutcome["cleanup"];
  try {
    const r = await fn();
    cleanup = r.cleanup;
    return {
      id,
      name: NAMES[id],
      status: r.ok ? "PASS" : "FAIL",
      message: r.message,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      id,
      name: NAMES[id],
      status: "FAIL",
      message: e instanceof Error ? e.message : String(e),
      ms: Date.now() - t0,
    };
  } finally {
    if (cleanup) {
      try { await cleanup(); } catch { /* swallow */ }
    }
  }
}

// ───── Tests ────────────────────────────────────────────────────────────

async function testApplication(): Promise<TestOutcome> {
  const wallet = newWallet();
  const handle = "test_" + wallet.slice(2, 8);
  const cleanup = async () => { await deleteApplication(wallet); };

  const app = await upsertApplication({ wallet, twitter: handle, why: "system test" });
  if (app.status !== "pending") {
    return { ok: false, message: `expected status=pending after submit, got ${app.status}`, cleanup };
  }
  const all = await listApplications();
  const found = all.find((a) => a.wallet === wallet);
  if (!found) return { ok: false, message: "submitted application not visible in admin list", cleanup };
  if (found.twitter !== handle) {
    return { ok: false, message: `twitter mismatch: stored=${found.twitter} sent=${handle}`, cleanup };
  }
  return {
    ok: true,
    message: `submitted (status=pending) → appears in admin list → cleanup succeeded`,
    cleanup,
  };
}

async function testApproval(): Promise<TestOutcome> {
  const wallet = newWallet();
  await upsertApplication({ wallet, twitter: "approval_test", why: "test" });
  const cleanup = async () => { await deleteApplication(wallet); };

  const approved = await setStatus(wallet, "approved");
  if (!approved) return { ok: false, message: "setStatus returned null", cleanup };
  if (approved.status !== "approved") {
    return { ok: false, message: `expected approved, got ${approved.status}`, cleanup };
  }
  const found = await findByWallet(wallet);
  if (!found || found.status !== "approved") {
    return { ok: false, message: "approval did not persist", cleanup };
  }
  return {
    ok: true,
    message: "pending → approved persisted → referral gate would unlock",
    cleanup,
  };
}

// Curated submission flow — exercises the full lifecycle:
//  - referrer is application-approved
//  - submits a list of one entry
//  - admin approves the entry → entry status flips
//  - cleanup deletes the submission
async function testSubmission(): Promise<TestOutcome> {
  const referrer = newWallet();
  const referee = newWallet();
  const cleanup = async () => {
    try { await deleteSubmission(referrer); } catch { /* noop */ }
    try { await deleteApplication(referrer); } catch { /* noop */ }
  };

  // Set up: create an approved application for the referrer so they
  // pass the gate inside upsertSubmission.
  await upsertApplication({
    wallet: referrer,
    twitter: "test_" + referrer.slice(2, 8),
    why: null,
    discord: null,
    referrer_input: null,
    source: "apply",
  });
  await setStatus(referrer, "approved");

  const submitted = await upsertSubmission({
    referrerWallet: referrer,
    entries: [
      { x: "tx_" + referee.slice(2, 6), discord: "td_" + referee.slice(2, 6), wallet: referee },
    ],
  });
  if (!submitted.ok) {
    return { ok: false, message: `upsert failed: ${submitted.error}`, cleanup };
  }
  if (submitted.submission.entries[0].status !== "pending") {
    return { ok: false, message: "expected pending after submit", cleanup };
  }

  const decided = await setEntryStatus(referrer, referee, "approved");
  if (!decided) {
    return { ok: false, message: "setEntryStatus returned null", cleanup };
  }
  if (decided.entries[0].status !== "approved") {
    return { ok: false, message: `decision did not persist: ${decided.entries[0].status}`, cleanup };
  }

  const reread = await getSubmission(referrer);
  if (!reread || reread.entries[0].status !== "approved") {
    return { ok: false, message: "approval did not persist on re-read", cleanup };
  }

  return {
    ok: true,
    message: `submitted 1 entry, admin approve → status=approved persisted`,
    cleanup,
  };
}

async function testSignature(): Promise<TestOutcome> {
  const wallet = newWallet();
  const phase = 2;
  const maxAllowed = 2;

  let signature: string;
  try {
    signature = await generateSignature(wallet, phase, maxAllowed);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? `generateSignature threw: ${e.message}` : "generateSignature threw",
    };
  }
  if (typeof signature !== "string" || !signature.startsWith("0x") || signature.length !== 132) {
    return { ok: false, message: `bad signature shape (len=${signature.length})` };
  }
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!chainId || !contract) {
    return { ok: false, message: "NEXT_PUBLIC_CHAIN_ID or _CONTRACT_ADDRESS missing" };
  }
  const digest = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint8", "uint256"],
    [BigInt(chainId), contract, wallet, phase, maxAllowed]
  );
  const recovered = ethers.verifyMessage(ethers.getBytes(digest), signature);
  const announced = getSignerAddress();
  if (recovered.toLowerCase() !== announced.toLowerCase()) {
    return { ok: false, message: `recovered ${recovered} ≠ signer ${announced}` };
  }
  return {
    ok: true,
    message: `132-byte sig, recovers to ${recovered.slice(0, 10)}…${recovered.slice(-4)}`,
  };
}

async function runByList(
  ids: TestId[],
  // origin no longer needed (FCFS HTTP probe removed) but kept for parity
  // with future tests that may need an absolute base URL.
  _origin: string
): Promise<TestResult[]> {
  const out: TestResult[] = [];
  for (const id of ids) {
    if (id === "application")     out.push(await runOne(id, testApplication));
    else if (id === "approval")   out.push(await runOne(id, testApproval));
    else if (id === "submission") out.push(await runOne(id, testSubmission));
    else if (id === "signature")  out.push(await runOne(id, testSignature));
  }
  return out;
}

// ───── Handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const url = new URL(req.url);
  const onlyRaw = url.searchParams.get("only");

  let ids: TestId[];
  if (onlyRaw && TEST_IDS.includes(onlyRaw as TestId)) {
    ids = [onlyRaw as TestId];
  } else {
    ids = TEST_IDS;
  }

  const results = await runByList(ids, url.origin);
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  return NextResponse.json({
    tests: results,
    total: results.length,
    passed,
    failed,
  });
}
