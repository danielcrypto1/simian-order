import Logo from "./Logo";
import ConnectWalletButton from "./ConnectWalletButton";

export default function TopBar() {
  return (
    <header className="bg-ape-900 border-b-2 border-border">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-xxs uppercase text-mute tracking-widest hidden sm:inline">
            // ApeChain Collective
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xxs text-ape-300 uppercase font-mono hidden md:inline">
            net: APE-MAIN
          </span>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
