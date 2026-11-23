# #480 Luces por barrio, presupuesto final, FPS y cierre de la spec — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close story #471: the 40 animatable windows split among the four barrios, every budget cap rewritten from a dated measurement, the FPS comparison with `main` recorded (no static cache: see below), the 2026-11-22 spec marked implemented with its §12, glossary/README updated, and the closing captures.

**Architecture:** `src/city/lights.ts` gains a pure quota function (`animableQuota`) and samples the animatable windows per barrio instead of over one pool. The budget is a measurement pass: caps in `src/scenes/city-budget.test.ts` and `src/scenes/tech-budget.ts` become `measured × 1.1`, rounded, with figure and date. Docs close the spec. There are no changes to the renderer (`src/world/stage.ts`).

**Tech Stack:** TypeScript, vitest, pixi.js v8, agent-browser (captures and FPS).

**Spec:** issue #480; `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md` §9, §10 (5), §11; `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §7, §9. The story's decisions D14/D15 are in the plan comment of #471.

## Measurements taken while planning (2026-11-23, HEAD `343ed5e` of `feature/471-resume-centro-costero`, `main` = `c9df1fa`)

**FPS (issue step 3).** `npx vite --host --port 5173` (branch) and `--port 5174` (a `git worktree` of `origin/main`). agent-browser, viewport `1600 900 1` (checked: `innerWidth 1600, innerHeight 900, dpr 1`). Three loads each, interleaved, reading the `[mapa] bloom:` console line:

| load | main tick + render (ms) | branch tick + render (ms) |
| --- | --- | --- |
| 1 | 12.0 + 5.1 = 17.1 | 11.4 + 4.9 = 16.4 |
| 2 | 12.0 + 4.8 = 16.9 | 11.2 + 5.1 = 16.4 |
| 3 | 11.2 + 5.3 = 16.5 | 11.4 + 5.1 = 16.5 |
| mean | 11.73 + 5.07 = 16.80 | 11.33 + 5.03 = 16.37 |

The branch is 0.43 ms **faster** than `main` (threshold: +2 ms). Static polygons: `main` 46 146, branch 43 546 (`[mapa] first draw` line). **Decision: no static cache.** `stage.ts` and `stage.test.ts` are not touched; `stage.staticDraws` is not added. The reason and the figures go in spec §12 (Task 4). Task 3 measures again on the final HEAD to confirm.

**Budget, branch HEAD `343ed5e` (before Task 1).** `world(SEED)` raised solids: shipyard 686, factory 770, city 1 518, fair 565, hinterland 453, tech 1 136. City (`city(zoneRng(SEED,"cv"), zoneRng(SEED,"cv",1), zoneRng(SEED,"cv",3))`): strip 522, static accents 1 274. `assembleWorld(undefined, { reducedMotion: true })`: static polygons 43 546, accents 1 827. Tech (`tech(zoneRng(SEED,"cv",2))`): district faces 5 245, `NEIGHBORHOOD_REGION` 1 444, `WATERFRONT_RECT` 331, max `facesIn` per kind without the furniture: low 98, houses 61, monoblock 105, plaza 58, school 86, club 80; accents + frame 0 of the layers 568.
**`main` (`c9df1fa`):** shipyard 686, factory 770, city 1 454, fair 565, hinterland 453, tech 1 490; strip 152; city accents 1 165; static polygons 46 146; world accents 1 753.
None of them exceeds 56 000 / 2 600, so issue step 2 does not trigger step 3.

