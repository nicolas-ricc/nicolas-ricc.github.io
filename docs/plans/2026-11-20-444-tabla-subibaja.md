# The Writing board heaves with `platformAnimator` (#444) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The floating Writing board and its painted word heave slowly together, like a rigid body, with a quantized vertical offset `dz`. The board stays still with `reducedMotion`, and level 2 and the ship rule hold at every pose of the cycle.

**Architecture:** `src/scenes/sign-platform.ts` gains the pure pose function `heaveAt(tMs)` (quantized sine) and the pose parameter `dz` on `signAt` (now exported) and on `seaPlatformAt`. `platformAnimator` (`src/scenes/platform-animator.ts`) keeps a clock and computes `dz`. It reports its two layers when the site or the quantized `dz` changes, and caches each `(site, dz)` pose. `assembleWorld` passes `reducedMotion`. The cycle is audited by sampling 8 phases in the level-2 gate (`src/lab/signs.test.ts`) and in the ship rule (`src/scenes/sea-anim.test.ts`).

**Tech Stack:** TypeScript, Vitest (node).

**Spec:** issue #444 ("Decisiones tomadas" and "Criterios de aceptación" are binding); story #441, plan comment, decision 3.

## Global Constraints

- `HEAVE = { amp: 0.15, periodMs: 6700 }` and `HEAVE_STEP = 0.01`, both exported from `src/scenes/sign-platform.ts`.
- `heaveAt(tMs) = amp · sin(2π · tMs / periodMs)`, rounded to the nearest multiple of `HEAVE_STEP`.
- Heave only: no pitch and no roll. The top face stays a horizontal plane, and the plan (x, y) never changes with `dz`.
- `seaPlatformAt(out, accents, site, dz = 0)`: the board has `z: WATER_Z + dz` and the same `h`, and every paint vertex has `z + dz`. `signAt(site, dz = 0): SignSpec` is exported, and `BLOG_SIGNS[site]` stays `signAt(site, 0)`.
- `platformAnimator(opts: { site?: WritingSite; reducedMotion: boolean })`. `reducedMotion` is required, as in every other animator.
- `tick(dtMs)`: a non-finite or ≤ 0 `dtMs` does not advance the clock. With `reducedMotion`, `dz` is always 0. It reports both layers when the site or the quantized `dz` changed since the last tick, and otherwise returns an empty set.
- `platform.lights` declares `bloom: false` and no `zone`.
- `assembleWorld` passes `reducedMotion` to `platformAnimator`.
- `contextAnimators` (`src/lab/crop.ts`) is unchanged: the context exhibits show the rest pose.
- Code, comments and test names are in English (`src/english.test.ts`).
- `npm test` and `npm run typecheck` are green.

## Technical decisions (declared; not in the issue)

1. **The phase is reduced modulo the period inside `heaveAt`**: `sin(2π · (t mod periodMs) / periodMs)`. Periodicity then holds exactly for integer `t`, and a clock running for hours does not lose precision. The animator also keeps its clock modulo `periodMs`.
2. **The cache key is the integer step** `Math.round(dz / HEAVE_STEP)`, not the float `dz`: `0.07` and `0.07000000000000001` are the same pose. There are at most 31 poses per site, each with 1 solid and 382 triangles.
3. **`PAINT_LIFT` is exported**, so the tests can write `BOARD_TOP + PAINT_LIFT + dz` as the issue does. Its value (0.02) doesn't change.
4. **`seaPlatformAt` builds from `signAt(site, dz)`** for any `dz` (a fresh spec, so the copies hold by construction), and it keeps the `poly` guard.
5. **The context crop in the posed level-2 test** is `cropScene(scene, e.box).solids` (the crop without the rest board) plus the posed board from `seaPlatformAt(…, site, dz)`. The test asserts once that `contextScene(scene, e).solids` equals `cropScene(scene, e.box).solids` plus the cropped rest board, so it is the issue's construction («`contextScene(scene, e).solids` sin la tabla de reposo, más la tabla de la pose»).
6. **The 8 phases** are `t = k · HEAVE.periodMs / 8`, k = 0…7, and `dz = heaveAt(t)`. A shared `HEAVE_PHASES` constant is not exported: each test file builds the list inline.
7. **CONTEXT.md** gets one sentence in the Sign entry: the board heaves with `heaveAt` and is still under `reducedMotion`. The rest of the docs (specs, REPORT.md, captures) belong to #445.

## Review Focus

- A long-running page (clock in the hours) → `heaveAt` stays periodic, bounded and a multiple of `HEAVE_STEP`. Test in Task 1: `heaveAt(1e9 · periodMs + 1234)` is close to `heaveAt(1234)` within 1e-9.
- A site change mid-swing → the layers come from the new site at the *current* `dz`, not at rest. Test in Task 2.
- A site change with `reducedMotion` → it is reported, and the layers are the rest pose of the new site. Test in Task 2.
- `layer()` before any tick → the rest pose (`dz` 0) of the starting site. Test in Task 2.
- The negative half of the swing → `-0` and negative steps behave like the others: they are reported only on a change of step and are cached under one key. This is covered by the 67-tick period test and the "two equal steps report nothing" test in Task 2.

