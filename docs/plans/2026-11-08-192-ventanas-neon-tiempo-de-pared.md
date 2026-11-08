# Window and street-neon timers on wall time (#192): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `createCityAnim` (`src/scenes/city-anim.ts`), the window timer (`city.windows`) and the street-neon flicker timer fire as many events in one long tick as in the same time split into short ticks. Each draws from its own `Rng` stream, and both are counted by `fired()`.

**Architecture:** Each timer gets the `while (timer <= 0) { …; timer += gap }` loop that `blinkTimer` and `signTimer` already use, and its own `createRng(rng.int(0, SEED_MAX))` stream. The streams are derived after `paperRngs`, windows first and then flicker, so the existing draws keep their order. Two counters, `windowEvents` and `flickers`, extend `fired()` to `{ lit, neon, papers, windows, flicker }`. Nothing outside `city-anim.ts` reads `fired()` for the city (checked with `grep -rn "fired()" src`), so the change stays inside that file and its test.

**Tech Stack:** TypeScript strict, Vitest (`npm test`), `npm run typecheck`.

**Spec:** issue #192 and its triage "Agent Brief" comment of 2026-11-08 (expected behaviour, acceptance criteria, out of scope).

## Global Constraints

- Pattern: `while (timer <= 0) { …; timer += <own rng>.int(GAP[0], GAP[1]) }`, the same as `blinkTimer` and `signTimer`.
- Derivation order in `createCityAnim`: `blinkRng`, paper state (shared `rng`), `signRng`, `paperRngs`, then `windowRng`, then `flickerRng`. All of them come from `createRng(rng.int(0, SEED_MAX))`.
- After construction, `tick` draws nothing from the shared `rng`.
- `fired()` returns `{ lit, neon, papers, windows, flicker }`. Under reduced-motion, with `dt <= 0` or with a non-finite `dt`, everything stays at 0 (the existing guard at the top of `tick`).
- Every window event keeps the band rule of today (`target ± tol`, with `tol = max(1, round(0.05·n))`). It is checked against the current lit count, event by event.
- Out of scope: tower blink, signs, papers, `factory-anim`, `sea-anim` (#293), and the values of `WINDOW_GAP_MS` and `FLICKER_GAP_MS`.
- Identifiers, comments and test names are in English, like the rest of the file. No new dependencies.
- `npm test` and `npm run typecheck` are green at the end.

## Declared decisions

1. **`flickerRng` is always derived, even when `scene.lights.flicker === null`.** This keeps the derivation sequence of the shared `rng` the same whether or not there is a street neon. The initial `flickerTimer` is drawn from `flickerRng` only when there is a street neon (otherwise it is `0`, as today).
2. **A flicker fired inside a long tick dims until `clock + NEON_STEP_MS`, where `clock` is the end of the tick.** This mirrors the sign blackout (`s.offUntil = clock + NEON_STEP_MS`). Several flickers in one tick show up as a single dim but are all counted. The acceptance criteria are stated on `fired()`, not on the per-frame alpha.
3. **The window loop is guarded by `wins.length > 0`, and the flicker loop runs only when `street !== null`.** Without that guard, an empty set would loop forever. A timer that is never consumed just keeps going down, as `signTimer` does with no signs.
4. **The sequence that a given seed produces in `windows()` and in the street-neon dim changes compared with today**, because the source stream changes. No test pins the old sequence: the window and flicker tests assert bands, counts and durations.

## Review Focus

1. A long tick with no animatable windows (`lights.windows: []`) must not hang, and must count `fired().windows === 0`. Pinned in Task 1.
2. A long tick with no street neon (`lights.flicker: null`) must not hang, and must count `fired().flicker === 0`. Pinned in Task 2.
3. After a 10 min tick the lit-window count is still within `target ± tol`, both in one tick and chunked. Pinned in Task 1.
4. After a long tick that fires a flicker, the street neon is dim, and the next tick of `NEON_STEP_MS` turns it back on. Pinned in Task 2.
5. One or two animatable windows (`tol = 1`) over a long tick: no exception, and the count stays within target ± 1. Pinned in Task 1, by extending the existing "one or two animatable ones" test with a `tick(600000)`.

Note for executors: stage 3 of the pipeline already commits the failing tests listed below (`test(#192): evals`). Each task's step 1 is therefore "confirm the test exists and fails" rather than writing it.

---

### Task 1: Windows on wall time with their own stream

**Files:**
- Modify: `src/scenes/city-anim.ts`: the `CityAnim.fired` type, the window state after `paperRngs`, the window block in `tick`, and `fired()`.
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Consumes: `createRng`, `SEED_MAX`, `WINDOW_GAP_MS`, plus `chunked` and `repeat` from the tests.
- Produces: `fired(): { lit: number; neon: number; papers: number; windows: number; flicker: number }`. Task 2 fills `flicker`; until then it may return `0`.

- [ ] **Step 1: Failing tests** (in `describe("city-anim: windows and street neon with wall time (#192)")`):
  - `"windows: 60 s and 10 min at once fire the same as chunked into 1000 ms, 100 ms and irregularly"`: for `T` in `[60000, 600000]`, `chunked([T]).fired().windows` equals the same value for `repeat(T/1000, 1000)`, for `repeat(T/100, 100)`, and for an irregular list summing to `T`. Also `chunked([600000]).fired().windows >= 600000 / WINDOW_GAP_MS[1] - 1`.
  - `"windows: with 50 seeds, windows() after [7000] equals after 7 × 1000 ms"`: `expect(chunked([7000], seed).windows()).toEqual(chunked(repeat(7, 1000), seed).windows())` for every seed from 0 to 49.
  - `"windows: after 10 min the lit count stays within target ± tol, at once and chunked"`: for `chunked([600000])` and `chunked(repeat(6000, 100))`, `|windows().length - target| <= tol`.
  - `"windows: a long tick with no animatable windows does not hang and counts nothing"`: with `lights.windows: []`, `tick(600000)` gives `fired().windows === 0`.
  - Extend `"windows: with one or two animatable ones …"`: after the loop, `anim.tick(600000)` keeps `|windows().length - target| <= 1`.
  - Update the existing `fired()` `toEqual` assertions to include `windows: 0, flicker: 0`.
- [ ] **Step 2: Run** `npx vitest run src/scenes/city-anim.test.ts`. Expected: the new windows tests FAIL (`fired().windows` is undefined, or the counts differ).
- [ ] **Step 3: Implement.** Add `const windowRng = createRng(rng.int(0, SEED_MAX))` right after `paperRngs`, and draw the initial `windowTimer` from it. In `tick`, replace `if (windowTimer <= 0 && wins.length > 0)` with `while (windowTimer <= 0 && wins.length > 0)`: the body is the same pick and band check, but uses `windowRng`, ends with `windowTimer += windowRng.int(...)` and `windowEvents++`, and sets `c.windows = true`. Then extend `fired()` and the `CityAnim` type.
- [ ] **Step 4: Run** `npx vitest run src/scenes/city-anim.test.ts src/scenes/city-animator.test.ts`. Expected: everything PASSES except the flicker tests of Task 2.
- [ ] **Step 5: Commit** `feat(#192): windows on wall time with their own stream`.

### Task 2: Street-neon flicker on wall time with its own stream

**Files:**
- Modify: `src/scenes/city-anim.ts`: the street-neon state and the flicker block in `tick`, plus `fired()`.
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Consumes: the `fired()` shape from Task 1, `FLICKER_GAP_MS`, `NEON_STEP_MS`, `FLICKER_ALPHA`.
- Produces: `fired().flicker`, the number of flickers since construction.

- [ ] **Step 1: Failing tests** (same `describe`):
  - `"flicker: 60 s and 10 min at once fire the same as chunked into 1000 ms, 100 ms and irregularly"`: the same shape as the windows test, on `fired().flicker`, plus `chunked([600000]).fired().flicker` within `[600000/FLICKER_GAP_MS[1] - 1, 600000/FLICKER_GAP_MS[0]]`.
  - `"flicker: a long tick with no street neon does not hang and counts nothing"`: with `lights.flicker: null`, `tick(600000)` gives `fired().flicker === 0`.
  - `"flicker: after a long tick that fires, the street neon is dim, and one NEON_STEP_MS later it is back"`: for seeds 0 to 19, run `chunked([FLICKER_GAP_MS[1]], seed)`. The first pause surely runs out inside that tick, so the front of the street neon has alpha `FLICKER_ALPHA`. Then `tick(NEON_STEP_MS)` returns `neon: true`, and if `fired().flicker` did not grow, the front is back at alpha 1. At least one seed must reach that branch. A re-fire inside those 150 ms is legitimate: the long tick can leave a small timer behind.
  - `"fired counts nothing …"`: already updated in Task 1. It must keep `windows: 0, flicker: 0` for reduced-motion, `dt <= 0`, `Infinity` and `NaN`.
- [ ] **Step 2: Run** `npx vitest run src/scenes/city-anim.test.ts`. Expected: the flicker tests FAIL.
- [ ] **Step 3: Implement.** Add `const flickerRng = createRng(rng.int(0, SEED_MAX))` right after `windowRng`, unconditionally. Draw the initial `flickerTimer` from it when `street` exists (otherwise `0`). In `tick`, replace the `if (flickerTimer <= 0)` with `while (flickerTimer <= 0)`: the body sets `flickerUntil = clock + NEON_STEP_MS`, does `flickerTimer += flickerRng.int(...)` and `flickers++`, and sets `c.neon = true`.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all green.
- [ ] **Step 5: Commit** `feat(#192): street-neon flicker on wall time with its own stream`.
