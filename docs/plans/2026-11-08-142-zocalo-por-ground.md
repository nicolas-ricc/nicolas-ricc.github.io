# Block plinth decided by `ground` presence (#142): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** one kit helper runs a recipe once on the street-level lot and decides from the resulting piece whether it rests on a `PLINTH_H` plinth (no `ground`: lifted by `PLINTH_H`) or at street level (brings `ground`); the city and the kit lab use it and `NO_PLINTH` goes away.

**Architecture:** the painter's order paints `ground` before every solid, so a plinth prism hides the floor of a recipe that brings `ground`. Today `assign` (`src/city/zoning.ts:136`) fixes `lot.z` from the name list `NO_PLINTH` and `city()` (`src/scenes/city.ts:43`) pushes the plinth from the same list, so `courtyardO` with a paved patio and `library` (tiles patio) lose their floor. The kit contract (`src/kit/kit.test.ts:153`, "with lot.z = 0.3 the output is that of lot.z = 0 shifted 0.3 in z") makes it valid to build at z 0 and lift afterwards, so the helper can decide after a single call, which matters because the city's rng is shared. `assign` stops deciding: it builds every lot at street level (`z: 0`); `city()` stores the resolved lot in `PlacedPiece.placed`, which is what the lights (`neonSlots`, `puddle`) and the water tower read.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #142, triage "Agent Brief" comment of 2026-11-08 (behaviour, acceptance criteria, out of scope).

## Global Constraints

- The helper calls the recipe **exactly once**.
- No `ground` → piece lifted exactly `PLINTH_H` in z and `plinth: true`; with `ground` → street level and `plinth: false`.
- `city()` pushes the plinth prism (`prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving")`) only when `plinth` is true, and before the piece's solids (same solid order as today, so the hashes of unaffected blocks do not move).
- `Placed.lot.z` seen by the lights (`scene.placed[i].placed.lot.z`) is the resolved z.
- `kitScene`: same helper; the `LAB_LOTS` lots with their own `z` (footbridge) keep no plinth and are not lifted.
- `NO_PLINTH` disappears (no symbol, no use in tests).
- Out of scope: `postZ` of the streets, the tech district (`src/scenes/tech.ts`), moving `PLINTH_H` out of `src/scenes/city-pieces.ts`.
- The changed `world-baseline.test.ts` hashes are re-recorded only for the expected change (courtyardO paved patios and library), justified in the PR with before/after screenshots.
- `npm test` and `npm run typecheck` green.

## Measured on `main` (860a582), before any change

`city(createRng(s), createRng(s + 1), createRng(s + 2))`, pieces with `ground.length > 0` and their `lot.z`:

- s = 1: `courtyardO@0.3` ×2, `library@0.3`; s = 2: `courtyardO@0.3`, `library@0.3`; s = 3: `library@0.3`; s = 4: `courtyardO@0.3`, `library@0.3`; s = 5: `library@0.3`. Total 9 on seeds 1..5 (as the brief says).
- `eatenRuin` and `campus` always bring `ground` (every occurrence above is `@0`), and no piece without `ground` sits at z 0. So for every other recipe the new rule reproduces today's output, and `eatenRuin`/`campus` keep no plinth.

## Names

- `liftPiece(p: Piece, dz: number): Piece` and `seat(recipe: Recipe, lot: Lot, rng: Rng, style: Style): Seated`, with `export interface Seated { piece: Piece; lot: Lot; plinth: boolean }`, in `src/kit/piece.ts`. `Seated.lot` is the lot the piece rests on (`{ ...lot, z: lot.z + PLINTH_H }` or `lot` itself).

## Review Focus

