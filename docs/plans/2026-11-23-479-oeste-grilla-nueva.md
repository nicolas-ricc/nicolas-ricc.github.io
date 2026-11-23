# El oeste en la grilla nueva (#479) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The city (`city()`, rng `cv`) builds the west bank on the `city-plan` grid all the way to the edge of the view, TELECOM becomes a singular piece of the `moderno` barrio, `tech()` keeps only the south, and the raised-solid budget moves from `tech` to `city` without growing.

**Architecture:** `CITY_BOUNDS.x0` becomes `−Infinity` (the cover already bounds `parcels()`); `builtParcels(west)` returns the old city's parcels first and the new west ones last, and the west ones draw only from `districtRng`, so the city east of x −54 keeps its draws and the lab (zone filter, `west = WORLD.x0`) is the site's city minus the west. The streets' domain loses its west edge (the cover bounds it); `city()` cuts its streets at `opts.west`. `tech.ts` loses the old west district (`suburbBlocks` west loop, towers, campus, telecom, avenue) and its animation layers `tech.windows`, `tech.telecom`, `tech.neon`; the mast ring and the breathing tip light move to `city-anim`.

**Tech Stack:** TypeScript, vitest, PixiJS v8 (only for the screenshots).

**Spec:** issue #479 (the binding text) and `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md` §8.1 and §9 ("Presupuesto con el oeste"); story decisions D2, D8, D15 in the plan comment of #471.

## Global Constraints

- Code, comments and test names in English (`src/english.test.ts`); exhibit ids (`mastil`, `torres`) stay Spanish.
- Dueño del oeste: la ciudad, hasta el borde de la vista (sin filtro) o `WORLD.x0` (con filtro). `tech()` builds nothing north of y 318 except the green belt's jungle.
- TELECOM on the parcel `cell (−107, 231)`, built by the city with `telecom` moved to `src/city/fixed.ts` (concrete base, mast `steel` of 20, three dishes, light at the tip); ring and light in `city-anim`.
- Presupuesto movido, no subido: city + tech raised solids after ≤ 1 209 + 1 449 = 2 658 (measured on `feature/471` at 3cff5a7, `world(SEED)`). `CAPS.city` / `CAPS.tech` = measured × 1.1 rounded to the hundred.
- Snapshot of `shipyard`, `factory`, `fair`, `hinterland`, `sea` of `world(SEED)` unchanged (`Portfolio and Writing solids snapshot unchanged`, fixed in stage 3 before any source change).
- Every test file named in the issue green; `npm test` and `npm run typecheck` green.

## Review Focus

1. **The west train** (`train-occlusion.test.ts`, the rule of `station.ts`: south of the track `y_min − 1.4·z_max ≥ 134.5`): a `moderno` tower of cap 50 on row 171 (y 174..195) would stand in front of the train on screen. Task 2 adds the cap; the existing sweep test pins it.
2. **Lab with zone filter** (`world(SEED, { zones: ["cv"] })`): nothing of the city west of `WORLD.x0` (no terrain there: it would float over the sky), and the TELECOM fixed parcel missing must not throw. Pinned in Task 2 and Task 3.
3. **East city unchanged**: adding 30 west parcels must not reorder the draws of the existing 32. Pinned in Task 2 (recipes and tones of every east `Placed` equal with and without the west).
4. **Animation contract**: `city.neon` reports a change on ring/telecom steps only when the scene has a TELECOM; with `reducedMotion` everything stays at frame 0. Pinned in Task 4.
5. **Seam at x −54**: lanes, center lines, lamps and parcels continue west of −54 with no gap. Pinned in Task 3 (street furniture exists west of −54 on the plaza avenue) and by the screenshots.

---

### Task 1: `tech()` keeps only the south

**Files:**
- Modify: `src/scenes/sprawl-grid.ts` (drop `SUBURB_COLS`, `suburbBlocks`, `blockAt`, `BLOCK_D` if unused elsewhere; `techBlocks = southParcels().map(parcelBlock)`; `urbanAt` without `CITY_EDGE.west`)
- Modify: `src/scenes/terrain-classify.ts:39` (drop `|| x < CITY_EDGE.west`)
- Modify: `src/scenes/tech.ts`, `src/scenes/tech-zoning.ts`, `src/scenes/tech-anim.ts`, `src/scenes/tech-animator.ts`, `src/scenes/tech-budget.ts`, `src/scenes/neighborhood-fixtures.ts` (drop `westBlockAt` if only the west used it)
- Test: `src/scenes/tech.test.ts`, `tech-anim.test.ts`, `tech-animator.test.ts`, `tech-zoning.test.ts`, `tech-south.test.ts`, `sprawl-grid.test.ts`, `src/world/assemble.test.ts` (the `tech.neon` veil test moves to `tech.signs`), `src/lab/docs.test.ts` (the tech.ts docstring test ends at `export interface TechScene`, since `Tower` goes)

