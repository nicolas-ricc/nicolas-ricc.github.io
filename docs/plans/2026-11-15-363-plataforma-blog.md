# Signs: Blog sea platform (#363) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder of `src/scenes/sign-platform.ts` with the Blog sea platform (spec §3.3): piles, deck, railing, ladder to the water, instrument hut, beacon mast and the "Blog" cyan tube sign at 45°. Add its reference photos, inventory and captures.

**Architecture:** One Pixi-free scene module builds every solid and accent at the origin through the existing signature `seaPlatform(out, accents)`. Lettering comes only from `src/kit/lettering.ts` and the tubes only from `neon()`. The storybook exhibit `plataforma` (`pad: "water"`) is untouched. Photos, `INVENTORY.md`, `CREDITS.md` and captures live under `docs/superpowers/specs/assets/`.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`), Vite dev server + agent-browser for the captures.

**Spec:** issue #363 (body: "Qué hacer", the tests list, "Reglas que hereda", "Criterios de aceptación"). Story context: #352 and `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` §3.3–§5. Where they differ, the issue wins.

## Global Constraints

- Only `src/scenes/sign-platform.ts` and `src/scenes/sign-platform.test.ts` change in `src/`. `exhibits.ts`, `exhibits.test.ts` and `english.test.ts` don't change, and neither do `src/world/`, `src/main.ts`, `index.html` or `src/style.css`.
- Signature fixed: `export function seaPlatform(out: Solid[], accents: Accent[]): void`.
- No new material or color, no hex outside `palette-iso.ts`, no `Math.random`, no Pixi in `src/scenes`.
- Code, comments, strings and identifiers in English (`src/english.test.ts`).
- Coordinates: the camera looks at the faces facing +x and +y. **S = +y, E = +x, N = −y, W/O = −x**. A face with normal (1, 1, 0)/√2 faces the camera.

## Geometry (values from the issue; derived values computed in code)

| Part | Solids |
|---|---|
| Piles | 6 × `cylinder` `steel` r 0.3, sides 6, `at.z` −1, h 2.2 (to z 1.2), centers x ∈ {−6.4, 0, 6.4} × y ∈ {−5.4, 5.4} (corners and mid long side, inset 0.6) |
| Deck | `prism(-7, -6, 1.2, 14, 12, 0.4, "deck")` (top z 1.6) |
| Railing posts | `prism` `steel` 0.15 × 0.15 × 1.0 at z 1.6. E edge: `at.x` = 6.85, 7 posts evenly spaced from `at.y` −6 to 5.85 (6 spans of 1.975). S edge: `at.y` = 5.85, 8 posts evenly spaced from `at.x` −7 to 6.85 (7 spans, ≈ 1.979; the SE corner post is shared, so 14 posts on S ∪ E). N/W edges: one extra post at the NW corner (−7, −6) |
| Railing positions | One expression per edge: post k `at` = −HALF + k·(2·HALF − RAIL_POST)/n (E: HALF 6, n 6; S: HALF 7, n 7). The E loop emits k = 0..6 (it includes the SE corner, y 5.85). The S loop emits k = 0..6 and skips k = 7 (x 6.85, the shared corner). Each handrail span runs from post k's `at` + RAIL_POST to post k+1's `at`, so the touching faces come from the same numbers |
| Handrail | `beam` `steel` w 0.1 h 0.1 at z 2.5, one per span, on the post axis (E: x 6.925; S: y 5.925), from one post's face to the next (the beam ends touch, they don't overlap) |
| Ladder | 2 `beam` `steel` 0.12² on the E edge, centered on y = −3, rails at y −3 ± 0.3, from (7 + e, y, 1.6) to (7 + e + 0.6, y, −0.6). e = the x reach of the half-section of the inclined beam (0.06·\|up.x\|), so the rail's box starts at x = 7. 3 rungs `beam` `steel` 0.08² along y, between the inner faces of the rails (y −3 ± 0.24), at 1/4, 1/2 and 3/4 of the rail axis |
| Hut | `prism(-6.6, -5.6, 1.6, 2.4, 1.8, 1.4, "boxGrey")`, door plate `rect` on wall 2 (S) `officeDark` u 0.4..0.6, z 1.6..2.6; `dot` `cyanMid` r 0.3 above the door at (−5.4, −3.75, 2.8) |
| Mast | `cylinder` `steel` r 0.15 h 4, sides 6, at (6.6, −5.6, 1.6); `dot` `cyan` r 0.5 at (6.6, −5.6, 5.6) |
| Sign beams | 2 `beam` `steel` 0.15², length L = `measureText("Blog", 8.55).width + 1` (≈ 16.879) along u = (1, −1, 0)/√2, centered on the frame center c, at z 2.8 and 2.8 + 8.55 + 1.0 = 12.35 |
| Sign posts | 2 `prism` `steel` 0.2 × 0.2 from z 1.6 to the top of the upper beam (12.425) |
| Word | `strokeText("Blog", diagonalWall(origin), 8.55, 1.0)` with origin = c − u·width/2 at z 3.0; each quad → `neon(q, "cyan", 0.75)` |

### Decision: the sign posts stand behind the frame (technical assumption)

The issue asks for two posts at the frame, "as far toward the SE corner as fits with both posts on the deck". Posts at the beam ends don't fit at any offset: the deck's chord along (1, −1) is at most 12·√2 ≈ 16.97, and two 0.2² posts beyond the ends of a 16.88 beam need ≈ 17.6. The test "no two solid boxes interpenetrate" adds a second limit: the box of a diagonal beam covers every point of its span in plan, so a post anywhere within the span that crosses the beam's z overlaps it. The resolution:

- Each post is **inset `POST_INSET` = 1 u** from its beam end along u and moved **back** (toward −n, n = (1, 1, 0)/√2) by `d = POST_INSET + (0.1 + 0.075·√½)·√2` ≈ 1.216. That puts the post box flush with the beam box in x (left post) or y (right post): the post stands just behind the sign face.
- Post boxes stay inside the railing's inner faces (box x ≤ 6.85, y ≤ 5.85, i.e. centers |x| ≤ 7 − 0.15 − 0.1, |y| ≤ 6 − 0.15 − 0.1): they may touch a railing post face, never cross it. "Most SE" = maximize the x + y of the post midpoint m. With a = (L/2 − POST_INSET)/√2: m = (6.75 − a, 5.75 − a) ≈ (1.490, 0.490). Frame center c = m + n·d ≈ (2.350, 1.350), frame plane x + y ≈ 3.70.
- That leaves the beam boxes (x −3.67..8.37, y −4.67..7.37) clear of the hut (x ≤ −4.2) and the mast (y ≤ −5.45). Both beam ends hang over the S and E edges, so the sign stands "over the railing".
- The `g`'s descender (baseline z 3.0 per the issue) reaches z ≈ 0.06, below the deck top, at the E end. That is the issue's value, kept as is and noted in the PR.

## Review Focus

- **Interpenetration across parts:** handrail × posts, ladder × deck, sign beams × hut/mast/railing. The single pairwise box test in Task 2 pins all of them (only pile × deck is excused).
- **Floating error at touching faces:** every "touching" pair (post face/handrail end, ladder box/deck x = 7) must stay within 1e-6, so compute the touch points from the same constants and never hand-type their decimals.
- **The halo plane:** `neon` shifts the halo by (−0.05, −0.05). It stays a plane of normal n, but not the tube plane. The test checks coplanarity per polygon and that all tubes share the frame plane.
- **Scale readability:** the stroke 1.0 u gives 1.65 px (vertical) and 1.64 px (horizontal) at 1.17. `xHeightPx(8.55, 1.17)` = 10.0035 ≥ 10. Use the literal 8.55, not `sizeForXHeight(10, 1.17)` (8.547 → 10.000 with float risk).
- **Exhibit framing:** the sign's height (~12.4 u above the deck) makes the piece tall; the storybook fits the bounds, so nothing is cropped. Check it in the captures.

---

### Task 1: Platform structure (piles, deck, railing, ladder, hut, mast)

**Files:**
- Modify: `src/scenes/sign-platform.ts` (replace the placeholder)
- Modify: `src/scenes/sign-platform.test.ts` (replace the #360 placeholder tests)

**Interfaces:**
- Produces: `seaPlatform(out, accents)` (unchanged signature). Module constants used by Task 2: `DECK_TOP = 1.6`, `HALF_X = 7`, `HALF_Y = 6`, `RAIL_POST = 0.15`.

- [ ] **Step 1: Write the failing tests** in `describe("sea platform (#363)")`:
  - `piles stand in the water`: the min z over `bounds()` of every solid = −1; ≥ 6 `cylinder` `steel`, and exactly 6 of them have r 0.3, `at.z` −1 and top 1.2.
  - `deck`: a `prism` `deck` with w 14, d 12 and `at.z + h` = 1.6.
  - `railing on S and E`: ≥ 10 `prism` `steel` with w = d = 0.15, h 1.0 and `at.z` 1.6 whose `at.x` = 6.85 ± 1e-6 or `at.y` = 5.85 ± 1e-6.
  - `ladder reaches the water`: ≥ 2 `beam` `steel` with `min(from.z, to.z)` = −0.6 and `max` = 1.6, both with x ≥ 7.
  - `lights`: exactly one `dot` `cyan` (z ≥ 5.5) and one `dot` `cyanMid`.
  - `deterministic`: `build()` deep-equals `build()`.
- [ ] **Step 2:** `npx vitest run src/scenes/sign-platform.test.ts`. Expected: FAIL (placeholder: no railing, no ladder, no dots).
- [ ] **Step 3: Implement** the structure rows of the geometry table in `seaPlatform`. Keep the placeholder's Blog lines for now (Task 2 replaces them).
- [ ] **Step 4:** Same command, then `npm test` and `npm run typecheck`. Expected: all green (the placeholder word is still there; `exhibits.test.ts` only asks for ≥ 1 solid and determinism).
- [ ] **Step 5: Commit** `feat(#363): sea platform structure — piles, deck, railing, ladder, hut, beacon`.

### Task 2: Blog sign (frame, posts, neon) and the whole-piece checks

**Files:**
- Modify: `src/scenes/sign-platform.ts`, `src/scenes/sign-platform.test.ts`

**Interfaces:**
- Consumes: Task 1's constants; `measureText`, `diagonalWall`, `strokeText`, `xHeightPx` from `src/kit/lettering.ts`; `neon` from `src/kit/props.ts`; `bounds` from `src/iso/solids.ts`.
- Produces: exported `SIGN_SIZE = 8.55` and `SIGN_TUBE = 1.0` (read by the test and the PR's table).

- [ ] **Step 1: Write the failing tests:**
  - `sign accents`: every `poly` accent has a color in `{cyan, cyanBleed}` and alpha `0.75` (cyan) or `0.45` (cyanBleed) (toBeCloseTo 12). Within each poly, `p.x + p.y` is constant (|Δ| < 1e-9). All cyan tubes share one value k of x + y, and k equals the x + y of the midpoint of each sign beam (the two `beam` with z 2.8 and 12.35).
  - `sign posts on the deck`: exactly 2 `prism` `steel` with w = d = 0.2; for each, `at.x ≥ −7`, `at.x + 0.2 ≤ 7`, `at.y ≥ −6`, `at.y + 0.2 ≤ 6`, `at.z` = 1.6.
  - `readable at 1.17`: `xHeightPx(SIGN_SIZE, 1.17) ≥ 10`; `SIGN_TUBE · 1.17 · 1.4 ≥ 1.5`.
  - `no solid interpenetrates another except piles × deck`: pairwise over `bounds()`, overlap > 1e-6 on all of x, y, z fails, unless the pair is (cylinder `steel` with `at.z` −1, prism `deck`). The failure message lists the pairs `[i, j, kind, mat]`.
  - Delete the placeholder test of the baseline z 2.8.
- [ ] **Step 2:** Run the test file. Expected: FAIL (the placeholder word is on the plane x + y = 0, no beams, no posts).
- [ ] **Step 3: Implement** the "Sign beams", "Sign posts" and "Word" rows and the posts-behind decision above. `L`, `a`, `m`, `c` and `d` are computed from the constants, not hard-coded.
- [ ] **Step 4:** Run the test file, then `npm test` and `npm run typecheck`. Expected: all green; `exhibits.test.ts` passes unchanged.
- [ ] **Step 5: Commit** `feat(#363): Blog cyan tube sign on the platform`.

### Task 3: Reference photos, credits and inventory

**Files:**
- Create: `docs/superpowers/specs/assets/carteles-refs/plataforma/NN-<tema>.jpg` (4–8), `CREDITS.md`, `INVENTORY.md`

- [ ] **Step 1:** Search Wikimedia Commons (API `https://commons.wikimedia.org/w/api.php`, `curl -A "<UA>"`) for pontoons and mooring or measuring platforms on piles, with a railing, a ladder to the water and a beacon, preferably at night. Keep 4–8 files whose license is CC0, CC BY or CC BY-SA (read `extmetadata.LicenseShortName` and `Artist`).
- [ ] **Step 2:** The container has neither ImageMagick nor PIL, so ask Commons for a server-side thumbnail instead (`prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1280`, or `iiurlheight=1280` for portrait files). Download that `thumburl` into its own empty directory under `/tmp` and save it as `NN-<tema>.jpg` (Spanish slug).
- [ ] **Step 3:** Write `CREDITS.md`: a header plus the table `| Archivo | Autor | Licencia | Origen |`, like `estacion-refs/CREDITS.md`. Write `INVENTORY.md` with the issue's 7 checkboxes, unticked.
- [ ] **Step 4:** Verify with `file *.jpg` (it prints the JPEG dimensions): every long side is ≤ 1280.
- [ ] **Step 5: Commit** `docs(#363): plataforma reference photos, credits and inventory`.

### Task 4: Captures and legibility (needs the dev server)

**Files:**
- Create: `docs/superpowers/specs/assets/352-carteles/plataforma-{real,117}-{bloom,nobloom}.png`, `plataforma-083.png` (3200 × 1800)
- Modify: `docs/superpowers/specs/assets/carteles-refs/plataforma/INVENTORY.md` (tick each item with the capture where it shows)

- [ ] **Step 1:** Start `npm run dev -- --host --port 5173`, run `agent-browser set viewport 1600 900 2`, and open `http://localhost:5173/lab/storybook.html#plataforma` (add `?bloom=off` for the nobloom shots). Press `c` once for 1.17 and twice for 0.83, and wait for a frame after each key. Take the five captures.
- [ ] **Step 2:** Verify with `file *.png`: each file is 3200 × 1800. Look at each image: all 7 inventory items are visible, and "Blog" is readable at 0.83.
- [ ] **Step 3:** Tick `INVENTORY.md` and name the capture for each item. Commit `docs(#363): plataforma captures and inventory ticked`.

## Assumptions

- **Sign posts behind the frame**, inset `POST_INSET` = 1 and flush with the beam box (see the Decision above). Rejected: posts at the beam ends, which don't fit on the deck; shortening the beams below `width + 1`, which the issue fixes; posts inside the span, which the box test forbids. POST_INSET = 1 is the round value ≥ 0.8 that keeps the beam boxes clear of the hut (x ≤ −4.2).
- **The neon crosses solids** (the `g` descender passes the lower beam, the handrail and the deck edge). Accents are drawn on top of everything (CONTEXT.md, Accent), and occlusion is out of scope for the story (spec §7). Reported in the PR.
- **Pile × deck exclusion** is kept as the issue writes it, even though the boxes only touch.
- **Hut door plate and dot offset** (0.05 in front of the S wall): the inventory needs a door the light sits above, and nothing more is specified.
- **Photos resized by Commons** (`iiurlwidth`/`iiurlheight` 1280), since ImageMagick is not installed. If fewer than 4 free photos turn up, that criterion is reported as unmet in the PR; nothing is invented.
- **Legibility at 0.83** is judged by eye on `plataforma-083.png` (issue: "a 0.83 la palabra se sigue reconociendo en la captura"). If it fails, the PR reports it; the size stays at 8.55 (issue: "el tamaño sale del criterio").

## Grilling

- Rounds: 1 (the revisions were wording and verification steps, not a different seam; no second round).
- Questions: 18. Sources: ISSUE 9, CODE 12, DOC 3 (several answers cite more than one). The four technical assumptions are listed above.
- Spec ambiguities: 0. Follow-up issues opened: none.
- Revisions:
  - Q4: the clearance is stated on boxes.
  - Q6: Task 1 runs the full suite.
  - Q7: one expression for the railing posts, with the SE corner deduplicated.
  - Q13: the storybook frames by `solidsBox` over the solids only (`src/lab/storybook.ts:68`). The accents stay inside the solids' extent: the word top is at 12.05 < 12.425, and the dot at 5.6.
  - Q15: thumbnails from Commons instead of ImageMagick.
