"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";

type Status = "idle" | "submitting" | "submitted" | "error";

export default function ApplyPage() {
  const { applicationStatus, submitApplication, walletAddress } = useStore();
  const { address, connect, connecting } = useWallet();

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    handle: "",
    wallet: "",
    why: "",
    referrer: "",
    discord: "",
  });

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!address) {
      setErrorMsg("connect a wallet first");
      return;
    }
    setStatus("submitting");
    try {
      const wallet = (form.wallet.trim() || address).toLowerCase();
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          handle: form.handle.trim(),
          discord: form.discord.trim() || null,
          why: form.why.trim(),
          referrer_input: form.referrer.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `http_${res.status}`);
      }
      submitApplication();
      setStatus("submitted");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "submit_failed");
      setStatus("error");
    }
  }

  if (applicationStatus !== "none") {
    const statusBadge =
      applicationStatus === "approved" ? <StatusBadge status="Approved" /> :
      applicationStatus === "pending" ? <StatusBadge status="Pending" /> :
      applicationStatus === "rejected" ? <StatusBadge status="Rejected" /> :
      <StatusBadge status="Open" />;
    const title =
      applicationStatus === "approved" ? "Application Approved" :
      applicationStatus === "rejected" ? "Application Rejected" :
      "Application Submitted";
    const message =
      applicationStatus === "approved"
        ? "you may now access the referral system and the mint."
        : applicationStatus === "rejected"
        ? "the order has declined. you may re-apply in round III."
        : "filed. the order will respond within 72 hours.";

    return (
      <Panel title={title} right={statusBadge}>
        <div className="space-y-3">
          <div className="text-ape-100 text-base font-bold uppercase">
            {applicationStatus === "approved" ? "welcome." : applicationStatus === "rejected" ? "denied." : "filed."}
          </div>
          <p className="text-xxs text-mute leading-relaxed">{message}</p>
          <div className="divider-old" />
          <dl className="text-xxs grid grid-cols-[120px_1fr] gap-y-1">
            <dt className="text-mute uppercase">handle</dt><dd className="text-ape-100">{form.handle || "—"}</dd>
            <dt className="text-mute uppercase">wallet</dt><dd className="font-mono text-ape-100 break-all">{form.wallet || walletAddress || "—"}</dd>
            <dt className="text-mute uppercase">discord</dt><dd className="text-ape-100">{form.discord || "—"}</dd>
            <dt className="text-mute uppercase">referrer</dt><dd className="text-ape-100">{form.referrer || "—"}</dd>
          </dl>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Apply to the Order" right={<span>round II open</span>}>
      {!address && (
        <div className="border border-border bg-ape-950 p-3 mb-3">
          <div className="text-xxs uppercase tracking-wide text-mute mb-2">wallet required</div>
          <Button variant="primary" disabled={connecting} onClick={connect}>
            {connecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">x / twitter handle</label>
            <input
              className="field"
              placeholder="@yourhandle"
              value={form.handle}
              onChange={(e) => update("handle", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">discord</label>
            <input
              className="field"
              placeholder="user#0000"
              value={form.discord}
              onChange={(e) => update("discord", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">ape-chain wallet</label>
          <input
            className="field font-mono"
            placeholder={address || "0x..."}
            value={form.wallet}
            onChange={(e) => update("wallet", e.target.value)}
          />
          <div className="text-xxs text-mute mt-1">leave blank to use the connected wallet ({address ? `${address.slice(0,6)}…${address.slice(-4)}` : "none"})</div>
        </div>

        <div>
          <label className="label">why the order</label>
          <textarea
            className="field min-h-[120px]"
            placeholder="speak plainly. lore optional."
            value={form.why}
            onChange={(e) => update("why", e.target.value)}
            required
          />
          <div className="text-xxs text-mute text-right mt-1">{form.why.length} / 600</div>
        </div>

        <div>
          <label className="label">referrer code (optional)</label>
          <input
            className="field font-mono"
            placeholder="SIM-XXXXX"
            value={form.referrer}
            onChange={(e) => update("referrer", e.target.value.toUpperCase())}
            maxLength={32}
          />
        </div>

        {errorMsg && (
          <div className="border border-red-700 bg-red-950 px-2 py-1 text-xxs text-red-200">
            error: {errorMsg}
          </div>
        )}

        <div className="divider-old" />

        <div className="flex items-center gap-2 flex-wrap">
          <Button type="submit" variant="primary" disabled={status === "submitting" || !address}>
            {status === "submitting" ? "Filing..." : "Submit Application"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setForm({ handle: "", wallet: "", why: "", referrer: "", discord: "" }); setErrorMsg(null); setStatus("idle"); }}
          >
            Reset
          </Button>
          <span className="ml-auto text-xxs text-mute">applications close at phase III.</span>
        </div>
      </form>
    </Panel>
  );
}
