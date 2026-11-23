# Streets: hierarchy of the axes (lanes, boulevard, crossing plazas, crosswalks, traffic lights, lamps) and the costanera (#473) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** on Resume's west bank the eight axes of `city-plan.ts` read as avenues at the site's zoom: dashed lanes on each carriageway instead of a center line, a tree-lined median on the boulevard, 3-strip crosswalks and two traffic lights at every crossing, lamps every 12 on one sidewalk, drawn crossing plazas, and the costanera as a paved promenade with its lamps.

**Architecture:** a new pure module `src/city/crossings.ts` computes, from `city-plan.ts` only, the city span of each axis, the crossings (axis × axis and axis × ordinary street) and the crosswalks; `src/city/streets.ts` paints and furnishes from it (lanes, crosswalks, median, traffic lights, lamp rows, costanera, crossing plazas) and stops painting the axes' center lines; `src/city/fixed.ts` `cars` drops the cars near a crosswalk. The east stretch of the old avenue (`EAST_RING.x1..PROMENADE.x0`) is not touched (its fingerprint test stays).

**Tech Stack:** TypeScript, Vitest (node), agent-browser + PixiJS DevTools only for the screenshot.

**Spec:** issue #473 ("Qué construir", "Decisiones que hereda este hijo", "Criterios de aceptación"); story #471 plan comment (D13, D15); `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md` §5.2 ("Jerarquía visible").

## Global Constraints

