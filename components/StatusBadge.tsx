type Status = "Approved" | "Pending" | "Rejected" | "Done" | "Open" | "Locked";

const styles: Record<Status, string> = {
  Approved: "bg-ape-700 border-ape-300 text-ape-100",
  Pending: "bg-ape-900 border-ape-500 text-ape-200",
  Rejected: "bg-red-950 border-red-700 text-red-200",
  Done: "bg-ape-700 border-ape-300 text-ape-100",
  Open: "bg-ape-850 border-ape-500 text-ape-200",
  Locked: "bg-ape-950 border-border text-mute",
};

export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${styles[status]}`}>{status}</span>;
}
