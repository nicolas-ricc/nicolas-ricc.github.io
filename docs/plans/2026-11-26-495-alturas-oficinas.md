# #495 Alturas de ciudad de oficinas: topes por barrio, torres hasta 50 desde d 150 — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the west bank read as an office city. Each barrio gets a height range: clásico 14–22, transición 24–34, moderno 40–50, bajo 6–8. Barrios are measured from `PLAZA_CENTER` (clásico d < 80, transición 80–150, moderno d ≥ 150). Towers rise from d 150 and north of y 320, never above 50. `trainCap` and the sign rule (`maxHeightFor`) still apply on top of all this.

**Architecture:** The zoning (`src/city/zoning.ts`, `src/scenes/city-plan.ts`) sets the caps and the barrio limits. A new optional `Lot.band` (`{ lo, hi }`) tells a kit recipe which height range its lot is zoned for. On a lot with a band, `recipeCap` and `fitToCap` stop clamping at the kit's 18 / 24. Each barrio recipe also carries its own height draw onto the band (`banded`), so the rng sequence stays the same. A lot without a band builds exactly what it builds today: the east city, the kit snapshots and the lab do not move.

**Tech Stack:** TypeScript, vitest, PixiJS v8 (captures and FPS only), agent-browser.

**Spec:** issue #495 (binding) and `docs/superpowers/specs/2026-11-26-resume-hotel-cartel-2-5d-design.md` §3, §4, §7, §11.

## Measurements taken while planning (2026-11-26, `main` = `8147820`)

- **Today, the recipes cap the heights, not the zoning.** In `city(zoneRng(SEED,"cv"), …)`, the moderno tower-zone parcels have `lot.maxH` 46–50, yet their pieces top out at 15–22 (`glassTower` ≤ 21.9, `podiumTower` / `twinTowers` 18, `campus` 8–9). Transición tops out at 16 and clásico at 8.5. The kit clamps every common recipe at `RECIPE_MAX_H` 18 (`recipeCap`), and every landmark and `fitToCap` at `LANDMARK_MAX_H` 24. The draws are fixed too (`rng.int(12, 18)`, `rng.int(8, 14)`, `5.5 + 3·rng.next()`, …).
- Today's parcels: 81 built. By distance with the new limits, about 2 clásico (plus the 348..378 row, forced clásico by `barrioAt`), transición for d 80..150, and moderno for d ≥ 150 north of y 320. The `-17` and `-47` columns (d 168–209) become moderno.
- `maxHeightFor(p.rect, 50)` caps no built parcel (`zoning.test.ts` "no built parcel is capped by the sign"). Nothing in front of the sign will be cut at the new caps.
- `trainCap`: row y 171 → 26.9, row y 201 → 46.2.
- Budget (city of the world seed): raised solids 1 748 / cap 1 900, strip 533 / 570, static accents **1 584 / 1 600**, world static polygons 44 748 / 47 900, world accents 2 153 / 2 300, tech raised 962.
- Baseline `npm test` on main: only 5 s timeouts under parallel load (3–17 tests in `city.test`, `world.test`, `exhibits.test`, `lights.test`; the set changes between runs). None is an assertion.

## Global Constraints

- Height ranges, totals above the lot (plinth excluded), verbatim from the issue's table: **clásico 14–22, transición 24–34, moderno 40–50, bajo 6–8**. The upper end is the cap (`maxHFor`).
- Barrios by distance to `PLAZA_CENTER` (159, 263): **clásico d < 80, transición 80 ≤ d < 150, moderno d ≥ 150**.
- `towerZone(p) = p.c.y < 320 && p.d >= 150` (today `< 290 && >= 205`).
- **No building above 50.** The hotel (roof 60, sign to 75) is the only exception.
- `trainCap` stays on top of everything: `y_min − 1.4 · z_max ≥ 134.5` for every solid south of the track; row y 171 stays at ~25 (26.9).
- Whatever stands in front of the sign respects `maxHeightFor`. The neighbour rule (one barrio step at most: moderno → transición → clásico → bajo) is unchanged.
- Budget: the caps in `src/scenes/city-budget.test.ts` may only rise with a measurement: the new count × 1.1, rounded as that file rounds, plus `tick + render` against `main` by the #480 method (three interleaved loads per side, viewport 1600×900×1, the `[mapa] bloom:` console line, at most +2 ms).
- Code, comments and test names in English (`src/english.test.ts`). `npm test` and `npm run typecheck` green.

