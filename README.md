# SIMIAN ORDER

NFT collective frontend — Next.js + Tailwind + ethers.js. Early-2000s boxed UI, dark blue ApeChain palette.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Pages

- `/` — Landing
- `/dashboard` — Dashboard shell (top bar + left nav + main feed + right stats)
- `/tasks` — Checklist + wallet submit
- `/apply` — Application form + submission state
- `/referral` — Link, slot grid, referred users table
- `/mint` — Supply counter + mint UI (no contract wired)

## Notes

- All data is mocked in `lib/mockData.ts`.
- Wallet uses `ethers.js` `BrowserProvider` if `window.ethereum` is present, otherwise falls back to a mock address. No contract calls are made.
- Reusable components live in `components/` (`Panel`, `Button`, `StatusBadge`, `TopBar`, `Sidebar`, `RightPanel`, `ActivityFeed`, `AppShell`).
- Styles in `app/globals.css` define `.panel`, `.btn-old`, `.field`, `.badge`, etc.
