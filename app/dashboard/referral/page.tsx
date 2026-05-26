import CampaignClosed from "@/components/CampaignClosed";

/**
 * /dashboard/referral — retired. The five-summoning referral flow is
 * gone; visitors see the campaign-closed card. AppShell still wraps
 * via app/dashboard/layout.tsx so the page keeps the site chrome.
 */
export default function ReferralPage() {
  return <CampaignClosed />;
}