## Decisions and assumptions (declared)

- **D1. The barrio limits move with the caps.** The issue's table names the barrios by distance ("Clásico (d < 80)", "Transición (80–150)", "Moderno (d ≥ 150)"), so `barrioAt` changes from 105 / 205 to **80 / 150**. Its "moderno south of the tower zone becomes transición" line moves from y 290 to **y 320**, together with `towerZone`. Without that move no moderno parcel would ever stand between 290 and 320, and the new southern edge of the tower zone would do nothing. The rest of `barrioAt` (the 348..378 row clásico, bajo and residencial south of the cut) stays.
- **D2. `Lot.band` + `banded`, not stretching.** Scaling finished pieces in z (like `fitToCap` does, in reverse) would also stretch domes, cornices and machine rooms. Instead each barrio recipe carries its own height draw onto the band: `banded(lot, v, lo, hi)` maps the draw `v` from the recipe's own range `lo..hi` linearly onto `lot.band.lo..lot.band.hi`. The draw itself is unchanged, so the rng sequence is unchanged. Toppers and the existing `min(…, cap − toppers)` keep the total under `band.hi`.
- **D3. Which lots get a band.** Every non-fixed parcel whose neighborhood is clásico, transición, moderno or bajo and whose catalogue is `CATALOGUE[n].recipes` (so not `MODERNO_SLAB`). The band is `{ lo: min(BARRIO_HEIGHTS[n].lo, maxH), hi: maxH }`, where `maxH` is the lot's final cap (`maxHFor` and `maxHeightFor`). With `trainCap` at 26.9 a moderno lot gets the band 26.9..26.9. Fixed parcels (`FIXED_PARCELS`), bars, civic and the east city's blocks get no band and build as today.
- **D4. Recipes adapted:** the 11 recipes of the clásico, transición and moderno catalogues (`cornerCupola`, `mansard`, `classic`, `portalBase`, `chamfer`, `balconyBlock`, `decoStepped`, `courtyardO`, `podiumTower`, `glassTower`, `twinTowers`). Bajo's recipes (`rowHouses`, `patioResidential`, `courtyardU`) already sit at 6–8 under a cap of 8 and are not touched. No city parcel is bajo today: `barrioAt` only gives bajo south of `COASTAL_CUT_Y`, and `builtParcels` stops there.
- **D5. `campus` leaves the moderno catalogue.** Three 6–8 buildings cannot read as 40–50. The new weights are **podiumTower 45, glassTower 30, twinTowers 25**. `campus` stays in `MODERNO_SLAB` and in `district`.
- **D6. `TOWER_FREE_H` (21) and `MODERNO_SLAB` stay** for a moderno parcel off the tower zone and for the fixed parcels' cap off it. With D1 no plain moderno parcel falls off the zone, but the fixed ones still read the constant.
- **D7. Budget.** City static accents are at 1 584 / 1 600 and taller buildings carry more lit windows, so the caps will very likely rise. That rise goes through measurement (× 1.1) plus FPS against `main` (Task 4). If the branch is more than 2 ms slower, the floor stacking of `cornerCupola` and `balconyBlock` on banded lots is thinned first (a trim slab every second floor). If it is still slower, the run stops and comments on the issue.
- **D8. Captures** before (a `git worktree` of `origin/main` on port 5174) and after (the branch on 5173): the start view at 1920×1080 and 390×750, and the Resume zone view. They go in the PR, not in the repo.

## Review Focus

