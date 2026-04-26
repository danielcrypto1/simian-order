import { ReactNode } from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";
import SiteFooter from "./SiteFooter";

type Props = {
  children: ReactNode;
  showRight?: boolean;
};

export default function AppShell({ children, showRight = true }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="max-w-[1200px] w-full mx-auto px-3 py-4 flex-1">
        <div className={`grid gap-4 ${showRight ? "lg:grid-cols-[180px_1fr_240px]" : "lg:grid-cols-[180px_1fr]"} grid-cols-1`}>
          <Sidebar />
          <div className="min-w-0">{children}</div>
          {showRight && <RightPanel />}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
