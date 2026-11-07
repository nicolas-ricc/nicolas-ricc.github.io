# Raw walls independent of `tone` (#52): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the plaza tower (`src/city/fixed.ts`) and the tech-district towers (`src/scenes/tech-anim.ts`) find their lit windows with `visibleWalls(...)` alone, so the windows are the same for any `tone` on the solid.

**Architecture:** since #38, `visibleWalls` (`src/iso/solids.ts:441`) strips `facade` and `plates` before it tessellates, so it already returns only the raw visible walls. The extra `.filter((f) => f.mat === ... && f.toneOffset === 0)` dates from when tessellation mixed walls with facade faces. `tessellateAll` adds `s.tone` to every face's `toneOffset`, so with `tone` ≠ 0 the filter drops every wall. Both filters go. In `fixed.ts` the window math moves into a small exported pure function so a test can feed it a tower with `tone`. That is the minimal exposure the brief allows. `tech-anim.ts` already receives the towers in `TechScene`, so its test can set `tone` on `scene.towers[k].box` without any production change.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #52, brief of 2026-11-07 ("Reemplaza los briefs anteriores").

## Global Constraints

- Neither `src/city/` nor `src/scenes/` filters faces by `toneOffset` to find walls. Uses of `toneOffset` in tests under `src/iso/` don't count.
- One test per site, in `src/city/fixed.test.ts` and `src/scenes/tech-anim.test.ts`: build the tower with `tone` −1, 0 and 1 and get the same windows (same count, same points).
- If setting `tone` needs something exposed or parametrized, it is the minimal change.
- Existing tests keep passing with their thresholds untouched: `fixed.test.ts` (`litWindows` with 8 windows, position of `paperWindow`), `city-anim.test.ts`, `lights.test.ts`, `tech-anim.test.ts`.
- Visual baselines don't change: with `tone: 0` the output is identical (`world-baseline.test.ts` hashes do not move).
- Out of scope: moving the towers to the kit or making them publish `walls`/`windows`; giving these towers a `tone`; changing `visibleWalls` or `facadeFaces`.
- `npm test` and `npm run typecheck` green.

## Measured on `main` (5f893d9), before any change

- Plaza tower: `fingerprint(litWindows)` = `9f80b655`, 8 windows, `paperWindow` = `{ x: 137, y: 232.25, z: 20.625 }` (`plazaAndTower(..., createRng(7))`).
- Tech district: `fingerprint(createTechAnim(tech(createRng(7)), createRng(3), { reducedMotion: false }).windows())` = `b5014007`, 374 windows, 33 towers. With `tone: 1` on every tower box: **0** windows (the bug).

`fingerprint` is `src/iso/fingerprint.ts`, used through `(v) => fingerprint(v as Solid[])` as in `world-baseline.test.ts`. These hashes pin "identical with `tone: 0`".

## Review Focus

1. **`tone: 0` output moves.** If the walls were reordered or a wall of another material slipped in, windows would shift. Pinned by the fingerprints above, in both tasks.
2. **Non-integer or out-of-range `tone`.** `tone` is a plain `number` added to `toneOffset`, so −1/0/1 cover the sign cases. Window geometry never reads `toneOffset`, so any value behaves the same. No extra test.
3. **The paper window picks the east wall.** `walls.find((f) => f.normal.x > 0.5)` must still find it with `tone` ≠ 0. Covered: the task 1 test compares `paperWindow` across tones.
4. **Tech towers whose floor turns off or moves.** The blink reuses the cached walls, so the same walls must hold after ticks. Covered by the existing tick tests and by the task 2 test comparing `windows()` after ticks.
5. **A future tower whose material differs from its walls' material.** Dropping the `mat` filter is safe because `visibleWalls` of a prism yields only the prism's own `mat`. That is guarded indirectly by the fingerprints. No extra test.

---

### Task 1: plaza tower windows via `towerWindows`