1. **Lifting misses a coordinate.** A piece has z in solids (every `Solid` kind), ground, accents, windows, walls, slots and `landmarkTop`. A z left behind would leave a window or a neon 0.3 below its wall. Pinned: task 1 test compares `liftPiece` with the recipe run at `lot.z + PLINTH_H` for every registered recipe (the same oracle as the kit contract test), and normals (`wall`, `normal`) must not move.
2. **The rng sequence shifts.** If `city()` called the recipe twice or moved the sign draw, every block after it would change. Pinned: the hashes of all blocks without `ground` stay the same (task 2: only the courtyardO/library-related hashes move, checked by the per-seed test that every no-ground piece is identical to `main`'s rule), and task 1 counts calls.
3. **Lights read the street-level lot.** If `PlacedPiece.placed.lot.z` stayed 0 for lifted pieces, neons of every plinth block would be filtered out by `NEON_Z`. Pinned: existing `src/city/lights.test.ts` (neon height relative to `placed.lot.z`) plus task 2's assertion that `placed.lot.z` is `PLINTH_H` iff a plinth prism sits under it.
4. **Water tower host.** `waterTowerLot(court, host.placed.lot.z)` must keep the tank on the patioResidential plinth. Pinned: existing city test "water tower in the courtyard…" and the tank z assertion added in task 2.
5. **Lab lots with their own z.** The footbridge (`LAB_LOTS.footbridge.z = -1`) must not be lifted nor get a plinth; the water tower (no own z) keeps its 6×6 plinth. Pinned: existing kit-scene tests, kept.

---

### Task 1: `liftPiece` and `seat` in the kit

**Files:**
- Modify: `src/kit/piece.ts` (next to `fitToCap`)
- Test: `src/kit/piece.test.ts`

**Interfaces:**
- Produces: `liftPiece(p: Piece, dz: number): Piece` (new object; every z coordinate + dz; normals `Window.wall`, `Slot.wall`, `Wall.normal` untouched; `courtyard` (a `Rect`, no z) copied as is; does not mutate `p`). `seat(recipe, lot, rng, style): Seated` (calls `recipe(lot, rng, style)` once; if `piece.ground.length > 0` returns `{ piece, lot, plinth: false }`, else `{ piece: liftPiece(piece, PLINTH_H), lot: { ...lot, z: lot.z + PLINTH_H }, plinth: true }`). `PLINTH_H` imported from `../scenes/city-pieces` (the forms already do so).

- [ ] **Step 1: Write the failing tests** in `piece.test.ts`, new `describe("seat")`:
  - `"liftPiece matches the recipe run PLINTH_H higher, for every recipe"`: for each `def` of `RECIPES` and seeds `[1, 2, 3]`, with `lot = { x: 0, y: 0, w: LAB_LOTS[def.name]?.w ?? 24, d: LAB_LOTS[def.name]?.d ?? 18, z: 0, open: ["s", "e"], maxH: 24 }`: `rounded(liftPiece(def.recipe(lot, createRng(seed), STYLES.downtown), PLINTH_H))` equals `rounded(def.recipe({ ...lot, z: PLINTH_H }, createRng(seed), STYLES.downtown))`, `rounded` = JSON with numbers rounded to 1e-6 (as in `kit.test.ts`).
  - `"liftPiece does not move normals and does not mutate its input"`: a hand-built piece with one prism, one dot accent, one window, one wall, one slot; after `liftPiece(p, 2)` the `wall`/`normal` vectors are equal to the input's and `p` is deep-equal to a `structuredClone` taken before.
  - `"a piece without ground comes out lifted exactly PLINTH_H, on a plinth"`: a counting recipe `(l) => { calls++; const p = emptyPiece(); p.solids.push(prism(l.x, l.y, l.z, 4, 4, 6, "stone")); return p; }` on a lot with z 0: `calls === 1`, `plinth === true`, `seated.lot.z === PLINTH_H`, solid `at.z === PLINTH_H`.
  - `"a piece with ground stays at street level, without plinth"`: same recipe plus `p.ground.push(prism(l.x, l.y, l.z + 0.05, 4, 4, 0, "paving"))` (any `Solid` in `ground` counts): `calls === 1`, `plinth === false`, `seated.lot` `toBe` the input lot, solid `at.z === 0`.
- [ ] **Step 2: Run** `npx vitest run src/kit/piece.test.ts`. Expected: FAIL (`liftPiece`/`seat` not exported).
- [ ] **Step 3: Implement** both in `src/kit/piece.ts`. `liftPiece` maps each `Solid` kind's z like `fitToCap`'s `solid` mapper does (with a shift instead of a scale; `h` unchanged), plus accents, windows/walls/slots `pts`, `landmarkTop`. One-line docstrings citing the kit contract.
- [ ] **Step 4: Run** `npx vitest run src/kit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#142): seat, a recipe on its plinth decided by ground`.

### Task 2: zoning at street level and `city()` through `seat`

**Files:**
- Modify: `src/city/zoning.ts:100-101,136` (drop `NO_PLINTH`; lot `z: 0`; update the `assign` docstring: the lot is at street level, `city()` seats it)
- Modify: `src/scenes/city.ts:12,41-48`
- Modify: `src/scenes/world-baseline.test.ts` (hashes)
- Test: `src/city/zoning.test.ts:9,117`, `src/scenes/city.test.ts`

**Interfaces:**
- Consumes: `seat`, `Seated` (task 1).
- Produces: `PlacedPiece.placed.lot` is the resolved lot (`Seated.lot`); `Placed.lot.z` from `assign` is always 0.

- [ ] **Step 1: Write the failing tests.**
  - `zoning.test.ts`: drop `NO_PLINTH` and `PLINTH_H` from the imports if unused; line 117 becomes `expect(p.lot.z).toBe(0); // street level: city() decides the plinth (seat)`.
  - `city.test.ts`, new `it("plinth by ground presence, seeds 1..5: no ground piece on a plinth, eatenRuin and campus without one, placed.lot.z is the resolved z")`: for `s` in 1..5, `c = city(createRng(s), createRng(s + 1), createRng(s + 2))`; for each `q` of `c.placed` with block `b = q.placed.block`, `onPlinth = c.solids.some(x => x.kind === "prism" && x.mat === "paving" && x.at.x === b.x && x.at.y === b.y && x.at.z === 0 && x.w === b.w && x.d === b.d && x.h === PLINTH_H)`; expect `onPlinth === (q.piece.ground.length === 0)`, `q.placed.lot.z === (onPlinth ? PLINTH_H : 0)`; if the recipe is `eatenRuin` or `campus`, `onPlinth === false`. Across all seeds, at least one `courtyardO` with ground and one `library` were seen, both with `onPlinth === false`.
  - Same test, water tower: the copper dome (`r === 2.2`) `at.z` is above `PLINTH_H` (host stays on its plinth): keep or add next to the existing water-tower test, asserting `host.placed.lot.z === PLINTH_H`.
- [ ] **Step 2: Run** `npx vitest run src/city/zoning.test.ts src/scenes/city.test.ts`. Expected: FAIL (lot.z is 0.3; library on plinth).
- [ ] **Step 3: Implement.** `city()`: for each `p` of `assign(...)`: `const seated = seat(recipe(p.recipe), p.lot, r, { ...STYLES[p.neighborhood], tone: p.tone })`; if `seated.plinth` push the plinth prism; then `placed.push({ placed: { ...p, lot: seated.lot }, piece: seated.piece, solidOffset: solids.length })`, `add(seated.piece)`, and the sign loop unchanged after it. Drop `NO_PLINTH` from zoning.ts and city.ts.
- [ ] **Step 4: Run** `npx vitest run src/city src/scenes/city.test.ts src/scenes/city-anim.test.ts`. Expected: PASS (lights tests unchanged and green).
- [ ] **Step 5: Re-record baseline.** Run `npx vitest run src/scenes/world-baseline.test.ts`; only entries that include the cv zone (`WORLD`, `ZONES.cv`, `RESUME_LAB`) may differ, and only `solids`/`ground`/`accents`/`renderList` of those. `ZONES.portfolio`, `ZONES.blog` and `PIECES` must be unchanged; if they move, stop and find out why. Update the moved hashes and add a comment line above `WORLD`: `// #142: library and paved courtyardO patios lose their plinth (ground decides it); re-recorded once.`
- [ ] **Step 6: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 7: Commit** `fix(#142): city plinth by ground presence, NO_PLINTH gone`.

### Task 3: `kitScene` through `seat`

**Files:**
- Modify: `src/lab/kit-scene.ts:14-34`
- Test: `src/lab/kit-scene.test.ts`

**Interfaces:**
- Consumes: `seat` (task 1).

- [ ] **Step 1: Write the failing test** in `kit-scene.test.ts`: `"each recipe is called once per lot"`: in a new test file `src/lab/kit-scene-calls.test.ts` (so the mock does not affect the others), `vi.mock("../kit/index", async (orig) => { const m = await orig<typeof import("../kit/index")>(); return { ...m, RECIPES: m.RECIPES.map((d) => ({ ...d, recipe: (...a: Parameters<typeof d.recipe>) => { calls[d.name] = (calls[d.name] ?? 0) + 1; return d.recipe(...a); } })) }; })` with `calls` from `vi.hoisted(() => ({} as Record<string, number>))`; `kitScene(s, "downtown")` for seeds `s` in 1..5: after each, every value of `calls` is 1 (reset between seeds). Must fail today on seeds where `courtyardO`, `campus`, `eatenRuin` or `library` bring ground.
- [ ] **Step 2: Run** `npx vitest run src/lab`. Expected: the new test FAILS (count 2).
- [ ] **Step 3: Implement.** The lot is built at `z: own?.z ?? 0`. If `own?.z !== undefined`, call `def.recipe` directly (no plinth, no lift); otherwise `seat(def.recipe, lot, rng, STYLES[style])` and push the plinth prism `prism(lot.x, lot.y, 0, w, d, PLINTH_H, "paving")` when `plinth`. Update the docstring: plinth decided by `seat` (ground presence); the sentence about calling the recipe twice goes. In the existing test "standard lots of recipes without ground…", `hasGround` may keep calling the recipe (it is the test's oracle) but on a lot with `z: 0`.
- [ ] **Step 4: Run** `npx vitest run src/lab && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(#142): kitScene seats recipes with seat, one call each`.

### Task 4: before/after screenshots

**Files:**
- Create: `docs/superpowers/specs/assets/142-plinth-ground/{library,courtyard}-{before,after}.png`

- [ ] **Step 1:** With the dev server (`npm run dev -- --host --port 5173`), capture `http://localhost:5173/lab/resume.html` zoomed on the library block (42, 242) before (worktree of `origin/main`) and after, and the same for a paved `courtyardO` if the world seed has one (otherwise use `/lab/kit.html` with a seed where `courtyardO` brings ground). Follow `.scratch/evals-142.md`.
- [ ] **Step 2: Commit** `docs(#142): before/after plinth screenshots`.
