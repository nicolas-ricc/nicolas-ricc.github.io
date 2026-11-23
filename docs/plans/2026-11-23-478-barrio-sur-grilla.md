# The coastal neighborhood on the new grid: `tech.ts` south of the Avenida del Sur (#478) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tech()` builds the coastal neighborhood on the parcels of `city-plan.ts` south of the Avenida del Sur (`c.y > 318`) instead of the old 24 × 18 rows, with the same program (low houses, tile houses, monoblocks, plazas, school, club, arena, auditorium, waterfront), and the south avenues (Avenida del Barrio, Diagonal Sur, Bulevar Central; the costanera is the waterfront) continue inside it.

**Architecture:** `sprawl-grid.ts` gains `southParcels()` (the parcels of `city-plan` south of y 318 on urban ground) and `techBlocks()` (the old west blocks followed by one `SprawlBlock` per south parcel, carrying its `parcel`). `tech-zoning.ts` decides a `Kind` per block, by barrio for parcels and by distance for the west, with fixed pieces by `cell`. The neighborhood pieces stop assuming 24 × 18: they lay out on any `Rect` of at least 20 × 20 and draw their base on the parcel polygon. A new pure module `src/city/axis-streets.ts` paints axis lanes, crosswalks, traffic lights, lamps, the boulevard planter and crossing plazas inside any `bounds`; `src/scenes/tech-streets.ts` calls it for the south. The old west (`SUBURB_COLS` × `ROWS.slice(1)`, `tech.avenue()`, towers, campuses, TELECOM) and `waterfront.ts` do not change.

**Tech Stack:** TypeScript, Vitest (node, no Pixi); agent-browser for the screenshots.

**Spec:** issue #478 (binding: "Qué construir", "Decisiones que hereda este hijo", "Criterios de aceptación"); story #471 plan comment (D2, D3, D7, D13, D15); `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md` §5.2, §6.1, §8; `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` (the program).

## Global Constraints

- Ownership: `tech` builds parcels with `c.y > 318`; the city builds `c.y < 318`. Lot = `rect` minus `SIDEWALK` (1.5); the base of every parcel follows its `poly`.
- `southParcels()` = `parcels({ x0: -Infinity, y0: 318, x1: LAND.x1, y1: 650 })` filtered to `c.y > 318` and urban ground at the centroid and the four `rect` corners (see T1 below for the 318..324 strip).
- Fixed cells: `SCHOOL = { col: 103, row: 501 }`, `CLUB = { col: 133, row: 531 }`, `PLAZAS = [{ col: 133, row: 471 }, { col: 73, row: 441 }]`, `ARENA = { col: 103, row: 411 }`, `AUDITORIUM = { col: 13, row: 351 }`; `TELECOM = { x: -114, y: 242 }` stays a west block.
- `blockParity` of a parcel: `((col − 13) / 30 + (row − 21) / 30) & 1`; of a west block: today's formula.
- `low` recipes: `rowHouses 40 / patioResidential 35 / courtyardU 25`, style `STYLES.residential`, `maxH` 6, rng `ctx.rng`; its windows go to `homes` with one group per parcel, `lit = ctx.rng.chance(0.55)` once per parcel.
- Heights (spec 2026-11-22 §6.1, issue criterion): `low` ≤ 6 + `PLINTH_H`; house walls (`prism.h` of the gabled houses) ≤ 4.2; monoblock bodies `at.z + h` ≤ 13.
- Streets in the south (D13): dashed lanes 5/5 (width 0.4, `paving`) in each carriageway of the avenues and the diagonal; boulevard planter `leafDark` 4 wide, h 0.3, trees every 8; crosswalks of 3 strips of 0.8 and two traffic lights (off) at each axis × axis crossing; lamps every 12 on the north (E–W axes, diagonal) or west (N–S axes) sidewalk; crossing plaza (10, 342.1): `plaza` tiles in the octagon, curb 1.2, one lamp at its center; center lines 0.3 on the ordinary streets.
- `NEIGHBORHOOD_REGION = { x0: 43, y0: 441, x1: 186, y1: 620 }`; `TECH_FACES_BEFORE = 9189`, `REGION_FACES_BEFORE = 1849` (measured at `2b637a4`, the base of this branch, before the change, with `tech(zoneRng(SEED, "cv", 2))`, solids + ground, `facesIn`).
- `waterfront.ts`, the old west, `tech.avenue()`, `telecom`, `tower`, `campus`, `tech-anim.ts` behaviour: unchanged.
- Code, comments and test names in English (`src/english.test.ts`: identifiers must not contain Spanish stems such as `barrio`, `residencial`, `costanera`, `escuela`, `casa`; exhibit ids are allowed as strings). `npm test` and `npm run typecheck` green at the end.

