import CampaignClosed from "@/components/CampaignClosed";

/**
 * /dashboard/apply — retired. The High Order application form is
 * gone; visitors see the campaign-closed card. AppShell still wraps
 * via app/dashboard/layout.tsx so the page keeps the site chrome.
 */
export default function ApplyPage() {
  return <CampaignClosed />;
}
