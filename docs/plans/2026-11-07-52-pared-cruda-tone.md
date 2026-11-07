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
- Visual baselines don't change: with `tone: 0` the output is identical. `world-baseline.test.ts` hashes the static solids and accents and must not move. The lit windows are animator layers (`src/scenes/city-anim.ts:104`, `tech-anim.ts` `windows()`) that that file does not hash, so the fingerprints below pin them.
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
- [ ] **Step 3: Extract** `towerWindows` as in Interfaces, still keeping the `.filter(...)`. Run the same command. Expected: only the tone test fails (tone ±1 → 0 windows), which shows that the test catches the bug and not just the missing export.
- [ ] **Step 3b: Remove** the `.filter(...)` line.
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
- [ ] **Step 4: Run** `npx vitest run src/scenes/tech-anim.test.ts src/scenes/world-baseline.test.ts`. Expected: PASS. Also run `grep -rnE "toneOffset *(===|!==|==|!=)|!\s*[a-z.]*toneOffset\b|\{[^}]*\btoneOffset\b[^}]*\} *=" src/city src/scenes --exclude='*.test.ts'`. Expected: only `src/scenes/neighborhood-school.ts:11`, which checks `toneOffset === undefined` when building a plate and is not a wall filter. The hits in `*.test.ts` filter plates and tris, not walls.
- [ ] **Step 5: Commit** `fix(#52): tech tower windows from raw visible walls`.

### Closing (orchestrator, no task)

`npm test` and `npm run typecheck` green.

## Assumptions

Technical decisions, taken without a source in the issue. Each lists the rejected alternative.

1. **Seam for the plaza tower: an exported pure `towerWindows(tower, facade)`.** Rejected: a `tone` parameter on `plazaAndTower`, which would put a production knob for giving the tower a `tone` (out of scope: "Darles `tone` a estas torres"). Also rejected: a test that calls `visibleWalls` plus `facadeAccents` itself, which would not exercise the site's code. Backing: the brief's "Si para poder fijar `tone` hace falta exponer o parametrizar algo, que sea el cambio mínimo."
2. **Equality after 100 ticks in task 2.** The brief asks for the same windows. Comparing after ticks also covers the cached `walls` that the blink reuses. The blink's rng draws depend only on `towers.length` and `floors` (`tech-anim.ts` `tick`), not on the walls, so two animators with `createRng(3)` stay in step.
3. **Pinned fingerprints** (`9f80b655`, `b5014007`) are how "identical with `tone: 0`" becomes executable. `fingerprint` (`src/iso/fingerprint.ts`) is a generic JSON hash with numbers rounded to 1e-6, so it works on `Accent` lists, as `world-baseline.test.ts` already does with `w.accents`.
4. **Tasks are independent.** Each commit is green on its own. Both land before the PR, and if either fails, the run stops at stage 4.

## Grilling

- Rounds: 1 (griller model: fable). There were no substantive changes (no new task and no new seam), so no second round.
- Questions: 14. Sources: CODE 12, ISSUE 3, DOC 1, NO SOURCE 3. All three NO SOURCE answers are technical assumptions: 1, 2 and 4 above. Assumption 3 is CODE-backed.
- Answers in brief:
  1. `facadeAccents` builds `{ kind, pts, color }` with no `toneOffset` (`src/iso/facade.ts:201-204`).
  2. `tone?: number` is declared in `src/iso/solids.ts:31` and added to `toneOffset` in `src/iso/solids.ts:429-431`.
  3. `visibleWalls` strips `facade` and `plates` (`src/iso/solids.ts:441-443`), and a prism's walls carry `s.mat` (`src/iso/solids.ts:405-409`, `extrude` at `src/iso/solids.ts:71`).
  4. Brief: "misma cantidad y mismos puntos", "con `tone: 0` el resultado tiene que ser idéntico", "que sea el cambio mínimo".
  5. `TechScene` is at `src/scenes/tech.ts:38`. The animator only reads it, and `{ ...t.facade, litFloor }` is a copy.
  6. The blink only uses `dtMs` and `blinkRng`.
  7. See `src/iso/fingerprint.ts:9-14`.
  8. Corrected in the constraints: `world-baseline` does not hash the windows.
  9. `built()` is at `fixed.test.ts:250`, and the facade is on the prism (`src/scenes/city-pieces.ts:23`).
  10. Added step 3 (red with the filter still in place).
  11. The grep was broadened.
  12. The imports are at `fixed.ts:1-4`, and `facadeAccents(walls, facade, "amber")` is at `fixed.ts:38`.
  13. See assumption 4.
  14. DOC: `CONTEXT.md` has no entry for walls or tone. The English guard (`src/english.test.ts:171-172`) scans `src/` and `lab/`, not `docs/plans`. The Unicode minus already appears in `fixed.test.ts:145`.
- Issues opened: none. Spec ambiguities: none.
