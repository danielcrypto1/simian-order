/**
 * Centered closure card shown on the three retired campaign routes
 * (/dashboard/apply, /dashboard/tasks, /dashboard/referral). Same
 * italic-serif treatment as the rest of the site so it reads as
 * intentional, not as a 404.
 */
export default function CampaignClosed() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center px-4">
      <div className="text-center space-y-5 max-w-2xl">
        <div className="font-mono text-xxs uppercase tracking-widest2 text-mute">
          // transmission ended
        </div>
        <h1 className="headline text-4xl sm:text-6xl leading-tight">
          the signal has been cut<span className="text-bleed">.</span>
        </h1>
        <p className="font-serif italic text-xl sm:text-2xl text-ape-200 leading-relaxed">
          the campaign is officially over.
        </p>
        <div className="pt-2">
          <span className="font-mono text-xxxs uppercase tracking-widest2 text-mute">
            — simian order
          </span>
        </div>
      </div>
    </div>
  );
}
