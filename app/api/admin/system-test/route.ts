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
  addReferral,
  getOrCreateLink,
  removeReferral,
} from "@/lib/referralsStore";
import { generateSignature, getSignerAddress } from "@/lib/signature";

export const runtime = "nodejs";

export type TestId =
  | "application"
  | "approval"
  | "referral"
  | "fcfs"
  | "signature";

export const TEST_IDS: TestId[] = [
  "application",
  "approval",
  "referral",
  "fcfs",
  "signature",
];

type TestOutcome = {
  ok: boolean;
  message: string;
  cleanup?: () => Promise<void>;
};

export type TestResult = {
  id: TestId;
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  ms: number;
};

const NAMES: Record<TestId, string> = {
  application: "Application Flow",
  approval: "Approval Flow",
  referral: "Referral Flow",
  fcfs: "FCFS Flow",
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

async function testReferral(): Promise<TestOutcome> {
  const referrer = newWallet();
  const referee = newWallet();
  const before = await getOrCreateLink(referrer);
  const before1 = before.referred.length;

  const r = await addReferral(referrer, referee);
  const cleanup = async () => { await removeReferral(referrer, referee); };
  if (!r.ok) return { ok: false, message: `addReferral failed: ${r.error}`, cleanup };

  const after = await getOrCreateLink(referrer);
  if (after.referred.length !== before1 + 1) {
    return {
      ok: false,
      message: `count not incremented: ${before1} → ${after.referred.length}`,
      cleanup,
    };
  }
  if (!after.referred.includes(referee)) {
    return { ok: false, message: "referee not in referrer's list", cleanup };
  }
  const dup = await addReferral(referrer, referee);
  if (dup.ok) return { ok: false, message: "duplicate referee should have been rejected", cleanup };
  if (dup.error !== "already_referred") {
    return { ok: false, message: `expected already_referred, got ${dup.error}`, cleanup };
  }
  return {
    ok: true,
    message: `code=${after.code}, count ${before1}→${after.referred.length}, duplicate rejected`,
    cleanup,
  };
}

async function testFcfs(origin: string): Promise<TestOutcome> {
  const before = await fetch(`${origin}/api/claim-fcfs`, { cache: "no-store" }).then((r) => r.json());
  const wallet = newWallet();
  const claim = await fetch(`${origin}/api/claim-fcfs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  }).then((r) => r.json());
  if (!claim.ok) {
    if (claim.error === "fcfs_full") {
      return {
        ok: true,
        message: `FCFS already full (${before.taken}/${before.total}) — claim correctly rejected`,
      };
    }
    return { ok: false, message: `claim failed: ${claim.error}` };
  }
  if (claim.taken !== before.taken + 1) {
    return { ok: false, message: `taken did not increment: ${before.taken} → ${claim.taken}` };
  }
  const second = await fetch(`${origin}/api/claim-fcfs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (second.status !== 409) {
    return { ok: false, message: `re-claim should 409, got ${second.status}` };
  }
  const j2 = await second.json();
  if (j2.error !== "already_claimed") {
    return { ok: false, message: `expected already_claimed, got ${j2.error}` };
  }
  return {
    ok: true,
    message: `taken ${before.taken}→${claim.taken}, double-claim → 409 already_claimed`,
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
  origin: string
): Promise<TestResult[]> {
  const out: TestResult[] = [];
  for (const id of ids) {
    if (id === "application")     out.push(await runOne(id, testApplication));
    else if (id === "approval")   out.push(await runOne(id, testApproval));
    else if (id === "referral")   out.push(await runOne(id, testReferral));
    else if (id === "fcfs")       out.push(await runOne(id, () => testFcfs(origin)));
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
