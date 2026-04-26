type Status = "Approved" | "Pending" | "Rejected" | "Done" | "Open" | "Locked" | "Live";

// Each style sets text color (which the ::before dot inherits via currentColor),
// border, and background. Designed for instant-read at a glance.
const styles: Record<Status, string> = {
  Approved: "bg-emerald-950 border-emerald-500 text-emerald-300",
  Live:     "bg-emerald-950 border-emerald-500 text-emerald-300",
  Done:     "bg-ape-700 border-ape-300 text-ape-100",
  Pending:  "bg-ape-900 border-ape-400 text-ape-200 pulse-soft",
  Open:     "bg-ape-850 border-ape-500 text-ape-200",
  Locked:   "bg-ape-950 border-border text-mute",
  Rejected: "bg-red-950 border-red-600 text-red-300",
};

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${styles[status]}`}>{status}</span>;
}
