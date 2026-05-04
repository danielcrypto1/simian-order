import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

// Edge runtime — required by @vercel/og. Also sidesteps a known Windows
// dev-server path bug where next-bundled `next/og` fails when the
// project lives at a path containing a space ("Simian ORder").
export const runtime = "edge";

/**
 * Approval Share Card — 1200×1200 PNG generated on demand.
 *
 *   GET /api/share-card?round=1[&wallet=0x…]
 *
 * Square aspect ratio so it lays out well on X feeds and reposts. Uses
 * `@vercel/og` (Satori under the hood). The visual matches the site:
 * pure-black void, electric-blue accent, harsh red bleed, off-white
 * type, courier mono labels, faint radial vignette + SVG fractal-noise
 * texture for the underground/print feel.
 *
 * Wallet, if supplied, is rendered masked (0x1234…abcd) — the full
 * address never appears on the card.
 *
 * Notes for satori CSS support:
 *   - `repeating-linear-gradient` is NOT supported (we use noise SVG).
 *   - `mixBlendMode` is NOT supported (we use plain opacity).
 *   - All children of <div> need explicit `display: flex` (or none).
 *   - `<span>` is fine for inline text but we keep things to <div> for
 *     consistent flex behaviour.
 */

const SIZE = 1200;

function clampRound(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 9999);
}

function maskWallet(raw: string | null): string | null {
  if (!raw) return null;
  const w = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(w)) return null;
  return `${w.slice(0, 6)}…${w.slice(-4)}`.toLowerCase();
}

// Pool of void textures we sample from for the card backdrop. Each card
// render picks one deterministically from the round number so a given
// round always shows the same image — keeps the card stable across
// refreshes while still varying between rounds. All paths are relative
// to /public so the absolute URL resolves to the same Vercel deployment
// the API route is served from.
const VOID_TEXTURES = [
  "/void/4.jpg",
  "/void/12.jpg",
  "/void/20.jpg",
  "/void/26.jpg",
  "/void/30.jpg",
  "/void/36.jpg",
  "/void/41.jpg",
  "/void/52.jpg",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const round = clampRound(url.searchParams.get("round"));
  const wallet = maskWallet(url.searchParams.get("wallet"));

  // Build an absolute URL to the chosen void texture so satori can
  // fetch it. Falls back gracefully — if the fetch fails inside
  // ImageResponse, the card still renders without the backdrop layer.
  const voidPath = VOID_TEXTURES[round % VOID_TEXTURES.length];
  const voidUrl = `${url.origin}${voidPath}`;

  // SVG fractal-noise filter — same generator we use on the site
  // body::after — encoded as a data URL so satori can paint it as a
  // background image.
  const noiseSvg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
        `<filter id='n'>` +
          `<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>` +
        `</filter>` +
        `<rect width='400' height='400' filter='url(%23n)' opacity='0.85'/>` +
      `</svg>`,
    );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#000000",
          backgroundImage: [
            "radial-gradient(ellipse at 18% 12%, rgba(0, 64, 255, 0.32), transparent 55%)",
            "radial-gradient(ellipse at 86% 90%, rgba(255, 45, 45, 0.18), transparent 60%)",
          ].join(", "),
          color: "#e8e8e8",
          fontFamily: "serif",
          position: "relative",
          padding: "80px",
        }}
      >
        {/* Void texture backdrop — varies per round (deterministic), pulled
            from the same /void/ pool the site uses. Heavily desaturated +
            low opacity so the foreground type stays the focus. Satori
            requires the <img> form for raster images (it can't fetch
            URLs through CSS background-image). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={voidUrl}
          alt=""
          width={SIZE}
          height={SIZE}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: SIZE,
            height: SIZE,
            objectFit: "cover",
            opacity: 0.35,
            filter: "grayscale(0.6) contrast(1.1)",
          }}
        />

        {/* Dark vignette pulled OVER the texture so contrast stays high
            in the centre where RECOGNISED sits. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage: [
              "radial-gradient(ellipse at 50% 50%, transparent 10%, rgba(0,0,0,0.55) 70%)",
              "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.65))",
            ].join(", "),
          }}
        />

        {/* Faint noise overlay — opacity-blended (no mixBlendMode in
            satori). Sits below the content (zIndex omitted; satori
            paints in document order, content divs come after this). */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage: `url("${noiseSvg}")`,
            backgroundSize: "400px 400px",
            opacity: 0.12,
          }}
        />

        {/* Inner frame — thin 1px panel border. */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            border: "1px solid #1a1a28",
            display: "flex",
          }}
        />

        {/* Top label — courier mono caps, tracked. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "monospace",
            fontSize: 22,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#e8e8e8",
          }}
        >
          <div style={{ color: "#ff2d2d", display: "flex", marginRight: 18 }}>──</div>
          <div style={{ display: "flex" }}>SIMIAN ORDER</div>
          <div style={{ color: "#ff2d2d", display: "flex", marginLeft: 18 }}>──</div>
        </div>

        {/* Center stack — RECOGNISED + round */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            marginTop: -40,
          }}
        >
          {/* Tiny pre-label — "verdict" */}
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 20,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#0040ff",
              marginBottom: 24,
              display: "flex",
            }}
          >
            // verdict
          </div>

          {/* RECOGNISED — the headline. Off-axis red shadow + blue
              ghost gives the glitch-print feel matching `.text-bleed`.
              Sized to fit "RECOGNISED" (10 chars) inside the 1040px
              content width with breathing room. */}
          <div
            style={{
              fontFamily: "serif",
              fontSize: 156,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              lineHeight: 0.95,
              color: "#e8e8e8",
              textShadow: "5px 4px 0 #ff2d2d, -2px -2px 0 #0040ff",
              display: "flex",
            }}
          >
            RECOGNISED
          </div>

          {/* ROUND N — secondary, italic serif. */}
          <div
            style={{
              fontStyle: "italic",
              fontSize: 72,
              color: "#aaaadd",
              marginTop: 28,
              display: "flex",
            }}
          >
            ROUND {round}
          </div>

          {/* Optional wallet stamp — only when supplied, masked. */}
          {wallet && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 22,
                letterSpacing: "0.18em",
                color: "#5a5a6a",
                marginTop: 18,
                display: "flex",
              }}
            >
              filed · {wallet}
            </div>
          )}
        </div>

        {/* Bottom — courier label + italic serif tagline. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#5a5a6a",
              marginBottom: 10,
              display: "flex",
            }}
          >
            ── high order ──
          </div>
          <div
            style={{
              fontStyle: "italic",
              fontSize: 38,
              color: "#e8e8e8",
              display: "flex",
            }}
          >
            you either see it or you don’t.
          </div>
        </div>

        {/* Glitch corner mark — bottom-right block in electric blue. */}
        <div
          style={{
            position: "absolute",
            bottom: 70,
            right: 70,
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: "0.28em",
            color: "#0040ff",
            display: "flex",
          }}
        >
          R{round}//◼◼◼
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      // Cache at the CDN — the image is fully derivable from its query
      // string so different rounds / wallets get distinct cache keys.
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=3600, immutable",
      },
    },
  );
}
