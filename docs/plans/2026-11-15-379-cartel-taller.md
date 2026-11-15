# Portfolio tinker sign on the assembly-hall ridge (#379): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Portfolio graffiti wall with the *tinker sign*: nine hand-made letter modules (five techniques, each with its own dark panel and an amber core) on a steel scaffold that rides the ridge of the south assembly hall, audited in its scene by levels 1, 2 and 3.

**Architecture:** One new Pixi-free module, `src/scenes/sign-tinker.ts`, builds everything relative to a ridge point `at`: the `SignSpec` (`tinkerSpec(at)`, with one tilted/offset plane per glyph), the letter panels, the per-technique accents drawn *from* that spec, the scaffold, the floodlight, and an animator whose single accent layer `tinker.lights` owns the two lights that move (one marquee bulb and the `l` tube). Two exhibits use it: a `piece` on a 40 × 16 hall stand-in at the origin and a `context` at `TINKER_SITE` on the real shipyard, which the existing sign gate (`src/lab/signs.test.ts`) and `npm run legibility` pick up by registration.

**Tech Stack:** TypeScript, vitest, the repo's iso engine (`src/iso`), `npm run legibility` (agent-browser + tesseract.js, from #377), Wikimedia Commons API with `curl`.

**Spec:** issue #379 (its body is this task's spec) and `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§3.2, §4, §5, §6). Parent story #374, base branch `feature/374-carteles-legibles`.

## Global Constraints

- Code, comments, strings and identifiers in **English** (`src/english.test.ts` scans `src/`, `lab/`, README, CLAUDE.md; Spanish stems such as `nave`, `astillero`, `luz` are rejected: say `hall`, `shipyard`, `light`). Exhibit ids and `docs/` stay Spanish.
- **Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes.** The world (`shipyard.ts`, `assembleWorld`) does not change: the sign exists only inside the exhibits.
- `src/iso`, `src/kit`, `src/scenes` stay Pixi-free (`src/iso/pixi-free.test.ts`); deterministic (no `Math.random`); no hex outside `src/map/palette-iso.ts`; existing colors and materials only.
- All nine letters at `SIGN_FONT` (`{ size: 10.3, width: 1.35 }`, imported from `src/kit/legibility.ts`); `w` below means `SIGN_FONT.width`.
- `interlock` only on `steel` solids; no other pair of solids may have boxes that overlap by more than 1e-6 on all three axes.
- Level-3 thresholds, the bloom and `SIGN_RULES` are never tuned to make this sign pass; the sign is (alpha of the cores, smaller bulbs, darker panels), or the glyphs in `lettering.ts` if the OCR fails, keeping `lettering.test.ts` and `legibility.test.ts` green.
- `REPORT.md` is regenerated whole by `npm run legibility`, never hand-edited.

## Decisions (technical assumptions, declared)

These follow from the issue's numbers and the existing oracles; each was checked with a quick computation before writing the plan.