## Assumptions

From the plan grilling. Each one is decided here, with the alternative that was rejected:

- **The cache uses numeric keys** (a `Map` keyed by site, then by the integer step). `Map` compares keys with SameValueZero, so `-0` and `0` are one pose. Rejected: string keys built from the float `dz`.
- **The suite is red between the evals commit and Task 2.** The pipeline mandates a failing `test(#444): evals` commit, and the branch is squash-merged. Rejected: keeping every commit green.
- **Recomputing versus caching.** Both satisfy the issue («cacheá por `(site, dz)` o reconstruí»). The cache was chosen so that a layer redraw doesn't rebuild 382 triangles about 9 times a second. Rejected: rebuilding on every report.
- **The paint at the trough.** The board keeps `z: WATER_Z + dz` as the issue fixes it. Its relation to the water mesh at the trough is the same as at rest: the water is animated and its depth order is the stage's. Rejected: clamping `dz` to keep the bottom above −1.

## Acceptance criteria → where

1. Green suite and typecheck → final step of Task 2.
2. `heaveAt` properties → Task 1 tests (`sign-platform.test.ts`).
3. Rigid body over 8 phases → Task 1 tests (`sign-platform.test.ts`).
4. Level 2 over the cycle → Task 1 tests (`src/lab/signs.test.ts`).
5. Ships over the cycle → Task 1 tests (`src/scenes/sea-anim.test.ts`).
6. Animator → Task 2 tests (`platform-animator.test.ts`).
7. Budget: `city-budget.test.ts` unchanged and green, plus «≤ 120 reports in 10 s at 16.7 ms» → Task 2.
8. `animators.test.ts` green, plus `assembleWorld(undefined, { reducedMotion: true }).platform` silent for 10 s → Task 2.

The failing tests for all criteria are written first, in the evals commit (`test(#444): evals`). The tasks below make them pass, and add only the Review Focus tests.

---

### Task 1: the pose — `HEAVE`, `heaveAt`, `signAt(site, dz)`, `seaPlatformAt(…, dz)`

