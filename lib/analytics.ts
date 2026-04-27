"use client";

import { track as vercelTrack } from "@vercel/analytics";

// Tight allow-list of events. Keeps the analytics surface obvious and audit-able.
export type AnalyticsEvent =
  | "landing_enter_click"
  | "landing_apply_click"
  | "landing_connect_wallet"
  | "landing_mystery_click"
  | "landing_door_open"
  | "landing_audio_on"
  | "hidden_observed"
  | "secret_simian"
  | "secret_logo_deeper"
  | "archive_404"
  | "opensea_click"
  | "apply_submit"
  | "apply_success";

type Props = Record<string, string | number | boolean | null>;

/**
 * Fire an analytics event. Safe to call from anywhere — failures are swallowed
 * so a blocked tracker (ad-blocker, offline) can never break user flow.
 */
export function track(event: AnalyticsEvent, props?: Props) {
  try {
    vercelTrack(event, props);
  } catch {
    // Intentionally silent.
  }
}
