"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, ReactNode, useState } from "react";

/**
 * Drop-in replacement for next/link that adds an intentional 100–200ms
 * delay before navigating. Creates a feeling of "weight" — the link
 * registers, the visual press feedback plays, then the route change
 * happens.
 *
 * The underlying <Link href> is preserved so the prefetch + crawler
 * behaviour stays correct; we just intercept the click.
 *
 * Usage:
 *   <DelayedLink href="/dashboard" delay={150}>...</DelayedLink>
 *
 * If the click is modified (cmd/ctrl/shift/middle), the default browser
 * behaviour runs (open in new tab, etc.) with no delay.
 */
type Props = {
  href: string;
  /** Delay in ms before router.push fires. Default 150. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  /** Run before the delay starts — e.g. analytics event. */
  onClick?: () => void;
  children: ReactNode;
  /** Optional aria-label passthrough. */
  "aria-label"?: string;
};

export default function DelayedLink({
  href,
  delay = 150,
  className,
  style,
  onClick,
  children,
  "aria-label": ariaLabel,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Link
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-busy={pending}
      onClick={(e) => {
        // Let the browser handle modified clicks (open new tab, etc.).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (pending) return;
        setPending(true);
        onClick?.();
        window.setTimeout(() => {
          router.push(href);
          // pending flag self-clears on unmount — leave it set so a
          // double-tap during navigation is a no-op.
        }, delay);
      }}
    >
      {children}
    </Link>
  );
}