**Interfaces:**
- Produces: `interface TechScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; signs: Accent[]; homes: HomeWindow[] }`; `TechAnim { signs(); homes(); fired(): { homes: number }; tick(dt): { signs: boolean; homes: boolean } }`; `techAnimator` ids `["tech.signs", "tech.homes"]`; `Kind` without `"tower" | "campus" | "telecom" | "park"` (`park` was reachable only from west blocks); `TELECOM` removed from `tech-zoning.ts` (Task 2 defines `TELECOM_CELL` in zoning).
- `urbanAt(x, y)`: inside the content `x < QUAY_X && y >= LAND.y0` (164); outside, `builtAt(x, y) === "urban"` as today.

- [ ] **Step 1:** Stage-3 tests in `tech.test.ts` (`tech builds nothing north of y 318`, `no west towers or campus`, `TechScene has no mastRing or telecom`) and `tech-anim.test.ts` (`techAnimator exposes only tech.signs and tech.homes`) are red; run `npx vitest run src/scenes/tech.test.ts src/scenes/tech-anim.test.ts` to see them fail.
- [ ] **Step 2:** Remove the west from the files above. `tech()` keeps `waterfront`, `southStreets`, the green-belt `jungle` and the south kinds. Keep `MAX_TECH_H`/`TECH_MATS` only if a south piece or test still needs them. Delete the tests that only described the west (towers, crowns, mast ring, west block layout, `TELECOM` re-export, the west table of `tech-south`) and rewrite those that mixed west and south so they assert the south only.
- [ ] **Step 3:** Re-measure `TECH_FACES_BEFORE` (and `REGION_FACES_BEFORE` if its test moves) with `tech(zoneRng(SEED, "cv", 2))` and write the figure with its comment ("measured on agent/479 without the west").
- [ ] **Step 4:** `npx vitest run src/scenes src/world src/lab` green except the city-side stage-3 tests (Task 2–4); `npm run typecheck` green.
- [ ] **Step 5:** Commit `feat(#479): tech builds only the south`.

### Task 2: the city owns the west (parcels, TELECOM, train cap)

**Files:**
- Modify: `src/scenes/city-plan.ts` (`CITY_BOUNDS.x0 = -Infinity`; its doc comment), `src/city/zoning.ts`, `src/city/fixed.ts` (add `telecom`), `src/scenes/city.ts`, `src/scenes/world.ts`
- Test: `src/scenes/city.test.ts`, `src/city/zoning.test.ts`, `src/scenes/city-plan.test.ts`, `src/city/fixed.test.ts`

**Interfaces:**
- `src/city/zoning.ts`:
  - `export const WEST_DISTRICT_X = -54` — parcels with `c.x < WEST_DISTRICT_X` are "the west": they come last and draw from `districtRng` only (pick, retries and `tone`), so the parcels east of it keep the draws they had before #479.
  - `export const TELECOM_CELL = { col: -107, row: 231 } as const`; `FIXED_PARCELS` gains `{ cell: TELECOM_CELL, recipe: "telecom" }` (not a kit recipe: `city()` builds it).
  - `builtParcels(west = -Infinity): Parcel[]` — `parcels(CITY_BOUNDS)` with `c.x > west`, `c.y < 318`, not the hotel lot; the east ones (`c.x >= WEST_DISTRICT_X`) first in `parcels()` order, then the west ones in `parcels()` order. Memoize per `west`.
  - `assign(rng, districtRng, west = -Infinity)`; the `missing fixed parcel` check skips a fixed cell whose parcel lies west of `west`.
  - Train cap in `maxHFor`: a parcel whose `rect.y > TRAIN_CLEAR.y1` is capped at `(rect.y − 134.5) / 1.4 − PLINTH_H − 1` (one unit of margin for roof props); import `TRAIN_CLEAR` from `src/scenes/station.ts` if that closes no import cycle, else copy the literal with a comment naming it. Row 171 gets ≈ 26.9; east parcels are below it already.