**Files:**
- Modify: `src/scenes/sign-platform.ts`
- Test: `src/scenes/sign-platform.test.ts`, `src/lab/signs.test.ts`, `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Produces: `HEAVE: { amp: number; periodMs: number }`, `HEAVE_STEP: number`, `PAINT_LIFT: number`, `heaveAt(tMs: number): number`, `signAt(site: WritingSite, dz?: number): SignSpec`, `seaPlatformAt(out: Solid[], accents: Accent[], site: WritingSite, dz?: number): void`.

- [ ] **Step 1: The tests are the evals** (written in the pipeline's evals stage and committed as `test(#444): evals` before this task starts; the implementer only checks they exist):
  - `sign-platform.test.ts` › `heaveAt (#444)`: `HEAVE` toEqual `{ amp: 0.15, periodMs: 6700 }` and `HEAVE_STEP` is 0.01. For t from 0 to 2·period in steps of 37 ms: `|heaveAt(t) − heaveAt(t + periodMs)| ≤ 1e-9`, `|heaveAt(t)| ≤ amp + 1e-12`, and `|heaveAt(t)/HEAVE_STEP − round(…)| ≤ 1e-9`. `heaveAt(0) === 0`. The 50 ms samples over a period take ≥ 20 distinct values, rounded to steps.
  - Review Focus: `|heaveAt(1e9 · periodMs + 1234) − heaveAt(1234)| ≤ 1e-9`.
  - `sign-platform.test.ts` › per site and for each of the 8 phases: the board has `z + h` close to `BOARD_TOP + dz` (1e-9), `z` close to `-1 + dz`, and its footprint equals the rest footprint. Every paint vertex has `|z − (BOARD_TOP + PAINT_LIFT + dz)| ≤ 1e-9`, lies inside the plan, and has the same (x, y) as at rest. `signAt(site, 0)` deep-equals `BLOG_SIGNS[site]`, and `signAt(site, dz).backing` equals the posed board.
  - `src/lab/signs.test.ts` › `level 2 across the heave cycle (#444)`: for each Writing context exhibit, each phase and each scale, `checkSign(signAt(site, dz), scale, crop)` is `[]` and `checkSign(signAt(site, dz), scale, near)` is `[]`. `near` is built as in the existing `near`, with the posed board in place of the rest board.
  - `src/scenes/sea-anim.test.ts` › `no ship piece or launch piece crosses the Writing word at any heave pose (#444)`: the existing probe (lanes every 2 u, the three ship kinds, the launch both ways) against the `signBox(signAt(site, dz))` rects of both sites × 8 phases. Factor the probe into a module-level helper that both tests use.
- [ ] **Step 2: Run** `npx vitest run src/scenes/sign-platform.test.ts src/lab/signs.test.ts src/scenes/sea-anim.test.ts`. Expected: FAIL (`heaveAt`/`signAt` not exported).
- [ ] **Step 3: Implement** in `sign-platform.ts`: the constants and `heaveAt` (decision 1), then `planeAt(c, dz)` and `boardAt(c, dz)`, `signAt(site, dz = 0)` exported with its docstring, and `seaPlatformAt(…, dz = 0)` from `signAt(site, dz)` (decision 4). `BLOG_SIGNS` stays `{ wide: signAt("wide"), tall: signAt("tall") }`.
- [ ] **Step 4: Run** the same command. Expected: PASS, and the existing tests in those files stay green.
- [ ] **Step 5: Commit** `feat(#444): heave pose of the Writing board`.

### Task 2: the animator heaves, `reducedMotion` stills it, `assembleWorld` passes it

**Files:**
- Modify: `src/scenes/platform-animator.ts`, `src/world/assemble.ts:36`, `CONTEXT.md` (the Sign entry: one sentence)
- Modify (callers): `src/lab/crop.test.ts:432,437` (pass `reducedMotion: false`)
- Test: `src/scenes/platform-animator.test.ts` (existing tests updated to `{ reducedMotion: false }`), `src/scenes/animators.test.ts` (add `platformAnimator` to the `animators` table)

**Interfaces:**
- Consumes: `heaveAt`, `HEAVE`, `HEAVE_STEP`, and `seaPlatformAt(…, dz)` from Task 1.
- Produces: `platformAnimator(opts: { site?: WritingSite; reducedMotion: boolean }): PlatformAnimator`. `PlatformAnimator` is unchanged (`site`, `setSite`).

- [ ] **Step 1: The tests are the evals** (committed in `test(#444): evals`), in `platform-animator.test.ts`:
  - With `reducedMotion: false`, `tick(100)` × 67 → every report equals `BOTH`, and there are ≥ 20 of them.
  - Two ticks whose quantized `dz` is equal report nothing. The test keeps its own clock, the sum of the `dtMs` values: `tick(100)` until the first report, then `tick(1)`. It first asserts the precondition, `heaveAt(t)` and `heaveAt(t + 1)` on the same step, and then that the report is empty.
  - After 67 × `tick(100)` (6700 ms, one period), the layers equal the rest pose: the clock wraps without drift.
  - `tick(NaN|Infinity|0|-5)` reports nothing, and afterwards the animator's sequence of 67 × `tick(100)` (reports and layers) equals that of a fresh animator.
  - With `reducedMotion: true`, 10 s of `tick(16.7)` report nothing, and the layers equal `seaPlatformAt(…, site, 0)`. After `setSite("tall")` it reports `BOTH` once, with the tall rest pose.
  - The lights layer is `{ kind: "accent", accents, bloom: false }`, with no `zone`.
  - 10 s of `tick(16.7)` produce ≤ 120 reports.
  - `assembleWorld(undefined, { reducedMotion: true }).platform` reports nothing in 10 s of `tick(16.7)`.
  - Review Focus: `layer()` before a tick is the rest pose. A site change mid-swing gives the layers of `seaPlatformAt(…, newSite, heaveAt(t))`. With `reducedMotion`, a site change is reported with the rest pose of the new site.
  - The existing test "each site is built once" stays as it is (same arrays for the same `(site, dz)`), with `reducedMotion: true`.
- [ ] **Step 2: Run** `npx vitest run src/scenes/platform-animator.test.ts src/scenes/animators.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the clock, `dz`, the seen `(site, step)` pair and the cache keyed by step (decision 2), plus `bloom: false` on the lights. Pass `{ reducedMotion }` in `assembleWorld`. Fix the `crop.test.ts` callers. Add the CONTEXT.md sentence: «The board heaves (`heaveAt`, `HEAVE`: ±0.15 u, 6.7 s, quantized to `HEAVE_STEP`) with its paint as one body, and is still under `reducedMotion`; `signAt(site, dz)` is the sign at a pose.»
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: all green, including `city-budget.test.ts`, `animators.test.ts` and `docs-glossary.test.ts`.
- [ ] **Step 5: Commit** `feat(#444): platformAnimator heaves the board, still with reducedMotion`.

## Grilling

- Rounds: 1. Questions: 17. The plan changed only in wording and three tests, so no second round was run.
- Sources: ISSUE 7, CODE 8, DOC 1, NO SOURCE 4. All four NO SOURCE answers are technical assumptions; there were no spec ambiguities and nothing was out of scope.
- Assumptions: numeric cache keys; red intermediate commits; cache over rebuild; no clamp at the trough (see `## Assumptions`).
- Issues opened: none.
