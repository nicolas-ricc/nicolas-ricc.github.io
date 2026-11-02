# Empty-build pad and ground row in the readout (#185) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pieceScene` builds a finite pad (top face at z = 0) when `build` emits no solids, and the storybook readout counts the pad apart from the piece's solids: "Sólidos" = `scene.solids` + animator solid layers, a new "Suelo" row = `scene.ground`.

**Architecture:** in `src/lab/crop.ts`, `pieceScene` falls back to `top = 0` when the floor it derives from the solids is not finite. `Readout` gains a `ground: number` field; `readout` stops adding `scene.ground` to `solids` but still feeds it to faces, box and materials. `src/lab/storybook.ts` adds a `["Suelo", String(r.ground)]` row right after "Sólidos".

**Tech Stack:** TypeScript strict, Vitest (`npm test`), `tsc --noEmit` (`npm run typecheck`), agent-browser for the storybook check.

**Spec:** issue #185 (follow-up of #118) plus the owner's decision comment of 2026-11-01, which folds in #200: "«Sólidos» cuenta sólo `scene.solids` más los sólidos de los animadores, y una fila aparte «Suelo» muestra el pad. Se actualizan los tests del readout. Código, comentarios y mensajes de test nuevos, en inglés (ver #194)."

## Global Constraints