- `src/city/fixed.ts`: `export function telecom(solids: Solid[], r: Rect): Vec3` — moved body of `tech.ts`'s `telecom` without its plinth (the parcel plinth is `city()`'s), centered on `r` (the parcel `rect`); returns the tip `v3(cx, cy, PLINTH_H + 22.2)`.
- `src/scenes/city.ts`: `city(rng, districtRng, lightsRng, opts: { west: number } = { west: -Infinity })`; `CityScene.neon: { signs; promenade; mastRing: Vec3[] }` and `CityScene.telecom: Vec3 | null` (`null` and `mastRing: []` when the TELECOM parcel is west of `opts.west`). `mastRing = [3, 6, 9].map((dz) => v3(tip.x, tip.y + 0.6, tip.z - dz))`. The `"telecom"` placed gets the parcel plinth and `telecom(piece.solids, parcel.rect)` instead of `seat`.
- `src/scenes/world.ts`: `city(…, { west: opts.zones ? WORLD.x0 : -Infinity })`.

- [ ] **Step 1:** Stage-3 tests in `city.test.ts` are red: `city builds every parcel north of y 318 inside the view, west of x −54 included`, `TELECOM sits on a moderno parcel`, `the STATION_LAND rule also covers the west`, `with opts.west = WORLD.x0 no Placed lies west of x −60`.
- [ ] **Step 2:** Add to `zoning.test.ts`: `the east parcels keep their recipe and tone with the west added` — `assign(rng(SEED cv), rng(SEED cv 1))` filtered to `parcel.c.x >= WEST_DISTRICT_X` equals, recipe and tone per cell, `assign(…, WORLD.x0)` filtered the same way; and `row 171 parcels respect the train rule`: every `Placed` lot with `rect.y > 134.2` has `maxH ≤ (rect.y − 134.5) / 1.4 − PLINTH_H`.
- [ ] **Step 3:** Implement. Rewrite the tests that pinned `CITY_BOUNDS.x0 = CITY_EDGE.west`, the parcel count of `CITY_BOUNDS` and `builtParcels` east of −54 (`city-plan.test.ts:149,176`, `zoning.test.ts:215,222`, `city.test.ts:259`) to the new domain.
- [ ] **Step 4:** `npx vitest run src/scenes/city.test.ts src/city src/scenes/city-plan.test.ts src/scenes/train-occlusion.test.ts src/scenes/world.test.ts` green; `npm run typecheck` green.
- [ ] **Step 5:** Commit `feat(#479): the city builds the west to the edge of the view, TELECOM on a moderno parcel`.

### Task 3: the streets reach the edge of the view

**Files:**
- Modify: `src/city/crossings.ts` (`inDomain`, `axisSpan`, `ordinary`, `onOrdinaryStreet`, `crossings` lose `CITY_EDGE.west`; the cover with `COVER_MARGIN` bounds them), `src/city/streets.ts` (`gridLines` and lamps/lights for the full domain; `streets(ground, solids, lights, west = -Infinity)`), `src/city/fixed.ts` (`cars(solids, rng, west = -Infinity)` over `builtParcels(west)`), `src/scenes/city.ts` (passes `opts.west`)
- Test: `src/city/streets.test.ts`, `src/city/axis-furniture.test.ts`, `src/city/crossings.test.ts`

**Interfaces:**
- `ORDINARY_X`: every `40 + 30k` with `LAND.y0 < … < LAND.x1` that is inside the cover (margin `COVER_MARGIN`) somewhere on `y ∈ [164, 318]`, minus those along an axis. Ordinary E–W lines run from the cover's west edge.
- `streets(…, west)`: with a finite `west`, no solid, strip or light of the streets lies west of `west` (strips clipped or dropped, solids by plan bounds, lights by position). The rail-lands strip (`y < 164`: the y 113 line, `rail-lands.ts` fence) keeps `CITY_EDGE.west`.

- [ ] **Step 1:** Write in `streets.test.ts`: `the plaza avenue keeps its lanes and lamps west of x −54` (lane strips and lamp posts of axis `plaza` with x < −54 exist, and some with x < −200); `ordinary streets continue west of x −54` (a center line with x < −54 on `y 255`, one of `ORDINARY_Y`); `with west = WORLD.x0 nothing of the streets lies west of it`. Run: fail.
- [ ] **Step 2:** Implement; rewrite the assertions that pinned `CITY_EDGE.west` as the streets' west edge (`streets.test.ts:211,233,239,271`, `axis-furniture.test.ts:243`) to the cover bound.
- [ ] **Step 3:** `npx vitest run src/city src/scenes/city.test.ts src/scenes/train-occlusion.test.ts` green; typecheck green.
- [ ] **Step 4:** Commit `feat(#479): the west bank's streets reach the edge of the view`.