- **The station and the train seen behind taller row-171/201 pieces.** Row y 171 near x 103..127 goes from clásico 8.5 to transición, up to 26.9. Owner: Task 3, which keeps `city.test.ts` "no Resume solid taller than 10 overlaps STATION_LAND on screen" green. If it fails, add a station cap in `maxHFor` next to `trainCap`, not an exemption.
- **Tiny and wedge lots with a band** (lots of 14 × 6, 9 × 9 and 7 × 7 exist): a band must not turn an empty piece into NaN or into a sliver tower. Owner: Task 2 test "banded recipes on a 7 × 7 lot give finite bounds", and Task 3 test "every banded piece has finite bounds".
- **Lab exhibits framed with a fixed `h`** that may now cut a taller neighbour. Owner: Task 3 runs `src/lab/exhibits.test.ts` "neighbors: no solid cut by the edge rises above h". If it fails, raise that exhibit's `h` from the measurement and leave a comment.
- **The sign covered from the start view or the zone view.** Owner: Task 3 keeps `city.test.ts` "no solid in front of the sign rises above its bottom edge on screen" and adds "no west-bank parcel solid rises above 50 + PLINTH_H". The Task 4 captures check it by eye.
- **Lit windows and animatable quotas when there are more windows.** Owner: Task 3 keeps `lights.test.ts` green (`animableQuota`, `MAX_ANIMABLE` 40). Task 4 measures the accents.

---

### Task 1: Barrio limits, caps and tower zone

**Files:**
- Modify: `src/scenes/city-plan.ts` (`barrioAt`)
- Modify: `src/city/zoning.ts` (`towerZone`, `neighborhoodCap`, new `BARRIO_HEIGHTS`)
- Test: `src/city/office-heights.test.ts` (stage-3 evals, describe "caps and tower zone"); update `src/scenes/city-plan.test.ts` "barrioAt on the four reference points" and `src/city/zoning.test.ts` ("heights per barrio stay in the spec ranges", "maxHFor and catalogueFor follow the table and the tower zone", "towers only north of y 290")

**Interfaces:**
- Produces: `export const BARRIO_HEIGHTS: Record<CityBarrio, { lo: number; hi: number }>` = `{ bajo: { lo: 6, hi: 8 }, clasico: { lo: 14, hi: 22 }, transicion: { lo: 24, hi: 34 }, moderno: { lo: 40, hi: 50 } }` in `src/city/zoning.ts`. `towerZone(p)` = `p.c.y < 320 && p.d >= 150`. `maxHFor(n, p)`: unchanged signature, and `neighborhoodCap` returns `BARRIO_HEIGHTS[n].hi` for the four barrios (moderno off the zone: `TOWER_FREE_H`).

