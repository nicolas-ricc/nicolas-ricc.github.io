# Resume west bank on the new layout: `city-plan.ts`, parcels, Plaza Mayor and provisional zoning (#472) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the west bank of Resume (`x < 192`, `y ≥ 164`) is built from a new pure layout module, `src/scenes/city-plan.ts` (grid of 24 × 24 blocks every 30, eight axes, Plaza Mayor, crossing plazas, polygonal parcels with a barrio), and the terrain, plinths, plaza, provisional zoning, center lines and parked cars read from it; the tower and its crown stay where they are on a provisional island.

**Architecture:** `city-plan.ts` ports the geometry of the study plan (`plano.html`: `clipHalf`, `subtract`, `segRect`, `segX`, `clipSeg`, `chamfer`) and exposes constants plus `parcels(bounds)`. `city-grid.ts` keeps only the strip (row 92, freight lots), the east bank and the shared constants; `blocks()` stops returning the old west grid and `inBlock` also tests parcels. `zoning.assign` walks `blocks()` first (unchanged behaviour) and then `parcels(CITY_BOUNDS)`, `city.ts` gives each parcel a polygon plinth, `fixed.ts` moves the plaza to `PLAZA_MAYOR`, `streets.ts` paints center lines on the new grid and on the axes. `sprawl-grid.ts`, `tech.ts`, `sign-crown.ts` and `city-anim.ts` keep their behaviour.

**Tech Stack:** TypeScript, Vitest (node, no Pixi), PixiJS v8 only for the screenshots (agent-browser).

**Spec:** issue #472 (binding: "Qué construir", "Decisiones que hereda este hijo", "Criterios de aceptación"); story #471 plan comment (D1..D6, D15); `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md` §4, §5, §9; `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/plano.html` (tab A, "Continuidad").

## Global Constraints

- `PITCH = 30`, `BLOCK = 24`, `STREET = 6` (the same 6 as `city-grid.STREET`), `GRID_ORIGIN = { x: 13, y: 21 }`; `SIDEWALK` stays in `city-grid.ts` (1.5).
- `LAND = { y0: 164, x1: 184 }`; `PLAZA_MAYOR = { x: 132, y: 206, w: 54, d: 85 }`, `PLAZA_CENTER = { x: 159, y: 248 }`, `HOTEL_LOT = { x: 73, y: 234, w: 54, d: 51 }`, `BRIDGE_LANDING = { x: 132, y: 207, w: 54, d: 10 }`, `TOWER_ISLAND = { x: 120, y: 219, w: 18, d: 16 }`, `CROSSING_PLAZA_R = 11`.
- `AXES`, in this order: `costanera` "Costanera" (188,160)→(188,480) w 8 `costanera`; `plaza` "Avenida de la Plaza" (132,228)→(−440,228) w 12 `avenue`; `diagonalNorte` "Diagonal Norte" (132,210)→(−14,169) w 10 `diagonal`; `diagonalSur` "Diagonal Sur" (132,291)→(−420,522) w 10 `diagonal`; `bulevar` "Bulevar Central" (10,160)→(10,480) w 20 `boulevard`; `vias` "Avenida de las Vías" (184,169)→(−440,169) w 10 `avenue`; `sur` "Avenida del Sur" (184,318)→(−440,318) w 10 `avenue`; `barrio` "Avenida del Barrio" (184,378)→(−440,378) w 10 `avenue`.
- Parcel filter: area ≥ 70, `2·area/perimeter ≥ 3.4`, smaller side of the bounding box ≥ 9, centroid in `inCoverQuad(c.x, c.y, 16/9, COVER_MARGIN)` (30).
- Craters: `[{ x: 40, y: 198, r: 5 }, { x: −20, y: 258, r: 6 }, { x: 307, y: 224, r: 5 }]`.
- `CITY_BOUNDS = { x0: CITY_EDGE.west, y0: LAND.y0, x1: LAND.x1, y1: 318 }`; the city builds parcels with `c.x > CITY_EDGE.west` and `c.y < 318`.
- Do not touch: the tower, `TOWER`, `TOWER_H`, `LIT_FLOOR`, `sign-crown.ts`, `CROWN_SITE`, `city-anim.ts`, `maxHeightFor`, `maxDistrictHeight`, `sprawl-grid.ts` and `tech.ts` behaviour, the strip (`y < 164`), the east bank, the bridge, the west quay `x 192..198`.
- Code, comments and test names in English (`src/english.test.ts`). `npm test` and `npm run typecheck` green at the end of the last task.

