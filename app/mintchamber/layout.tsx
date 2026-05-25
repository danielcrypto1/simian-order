import AppShell from "@/components/AppShell";

export default function MintChamberLayout({ children }: { children: React.ReactNode }) {
  return <AppShell bgVariant={2}>{children}</AppShell>;
}