- [ ] **Step 1:** The stage-3 evals in `office-heights.test.ts` ("caps and tower zone") are the failing tests. Run `npx vitest run src/city/office-heights.test.ts -t "caps and tower zone"`. Expected: FAIL (caps 8.5 / 16, towerZone at 290 / 205, barrioAt at 105 / 205).
- [ ] **Step 2:** In `barrioAt`, change `d < 105` → `d < 80`, `d < 205` → `d < 150`, and `c.y > 290` → `c.y > 320`. Update its doc comment.
- [ ] **Step 3:** In `zoning.ts`, add `BARRIO_HEIGHTS` (doc comment: the issue's table, totals above the lot). Make `neighborhoodCap` read it. Set `towerZone` to 320 / 150 and update its doc comment.
- [ ] **Step 4:** Update the existing tests named above to the new values. `city-plan.test.ts`: `barrioAt({ x: -200, y: 300 })` is now `"moderno"`, and add `barrioAt({ x: -200, y: 330 })` → `"transicion"`. `zoning.test.ts`: the cap literal reads `BARRIO_HEIGHTS`, and "towers only north of y 320" uses `p.c.y < 320 && p.d >= 150`. Keep each assertion's intent.
- [ ] **Step 5:** Run `npx vitest run src/city src/scenes/city-plan.test.ts src/scenes/layout-493.test.ts`. Expected: "caps and tower zone" PASS. The band and height evals (Tasks 2–3) still FAIL. The zoning snapshot may differ: re-record it only after checking that the diff is the barrio and cap change (`npx vitest run src/city/zoning.test.ts -u`).
- [ ] **Step 6:** Commit `feat(#495): barrio limits 80/150, caps per barrio, tower zone from d 150 north of y 320`.

### Task 2: `Lot.band` in the kit and the eleven barrio recipes

**Files:**
- Modify: `src/kit/types.ts` (`Lot.band?: { lo: number; hi: number }`, documented in the `Lot` comment)
- Modify: `src/kit/piece.ts` (`recipeCap`, `fitToCap`, new `banded`)
- Modify: `src/kit/forms/modern.ts` (`glassTower`, `classic`), `src/kit/forms/composite.ts` (`podiumTower`, `twinTowers`, `decoStepped`, `chamfer`), `src/kit/forms/porteno.ts` (`cornerCupola`, `mansard`, `balconyBlock`, `portalBase`), `src/kit/forms/courtyard.ts` (`courtyardO`: its local `Math.min(lot.maxH, RECIPE_MAX_H)` becomes `recipeCap(lot)`)
- Test: `src/kit/office-band.test.ts` (stage-3 evals)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `export const banded = (lot: Lot, v: number, lo: number, hi: number): number`. Without `lot.band` it returns `v`. With one it returns `band.lo + t · (band.hi − band.lo)`, where `t = (v − lo) / (hi − lo)`, or `t = 1` when `hi <= lo`. `recipeCap(lot)` = `lot.band ? lot.maxH : min(lot.maxH, RECIPE_MAX_H)`. `fitToCap` caps at `lot.band ? lot.maxH : min(lot.maxH, LANDMARK_MAX_H)`.

Per recipe: keep the existing rng call where it is, and wrap only its value. The draws below are today's.

| recipe | today's draw | with a band |
|---|---|---|
| `glassTower` | `h = hMax < 16 ? hMax : rng.int(16, hMax)`, cap `min(maxH, 24)` | cap `recipeCap`-like (`lot.maxH`), `h = min(hMax, banded(lot, v, 16, hMax))` |
| `classic` | `hMax = min(MAX_CLASSIC_H, floor(min(maxH, 24) − CROWN))`, `rng.int(12, hMax)` | `hMax = floor(lot.maxH − CLASSIC_CROWN)` (no `MAX_CLASSIC_H`), `h = min(hMax, banded(lot, v, 12, hMax))` |
| `podiumTower` | `total = min(rng.int(12, 18), cap − topper)` | `min(banded(lot, v, 12, 18), recipeCap − topper)` |
| `twinTowers` | `h1 = min(rng.int(12, 16), hMax)` | `min(banded(lot, v, 12, 16), hMax)` |
| `decoStepped` | `body = min(rng.int(12, 18), cap) − SPIRE_H` | `min(banded(lot, v, 12, 18), recipeCap) − SPIRE_H` |
| `chamfer` | `min(rng.int(8, 14), cap − CORNICE_H − MACHINE_ROOM_H)` | `banded(lot, v, 8, 14)` in place of `v` |
| `courtyardO` | `min(rng.int(7, 12), floor(cap − CORNICE_H))` | `banded(lot, v, 7, 12)` in place of `v` |
| `cornerCupola` | `hr = 5.5 + 3·rng.next()` | `banded(lot, hr, 5.5, 8.5) − CUPOLA_H` in place of `hr` (floors follow `floorsFor(h)`) |
| `mansard` | `floors·floorH` with `floors = rng.int(4, 5)` | `banded(lot, floors, 4, 5) − CORNICE_H − 2.2` in place of `floors·floorH` |
| `balconyBlock` | `floors = rng.int(3, 5)`, `h = min(max(10, 3.2·floors), 16, cap − CORNICE_H)` | `h = min(banded(lot, floors, 3, 5), recipeCap − CORNICE_H)`, then `floors = max(3, round(h / 3.2))` |
| `portalBase` | `upperH = min(rng.int(2, 4)·floorH, roomH)` | `upperH = min(banded(lot, n, 2, 4) − (top − z) − CORNICE_H, roomH)` |

- [ ] **Step 1:** The stage-3 evals in `src/kit/office-band.test.ts` are the failing tests. Run `npx vitest run src/kit/office-band.test.ts`. Expected: FAIL (`banded` is not exported, and the pieces stop at 18 / 24).
- [ ] **Step 2:** Implement `Lot.band`, `banded`, `recipeCap` and `fitToCap` as in Interfaces.
- [ ] **Step 3:** Adapt the 11 recipes as in the table. A lot without a band keeps today's code path, value for value.
- [ ] **Step 4:** Run `npx vitest run src/kit`. Expected: `office-band.test.ts` PASS. `kit.test.ts` and its snapshot are unchanged (no fixture lot has a band): do not re-record that snapshot.
- [ ] **Step 5:** Commit `feat(#495): Lot.band carries the barrio recipes' heights onto the zoned range`.

### Task 3: The zoning hands the band to the west bank, and the moderno catalogue

**Files:**
- Modify: `src/city/zoning.ts` (`assign` sets `lot.band` per D3; `CATALOGUE.moderno` per D5)
- Test: `src/city/office-heights.test.ts` (stage-3 evals, describe "built city"); update `src/city/zoning.test.ts` (moderno weights), `src/scenes/city.test.ts` ("nothing but the hotel's own solids exceeds 21": west-bank parcel solids may reach 50 + `PLINTH_H`), and any pinned record whose diff is only these heights (zoning snapshot, `seed-isolation` snapshot, `city.test.ts` pinned plinth pieces if they include parcels)

**Interfaces:**
- Consumes: `BARRIO_HEIGHTS`, `towerZone` (Task 1); `Lot.band`, `banded` (Task 2).
- Produces: in every `Placed` of a non-fixed barrio parcel, `lot.band = { lo: min(BARRIO_HEIGHTS[n].lo, lot.maxH), hi: lot.maxH }`.

- [ ] **Step 1:** Run `npx vitest run src/city/office-heights.test.ts -t "built city"`. Expected: FAIL (no band on the lots, heights stop at 22).
- [ ] **Step 2:** In `assign`, set `band` on the lot of a parcel that is not fixed, whose neighborhood is in `BARRIO_HEIGHTS` and whose catalogue is `CATALOGUE[n].recipes`. Update `assign`'s doc comment.
- [ ] **Step 3:** Set `CATALOGUE.moderno.recipes` to `podiumTower 45, glassTower 30, twinTowers 25`.
- [ ] **Step 4:** Run `npx vitest run src/city src/scenes src/lab`. Update the tests listed under Files to the new heights, keeping their intent. For each pinned record, check that the diff is heights or recipes of west-bank parcels before re-recording. Keep green: "no solid in front of the sign rises above its bottom edge on screen", "no Resume solid taller than 10 overlaps STATION_LAND on screen", the train rule tests, "no two neighbouring parcels differ by more than one barrio step", and the lights tests. If a guard fails, fix the cause (Review Focus), not the guard.
- [ ] **Step 5:** Commit `feat(#495): office city: barrio parcels build within their band, moderno draws towers only`.

### Task 4: Budget, FPS, captures and docs (controller, with agent-browser)

**Files:**
- Modify: `src/scenes/city-budget.test.ts` (only the caps the measurement breaks, each with a dated measurement comment like the existing ones)
- Modify: `CONTEXT.md` (Recipe: `recipeCap` with a band; Parcel: barrio limits 80 / 150; Lot or Recipe: `Lot.band`)
- Modify: `docs/superpowers/specs/2026-11-26-resume-hotel-cartel-2-5d-design.md` (new `### 7.1 Desvíos (#495)`, in Spanish like §6.1: D1, D2, D5, D7 and the measured figures)

- [ ] **Step 1:** Measure the budget on HEAD: city raised, strip, static accents, world static polygons, world accents, raised per scene, and the "#479 budget moved" sum. Raise only the caps that fail, to count × 1.1 rounded as the file rounds, with a comment `measured 2026-11-26 (#495): …`.
- [ ] **Step 2:** If any cap rose: FPS by the #480 method. Run `npx vite --host --port 5173` on the branch and `--port 5174` on a `git worktree` of `origin/main`, agent-browser at `set viewport 1600 900 1`, three interleaved loads per side, and read `[mapa] bloom:`. Expected: branch `tick + render` ≤ main + 2 ms. Otherwise apply D7's fallback and measure again.
- [ ] **Step 3:** Captures before (5174) and after (5173): start view at 1920×1080 and 390×750, and the Resume zone view. Save them under `.scratch/captures-495/`. Check by eye that no tower covers the sign and that the train and station stay clear.
- [ ] **Step 4:** Docs: `CONTEXT.md` and spec §7.1. Run `npx vitest run src/docs-glossary.test.ts src/english.test.ts src/lab/docs.test.ts`. Expected: PASS.
- [ ] **Step 5:** Full suite `npm test` and `npm run typecheck`. Commit `chore(#495): budget measured, docs and spec §7.1`.
