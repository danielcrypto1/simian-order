import CampaignClosed from "@/components/CampaignClosed";

/**
 * /dashboard/tasks — retired. The quest log + FCFS grant flow is
 * gone; visitors see the campaign-closed card. AppShell still wraps
 * via app/dashboard/layout.tsx so the page keeps the site chrome.
 */
export default function TasksPage() {
  return <CampaignClosed />;
}
