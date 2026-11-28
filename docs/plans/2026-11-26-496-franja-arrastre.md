# #496 Franja de arrastre al oeste: construir hasta lo alcanzable, con barrios mezclados — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The city and the coastal neighborhood build everything a pan can show to the west and southwest (not only the 16:9 cover), and outside the cover the barrios come in mixed patches picked by a smooth deterministic field, with nothing inside the cover changing.

**Architecture:** One region predicate in `src/map/geo.ts` (`inBuildRegion` = the cover with `COVER_MARGIN` ∪ the pan reach with `COVER_MARGIN`) replaces every "cover + 30" filter of the west bank (`parcels()`, `inDomain`, the ordinary streets, `southParcels`, the south streets), and the Resume side of the bleed becomes urban ground up to that reach (`builtAt`). Parcels outside the cover set built today (the **core**) form the **strip**: they come after every core parcel, draw from a per-parcel rng, and get their barrio from a field module (`src/city/strip-mix.ts`) followed by the one-step rule with the core held fixed. North of y 318 the city builds the strip; south of it the coastal neighborhood (`tech.ts`) builds it, with a new varied-houses recipe (`scatterHouses`) where the field gives `bajo` and with the city's `CATALOGUE` recipes otherwise.

**Tech Stack:** TypeScript, vitest, pixi.js v8, agent-browser (captures and FPS).

**Spec:** issue #496; `docs/superpowers/specs/2026-11-26-resume-hotel-cartel-2-5d-design.md` §3, §4, §8, §11; reference only: `docs/superpowers/specs/assets/2026-11-26-resume-hotel-cartel-2-5d/plano.html` (`stripW`, `vnoise`, `urban`, `mixKind`, `houses`, `costero`).

## Measurements taken while planning (2026-11-26, `main` = `cc2c664`)