1. **Hall geometry is data, not a world import.** The shipyard constants are private, so `sign-tinker.ts` declares `Hall = { x0, y0, x1, y1 }` (a gable hall: eave z 10, ridge z 13.5 along x at the middle y, as `prism(…, 10, "concrete", "gable")` builds it), `SHIPYARD_HALLS` (the two assembly halls: `{ 10, −52, 100, −36 }`, `{ 10, −32, 100, −16 }`) and `STAND_IN_HALL` (`{ −20, −8, 20, 8 }`). `roofZ(x, y, halls)` returns `10 + 3.5·(1 − |y − ridgeY| / 8)` inside a hall's plan and 0 outside. `tinkerSign` takes the halls as a fourth parameter (default `SHIPYARD_HALLS`); the piece exhibit passes `[STAND_IN_HALL]`. A sign 57 u long on the (1, −1) diagonal spans y ±20 around `at`, so at the site it crosses the south hall, the gap between halls, the north hall and the ground: the bases have to know both halls.
2. **The animator needs the position.** `tinkerAnimator(opts: { reducedMotion: boolean; at?: Vec3 })`, `at` defaulting to `TINKER_SITE`: it still fits `(opts: { reducedMotion }) => Animator` for the context exhibit; the piece exhibit passes `(o) => tinkerAnimator({ ...o, at: PIECE_AT })` with `PIECE_AT = v3(0, 0, 13.5)`. The two moving lights (`tinkerLights(at)`: the whole `l` tube and one marquee bulb) are drawn only by the layer `tinker.lights`, never by `tinkerSign` (an additive light cannot be dimmed from another layer).
3. **Panels are upright `poly` slabs on the base plane (u = (1, −1, 0)/√2), not tilted:** a `poly` extrudes vertically, so it cannot follow a 3° in-plane turn. Each panel is the smallest upright rectangle (in s along u and z) that contains, seen along `VIEW_DIR`, the glyph's ink box grown by `w` on every side, plus 0.15 of slack; its bottom then drops to the deck top (the hung `l`: deck top + 0.6). Its front face is parallel to the base plane.
4. **Alternating standoff.** Neighbouring panels must overlap along u (the font's air between ink boxes, ≈ 1.6 u, is less than 2 w), yet no panel may cover a neighbour's ink-plus-`w` margin from in front, and their boxes may not interpenetrate. Both hold when even letters (`P r f l o`, indices 0, 2, 4, 6, 8) stand **far** from their panel (front face `FAR_GAP` behind the glyph, ≥ 1.8, tuned until the box test passes) and odd letters (`o t o i`) stand **near** (front face 0.06 behind the glyph), and odd glyph planes sit 0.05–0.2 u *behind* the even ones. Then every near panel lies behind the far glyphs next to it and in front of their panels with a depth gap larger than the u-overlap, so the panel boxes separate along x or y and `sortByDepth` orders them correctly. Panel thickness 0.3 (near) and 0.3–0.6 (far).
5. **Turn limits per glyph come from the aspect rule.** `signMetrics.aspectError` measures the screen box of each turned ink box: a 3° turn breaks ±8 % on thin glyphs. Turns: `P` −2°, `o` +3°, `r` −2.5°, `t` +2°, `f` −1.5°, `o` +2.5°, `l` +0.4°, `i` −0.5°, `o` +2°; z offsets within ±0.5 and depth offsets within ±0.4 (decision 4 fixes their sign). Rotation is about the centre of the glyph's ink box. The projection is almost isotropic (u → 1.414 px per unit, z → 1.4), so screen verticals stay within 4°.
6. **The scaffold lives under the panels.** Everything steel that is not a chain or the top frame stays below the deck top, so panel boxes are separated in z from it: two rows of posts 0.3² (front and back, every ≈ 6 u along u, from `roofZ` of the uphill corner of their foot — the highest roof point under the 0.3² footprint — up to the deck), steel beams 0.25² along u at deck level on each row and across (along n) at each post pair, rust planks (`beam` w 0.6 × h 0.15) laid across (along n) every 2 u on top of the beams. Two end posts beyond the first and last panel rise from the deck to a top beam along u above every panel; the `l` panel hangs from it by two steel chains 0.08². A ladder (two inclined steel beams and rungs) climbs to the deck at the `P` end; two cables (steel 0.08², two segments each with a sag) hang between front-row posts under the deck. All steel carries `interlock`.
7. **Pairs with the hall are checked on the roof surface, not by box.** A post standing on a gable slope always overlaps the gable prism's box; the sign + hall test excuses a (sign solid, hall) pair only when the solid's base is at or above `roofZ` at every corner of its footprint and the solid lies within the hall plan. Every other pair uses the box test.
8. **Floodlight:** `industrialLamp(at + n·FLOOD_N, { h: 1.2, center: true })` on the roof in front of the word's middle (base `roofZ`), its bulb recoloured `amber`; `FLOOD_N` (≈ 3.5) is chosen so the bulb's screen disc (r 1.2) touches no letter quad. Its top stays under the deck.
9. **Panels:** `P rust`, `o officeDark`, `r boxGrey`, `t sheetTeal`, `f steel`, `o rust`, `l officeDark`, `i sheetTeal`, `o officeDark` — no two neighbours share a material. Amber against each `shade` tone: rust 10.85, officeDark 10.77, boxGrey 10.09, sheetTeal 10.43, steel 9.76 (all ≥ 4.5).
10. **Techniques (default map, order kept):** `P` cutout · `o` marquee · `r` neon · `t` painted · `f` welded · `o` cutout · `l` neon (hung) · `i` painted · `o` marquee. Accents per technique, all from `spec.glyphs[i]`:
    - `cutout`: each fill quad as a `poly` `amber` alpha 0.9.
    - `marquee`: each fill quad `amber` alpha 0.5, plus `dot` `amberMid` r 0.3 every ≈ 1 u along each stroke polyline (`layout.strokes` through the glyph plane), ends included.
    - `neon`: `neon(q, "amber", 0.9)` per stroke quad (`layout.quads` through the glyph plane).
    - `painted`: a `poly` plate `safety` on wall 0 of its panel per fill quad (the quad seen along `VIEW_DIR` on the panel face, in the plate's `(u fraction, z)` coordinates), and on top the fill quads `amber` alpha 0.6.
    - `welded`: a steel `beam` 0.25² per stroke segment, centred 0.2 behind the glyph plane (so it never covers the core), `interlock`, plus `neon(q, "amber", 0.9)` per stroke quad.
11. **Site.** `TINKER_SITE` starts at `v3(60, −24, 13.5)`. Task 4 measures `checkSign` at 1.17 and 0.83 against the context crop; if it fails on occlusion or backing (the factory chimneys stand in front), `x` moves along the ridge within 40..80 to the passing value nearest 60; if none passes, the north ridge `(x, −44, 13.5)`. The value that passes is exported and pinned by a test.
12. **Old docs tests.** `src/lab/docs.test.ts`'s #364 block asserts that every id the old README names exists in `EXHIBITS`; `grafiti` stops existing here while the README is closed by #380. That `ids.has` check skips ids in a `DELETED_BY_374` list (`["grafiti"]`), and the credits-index test stops listing `grafiti`.

## Review Focus

1. **The sign through the world's own solids** at `TINKER_SITE` (a post or the ladder foot planted inside a crane, a container or a fence south of the hall): no sign solid overlaps a crop solid except posts and lamp on a hall roof (decision 7). Test in Task 4.
2. **Animated lights at t = 0 missing from the measured scene**: level 3 renders with `?speed=0`; the layer's accents at t = 0 must equal `tinkerLights(at)` with every alpha at its "on" value. Test in Task 3.
3. **Reduced motion** never changes a layer, and `tick` returns an empty set. Test in Task 3.
4. **Panel paint order**: a near panel drawn under a far one would cover the near glyph's backing on screen. Test in Task 1: the boxes of every pair of panels are disjoint, and the near panel of each pair is on the near side along the separating axis (`isBehind(far, near)` from `src/iso/depth.ts`).
5. **A world solid between the camera and the word** (chimneys, cranes): occlusion ≤ 5 % and backing = 1 at both scales; covered by the gate in `signs.test.ts` once Task 4 registers the exhibit.

## File map

- Create `src/scenes/sign-tinker.ts`, `src/scenes/sign-tinker.test.ts`.
- Delete `src/scenes/sign-graffiti.ts`, `src/scenes/sign-graffiti.test.ts`, `docs/superpowers/specs/assets/carteles-refs/grafiti/`.
- Modify `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/scenes/world-baseline.test.ts`, `src/lab/docs.test.ts`, `src/docs-glossary.test.ts`, `CONTEXT.md` (entry **Sign**).
- Create `docs/superpowers/specs/assets/carteles-refs/taller/` (`NN-<topic>.jpg`, `CREDITS.md`, `INVENTORY.md`).
- Generated: `docs/superpowers/specs/assets/374-carteles/cartel-taller-escena-117.png`, `-083.png`, `cartel-taller-real.png`; `docs/superpowers/specs/assets/carteles-legibilidad/` (REPORT.md and crops).

---

### Task 1: The letters — `tinkerSpec`, panels and per-technique accents

**Files:**
- Create: `src/scenes/sign-tinker.ts`
- Test: `src/scenes/sign-tinker.test.ts`

**Interfaces:**
- Consumes: `SIGN_FONT`, `signSpec`, `SignSpec`, `backingMargin`, `checkSign`, `COVER_LAPTOP`, `COVER_PHONE` (`src/kit/legibility.ts`); `diagonalWall`, `toWorld`, `TextPlane`, `GlyphLayout` (`src/kit/lettering.ts`); `neon` (`src/kit/props.ts`); `VIEW_DIR`, `project` (`src/iso/project.ts`); `bounds`, `Solid` (`src/iso/solids.ts`); `isBehind` (`src/iso/depth.ts`); `Plate` (`src/iso/plate.ts`).
- Produces:
  - `export const TINKER_SITE: Vec3` (`v3(60, −24, 13.5)` until Task 4).
  - `export type Technique = "cutout" | "marquee" | "neon" | "painted" | "welded"`.
  - `export const TINKER_LETTERS: readonly { char: string; technique: Technique; panel: Material; turnDeg: number; dz: number; dn: number; hung?: true }[]` (9 entries, decisions 4, 5, 9, 10).
  - `export const DECK_TOP: number` — deck (plank) top above the ridge point: `at.z + DECK_RISE`, `DECK_RISE` ≈ 2.6; exported as `deckTop(at: Vec3): number`.
  - `export function tinkerSpec(at: Vec3): SignSpec` — id `"cartel-taller"`, text `"Portfolio"`, `...SIGN_FONT`, color `"amber"`, `plane: diagonalWall(word origin)` (the word centred on `at` along u, baseline chosen so every panel bottom reaches the deck top), `style: "fill"`, `backing` = the nine panels, `glyphPlane` per decision 5.
  - `export const TINKER_SIGN: SignSpec = tinkerSpec(TINKER_SITE)`.
  - `export function tinkerLetters(out: Solid[], accents: Accent[], at: Vec3): void` — panels (copies of the spec's backing), plates, welded beams and the static accents of the nine letters, **excluding** `tinkerLights(at)`.
  - `export function tinkerLights(at: Vec3): Accent[]` — the `l` neon (tube and halo of every stroke quad) followed by the flickering bulb (the 3rd `amberMid` dot of the second `o`, index 8).

- [ ] **Step 1: Write the failing tests** in `src/scenes/sign-tinker.test.ts` (`describe("tinker sign letters (#379)")`), building at `PIECE = v3(0, 0, 13.5)` and at `TINKER_SITE`:
  - `TINKER_SIGN` matches `{ id: "cartel-taller", text: "Portfolio", size: 10.3, width: 1.35, color: "amber" }`, its glyph chars are `P o r t f o l i o`, and `TINKER_SIGN` equals `tinkerSpec(TINKER_SITE)`.
  - Nine panels: `backing` has 9 `poly` solids, each the material of `TINKER_LETTERS[i].panel`; neighbours differ in material; each panel alone backs its glyph: `backingMargin({ ...spec, glyphs: [g_i], backing: [panel_i] }, []) === 1` for every i.
  - Five techniques present, no two neighbours equal; the per-letter accents match the technique (cutout: fill quads at alpha 0.9; marquee: alpha 0.5 fill plus ≥ 4 `amberMid` dots r 0.3 within 0.01 of the glyph plane; neon: `neon(q, "amber", 0.9)` on the stroke quads; painted: one `safety` plate per fill quad on its panel plus fill at 0.6; welded: one steel beam 0.25² per stroke segment, behind the glyph plane, plus neon).
  - The amber core of every glyph comes from the spec: the union of `tinkerLetters` accents and `tinkerLights(at)` with color `amber` equals, glyph by glyph, `spec.glyphs[i].quads` (cutout, marquee, painted) or the stroke quads through `spec.glyphs[i].plane` (neon, welded).
  - Each glyph plane: `u` turned ≤ 3° from (1, −1, 0)/√2 inside the plane `span(u, v)` (`u·n = 0`, `v·n = 0`), the base point displaced ≤ 0.5 in z and ≤ 0.4 along n from the unturned word plane.
  - `checkSign(TINKER_SIGN, scale, [])` and `checkSign(tinkerSpec(PIECE), scale, [])` are `[]` at 1.17 and 0.83 (baseline ≤ 3°, verticals ≤ 4°, aspect ± 8 %, air, stroke, x-height, contrast, backing).
  - Panel boxes: every pair disjoint (no overlap > 1e-6 on all three axes) and, for each neighbouring pair, `isBehind(bounds(far), bounds(near))` is true (Review Focus 4).
  - Deterministic: two builds are deep-equal.

- [ ] **Step 2: Run** `npx vitest run src/scenes/sign-tinker.test.ts` — expected FAIL (module missing).

- [ ] **Step 3: Implement** the Produces list in `src/scenes/sign-tinker.ts`. Glyph plane for letter i: base plane `diagonalWall(origin)` with origin `at − u·width/2 + v·(baseline)`; turn `u, v` by `turnDeg` about the ink-box centre; add `v·dz + n·dn`. Panel extents by decision 3; panel s-range and z-range in base-plane coordinates; far/near standoffs by decision 4 (tune `FAR_GAP` only upward until the box test passes). Painted plates: project each fill quad's corners along `VIEW_DIR` onto the panel's front face and express them as `(s fraction along wall 0, z)`; wall 0 is the front edge (normal (1, 1, 0)/√2): write the footprint in the order that makes edge 0 the front one and assert it in the test.

- [ ] **Step 4: Run** `npx vitest run src/scenes/sign-tinker.test.ts` — expected PASS. `npm run typecheck` clean.

- [ ] **Step 5: Commit** `feat(#379): tinker sign letters — nine modules, five techniques, TINKER_SIGN`.

### Task 2: The scaffold, the floodlight and the hall stand-in

**Files:**
- Modify: `src/scenes/sign-tinker.ts`, `src/scenes/sign-tinker.test.ts`

**Interfaces:**
- Consumes: Task 1 (`tinkerSpec`, `tinkerLetters`, `deckTop`, `TINKER_LETTERS`); `industrialLamp`, `place` (`src/kit/props.ts`); `interlock` (`src/kit/piece.ts`); `prism` (`src/scenes/city-pieces.ts`); `polygonDistance` (`src/kit/lettering.ts`).
- Produces:
  - `export interface Hall { x0: number; y0: number; x1: number; y1: number }`, `export const SHIPYARD_HALLS: readonly Hall[]`, `export const STAND_IN_HALL: Hall`, `export function roofZ(x: number, y: number, halls: readonly Hall[]): number` (decision 1).
  - `export function hallStandIn(out: Solid[]): void` — `prism(−20, −8, 0, 40, 16, 10, "concrete", "gable")`.
  - `export function tinkerSign(out: Solid[], accents: Accent[], at: Vec3, halls: readonly Hall[] = SHIPYARD_HALLS): void` — scaffold (decision 6), floodlight (decision 8), then `tinkerLetters`.

- [ ] **Step 1: Write the failing tests** (`describe("tinker sign scaffold (#379)")`), with `piece()` = `hallStandIn` + `tinkerSign(…, v3(0, 0, 13.5), [STAND_IN_HALL])` and `site()` = `tinkerSign(…, TINKER_SITE)`:
  - `roofZ`: 13.5 on a ridge, 10 at an eave, 11.75 halfway, 0 outside every hall.
  - `hallStandIn` is one concrete gable prism 40 × 16 × 10 centred at the origin (ridge y 0, z 13.5).
  - Posts: ≥ 8 steel prisms 0.3², all `interlocks`; each base equals `max roofZ` over its four foot corners (within 1e-9), i.e. on a slope or at z 0; at the site, at least one stands on each hall and at least one on the ground.
  - Ladder (two inclined steel beams with ≥ 3 rungs) whose top reaches the deck at the `P` end; two cables, each two steel beams 0.08² meeting at a point lower than both ends; two chains 0.08² from the top beam to the `l` panel top.
  - Floodlight: one `industrialLamp` post h 1.2 standing on `roofZ`, one `amber` dot r 1.2 (and no `cyan` dot anywhere); its projected disc keeps a distance > 0 from every projected letter quad of the spec.
  - No interpenetration: the sign alone, and the sign plus `hallStandIn` (decision 7 for pairs with the hall); every solid with `interlocks` is `steel`.
  - Everything above the deck except panels, chains, end posts and top beam: none (the scaffold stays under the deck).
  - Deterministic.

- [ ] **Step 2: Run** `npx vitest run src/scenes/sign-tinker.test.ts` — expected FAIL on the new block.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** the file — PASS; `npm run typecheck` clean.
- [ ] **Step 5: Commit** `feat(#379): tinker sign scaffold, floodlight and hall stand-in`.

### Task 3: Life — `tinkerAnimator`

**Files:**
- Modify: `src/scenes/sign-tinker.ts`, `src/scenes/sign-tinker.test.ts`

**Interfaces:**
- Consumes: Task 1 (`tinkerLights`, `TINKER_SITE`); `Animator`, `AnimLayer`, `layerLookup` (`src/scenes/animator.ts`).
- Produces: `export function tinkerAnimator(opts: { reducedMotion: boolean; at?: Vec3 }): Animator` — `ids: ["tinker.lights"]`, one `accent` layer with the accents of `tinkerLights(at)` scaled by the current alphas; `tick(dtMs)` advances an internal clock and returns `{"tinker.lights"}` when an alpha changed.

Timing (deterministic): the bulb goes dark (alpha 0) for 120 ms at the end of each period of a fixed cycle `[1500, 2300, 1800, 2500, 2000]` ms (repeating); the `l` alternates 0.9 for 3 400 ms and 0.3 for 300 ms (period 3.7 s), offset so its dips never coincide with the bulb's in the first 20 s.

- [ ] **Step 1: Write the failing tests** (`describe("tinker animator (#379)")`):
  - At t = 0 the layer's accents equal `tinkerLights(at)` (every light on) for `at` = `TINKER_SITE` and `v3(0, 0, 13.5)`.
  - With `reducedMotion: true`, 250 ticks of 20 ms each return an empty set and the layer stays equal to its t = 0 state.
  - Without it, over 5 s in 20 ms ticks, the bulb's alpha reaches 0 at least once, the `l` tube's alpha reaches 0.3 at least once, and the two are never low in the same tick during the first 20 s.
  - Two animators fed the same ticks give equal layers (deterministic).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** with `layerLookup("tinkerAnimator", …)`.
- [ ] **Step 4: Run** — PASS; typecheck clean.
- [ ] **Step 5: Commit** `feat(#379): tinker animator — a flickering bulb and the l out of step`.

### Task 4: Exhibits, site, deletions and docs

**Files:**
- Modify: `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/scenes/world-baseline.test.ts`, `src/lab/docs.test.ts`, `src/docs-glossary.test.ts`, `CONTEXT.md`, `src/scenes/sign-tinker.ts` (final `TINKER_SITE`), `src/scenes/sign-tinker.test.ts`
- Delete: `src/scenes/sign-graffiti.ts`, `src/scenes/sign-graffiti.test.ts`, `docs/superpowers/specs/assets/carteles-refs/grafiti/`

**Interfaces:**
- Consumes: Tasks 1–3; `contextScene`, `contextAnimators` (`src/lab/crop.ts`); `assembleWorld`.
- Produces: exhibits `cartel-taller` (`kind: "piece"`, title `"Portfolio tinker sign"`, zone `portfolio`, group `shipyard`, `pad: "concrete"`, `build` = `hallStandIn` + `tinkerSign(out, accents, PIECE_AT, [STAND_IN_HALL])`, `animate: (o) => tinkerAnimator({ ...o, at: PIECE_AT })`), right after `tren`; and `cartel-taller-escena` (`kind: "context"`, title `"Portfolio tinker sign in its scene"`, `build: (out, accents) => tinkerSign(out, accents, TINKER_SITE)`, `sign: TINKER_SIGN`, `animate: tinkerAnimator`, `box` containing the whole sign and the hall that carries it, `h` measured), right after `cartel-taller`. `PIECE_AT` exported from `sign-tinker.ts`.

- [ ] **Step 1: Write the failing tests:**
  - `exhibits.test.ts`: the piece list has `cartel-taller` (portfolio) instead of `grafiti`; `cartel-taller` follows `tren` and matches the fields above; `cartel-taller-escena` follows `cartel-taller` and matches `{ title, zone: "portfolio", group: "shipyard", kind: "context", sign: TINKER_SIGN }`; existing context tests (box, framing, neighbours, determinism) then run on it.
  - `sign-tinker.test.ts`: `TINKER_SITE` equals the chosen value (Step 3); at that site `checkSign` against `contextScene(scene, e).solids` is `[]` at both scales; Review Focus 1 (no sign solid overlaps a crop solid, decision 7 for the hall roofs).
  - `world-baseline.test.ts`: `PIECES` loses `grafiti` and gains `"cartel-taller"` (hash recorded in Step 4, with a `// #379:` comment saying why).
  - `docs-glossary.test.ts`: the Sign list becomes `["cartel-helipuerto", "cartel-helipuerto-b", "cartel-taller", "cartel-taller-escena", "plataforma", "src/scenes/sign-"]`.
  - `docs.test.ts`: decision 12.
- [ ] **Step 2: Run** `npx vitest run src/lab src/scenes/sign-tinker.test.ts src/docs-glossary.test.ts` — FAIL.
- [ ] **Step 3: Choose the site** (decision 11): a throwaway script (not committed) computes `checkSign(tinkerSpec(v3(x, −24, 13.5)), s, contextScene(scene, e).solids)` for x = 60, 59, 61, … within 40..80 (and the north ridge if needed) with the exhibit's box; set `TINKER_SITE` to the first that passes. Adjust `box` (start `{ x0: 20, y0: −58, x1: 100, y1: 0 }`) so every built solid and accent is inside and the halls' carrying part shows; measure `h` as `plataforma-escena` did (smallest integer that passes framing and neighbours).
- [ ] **Step 4: Implement** the exhibits; delete the graffiti files and folder and its imports; update `CONTEXT.md` **Sign** (name `cartel-taller` and `cartel-taller-escena` with `src/scenes/sign-tinker.ts` (`tinkerSign`, `TINKER_SIGN`, `TINKER_SITE`); drop `grafiti` and `sign-graffiti.ts`); record the baseline hash.
- [ ] **Step 5: Run** `npm test` and `npm run typecheck` — both green (the gate in `signs.test.ts` now covers `cartel-taller-escena`).
- [ ] **Step 6: Commit** `feat(#379): cartel-taller exhibits replace grafiti; site, CONTEXT and docs tests`.

### Task 5: Level 3, captures and references

**Files:**
- Generated: `docs/superpowers/specs/assets/carteles-legibilidad/*`, `docs/superpowers/specs/assets/374-carteles/cartel-taller-escena-117.png`, `-083.png`, `cartel-taller-real.png`
- Create: `docs/superpowers/specs/assets/carteles-refs/taller/` (4–8 `NN-<topic>.jpg`, `CREDITS.md`, `INVENTORY.md`)
- Possibly modify: `src/scenes/sign-tinker.ts` (alphas, bulb radius, panel materials), `src/kit/lettering.ts` (only if the OCR fails)

- [ ] **Step 1:** `npm run legibility -- --only cartel-taller-escena`. Expected: every row ✓ at 1.17 and 0.83. If not, adjust the sign within the Global Constraints, re-run `npx vitest run src/scenes/sign-tinker.test.ts src/lab/signs.test.ts` and the script; at most three rounds, then document the failing row in the PR.
- [ ] **Step 2:** `npm run legibility` (all contexts) to regenerate `REPORT.md` whole.
- [ ] **Step 3:** Captures with agent-browser (viewport 1600 × 900 × 2, `?bloom=on&speed=0`): `#cartel-taller-escena` after one and two presses of `c` (1.17, 0.83) → `cartel-taller-escena-117.png`, `-083.png`; `#cartel-taller` at real scale → `cartel-taller-real.png`; plus two `?speed=10` shots of the piece for the flicker item (kept in `.scratch/`, not committed). Each committed capture is 3200 × 1800.
- [ ] **Step 4:** References: query the Commons API (`list=search`, namespace 6) for hand-made scrap signs (rusted cut-sheet letters, marquee bulb letters, neon on a workshop or shed, welded iron letters, signs on scaffolds or containers); keep 4–8 with a free licence (CC0 / CC BY / CC BY-SA / public domain) read from `imageinfo&iiprop=extmetadata`; download `thumburl` with `iiurlwidth=1280&iiurlheight=1280` using `curl -A "mapa-refs/1.0 (github.com/nicolas-ricc)"` into a fresh empty temp directory, check each is a JPEG ≤ 1280 px on its long side, move them as `NN-<topic>.jpg`. Write `CREDITS.md` (`| Archivo | Autor | Licencia | Origen |`) and `INVENTORY.md` with the issue's six boxes, ticked, each naming the capture that shows it.
- [ ] **Step 5:** `npm test`, `npm run typecheck` green. Commit `docs(#379): level-3 report, captures and tinker sign references`.

## Self-review

- Spec coverage: §1 of the issue → Tasks 1–4; §2 → Task 5 Step 4; §3 → Task 5 Steps 1–3; acceptance criteria 1–2 → Tasks 1–4, 3 → Task 5, 4 → Task 5, 5 → Task 4, 6 → every task.
- Not covered by an automatic test (go to the PR as manual verification): that a person reads "Portfolio" in the captures, and the flicker seen in two `?speed=10` captures.
