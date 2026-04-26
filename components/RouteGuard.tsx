"use client";

import Link from "next/link";
import { ReactNode } from "react";
import Panel from "./Panel";
import Button from "./Button";
import StatusBadge from "./StatusBadge";
import { useStore } from "@/lib/store";

type Props = {
  allow: boolean;
  title: string;
  reason: string;
  cta?: { href: string; label: string };
  children: ReactNode;
};

export default function RouteGuard({ allow, title, reason, cta, children }: Props) {
  const hasHydrated = useStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return (
      <Panel title="Loading">
        <div className="text-xxs text-mute uppercase tracking-wide">restoring session...</div>
      </Panel>
    );
  }

  if (!allow) {
    return (
      <Panel title={title} right={<StatusBadge status="Locked" />}>
        <div className="space-y-3">
          <p className="text-xs text-ape-200 leading-relaxed">{reason}</p>
          <div className="divider-old" />
          <div className="flex gap-2">
            {cta && (
              <Link href={cta.href}>
                <Button variant="primary">{cta.label}</Button>
              </Link>
            )}
            <Link href="/dashboard">
              <Button variant="ghost">Back to dashboard</Button>
            </Link>
          </div>
        </div>
      </Panel>
    );
  }

  return <>{children}</>;
}
