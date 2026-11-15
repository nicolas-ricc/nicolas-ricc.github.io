# Resume helipad sign, variants A and B (#361) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholders of `src/scenes/sign-helipad.ts` with the Resume rooftop helipad (a scale tower, a raised slab with net, pad marks, green edge lights, amber floodlights) in two variants: A writes "Resume" anamorphically on the pad, B stands a classic rooftop tube sign on the pad's SE edge; plus the reference photos, the inventory and the ten storybook captures.

**Architecture:** One Pixi-free scene module. A private `helipadBase(out, accents)` builds everything common to A and B; `helipadSign` adds the roof word, `helipadTubeSign` adds the frame and the standing word. Lettering only through `src/kit/lettering.ts`, tubes only through `neon()`. Signatures and exhibits do not change.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`), Vite lab (`npm run dev -- --host --port 5173`), agent-browser for captures.

**Spec:** issue #361 ("Qué hacer", "Inventario", "Medición de legibilidad", "Referencias e inventario", "Criterios de aceptación"). Story context: #352 and `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` §3.1, §4, §5. Where they differ, the issue wins.

## Global Constraints

- Signatures fixed: `helipadSign(out: Solid[], accents: Accent[]): void`, `helipadTubeSign(out: Solid[], accents: Accent[]): void`. `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts` and `src/english.test.ts` are not touched.
- Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes.
- `src/scenes` stays Pixi-free. No `Math.random`. No hex outside `palette-iso.ts`; no new color. Green triad for Resume (`neon(q, "green")`, edge lights `greenMid`); floodlights amber.
- Letters only via `strokeText` from `src/kit/lettering.ts`; tubes only via `neon()`.
- Code, comments, strings and identifiers in English. Docs under `docs/` may be Spanish.
- Legibility numbers are reported, never "fixed" by shrinking the slab or the sign under the criterion.

## Decisions (technical assumptions)

- **Coordinates.** Slab center c = (0, 0), slab top `TOP` = 32.9. "SE" = +x +y (the corner the camera faces); "NW" = −x −y; "S edge" = y = +11, "E edge" = x = +11; "NE corner" = (+11, −11).
- **Tower and cornice** (issue, "Común a A y B"): `prism(-8, -7, 0, 16, 14, 30, "officeDark")` with no facade; cornice `prism(-8.5, -7.5, 30, 17, 15, 0.4, "office")` (z 30..30.4, as `src/city/fixed.ts:37`). Slab `prism(-11, -11, 32.4, 22, 22, 0.5, "concrete")` (z 32.4..32.9).
- **Under-slab beams.** "2 vigas que cruzan entre pilares": two `beam` `steel` w 0.3 h 0.3 along x, from pillar center (−6, ±5, 32.1) to (6, ±5, 32.1); 32.1 is the beam axis (z 31.95..32.25, clear of the slab).
- **Pillars** are centered on (±6, ±5): `prism(x − 0.3, y − 0.3, 30.4, 0.6, 0.6, 2, "steel")`, z 30.4..32.4.
- **Net.** S and N prisms 22 × 0.12 on y ∈ [10.88, 11] and [−11, −10.88]; E and W prisms 0.12 × 21.76 between them; z 32.9..33.5.
- **"H"** sits on the disc: z 32.95, h 0.06. Bars `prism(−6, −6, 32.95, 1, 5, 0.06)` and `prism(−2, −6, 32.95, 1, 5, 0.06)`, crossbar `prism(−5, −4, 32.95, 3, 1, 0.06)`, all `whitewash`.
- **Disc** `cylinder` at (0, 0, 32.9), r 9, h 0.05, 16 sides, `whitewash`. **Edge lights**: 16 `dot` `greenMid` r 0.25 at (9.6 cos θ, 9.6 sin θ, 32.95), θ = 11.25° + k·22.5°.
- **Floodlights.** `industrialLamp(at, { center: true, h })` (`src/kit/props.ts:26-31`: one steel post prism of height `h`, plus a cyan `dot` bulb r 1.2; no other solid) with its bulb recolored in `sign-helipad.ts` by mapping the returned accents to `color: "amber"` (`amber` exists in `src/map/palette-iso.ts:98`; the issue asks for amber floodlights through `industrialLamp`). Centers inset so the 0.6 post touches the net: SE (10.58, 10.58), NE (10.58, −10.58), both h 5 (default); the low one at the middle of the S edge (0, 10.58) with **h 1**, so its post stays under B's lower beam box (z ≥ 33.95).
- **Interpenetration rule.** Implemented as the kit oracle (`src/kit/kit.test.ts`, `interpenetrations`): bounds boxes overlapping by > 1e-6 on all three axes fail, unless both solids carry `interlocks`. The issue's exception "pilares/vigas con la losa" maps to `interlock()` (`src/kit/piece.ts`) on the steel structure only: the 4 pillars, the 2 under-slab beams, and in B the frame beams, posts and tensors. The tower, cornice, slab, net, disc, H and lamps are never marked. A test pins that every marked solid is `steel` and a `beam` or a pillar/post `prism`.
- **A: word size by the issue's rule, not its estimate.** The word rectangle (width `W = measureText("Resume", s).width` = 25s/7 along (1, −1); height `s·|v|` = 1.4·√2·s toward NW) must fit the SE triangle inset by 1 u (x ≤ 10, y ≤ 10, x + y ≥ √2). The symmetric fit has its baseline corners on x = 10 and y = 10 and its top edge on x + y = √2: `W/2 + 1.4·√2·s = (20 − √2)/√2` → **s ≈ 3.490** (W ≈ 12.46). The issue's "≈ 6.8" only checks the width at the far chord and ignores the height; the rule wins and the gap is reported in the PR (x-height ≈ 4.1 px at 1.17, not ≈ 8). Stroke 0.8. Baseline midpoint m = (10 − W/(2√2), 10 − W/(2√2)), origin = m − u·W/2, z 32.95.
- **B: size 8.55, not `sizeForXHeight(10, 1.17)`.** The latter is 8.547… and `xHeightPx` of it gives 9.999999999999996 (< 10 in floats). The issue's 8.55 gives 10.0035. Tube 1.0.
- **B frame center** C = (11 − 5/√2, 11 − 5/√2) ≈ (7.464, 7.464): the point 10.56 u SE of c where the slab chord is 10 u (the issue rounds it to 7.47). Frame direction d = (1, −1)/√2; length L = `measureText("Resume", 8.55).width + 2` ≈ 32.54. Lower beam axis z 34.1, upper beam axis z 43.65 (= 34.1 + 8.55 + 1.0), both w 0.3 h 0.3.
- **B lower beam in two halves** (C − d·L/2 → C and C → C + d·L/2): a single diagonal beam's bounds box (x, y ∈ −4..19) swallows the SE floodlight, a false interpenetration for `sortByDepth`. The halves are collinear and read as one beam; the split is at the middle post.
- **B posts** `prism` `steel` 0.25 × 0.25 centered on C + d·s, s ∈ {−4, 0, 4}, from z 32.9 to 43.65 (the upper beam axis; interlocked).
- **B tensors** `beam` `steel` w 0.2 h 0.2 from each frame end E± = C ± d·L/2 at z 34.1 to the nearest point of the slab's top edge: (11, E+.y, 32.9) and (E−.x, 11, 32.9), each moved outward (+x / +y) by `(h/2)·|u.z|` (u the unit axis): `src/iso/solids.ts:261-279` builds the section with `up = u × side`, whose plan component is exactly `|u.z|` along the axis for a beam in a vertical x–z or y–z plane, so the correction is exact, so its box touches the net and the slab instead of entering them.
- **B word** `strokeText("Resume", diagonalWall(origin), 8.55, 1.0)` with origin = C − d·W/2 at z 34.3 (the plane through the frame axis, x + y = 2·C.x), `neon(q, "green")`.

## Review Focus

- **AABB false positives of diagonal beams.** A beam along (1, −1) has a square box; any lamp or net piece under it overlaps. Pinned by the interpenetration test of Task 1 (A) and Task 3 (B).
- **Float edge of the criterion.** `xHeightPx(size, 1.17) ≥ 10` must hold for the size actually used, not only for 8.55 as a literal. Pinned in Task 3 (assert on the word's measured cap height).
- **Halo vs tube.** `neon` scales the halo and shifts it by `NEON_BACK` in x and y: the A halos keep z 32.95 and the B halos are each coplanar to a plane x + y = k (k differs from the tube's). Tests check per-polygon, not one shared plane.
- **Signature drift.** The exhibits test builds both pieces; it must stay green without edits. Run in every task.
- **Determinism.** Two builds equal (`toEqual`). Pinned in Task 1 for both.

---

### Task 1: Common base (tower, raised slab, net, marks, lights, floodlights)

**Files:**
- Modify: `src/scenes/sign-helipad.ts` (replace the placeholders; private `helipadBase(out, accents)`; both exported functions call it; the words are Task 2 and 3)
- Test: `src/scenes/sign-helipad.test.ts` (replace the #360 placeholder tests)

**Interfaces:**
- Consumes: `prism(x, y, z, w, d, h, mat, opts?)` (`src/scenes/city-pieces.ts`), `industrialLamp`, `place`, `neon` (`src/kit/props.ts`), `interlock` (`src/kit/piece.ts`), `bounds` (`src/iso/solids.ts`), `v3` (`src/iso/geometry.ts`).
- Produces: in `sign-helipad.ts`, exported constants `SLAB_TOP = 32.9` and `HELIPAD_CENTER = v3(0, 0, 32.9)` for the tests.

- [ ] **Step 1: Failing tests** (stage 3), for `f` in both functions:
  - `out` contains `prism` at (−8, −7, 0) 16 × 14 × 30 `officeDark` (`objectContaining`);
  - one `concrete` prism 22 × 22 with `bounds.min.z ≥ 32` whose box contains the tower in plan (x −11..11 ⊇ −8..8, y ⊇ −7..7);
  - exactly 16 `dot` `greenMid`, r 0.25, each at plan distance 9.6 ± 1e-6 from (0, 0), z 32.95, angles distinct;
  - exactly 3 `dot` `amber`; no `cyan` dot;
  - 4 steel net prisms with top z 33.5 ± 1e-6 and thickness 0.12 on the slab edges;
  - a `whitewash` 16-sided cylinder r 9 at z 32.9; three `whitewash` prisms h 0.06 whose union box is centered at (−3.5, −3.5);
  - cornice `prism(-8.5, -7.5, 30, 17, 15, 0.4, "office")` present;
  - interpenetrations (copy of the kit oracle, which is a private function of `src/kit/kit.test.ts:86-94`, not importable: bounds overlap > 1e-6 on x, y and z, excused only if both `interlocks`) is `[]`;
  - every `interlocks` solid is `steel` and is a `beam` or a `prism` (pillar/post); the slab, tower, cornice, net, disc, H and lamp posts carry no mark;
  - `build(f)` `toEqual` `build(f)`.
- [ ] **Step 2:** `npx vitest run src/scenes/sign-helipad.test.ts` → the new tests fail.
- [ ] **Step 3:** Implement `helipadBase` with the values of "Decisions".
- [ ] **Step 4:** `npx vitest run src/scenes/sign-helipad.test.ts src/lab/exhibits.test.ts` → base tests pass.
- [ ] **Step 5:** Commit `feat(#361): helipad base — tower, raised slab, net, marks, lights`.

### Task 2: Variant A — the anamorphic word on the pad

**Files:**
- Modify: `src/scenes/sign-helipad.ts` (`helipadSign`)
- Test: `src/scenes/sign-helipad.test.ts`

**Interfaces:**
- Consumes: Task 1; `measureText`, `roofDiagonal`, `strokeText` (`src/kit/lettering.ts`).
- Produces: exported `ROOF_WORD_SIZE` (≈ 3.490, computed from the rule, not a literal) for the tests and the PR table.

- [ ] **Step 1: Failing tests:**
  - every `poly` accent of `helipadSign` has every z = 32.95 ± 1e-6, centroid with x + y > 0, and colors are only `green` and `greenBleed`, both present, half and half;
  - the text rectangle corners `toWorld(roofDiagonal(origin), a, b)` for a ∈ {0, W}, b ∈ {0, s} lie in x ≤ 10 + 1e-6, y ≤ 10 + 1e-6, x + y ≥ √2 − 1e-6, and the fit is tight: the two baseline corners touch x = 10 and y = 10, the top edge touches x + y = √2 (± 1e-6);
  - `ROOF_WORD_SIZE` ≈ 3.490 (± 1e-3);
  - the green tubes equal `strokeText("Resume", roofDiagonal(origin), ROOF_WORD_SIZE, 0.8)` mapped through `neon(q, "green")` (origin from Decisions).
- [ ] **Step 2:** run, fail. **Step 3:** implement. **Step 4:** run sign-helipad and exhibits tests, pass.
- [ ] **Step 5:** Commit `feat(#361): variant A — Resume lies on the pad's SE half`.

### Task 3: Variant B — the rooftop tube sign

**Files:**
- Modify: `src/scenes/sign-helipad.ts` (`helipadTubeSign`)
- Test: `src/scenes/sign-helipad.test.ts`

**Interfaces:**
- Consumes: Task 1; `diagonalWall`, `measureText`, `strokeText`, `xHeightPx` (`src/kit/lettering.ts`).
- Produces: exported `TUBE_WORD_SIZE = 8.55`, `TUBE_FRAME_CENTER` (`Vec3`, z 0) for the tests and the PR table.

- [ ] **Step 1: Failing tests:**
  - every `poly` accent of `helipadTubeSign` is coplanar with a plane of normal (1, 1, 0)/√2 (per polygon, max |x + y − k| < 1e-6); the green tubes lie on x + y = 2·(11 − 5/√2) ± 1e-6; colors `green` and `greenBleed`;
  - the green tubes equal `strokeText("Resume", diagonalWall(origin), TUBE_WORD_SIZE, 1.0)` through `neon(q, "green")` with origin at z 34.3;
  - `xHeightPx(TUBE_WORD_SIZE, 1.17) ≥ 10` and `xHeightPx(8.55, 1.17) ≥ 10`;
  - three steel `beam`s w 0.3 along (1, −1) at axis z 34.1 (two halves, total length L) and 43.65 (one, length L), all ± 1e-6; L = `measureText("Resume", 8.55).width + 2`;
  - three steel `prism` posts 0.25 × 0.25 centered at C + d·s, s ∈ {−4, 0, 4}, from z 32.9;
  - two steel `beam` tensors w 0.2, each starting at a frame end at z 34.1 and ending at z 32.9 with its box touching the slab box (overlap ≤ 1e-6 on x or y);
  - the frame ends lie outside the slab in plan (reported in the PR);
  - no poly accent of the anamorphic word (no accent at z 32.95).
- [ ] **Step 2:** run, fail. **Step 3:** implement. **Step 4:** run sign-helipad and exhibits tests, pass; `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(#361): variant B — rooftop tube sign on the pad's SE edge`.

### Task 4: References and inventory

**Files:**
- Create: `docs/superpowers/specs/assets/carteles-refs/helipuerto/NN-<tema>.jpg` (4–8), `.../helipuerto/CREDITS.md`, `.../helipuerto/INVENTORY.md`

- [ ] **Step 1:** Find 4–8 Wikimedia Commons photos with CC0 / CC BY / CC BY-SA / public domain license (rooftop helipads of office towers, lit at night, green edge lights, "H", perimeter net, floodlights; rooftop tube/neon letter signs). Neither ImageMagick nor sharp is in the container and installing packages is not allowed, so the resize is done by Commons itself: query `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1280&iiurlheight=1280&titles=File:…&format=json` and download the `thumburl` (≤ 1280 px long side) with `curl -A "mapa-refs/1.0 (github.com/nicolas-ricc)"` into an empty temp dir; save as `NN-<tema>.jpg`. Author and license come from `extmetadata`.
- [ ] **Step 2:** `CREDITS.md` with the table `| Archivo | Autor | Licencia | Origen |` as `docs/superpowers/specs/assets/estacion-refs/CREDITS.md`. Stock photos by URL only.
- [ ] **Step 3:** `INVENTORY.md` with the eight unchecked boxes of the issue's "Inventario", verbatim.
- [ ] **Step 4:** Verify from the API's `thumbwidth`/`thumbheight` (or the JPEG SOF header read with `node`): max side ≤ 1280 for each; 4 ≤ count ≤ 8.
- [ ] **Step 5:** Commit `docs(#361): helipad reference photos, credits and inventory`.

### Task 5: Captures, inventory check and legibility table (session, not a subagent)

**Files:**
- Create: `docs/superpowers/specs/assets/352-carteles/cartel-helipuerto{,-b}-{real,117}-{bloom,nobloom}.png`, `…-083.png` (10 files, 3200 × 1800)
- Modify: `docs/superpowers/specs/assets/carteles-refs/helipuerto/INVENTORY.md` (check the boxes, each naming its capture)

- [ ] **Step 1:** Dev server; `agent-browser set viewport 1600 900 2`; URLs `http://localhost:5173/lab/storybook.html?bloom=on#cartel-helipuerto` and `…#cartel-helipuerto-b` (`?bloom=` and key `c` in `src/lab/storybook.ts:19,98`); per exhibit: `?bloom=on` real → `-real-bloom`, `?bloom=off` real → `-real-nobloom`, key `c` once → `-117-bloom` / `-117-nobloom`, key `c` twice (bloom on) → `-083`.
- [ ] **Step 2:** read each PNG's IHDR with `node` (`readFileSync(f).readUInt32BE(16|20)`): 3200 × 1800.
- [ ] **Step 3:** Inspect the captures; check every inventory item against the capture where it shows; build the legibility table (PR body) for A and B.
- [ ] **Step 4:** Commit `docs(#361): helipad captures and checked inventory`.

## Assumptions

- A's size: the issue's rule ("la caja alta más grande tal que el rectángulo … entra en el triángulo SE de la losa con 1 u de margen") is the definition; its "se espera ≈ 6.8 u" is an estimate that cannot satisfy it (at 6.8 the rectangle is 24.3 × 13.5 = 328 u², larger than the 242 u² SE triangle). Rejected: building at 6.8 (spills into the NW half, over the "H"). The 1 u margin applies to all three sides of the triangle (slab edges and the diagonal); rejected: margin only from the slab edges (s ≈ 3.755, word touching the diagonal).
- Interpenetration exception through `interlock()` on the steel structure; rejected: excusing by material (would excuse net × lamp, both steel).
- B's lower beam in two collinear halves; rejected: low corner floodlights (changes A as well and contradicts "uno bajo").
- The oracle is copied into the scene test (it is private to `kit.test.ts`); rejected: exporting it from a shared module (touches the kit tests, outside this issue).
- Photos resized by Commons' thumbnail service (`iiurlwidth`/`iiurlheight` 1280); rejected: local resize (no tool available, installs not allowed).

## Grilling

- Rounds: 1 (the plan changed by additions only: cornice decision and assertion, URLs, resize method, sources; no step added or removed).
- Questions: 16. Sources: ISSUE 7 (Q1, Q2, Q3, Q5, Q6, Q7, Q14), CODE 9 (Q4, Q6, Q8, Q9, Q10, Q13, Q15, Q16, Q11 network check), DOC 0, NO SOURCE 3 (Q9 copy vs export, Q11 resize tool, Q12 asset weight) → all technical assumptions.
- Q12: no repo rule on binary assets (`.gitattributes` only marks `*.pdf binary`; no LFS); earlier capture folders weigh 16–37 MB (`docs/superpowers/specs/assets/85-barcos` 29 MB); the issue mandates the ten captures.
- Issues opened: none. Spec ambiguities: none.
