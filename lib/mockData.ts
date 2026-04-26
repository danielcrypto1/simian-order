export type ActivityItem = {
  id: string;
  user: string;
  action: string;
  target?: string;
  time: string;
};

export const activityFeed: ActivityItem[] = [
  { id: "a1", user: "0xApe.eth", action: "submitted application", time: "2m" },
  { id: "a2", user: "monkebro", action: "completed task", target: "Follow on X", time: "11m" },
  { id: "a3", user: "0x77...4f1", action: "claimed FCFS slot", time: "23m" },
  { id: "a4", user: "ordervassal", action: "minted", target: "#0421", time: "44m" },
  { id: "a5", user: "siman.bera", action: "joined Discord", time: "1h" },
  { id: "a6", user: "0xc0...de1", action: "referred a user", time: "2h" },
  { id: "a7", user: "yolkfren", action: "approved", time: "3h" },
  { id: "a8", user: "0xab...001", action: "tagged 3 friends", time: "5h" },
  { id: "a9", user: "primape", action: "minted", target: "#0420", time: "6h" },
  { id: "a10", user: "0x12...fa9", action: "rejected from waitlist", time: "9h" },
];

export const feedUsers = [
  "0xApe.eth", "monkebro", "primape", "ordervassal", "siman.bera",
  "yolkfren", "0xc0...de1", "0x77...4f1", "0xab...001", "0x12...fa9",
  "ape.king", "noir.simian", "lord.bera", "0x44...cd2", "@nopants",
];

export const feedActions: { action: string; targets?: string[] }[] = [
  { action: "completed task", targets: ["Follow on X", "RT pinned", "Tag 3", "Discord"] },
  { action: "submitted application" },
  { action: "joined Discord" },
  { action: "claimed FCFS slot" },
  { action: "minted", targets: ["#0422", "#0423", "#0424", "#0425", "#0426"] },
  { action: "referred a user" },
  { action: "approved" },
  { action: "tagged 3 friends" },
];

export const stats = {
  totalSupply: 999,
  minted: 421,
  applicants: 7124,
  approved: 612,
  pending: 388,
  floor: "0.42 APE",
  holders: 311,
};

export type ReferredUser = {
  handle: string;
  wallet: string;
  status: "Approved" | "Pending" | "Rejected";
  date: string;
};

export const referredUsers: ReferredUser[] = [
  { handle: "@apefrog", wallet: "0x91...88a", status: "Approved", date: "2026-04-21" },
  { handle: "@bera_lord", wallet: "0x44...cd2", status: "Pending", date: "2026-04-22" },
  { handle: "@nopants", wallet: "0xaa...0e3", status: "Approved", date: "2026-04-23" },
];

export const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/apply", label: "Application" },
  { href: "/dashboard/referral", label: "Referral" },
  { href: "/dashboard/mint", label: "Mint" },
];