**Lights today (world seed).** Window candidates: clasico 60, transicion 527, moderno 720, bajo 0 (the south's bajo is `tech.ts`: its windows are `homes`, drawn `amber`, not `lights.ts` windows). The animatable windows today are transicion 36 and clasico 4; moderno gets none because the pool is `downtown, residential, clasico, transicion, bajo`. Hotel: 96 rooms, `ROOMS_LIT 0.4`.

## Global Constraints

- Code, comments and test names in English (`english.test.ts`); the specs stay in Spanish.
- `MAX_ANIMABLE` stays at 40 ("`MAX_ANIMABLE` sigue en 40, repartido entre los barrios").
- Caps only with a measured figure; every rewritten cap carries its figure and the date (2026-11-23) in the comment.
- Rounding: `measured × 1.1` rounded to the **nearest** hundred (`strip` and tech `FACE_CAPS`: the nearest ten). That is the rule the existing `CAPS` comment states ("Caps are measured ×1.1 rounded to the nearest hundred"). If the rounded value falls below the measured figure, round up instead.
- Captures at 2× (`agent-browser set viewport <w> <h> 2`), in `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/cierre/`.
- `npm test` and `npm run typecheck` green at the end of every task.

## Review Focus

1. **A barrio with no candidates** (bajo has 0 in the city with the world seed): the quota must give it 0 without breaking the total; test `animableQuota: a barrio with no candidates gets 0 and the rest still sums to 40` (Task 1).
2. **Fewer candidates than 40** (a synthetic or other-seed scene): every candidate becomes animatable, and no barrio gets more than it has; test `animableQuota: with fewer than 40 candidates every one is animatable` (Task 1).
3. **More barrios with candidates than places** (impossible at 40, but the function takes `max`): with `max` smaller than the number of non-empty barrios, the barrios with the most candidates win, deterministically; test `animableQuota: with max below the barrio count the largest barrios win` (Task 1).
4. **A cap whose fixture differs from the world** (tech `FACE_CAPS` are asserted both over `world` and over synthetic contexts in `neighborhood-*.test.ts`): a cap measured on the world alone can fail a unit fixture. The cap takes the max of the two, and the comment says which one set it (Task 2).
5. **A cap that is also a generation limit** (`FACE_CAPS.monoblock` is read by `neighborhood-monoblock.ts` to trim the block): lowering it changes the geometry. It stays at 115, with the measured figure in the comment (Task 2).

---

### Task 1: Animatable windows split among the four barrios

**Files:**
- Modify: `src/city/lights.ts` (the `sample(windows.filter(...))` line in `lights()`)
- Test: `src/city/lights.test.ts`, `src/scenes/city-anim.test.ts`

**Interfaces:**
- Produces: `export const ANIMABLE_BARRIOS = ["clasico", "transicion", "bajo", "moderno"] as const satisfies readonly Neighborhood[]` and `export function animableQuota(candidates: Record<(typeof ANIMABLE_BARRIOS)[number], number>, max = MAX_ANIMABLE): Record<(typeof ANIMABLE_BARRIOS)[number], number>`, both in `src/city/lights.ts`.

**Rule (decided here).** The pool is every visible window whose piece's neighborhood is one of `ANIMABLE_BARRIOS`; other neighborhoods (bars, civic, riverside, warehouses, freight, harbor, and the old downtown/residential, which have 0 candidates on the world seed) do not animate. `animableQuota`: `total = min(max, Σ candidates)`. Each barrio with candidates gets 1 (if `total` is smaller than the number of non-empty barrios, the barrios with the most candidates get 1 each, ties broken by `ANIMABLE_BARRIOS` order). The rest, `total − Σ ones`, is split in proportion to each barrio's remaining capacity (`candidates − ones`) with the largest-remainder method (ties by `ANIMABLE_BARRIOS` order); since `total ≤ Σ candidates`, no barrio exceeds its candidates. Then in `lights()`, for each barrio in `ANIMABLE_BARRIOS` order, `sample(windowsOfBarrio, quota[b], rng)`. It still uses the same `rng` and runs at the same point, after the quotas and before the neons.

- [ ] **Step 1: Write the failing tests**

In `src/city/lights.test.ts`:
  - Replace `there are at most ${MAX_ANIMABLE} animatable ones and all from downtown, residential or the warm barrios (#477)` with `there are at most ${MAX_ANIMABLE} animatable ones, all from the four barrios (#480)`: `≤ MAX_ANIMABLE`, `> 0`, and every owner neighborhood is in `ANIMABLE_BARRIOS`.
  - In a new `describe("animatable windows per barrio (#480)")`:
    - `animableQuota splits 40 in proportion with at least 1 per barrio with candidates`: `animableQuota({ clasico: 60, transicion: 527, bajo: 0, moderno: 720 })` equals `{ clasico: 3, transicion: 16, bajo: 0, moderno: 21 }`.
    - `animableQuota: a barrio with no candidates gets 0 and the rest still sums to 40`: `animableQuota({ clasico: 1, transicion: 0, bajo: 0, moderno: 500 })` equals `{ clasico: 1, transicion: 0, bajo: 0, moderno: 39 }`.
    - `animableQuota: with fewer than 40 candidates every one is animatable`: `animableQuota({ clasico: 3, transicion: 5, bajo: 2, moderno: 10 })` equals the input.
    - `animableQuota: with max below the barrio count the largest barrios win`: `animableQuota({ clasico: 5, transicion: 9, bajo: 9, moderno: 1 }, 2)` equals `{ clasico: 0, transicion: 1, bajo: 1, moderno: 0 }`.
    - `world seed: 40 animatable windows split among the barrios, at least 1 per barrio with candidates`: on the world-seed city, the count of animatable windows per barrio equals `animableQuota` of `counts[b].candidates`, the total is 40 and `moderno ≥ 1`.
    - `classic and bajo windows warm, moderno cool`: on the world-seed city, for `clasico` and `bajo` with `counts[b].on > 0`, `warm/on ≥ 0.9`; for `moderno`, `warm/on ≤ 0.15`; for each, the lit windows with `color === "windowWarm"` number exactly `counts[b].warm` and the lit ones exactly `counts[b].on`; `clasico.on > 0` and `moderno.on > 0`. Plus the south's bajo: `tech(zoneRng(SEED, "cv", 2))` through `createTechAnim(scene, createRng(SEED + 5), { reducedMotion: true }).homes()` draws every home `amber` (warm), and there is at least one.
    - `hotel shows lit rooms`: `createCityAnim(worldCity, createRng(SEED + 2), { reducedMotion: false }).lit().length ≥ 6` (the rng `assembleWorld` passes to `cityAnimator`).
  - Keep `every axis has lamps every 12 on one sidewalk` (`src/city/axis-furniture.test.ts`) and `axisLampSpots: every 12, …` (`src/city/axis-streets.test.ts`) as they are: they are part of the acceptance run.
In `src/scenes/city-anim.test.ts`: `40 animatable windows split among the barrios (≥ 1 per barrio with candidates) (#480)`. On the world-seed city: `animable.length === MAX_ANIMABLE`; for each `b` of `ANIMABLE_BARRIOS` with `lights.counts[b].candidates > 0`, at least one animatable window; and `createCityAnim(scene, createRng(SEED + 2), …).windows()` at frame 0 equals the animatable lit ones (the existing frame-0 rule) and contains windows from more than one barrio.

- [ ] **Step 2: Run the tests and check that they fail**

Run: `npx vitest run src/city/lights.test.ts src/scenes/city-anim.test.ts`
Expected: FAIL. `animableQuota` is not exported, and on the world seed moderno has 0 animatable windows.

- [ ] **Step 3: Implement `ANIMABLE_BARRIOS` and `animableQuota`, and use them in `lights()`**

The docstring at the top of `lights.ts` names the rule ("animatable: 40 split among the four barrios, #480").

- [ ] **Step 4: Run the tests and check that they pass**

Run: `npx vitest run src/city/lights.test.ts src/scenes/city-anim.test.ts src/city/axis-furniture.test.ts src/city/axis-streets.test.ts`, then `npm test`.
Expected: PASS. A world-seed test elsewhere that pins one specific neon or window may move, because the rng draws after the animatable sampling change. Such a test is updated to the new value, with a comment that names #480.

- [ ] **Step 5: Commit** `feat(#480): animatable windows split among the four barrios`

### Task 2: Every budget cap from a dated measurement

**Files:**
- Modify: `src/scenes/city-budget.test.ts`, `src/scenes/tech-budget.ts`
- Test: the same files, plus `src/scenes/tech.test.ts`, `src/scenes/waterfront.test.ts`, `src/scenes/neighborhood-*.test.ts` (they assert `FACE_CAPS`)

**Interfaces:**
- Consumes: Task 1, because it moves window accents between static and animated, so measure after it.
- Produces: nothing new. The names (`CAPS`, `FACE_CAPS`, `ACCENT_CAP`, `TECH_FACES_BEFORE`, `REGION_FACES_BEFORE`) stay.

- [ ] **Step 1: Measure.** One-off `npx tsx` script outside the repo, using the same expressions as the tests. Raised solids `!isFlat` per scene of `world(SEED)`. Strip and accents of the world-seed `city(...)`. `buildRenderList([...terrain.ground, ...ground, ...solids]).length` and `accents.length` of `assembleWorld(undefined, { reducedMotion: true }).scene`. Tech: the district, `NEIGHBORHOOD_REGION`, `WATERFRONT_RECT`, and the max `facesIn(withoutFurniture, blockRect(b))` per kind, exactly as `tech.test.ts` builds them; plus the max of each `FACE_CAPS` key over the synthetic contexts the `neighborhood-*.test.ts` and `waterfront.test.ts` assert (Review Focus 4); plus `ACCENT_CAP`'s sum. Expected, before Task 1: the figures above.
- [ ] **Step 2: Rewrite each cap** as `measured × 1.1` rounded (Global Constraints), with `// measured 2026-11-23 (#480), world(SEED): <figure> × 1.1 = <x> → <cap>` comments. Where a cap shrinks, that is fine: it is a ceiling over a measured figure. The history in the old comments can be shortened to one line (`before: …`). Concretely:
  - `"raised solids ≤ 2 900, strip ≤ 580, static accents ≤ 1 500"` gets the new figures, and its title follows them (city raised = the `CAPS.city` value).
  - `static polygons of the world ≤ 56 000` becomes `≤ <cap>` (expected ~47 900), with the title updated.
  - `static accents of the whole world ≤ 2 600` becomes `≤ <cap>` (expected ~2 000).
  - `CAPS` gets all six scenes.
  - The `#427` and `#479` record tests (`< 46518`, `< 2409`, `BEFORE`) stay as they are: they are records, not caps.
  - `tech-budget.ts`: `TECH_FACES_BEFORE` and `REGION_FACES_BEFORE` are re-measured (same comment format). `FACE_CAPS` are rewritten per key from the max of world and fixtures, except `monoblock`, which stays 115 (generation limit read by `neighborhood-monoblock.ts`; the comment carries the measured figure, Review Focus 5). `ACCENT_CAP` is rewritten too.
- [ ] **Step 3: Run** `npx vitest run src/scenes` and then `npm test`. Expected: PASS. If a fixture fails a new cap, the cap takes that fixture's measured figure × 1.1, and the comment says so.
- [ ] **Step 4: Commit** `test(#480): budget caps from the final measurement`

### Task 3: Final FPS check and closing captures (controller, with agent-browser)

**Files:**
- Create: `docs/superpowers/specs/assets/2026-11-22-resume-centro-costero/cierre/{sitio.png, sitio-velo-cv.png, lab-world-bloom.png, sitio-390x750.png, sitio-820x1180.png}`

- [ ] **Step 1: FPS on the final HEAD.** Same procedure as above (both servers, three interleaved loads each, `[mapa] bloom:`). Expected: branch `tick + render` ≤ main + 2 ms. If not, stop: the cache becomes a new task (`RenderTexture` of Resume's static layers in `stage.ts`, `stage.staticDraws`, test in `stage.test.ts`, as the issue's step 3 describes) before Task 4.
- [ ] **Step 2: Captures.** Each one is taken with `agent-browser set viewport <w> <h> 2`, a fresh `open`, and a wait for the `[mapa] bloom:` (or `[lab] first draw`) line plus 2 s:
  - `sitio.png`: `/` at 1600×900. The world has no day/night switch (it is a night map); "de día" is taken as the plain site with no zone in focus.
  - `sitio-velo-cv.png`: `/area/cv/` at 1600×900 (veil on the other zones).
  - `lab-world-bloom.png`: `/lab/world.html` at 1600×900. Press `6` until the console says `bloom by hand: on`.
  - `sitio-390x750.png`: `/` at 390×750.
  - `sitio-820x1180.png`: `/` at 820×1180.
- [ ] **Step 3: Commit** `docs(#480): closing captures`

### Task 4: Spec closed, README, glossary and their tests

**Files:**
- Modify: `docs/superpowers/specs/2026-11-22-resume-centro-costero-design.md`, `README.md`, `CONTEXT.md`
- Test: `src/lab/docs.test.ts`, `src/docs-glossary.test.ts`

**Interfaces:**
- Consumes: the figures of Tasks 1–3 (budget before/after, `tick`/`render`, the capture names).

- [ ] **Step 1: Write the failing tests**
  - `src/docs-glossary.test.ts`, `describe("city plan vocabulary (#480)")`:
    - `defines Parcel and Axis`: both `### Parcel` and `### Axis` headings exist.
    - `Parcel: …` and `Axis: every Code: file exists and names identifiers it holds`: same check as the kit terms (`codeRefs`, `hasIdent`).
    - `Parcel names city-plan.ts, parcels, barrioAt, inscribedRect and Lot.poly; Axis names AXES, AxisKind and crossingPlazas`: substring checks on the sections.
  - `src/lab/docs.test.ts`, `describe("the centro costero spec is closed (#480)")`:
    - `README lists the centro costero spec among the specs`: the README contains `2026-11-22-resume-centro-costero-design.md`.
    - `the spec is implemented and has §12`: the spec contains `**Estado:** implementado (#471; rama feature/471-resume-centro-costero)` and the heading `## 12. Desvíos y medición`.
    - `§12 records the deviations and the measurement`: the §12 text (from the heading to the end) contains `HOTEL_CAP`, `12`, `28`, `48`, `37`, `430×932`, `390×750`, `360×740`, `< 9`, `(−107, 231)`, `TELECOM`, `tick`, `render`, `RenderTexture` (the cache decision) and every capture file name of Task 3.
    - `every closing capture exists, is cited in §12 and is 2×`: for each of the five files, the file exists, §12 cites `assets/2026-11-22-resume-centro-costero/cierre/<name>`, and the PNG width is 2 × the viewport width (3200, 780 or 1640).
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts src/docs-glossary.test.ts`. Expected: FAIL (no Axis entry, no §12, no README line).
- [ ] **Step 3: Write the docs.**
  - Spec header: `**Estado:** implementado (#471; rama feature/471-resume-centro-costero)`.
  - New `## 12. Desvíos y medición` after §11, in Spanish, with subsections:
    - (a) the cap 12 and its reason (it points to §7.5);
    - (b) portrait phones: 28 / 48 / 37 % visible in 430×932, 390×750 and 360×740, link in edge mode, D10;
    - (c) the side < 9 rule: 8 pieces dropped, 2 north of the plaza and 6 in the south, as measured while planning #471;
    - (d) the cells of the singular pieces: `FIXED_PARCELS` in `src/city/zoning.ts` and `ARENA`, `AUDITORIUM`, `SCHOOL`, `CLUB`, `PLAZAS` in `src/scenes/tech-zoning.ts`, read from the code;
    - (e) TELECOM at `(−107, 231)`;
    - (f) the west without a lit floor or crowns: kit windows and catalogue neons, with the mast ring kept in `city-anim`;
    - (g) lights: 40 animatable windows split among the barrios, with the quota measured on the world seed;
    - (h) a budget before/after table: `main` vs final, from Task 2;
    - (i) FPS: the planning table plus the Task 3 figures; no `RenderTexture` cache, because the branch is not 2 ms slower;
    - (j) the list of captures, with relative links.
  - `README.md`: add `2026-11-22-resume-centro-costero-design.md` to the spec list, after `2026-11-20-writing-balsa-tablones-design.md`. In the "Isometric world" paragraph, one sentence: the 40 animatable windows (`MAX_ANIMABLE`) are split among the four barrios.
  - `CONTEXT.md`: the **Parcel** entry gains `Lot.poly` (the lot carries the parcel polygon), and its `Code:` line names `src/scenes/city-plan.ts` (`Parcel`, `parcels`, `inscribedRect`, `barrioAt`) and `src/kit/types.ts` (`Lot`). A new **Axis** (Eje) entry right after Parcel, which says:
    - the eight axes of the plan (`AXES`: ids `costanera`, `plaza`, `diagonalNorte`, `diagonalSur`, `bulevar`, `vias`, `sur`, `barrio`), each with a `kind` (`AxisKind`: costanera, avenue, diagonal, boulevard) and a total width `w`;
    - the crossing plazas (`crossingPlazas`): octagons of r 11 where two axes cross;
    - `Code:` `src/scenes/city-plan.ts` (`AXES`, `Axis`, `AxisKind`, `crossingPlazas`, `onAxis`), `src/city/streets.ts` (`axisLampPosts`).
- [ ] **Step 4: Run** `npx vitest run src/lab/docs.test.ts src/docs-glossary.test.ts src/english.test.ts`, then `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `docs(#480): spec 2026-11-22 implemented, §12, README and glossary`

## Self-review

- Coverage against the issue:
  - Step 1 → Task 1.
  - Step 2 → Task 2.
  - Step 3 → the planning measurement, Task 3 step 1, and §12 (i).
  - Step 4 → Task 4.
  - Step 5 → Task 3 step 2, with §12 (j) citing the captures.
  - Each acceptance criterion maps to a named test, except the PR citing the captures (manual, stage 8).
- The cache is conditional. The measurement says no. If the final HEAD disagrees, Task 3 step 1 turns it into a task.
- Types: `ANIMABLE_BARRIOS` and `animableQuota` are used under the same names in Tasks 1 and 4.
