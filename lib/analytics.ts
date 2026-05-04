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
  | "secret_logo_3tap"
  | "longpress_signal_unstable"
  | "archive_404"
  | "opensea_click"
  | "apply_submit"
  | "apply_success"
  // Approval share-card flow (modal overlay on /dashboard/apply)
  | "share_card_open_modal"
  | "share_card_copy_attempt"
  | "share_card_copied"
  | "share_card_copy_text_only"
  | "share_card_copy_fallback_ios"
  | "share_card_open_x"
  | "share_card_downloaded"
  | "share_card_via_device";

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
