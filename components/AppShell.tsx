import { ReactNode } from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";

type Props = {
  children: ReactNode;
  showRight?: boolean;
};

export default function AppShell({ children, showRight = true }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="max-w-[1200px] w-full mx-auto px-3 py-3 flex-1">
        <div className={`grid gap-3 ${showRight ? "lg:grid-cols-[180px_1fr_240px]" : "lg:grid-cols-[180px_1fr]"} grid-cols-1`}>
          <Sidebar />
          <div className="min-w-0">{children}</div>
          {showRight && <RightPanel />}
        </div>
      </div>
      <footer className="border-t border-border bg-ape-900">
        <div className="max-w-[1200px] mx-auto px-3 py-2 text-xxs uppercase text-mute flex justify-between">
          <span>simian.order // private</span>
          <span>built on ape-chain</span>
        </div>
      </footer>
    </div>
  );
}
