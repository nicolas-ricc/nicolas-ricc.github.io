# #494 Hotel en bloque hasta z 60 y RESUME parado en la azotea, en 2.5D — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hotel's 45° slab and its front-facing RESUME decal with one block on the grid (the whole lot minus sidewalk, roof at z 60) and RESUME standing on the roof along the grid (`facade` plane), with letters extruded 1.2 u, a steel lattice behind and a walkway in front, all under `trainCap`, with the legibility oracle green.

**Architecture:** `src/scenes/hotel-plan.ts` stays the pure-geometry module (`zoning.ts` reads it). It holds the block's rectangle and roof, the sign's plane constants and the thin backing plate `SIGN_BACKING`, which replaces `SIGN_PANEL`. `src/scenes/sign-hotel.ts` builds the block (`body`), the sign (`hotelSign`: plate, lattice, walkway, then the letter accents: sides, faces, bulbs) and the lights. The oracle (`src/kit/legibility.ts`) measures the aspect of a `facade` sign on the projected sides of the glyph box, as it already does for `ground` signs. The limit stays 0.08. `maxHeightFor` (`src/city/zoning.ts`) computes the front cap from the plate's screen bottom instead of the fixed `FRONT_CAP_H`.

**Tech Stack:** TypeScript, vitest, PixiJS v8 (captures and FPS only), agent-browser.

**Spec:** issue #494 (binding) and `docs/superpowers/specs/2026-11-26-resume-hotel-cartel-2-5d-design.md` §3, §4, §6. Visual reference: `docs/superpowers/specs/assets/2026-11-26-resume-hotel-cartel-2-5d/plano-hotel.png` (right panel).

## Measurements taken while planning (2026-11-26, `main` = `3cb3059`)

- Today's `hotel()` has 9 solids (all raised), 384 accents (letter quads + bulbs) and 96 rooms.
- A prototype put `RESUME_SIGN`'s layout (`marqueeLayout(12, 0.07)`, ink width W = 60.535) on a `facade` plane along −y at x 123 and ran `checkSign`:
  - x-height 19.66 px at 1.17 and 13.94 px at 0.83; stroke 2.54 / 1.80; air 2.88 / 2.04; baseline 26.57° (≤ 27).
  - It fails `aspect` at **0.90**. The oracle measures the aspect on each glyph's screen *bounding box*, and on a slanted baseline the box height includes the slant (`project(0, −1, 0) = (1, −0.5)`). No facade sign can pass that measure, however it is stretched.
  - Measured on the box's projected sides (`|P(v side)| / |P(u side)|`, the way `ground` signs are measured since #456), an unstretched facade along y gives 1.4 / 1.118 = **1.2522**, an error of 0.25. With the plane's u stretched by **K = 1.17**, the error is **0.0703** (≤ 0.08). The ink is then 70.83 u long. With K = 1.17 every other metric still passes: stroke 2.98 / 2.11 px, air 3.37 / 2.39 px.
