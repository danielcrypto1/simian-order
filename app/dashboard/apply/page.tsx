"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { useWallet } from "@/lib/wallet";
import { track } from "@/lib/analytics";
import { TWEETS, openTweet } from "@/lib/twitterShare";

type Status = "idle" | "loading" | "submitting" | "submitted" | "error";
type ServerApp = {
  id: string;
  wallet: string;
  twitter: string;
  why: string | null;
  discord: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export default function ApplyPage() {
  const { approveApplication, rejectApplication, submitApplication, resetApplication, applicationStatus } = useStore();
  const { address, connect, connecting } = useWallet();

  const [serverApp, setServerApp] = useState<ServerApp | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    handle: "",
    wallet: "",
    why: "",
    referrer: "",
    discord: "",
  });

  // Public lookup so the post-submission view (and share buttons) persist
  // across reloads. /api/application returns only public-safe fields.
  const refresh = useCallback(async (wallet: string | null) => {
    if (!wallet) { setServerApp(null); setStatus("idle"); return; }
    setStatus("loading");
    try {
      const r = await fetch(`/api/application?wallet=${wallet}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j.application) {
          setServerApp({
            id: j.application.id,
            wallet: j.application.wallet,
            twitter: j.application.twitter,
            why: null,
            discord: null,
            status: j.application.status,
            createdAt: j.application.createdAt,
          });
        } else {
          setServerApp(null);
        }
      }
    } catch { /* fall through to idle */ }
    setStatus("idle");
  }, []);

  useEffect(() => { refresh(address ?? null); }, [address, refresh]);

  // Reflect server state into local zustand status display.
  useEffect(() => {
    if (!serverApp) return;
    if (serverApp.status === "approved" && applicationStatus !== "approved") approveApplication();
    else if (serverApp.status === "rejected" && applicationStatus !== "rejected") rejectApplication();
    else if (serverApp.status === "pending" && applicationStatus !== "pending") submitApplication();
  }, [serverApp, applicationStatus, approveApplication, rejectApplication, submitApplication]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    track("apply_submit", { hasReferrer: form.referrer.trim().length > 0 });
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
          twitter: form.handle.trim(),
          discord: form.discord.trim() || null,
          why: form.why.trim() || null,
          referrer_input: form.referrer.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `http_${res.status}`);
      // Server is source of truth — reflect the returned application.
      setServerApp(j.application as ServerApp);
      submitApplication();
      track("apply_success");
      setStatus("submitted");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "submit_failed");
      setStatus("error");
    }
  }

  function reapply() {
    setServerApp(null);
    resetApplication();
    setStatus("idle");
  }

  // Show the post-submission view only if we have actually submitted this
  // session OR the server returned an existing application for this wallet.
  const showSubmittedView = serverApp !== null && status !== "submitting";

  if (showSubmittedView && serverApp) {
    const s = serverApp.status;
    const statusBadge =
      s === "approved" ? <StatusBadge status="Approved" /> :
      s === "rejected" ? <StatusBadge status="Rejected" /> :
      <StatusBadge status="Pending" />;
    const title =
      s === "approved" ? "Application Approved" :
      s === "rejected" ? "Application Rejected" :
      "Application Submitted";
    const message =
      s === "approved"
        ? "you may now access the referral system and the mint."
        : s === "rejected"
        ? "the order has declined. you may re-apply in round III."
        : "filed. the order will respond when ready.";

    return (
      <Panel title={title} right={statusBadge}>
        <div className="space-y-3">
          <div className="text-ape-100 text-base font-bold uppercase">
            {s === "approved" ? "welcome." : s === "rejected" ? "denied." : "filed."}
          </div>
          <p className="text-xxs text-mute leading-relaxed">{message}</p>
          <div className="divider-old" />
          <dl className="text-xxs grid grid-cols-[120px_1fr] gap-y-1">
            <dt className="text-mute uppercase">x handle</dt>
            <dd className="text-ape-100">@{serverApp.twitter}</dd>
            <dt className="text-mute uppercase">wallet</dt>
            <dd className="font-mono text-ape-100 break-all">{serverApp.wallet}</dd>
            {serverApp.discord && (<>
              <dt className="text-mute uppercase">discord</dt>
              <dd className="text-ape-100">{serverApp.discord}</dd>
            </>)}
            <dt className="text-mute uppercase">submitted</dt>
            <dd className="text-mute font-mono">{serverApp.createdAt.replace("T", " ").slice(0, 19)} UTC</dd>
          </dl>

          {(s === "approved" || s === "rejected") && (
            <div className="pt-2">
              <div className="text-xxs uppercase tracking-wide text-mute mb-1">
                share your status
              </div>
              <Button
                variant="primary"
                onClick={() =>
                  openTweet(s === "approved" ? TWEETS.approval() : TWEETS.rejection())
                }
              >
                {s === "approved" ? "Share Approval" : "Share Rejection"}
              </Button>
            </div>
          )}

          {s !== "approved" && (
            <div className="pt-1">
              <Button variant="ghost" onClick={reapply}>Re-submit</Button>
            </div>
          )}
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
          <div className="text-xxs text-mute mt-1">
            leave blank to use the connected wallet ({address ? `${address.slice(0,6)}…${address.slice(-4)}` : "none"})
          </div>
        </div>

        <div>
          <label className="label">why the order</label>
          <textarea
            className="field min-h-[120px]"
            placeholder="speak plainly. lore optional."
            value={form.why}
            onChange={(e) => update("why", e.target.value)}
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
          <span className="ml-auto text-xxs text-mute">submitted as PENDING. admin reviews manually.</span>
        </div>
      </form>
    </Panel>
  );
}
