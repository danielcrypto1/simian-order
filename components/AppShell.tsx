import { ReactNode } from "react";
import TopBar from "./TopBar";
import TerminalBar from "./TerminalBar";
import FloatingScatter from "./FloatingScatter";
import SiteFooter from "./SiteFooter";
import MediaBackground from "./MediaBackground";
import SimianCharacter from "./SimianCharacter";
import HiddenObserver from "./HiddenObserver";
import RoundChapterGlyph from "./RoundChapterGlyph";

type Props = {
  children: ReactNode;
  /** retained for backwards-compat; the floating scatter always renders. */
  showRight?: boolean;
  /** background variant — defaults to 1 (electric-blue) for dashboard, but
   *  admin / mint pages may pick variant 2 (red-shifted). */
  bgVariant?: 1 | 2;
};

/**
 * App shell — layered & chaotic, never a dashboard.
 *
 * Composition (bottom → top):
 *   1. <MediaBackground />      — full-bleed chaos image + grain + glitch bars
 *   2. Drift-back simian        — far-back ghost character at low opacity
 *   3. Page chrome              — TopBar, TerminalBar, scatter, footer
 *   4. <main>                   — page content (z-[1]), pushed left-of-center
 *   5. Edge characters          — large simian variants bleeding off the right
 *      and bottom-left edges, sitting BEHIND the main column (z:0) so text
 *      overlaps them slightly
 *
 * No characters are placed inside boxes; all are absolutely positioned with
 * intentional cut-off via the `position` preset on <SimianCharacter>.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AppShell({ children, showRight = true, bgVariant = 1 }: Props) {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* L1-3: layered background system w/ real photo backdrop + glitch.png */}
      <MediaBackground
        photo
        variant={bgVariant}
        overlay="bars"
        glitchPng
        opacity={0.40}
        blur={6}
      />

      <TopBar />
      <TerminalBar />

      <div className="relative flex-1 overflow-x-clip">
        {/* Drift-back ghost simian — far back, low opacity, slow drift. */}
        <SimianCharacter variant={1} position="drift-back" />

        {/* Right-edge bleeder — real character.png, cut off the right side. */}
        <div className="hidden lg:block">
          <SimianCharacter
            variant={4}
            position="right-edge"
            opacity={0.50}
            size="38vw"
            blur={1}
            rotate={5}
            className="cut-edge-right"
          />
        </div>

        {/* Bottom-left peek — only on lg+ now. Phones stay clean. */}
        <div className="hidden lg:block">
          <SimianCharacter
            variant={2}
            position="bottom-left"
            opacity={0.30}
            size="22vw"
            rotate={-6}
            className="cut-edge-left"
          />
        </div>

        {/* Decorative glitch band — desktop only */}
        <div
          className="hidden lg:block glitch-overlay glitch-overlay--top glitch-overlay--low"
          style={{ height: "45vh" }}
          aria-hidden
        />

        {/* Faint sideways pixel chapter marker — shows the current round
            numeral in roman style. Updates when admin bumps the round. */}
        <RoundChapterGlyph />

        {/* Main content — left-shifted, intentionally not centered. z-[1]
            so text sits ABOVE the bleeding characters. */}
        <main
          className="
            relative z-[1]
            w-full max-w-[860px]
            px-3 sm:px-8
            lg:ml-[80px] xl:ml-[120px]
            lg:mr-[220px]
            pt-6 sm:pt-10 pb-16 sm:pb-24
          "
        >
          {/* "you are inside" marker — also a hidden 3-click observer */}
          <HiddenObserver />

          {/* Section break under the marker — Glitch.png stretched */}
          <div className="section-glitch mb-4" aria-hidden />

          {children}
        </main>

        <FloatingScatter />
      </div>

      <SiteFooter />
    </div>
  );
}
