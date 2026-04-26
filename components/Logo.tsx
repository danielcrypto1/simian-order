import Link from "next/link";

export default function Logo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <Link href="/" className="no-underline group">
      <span className={`flex items-center gap-2 ${big ? "text-2xl" : "text-sm"}`}>
        <span
          className={`inline-flex items-center justify-center bg-ape-500 border border-ape-300 text-white font-bold ${
            big ? "w-10 h-10 text-xl" : "w-5 h-5 text-xxs"
          }`}
          style={{ boxShadow: "inset 1px 1px 0 #6a93e8, inset -1px -1px 0 #040a1f" }}
        >
          S
        </span>
        <span className="text-ape-100 font-bold uppercase tracking-widest group-hover:text-white">
          Simian Order
        </span>
      </span>
    </Link>
  );
}