### Task 4: the mast ring and the tip light in `city-anim`

**Files:**
- Modify: `src/scenes/city-anim.ts`
- Test: `src/scenes/city-anim.test.ts`, `src/scenes/city-animator.test.ts`

**Interfaces:**
- Consumes: `CityScene.neon.mastRing`, `CityScene.telecom` (Task 2). `createCityAnim(scene: Pick<CityScene, "hotel" | "neon" | "lights" | "telecom">, …)`.
- Exports `RING_STEP_MS = 200`, `TELECOM_STEP_MS = 100`, `RING_R = 0.5`. `neon()` appends, after everything it returns today, the ring (`chase(mastRing.length, ringStep, 1)` from step 1, every light on at step 0 and with `reducedMotion`; dots `magentaMid` r 0.5) and, when `telecom` is not null, the tip dot `amber` with `r = 0.8 + 0.3·(1 + sin(clock / 1200))`. `tick` sets `neon` when the ring step or the telecom step changes, only if the scene has a TELECOM.

- [ ] **Step 1:** Stage-3 tests in `city-anim.test.ts` are red (`the mast ring runs one light per step from step 1, all on at frame 0`, `the tip light breathes`, `without TELECOM the ring and tip steps report nothing`).
- [ ] **Step 2:** Implement. The ring and telecom steps are derived from `clock`, no rng: the existing streams stay in order.
- [ ] **Step 3:** `npx vitest run src/scenes/city-anim.test.ts src/scenes/city-animator.test.ts src/world` green.
- [ ] **Step 4:** Commit `feat(#479): city-anim runs the mast ring and the tip light`.

### Task 5: exhibits, budget and docs

**Files:**
- Modify: `src/lab/exhibits.ts` (`mastil`: `parcelBox(TELECOM_CELL.col, TELECOM_CELL.row)`, h 26; `torres`: the union of `parcelBox(-107, 171)` and `parcelBox(-77, 171)`, h 52; drop the `SUBURB_COLS`/`TELECOM` imports; the `manzana-distrito` comment no longer says no parcel is moderno), `src/scenes/city-budget.test.ts`, `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (row `| Resume: tecnológico |`: the cell starts with "el oeste moderno (`mastil`, `torres`) y el barrio costero:" and keeps the seven neighborhood exhibits), `README.md` ("Isometric world": `tech.ts` is the coastal neighborhood south of the Avenida del Sur; the city reaches the edge of the view), `CONTEXT.md` (*Bleed*: built margins are the hinterland and the coastal neighborhood; *Parcel*: the city builds every parcel north of y 318 to the edge of the view, `opts.west`), `docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md` §3 (a deviation note: since #479 the west district is the city's `moderno` and `transicion` barrios; TELECOM on `cell (−107, 231)`)
- Test: `src/lab/exhibits.test.ts`, `src/lab/docs.test.ts`, `src/english.test.ts`, `src/docs-glossary.test.ts` if it names a moved identifier

- [ ] **Step 1:** Measure `world(SEED)` raised solids of `city` and `tech` and the city's static accents and strips; write `budget moved, not raised` in `city-budget.test.ts` with the four figures as constants (`BEFORE = { city: 1209, tech: 1449 }`, `AFTER = { city: <measured>, tech: <measured> }`), asserting the live values equal `AFTER` ± 0 and `AFTER.city + AFTER.tech ≤ BEFORE.city + BEFORE.tech`; rewrite `CAPS.city`/`CAPS.tech` = AFTER × 1.1 to the hundred; rewrite the level-2 accent and strip caps the same way with the measure in the comment (the west's windows were animated tower floors, now they are static kit windows). If the sum exceeds 2 658, stop and report the figures: do not raise.
- [ ] **Step 2:** Exhibits and docs as above; `npx vitest run src/lab src/english.test.ts src/docs-glossary.test.ts src/scenes/city-budget.test.ts` green.
- [ ] **Step 3:** `npm test` and `npm run typecheck` green.
- [ ] **Step 4:** Commit `feat(#479): west exhibits, moved budget and docs`.

Screenshots (2×, the site and `/lab/world.html`, `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/oeste/`) are taken by the orchestrator after Task 5 with the stage-3 `agent-browser` script.