- `clampToBleed` extremes (8 pan directions, corners of the viewport, `viewCorners`): farthest west screen line `x − y` per config: map 1920×1080, 1440×900, 1280×1024, 390×750, 820×1180: −506.1; map 2560×1080: −588.8; cv 770×1080 and 390×750: −512.1; **cv 1920×1080: −711.1**. Every config reaches `x = −399` and `y = 711`. The cover's west edge is `x − y = −419`.
- Urban ground of the bleed today (`builtAt`): west to `WORLD.x0 − reachAt("w")` (x ≈ −204…−240), south to `WORLD.y1 + reachAt("s")` (y ≈ 624…660); beyond, jungle with hills. Part of that jungle is inside the reach, and NW of the city (x < −240, y 164…290) even inside the cover.
- Grid cells (pitch 30) with centre in the region: city rows (y < 318) 100 in reach+20 vs 70 in cover+30; south rows (318…711) 182 vs 66 (many of them over the estuary). `southParcels()` today: 68; `parcels(CITY_BOUNDS)`: 63.
- Budget today (`city-budget.test.ts`, #480): city raised ≤ 1 700 (1 518), strip ≤ 570, city accents ≤ 1 400, world static polygons ≤ 47 900 (43 546), world accents ≤ 2 000, tech raised ≤ 1 200 (1 136); "budget moved, not raised" (#479) asserts city + tech ≤ 2 658.

## Global Constraints

- Code, comments and test names in English (`src/english.test.ts`; note `barrio`, `casa`, `ciudad` are banned identifier stems in new names: use `strip`, `mix`, `house`, `urbanity`).
- Region: "lo alcanzable al arrastrar + un margen … con una constante verificada por un test con las 9 configuraciones medidas: inicio en 1920×1080, 1440×900, 1280×1024, 2560×1080, 390×750 y 820×1180; zona "cv" en 770×1080, 1920×1080 y 390×750." "Lo que está más al suroeste de `−710` no se ve nunca y no se construye."
- Field: "más alto al norte, más bajo al sur, más ruido de valor en dos escalas, ~110 u y ~45 u", deterministic; thresholds "moderno > transición > clásico > bajo"; "Entra de a poco entre `x − y = −400` y `−470`: dentro del encuadre no cambia nada." Then "la regla de escalón de un barrio".
- North of the city / coastal cut (today y 318, `CITY_BOUNDS.y1`) the city builds; south, the coastal neighborhood: houses where the field gives `bajo`, `CATALOGUE` recipes where it gives another barrio. "Los sólidos se cuentan donde se construyen (ciudad o costero) y cada presupuesto se mide aparte."
- Houses off the cover: "tamaño y posición por lote, algunas con galpón, algunos lotes vacíos o con patio." City `bajo` strip parcels look the same (houses, not blocks).
- `trainCap` (`y_min − 1.4·z_max ≥ 134.5` south of the track) holds for every new solid. One-step rule between neighbours.
- Budget caps change only with a measured figure: new cap = measured × 1.1 rounded to the nearest hundred (strip and per-kind face caps: nearest ten; if that falls below the figure, round up), comment with figure and date; FPS / `stage.tick` against `main` with the #480 method (below), branch `tick + render` ≤ main + 2 ms.
- Not touched: `coverView`, `clampToBleed`, `BLEED`, the zone views, `barrioAt` (the in-cover gradient), the Portfolio side of the bleed, the green belt (`GREEN_BELT`, y 116…158).
- `npm test` and `npm run typecheck` green at the end of every task, except that Tasks 3–6 may leave the budget assertions red: `src/scenes/city-budget.test.ts` and the whole-district / accent caps of `src/scenes/tech.test.ts` (`TECH_FACES_BEFORE`, `REGION_FACES_BEFORE`, `ACCENT_CAP` in `src/scenes/tech-budget.ts`); Task 7 re-measures them. No other test file may be left red.

## Decisions (technical assumptions, declared)

- **D1 Region constant.** `PAN_REACH_SX = −712` (the measured −711.1 rounded out to the next whole unit). The constant is verified by a test, not derived at runtime: `src/world/view.ts` imports `scenes/sign-platform` (view.ts:3), so deriving it from `clampToBleed` inside `city-plan.ts` / `geo.ts` would pull scene modules into the pure geometry layer.
- **D2 Core vs strip.** The core is what is built today: centroid inside `inCoverQuad(c.x, c.y, 16 / 9, COVER_MARGIN)`. Every core parcel keeps its polygon, barrio, neighborhood, recipe, lot and tone exactly (snapshot test). Mixing and the step rule only touch strip parcels; core parcels are fixed neighbours. Inside the 16:9 cover (x − y ≥ −419) everything is core, so "dentro del encuadre no cambia nada" holds by construction; the −400…−470 ramp (`stripWeight`) is used as the issue gives it, applied to strip parcels only (so they start at weight ≈ 0.7 at x − y ≈ −449).
- **D3 Rng isolation.** Strip parcels come after every core parcel and draw from `parcelRng(p, salt)`, a `createRng` seeded by a hash of the parcel's cell and a salt, never from the shared streams. Core draws, and everything drawn after them (water tower, plaza, harbor, cars, waterfront, green-belt jungle), stay identical. Window lighting (`lights()`, `lightsRng`) may redistribute because the pools grow; that is accepted (the criterion is parcels and barrios).
- **D4 Step rule for the strip.** Neighbours as in `parcelNeighborhoods` (polygon distance ≤ STREET + 1, or cells one pitch apart). A strip parcel with a core neighbour is clamped into `[max(core) − 1, min(core) + 1]` (if empty, the upper bound wins); between strip parcels the higher one drops to the lower + 1, repeated until stable. City and south strip run as one set; south core parcels count as `bajo` (step 0); bars and civic take no part.
- **D5 South strip non-bajo.** A south strip parcel whose field gives clasico / transicion / moderno is built by `tech.ts` with `catalogueFor(n, p)` (so moderno south of the tower zone draws `MODERNO_SLAB`), `maxHFor(n, p)`, `parcelLot`, `STYLES[n]`; its windows go to `homes` like `low()`'s.
- **D6 Budget during Tasks 3–6.** See Global Constraints. Task 7 measures and rewrites every cap that the strip pushes over, including the #479 sum assertion, which becomes `≤ 2 658 + STRIP_ADDED` with the strip's measured raised solids × 1.1.

## Review Focus

1. A pan to the extreme SW corner at 390×750 (cv 1920×1080 scale) shows asphalt and parcels, not jungle or an avenue ending in nothing → Task 2 and Task 5 sample tests over all 9 configs.
2. An in-cover parcel next to the strip silently dropping a step because a strip neighbour is `bajo` → Task 6 test "core neighborhoods equal parcelNeighborhoods(core)".
3. A strip moderno tower south of the track breaking the train rule → Task 6 trainCap test over strip lots and `station.test.ts` world rule.
4. A strip parcel overlapping an axis lane, the boulevard planter or a crossing plaza (no plaza is new, but the south streets now run to y 714) → Task 5 test that strip blocks avoid `onAxis`.
5. The lab (`city(…, { west })`, `assembleWorld` with `opts.zones`) breaking because a strip parcel or the strip rng is missing → Task 3 test `assign(..., -60)` still works and contains no strip parcel.

---

### Task 1: The pan reach and the build region

**Files:**
- Modify: `src/map/geo.ts` (next to `COVER_MARGIN`)
- Create: `src/world/pan-fixtures.ts`
- Test: `src/world/pan-reach.test.ts`

**Interfaces:**
- Produces: `PAN_REACH_SX: number` (−712); `inPanReach(x: number, y: number, margin = 0): boolean` (true iff `x − y ≥ PAN_REACH_SX − margin`, `x ≥ WORLD.x0 − BLEED.x + COVER_INSET − margin`, `x ≤ WORLD.x1 + BLEED.x − COVER_INSET + margin`, `y ≥ WORLD.y0 − BLEED.y + COVER_INSET − margin`, `y ≤ WORLD.y1 + BLEED.y − COVER_INSET + margin`); `inBuildRegion(x: number, y: number): boolean` = `inCoverQuad(x, y, 16/9, COVER_MARGIN) || inPanReach(x, y, COVER_MARGIN)`; `inCore(x: number, y: number): boolean` = `inCoverQuad(x, y, 16/9, COVER_MARGIN)`. Test helper `PAN_CONFIGS: readonly { frame: "map" | "cv"; w: number; h: number }[]` (the 9) and `panExtremes(cfg): Vec2[][]` (for each of the 8 directions, the 4 world corners at z 0 of `clampToBleed` of the start view — `coverView` or `zoneView("cv", …)` — shifted by ±1e5 px; `viewCorners`).

- [ ] **Step 1: Write the failing tests** in `pan-reach.test.ts`:
  - "every corner a pan reaches, in the 9 configurations, is in the pan reach": for every config, every corner `c` of `panExtremes`: `c.x − c.y ≥ PAN_REACH_SX`, `inPanReach(c.x, c.y, 1e-6)`.
  - "PAN_REACH_SX is tight: some configuration reaches within 2 u of it": `min over configs and corners of (x − y) < PAN_REACH_SX + 2`.
  - "the build region holds the cover with its margin and the reach": `inBuildRegion(-300, 250)`, `inBuildRegion(-380, 700)`, `!inBuildRegion(-399, 711 + 60)`, `!inBuildRegion(-380, 400)` (x − y = −780), and for a 4 u grid over x −500…600, y −500…800: `inCore ⇒ inBuildRegion`.
- [ ] **Step 2:** `npx vitest run src/world/pan-reach.test.ts` → FAIL (exports missing).
- [ ] **Step 3:** Implement in `geo.ts` and `pan-fixtures.ts`. Doc comments say where −712 comes from (cv 1920×1080, −711.1).
- [ ] **Step 4:** `npx vitest run src/world/pan-reach.test.ts` → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#496): the pan reach and the build region`.

### Task 2: Resume's bleed is urban ground up to the reach

**Files:**
- Modify: `src/scenes/sprawl-grid.ts` (`builtAt`, its doc comment)
- Test: `src/scenes/sprawl-grid.test.ts`

**Interfaces:**
- Consumes: `inPanReach` (Task 1), `PAN_CONFIGS`, `panExtremes`.
- Produces: `builtAt(x, y)` returns `"urban"` for every point with `y ≥ GREEN_BELT.y1` that is outside the content, not water (bay, estuary, `y > WORLD.y1 && x ≥ QUAY_X`), and `inPanReach(x, y, 3 * CELL_BLEED)` (54 u ≥ `COVER_MARGIN` 30 + a block's half-diagonal 17, so no parcel built under `inBuildRegion` stands on jungle), regardless of `reachAt("w")` / `reachAt("s")`. Everything else unchanged (Portfolio side, green belt, fair, north reach).

- [ ] **Step 1: Write the failing tests:**
  - "Resume's bleed is urban up to the pan reach (#496)": for every config, sample the convex hull of all `panExtremes` corners on a 9 u grid; for each sample with `y ≥ GREEN_BELT.y1`, outside `WORLD`, and `!isWaterAt(x, y)`: `bleedTerrainAt(x, y) === "urban"`.
  - "no city or south parcel stands on jungle": every vertex of every `parcels(CITY_BOUNDS)` and `southParcels()` polygon outside `WORLD` has `bleedTerrainAt` ≠ `"jungle"` (run after Tasks 3 and 5 too).
  - "the Portfolio side and the green belt keep their ground": `builtAt(-200, 50) === "industrial"`, `builtAt(-200, 130) === null` (belt); and the new ground: `builtAt(-380, 700) === "urban"`, `builtAt(-300, 250) === "urban"`.
- [ ] **Step 2:** `npx vitest run src/scenes/sprawl-grid.test.ts` → the new tests FAIL (jungle at x < −240).
- [ ] **Step 3:** Implement. Check `beyondBuilt` (hills) still makes sense: it measures from `reachAt`; leave it, hills only show where the ground is jungle.
- [ ] **Step 4:** `npm test` (terrain, veil and static-polygon tests may move; a test that pinned jungle inside the new urban area is updated with a `#496` comment saying why). `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#496): Resume's bleed is urban up to the pan reach`.

### Task 3: The city builds the strip north of y 318

**Files:**
- Modify: `src/scenes/city-plan.ts` (`parcels()` filter), `src/city/crossings.ts` (`inDomain`, `coverWest` → `domainWest`, `columnInCover` → `columnInDomain`, `onOrdinaryStreet`), `src/city/streets.ts` (callers of `coverWest`), `src/city/zoning.ts` (`builtParcels`, `assign`, new `parcelRng`, `isStrip`), `src/scenes/city.ts` (seat rng of a strip parcel)
- Test: `src/city/zoning.test.ts`, `src/city/__snapshots__/zoning.test.ts.snap`, `src/city/axis-furniture.test.ts:252`, `src/city/streets.test.ts:212`, `src/scenes/city-plan.test.ts`

**Interfaces:**
- Consumes: `inBuildRegion`, `inCore` (Task 1).
- Produces: `parcels(bounds)` keeps a piece iff `inBuildRegion(c.x, c.y)`; `isStrip(p: Parcel): boolean` = `!inCore(p.c.x, p.c.y)`; `parcelRng(p: Parcel, salt: number): Rng` (`createRng` of a 32-bit `Math.imul` mix of `p.cell.col`, `p.cell.row`, `Math.round(8·p.rect.x)`, `Math.round(8·p.rect.y)` and `salt`; city and south parcels come from the same `parcels()` grid, so cell + rect identify a parcel uniquely); `builtParcels(west)` = core east, core west (as today), then strip parcels in `parcels()` order; `assign` gives core parcels exactly today's result (neighbour rule over core only) and appends strip parcels with recipe and tone from `parcelRng(p, 0)` and neighborhoods from `stripNeighborhoods()` (Task 6; in this task: `neighborhoodOfParcel(p)` lowered by the step rule against core per D4 — implement D4 here as `stripNeighborhoods(strip: readonly Parcel[], core: readonly Parcel[], coreNs: readonly Neighborhood[], base: (p: Parcel) => Neighborhood): Neighborhood[]` in `zoning.ts`); `city()` seats a strip parcel with `parcelRng(p, 1)`.

- [ ] **Step 1: Write the failing tests:**
  - "the core keeps its pre-#496 parcels, neighborhoods, recipes and tones": snapshot of `assign(zoneRng(SEED,"cv"), zoneRng(SEED,"cv",1))` filtered to core parcels (written as `inCoverQuad(c.x, c.y, 16 / 9, COVER_MARGIN)`, which `isStrip` negates, so the test compiles on unmodified code), mapped like the #479 east snapshot (cell, rect x/y, neighborhood, recipe, tone, lot maxH). **Record the snapshot on the unmodified code first** (Stage 3 commits it).
  - "the strip comes after the core and lies outside the cover": in `builtParcels()`, first strip index > 0 and every later one is strip; every strip centroid has `x − y < −419` or is outside `inCoverQuad(…, COVER_MARGIN)`; `builtParcels().filter(isStrip).length ≥ 20`.
  - "the city reaches the pan reach": every grid cell (pitch 30, rows with centre y in 176…306) whose centre is `inPanReach(…, 0)` and `x − y ≥ PAN_REACH_SX + 15`, on `LAND`, not in the green belt, is either on an axis band (`onAxis`), in the Plaza Mayor, in a crossing plaza, or has a built parcel or the hotel lot (`HOTEL_LOT`, a parcel of `parcels()`) within 20 u of the centre (`polygonDistance` against a 0.1-square at the centre).
  - "a strip parcel draws only from its own rng": `assign` with two different `districtRng` seeds gives the same strip recipes and tones.
  - "the lab cut still works": `assign(createRng(1), createRng(2), -60)` has no strip parcel.
  - Update the two cover assertions (`axis-furniture.test.ts:252`, `streets.test.ts:212`) to `inBuildRegion`.
- [ ] **Step 2:** `npx vitest run src/city src/scenes/city-plan.test.ts` → new tests FAIL.
- [ ] **Step 3:** Implement. `domainWest(y)` is `coverWest` with `inBuildRegion` (same bisection). The center-line phase in `gridLines` keeps its `CITY_EDGE.west − SAMPLE·floor(…)` formula.
- [ ] **Step 4:** `npm test` (only `city-budget.test.ts` may stay red), `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#496): the city builds to the pan reach north of y 318`.

### Task 4: `scatterHouses`, the varied houses of the strip

**Files:**
- Modify: `src/kit/forms/lowrise.ts` (recipe + `LOWRISE` entry)
- Test: `src/kit/forms/lowrise.test.ts` (the kit contract in `kit.test.ts` covers it automatically)

**Interfaces:**
- Produces: recipe `scatterHouses: Recipe`, registered `{ name: "scatterHouses", recipe: scatterHouses, family: "lowrise" }`. The lot's bounding box is cut into `nx × ny` cells (`nx = lot.w > 18 ? 2 : 1`, same for `d`); per cell, one `rng.next()` roll `r`: `r < 0.12` → empty (a lawn `ground` quad, "yard"); otherwise a house of width `cw·(0.55…0.85)`, depth `cd·(0.55…0.85)`, placed at a random offset inside the cell with ≥ 1 u margin, total height, roof included, `min(lot.maxH, 3 + 4·r)` with a `gable` roof in `tile`, published with `addBuilding` (windows for the lights); with `rng.chance(0.3)` a shed of 3…4 × 3…4 × 2.5…3 in the cell's free corner, if it fits without touching the house. Material per house `whitewash` or `brick` (`rng.chance(0.6)`).

- [ ] **Step 1: Write the failing tests** in `lowrise.test.ts`:
  - "scatterHouses varies per lot: sizes, positions, some sheds, some empty cells": over 40 lots 24×24 with `createRng(k)`: ≥ 5 distinct house footprints (w×d rounded to 0.5), ≥ 1 lot with a shed, ≥ 1 empty cell, every solid inside the lot, max z ≤ `lot.z + lot.maxH`, `piece.windows.length > 0` on a lot with a house.
  - "scatterHouses on a narrow lot (w 10) makes a single column".
- [ ] **Step 2:** `npx vitest run src/kit` → FAIL (unknown recipe).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run src/kit` → PASS (kit contract: no interpenetration, inside lot, cap); `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#496): scatterHouses, varied houses with sheds and yards`.

### Task 5: The coastal neighborhood builds the strip south of y 318

**Files:**
- Modify: `src/scenes/sprawl-grid.ts` (`southParcels`: bounds `y1 = WORLD.y1 + BLEED.y`, filter `inBuildRegion`, order core then strip), `src/scenes/tech-streets.ts` (`SOUTH_BOUNDS.y1`, `stop` with `inBuildRegion`, center-line rows to y 708), `src/scenes/tech.ts` (strip blocks built after the green-belt jungle)
- Test: `src/scenes/tech-south.test.ts` (and `sprawl-grid.test.ts:61`, `tech-south.test.ts:48`: cover → `inBuildRegion` for strip, cover for core)

**Interfaces:**
- Consumes: `inBuildRegion`, `inCore` (Task 1), `isStrip`, `parcelRng` (Task 3), `scatterHouses` (Task 4).
- Produces: `southParcels()` = core parcels exactly as today, then strip parcels; `techBlocks()` follows. `tech()` runs `zoneKinds` on the core blocks only, as today, and after `jungle(...)` builds each strip block with `parcelRng(p, 2)`: in this task always `scatterHouses` on `parcelLot(p, "bajo", "scatterHouses", false, parcelOpenSides(p), maxHFor("bajo", p))` seated with `STYLES.bajo`, plinth like `low()`, windows to `homes` (lit `rng.chance(0.55)`, group `${x},${y}:strip`).

- [ ] **Step 1: Write the failing tests:**
  - "the core of the coastal neighborhood is unchanged": snapshot of `techBlocks()` filtered by `inCoverQuad(b.parcel!.c.x, b.parcel!.c.y, 16 / 9, COVER_MARGIN)` (cell + rect) and of `zoneKinds(zoneRng(SEED,"cv",2), core)` — **recorded on the unmodified code first**.
  - "the coastal neighborhood reaches the pan reach (#496)": every grid cell of rows y 318…711 (pitch 30) whose centre is `inPanReach(…, 0)`, `x − y ≥ PAN_REACH_SX + 15`, `urbanAt`, not on an axis band, has a `techBlocks()` block within 20 u.
  - "strip blocks avoid the axes and the crossing plazas": no corner or centre of a strip block's rect is `onAxis` or `inCrossingPlaza`.
  - "the south streets run to the south edge": `southStreets().ground` has a strip with a point at `y > 690`.
- [ ] **Step 2:** `npx vitest run src/scenes/tech-south.test.ts src/scenes/sprawl-grid.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` (only `city-budget.test.ts` may stay red; tech per-kind face caps in `tech*.test.ts` measure core kinds and must stay green), `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#496): the coastal neighborhood builds to the pan reach`.

### Task 6: The mixing field and the strip's zoning

**Files:**
- Create: `src/city/strip-mix.ts`
- Modify: `src/city/zoning.ts` (`stripZoning()`), `src/city/zoning.ts` `assign` (strip neighborhoods from it; `bajo` strip parcels get recipe `scatterHouses`), `src/scenes/tech.ts` (strip blocks per D5)
- Test: `src/city/strip-mix.test.ts`, `src/city/zoning.test.ts`, `src/scenes/tech-south.test.ts`

**Interfaces:**
- Produces (`strip-mix.ts`, pure, no imports beyond `geometry`): `STRIP_IN = -400`, `STRIP_OUT = -470`; `stripWeight(x, y): number` = clamp01((STRIP_IN − (x − y)) / (STRIP_IN − STRIP_OUT)); `hash01(x: number, y: number): number` in [0, 1); `valueNoise(x, y, period: number): number` in [0, 1] (lattice of `hash01`, smoothstep-bilinear); `urbanity(x, y): number` = `(y < 330 ? 0.7 : 0.7 − (y − 330)/380·0.55) + (valueNoise(x, y, 110) − 0.5)·0.85 + (valueNoise(x + 31, y − 17, 45) − 0.5)·0.4`; `fieldKind(x, y): CityBarrio` = `> 0.72` moderno, `> 0.52` transicion, `> 0.34` clasico, else bajo; `mixes(c: Vec2): boolean` = `hash01(c.x + 91, c.y − 37) < stripWeight(c.x, c.y)`.
- Produces (`zoning.ts`): `stripZoning(): Map<Parcel, Neighborhood>`, memoized, over `[...builtParcels().filter(isStrip), ...southParcels().filter(isStrip)]`; base = `mixes(p.c) ? fieldKind(p.c) : (p.barrio === "residencial" ? "bajo" : p.barrio)`; then `stripNeighborhoods` (Task 3) with the city core (its `parcelNeighborhoods(core)`) and the south core (all `bajo`) as fixed neighbours. `tech.ts` builds a south strip block by `stripZoning().get(p)`: `bajo` → Task 5's houses; else D5.

- [ ] **Step 1: Write the failing tests:**
  - `strip-mix.test.ts`: "stripWeight is 0 east of −400, 1 west of −470, linear between"; "the field is deterministic and smooth: |urbanity(p) − urbanity(q)| ≤ 0.3 for |p − q| = 10 on a 600-point sample, and two calls agree"; "higher to the north: mean urbanity over x −390…−150 at y 200 > at y 650 by ≥ 0.3"; "fieldKind follows the thresholds".
  - `zoning.test.ts`: "the strip reads mixed, not in bands (#496)": over strip parcels (city + south), ≥ 3 distinct neighborhoods, and among grid rows (`cell.row`) holding ≥ 4 strip parcels at least half hold ≥ 2 neighborhoods; "core neighborhoods equal parcelNeighborhoods(core)"; "the one-step rule holds across the strip and against the core" (every neighbour pair with at least one strip parcel differs by ≤ 1 step; bars / civic skipped); "strip lots respect trainCap: every strip lot with `rect.y > TRAIN_CLEAR.y1` has `maxH ≤ (rect.y − 134.5)/1.4 − PLINTH_H`"; "city bajo strip parcels build scatterHouses".
  - `tech-south.test.ts`: "a south strip block the zoning calls non-bajo builds a city catalogue recipe": export `stripBlock(ctx: NeighborhoodCtx, b: SprawlBlock, n: Neighborhood): void` from `tech.ts` and call it on a real south strip block with `n = "transicion"` and `"moderno"`: solids non-empty, top ≤ `maxHFor(n, p)` + PLINTH_H + 0.5, windows in `homes`.
  - `zoning.test.ts`: "the lab cut keeps the strip zoning": `assign(createRng(1), createRng(2), -60)` does not throw and `stripZoning()` is the same `Map` before and after it (computed over every parcel, never over a cut, like today's neighbour rule).
- [ ] **Step 2:** run them → FAIL.
- [ ] **Step 3:** Implement. Thresholds and amplitudes are the plan's; if the "not in bands" test fails with them, adjust only the noise amplitudes (§11 leaves them to the builder), recompute the smoothness bound as `10 · 1.5 · Σ(amplitude / period)` + 0.05 in that test, and record the values in the module comment. Both tests must pass.
- [ ] **Step 4:** `npm test` (only `city-budget.test.ts` may stay red; `src/scenes/station.test.ts` world train rule must be green), `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#496): a smooth field mixes the strip's neighborhoods`.

### Task 7: Budget, FPS, captures and docs (controller, with agent-browser)

**Files:**
- Modify: `src/scenes/city-budget.test.ts`, `CONTEXT.md` (Parcel, Pan, Bleed entries; new entry "Strip" with `src/city/strip-mix.ts` and `src/map/geo.ts` identifiers), `README.md` if it describes the cover filter.
- Create: captures in `docs/superpowers/specs/assets/2026-11-26-resume-hotel-cartel-2-5d/franja/`.

- [ ] **Step 1: Measure** on HEAD: `world(SEED)` raised per scene, city strip / accents, `assembleWorld(undefined, { reducedMotion: true })` static polygons and accents. Rewrite each cap the figures exceed (× 1.1, rounding rule above, comment with figure and 2026-11-26); the #479 sum line becomes `≤ 2 658 + STRIP_ADDED` (strip raised solids of city + tech, × 1.1).
- [ ] **Step 2: FPS (#480 method).** `npx vite --host --port 5173` on the branch and `--port 5174` on a `git worktree` of `origin/main`; agent-browser viewport `1600 900 1`; three interleaved loads each; read the `[mapa] bloom:` console line (`tick + render`) and `[mapa] first draw` (static polygons). Pass: branch mean ≤ main mean + 2 ms. If it fails, first make the strip leaner (fewer sheds, `scatterHouses` for south non-bajo too) and measure again; if it still fails, the run is blocked: comment the figures on the issue, push the branch as it is, exit with an error.
- [ ] **Step 3: Captures** at 2×, before (main worktree) and after: start view 1920×1080 and 390×750, Resume zone 1920×1080, and dragged to the west and southwest extremes (arrow keys until the view stops) at 1920×1080, 2560×1080 and 390×750.
- [ ] **Step 4:** Run the stage-3 browser script (`.scratch/evals-496.md`).
- [ ] **Step 5:** `npm test`, `npm run typecheck` → all green. Commit `chore(#496): budget measured, FPS, captures and glossary`.

## Assumptions

- A1 (Q1) Margin = `COVER_MARGIN` (30) around the reach, as the cover filter uses today; centroids reach `x − y ≥ −742`. The issue's "+ un margen" authorises it; the extra ring is never on screen whole. Rejected: no margin (parcels cut at the screen edge).
- A2 (Q4) `stripZoning()` is computed over every parcel (no `west` cut), like today's neighbour rule in `assign` ("the neighbour rule runs over every parcel, so a cut does not change…"). Rejected: zoning per cut.
- A3 (Q8) Urban ground margin `3 * CELL_BLEED`, checked by a no-parcel-on-jungle test. Rejected: `2 * CELL_BLEED` (36 < 30 + 17).
- A4 (Q9) The tech whole-district and accent caps are budget too; they may stay red during Tasks 3–6 and are re-measured in Task 7.
- A5 (Q11) The non-bajo south path is tested on a direct call, not on what the world seed happens to give.
- A6 (Q12) Smoothness bound tied to the amplitudes by formula.
- A7 (Q14) Reach-coverage tests exclude axis bands, the Plaza Mayor and crossing plazas.
- A8 (Q15) `parcelRng` hash as specified in Task 3.
- A9 (Q18) FPS failure → leaner strip, then blocked.
- A10 (Q19) `.scratch/evals-496.md` is produced in Stage 3 of the run (excluded from git via `.git/info/exclude`).

## Grilling

- Rounds: 1 (the answers corrected values and tests; no step added or removed, no seam changed, so no second round).
- Questions: 20. Sources: ISSUE 2 (Q1 "lo alcanzable al arrastrar + un margen"; Q13 "algunos lotes vacíos o con patio", read per house lot as `plano.html` `houses()` does), CODE 9 (Q2 zoning.ts `CityBarrio`/`BARRIO_STEP`/`neighborhoodOfParcel`; Q3 city-plan.ts `HOTEL_LOT`; Q5 geo.ts `WORLD`/`BLEED`/`COVER_INSET`; Q6 geo.ts:53 `inCoverQuad(x, y, aspect, margin)`; Q7 sprawl-grid.ts:85-90 `urbanAt` at centroid and corners; Q9 tech.test.ts:139-152; Q10 zoning.ts `maxHFor` = min(cap, trainCap) and station.test.ts:206; Q16 city-plan.ts `barrioAt` always defined; Q20 lights.test.ts uses synthetic rngs), DOC 1 (Q17 CONTEXT.md Pan: "scale unchanged"; main.ts has no zoom), NO SOURCE 8 → assumptions A1–A10.
- Spec ambiguities: none. Follow-up issues opened: none.