## Measured before planning (prototype of `parcels` over the code of `feature/471`)

- With the crossing-plaza rule as written (cover margin 30) a fourth plaza appears at Diagonal Sur × Avenida del Barrio ≈ (−75.9, 378); with the plain cover (`inCoverQuad(x, y, 16/9)`, margin 0) exactly the three of the issue remain: (10, 175.7), (10, 342.1), (67.5, 318). **Decision T1:** `crossingPlazas()` filters with `inCoverQuad(x, y, 16/9)` (margin 0); the issue's result (three octagons at those centers) is the acceptance criterion.
- `parcels(CITY_BOUNDS)` gives **33** parcels (21 transición, 12 clásico, the hotel lot counted once): `x0 = CITY_EDGE.west` leaves only the columns −47 and −17 west of the boulevard. The "55..75" and "100..130" of the issue match the parcels over the whole cover width: `parcels({ x0: −Infinity, y0: 164, x1: 184, y1: 318 })` = **63** and the same to `y1: 475` = **111** (the parent's measure 1: "13 + 25 + 26 + the 4 of the hotel lot"). **Decision T2:** the count criterion is tested over `x0: −Infinity` (`PLAN_BOUNDS`, `{ ...PLAN_BOUNDS, y1: 475 }`), and `parcels(CITY_BOUNDS).length` is pinned to its measured value (33) with that comment.
- Consequence of T2: no city parcel is `moderno` in this child (the modern belt starts west of −54, which `tech` keeps until F, #479), so the `district` neighborhood gets no west parcel and the district neon signs of the city come only from `blocks()` (none today). **Decision T3:** the `manzana-distrito` exhibit frames the largest parcel of `cell (−17, 171)` (transición → residential today; it becomes district when F extends the city). Its id stays.
- The two `bars` parcels are `cell (133, 171)` rect `x 133..157, y 174..195` and `cell (163, 171)` rect `x 163..184, y 174..195`.
- Centroid: the vertex average of the polygon, as in `plano.html` (`centroid`). With these pieces it gives the same counts as the area centroid.

## Review Focus

1. **Degenerate wedges** where a diagonal cuts a block: a parcel with < 3 vertices, self-intersection, a sliver < 9 wide, or a `rect` outside `poly` would hand a recipe an impossible lot. Pinned in Task 1 (`every parcel is a simple polygon…`, `rect lies inside poly`) and Task 3 (`no solid of a parcel piece leaves rect ± 0.8`).
2. **Overlap between parcels and what is not a parcel** (axis bands, plaza, crossing plazas, tower island, the hotel lot): two plinths or a plinth and a plaza tile painted on top of each other. Task 1 (`no parcel intersects…`) and Task 4 (`plaza tiles do not step on TOWER_ISLAND nor BRIDGE_LANDING`).
3. **Parked cars on the new geometry**: a car on an axis band, the plaza, a crossing plaza, a crater, the hotel lot or the water. Task 4 (`no car falls on an axis band, plaza, crater, hotel lot nor on another car`).
4. **Ownership seam with `tech`** (west of −54, south of 318): city parcels west of `CITY_EDGE.west` or south of 318 would double-build what `tech` builds. Task 3 (`every parcel of CITY_BOUNDS gets exactly one Placed but HOTEL_LOT`, and `no placed parcel has c.x ≤ CITY_EDGE.west or c.y ≥ 318`).
5. **Import cycle** `city-grid → city-plan → sprawl-grid → city-grid`: a TDZ crash at module load. Task 1 moves `COVER_MARGIN` to `src/map/geo.ts` (re-exported by `sprawl-grid.ts`) so `city-plan.ts` imports only `geo` and types; Task 2's `inBlock` test loads the modules.

---

### Task 1: `src/scenes/city-plan.ts`, the pure layout

**Files:**
- Create: `src/scenes/city-plan.ts`
- Modify: `src/map/geo.ts` (gains `export const COVER_MARGIN = 30` with the doc comment of `sprawl-grid.ts`), `src/scenes/sprawl-grid.ts` (`export { COVER_MARGIN } from "../map/geo"` instead of its own const; nothing else)
- Test: `src/scenes/city-plan.test.ts` (written in pipeline stage 3, before Task 1, failing; extend with TDD)

**Interfaces:**
- Consumes: `inCoverQuad`, `COVER_MARGIN` (`src/map/geo.ts`); `type Vec2` (`src/iso/geometry.ts`); `type Rect` (`src/scenes/city-grid.ts`, type-only import).
- Produces:
  - constants `PITCH`, `BLOCK`, `STREET`, `GRID_ORIGIN`, `LAND`, `PLAZA_MAYOR`, `PLAZA_CENTER`, `HOTEL_LOT`, `BRIDGE_LANDING`, `TOWER_ISLAND`, `CROSSING_PLAZA_R`, `CITY_BOUNDS`, `PLAN_BOUNDS = { x0: -Infinity, y0: LAND.y0, x1: LAND.x1, y1: 318 }`;
  - `type AxisKind`, `interface Axis { id; name; from: Vec2; to: Vec2; w; kind }`, `AXES: readonly Axis[]`, `axis(id: string): Axis`;
  - `axisBand(a: Axis): Vec2[]`, `onAxis(x, y): boolean`, `crossingPlazas(): Vec2[][]`, `inCrossingPlaza(x, y): boolean`, `inPlazaMayor(x, y): boolean`, `inRect(r: Rect, x, y): boolean`;
  - `type Barrio`, `barrioAt(c: Vec2): Barrio`;
  - `interface Parcel { poly: Vec2[]; c: Vec2; area: number; d: number; barrio: Barrio; cell: { col: number; row: number }; rect: Rect }`, `interface Bounds2 { x0; y0; x1; y1 }`, `parcels(bounds: Bounds2): Parcel[]` (memoized per bounds key: it is called by terrain/inBlock), `inParcel(x, y, ps?: readonly Parcel[]): boolean` (default `parcels(CITY_BOUNDS)`);
  - geometry helpers, exported for Tasks 3–5 and the tests: `clipHalf`, `subtract`, `segRect`, `segX`, `clipSeg(p, q): [Vec2, Vec2] | null` (against `LAND` and the cover, see below), `chamfer`, `ngon`, `polyArea`, `polyPerimeter`, `polyCentroid`, `polyBox(p): Rect`, `pointInPoly(x, y, p)`, `inscribedRect(poly): Rect`, `intersectionArea(a: Vec2[], b: Vec2[]): number` (convex `b`, via `clipHalf`).

`CITY_BOUNDS` lives here (not in zoning) so the tests and `inBlock` share it; its `x0` is the literal `-54` with a comment naming `CITY_EDGE.west` (importing the value from `city-grid` would close the cycle of Review Focus 5).

- [ ] **Step 1: Run the stage-3 evals and see them fail**

Run: `npx vitest run src/scenes/city-plan.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Move `COVER_MARGIN` to `geo.ts`**, re-export it from `sprawl-grid.ts`. Run `npx vitest run src/scenes/sprawl-grid.test.ts src/scenes/hinterland` — PASS.

- [ ] **Step 3: Port the geometry** (Vec2 objects instead of `[x, y]` tuples; same arithmetic as `plano.html` lines 187–265): `clipHalf`, `subtract` (with its private `halfOf`), `segRect`, `ngon`, `chamfer`, `segX`, and `clipSeg` (Liang–Barsky against `LAND` as half-planes `y ≥ 164`, `x ≤ 184`; the cover is applied by the caller by sampling).

- [ ] **Step 4: Constants, `AXES`, `axisBand`, `onAxis`, `crossingPlazas`, `barrioAt`**

`crossingPlazas()`: for each diagonal (in `AXES` order) × each `avenue` or `boulevard` (in `AXES` order), `segX(from, to)`; keep it if `y ≥ LAND.y0 && x ≤ LAND.x1`, `inCoverQuad(x, y, 16/9)` (margin 0, Decision T1), distance to `PLAZA_CENTER` > 50 and > 26 to every kept one; octagon `ngon(c, CROSSING_PLAZA_R, 8, π/8)`. Memoize.
`barrioAt(c)`: `d = |c − PLAZA_CENTER|`; `d < 105` clasico, `d < 205` transicion, else moderno; then `c.y > 318` → bajo, `c.y > 380` → residencial; moderno with `c.y > 290` → transicion (clasico south of 318 is already bajo by the previous rule).

- [ ] **Step 5: `parcels(bounds)` and `inscribedRect`**

For each grid block `(col, row) = (13 + 30i, 21 + 30j)` whose center `(col + 12, row + 12)` lies in `bounds` (inclusive): clip the 24 × 24 square to `LAND`; subtract, in this order, every `axisBand` (AXES order), `PLAZA_MAYOR`, every crossing plaza, `TOWER_ISLAND`; keep each piece passing the Global filter. Pieces whose centroid is strictly inside `HOTEL_LOT` are replaced by one parcel `HOTEL_LOT` (`poly` its rectangle, `c` its center (100, 259.5), `cell { col: 73, row: 231 }`), emitted at the position of its first piece. Sort by `cell.row`, then `cell.col`, stable (the subtract order breaks ties). `d = |c − PLAZA_CENTER|`, `barrio = barrioAt(c)`.
`inscribedRect(poly)`: search on the 1 u lattice of the bounding box (corners at `floor/ceil` of the box, plus the exact box edges) for the axis-aligned rectangle of largest area whose four corners and edge midpoints lie in `poly` (`pointInPoly` with a 1e-6 tolerance on the boundary); a rectangular parcel returns itself exactly.

- [ ] **Step 6: Extra tests (from the plan review)**: `HOTEL_LOT is exactly one parcel and no other parcel touches it` (intersection area < 1e-6); `TOWER lies inside TOWER_ISLAND`; `CITY_BOUNDS.x0 === CITY_EDGE.west` (the test imports both; guards the literal); `the rect of every CITY_BOUNDS parcel is at least 6 on each side` (measured minimum 6, so the lot minus sidewalks is ≥ 3); `parcels(PLAN_BOUNDS) and parcels({ ...PLAN_BOUNDS, y1: 475 }) are different arrays` (memo key is the template string of the four numbers, `-Infinity` included); `plaza tiles, island and landing partition PLAZA_MAYOR` lives in Task 4.
- [ ] **Step 7: Run** `npx vitest run src/scenes/city-plan.test.ts` — PASS (every criterion of the issue's first bullet, with Decisions T1/T2).

- [ ] **Step 8: Commit** `feat(#472): city-plan layout module`.

### Task 2: `city-grid.ts` keeps the strip and the east; terrain and craters

**Files:**
- Modify: `src/scenes/city-grid.ts`, `src/scenes/sprawl-grid.ts` (local `const BLOCK_D = 18` for the suburb blocks, exported, same doc as today; `import` of `BLOCK_D` from `city-grid` goes), `src/lab/exhibits.ts` (imports `BLOCK_D` from `sprawl-grid` for the tech exhibits only)
- Test: `src/scenes/city-grid.test.ts`, `src/scenes/terrain.test.ts`, `src/scenes/seam-90.test.ts`, `src/scenes/sprawl-grid.test.ts` (rewritten where they pinned the old west grid; the strip, the east and the bridge stay as they are)

**Interfaces:**
- Consumes: `parcels`, `inParcel`, `CITY_BOUNDS` (Task 1).
- Produces: `BlockKind` gains `"parcel"`; `blocks()` returns only row 92 (`WEST_COLS × ROWS[0]` minus the station land), the two east blocks of the strip and the freight lots (`row −1`), and the east bank (`EAST_COLS × ROWS 164..242`, with `COLLAPSED`); no `plaza`, `district` or `site` blocks. `CRATERS` new values. `inBlock(x, y)` = old rectangle test over `blocks()` **or** `inParcel(x, y)`. Removed exports: `BLOCK_D`, `DISTRICT_COLS`, `DISTRICT_ROWS`, `SITE` (and `PLAZA` once Tasks 4–5 stop importing it — remove it in Task 5). `WEST_COLS` stays (row 92, freight lots, sprawl's south columns, the bridge exhibit).

- [ ] **Step 1: Failing tests** in `city-grid.test.ts`: `blocks() has no west block south of the strip` (every `bank: "west"` block has `y < 164`); `CRATERS are the two west crossings and the east one` (exact values); `the two west craters sit on ordinary streets of the new grid` (each center is at `x = 13 + 24 + 3 + 30k` or `y = 21 + 24 + 3 + 30k` — (40, 198): x 40 = 13 + 27, y 198 = 21 + 177; and no `onAxis`, no `inParcel`); `inBlock is true inside a parcel and false on an axis band` (`inBlock(PLAZA_CENTER)` false, a parcel centroid true, `(10, 250)` false). `terrain.test.ts`: `the west bank is asphalt except the two west craters` (sample `x −50..190`, `y 164..318` every 3: `cityTerrainAt` is `asphalt` or, inside a crater, `jungle`).
- [ ] **Step 2: Run them**, expected FAIL on blocks/craters.
- [ ] **Step 3: Implement** the `city-grid.ts` changes; `terrain-classify.ts` needs no change (it already reads `inCrater`) — confirm.
- [ ] **Step 4: Run** `npx vitest run src/scenes/city-grid.test.ts src/scenes/terrain.test.ts src/scenes/seam-90.test.ts src/scenes/sprawl-grid.test.ts` — PASS. Other suites (zoning, fixed, streets, city, exhibits) may be red until Tasks 3–5: they still pin the old west grid.
- [ ] **Step 5: Commit** `feat(#472): city-grid keeps the strip and the east bank`.

### Task 3: zoning over parcels and polygon plinths in `city.ts`

**Files:**
- Modify: `src/city/zoning.ts`, `src/scenes/city.ts`
- Test: `src/city/zoning.test.ts`, `src/scenes/city.test.ts` (plinth/rect cases)

**Interfaces:**
- Consumes: `parcels`, `CITY_BOUNDS`, `HOTEL_LOT`, `PLAZA_MAYOR`, `axisBand`, `AXES`, `crossingPlazas`, `polyBox`, `type Parcel` (Task 1); `blocks()` (Task 2).
- Produces: `Placed` gains `parcel?: Parcel`; for a parcel, `Placed.block = { ...parcel.rect, bank: "west", row: -2, kind: "parcel" }`. `neighborhoodOfParcel(p: Parcel): Neighborhood` (`clasico → downtown`, `transicion → residential`, `moderno → district`, `bajo`/`residencial → residential`; `bars` when `p.c.y < 206 && p.rect.x + p.rect.w >= 157`). `parcelOpenSides(p: Parcel): Side[]` (a side is open when that edge of `polyBox(p.poly)` lies within 0.5 of an axis band, `PLAZA_MAYOR` or a crossing plaza — test: offset the edge's midpoint and two points at ¼ and ¾ by 0.5 outward and check `onAxis || inPlazaMayor || inCrossingPlaza`). `isHotelLot(p: Parcel): boolean`. `FIXED` = `market`, `fishMarket`, `foodHall`, `coveredMarket` only (`WATER_TOWER_BLOCK` export goes; `waterTowerLot` stays, D12 brings the tower back).
- `assign(rng, districtRng)`: first the loop over `blocks()` exactly as today; then `parcels(CITY_BOUNDS)` filtered by `c.x > CITY_EDGE.west && c.y < 318`, skipping `HOTEL_LOT`; neighborhood as above; recipe drawn with `districtRng` for `district`, else `rng`; the residential retry rule with `adjacent` measured between `rect`s; lot = `rect` minus `SIDEWALK` per side, `z: 0`, `open: parcelOpenSides(p)`, `maxH: district ? LANDMARK_MAX_H : MAX_BUILDING_H`.
- `city.ts`: a parcel's plinth is `{ kind: "poly", footprint: parcel.poly, z: 0, h: PLINTH_H, mat: "paving" }` when `seat` says `plinth`; the `HOTEL_LOT` parcel gets that plinth with no building (loop over `parcels(CITY_BOUNDS)` as for `isBare`); blocks keep `prism`. The water-tower host and `recipe("waterTower")` go; `footbridge` stays.

- [ ] **Step 1: Stage-3 evals** in `zoning.test.ts` and `city.test.ts` (one `Placed` per parcel but the hotel lot; barrio → neighborhood map; the two `bars`; `open` includes the side touching the `plaza` axis; `FIXED` names no west block with `y ≥ 164`; one plinth per built parcel with the parcel's footprint; no parcel piece solid leaves `rect ± 0.8`; determinism) — run, expected FAIL.
- [ ] **Step 2: Implement** zoning, then `city.ts`.
- [ ] **Step 3: Run** `npx vitest run src/city/zoning.test.ts src/scenes/city.test.ts -t "parcel|plinth|deterministic|FIXED|bars|open"` — PASS.
- [ ] **Step 4: Commit** `feat(#472): zoning and plinths over the parcels`.

### Task 4: Plaza Mayor, cars, greenery and the quay terraces (`fixed.ts`)

**Files:**
- Modify: `src/city/fixed.ts`
- Test: `src/city/fixed.test.ts`, `src/scenes/city.test.ts` (tiles, island, cars)

**Interfaces:**
- Consumes: `PLAZA_MAYOR`, `PLAZA_CENTER`, `TOWER_ISLAND`, `BRIDGE_LANDING`, `HOTEL_LOT`, `onAxis`, `inPlazaMayor`, `inCrossingPlaza`, `parcels`, `CITY_BOUNDS`, `inRect` (Task 1); `assign` output shape (Task 3).
- Produces: `plazaAndTower(solids, ground, lights, rng): TowerLights` with the same signature. Tiles: `tiles(rng, r, 0.05, "plaza", plazaTone)` over the four sub-rectangles of `PLAZA_MAYOR` minus `TOWER_ISLAND` and `BRIDGE_LANDING`: `y 217..219` full width, `x 138..186 × y 219..235` (east of the island), `y 235..291` full width (the 1 u strip `y 206..207` north of the landing is all curb); the landing is one `tiles(rng, BRIDGE_LANDING, 0.05, "paving", plazaTone)` with no curb; curb 1.2 `paving` prisms on the four sides of `PLAZA_MAYOR`: north side the strip `y 206..207` (1 u, it cannot be 1.2 without stepping on the landing), east side only south of the landing (`y 217..291`, the bridge lands at `y 207..217`), south side full, west side cut by the island (`y 206..219` and `y 235..291`); tower, cornice, machine room, jungle and the two lit-floor puddles exactly as today (`TOWER`); fountain at `PLAZA_CENTER`; benches at the four corners 4 in from the curb; kiosks at the north corners (south of the landing, so they do not stand on it); lamps at `(PLAZA_MAYOR.x + 2, 248.5)` and `(PLAZA_MAYOR.x + PLAZA_MAYOR.w − 2.6, 248.5)`.
- `cars(solids, rng)`: over `blocks()` (minus `freight`) and over the built parcels (`rect`), 1..3 cars on the north or south sidewalk of the rect, rejected on an axis band, `PLAZA_MAYOR`, a crossing plaza, a crater (+2), `HOTEL_LOT`, `TOWER_ISLAND`, a parcel polygon (any of the car's four corners `inParcel`: a wedge's `poly` reaches past its `rect`), the water or another car (+1); the strip rules stay. Test: `no car stands on a parcel plinth`.
- `greenery`: craters as data (new values come from Task 2); the east-bank jungle unchanged.
- `westQuay`: terraces facing the bars parcel of column 163 (`y 174..195`): tables at `x 186`, awning against `x 182.5`, rows `y 177, 183, 189`; chairs either side of the table as today; sheds, bollards, crane, garland unchanged.

- [ ] **Step 1: Stage-3 evals** (`plaza tiles, TOWER_ISLAND and BRIDGE_LANDING partition PLAZA_MAYOR` — tile areas + island∩plaza + landing = 54 × 85, pairwise overlap 0; `plaza tiles do not step on TOWER_ISLAND nor BRIDGE_LANDING`; `no solid but the tower's and the crown's enters TOWER_ISLAND`; `tower and crown unchanged`; `no car falls on an axis band, plaza, crater, hotel lot nor on another car`) plus `fixed.test.ts` rewritten where it pinned `PLAZA` — run, expected FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `npx vitest run src/city/fixed.test.ts src/scenes/city.test.ts` — PASS.
- [ ] **Step 4: Commit** `feat(#472): Plaza Mayor, cars and quay terraces on the new layout`.

### Task 5: center lines on the new grid and the axes (`streets.ts`)

**Files:**
- Modify: `src/city/streets.ts`
- Test: `src/city/streets.test.ts`

**Interfaces:**
- Consumes: `GRID_ORIGIN`, `BLOCK`, `STREET`, `PITCH`, `LAND`, `AXES`, `axisBand`, `onAxis`, `inPlazaMayor`, `inCrossingPlaza`, `HOTEL_LOT`, `TOWER_ISLAND`, `clipSeg`, `parcels` (Task 1); `neighborhoodOfParcel` (Task 3).
- Produces: `inPlaza(x, y)` keeps its name and now means `inPlazaMayor || inCrossingPlaza`; `postZ` reads it. `lanes()`: west N-S lines at `x = 13 + 24 + 3 + 30k` from `LAND.y0` to 318 for every `x` in `(CITY_EDGE.west, LAND.x1)`, and E-W at `y = 21 + 24 + 3 + 30k` from `CITY_EDGE.west` to `LAND.x1` for `y` in `(LAND.y0, 318)`; `centerLine` breaks where the point is `onAxis`, `inPlaza`, a crater, inside `HOTEL_LOT` or `TOWER_ISLAND`; one center line per axis (`from → to` clipped with `clipSeg`, then broken by the cover with `inCoverQuad(…, 16/9, COVER_MARGIN)`, `inPlazaMayor`, `inCrossingPlaza`, a crater and `TOWER_ISLAND`). The strip lines (`y 113`, `y 137`), the east ring dashes and the east lines are unchanged. `avenue()` and `streetFurniture()` keep only the east stretch (`EAST_RING.x1..PROMENADE.x0`): its dashes, crosswalks at `EAST_LANE_X` (minus the ring), boulevard trees and traffic lights, and lamps; the old west stretch is removed. `BAR_FRONTS` from the `bars` parcels' `rect`, on the side facing `vias` (`y 174`): `{ x0: rect.x + SIDEWALK, x1: rect.x + rect.w − SIDEWALK, corners: [rect.x, rect.x + rect.w − SIDEWALK] }`; `lampXs` unchanged.

- [ ] **Step 1: Stage-3 evals** in `streets.test.ts` (each ordinary street of the new grid has a center-line stretch; each axis has a center line; no line enters a foreign axis band orthogonally, the plaza, a crossing plaza, a crater, `HOTEL_LOT` or `TOWER_ISLAND`; the east stretch keeps lanes, crosswalks and traffic lights) — run, expected FAIL.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `npx vitest run src/city/streets.test.ts` — PASS.
- [ ] **Step 4: Commit** `feat(#472): center lines on the new grid and the axes`.

### Task 6: exhibits, lights, budget, docs and the removal of the old exports

**Files:**
- Modify: `src/scenes/city-grid.ts` (remove `PLAZA`), `src/lab/exhibits.ts`, `CONTEXT.md` (Plinth, Lot; new `### Parcel` entry after `### Plinth`? No — the kit order test pins `Plinth` then the kit terms; add `### Parcel` **before** `### Plinth`), `README.md` (one sentence on `city-plan.ts` in the Resume paragraph)
- Test: `src/lab/exhibits.test.ts`, `src/city/lights.test.ts`, `src/scenes/city-budget.test.ts`, `src/lab/docs.test.ts`, `src/docs-glossary.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: exhibits `plaza` box `PLAZA_MAYOR ± 3`, h 51; `torre` unchanged; `manzana-distrito` box `rect ± 3` of the largest parcel of `cell (−17, 171)` (Decision T3), h re-measured with the `measure` of `exhibits.test.ts`; `obra` entry removed (its id may stay in `EXHIBIT_IDS`). `### Parcel` glossary entry: `(Parcela.)` what it is, the filter, the barrio, `rect` and the plinth; `Code: \`src/scenes/city-plan.ts\` (\`Parcel\`, \`parcels\`, \`inscribedRect\`, \`barrioAt\`), \`src/city/zoning.ts\` (\`Placed\`)`.

- [ ] **Step 1:** Rewrite the tests that still pin the old west grid (`lights.test.ts`'s `BLOCK`, exhibit boxes, docs that cite `PLAZA` or the water tower) — run, expected FAIL where they read the new values.
- [ ] **Step 2:** Implement; remove `PLAZA` from `city-grid.ts`; `npm run typecheck` — clean.
- [ ] **Step 3: Budget.** Run `npx vitest run src/scenes/city-budget.test.ts`. If a cap fails, measure it and rewrite the cap as measured × 1.1 rounded to the hundred with the figure in the comment.
- [ ] **Step 4:** `npm test` and `npm run typecheck` — all green.
- [ ] **Step 5: Commit** `feat(#472): exhibits, docs and budget on the new layout`.

### Task 7 (orchestrator, not an implementer): screenshots

- [ ] `npm run dev -- --host --port 5173`; agent-browser at 1600 × 900, scale 2, of `http://localhost:5173/` and `http://localhost:5173/lab/resume.html`; save as `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/trazado/sitio.png` and `.../trazado/lab-resume.png`; check by eye that the Plaza Mayor against the costanera, the plaza axis, both diagonals and the boulevard read as continuous gaps between plinths (`.scratch/evals-472.md`). Commit `docs(#472): layout screenshots`.

## Assumptions

Technical decisions taken without a source (plan review, round 1). Each lists the rejected alternative.

- **A1 (T1).** Crossing plazas are filtered by the plain cover, `inCoverQuad(x, y, 16/9)`. Rejected: margin 30. It adds a 4th octagon at (−75.9, 378), which contradicts the issue's "con estos ejes salen tres" and its criterion "crossingPlazas() devuelve 3 octógonos". That point lies south of 318, so nothing this child builds or paints changes; #478 can revisit it.
- **A2 (T2).** The issue's count bands (55..75, 100..130) are asserted over `PLAN_BOUNDS` (`x0 = −Infinity`), where they measure 63 and 111. The parent's measure 1 was taken over the full cover. `parcels(CITY_BOUNDS)` is pinned at its measured 33. Rejected: extending the city west of −54 to reach 55..75. That breaks "tech no cambia en este hijo" and "la ciudad construye c.x > CITY_EDGE.west".
- **A3 (T3).** `manzana-distrito` frames the largest parcel of `cell (−17, 171)`. That cell has two pieces, both transición. Rejected: moving the exhibit to another cell. The issue names this cell.
- **A4.** Intermediate task commits may leave suites outside the task red. The full suite must be green at the end of Task 6 (pipeline stage 4) and before the PR. Rejected: one giant task. It would defeat the per-task review.
- **A5.** The `parcels` memo key is `${x0},${y0},${x1},${y1}`.
- **A6.** `CITY_BOUNDS.x0` is the literal −54, guarded by a test against `CITY_EDGE.west`. Rejected: importing it. That would close the cycle `city-grid → city-plan → city-grid` at value level.
- **A7.** Cars also avoid `TOWER_ISLAND` and every parcel polygon. Rejected: the issue's shorter list. A wedge's `poly` reaches past its `rect`, so a car on the "sidewalk" of the rect could stand on a plinth.
- **A8.** Open sides follow the issue's bounding-box rule. A wedge whose only frontage is a diagonal may get no open side. Accepted: that is the rule as written (`open` = "lados cuya arista de la caja envolvente queda a ≤ 0.5 de la banda de un eje…").

## Grilling

- Rounds: 1 (the revisions added tests, not tasks or seams). Questions: 18.
- Sources: ISSUE 9 (Q3, Q4, Q7, Q11, Q12 partly, Q13, Q16, Q18, Q10 via the pipeline), CODE 4 (Q12 `src/scenes/city-grid.ts` TOWER (121, 220, 16 × 14) ⊂ island; Q15 `inPlaza` is only used inside `streets.ts`, `city.test.ts` has its own local copy; Q17 `sprawl-grid.ts` reads `WEST_COLS`, `ROWS`, `CITY_EDGE`, never `blocks()`; Q2 measured), NO SOURCE → technical assumption 6 (A1, A2, A4..A7). Q5 and Q6 were plan wording or test gaps, fixed inline.
- Spec ambiguities: none. Out of scope: none. Issues opened: none.
