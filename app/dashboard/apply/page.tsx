"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import { useStore } from "@/lib/store";

export default function ApplyPage() {
  const {
    applicationStatus,
    submitApplication,
    approveApplication,
    rejectApplication,
    resetApplication,
    walletAddress,
  } = useStore();

  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    submitApplication();
    setBusy(false);
  }

  const statusBadge =
    applicationStatus === "approved" ? <StatusBadge status="Approved" /> :
    applicationStatus === "pending" ? <StatusBadge status="Pending" /> :
    applicationStatus === "rejected" ? <StatusBadge status="Rejected" /> :
    <StatusBadge status="Open" />;

  if (applicationStatus !== "none") {
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
      <div className="space-y-3">
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

        <Panel title="DEV: Reviewer Console" right={<span>temporary</span>}>
          <div className="text-xxs text-mute mb-2 leading-relaxed">
            simulate the order&apos;s decision. these buttons exist for testing only and would not be exposed in production.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={approveApplication}
              disabled={applicationStatus === "approved"}
            >
              Approve
            </Button>
            <Button
              onClick={rejectApplication}
              disabled={applicationStatus === "rejected"}
            >
              Reject
            </Button>
            <Button variant="ghost" onClick={resetApplication}>
              Withdraw / Reset
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <Panel title="Apply to the Order" right={<span>round II open</span>}>
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
            placeholder={walletAddress || "0x..."}
            value={form.wallet}
            onChange={(e) => update("wallet", e.target.value)}
            required
          />
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
          <label className="label">referrer (optional)</label>
          <input
            className="field"
            placeholder="@referrer or referral code"
            value={form.referrer}
            onChange={(e) => update("referrer", e.target.value)}
          />
        </div>

        <div className="divider-old" />

        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Filing..." : "Submit Application"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setForm({ handle: "", wallet: "", why: "", referrer: "", discord: "" })}>
            Reset
          </Button>
          <span className="ml-auto text-xxs text-mute">applications close at phase III.</span>
        </div>
      </form>
    </Panel>
  );
}
