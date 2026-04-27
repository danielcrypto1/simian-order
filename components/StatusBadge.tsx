type Status = "Approved" | "Pending" | "Rejected" | "Done" | "Open" | "Locked" | "Live";

// Hard-edged outline badges. Color = both border and dot via currentColor.
// Pending pulses; everything else is static.
const styles: Record<Status, string> = {
  Approved: "text-emerald-400",
  Live:     "text-emerald-400",
  Done:     "text-bone",
  Pending:  "text-ape-200 pulse-soft",
  Open:     "text-elec",
  Locked:   "text-mute",
  Rejected: "text-bleed",
};

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${styles[status]}`}>{status}</span>;
}