- Values fixed by the issue: dashes 5 on / 5 off, 0.4 wide; crosswalk = 3 strips 0.8 wide, centers 1.6 apart, nearest strip 1 outside the crossed band; traffic lights `trafficLight` (off), two per crossing at opposite corners; lamps `lamp` every 12, `lampXs` + `BAR_FRONTS`, `LAMP_MIN_GAP = 3`; boulevard median `leafDark` 4 wide (x 8..12), 0.3 high, cut 6 before/after each transversal axis, the crossing plaza and the Diagonal, `streetTree` every 8, lanes at ±6; avenue/costanera/diagonal lanes at ±`w/4`; costanera promenade `paving` strip x 186..189, lamps at `x 190.5` every 12 from `y 160` to `312` skipping `y 206..291` and the terraces `y 174..195`; crossing plaza = `tiles` of `plaza` clipped to the octagon (one `ground` each), `paving` curb 1.2, one `lamp` at the center through `placeLit`.
- Nothing may stand or be painted inside `PLAZA_MAYOR`, a crossing plaza (except its own tiles, curb and lamp), `HOTEL_LOT`, `TOWER_ISLAND` or a crater.
- City domain for anything on an axis (as the center lines of #472): its point projected on the axis center line has `x ≥ CITY_EDGE.west` (−54), `y ≤ CITY_BOUNDS.y1` (318) and `inCoverQuad(x, y, 16/9, COVER_MARGIN)`. South of 318 (#478) and west of −54 (#479) are other children.
- No window or per-barrio lights (another child). No change to the strip (`y < 164`), the east bank, the bridge, `westQuay`, `waterfront.ts`.
- `strip` budget in `city-budget.test.ts` and the static accents cap: measured, ×1.1 rounded to the ten, with the figure in a comment.
- Code, comments and test names in English (`src/english.test.ts`). `npm test` and `npm run typecheck` green at the end of every task (each task updates the counts it moves; every commit is revertable on its own back to its parent).

## Existing code the plan relies on

| Name | Where | Signature |
|---|---|---|
| `segX`, `clipSeg`, `clipHalf`, `segRect`, `axisBand`, `axis`, `onAxis(x, y)`, `pointInPoly(x, y, poly)`, `inRect(r, x, y)`, `inCrossingPlaza(x, y)`, `inPlazaMayor(x, y)`, `inParcel(x, y, ps?)`, `crossingPlazas()`, `AXES`, `LAND`, `CITY_BOUNDS`, `PLAZA_MAYOR`, `HOTEL_LOT`, `TOWER_ISLAND`, `GRID_ORIGIN`, `BLOCK`, `PITCH` | `src/scenes/city-plan.ts` | `segX(p1, p2, p3, p4: Vec2): Vec2 \| null`; the `in*` predicates take `(x, y)` |
| `inCrater(x, y)`, `CITY_EDGE`, `BRIDGE`, `WEST_QUAY`, `STREET`, `SIDEWALK`, `EAST_RING`, `PROMENADE` | `src/scenes/city-grid.ts` | |
| `inCoverQuad(x, y, aspect, margin?)`, `COVER_MARGIN` | `src/map/geo.ts` | |
| `lampXs(range, fronts)`, `BAR_FRONTS`, `LAMP_MIN_GAP`, `postZ(x, y)`, `inPlaza(x, y)` | `src/city/streets.ts` | |
| `placeLit(solids, lights, lit)`, `visibleLights` | `src/city/lights.ts` | |
| `lamp(at)` (post corner at `at`, bulb at `at + (0.3, 0.3, 5)`), `trafficLight(at)` (post corner), `streetTree(at)` (cone r 1.5 h 4) | `src/kit/props.ts:20-45` | |
| `tiles`, `plazaTone`, `PLINTH_H`, `prism` | `src/scenes/city-pieces.ts` | |
| `createRng(seed)` | `src/map/seed.ts` | |

`src/city/streets.ts` already imports `scenes/city-grid` and `scenes/city-plan`; `crossings.ts` follows the same direction (no ADR fixes it).

## Measured before planning (prototype in `.scratch/` over `feature/471` at 2b637a4)

- Axis spans in the city domain: costanera (188,164)→(188,318); plaza (132,228)→(−54,228); diagonalNorte (132,210)→(−14,169); diagonalSur (132,291)→(67.48,318); bulevar (10,164)→(10,318); vias (184,169)→(−54,169); sur (184,318)→(−54,318); barrio: none.
- Ordinary streets (from #472): x ∈ {−50, −20, 40, 70, 100, 130, 160} from y 164 to 318, y ∈ {198, 258, 288} from x −54 to 184.
- Axis × axis crossings that exist (unordered, center outside every plaza, island, hotel lot and in the domain): costanera–vias (188,169), costanera–sur (188,318), plaza–bulevar (10,228), bulevar–sur (10,318), diagonalNorte–vias (−14,169). Dropped because the center is inside a crossing plaza: bulevar–vias, bulevar–diagonalNorte (10,175.7), diagonalSur–sur (67.5,318); outside the domain: diagonalSur–bulevar (10,342.1).
- Axis × ordinary street crossings: 29 (listed by the test of Task 1). Crosswalks: 36 → 108 strips of 0.8. Dashes ≈ 200. Today the city has 95 strips (cap 190), 1 026 raised solids (cap 2 900), 842 accents (cap 1 300).

### Technical assumptions (declared, the issue's own geometry decides them)

- **T1 — Avenida de las Vías lamps go on its south sidewalk.** The issue says "north" for E-W axes but ties the row to `BAR_FRONTS` ("the bars parcels … their side facing the vias axis"); the bars stand south of vias (rect y 174..195) and north of the band (y < 164) is the strip's street, not land (`LAND.y0 = 164`). The other E-W axes and the diagonals use the north sidewalk, the boulevard the west one.
- **T2 — Counts the city part cannot reach.** Inside `y ≤ 318` the boulevard rule gives 4 median prisms and 6 trees (the issue asks ≥ 6 and ≥ 20, which the full axis y 160..480 reaches once #478 paints the south "with the same language", D7); the costanera rule gives exactly 5 lamps at y 160, 172, 196, 292, 304 (the issue asks ≥ 8: 160 + 12k ≤ 312 minus 206..291 minus 174..195 leaves five). The tests pin the rule and the measured counts; the PR states the deviation for the owner's review.
- **T3 — A lamp or traffic light is also dropped** in another axis's band or in an ordinary street's carriageway (|offset from its center line| < 3 + the post's half side): a post in a roadway is a defect the issue's list does not name. These are listed exceptions in the "every 12" test.
- **T4 — The costanera's west lane (x 186) lies on the promenade's west edge** (both fixed by the issue: lanes at ±w/4, promenade x 186..189). The promenade is painted first and the dashes on top, so both stay in the ground list.
- **T5 — A crosswalk whose center is closer than 4 to another crosswalk across the same axis is not painted** (Diagonal Norte × y 198 lands on Diagonal Norte × x 100 and × x 70). "Every axis crossing has a crosswalk" counts a crosswalk across either of the two axes.
- **T6 — The crossing plaza tiles use their own rng** (`createRng(CROSSING_TILE_SEED + i)`, `CROSSING_TILE_SEED = 473`) so the city's rng sequence, and with it the recipe fingerprints of `city.test.ts`, does not move.
- **T7 — The terraces of the quay** become a shared constant `QUAY_TERRACES = { x: 184, y: 174, w: 8, d: 21 }` in `city-grid.ts` (the costanera's width over `westQuay`'s y 174..195); no crosswalk or lamp of the costanera goes there.

## Review Focus

- A crosswalk or lane stripe painted over the Plaza Mayor or a crossing plaza (the ground is drawn in insertion order and would cover the tiles) → Task 2 test "no stripe, crosswalk strip or post steps on …".
- A traffic light or lamp floating or buried: posts on a parcel's sidewalk must stand at `PLINTH_H`, on asphalt at 0, on tiles at 0.05 → Task 4 test "posts rest on the ground below".
- A lamp post overlapping a traffic light or another lamp → Task 4 test "no lamp post overlaps a traffic light".
- A parked car on a new crosswalk → Task 6 test.
- The east stretch of the old avenue changing by accident → kept fingerprint test `a7c7d100` (Task 2 keeps it green).

---

### Task 1: `crossings.ts` — spans, crossings and crosswalks

**Files:**
- Create: `src/city/crossings.ts`, `src/city/crossings.test.ts`
- Modify: `src/scenes/city-grid.ts` (add `QUAY_TERRACES`)

**Interfaces:**
- Produces:
  - `QUAY_TERRACES: Rect` in `city-grid.ts` = `{ x: 184, y: 174, w: 8, d: 21 }`.
  - `inDomain(p: Vec2): boolean` — `p.x >= CITY_EDGE.west && p.y <= CITY_BOUNDS.y1 && inCoverQuad(p.x, p.y, 16 / 9, COVER_MARGIN)`.
  - `axisSpan(a: Axis): readonly [Vec2, Vec2] | null` — the axis center segment inside `LAND` (the costanera clipped on y only, at its own x, as `axisLines` does today) and cut exactly at x = −54 and y = 318 (analytic, on the segment). Every endpoint of the seven spans comes from `LAND`, x = −54 or y = 318: the cover quad cuts none (measured), and the test asserts both ends pass `inDomain`. Memoized. Values: see "Measured".
  - `ORDINARY_X: readonly number[]` = [−50, −20, 40, 70, 100, 130, 160], `ORDINARY_Y: readonly number[]` = [198, 258, 288] (computed with the rule `gridLines` uses today; `streets.ts` reuses them).
  - `blocked(p: Vec2): boolean` — strict interior of `PLAZA_MAYOR`, `HOTEL_LOT`, `TOWER_ISLAND`; `inCrossingPlaza`; `inCrater`.
  - `onOrdinaryStreet(p: Vec2, pad = 0): boolean` — `|p.x − x| < 3 + pad` for some `ORDINARY_X` with `LAND.y0 ≤ p.y ≤ 318`, or `|p.y − y| < 3 + pad` for some `ORDINARY_Y` with `CITY_EDGE.west ≤ p.x ≤ LAND.x1`, and not on an axis band (`onAxis`).
  - `axisFree(a: Axis, p: Vec2): boolean` — `!blocked(p)`, not in another axis's band, `p.y >= LAND.y0`, `p.x <= (a.kind === "costanera" ? WEST_QUAY.x0 : LAND.x1)`, not under the bridge (`p.x >= BRIDGE.x0 − STREET && BRIDGE.y0 <= p.y <= BRIDGE.y1`), not in `QUAY_TERRACES` when `a` is the costanera.
  - `interface Crossing { a: Axis; other: Axis | null; otherId: string; at: Vec2; half: number }` — `otherId` is the other axis's id or `"x40"` / `"y198"`; `half` = the other's half width measured along `a` (`(w/2) / |sin θ|`).
  - `crossings(): readonly Crossing[]` — memoized. For each axis `a` with a span and each other line (the other axes, the ordinary streets as segments of width 6): intersect `a`'s span extended by the other's half width at both ends with the other's segment extended by `a.w/2` at both ends (`segX`); skip near-parallel (`|sin θ| < 0.1`), centers that are `blocked` or outside `inDomain`; for an ordinary street also require that the street reaches the band: on at least one side, the street's center point at `(a.w/2)/|sin θ| + 1.5` from the center along the street lies within the street's segment, in `LAND`, in the domain, not `blocked` and not on any axis band. One entry per (axis, other) direction: an axis × axis crossing appears twice.
  - `interface Crosswalk { a: Axis; at: Vec2; strips: readonly (readonly [Vec2, Vec2])[] }` and `crosswalks(): readonly Crosswalk[]` — memoized. For each crossing, the crosswalk center sits on `a`'s center line at `half + 1 + 2` from `at`, first toward `a.from`, else the other side; its three strips are segments across `a` (perpendicular, from `−a.w/2` to `+a.w/2`) at −1.6, 0, +1.6 along `a`. A side is valid when its center is in the domain, no other crosswalk across `a` is within 4 (T5), and every strip's two endpoints and midpoint, each shifted ±0.4 along `a`, pass `axisFree(a, ·)`.

- [ ] **Step 1: Write the failing tests** in `src/city/crossings.test.ts`:
  - `"axis spans match the city part of each axis"` — the seven spans of "Measured" to 1e-6 (diagonalSur's end `x = 132 − 27·552/231`), `axisSpan(axis("barrio"))` is null.
  - `"axis × axis crossings are the five of the layout"` — the set of unordered `{a.id, otherId}` with `other !== null` equals {costanera–vias, costanera–sur, plaza–bulevar, bulevar–sur, diagonalNorte–vias}, centers (188,169), (188,318), (10,228), (10,318), (−14,169) within 1e-6.
  - `"no crossing center is in a plaza, a crossing plaza, the hotel lot, the tower island or outside the city"`.
  - `"axis × street crossings"` — the set of `a.id:otherId` with `other === null` equals: costanera:y198; plaza:x−50, x−20, x40, x70, x100; diagonalNorte:x40, x70, x100, x130, y198; diagonalSur:x100, x130; bulevar:y198, y258, y288; vias:x−50, x−20, x40, x70, x100, x130, x160; sur:x−50, x−20, x40, x100, x130, x160 (30).
  - `"every axis crossing has a crosswalk"` — for each unordered axis × axis crossing, some crosswalk across one of its two axes has its center within `half + 3 + 1e-6` of the crossing.
  - `"every crosswalk is three strips of the axis width, perpendicular to it, 1.6 apart"` (dot product with `a`'s direction < 1e-9, length `a.w`, consecutive centers 1.6 apart).
  - `"no crosswalk strip steps on a plaza, a crossing plaza, the hotel lot, the tower island, a crater, a foreign band, the terraces or under the bridge"`.
  - `"every axis × street crossing has a crosswalk except Diagonal Norte × y 198"` — that one is dropped by T5 (its two candidate centers land within 4 of the Diagonal Norte × x 100 and × x 70 crosswalks); any other without a crosswalk fails, naming it.
  - `"crosswalks: 38 measured"` — `crosswalks().length` toBe 38 (comment: measured on the prototype).
  - The prototype implements exactly the rules written in this Task's Interfaces (it is the source of the 30 / 38 figures). If the implementation yields different lists, the implementer does not edit the expected lists to match: they report the difference (which crossing, which rule) to the reviewer, who decides whether the rule or the prototype was wrong.
- [ ] **Step 2: Run** `npx vitest run src/city/crossings.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/city/crossings.ts` with the interfaces above (imports only from `city-plan`, `city-grid`, `map/geo`, `iso/geometry`). Add `QUAY_TERRACES` to `city-grid.ts` with a comment naming `westQuay`'s terraces (`fixed.ts` `westQuay`: tables at x 185..188.5, y 177/183/189, facing the bars parcel y 174..195). Add to `crossings.test.ts` `"QUAY_TERRACES covers westQuay's terrace tables"`: every `table`/`chair` solid of `westQuay([], [])` output lies inside it, so the constant cannot go stale silently.
- [ ] **Step 4: Run** the file → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `feat(#473): crossings and crosswalks of the axes`.

### Task 2: lanes and crosswalks painted; no axis center line

**Files:**
- Modify: `src/city/streets.ts`, `src/city/streets.test.ts`

**Interfaces:**
- Consumes: Task 1 (`axisSpan`, `axisFree`, `inDomain`, `crosswalks`, `ORDINARY_X`, `ORDINARY_Y`).
- Produces: `laneOffsets(a: Axis): readonly [number, number]` exported from `streets.ts` — `[−6, 6]` for `boulevard`, `[−a.w/4, a.w/4]` otherwise (offset along the normal `n = (−u.y, u.x)`).

- [ ] **Step 1: Write the failing tests** in `streets.test.ts` (new `describe("axis lanes and crosswalks (#473)")`):
  - `"every avenue, costanera, diagonal and the boulevard has dashes on both carriageways"` — for each axis with a span and each offset of `laneOffsets`, ≥ 4 strips of width 0.4, length 5 ± 1e-6, parallel to the axis (cross product of directions < 1e-6) and whose both endpoints lie at that signed offset from the center line (± 1e-6).
  - `"no axis keeps a continuous center line"` — no 0.3 strip is collinear with an axis (replaces `"each axis has a center line"`).
  - `"no stripe, crosswalk strip or post steps on the plaza, a crossing plaza, the hotel lot, the tower island or a crater"` — every 0.4 and 0.8 strip of the west bank (x < WEST_QUAY.x1 + 1, y ≥ LAND.y0): endpoints and midpoint not `blocked` (strict interiors as Task 1).
  - `"no dash body touches a crossing plaza or the Plaza Mayor"` — sample every 0.25 along each 0.4 strip, at its center and ±0.2 across: none `inCrossingPlaza` / strictly inside `PLAZA_MAYOR`.
  - `"no dash is painted under the bridge"` — no 0.4 strip point with x ≥ 186 and 207 ≤ y ≤ 217 west of `EAST_RING.x0`.
  - `"the crosswalks of crossings() are painted"` — every strip of `crosswalks()` appears as a 0.8 `paving` strip in the scene.
  - Rewrite `"the dashed lanes only go on the avenue's two carriageways and on the east ring"` → allow also the axis lanes (a 0.4 strip either on the old east carriageways / ring, or on an axis lane offset).
  - Rewrite `"each avenue crossing has a crosswalk of 3 strips of 0.8, except under the bridge"` → restrict it to strips with `x > EAST_RING.x0` (the east stretch), unchanged otherwise.
  - Rewrite `"each center line is a two-point strip …"` → no exception for diagonals (no axis line any more).
  - Replace `"no lane, crosswalk, boulevard, lamp or traffic light of the old west avenue is left"` with `"west of the ring, every 0.4 strip is an axis lane and every 0.8 strip a crosswalk of crossings()"`.
  - `"leaves between 80 and 150 strips"` → the measured count of `streets()` strips after Task 2 as an exact `toBe(N)` with the comment `measured (#473): … ` (no upper band any more, the budget test caps the city).
- [ ] **Step 2: Run** `npx vitest run src/city/streets.test.ts` → the new tests FAIL.
- [ ] **Step 3: Implement** in `streets.ts`: delete `axisLines` and its call; add `axisLanes(ground)` — for each axis with a span, for each lane offset, dashes of 5 every 10 from the span start, kept when every point sampled every 0.5 along the dash, on its center and on both long edges (±0.2 across), passes `axisFree(a, ·)` and its projection on the center line is `inDomain`; add `crosswalkStrips(ground)` — one `strip(path, 0.8, "paving")` per strip of `crosswalks()`. `gridLines` takes `ORDINARY_X` / `ORDINARY_Y` from Task 1. Order inside `lanes`: grid lines, then axis lanes, then crosswalks.
- [ ] **Step 4: Run** `npm test`. The strip assertions of `city.test.ts` (`≤ 150`) and `city-budget.test.ts` (`strip ≤ 190`) break here: set them to the count measured now, ×1.1 rounded to the ten, with the comment `provisional (#473 Task 2): N measured`; Task 6 writes the final figure. Suite green.
- [ ] **Step 5: Commit** `feat(#473): dashed lanes and crosswalks on the axes`.

### Task 3: boulevard median and trees

**Files:**
- Modify: `src/city/streets.ts`, `src/city/streets.test.ts`

**Interfaces:**
- Consumes: Task 1 (`axisSpan`, `crossings`, `crosswalks`, `crossingPlazas` from `city-plan`).
- Produces: `boulevardStretches(): readonly (readonly [number, number])[]` (y intervals of the median, sorted).

- [ ] **Step 1: Write the failing tests:**
  - `"the boulevard median is cut 6 around each transversal axis, the crossing plaza and the Diagonal, and at each street and crosswalk"` — every `leafDark` prism at z 0 with x 8, w 4, h 0.3 west of `EAST_RING.x0` lies in the boulevard span and keeps ≥ 6 from the y extent (over x 8..12) of the vias, plaza and sur bands, of each crossing plaza and of the Diagonal Norte band; does not overlap any ordinary street band (y ± 3) or crosswalk strip across the boulevard.
  - `"boulevard: 4 median prisms and 6 trees in the city (T2)"` — exact counts, with the comment of T2.
  - `"boulevard trees every 8 on the median, none within 6 of a transversal axis or in a crossing plaza"` — `streetTree` cones (r 1.5, h 4) at x 10, z 0.3, consecutive ones in a stretch 8 apart.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `boulevardMedian(solids)`: start from the span y range; remove `[y0 − 6, y1 + 6]` for the y extent over x 8..12 of each other axis's band (every diagonal included, not only Diagonal Norte: Diagonal Sur reaches the boulevard at y 342, outside the span, so it cuts nothing today) and each crossing plaza; remove `[c − 3, c + 3]` for each ordinary street crossing the boulevard and each crosswalk across it (its strips' y extent); keep stretches ≥ 2; `prism(8, y0, 0, 4, y1 − y0, 0.3, "leafDark")` per stretch; trees `streetTree(v3(10, y, 0.3))` at `y0 + 4 + 8k` while `y ≤ y1 − 4`.
- [ ] **Step 4: Run** `npm test` → green (adjust the exact counts only if they differ from 4 / 6, writing the measured figure in the comment; the `city.test.ts` boulevard assertion `leafDark` at z 0 within `BOULEVARD.y0..y1` must also accept the new median x 8..12).
- [ ] **Step 5: Commit** `feat(#473): boulevard median with trees`.

### Task 4: traffic lights and lamp rows on the axes

**Files:**
- Modify: `src/city/streets.ts`, `src/city/streets.test.ts`

**Interfaces:**
- Consumes: Task 1; `lampXs`, `BAR_FRONTS`, `LAMP_MIN_GAP` (existing).
- Produces:
  - `trafficLightPosts(): readonly Vec2[]` — post centers. Per crossing (axis × axis once per unordered pair, axis × street once): corners `at + σ1·(half + 0.5)·u + σ2·(a.w/2 + 0.8)·n`; take the pair (+,+)/(−,−), else (+,−)/(−,+), else any two allowed corners. A corner is allowed when it is in the domain, in `LAND` (x up to `WEST_QUAY.x1` for the costanera's crossings), not `blocked`, not on any axis band, not `onOrdinaryStreet(p, 0.15)`.
  - `lampSide(a: Axis): 1 | -1` — the sign of `n` that points north (`n.y < 0`) for E-W axes and diagonals, west (`n.x < 0`) for the boulevard; vias south (T1). The costanera has its own row (Task 5).
  - `axisLampPosts(): readonly { a: Axis; at: Vec2 }[]` — post centers at `(a.w/2 + 1)` outside the band on `lampSide`; stations from `lampXs` over the span (E-W axes in x, with `BAR_FRONTS` for vias only, `[]` otherwise; diagonals and boulevard over the arc length from the span start, fronts `[]`). A post is dropped (T3) when its center is `blocked`, on an axis band, `onOrdinaryStreet(p, 0.3)`, outside the domain/`LAND`, or < `LAMP_MIN_GAP` from a traffic light post.
- `postZ` also returns `PLINTH_H` on `inParcel(x, y)`.

- [ ] **Step 1: Write the failing tests:**
  - `"every crossing has two traffic lights"` — for each crossing (deduplicated), the test counts its allowed corners independently (same four corners, same rule) and expects `min(2, allowed)` posts within `half + 1.5` along and `a.w/2 + 1.5` across of it; the crossings with fewer than 2 allowed corners are pinned to the measured list (expected: diagonalNorte–vias, whose north corners are off land and whose east-south corner falls in the crossing plaza). For the costanera the land limit is `WEST_QUAY.x1` (the quay is its east sidewalk), so costanera–sur keeps (192.8, 312.5) and (183.2, 312.5).
  - `"every axis has lamps every 12 on one sidewalk"` — for each axis (not the costanera): enumerate the ideal stations of `lampXs(range, [])`; each is either a post of `axisLampPosts()` (± 0.01) or excused by exactly these reasons: bar front (vias), plaza, crossing plaza, hotel lot, tower island, crater, foreign axis band, ordinary street, traffic light < 3; any other missing lamp or any post at a non-ideal station that is not a `BAR_FRONTS` corner fails, naming the axis and station.
  - `"lamps stand on the lamp side, 1 outside the band"` (signed distance of the post center from the center line = `lampSide·(a.w/2 + 1)` ± 1e-6).
  - `"no lamp post overlaps a traffic light"` (existing test, now over the whole scene).
  - `"posts rest on the ground below"` — each lamp/traffic-light prism of the west bank has `at.z === postZ(center)`; `postZ` on a parcel sidewalk is `PLINTH_H`.
  - `"no post in the plaza, a crossing plaza (except its center lamp), the hotel lot, the tower island or a crater"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `trafficLightPosts`, `lampSide`, `axisLampPosts` and `axisFurniture(solids, lights)` — `trafficLight(v3(x − 0.15, y − 0.15, postZ(x, y)))`, `placeLit(solids, lights, lamp(v3(x − 0.3, y − 0.3, postZ(x, y))))`; call it from `streetFurniture` after the east furniture.
- [ ] **Step 4: Run** `npm test` → green (update any provisional count this task moves, same rule as Task 2 Step 4).
- [ ] **Step 5: Commit** `feat(#473): traffic lights and lamps on the axes`.

### Task 5: costanera promenade and lamps; crossing plazas

**Files:**
- Modify: `src/city/streets.ts`, `src/city/streets.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 4 (`postZ`), `crossingPlazas`, `clipHalf`, `tiles` is not reused (a quad grid clipped to the octagon), `plazaTone`, `createRng`, `PLINTH_H`.
- Produces: `COSTANERA_LAMP_Y: readonly number[]` = [160, 172, 196, 292, 304] (computed: `160 + 12k ≤ 312`, outside 206..291 and `QUAY_TERRACES`' y); `CROSSING_TILE_SEED = 473`; `crossingPlazaTiles(poly: Vec2[], rng: Rng): Solid` (`kind "ground"`, mat `plaza`, z 0.05, 2 u tiles of the octagon's box clipped with `clipHalf` to the octagon and fan-triangulated, `plazaTone`).

- [ ] **Step 1: Write the failing tests:**
  - `"the costanera has its promenade and lamps at x 190.5"` — one `paving` strip of width 3 at x 187.5 from y 164 to 318; lamps (steel 0.6 × 0.6 × 5 prisms) with `at.x === 190.5` at exactly `COSTANERA_LAMP_Y` (5, T2); none in y 206..291 nor in 174..195.
  - `"each crossing plaza has tiles, a curb and a lit lamp"` — for each `crossingPlazas()` polygon whose center is in the domain (two: (10,175.7), (67.5,318)): one `plaza` ground whose every vertex is inside the octagon (± 1e-6); 8 `poly` solids of `paving`, h `PLINTH_H`, each a band of 1.2 inside one edge; a lamp post centered on the octagon center; and in `city()` its bulb dot is among `accents` (`visibleLights` let it through).
  - `"the crossing plaza tiles do not consume the city rng"` — `city(createRng(7), …)` recipe fingerprints unchanged (the existing pinned test covers it; just run it).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `costanera(ground, solids, lights)` (the promenade strip pushed before `axisLanes`, lamps `placeLit(lamp(v3(190.5, y, postZ(190.5, y))))`) and `crossingPlazaPieces(ground, solids, lights)` (pushed first in `streets()`, before the lanes; curb: for each edge `P_i P_{i+1}`, the quad `P_i, P_{i+1}` and the same two points moved 1.2 toward the center along the inward normal, z 0, h `PLINTH_H`; lamp `placeLit(lamp(v3(c.x − 0.3, c.y − 0.3, 0.05)))`). Crossing plazas outside the domain are skipped.
- [ ] **Step 4: Run** `npm test` → green (update any provisional count this task moves, same rule as Task 2 Step 4).
- [ ] **Step 5: Commit** `feat(#473): costanera promenade and drawn crossing plazas`.

### Task 6: cars clear of crosswalks, city tests and budget

**Files:**
- Modify: `src/city/fixed.ts` (`cars`), `src/scenes/city.test.ts`, `src/scenes/city-budget.test.ts`, `README.md` (the `streets.ts` line)

**Interfaces:**
- Consumes: `crosswalks()` (Task 1).

- [ ] **Step 1: Write the failing tests:**
  - `city.test.ts` `"no parked car within 3 of a crosswalk"` — every car body (`CAR` footprint, by its steel/rust body prism) expanded by 3 does not overlap the bounding box of any crosswalk strip (old east crosswalks included).
  - Rewrite `"avenue: boulevard, lanes, crosswalks and traffic lights; street lamps only on …"` into `"street lamps only on axes, plaza, crossing plazas, costanera, bridge and promenade; none on ordinary streets"`: every amber r 0.6 dot is within `a.w/2 + 2` of an axis center line inside its span, or in the Plaza Mayor, a crossing plaza, at x 190.8 (costanera bulb), on the old avenue's east stretch, the promenade, the inlet, the yard, the footbridge, or in a block/parcel (kit recipes); none satisfies `onOrdinaryStreet(p, 0)`. Keep its strip assertions with the new measured counts and its boulevard assertion extended to the new median (x 8..12).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in `cars`: skip a car whose rect expanded by 3 overlaps the box of a crosswalk strip (`crosswalks()` plus none for the east: the east has its own rule already; only west-bank crosswalks are in `crosswalks()`).
- [ ] **Step 4: Measure** `strip` and static accents of `resume()` (`.scratch` script), write in `city-budget.test.ts`: `strip ≤ round10(N × 1.1)` and accents `≤ round10(M × 1.1)` with the comment `measured (#473): N strips / M accents, ×1.1 rounded to the ten`; the raised solids caps stay if under (2 900, city 1 600), otherwise the same rule. Update the README line on `streets.ts` (lanes, crosswalks, median, lamps, crossing plazas, costanera).
- [ ] **Step 5: Run** `npm test` and `npm run typecheck` → green.
- [ ] **Step 6: Commit** `feat(#473): cars clear of crosswalks, city tests and budget`.

### Task 7 (session, not a subagent): screenshot

- [ ] Dev server `npm run dev -- --host --port 5173`; agent-browser at 1600×900, 2× (`CLAUDE.md`), the site at `/` with Resume in view; save `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/calles/resume-calles.png`; commit `docs(#473): street hierarchy screenshot`. The PR cites it.

## Assumptions

T1–T7 above (decided, each with the issue's sentence that drives it, see `## Grilling`). Rejected alternatives: T1 north sidewalk of vias (would put the row off land at y 162.7 and leave `BAR_FRONTS` unused); T2 extra trees/lamps outside the issue's rules to reach the counts (adds furniture the issue does not describe); T4 moving the lane off ±w/4; T5 overlapping crosswalks; T6 drawing from the city rng (moves pinned recipe fingerprints).

## Grilling

- Rounds: 1 (griller model: fable). Questions: 18. Sources: ISSUE 9, CODE 12, DOC 0 (several answers cite both); NO SOURCE 0.
- Plan changes from round 1: suite green after every task (provisional counts, Q5); reference table of existing code (Q8, Q17); exact spans (Q7); prototype rule and the fallback when lists differ (Q4); street crossings' crosswalk test with the single expected exception (Q6); dash body sampling and test (Q9); traffic-light test with allowed corners and costanera land limit (Q11); all diagonals cut the median (Q14); `QUAY_TERRACES` guard test (Q15).
- Assumptions: T1–T7. Issues opened: none. Result: ok.
