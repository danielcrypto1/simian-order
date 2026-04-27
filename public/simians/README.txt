simian character family
========================

slot convention:
  /public/simians/01.{svg,png,jpg}  — front-facing watcher (default)
  /public/simians/02.{svg,png,jpg}  — side profile
  /public/simians/03.{svg,png,jpg}  — crouched full body
  /public/simians/04.{png,jpg}      — empty slot (drop in real NFT)
  /public/simians/05.{png,jpg}      — empty slot (drop in real NFT)

how the UI consumes them:
  <SimianCharacter variant={1..5} ... />  picks the matching file.
  the procedural SVG variants in 01-03 ship with the repo so the UI
  has visible content out of the box. drop a real PNG over any slot
  and it overrides the SVG (PNG has higher specificity in the loader).

intentional rules:
  - characters are NEVER placed inside clean boxes
  - they are positioned to overflow / cut off / sit behind text
  - reuse the same 3-5 across the whole site, do not introduce more
