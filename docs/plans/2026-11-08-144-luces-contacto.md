# Lights on touching faces and back-facing neons (#144): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lights()` stops lighting windows that sit on a face covered by another solid in contact (same piece or a neighbour), and stops turning neon slots whose wall faces away from the camera into `StreetNeon`s.

**Architecture:** the occlusion of `lights()` (`src/city/lights.ts:41-57`, `occluded`) uses `hides()`, which needs strict separation: the 0.05 pad of `lightBox` makes `isBehind` fail when a window touches the face of a neighbour, and `hullsOverlap` does not count grazing. The brief forbids changing `hides()`/`isBehind()` (ships and train rely on contact not counting), so `lights()` gets a second, independent filter: a window is *covered* when its centroid lies on the box of a solid other than its own building, i.e. inside the box's x/y range (border included) and strictly inside its z range. Candidates are the windows neither `occluded` nor covered; the per-neighbourhood quotas are already computed over the candidates (`lights.ts:75-86`), so they follow. Neon slots get one more condition next to the open-side check (`lights.ts:98`): `slot.wall.x <= 0 && slot.wall.y <= 0` discards the slot.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #144, triage "Agent Brief" comment of 2026-11-08 (behaviour, acceptance criteria, out of scope).

## Global Constraints

- `hides()`, `isBehind()` and `hullsOverlap()` in `src/iso/depth.ts` keep their semantics (no edit to their code).
- Covered = centroid `c` of `window.pts` against box `b` of a solid other than the window's own building (`p.solidOffset + window.building`): `b.min.x - EPS <= c.x <= b.max.x + EPS`, same for y, and `b.min.z + EPS < c.z < b.max.z - EPS`, with `EPS = 1e-6` (the module constant). The box is `bounds(solid)` (`src/iso/solids.ts`), the same the occlusion already uses.
- Neon slots with `wall.x <= 0 && wall.y <= 0` never produce a `StreetNeon`, whatever `lot.open` says.
- Windows on free faces do not change: they stay candidates, with the same quota key they draw today (keys are drawn over the not-occluded windows *before* the covered filter), so only the quota boundary moves (`round(on · n)` with the smaller `n`). The existing tests of `lights.test.ts` stay as they are.
- Changed hashes in `src/scenes/world-baseline.test.ts` are re-recorded only where the lights change (the `accents` of `WORLD`, `ZONES.cv`, `RESUME_LAB`), with a `// #144:` comment line, and justified in the PR with before/after screenshots.
- Out of scope: changing `hides()`/`isBehind()`, more open frontages for bars (#165), occlusion of the fixed pieces' lights (#171).
- `npm test` and `npm run typecheck` green.

## Measured on `main` (3c486ea), before any change

Oracle above, own building excluded, over `scene.lights.windows`:

- World seed (`city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3))`): 1180 candidates, 539 lit; 53 candidates and **34 lit** windows covered. The brief says 29; its count used a slightly different tolerance. Covering solids: same piece in every case (`courtyardO` 34, `courtyardU` 11, `patioResidential` 3, `shopRow` 2, `station` 2, `theatre` 1).
- Other seed (`city(createRng(7), createRng(8), createRng(9))`): 1316 candidates, 576 lit; 41 candidates and **19 lit** covered. 8 of them are `courtyardU` windows inside the box of a tree (`cone`, `leafDark`) of another piece.
- Neon slots with `wall.x <= 0 && wall.y <= 0`: 0 in both seeds. So the neon filter does not move any hash.

## Acceptance criteria → tasks

- Seed test (world seed and seed 7/8/9): no lit window covered: task 1.
- Synthetic test, two prisms of the same piece touching in y: task 1.
- Synthetic test, `neon` slot with `wall` (0,-1,0) or (-1,0,0) on an open side: task 2.
- Quota tests still pass, over the visible candidates: task 1 step 4 (existing tests, unchanged).
- `world-baseline.test.ts` hashes updated: task 1 step 5; screenshots: task 3.
- `npm test` and `npm run typecheck` green: end of tasks 1 and 2.

## Assumptions

- The filter lives in `lights()`, not in `addBuilding()`: `addBuilding` only sees its own piece, and the brief asks for neighbours too ("sea de la misma pieza o de una vecina"). The brief allows either ("No se publica, o no se enciende").
- The centroid decides: a window half on the covered part counts as covered if its centroid is. That is the oracle of the first criterion.
- Any solid counts, including trees and non-prism solids, through its AABB, because the criterion is stated on the box. A window inside a tree's box is behind foliage anyway.
- Brute force (windows × solids) for the covered test: ~1300 × a few thousand box comparisons, once per city build. The sweep in `occluded` is not reused because covered is not a screen-space relation.
- Neons do not get the covered test: the brief asks it only of windows, and slots stand 0.4 in front of their wall.
- The stage-3 evals write the failing tests of tasks 1 and 2 ahead of the implementation; in stage 4 step 1 of each task is "confirm the test exists and fails".
- No `CONTEXT.md` entry and no ADR: no new domain term (`CONTEXT.md` has no hidden/occluded entry either; "covered" stays a docstring word in `lights.ts`).
- Quota keys are drawn before the covered filter (grilling Q1): the brief wants quotas "recalculados sobre las candidatas visibles" and free windows unchanged; drawing keys after the filter would shift every later key and relight the whole city. Rejected: drawing keys over the filtered list (today's code shape).
- No build-time budget is documented; `city()` runs once per `world()` build (`src/scenes/world.ts:62`). Brute force accepted; the implementer reports `lights()` time before/after in the task report.
- The seed test asserts an empty offender list, so the 29 vs 34 count difference does not matter; the oracle follows the brief's words ("borde incluido", "estrictamente dentro de su rango z") with `EPS = 1e-6` for float noise.

## Review Focus

1. **Own building exempt.** Every window's centroid is on its own building's face; forgetting the exclusion empties the city. Pinned: the existing "with nothing in front, the window is a candidate" test and `on.length > 100` in the seed tests.
2. **Free faces untouched.** A solid that only touches the window's face along an edge (a neighbour beside it, or a roof whose `min.z` equals the wall top) must not cover it: z is strict. Pinned: task 1 synthetic test, the protruding windows stay.
3. **Quotas over the new candidates.** `counts` and the lit percentage use the filtered list. Pinned: existing "counts match" and "lit percentage" tests.
4. **Neon filter on both axes.** `wall.x <= 0 && wall.y <= 0` must discard both (0,-1,0) and (-1,0,0) but keep (0,1,0) and (1,0,0). Pinned: task 2 test plus the existing corner-shop test (east wall `(1,0,0)` kept).
5. **Baseline moves only accents.** Solids, ground and render list hashes must not change. Pinned: task 1 step 5.

---

### Task 1: windows on a covered face are not candidates

**Files:**
- Modify: `src/city/lights.ts` (module docstring; candidate filter around line 71-73)
- Modify: `src/scenes/world-baseline.test.ts` (accents hashes of `WORLD`, `ZONES.cv`, `RESUME_LAB`)
- Test: `src/city/lights.test.ts`

**Interfaces:**
- Produces: no new export. `lights()` keeps its signature; `CityLights.windows` and `counts` now exclude covered windows.

- [ ] **Step 1: Write the failing tests** in `lights.test.ts`:
  - Inside the `for (const [name, make, isWorld] of SEEDS)` describe: `"no lit window sits on the face of another solid (centroid in its x/y range, strictly inside its z)"`: for every `w` of `l.windows.filter((w) => w.on)`, with `c = centroid(w.window.pts)`, no `i !== ownSolid(w)` such that `bs[i]` contains `c` per the oracle of Global Constraints. Assert the list of offending windows is empty (`toEqual([])`, so the failure shows how many).
  - In `describe("lights (synthetic scenes)")`: `"two touching prisms of the same piece: covered windows of the back one are not candidates, the protruding ones are"`: piece with `prism(0, 0, 0, 12, 10, 10)` (building 0) and `prism(0, 10, 0, 6, 4, 10)` (building 1, touching its +y face on x 0..6); windows of building 0 on its +y face (y = 10, `wall` (0,1,0)): `quad(1, 3, 10, 2, 4)` and `quad(3.5, 5.5, 10, 2, 4)` (covered) and `quad(8, 10, 10, 2, 4)` (protruding). `lights(...)` in `downtown`: `l.windows.map((w) => w.window)` equals the protruding window only, and `l.counts.downtown.candidates === 1`.
- [ ] **Step 2: Run** `npx vitest run src/city/lights.test.ts`. Expected: FAIL (world seed 34 offending windows, other seed 19; synthetic 3 windows instead of 1).
- [ ] **Step 3: Implement** in `lights.ts` a private `covered(c: Vec3, own: number, boxes: Bounds[]): boolean` with the Global Constraints oracle, and filter candidates with `!covered(centroid(w.pts), own, boxes)` *after* drawing the quota keys over the not-occluded windows (`vis`), keeping each window paired with its key, so the rng sequence and the keys of free windows do not move. Update the module docstring: what is hidden (`hides`) or covered (centroid on another solid's box, contact included) is not published.
- [ ] **Step 4: Run** `npx vitest run src/city`. Expected: PASS, including the unchanged quota tests.
- [ ] **Step 5: Re-record the baseline:** run `npx vitest run src/scenes/world-baseline.test.ts`; only the `accents` of `WORLD`, `ZONES.cv` and `RESUME_LAB` may differ. Update those three values and add `// #144: windows on faces covered by a touching solid are not lit; accents re-recorded once.` above `WORLD`. If any other hash moves, stop and report.
- [ ] **Step 6: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 7: Commit** `fix(#144): windows on faces covered by a touching solid are not lit`.

### Task 2: neon slots facing away from the camera are discarded

**Files:**
- Modify: `src/city/lights.ts:98` (slot filter) and the comment above the neon block
- Test: `src/city/lights.test.ts`

**Interfaces:**
- Consumes: nothing from task 1.

- [ ] **Step 1: Write the failing test** in `describe("lights (synthetic scenes)")`: `"neons: a slot whose wall faces away from the camera produces no neon, even on an open side"`: bars piece `prism(0, 0, 0.3, 24, 18, 6)`; slots `{ pts: quad(10, 12, 0, 2.7, 3.9), wall: v3(0, -1, 0), side: "n", kind: "neon", shop: 0 }` and `{ pts: [v3(0, 8, 2.7), v3(0, 10, 2.7), v3(0, 10, 3.9), v3(0, 8, 3.9)], wall: v3(-1, 0, 0), side: "w", kind: "neon", shop: 1 }`, lot open `["n", "w"]`. Expect `l.neons` to equal `[]`.
- [ ] **Step 2: Run** `npx vitest run src/city/lights.test.ts -t "faces away"`. Expected: FAIL (2 neons today: the slots sit on their wall, so `hides` does not drop them).
- [ ] **Step 3: Implement**: in the slot loop, `continue` also when `slot.wall.x <= 0 && slot.wall.y <= 0`; mention it in the comment above ("open frontage facing the camera").
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS, baseline unchanged by this task.
- [ ] **Step 5: Commit** `fix(#144): neon slots facing away from the camera are discarded`.

### Task 3: before/after screenshots

**Files:**
- Create: `docs/superpowers/specs/assets/144-covered-windows/{patio,courtyard}-{before,after}.png`

Run by the orchestrating session (it owns `.scratch/evals-144.md`), not by a fresh implementer.

- [ ] **Step 1:** With the dev server, capture `http://localhost:5173/lab/resume.html` zoomed on the `patioResidential` window at (32.25, 176, 1.8) and the `courtyardO` window at (104.1, 175.5, 1.8), before (worktree of `origin/main`, another port) and after. Follow `.scratch/evals-144.md`.
- [ ] **Step 2: Commit** `docs(#144): before/after screenshots of covered windows`.

## Grilling

- Rounds: 1 (griller model: fable). Questions: 17. The revision (quota keys drawn before the covered filter) does not change tasks or seams, so no second round.
- Sources: CODE 9, ISSUE 4, DOC 0, NO SOURCE 4 (all technical assumptions; no spec ambiguity, nothing out of scope).
  CODE answers: `city.ts:63-66` is the only consumer that turns `CityLights.windows` into drawing (lit, non-animable → accents) and `city-anim.ts:82` takes the animable ones; unlit windows draw nothing (the facade comes from the solid's `facade`, `src/iso/solids.ts:19-22`), so only accents hashes can move; `world.ts:62` builds the single city with `zoneRng(seed, "cv")` whenever `cv` is in the zones, so `WORLD`, `ZONES.cv` and `RESUME_LAB` share it and `portfolio`/`blog` do not include it; `lights.test.ts:15-16,35-36` already define `prism`, `quad`, `bs`, `ownSolid` and `centroid` is `src/iso/geometry.ts:27`; `lights()` receives every city solid (`city.ts:63`), and the `station`/`theatre` covering cases are kit recipes covered by their own piece, not #171's fixed pieces; plinths span z 0..0.3 (`city.ts:44`) and the lifted windows sit above the lot, so a plinth cannot contain a centroid strictly in z (the measurement lists no `paving` covering solid); `piece.ts:22-28` publishes windows per solid only for walls with `x > 0 || y > 0`, the same camera convention as the neon rule; tasks run one at a time under subagent-driven-development, task 1 committed before task 2; a red step 5 is reverted with `git restore`; `docs/superpowers/specs/assets/142-plinth-ground/` and `195-ferry-fender/` are the precedent for PNGs (`.gitattributes` only marks `*.pdf`).
  ISSUE answers: the oracle ("dentro del rango x/y de su caja (borde incluido) y estrictamente dentro de su rango z"), same-piece covering ("sea de la misma pieza o de una vecina"), the neon rule (`wall.x <= 0 && wall.y <= 0`) and the screenshot coordinates (32.25, 176, 1.8) and (104.1, 175.5, 1.8), measured on the world seed, which is the city of `lab/resume.html`.
- Assumptions: see `## Assumptions` (quota keys, brute force, oracle tolerance, tree boxes).
- Issues opened: none.
- Status: ok.