- Backing: the plate behind the letters has to cover every 7×7 sample of each ink box grown by 1·w (`SIGN_RULES.backingW`; 1.35 text units, so 1.58 u along u at K 1.17), as seen along the view ray. A plate 1.26 u behind the letter face shifts by (−1.26, −1.26, −0.9). With the ink from y 312.86 (south end) to 242.03 (north end) and the baseline at z 61.4, the plate must cover **y 239.19..313.18, z 59.15..73.85**.
- Contrast against `greenMid` on a +x-facing face, best materials: navy 5.07, abyss 4.92, glass 4.70, waterDeep 4.69; officeDark 4.26 and steel 3.86 fail the 4.5:1 floor at 1.17.
- Values today, frozen as literals in Task 1: `SIGN_SITE` = (103.30, 262.80, 33.90) at 2 decimals. The screen box of `RESUME_SIGN`'s quads at 1 decimal is −202.3..−116.7 × 118.8..135.6. `slabFootprint()` = (74.5441558772843, 279.2989898732233), (119.79898987322333, 234.04415587728428), (125.4558441227157, 239.70101012677665), (80.20101012677667, 284.95584412271575).
- Budget today (from #493): city raised solids 1 700 / cap 1 700, city static accents 1 497 / 1 600, world accents 2 066 / 2 300.

## Global Constraints

- Block: the whole lot minus sidewalk, `HOTEL_LOT {73, 234, 54, 81}` − `SIDEWALK` 1.5 = x 74.5..125.5, y 235.5..313.5 (51 × 78). One solid from the ground to the roof at **z 60**. `plaster`, with the base's chamfers (`CHAMFER` 2.4) and windows, the portico with its two lamps on the plaza face (+x), and a cornice crowning at z 60. No cornice at z 10, no moulding.
- Machine room on the roof, behind the sign (west of the lattice).
- Amber rooms on the visible faces of the block. `paperWindow` comes from a middle floor of the plaza face.
- Sign: RESUME standing on the roof along the +x edge. The text runs along −y on a `facade` plane, with cap height **12**, the baseline at **z 61.4** and its top at 73.4. Letters extruded **1.2 u** toward +x: front face `greenMid`, darker sides, bulbs on the front face. Behind: a steel lattice (chords, uprights every 6 u, diagonals, legs down to the roof) up to **z 75**. In front: a walkway with a railing.
- Nothing slanted at 45°: every solid of the hotel and the sign sits on the grid (axis-aligned footprints or beams whose plan direction is x or y).
- Train rule for every solid of the hotel and the sign: `bounds.min.y − 1.4 · bounds.max.z ≥ 134.5`.
- Letters and bulbs are accents (ADR 0003); the extrusion sides too.
- `SIGN_RULES` does not change. No rule is loosened. Only the aspect *measure* of `facade` signs changes (A1).
- Budget: the caps of `src/scenes/city-budget.test.ts` may only rise with a measurement. Count × 1.1, rounded as the file already rounds (nearest hundred; nearest ten for `strip`; up when the result would fall below the measured count), plus FPS against `main` by the #480 method: three interleaved loads per side, 1600×900×1, the `[mapa] bloom:` line, at most +2 ms on `tick + render`.
- Code, comments and test names in English (`src/english.test.ts`). `npm test` and `npm run typecheck` green.

## Assumptions (technical, declared)

- **A1. Facade aspect measured on the projected sides.** `checkSign`'s `aspect` uses the screen bounding box, which counts a facade's 26.6° baseline tilt as stretch (0.90 on any facade sign). The issue requires the oracle green "en su plano nuevo", and `SIGN_RULES` already accepts that baseline (`facadeBaselineDeg: 27`). So for `facade` signs the aspect is measured as for `ground` signs since #456: the projected v side over the projected u side, against 1. The baseline tilt is the baseline rule's job. The limit stays 0.08. Signs without `facade` or `ground` keep the bounding box measure, so their values do not move.
- **A2. Anamorphic stretch K = 1.17.** On a facade along y, true letters project 25 % narrower than designed (1.2522). The plane's u vector is scaled by K = 1.17, like `roofDiagonal`'s anamorphosis. The marquee layout is untouched (the spec's non-goal: typography and bulb grid unchanged; the plane changes). The full K = 1.2522 does not fit: ink of 75.8 u, more than the 74 u the train rule leaves on the roof.
- **A3. The span** is y 242.03..312.86 for the ink and 239.1..313.3 for the plate, against the spec's "~241..308": §11 leaves the fine measures to the builder within §4, and these are the figures that pass the oracle at cap 12.
- **A4. Backing.** The oracle requires a backing (`backing` = 1), and the sky is not a solid. `SIGN_BACKING` is a thin **navy** plate (0.3 u) right behind the letters (0.06 u gap), inside the lattice. The issue allows this ("una placa fina dentro de él"). Navy because it is the darkest material, the closest to the night sky, and it gives 5.07:1. It is not glass. The plate is `interlock`ed and sinks 1 u into the roof (z 59), so its bottom covers the lowest samples.
- **A5. Extrusion sides are accents** (`greenBleed`, `bloom: false`), pushed before the face quads. Only the sides whose outward normal faces the camera are kept (`dot(n, VIEW_DIR) > 0`). Additive blending brightens the few spots where a side overlaps its own face on screen. That is accepted.
- **A6. `FRONT_CAP_H` goes away.** `maxHeightFor` caps a rect in front of the plate at the height where its screen top meets the plate's screen bottom (minus `PLINTH_H`, floored at 0). On today's parcels it caps nothing, which the spec expected ("probablemente se puedan aflojar los topes delante").
- **A7. Historical doc tests become literals.** `src/lab/docs.test.ts` checks older specs against live constants (`slabFootprint`, `SIGN_SITE`, `RESUME_SIGN`'s screen box). Those specs record their own time, so the values are frozen as literals, the same as the crown's site in #474.
- **A8. Level 3** (`npm run legibility`) is run as a check but not committed. The committed `REPORT.md` is cross-checked against several specs by `docs.test.ts`, and re-recording it is outside this issue.
- **A9. Rooms** are the windows of floors 1..13 on the two long visible walls (+x, 78 u, and +y, 51 u): 2 × 13 × 12 = 312 animated accents, against 96 today. They are animated (city-anim), not static accents.

## Review Focus

- The sign seen from the home view on a portrait phone (390×750): the stretched word still has more than half its box inside the host (`labelLayout`), and the link hitbox follows the letters. Pinned in Task 3 (`signs.test.ts`, the measured host box) and Task 5 (captures).
- Something in front of the letters at their bottom edge, such as the walkway railing or a future tower (#495): Task 3 runs the oracle against the whole world, and Task 4 makes the cap derive from the sign, not from a constant.
- The paper animation starting inside the block: Task 2 updates `city-anim.test.ts` "never inside the hotel" to the block's footprint.
- Zone view at every `ZONE_SIZES` showing the taller sign whole: Task 3 keeps `city.test.ts` "zoneView('cv') shows the whole sign".
- The lab framing (`h`) cutting the sign at z 75: Task 5 sets `h` from the framing test's measurement.

---

### Task 1: Oracle: facade plane stretch and facade aspect; freeze historical literals

**Files:**
- Modify: `src/kit/lettering.ts` (`facade`), `src/kit/legibility.ts` (`signMetrics`, docs of `SignSpec` and `signMetrics`)
- Test: `src/kit/lettering.test.ts`, `src/kit/legibility.test.ts`, `src/lab/docs.test.ts`

**Interfaces:**
- Produces: `facade(a: Vec2, b: Vec2, z0: number, stretch = 1): TextPlane`, whose `u` is the unit direction a→b times `stretch` (`v` = (0, 0, 1)). `signMetrics(...).aspectError` for `spec.facade` is `| |P(v side)| / |P(u side)| / ((y1−y0)/(x1−x0)) − 1 |`, with the box corners `(x0,y0)`, `(x1,y0)`, `(x0,y1)` of each glyph's `layout.box` through `toWorld(g.plane, …)` and `project`. The max is taken over the glyphs.

- [ ] **Step 1: Failing tests.**
  - `lettering.test.ts`, "facade stretch scales u only": `facade({x:0,y:0},{x:0,y:-10},5,1.17)` has `u` ≈ (0, −1.17, 0), `v` (0, 0, 1), origin (0, 0, 5). The default stretch keeps |u| = 1.
  - `legibility.test.ts`, "a facade sign's aspect is measured on the projected sides": `signSpec({ id:"t", text:"RESUME", size:12, width:SIGN_FONT.width, color:"greenMid", plane: facade({x:123,y:300},{x:123,y:200},61.4, k), style:"fill", backing:[], layouts: marqueeLayout(12, 0.07), xHeight:12, stroke: MARQUEE_FACE*12, facade:true })`. With k = 1, `aspectError` ≈ 0.2522 (±0.001). With k = 1.17, it is ≈ 0.0703 (±0.001) and `checkSign(…, COVER_LAPTOP, [])` has no `aspect` violation. With k = 1.4/1.118034 (≈ 1.2522), the error is < 0.001.
  - Regression: the measured row for every non-facade sign in the table at `legibility.test.ts:~394` stays identical. The test exists; do not touch it.
- [ ] **Step 2:** `npx vitest run src/kit/lettering.test.ts src/kit/legibility.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - `facade` gains `stretch`.
  - In `signMetrics`, the `ground` branch generalizes to `spec.ground || spec.facade`, with expected aspect `spec.ground ? GROUND_ASPECT : 1`.
  - Update the doc comments: `SignSpec`'s says "`facade` relaxes the baseline limit and is measured on its projected sides", and `signMetrics`'s names both classes.
- [ ] **Step 4: Freeze the history in `src/lab/docs.test.ts`.**
  - `HOSTS.RESUME` becomes the literal four points of `slabFootprint()` listed in the Measurements, with `z: 0` and the comment `// the hotel slab of #474 (64 × 8), a literal since #494`.
  - "the 2026-11-22 spec §7.5" uses the literals `site = "(103.30, 262.80, 33.90)"` and `box = "−202.3..−116.7 × 118.8..135.6"` (U+2212 minus), with the comment `// literals since #494: the spec records the slab's sign`.
  - Drop the `RESUME_SIGN`, `SIGN_SITE` and `slabFootprint` imports where they become unused.
- [ ] **Step 5:** `npx vitest run src/kit src/lab/docs.test.ts src/lab/signs.test.ts && npm run typecheck`. Expected: PASS. The live `RESUME_SIGN` is on `diagonalWall`, without `facade`, so nothing else moves.
- [ ] **Step 6: Commit** `feat(#494): facade plane stretch and facade aspect on projected sides`.

### Task 2: The hotel as one block

**Files:**
- Modify: `src/scenes/hotel-plan.ts`, `src/scenes/sign-hotel.ts` (`body`, `hotel`, `hotelStandIn`, exports)
- Test: `src/scenes/sign-hotel.test.ts`, `src/scenes/city-anim.test.ts` (block footprint at ~462), `src/scenes/world.test.ts:~64`, `src/scenes/layout-493.test.ts` ("today's hotel…")

**Interfaces:**
- Produces, from `hotel-plan.ts` (re-exported by `sign-hotel.ts`):
  - `HOTEL_BLOCK = { x0: 74.5, y0: 235.5, x1: 125.5, y1: 313.5 }`, `HOTEL_ROOF = 60`, `HOTEL_CENTER: Vec2 = { x: 100, y: 274.5 }`.
  - `blockFootprint(d: Vec2 = {x:0,y:0}): Vec2[]`, the `chamferedRect` of the block with chamfer 2.4, displaced by `d`.
  - `HOTEL_SLAB`, `U`, `N`, `on`, `slabFootprint` are removed.
- Produces, from `sign-hotel.ts`: `HOTEL_FACADE = { floors: 14, cols: 12, base: "portico" }`. `hotel()` and `HotelLights` keep their signatures.

- [ ] **Step 1: Failing tests in `sign-hotel.test.ts`.** Replace the slab describe blocks with "sign-hotel: the block (#494)":
  - `HOTEL_BLOCK` equals `HOTEL_LOT` minus `SIDEWALK` on each side. `HOTEL_ROOF` is 60. `HOTEL_CENTER` is the block's centre.
  - The block is one `plaster` poly on `blockFootprint()`, z 0, height `HOTEL_ROOF − 0.4`, `facade: HOTEL_FACADE`.
  - The crown cornice is an `office` poly on the footprint grown 0.3, from z 59.6 to 60.
  - No solid of the building has its top between 10.5 and 59 except the block. There is no 0.4-high cornice at z 10.
  - Portico (`officeDark` 0.6 × 8 × 6 plus the `stone` lintel) and two lamps, centred on the +x face (x 125.5).
  - Machine room: an `officeDark` prism standing on z 60, with max x ≤ 118 (west of the lattice) and inside the block.
  - "No 45° anywhere": every `poly` footprint edge of the building is axis-aligned or a 45° chamfer of length 2.4·√2 (±1e-6). Every `prism` is axis-aligned by type.
  - Rooms: every room is an `amber` poly on the +x wall (all x = 125.5) or the +y wall (all y = 313.5). There are 312 of them (A9), and none on floor 0.
  - `paperWindow`: 0.6 in front of the +x wall (x 126.1). With the floor height `fh = (HOTEL_ROOF − 0.4) / 14`, its z is between `7·fh` and `8·fh`, and it is at the smallest y of that floor's windows.
  - `hotelStandIn` builds the same building solids as `hotel` (no sign), displaced by −`HOTEL_CENTER`, with no `facade` and no lights.
  - Train rule: for every solid of `hotel()`, `min.y − 1.4·max.z ≥ 134.5`.
  - Update `city-anim.test.ts`'s "inside the hotel" helper to `blockFootprint()` grown 0.5 and z < `HOTEL_ROOF`. Update `world.test.ts:~64` to find the block (`mat === "plaster" && z === 0` with the block's footprint). Update `layout-493.test.ts` "today's hotel stays inside the longer lot", which still holds with the new geometry: keep its bounds assertion and drop any slab reference.
- [ ] **Step 2:** `npx vitest run src/scenes/sign-hotel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `body` builds: block, crown cornice (`interlock`), portico and lamps as today, and the machine room (`officeDark` prism 4 × 3 × 1.5 at x 110..114, y 273..276, z 60).
  - `hotel` takes the rooms from `visibleWalls(block)`, the walls with normal (1, 0) and (0, 1), through `windowPatches` for floors 1..13. `paperWindow` is the window of floor 7 on the +x wall with the smallest y, moved 0.6 along +x.
  - The old sign (slab panel and decal, at z 31.5..48.3) would end up inside the block, so Task 3 must follow straight away. Between the two commits, the old sign's oracle and placement tests (`sign-hotel.test.ts` "RESUME_SIGN"/"the panel", `city.test.ts` "#474", `signs.test.ts`, `src/lab/signs.test.ts`) may be red. Keep `SIGN_PANEL`, `RESUME_SIGN` and `SIGN_SITE` compiling: express their site in the absolute numbers of today (`SIGN_SITE` and the `diagonalWall` origin), with no reference to the removed slab helpers.
- [ ] **Step 4:** `npx vitest run src/scenes/sign-hotel.test.ts src/scenes/city-anim.test.ts src/scenes/world.test.ts src/scenes/layout-493.test.ts && npm run typecheck`. Expected: the block tests PASS. The only red tests are the old sign tests listed above and `city-budget.test.ts` (Task 5).
- [ ] **Step 5: Commit** `feat(#494): the hotel as one block to z 60`.

### Task 3: RESUME standing on the roof

**Files:**
- Modify: `src/scenes/hotel-plan.ts` (sign constants, `SIGN_BACKING`), `src/scenes/sign-hotel.ts` (`RESUME_SIGN`, `SIGN_SITE`, `hotelSign`)
- Test: `src/scenes/sign-hotel.test.ts`, `src/scenes/city.test.ts` (the "#474" describe), `src/world/signs.test.ts:~101`, `src/kit/legibility.test.ts:~394` (the RESUME row)

**Interfaces:**
- Consumes: `facade(a, b, z0, stretch)` (Task 1), `HOTEL_ROOF`, `HOTEL_BLOCK` (Task 2).
- Produces, from `hotel-plan.ts`:
  - `HOTEL_CAP = 12`, `HOTEL_TRACKING = 0.07`, `SIGN_STRETCH = 1.17`, `SIGN_Z0 = 61.4` (baseline), `SIGN_FRONT_X = 123`, `LETTER_DEPTH = 1.2`, `SIGN_INK_S = 312.86` (the y of the ink's south end), `PANEL_GAP = 0.06`, `PANEL_T = 0.3`, `SIGN_TOP = 75`.
  - `SIGN_BACKING: Solid & { kind: "prism" }`, a `navy` prism at x `SIGN_FRONT_X − LETTER_DEPTH − PANEL_GAP − PANEL_T` (121.44), y 239.1, z 59, w `PANEL_T`, d 74.2, h 14.9 (top 73.9). Wrap it in `interlock` if the interpenetration gate asks for it.
  - `SIGN_PANEL`, `PANEL_L`, `PANEL_Z1`, `SIGN_MARGIN`, `panelAt` are removed.
- Produces, from `sign-hotel.ts`:
  - `RESUME_SIGN`, same id `cartel-torre`, `facade: true`, `backing: [SIGN_BACKING]`. Its plane is `facade(a, b, SIGN_Z0, SIGN_STRETCH)` with `a = (SIGN_FRONT_X, SIGN_INK_S + INK_X0·K)` and b north of it along −y, so the ink runs from y `SIGN_INK_S` to `SIGN_INK_S − W·K` (≈ 242.03).
  - `SIGN_SITE` = (123, centre of the ink in y ≈ 277.445, 61.4).
  - `hotelSign(out, accents, at = v3(0,0,0))` keeps its signature.

- [ ] **Step 1: Failing tests in `sign-hotel.test.ts`**, "sign-hotel: RESUME on the roof (#494)":
  - `RESUME_SIGN` matches `{ id: "cartel-torre", text: "RESUME", size: 12, color: "greenMid", xHeight: 12, stroke: MARQUEE_FACE*12, facade: true }`, and `backing` equals `[SIGN_BACKING]`.
  - Each glyph's plane has `u` ≈ (0, −1.17, 0), `v` (0, 0, 1) and `origin.x` = 123. The ink's y extent is 242.03..312.86 (±0.01), and its z extent is 61.4..73.4.
  - `checkSignFont(RESUME_SIGN)` is `[]`. `checkSign` at both scales against `hotel()`'s solids is `[]`.
  - `hotelSign` accents, in order: first `greenBleed` polys with `bloom: false` (the sides), then `greenMid` polys equal to `RESUME_SIGN`'s quads, then `windowWarm` dots (one per marquee bulb, at x 123 + 0.05).
  - Every side quad has two points at x 121.8 and two at x 123, and its outward normal has a positive dot with `VIEW_DIR`. There is at least one side per glyph.
  - Solids of `hotelSign`, besides `SIGN_BACKING`:
    - the lattice: steel `beam`s, w = h = 0.3, all with max x ≤ 121.3, top z ≤ 75 and at least one reaching 75. The uprights are vertical beams at y 240.5 + 6k (k = 0..12). There are two horizontal chords along y (z 60.15 and 74.85), one diagonal per bay (12), and legs down to the roof (from z 72 at x 121 to z 60 at x 114) at every even k (7).
    - the walkway: a steel deck prism x 123.3..125.2, y 242..311, z 60..60.2; a rail beam at x 125.05, z 61.2; posts every 6 u.
  - "Nothing slanted at 45°": every beam's plan direction (to − from, in x/y) is zero, along x or along y.
  - Train rule: every solid of `hotel()` and `hotelSign()` has `min.y − 1.4·max.z ≥ 134.5` (−1e-9).
  - `hotelSign(out, accents, d)` moves everything by `d`, and its plate is a fresh copy (`not.toBe(SIGN_BACKING)`).
  - `city.test.ts`, "#474" describe:
    - `SIGN_PANEL` becomes `SIGN_BACKING`.
    - "no solid in front of the sign rises above its bottom edge on screen" uses `SIGN_BACKING`'s bounds and the max screen y of its bottom corners at z 59.
    - The test "the sign stands at SIGN_SITE" checks `SIGN_BACKING` and the quads.
    - Keep "zoneView('cv') shows the whole sign".
  - `signs.test.ts:~101`: the RESUME host box becomes the value measured after implementation. The comment says "RESUME on the hotel roof (#494)".
  - `legibility.test.ts:~394`: the RESUME row becomes the measured metrics. The aspect is ≈ 0.0703 and the contrast ≈ 5.07.
- [ ] **Step 2:** `npx vitest run src/scenes/sign-hotel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Sides: for each glyph, each closed ring of `layout.strokes`, each segment p→q in text space. Build the quad [front(p), front(q), back(q), back(p)], where front is `toWorld(plane, …)` and back is that point − (1.2, 0, 0). Keep it when the outward normal faces the camera. The outward normal is the in-plane normal of p→q pointing away from the filled side; test with the ring's orientation, outline vs counter.
  - Lattice, walkway and plate as listed above.
  - Bulbs as today, `toWorld` on the glyph planes, with x + 0.05 so that they sit just in front of the face.
- [ ] **Step 4:** `npx vitest run src/scenes src/world src/kit src/lab/signs.test.ts && npm run typecheck`. Expected: PASS, except `city-budget.test.ts` (Task 5) and `exhibits.test.ts` / `docs-glossary.test.ts` if they name removed symbols (Task 5).
- [ ] **Step 5: Commit** `feat(#494): RESUME standing on the roof, extruded, with lattice and walkway`.

### Task 4: Front cap derived from the new sign

**Files:**
- Modify: `src/city/zoning.ts` (`maxHeightFor`, drop `FRONT_CAP_H`, import `SIGN_BACKING`), `src/kit/forms/composite.ts:21` (comment)
- Test: `src/city/zoning.test.ts` (~76–87, ~165, ~247)

**Interfaces:**
- Consumes: `SIGN_BACKING` (Task 3).
- Produces: `maxHeightFor(r: Rect, top = MAX_BUILDING_H): number`. A rect whose box `r × [0, top + PLINTH_H]` overlaps the plate's screen bounds and stands in front of it (`isBehind(plate, box)`) gets `min(top, max(0, (min over r's corners of (x+y)/2 − plateScreen.maxY) / Z_SCALE − PLINTH_H))`. Any other rect gets `top`.

- [ ] **Step 1: Failing tests.**
  - "maxHeightFor caps a rect in front of the sign's plate below the plate's screen bottom":
    - `maxHeightFor({x:118,y:316,w:12,d:20}, 100)` is < 100 and > 0. The box at that height plus `PLINTH_H` has screen minY ≥ the plate's screen maxY − 1e-9.
    - `maxHeightFor({x:60,y:200,w:24,d:18})` is `MAX_BUILDING_H`, and with `LANDMARK_MAX_H` it is `LANDMARK_MAX_H`.
    - `blockAt(42, 92)` gets `MAX_BUILDING_H`.
  - "no built parcel is capped by the sign": `builtParcels().filter(p => maxHeightFor(p.rect, 50) < 50)` is `[]`.
  - Remove `FRONT_CAP_H` from imports and comments. The tests at ~165 and ~247 keep `Math.min(top, maxHeightFor(r, top))`.
- [ ] **Step 2:** `npx vitest run src/city/zoning.test.ts`. Expected: FAIL (`FRONT_CAP_H` is still exported, and the first test returns 10).
- [ ] **Step 3:** Implement. Update `composite.ts:21`'s comment to name `maxHeightFor`.
- [ ] **Step 4:** `npx vitest run src/city src/scenes/city.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#494): front cap derived from the roof sign`.

### Task 5: Lab, glossary, budget with FPS, captures (controller with agent-browser)

**Files:**
- Modify: `src/lab/exhibits.ts` (~240–244 and the `hotel` region), `src/lab/exhibits.test.ts` (~486–495, ~551), `CONTEXT.md` (Sign entry and any `HOTEL_SLAB` / `SIGN_PANEL` / `FRONT_CAP_H` mention), `src/docs-glossary.test.ts:~100`, `README.md:173`, `src/scenes/city-budget.test.ts`, spec `docs/superpowers/specs/2026-11-26-resume-hotel-cartel-2-5d-design.md` (new `### 6.1 Desvíos (#494)`)
- Create: `docs/superpowers/specs/assets/2026-11-26-resume-hotel-cartel-2-5d/hotel/{antes,despues}-{inicio-1920x1080,inicio-390x750,zona-resume,hotel-cerca}.png`

- [ ] **Step 1: Lab.**
  - `cartel-torre`: title "Resume sign on the hotel roof"; build `hotelStandIn` plus `hotelSign(out, accents, v3(-HOTEL_CENTER.x, -HOTEL_CENTER.y, 0))`.
  - `cartel-torre-escena` and the `hotel` region: `h` is the smallest integer that passes the framing test (`exhibits.test.ts:~154`). Write the measured value and the comment `// h N: smallest integer that passes; inside 75 (lattice), …`, then update `exhibits.test.ts`'s literals.
- [ ] **Step 2: Glossary.**
  - CONTEXT.md, Sign entry: the hotel block (`HOTEL_BLOCK`, `HOTEL_ROOF`), RESUME on the roof (`RESUME_SIGN` on `facade` with `SIGN_STRETCH`, `SIGN_SITE`, `SIGN_BACKING`, `HOTEL_CAP`) and `hotelStandIn`; the facade aspect rule (A1) in the oracle's entry if there is one.
  - `docs-glossary.test.ts`: `HOTEL_SLAB` is replaced by `HOTEL_BLOCK` and `SIGN_BACKING`, with `expect(sign).not.toContain("HOTEL_SLAB")`.
  - `README.md:173`: "the Resume sign on the hotel roof, on a stand-in of the block".
  - Spec §6.1: a table of the deviations (K 1.17, the span 242..313, the navy plate, baseline 61.4, the facade aspect measure).
- [ ] **Step 3: Budget.** Measure the city raised solids, city accents, world accents, world static polygons and the #479 "budget moved" sum (`city-budget.test.ts`). Raise only the caps that fail, as count × 1.1 rounded per the file's rule, with dated comments `measured 2026-11-26 (#494): …`. Measure FPS against `main` by the #480 method: `npx vite --port 5173` on the branch and `--port 5174` on a `git worktree` of `origin/main`, three interleaved loads per side, 1600×900×1, the `[mapa] bloom:` line. The branch must stay within +2 ms. Record the table in the PR body.
- [ ] **Step 4: Captures (2×).**
  - Before from the `main` worktree, after from the branch.
  - Views: `/` at 1920×1080 and 390×750, `/area/resume/` at 1920×1080, and the lab `cartel-torre-escena` (hotel close-up).
  - Copy the files into `…/hotel/`.
- [ ] **Step 5:** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `test(#494): budget measured, lab, glossary and captures`.