**Files:**
- Modify: `src/city/fixed.ts:16-39`
- Test: `src/city/fixed.test.ts` (inside `describe` of the plaza, next to "the tower as before…", line ~276)

**Interfaces:**
- Produces: `export function towerWindows(tower: Solid, facade: Facade): { litWindows: Accent[]; paperWindow: Vec3 }` in `src/city/fixed.ts`. Body: `const walls = visibleWalls(tower)`, then the existing `facadeAccents(walls, facade, "amber")` and the `east`/`windowPatches`/`centroid` lines unchanged. `plazaAndTower` calls it with its `tower` and `facade` and spreads the result into its return. Docstring: one line saying it uses the raw visible walls, so `tone` does not matter.

- [ ] **Step 1: Write the failing tests** in `fixed.test.ts`:
  - `"towerWindows: tone −1, 0 and 1 give the same windows"`: take `tower` = the prism with `mat === "officeDark"` and a `facade` from `built().solids` (the only one). For `tone` in `[-1, 0, 1]`, `towerWindows({ ...tower, tone }, tower.facade!)` has `litWindows` of length 8 and `toEqual` the `tone: 0` result (`litWindows` and `paperWindow`).
  - `"towerWindows with tone 0 is what plazaAndTower publishes, unchanged from main"`: `towerWindows(tower, tower.facade!)` `toEqual` `{ litWindows: built().tower.litWindows, paperWindow: built().tower.paperWindow }`; `fingerprint(litWindows as Solid[])` is `"9f80b655"`; `paperWindow` `toEqual` `{ x: 137, y: 232.25, z: 20.625 }`.
- [ ] **Step 2: Run** `npx vitest run src/city/fixed.test.ts`. Expected: FAIL, because `towerWindows` is not exported.
- [ ] **Step 3: Implement** `towerWindows` as in Interfaces and remove the `.filter(...)` line.
- [ ] **Step 4: Run** `npx vitest run src/city/fixed.test.ts src/scenes/city-anim.test.ts src/city/lights.test.ts src/scenes/world-baseline.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(#52): plaza tower windows from raw visible walls`.

### Task 2: tech towers without the `toneOffset` filter

**Files:**
- Modify: `src/scenes/tech-anim.ts:35`
- Test: `src/scenes/tech-anim.test.ts`

**Interfaces:**
- Consumes: `TechScene.towers: { box: Solid & { kind: "prism" }; facade: Facade }[]` (`src/scenes/tech.ts:37`), unchanged.
- Produces: nothing new. Line 35 becomes `const walls = scene.towers.map((t) => visibleWalls(t.box));`.

- [ ] **Step 1: Write the failing tests** in `tech-anim.test.ts`:
  - helper `withTone(tone: number)`: `{ ...scene, towers: scene.towers.map((t) => ({ ...t, box: { ...t.box, tone } })) }` over `tech(createRng(7))`.
  - `"tone −1, 0 and 1 on the towers give the same windows, at frame 0 and after the blink"`: for each tone, `createTechAnim(withTone(tone), createRng(3), { reducedMotion: false })`. Its `windows()` has length 374 and `toEqual` the `tone: 0` animator's. After `tick(100)` × 100 on both, still `toEqual`.
  - `"windows at frame 0 unchanged from main"`: `fingerprint(setup().anim.windows() as Solid[])` is `"b5014007"`.
- [ ] **Step 2: Run** `npx vitest run src/scenes/tech-anim.test.ts`. Expected: FAIL (tone ±1 → 0 windows).
- [ ] **Step 3: Implement**: drop the `.filter(...)` on line 35.
- [ ] **Step 4: Run** `npx vitest run src/scenes/tech-anim.test.ts src/scenes/world-baseline.test.ts`. Expected: PASS. Also run `grep -rnE "toneOffset *===" src/city src/scenes`. Expected: no output.
- [ ] **Step 5: Commit** `fix(#52): tech tower windows from raw visible walls`.

### Closing (orchestrator, no task)

`npm test` and `npm run typecheck` green.