## Decisions taken while planning (technical assumptions, declared)

- **T1. The 318..324 strip counts as urban for the south's parcels.** `urbanAt` keeps `CITY_EDGE.south` 324 (the issue). The parcels of row 321 have their `rect` from y 323 (the south edge of the Avenida del Sur band), and `urbanAt(x, 323)` is false east of −54, so the literal filter drops row 321 east of −54 and leaves a 22 u hole right south of the avenue (62 parcels instead of 68). The issue says the strip "is asphalt" and that the grid must not cut at y 318. The filter tests `urbanAt(x, Math.max(y, CITY_EDGE.south))`: the estuary and the bleed still decide (they only exist for `y > WORLD.y1`). Measured: 68 parcels; only `cell (163, 621)` is dropped (it lies on the bleed edge).
- **T2. Narrow residencial parcels are `low`.** Ten residencial parcels have a `rect` under 20 on a side (the columns −17 and 13 that flank the boulevard, 17 wide; `cell (13, 471)`'s two pieces). The pieces accept ≥ 20 × 20 (issue), so these get the `low` recipes (≤ 6 high, which fits residencial's 2.4–4.2 houses better than a park). Rule: in residencial, after the plaza draw, `min(rect.w, rect.d) < 20` → `low`.
- **T3. Monoblocks keep the distance gradient.** Residencial parcels with `area ≥ 450`, `blockParity === 0` and `c.y < WORLD.y1 + MONOBLOCK_D` (466) are `monoblock`; the rest `houses` (spec 2026-10-27: monoblocks between the towers and the houses).
- **T4. Heights.** Monoblock slabs are `h ∈ {9, 12}` (3 and 4 floors; body top 12.3); two slabs keep different heights. Houses are `h ∈ {3, 4.2}` (one story, and a story and a half whose upper windows sit at `Z0 + 2.6 .. Z0 + 3.4`).
- **T5. A lot smaller than `MIN_LOT_SIDE` gets the plinth only** (reuse `tooSmall` from `src/city/zoning.ts`, as `city.ts` does): `cell (−17, 321)` 7 × 8, `(43, 321)` 6 × 6, `(−47, 351)` 13 × 4 and 16 × 5.
- **T6. The axis street functions live in a new module.** The issue asks to extract `axisLanes`, `axisCrosswalks`, `axisLamps`, `boulevardPlanter`, `crossingPlaza` from `streets.ts`, but they come from B (#473), which is still open and in progress on its own branch. They are written here, once, in `src/city/axis-streets.ts`, parametrized by `bounds`, with no dependency on `zoning.ts`; B calls them with the city's bounds instead of writing its own. `streets.ts` is not touched.
- **T7. The costanera south of 324 is the waterfront.** The costanera band (x 184..192) runs over `waterfront.ts`'s promenade, bike path and lamps, which do not change. No lanes, crosswalks or lights are painted on it; the criterion "the costanera continues inside the barrio" is the waterfront's promenade strip inside the band and its lamps with `y > 330`. The only axis × axis crossings inside tech's bounds are Avenida del Barrio × Bulevar (10, 378), Avenida del Barrio × Diagonal Sur (−75.9, 378) and the crossing plaza (10, 342.1); crossings at y 318 belong to the city (B).
- **T8. `FACE_CAPS.low` is measured, not 70.** The three kit recipes on these lots measure 66..99 faces before the plinth (prototype, 10 seeds, lots 8 × 9 to 21 × 21, maxH 6), so 70 cannot hold. The cap is the measured maximum over the world's `low` parcels × 1.1, rounded up to the ten, with the figure in the comment.
- **T9. The street furniture is separable in tests.** `southStreets()` is pure (no rng); the world tests of the pieces subtract its solids (by `JSON.stringify`) before counting lamps, trees and faces of a block, because axis lamps and trees on a sidewalk fall inside the neighboring `blockRect`.

## Review Focus

1. **A piece on a non-24 rect** (21 × 22 at the costanera column, 24 × 22 next to an avenue, 20 × 20): overlaps or a solid outside `rect ± 2.5`. Each piece task runs its direct-call tests on 24 × 24, 21 × 24 and 20 × 20 with seeds 1, 7, 11.
2. **The seam at y 318**: a tech solid north of 318 east of −54, or a parcel built by both scenes. Task 5 (`tech builds only parcels south of y 318`).
3. **Street furniture on a building or on water**: a lamp or tree of the south streets inside a parcel's lot, or on non-urban ground. Task 6 (`south street furniture stays off the lots and on urban ground`).
4. **Budget**: the 24 × 24 pieces and the kit recipes push the district past +10 % or the region past +25 %. Task 7, measured before the caps are written.
5. **rng order**: the zoning must consume exactly one `chance(0.12)` per non-fixed block, so changing a piece does not reshuffle the kinds. Task 2.

---

### Task 1: `southParcels()` and `techBlocks()` in `sprawl-grid.ts`

**Files:**
- Modify: `src/scenes/sprawl-grid.ts`, `src/scenes/neighborhood-fixtures.ts`
- Test: `src/scenes/sprawl-grid.test.ts`

**Interfaces:**
- Produces:
  - `interface SprawlBlock extends Rect { dist: number; parcel?: Parcel }` (`rect` of the parcel when `parcel` is set);
  - `southParcels(): Parcel[]` (memoized; order of `parcels`: row, then col);
  - `parcelBlock(p: Parcel): SprawlBlock` = `{ ...p.rect, dist: Math.max(0, p.c.y - WORLD.y1), parcel: p }`;
  - `suburbBlocks(): SprawlBlock[]`: only the west loop (`ROWS.slice(1)` × `SUBURB_COLS`); `SUBURB_ROWS` deleted;
  - `techBlocks(): SprawlBlock[]` = `[...suburbBlocks(), ...southParcels().map(parcelBlock)]`;
  - fixtures: `blockAt(col: number, row: number): SprawlBlock` = the `parcelBlock` of the south parcel with that `cell` (throws if none or more than one), `westBlockAt(x, y)` for the old west blocks.

- [ ] **Step 1:** the stage-3 tests in `sprawl-grid.test.ts` (`southParcels: more than 40 parcels, all on urban land inside the cover`, `the west blocks stay on the old rows`, `techBlocks: west blocks first, then one block per south parcel`) fail.
- [ ] **Step 2:** implement; T1 decides the urban test.
- [ ] **Step 3:** `npx vitest run src/scenes/sprawl-grid.test.ts` passes (including the existing jungle ≤ 7 % test).
- [ ] **Step 4:** commit `feat(#478): south parcels in sprawl-grid`.

### Task 2: zoning by barrio and cell (`tech-zoning.ts`)

**Files:**
- Modify: `src/scenes/tech-zoning.ts`, `src/scenes/tech.ts` (re-exports only)
- Test: `src/scenes/tech-zoning.test.ts`

**Interfaces:**
- Consumes: `SprawlBlock.parcel`, `techBlocks()` (Task 1).
- Produces: `Kind` gains `"low"`; `SCHOOL`, `CLUB`, `PLAZAS`, `ARENA`, `AUDITORIUM` become `{ col, row }` (values above); `TELECOM` stays `{ x, y }`; `blockParity(b: SprawlBlock | Rect)` (cell formula when `b.parcel`, else today's); `inNeighborhood(b: SprawlBlock): boolean` = `b.parcel !== undefined && b.parcel.c.y > 318`; `zoneKinds(rng, blocks)` unchanged signature; `isCell(b: SprawlBlock, c: { col: number; row: number }): boolean`.

Rule order per block: fixed by cell (parcels) or `TELECOM` (west) without rng; otherwise one `rng.chance(0.12)`; then for a parcel: `bajo` → `low`; `residencial` → `plaza` if the draw came out, else `low` if `min(rect.w, rect.d) < 20` (T2), else `monoblock` if `area ≥ 450 && blockParity === 0 && c.y < WORLD.y1 + MONOBLOCK_D` (T3), else `houses`; for a west block: today's rule (`park` / `tower` / `monoblock|campus` / `houses`).

- [ ] **Step 1:** stage-3 tests fail: `the fixed ones fall on their cell with any seed`, `blockParity alternates between neighboring parcels`, `consumes exactly one chance(0.12) per non-fixed block`, `bajo parcels are low; residencial ones are houses, monoblock, plaza or low`, `no monoblock has a monoblock neighbor`, `world table` (counts pinned after measuring).
- [ ] **Step 2:** implement.
- [ ] **Step 3:** `npx vitest run src/scenes/tech-zoning.test.ts` passes.
- [ ] **Step 4:** commit `feat(#478): zoning of the south parcels by barrio and cell`.

### Task 3: houses, monoblock and plaza on any rect ≥ 20 × 20

**Files:**
- Modify: `src/scenes/neighborhood.ts` (`lawn`, `cornerLamps`), `src/scenes/neighborhood-houses.ts`, `src/scenes/neighborhood-monoblock.ts`, `src/scenes/neighborhood-plaza.ts`
- Test: `src/scenes/neighborhood.test.ts`, `src/scenes/neighborhood-houses.test.ts`, `src/scenes/neighborhood-monoblock.test.ts`, `src/scenes/neighborhood-plaza.test.ts` (the direct-call / loose-seed parts; the over-the-world parts are Task 5's)

**Interfaces:**
- Consumes: `SprawlBlock` with optional `parcel` (Task 1), `blockParity` (Task 2).
- Produces: `lawn(ctx, b: SprawlBlock | Rect)`: a `poly` `leafDark` of `b.parcel.poly` (z 0, h 0.05) when `b` carries a parcel, else today's prism; `cornerLamps(ctx, b)` at `(b.x + b.w − 1, b.y − 1.5)` and `(b.x + 1, b.y + b.d + 0.6)`; `houses`, `monoblock`, `plaza` take any `b` with `b.w, b.d ≥ 20`.

Rules: no literal 18, 18.6, 18.8, 17.5, 24 tied to the old block remains: offsets from the south edge use `b.d`, from the east edge `b.w`. On a 24 × 18 block every piece reproduces today's geometry (except T4's heights). Houses: three lots per row at pitch `b.w / 3`, house width ≤ pitch − 2, the wing only where it fits (it touches, never crosses, the next lot); walls ≤ 4.2 (T4). Monoblock: slab length `b.w − 4`, two slabs north (y + 2) and south (y + b.d − 7), heights `{9, 12}` (T4), the free band for trees between them. Plaza: paths from corner to corner of `b`, the four play structures in their quadrants by fraction of `b`.

- [ ] **Step 1:** stage-3 direct-call tests fail on `24 × 24`, `21 × 24`, `20 × 20` (`no overlaps, inside rect ± 2.5, within the cap`, seeds 1, 7, 11) and the piece-specific ones rewritten for `b.d`.
- [ ] **Step 2:** implement with TDD per piece.
- [ ] **Step 3:** `npx vitest run src/scenes/neighborhood.test.ts -t "neighborhood"` and the direct-call describes of the three files pass.
- [ ] **Step 4:** commit `feat(#478): houses, monoblock and plaza on any rect`.

### Task 4: school and club on 24 × 24

**Files:**
- Modify: `src/scenes/neighborhood-school.ts`, `src/scenes/neighborhood-club.ts`
- Test: `src/scenes/neighborhood-school.test.ts`, `src/scenes/neighborhood-club.test.ts`

**Interfaces:**
- Consumes: `blockAt(col, row)` (Task 1), `SCHOOL`, `CLUB` cells (Task 2), `lawn`/base convention (Task 3).
- Produces: `school(ctx, b)`, `club(ctx, b)` with their base on `b.parcel.poly` (paving, h 0.3) when present; elements referenced to the south edge (club front, staircase window, sidewalk lamp, trees) move with `b.d`; the geometry still does not depend on the seed and the school consumes no rng.

- [ ] **Step 1:** stage-3 tests fail (the existing ones with `y + 17`, `y + 18.6`, `y + 11` rewritten as `y + b.d − 1`, `y + b.d + 0.6`, `y + b.d − 7`; base is a `poly`).
- [ ] **Step 2:** implement.
- [ ] **Step 3:** `npx vitest run src/scenes/neighborhood-school.test.ts src/scenes/neighborhood-club.test.ts -t "fixed geometry|direct|seed"` passes.
- [ ] **Step 4:** commit `feat(#478): school and club on the 24 × 24 grid`.

### Task 5: `tech()` on the south parcels, with `low`

**Files:**
- Modify: `src/scenes/tech.ts`
- Test: `src/scenes/tech.test.ts`, the over-the-world parts of `src/scenes/neighborhood-*.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `recipe`, `seat`, `STYLES`, `tooSmall` (`src/city/zoning.ts`), `PLINTH_H`.
- Produces: `tech(rng)` walks `techBlocks()`; new `low(ctx, b)` (T5, T2; recipe pick with one `ctx.rng.next()`, `maxH` 6, plinth = `poly` paving h `PLINTH_H` when `seat` asks for one, `homes` group `${col},${row}:low`); `park`, `arena`, `auditorium` take the parcel block and draw their base on its poly; `TECH_MATS` gains whatever material the `low` recipes use (and only those).

- [ ] **Step 1:** stage-3 tests fail: `tech builds only parcels south of y 318` (no solid with `max.y ≤ 318` east of −54 and south of the old west rows; every south piece's centroid `c.y > 318`; the old west blocks all at `x < −54`), `school, club, plazas and monoblocks still exist` (≥ 1, ≥ 1, the 2 fixed plazas, ≥ 3), `auditorium and arena sit on parcels, not on an axis` (their solids inside `rect ± 0.5`, `onAxis` false at the rect centers), `bajo/residencial heights within spec`, `variety` (neighbors by cell), `nothing rests on water`, `homes in homogeneous groups`, and the world parts of the piece files.
- [ ] **Step 2:** implement.
- [ ] **Step 3:** `npx vitest run src/scenes/tech.test.ts src/scenes/neighborhood-*.test.ts -t "^(?!.*budget)"` passes, except the street tests (Task 6).
- [ ] **Step 4:** commit `feat(#478): tech builds the south parcels`.

### Task 6: south avenues (`axis-streets.ts`, `tech-streets.ts`)

**Files:**
- Create: `src/city/axis-streets.ts`, `src/city/axis-streets.test.ts`, `src/scenes/tech-streets.ts`
- Modify: `src/scenes/tech.ts` (push `southStreets()`)
- Test: `src/city/axis-streets.test.ts`, `src/scenes/tech.test.ts`

**Interfaces:**
- Consumes: `AXES`, `axisBand`, `onAxis`, `crossingPlazas`, `inCrossingPlaza`, `segX`, `pointInPoly` (`city-plan.ts`); `lamp`, `streetTree`, `trafficLight`, `place` (`kit/props.ts`); `prism` (`city-pieces.ts`).
- Produces (`axis-streets.ts`; `Stop = (x: number, y: number) => boolean`, a point is painted only where `stop` is false and it lies in `bounds`):
  - `axisLanes(ground: Solid[], bounds: Bounds2, stop: Stop): void` — dashes 5/5, width 0.4, `paving`, z 0.02: avenue and diagonal at `±w/4` from the center line, boulevard at `±(2 + (w/2 − 2)/2)`; costanera skipped (T7); a dash with an end on another axis band, a crossing plaza or `stop` is not painted.
  - `boulevardPlanter(solids: Solid[], bounds: Bounds2, stop: Stop): void` — `leafDark` prisms 4 wide, h 0.3, on the boulevard's center, cut 1 u short of other bands and crossing plazas; `streetTree` every 8 along it on the planter (z 0.3).
  - `axisCrossings(bounds: Bounds2, stop: Stop): Vec2[]` — `segX` of every pair of axes, inside `bounds`, not inside a crossing plaza, costanera excluded.
  - `axisCrosswalks(ground: Solid[], solids: Solid[], bounds: Bounds2, stop: Stop): void` — at each crossing, across each of the two axes at distance `other.w / 2 + 1.5` on each side (only where that point lies on the axis): 3 strips of 0.8, length = the axis width, parallel to the axis, 1.6 apart; two `trafficLight`s at diagonally opposite corners just outside both bands.
  - `axisLampSpots(bounds: Bounds2, stop: Stop): Vec2[]` — every 12 along each axis (costanera skipped), 1.3 outside the north edge of an E–W axis or the diagonal, the west edge of a N–S axis; spots on another band, a crossing plaza or `stop` dropped.
  - `crossingPlaza(ground: Solid[], solids: Solid[], plaza: Vec2[]): Vec2` — `plaza` tile `poly` (z 0, h 0.05) of the octagon inset 1.2, curb ring as 8 `poly` quads of `paving` h `PLINTH_H`; returns the center for the lamp.
  - `tech-streets.ts`: `SOUTH_BOUNDS = { x0: -Infinity, y0: 318, x1: LAND.x1, y1: 650 }`; `southStreets(): { ground: Solid[]; solids: Solid[]; accents: Accent[] }` (pure): calls the above with `stop` = not on urban ground (T1's clamp) or outside `inCoverQuad(x, y, 16/9, COVER_MARGIN)`; lamps at each spot with `z` = `PLINTH_H` inside a south parcel poly, else 0; the crossing plazas whose center has `y > 318`; center lines 0.3 on the ordinary streets of the south (x = 40 + 30k, y = 348 + 30k) broken by the bands, the crossing plazas and `stop`.

- [ ] **Step 1:** stage-3 tests fail: `axis-streets.test.ts` (each function on a small synthetic `bounds`: lane dashes 5 long every 10, planter width 4 and trees every 8, crosswalk strips 3 × 0.8 with 1.6 between centers, lamp spots every 12 on the north/west side, plaza tiles inside the octagon, nothing outside `bounds`); `tech.test.ts` `the Avenida del Barrio, the Diagonal Sur, the costanera and the bulevar continue inside the barrio` (lanes of barrio and diagonalSur, the boulevard planter and its trees, lamps of each with `y > 330`; the costanera: the waterfront's promenade strip inside the band and its lamps, T7) and `south street furniture stays off the lots and on urban ground`.
- [ ] **Step 2:** implement.
- [ ] **Step 3:** `npx vitest run src/city/axis-streets.test.ts src/scenes/tech.test.ts` passes except the budget describe.
- [ ] **Step 4:** commit `feat(#478): the south avenues enter the neighborhood`.

### Task 7: budget, exhibits and docs

**Files:**
- Modify: `src/scenes/tech-budget.ts`, `src/scenes/city-budget.test.ts`, `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts` (if it pins boxes), `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` (§1 note), `CONTEXT.md` (the Parcel entry: tech builds the parcels south of y 318), the header comment of `src/scenes/tech.ts`
- Test: `src/scenes/tech.test.ts` "face and accent budget", `src/scenes/city-budget.test.ts`, `src/lab/exhibits.test.ts`, docs tests

**Interfaces:**
- Produces: `NEIGHBORHOOD_REGION = { x0: 43, y0: 441, x1: 186, y1: 620 }`; `TECH_FACES_BEFORE = 9189`, `REGION_FACES_BEFORE = 1849` with the comment "measured at 2b637a4 (feature/471 before #478) with tech(zoneRng(SEED, "cv", 2))"; `FACE_CAPS.low` (T8) with its figure; `CAPS.tech` = measured raised solids × 1.1 rounded to the hundred, with the figure; exhibits `arena`, `auditorio`, `monoblock`, `casas`, `escuela`, `club`, `plaza-barrio` boxes = their parcel `rect ± M` (looked up by cell; `monoblock` and `casas` on a world parcel of that kind, chosen and named in a comment), `barrio` = a box over the neighborhood region; `mastil` and `costanera` unchanged.

- [ ] **Step 1:** run the budget tests against the new scene; if the district passes `9189 × 1.1` or the region `1849 × 1.25`, trim inside the pieces (fewer trees first, as `monoblock` does) before touching any cap.
- [ ] **Step 2:** write the measured caps and their comments; update exhibits and docs.
- [ ] **Step 3:** `npm test` and `npm run typecheck` pass.
- [ ] **Step 4:** commit `feat(#478): budget, exhibits and docs of the south neighborhood`.

Screenshots (site and `/lab/storybook.html#barrio`, 2×, in `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/sur/`) are taken by the orchestrator with the stage-3 agent-browser script after Task 7.