- Files that change: `src/lab/crop.ts`, `src/lab/crop.test.ts`, `src/lab/storybook.ts`, `src/lab/storybook.test.ts`.
- Empty-build pad: top face at z = 0, bottom at z = −1 (the issue: "default `top` to 0").
- Readout labels are lab UI copy and stay in Spanish: the existing `"Sólidos"` and the new `"Suelo"` (the owner's wording).
- New and rewritten code, comments and test names/messages in English (#194). Existing Spanish tests that this plan does not touch stay as they are.
- Commits `<type>(#185): ...`. `npm test` and `npm run typecheck` green.
- Pipeline evals stage: the failing tests of both tasks (Task 1 Step 1, Task 2 Step 1) are committed together as `test(#185): evals` before implementation; implementers start at Step 3 of each task.

## Technical decisions (declared)

1. **Guard on a finite floor, not on `solids.length`.** `top = Number.isFinite(floor) ? Math.floor(floor) : 0`. A build that emits only solids with no faces (e.g. a `ground` mesh with `tris: []`) also leaves `floor = Infinity`, because `bounds` of a faceless solid is `±Infinity`; this guard covers both.
2. **The empty-build pad is the `±PAD_M` square.** With no solids, `r = 0` and there is no shadow, so the pad spans x, y ∈ [−3, 3]. No new constant.
3. **`Readout.ground` is a count of `scene.ground` meshes.** For a piece exhibit this is the pad (1). For a region exhibit it is the cropped flat ground meshes of the scene (pavement, plazas…); terrain (`scene.terrain`) still does not count. The row shows the number, like "Sólidos" and "Acentos".
4. **Faces, box and materials keep including the ground.** The owner's decision only moves the solid count. "Caras", the box rows and "Materiales" still describe everything the exhibit draws except terrain and water, as today. The doc comment of `readout` says so.
5. **Animator layers have no ground.** Animator `solid` layers keep counting under `solids`, even when one of their solids is `kind: "ground"`; the split is by origin (`scene.ground` vs the rest), not by `Solid.kind`.

## Spec → tasks

1. "When `build` emits nothing, `floor` stays `Infinity` … default `top` to 0 when there are no solids, and add a test for the empty case" → Task 1.
2. "«Sólidos» cuenta sólo `scene.solids` más los sólidos de los animadores" → Task 2 (`readout`).
3. "una fila aparte «Suelo» muestra el pad" → Task 2 (`Readout.ground` + storybook row).
4. "Se actualizan los tests del readout" → Task 2 Step 1.

## Review Focus

1. A build that emits only a faceless solid (`{ kind: "ground", mat: "concrete", tris: [] }`): the pad must still be finite with top 0. Task 1 test.
2. The pad's vertices must all be finite (x, y and z), not just `max.z`. Task 1 test checks every vertex.
3. A region exhibit, whose `scene.ground` holds many meshes: "Suelo" shows their count and "Sólidos" no longer includes them. Task 2 test with two ground meshes.
4. Faces/box/materials silently losing the pad when the count moves. Task 2 keeps the existing faces/box/materials assertions over `[pad, …]`.
5. The empty scene readout must report `ground: 0`. Task 2 updates the empty-scene `toEqual`.

---

### Task 1: Finite pad for an empty build

**Files:**
- Modify: `src/lab/crop.ts` (`pieceScene`, the `const top = Math.floor(floor);` line and the doc comment above the function)
- Test: `src/lab/crop.test.ts` (the `describe` that covers `pieceScene`)

**Interfaces:**
- Consumes: nothing.
- Produces: `pieceScene` signature unchanged.

- [ ] **Step 1: Write the failing tests** (in the `pieceScene` describe, after the flat-piece test)

```ts
it("an empty build gets a finite ±3 pad with its top face at z = 0", () => {
  const s = pieceScene(() => {});
  expect(s.solids).toEqual([]);
  const pts = s.ground[0]!.kind === "ground" ? s.ground[0]!.tris.flatMap((t) => t.pts) : [];
  expect(pts.length).toBeGreaterThan(0);
  for (const p of pts) for (const c of [p.x, p.y, p.z]) expect(Number.isFinite(c)).toBe(true);
  const { min, max } = bounds(s.ground[0]!);
  expect([min.x, min.y, max.x, max.y]).toEqual([-3, -3, 3, 3]);
  expect([min.z, max.z]).toEqual([-1, 0]);
});
it("a build of faceless solids also gets the pad at z = 0", () => {
  const faceless: Solid = { kind: "ground", mat: "concrete", tris: [] };
  const s = pieceScene((out) => { out.push(faceless); });
  expect(s.solids).toEqual([faceless]);
  expect(s.ground).toHaveLength(1);
  const { min, max } = bounds(s.ground[0]!);
  expect([min.x, min.y, max.x, max.y]).toEqual([-3, -3, 3, 3]);
  expect([min.z, max.z]).toEqual([-1, 0]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lab/crop.test.ts`
Expected: the two new tests FAIL (z bounds are `±Infinity`/`NaN`); every other test in the file passes.

- [ ] **Step 3: Implement**

In `pieceScene`, `top` falls back to 0 when `floor` is not finite (decision 1). Add one English sentence to the doc comment: with no solids the pad's top face is at 0.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lab/crop.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lab/crop.ts src/lab/crop.test.ts
git commit -m "fix(#185): finite pad at z = 0 for an empty build"
```

### Task 2: "Sólidos" without the pad, new "Suelo" row

**Files:**
- Modify: `src/lab/crop.ts` (`Readout`, `readout` and its doc comment)
- Modify: `src/lab/storybook.ts` (`renderReadout` rows)
- Test: `src/lab/crop.test.ts` (`describe("readout")`), `src/lab/storybook.test.ts` (new `describe`)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `interface Readout { solids: number; ground: number; faces: number; accents: number; box: …; materials: Material[]; accentColors: AccentColor[] }` — `ground` inserted right after `solids`.

- [ ] **Step 1: Write the failing tests**

In `describe("readout")` of `src/lab/crop.test.ts`:
- Replace the test `"cuenta suelo, sólidos y capas sólidas animadas; ni terreno ni agua"` (`expect(r.solids).toBe(5)`) with:

```ts
it("counts scene solids and animated solid layers, not the ground, terrain or water", () => {
  expect(r.solids).toBe(4);
});
it("counts the scene ground apart", () => {
  expect(r.ground).toBe(1);
  const two = readout({ ...scene, ground: [pad, pad] } as WorldScene, [anim]);
  expect([two.solids, two.ground]).toEqual([4, 2]);
});
```

- In the empty-scene test, the expected object becomes `{ solids: 0, ground: 0, faces: 0, accents: 0, box: null, materials: [], accentColors: [] }`.
- The faces, box and materials tests stay unchanged: they already run over `all = [pad, …]` (decision 4).

In `src/lab/storybook.test.ts`, a new describe:

```ts
describe("readout rows (#185)", () => {
  it("shows the ground in its own Suelo row, right after Sólidos", () => {
    expect(src).toMatch(/\["Sólidos", String\(r\.solids\)\],\s*\["Suelo", String\(r\.ground\)\],/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lab/crop.test.ts src/lab/storybook.test.ts`
Expected: FAIL — `r.solids` is 5, `r.ground` is `undefined`, the empty-scene object lacks `ground`, and the source has no `"Suelo"` row. `npm run typecheck` also fails on `r.ground`, which is expected until Step 3.

- [ ] **Step 3: Implement**

- `readout`: `solids` = `scene.solids` + animator solid layers; `ground: scene.ground.length`; faces, box and materials iterate over `[...scene.ground, ...solids]`, so their values do not change. `box` stays `null` only when that combined list is empty.
- Rewrite the `readout` doc comment in English: what counts as solids, that the ground is counted apart, that faces/box/materials include the ground, that terrain and water layers never count, and the existing note on materials coming from `tessellate`.
- `renderReadout` in `src/lab/storybook.ts`: insert `["Suelo", String(r.ground)],` right after the `"Sólidos"` row.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lab/crop.test.ts src/lab/storybook.test.ts && npm run typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lab/crop.ts src/lab/crop.test.ts src/lab/storybook.ts src/lab/storybook.test.ts
git commit -m "fix(#185): readout counts the ground apart from the solids"
```

### Final verification

- `npm test` and `npm run typecheck` green.
- Browser (`.scratch/evals-185.md`): `lab/storybook.html?bloom=off#viga` shows "Sólidos" 1 and "Suelo" 1 (before: "Sólidos" 2); `#carguero` shows "Sólidos" 37 and "Suelo" 1 (before: 38). Pixi active, no console errors.

## Assumptions

- **x/y of the empty pad need no guard.** In `pieceScene` (`src/lab/crop.ts`), `r = Math.max(r, -min.x, max.x, -min.y, max.y)` starts at 0; a faceless solid's `bounds` (`src/iso/solids.ts:357-365`, min = +Infinity, max = −Infinity over no points) only feeds `-Infinity` into that `max`, so `r` stays 0. `shadowPolygon` returns `null` for flat solids (`src/iso/light.ts`, `isFlat`), so the shadow loop adds nothing. Only `top` is poisoned. Rejected: guarding x/y too (dead code).
- **Bottom follows top.** The bottom vertices are built at `top - 1` in `pieceScene`; with `top = 0` the bottom is −1 without a second change.
- **Count by origin, not by `Solid.kind`.** The owner's comment names the sources ("`scene.solids` más los sólidos de los animadores"), not kinds. No piece exhibit has an animator emitting `kind: "ground"` solids (ship exhibits have no `animate`, `src/lab/exhibits.ts:209-214`), so the browser numbers do not depend on it. Rejected: filtering animator solids by `kind`.
- **One PR.** Both tasks ship together in this issue's PR; the intermediate state between the two commits never reaches `main`.
- **Red typecheck only inside the evals commit.** The `test(#185): evals` commit references `r.ground` before it exists; CI (`.github/workflows/deploy.yml`) runs on `pull_request` and `push` to `main`, and the branch is pushed only after implementation. Same practice as #118 and #167.
- **Only new or rewritten text in English.** The owner's comment: "Código, comentarios y mensajes de test nuevos, en inglés". Untouched Spanish comments and tests in `crop.ts`/`crop.test.ts` stay; the `readout` doc comment is rewritten, so it goes to English.
- **Before numbers are measured, not recorded in the repo.** `#viga` 2 and `#carguero` 38 were measured on `main` (ba68056) with `readout(pieceScene(e.build, e.pad), [])` and are quoted in the #185 stage-1 comment; the browser script re-reads them live.

## Grilling

- Rounds: 1. Questions: 17.
- Sources: 14 CODE (`crop.ts` `pieceScene`/`readout`, `solids.ts` `bounds`, `light.ts` `shadowPolygon`, `crop.test.ts` imports and fixtures, `storybook.ts` rows, `storybook.test.ts` `src`, `exhibits.ts`, `deploy.yml`), 2 ISSUE (owner's comment), 1 NO SOURCE → technical assumption (one PR).
- Plan corrections: the faceless-solid test also asserts `s.solids` and `s.ground.length`; Task 1 Step 2 runs the whole file (`-t "pad"` also matched five existing tests).
- Issues opened: none.
