# Storybook clean crops (#399): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Region and context exhibits of the storybook crop the world cleanly to their box: strict overlap, strips and long prisms cut to the box, terrain triangles clipped to the box, and shadows clipped to the box in the engine.

**Architecture:** Two pure clipping helpers in a new `src/iso/clip.ts` (Liang–Barsky segment, Sutherland–Hodgman convex polygon against an axis-aligned rectangle). `src/lab/crop.ts` uses them to cut strips, long prisms and `ground` triangles; `src/iso/render-list.ts` uses them to clip shadow polygons when given a `clip` rectangle; `src/world/stage.ts` threads an optional `clip` into its render lists, and `src/lab/storybook.ts` passes `e.box` for regions and contexts only.

**Tech Stack:** TypeScript, vitest, the repo's iso engine (`src/iso`, Pixi-free), Pixi v8 (`src/world/stage.ts` only).

**Spec:** issue #399 (its body is the spec: "Decisiones heredadas" 1–6 and "Criterios de aceptación"), parent story #395, `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md` §3. Base branch `feature/395-storybook-luces-encuadre`.

## Global Constraints

- Code, comments, strings and identifiers in **English** (`src/english.test.ts`); `docs/` prose may stay Spanish.
- `src/iso` stays Pixi-free and must not import from `src/world` or `src/lab` (`src/iso/pixi-free.test.ts`; layering): the rectangle type is declared in `src/iso/clip.ts` as `ClipRect { x0, y0, x1, y1 }`, structurally identical to `Box` (`src/world/frame.ts`).
- Only `src/world/stage.test.ts` and `src/world/bloom-runtime.test.ts` may import Pixi in tests.
- Without `clip`, `buildRenderList` and `buildStage` behave exactly as today; the site (`src/main.ts`), `src/lab/page.ts` pages and piece exhibits pass nothing.
- `cropShared` keeps memoizing by (box identity, solid identity): terrain and `claims` must crop to the same object.
- Tolerance for "inside the box" checks in tests: 1e-9.
- `npm test` and `npm run typecheck` pass.

## Decisions (technical assumptions, declared)

1. **Inside is inclusive, overlap is strict.** A point is inside when `x0 <= x <= x1 && y0 <= y <= y1`; a bounds overlaps when `min.x < x1 && max.x > x0 && min.y < y1 && max.y > y0`. Same rule for `triOverlaps` (on the triangle's AABB).
2. **Strips are cut on their centerline.** Each path segment is clipped with Liang–Barsky against the box; consecutive clipped segments that join (the end of one equals the start of the next, i.e. `t1 === 1` for the first and `t0 === 0` for the next) form one run; each run with ≥ 2 points becomes `{ ...s, path: run }`. A strip whose path points are all inside passes by identity; no run → `null`. The square ends of a cut run sit on the edge; the lateral half-width (`width / 2`) of a segment running parallel to and near an edge can still overhang it: the tests check the path inside and the bounds within the box grown by `width / 2`.
3. **Long prism** (`isLongPrism(s)`, exported from `crop.ts`): `kind === "prism"`, `roof` absent or `"flat"`, no `facade`, no `plates`, `max(w, d) >= 30` and `max(w, d) >= 3 * min(w, d)`. If it crosses the box it becomes `{ ...s, at: v3(nx0, ny0, s.at.z), w: nx1 − nx0, d: ny1 − ny0 }` with `nx0 = max(at.x, x0)`, `nx1 = min(at.x + w, x1)` (likewise y). Entirely inside → identity.
4. **Terrain triangles** (every `kind: "ground"` solid, wherever it comes from: terrain, `scene.ground`, `water` layers, claims): a triangle with all three vertices inside passes by identity (same `Tri` object); one that does not overlap strictly is dropped; otherwise `clipPolygon` (z interpolated along the cut edges) and a fan from vertex 0: `{ ...t, pts: [p0, pi, pi+1] }`, so `toneOffset`/`baseTone` are kept. Fewer than 3 clipped vertices → dropped. The mesh whose triangles all passed by identity is returned as the same object; none left → `null`. No intermediate arrays for the triangles that pass whole (the per-tick path over the water bands).
5. **Shadows:** `buildRenderList(solids, heading?, clip?: ClipRect)` clips each shadow hull (full and core) with `clipPolygon` before projecting (the hull is convex, so the result is the exact intersection); a result with fewer than 3 points emits no item.
6. **Stage:** `buildStage(scene, animators, opts: { clip?: Box } = {})`. `clip` reaches the static list and every `solid` layer redraw; bleed and water lists carry no shadows, so they do not need it.
7. **Real-world assertions** live in `src/lab/exhibits.test.ts` (it already assembles the world once), new `describe("clean crops (#399)")`.
8. **Shadows of what the crop drops or cuts.** A solid dropped by the crop casts no shadow into the box (as today: `cropSolid` already drops non-overlapping solids, `src/lab/crop.ts:29-33`); a long prism cut at the edge loses the shadow its outside part would cast inward. Both are low (fences 1.2, quay edges, plinths 0.3) and the issue asks for the crop, not for neighbour shadows. Rejected: keeping uncut copies only for shadows (two geometries per solid, against decision 3 of the issue).
9. **No red commit inside stage 4.** Task 2 owns everything the strict crop breaks (`planta` test, exhibit heights), so each task commit leaves `npm test` green except the stage-3 evals of later tasks.
10. **Visual check** is not a plan task: the pipeline's stage-3 agent-browser script (`.scratch/evals-399.md`, URLs from the issue's "Cómo probarlo") is run in stage 4 after Task 5, and the PR carries `#playa-camiones` and `#gradas` captures.

11. **`cropSolid` returns `Solid[]`** (empty = dropped) instead of `Solid | null`, because a strip that leaves and re-enters yields two strips. `cropShared` memoizes the array, so terrain and claims still share element identity; `cropScene` takes `cropShared(foam, box)[0]` for the foam. Found while writing the stage-3 evals. Rejected: `Solid | Solid[] | null` (three shapes for every caller).

## Criteria → tasks

- `overlaps`/`triOverlaps` strict → Task 2. Unit tests for strips, prisms, triangles → Tasks 1–2; `buildRenderList` with `clip` → Task 3.
- Real-world tests (plinths, strips and long prisms, terrain in the 11 exhibits) → Task 5.
- `exhibits.test.ts` green, `h`, `planta` test and lamp comment → Task 2.
- `stage.test.ts` with `clip` (static and animated shadows) → Task 4.
- No per-tick cost regression (`Tri` identity) → Task 2.
- Comments in English in `crop.ts`, `render-list.ts`, README paragraph → Tasks 2, 3, 5. `npm test`/`npm run typecheck` → every task.
- Visual check and captures → pipeline stages 3–4 and the PR (decision 10).

## Review Focus

1. A strip that leaves and re-enters the box (two runs): both survive with the same `width`, `z`, `mat`, `tone`. → Task 2 test.
2. A triangle with a vertex exactly on the edge and the rest inside passes by identity (inclusive inside), not as a copy. → Task 2 test.
3. A triangle that only touches the box edge (strict) is dropped, and a mesh with only such triangles yields `null`. → Task 2 test.
4. A shadow hull entirely outside the clip rectangle emits no shadow item (not an empty polygon). → Task 3 test.
5. A degenerate strip segment (zero length) does not throw or emit NaN. → Task 1 test (`clipSegment` with `a === b` inside returns `{ t0: 0, t1: 1 }`, outside returns `null`).

---

### Task 1: Pure clipping helpers

**Files:**
- Create: `src/iso/clip.ts`
- Test: `src/iso/clip.test.ts`

**Interfaces:**
- Produces:
  - `export interface ClipRect { x0: number; y0: number; x1: number; y1: number }`
  - `export function clipSegment(a: Vec2, b: Vec2, r: ClipRect): { t0: number; t1: number } | null` — Liang–Barsky parameters along `a→b` of the part inside `r` (inclusive edges); `null` if no part, or if the part has zero length and `a !== b`.
  - `export function clipPolygon<T extends Vec2>(pts: readonly T[], r: ClipRect, lerp: (a: T, b: T, t: number) => T): T[]` — Sutherland–Hodgman of a convex polygon against the four edges; returns `[]` when nothing is left.
  - `export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2` and `export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3` (z interpolated).

- [ ] **Step 1: tests** in `src/iso/clip.test.ts`: segment crossing the rect left→right (`(−5, 5)→(15, 5)` in `{0,0,10,10}` → `t0 0.25`, `t1 0.75`); segment fully inside → `{0, 1}`; fully outside → `null`; diagonal through a corner region; zero-length inside → `{0,1}`, outside → `null`. Polygon: triangle fully inside comes back with the same points; triangle crossing one edge comes back with all points inside (1e-9) and the expected area (shoelace); square larger than the rect comes back as the rect; polygon outside → `[]`; triangle with one vertex exactly on `x1` and one outside → no two consecutive equal points; `lerp3` keeps z linear on a sloped triangle (clipped point z equals the plane's z at that x/y).
- [ ] **Step 2:** `npx vitest run src/iso/clip.test.ts` → FAIL (module missing).
- [ ] **Step 3:** implement `src/iso/clip.ts` (no imports beyond `./geometry`).
- [ ] **Step 4:** `npx vitest run src/iso/clip.test.ts src/iso/pixi-free.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#399): clip helpers`.

### Task 2: Strict, geometric crop in `crop.ts`

**Files:**
- Modify: `src/lab/crop.ts` (`overlaps`, `triOverlaps`, `cropSolid`, comments), `src/lab/exhibits.ts` (`planta` comment, any `h` the strict crop pushes out of `SLACK`)
- Test: `src/lab/crop.test.ts`, `src/lab/exhibits.test.ts` (`planta` test)

**Interfaces:**
- Consumes: `clipSegment`, `clipPolygon`, `lerp3` from Task 1.
- Produces: `overlaps(b, box)` strict; `export function isLongPrism(s: Solid): boolean`; `cropSolid(s: Solid, box: Box): Solid[]` per decisions 2–4 (decision 11); `cropShared(s, box): Solid[]` memoized the same way; `cropSolids`, `cropScene`, `cropAnimators` unchanged in signature.

- [ ] **Step 1: tests** in `crop.test.ts`:
  - `overlaps`: the "touches the edge" case becomes `false` (rename the test to "touching the edge does not overlap; crossing it does").
  - strip `path [(−5, 5), (15, 5)]`, width 0.3, `tone: 1` → one strip, path `[(0, 5), (10, 5)]`, same width/z/mat/tone.
  - strip zig-zag `[(−5, 2), (5, 2), (5, 20), (8, 20), (8, 5), (15, 5)]` → two strips: `[(0, 2), (5, 2), (5, 10)]` and `[(8, 10), (8, 5), (10, 5)]`.
  - strip entirely inside → same object (`toBe`).
  - prism `at (−60, 4, 0)`, `w 156`, `d 0.6`, `h 1.2` → `at.x 0`, `w 10`, `at.y 4`, `d 0.6`, same h/mat.
  - prism 6 × 2.4 (truck) crossing x1, prism 40 × 2 with `roof: "gable"`, prism 40 × 2 with `plates: [...]` crossing → returned by identity.
  - triangle `(−2, 2), (6, 2), (2, 8)` in a ground mesh with `toneOffset: -1` → triangles all with vertices inside (1e-9), each carrying `toneOffset -1`, total area equal to the analytic intersection area.
  - triangle fully inside, and one with a vertex on the edge: the cropped mesh holds the same `Tri` objects (`toBe`), and a mesh of only those returns the same mesh object.
  - a mesh whose only triangle touches the edge from outside → `null`.
  - `cropAnimators` water layer: a triangle fully inside comes back by identity after `layer()`.
  - update the existing `cropScene` test "the terrain is filtered by triangle" (no change expected: `tri(2, 2)` is inside) and keep "keeps whole a solid that crosses the edge" (prism(9, 9, 4) is short).
  - `exhibits.test.ts` `planta`: the street lamp at (5, 76) is no longer in (`toEqual([])`); rename the test and rewrite the `exhibits.ts` comment to say it touches the south edge and stays out.
- [ ] **Step 2:** `npx vitest run src/lab/crop.test.ts src/lab/exhibits.test.ts` → the new cases FAIL.
- [ ] **Step 3:** implement. `inside(p, box)` already exists; `triOverlaps` strict, no arrays; the ground branch loops once, building the output array lazily only when the first non-identity triangle appears.
- [ ] **Step 3b:** run `npx vitest run src/lab` and, for each region/context whose framing test now fails, set `h` to the smallest integer that satisfies `max(inside, accents) <= h <= max(withAnim, accents) + SLACK` and `neighbor <= h` (`measure`, `measureContext`, `SLACK` in `src/lab/exhibits.test.ts`), updating its comment. No commit leaves `src/lab` red (decision 9).
- [ ] **Step 4:** `npx vitest run src/lab` → PASS.
- [ ] **Step 5:** commit `feat(#399): strict crop that cuts strips, long prisms and terrain`.

### Task 3: Shadows clipped in `buildRenderList`

**Files:**
- Modify: `src/iso/render-list.ts`
- Test: `src/iso/render-list.test.ts`

**Interfaces:**
- Consumes: `ClipRect`, `clipPolygon`, `lerp2` from Task 1.
- Produces: `buildRenderList(solids: Solid[], heading?: number, clip?: ClipRect): RenderItem[]`.

- [ ] **Step 1: tests:** a prism `at (8, 4, 0)`, 1 × 1 × 10 with `clip {0, 0, 10, 10}`: every point of every `shadow`/`shadowCore` item lies inside the projected rhombus of the clip rect (point-in-convex-polygon on `project(v3(x0,y0,0))…`, tolerance 1e-9); without `clip` the same solid's shadow leaves it (it is the control). A solid whose shadow is entirely outside the clip emits no shadow item. Solid faces are not clipped (same count of `solid` items with and without clip).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement: clip the `Vec2` hull before `shadowItem`, skip results with < 3 points.
- [ ] **Step 4:** `npx vitest run src/iso` → PASS.
- [ ] **Step 5:** commit `feat(#399): clip shadows to a rectangle in buildRenderList`.

### Task 4: `buildStage` clip and the storybook

**Files:**
- Modify: `src/world/stage.ts`, `src/lab/storybook.ts`
- Test: `src/world/stage.test.ts`

**Interfaces:**
- Consumes: `buildRenderList(…, clip)` from Task 3.
- Produces: `buildStage(scene: WorldScene, animators: ZonedAnimator[], opts?: { clip?: Box }): Stage`.

- [ ] **Step 1: test** in `stage.test.ts`, `describe("clip (#399)")`: a minimal scene (no terrain, one tall prism near the box's east edge in `solids`) and a toy animator with one `solid` layer holding a tall prism near the edge; `buildStage(scene, [anim], { clip: box })`; walk the shadow and core `Graphics` (children of the containers holding the `AlphaFilter`s — `container.children[3]` and `[4]`) and read their points from `g.context.instructions[i].data.path.instructions[j].data[0]`; every point lies inside the projected rhombus. The same build without `clip` has points outside (control).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement `opts`; in `storybook.ts` pass `{ clip: e.box }` in the `region` and `context` branches, nothing for pieces.
- [ ] **Step 4:** `npx vitest run src/world src/lab` → PASS; `npm run typecheck` clean.
- [ ] **Step 5:** commit `feat(#399): buildStage clips shadows to the exhibit box`.

### Task 5: Real-world assertions, exhibit heights, comments and README

**Files:**
- Modify: `src/lab/exhibits.test.ts`, `README.md` (storybook paragraph)
- Test: `src/lab/exhibits.test.ts`

**Interfaces:**
- Consumes: `isLongPrism` (Task 2), `cropScene`, `contextScene`, `cropAnimators`.

- [ ] **Step 1: tests** in `exhibits.test.ts`, `describe("clean crops (#399)")`, against the module-level `scene`/`animators`:
  - `playa-camiones`: no `prism` with `mat "paving"`, `h === PLINTH_H` (exported by `src/scenes/city-pieces.ts`) and `at.y === 92`.
  - for `playa-camiones`, `gradas`, `estacion`, `silos` (cropScene) and `cartel-taller-escena` (contextScene): every `strip` in `ground` and `solids` has all path points inside the box (1e-9) and bounds within the box grown by `width / 2`; every `isLongPrism` solid has bounds within the box.
  - for `playa-camiones`, `gradas`, `estacion`, `patio-contenedores`, `cartel-taller-escena`, `silos`, `playa-contenedores`, `autitos-chocadores`, `faro`, `pecio`: every vertex of every triangle of `terrain.ground/bleed/water/foam` of the crop is inside the box (1e-9), and so is every triangle of the cropped animators' `water` layers.
- [ ] **Step 2:** run → expected PASS already (Task 2 implements the crop); a failure here is a Task 2 bug, fixed there.
- [ ] **Step 3:** README: one or two sentences in the storybook paragraph saying the crop is strict and that strips, long prisms, terrain triangles and shadows are cut to the box (pieces and the site are not).
- [ ] **Step 4:** `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 5:** commit `feat(#399): real-world clean-crop checks and exhibit heights`.

## Grilling

One round (griller model: fable), 16 questions.

- Sourced from CODE: 11 (Q3 `src/iso/light.ts` `shadowPolygon` returns `convexHull` for every kind; Q4 `src/iso/solids.ts:28` prism type has no rotation; Q6 `solids.ts:20,37` `Tri` is `{ pts, toneOffset?, baseTone? }`, strip is `{ path, width, z, mat }` plus `tone`: no parallel arrays; Q7 only `storybook.ts` builds crops, `storybook-ui.ts` imports the `Readout` type only; Q8 `crop.ts` `cropLayer` uses unmemoized `cropSolid`, called per redraw (`stage.ts` water redraw): no memo growth; Q10 `stage.ts` calls `buildRenderList` for bleed, static, static water, water layers and solid layers, shadows only from static and solid; Q11 `stage.ts` `addChild` order and its docstring, `stage.test.ts:22` already reads `context.instructions`; Q12 `exhibits.test.ts` `measure`/`SLACK`; Q13 `light.ts` `SHADOW_DIR = (0.894, −0.447)` ENE; Q15 `Box` in `src/world/frame.ts`, `PLINTH_H` in `src/scenes/city-pieces.ts:14`, `scene`/`animators` at module level of `exhibits.test.ts`; Q16 `src/iso/pixi-free.test.ts` enforces the layering; there is no ADR on it and CONTEXT.md does not define crop/clip).
- Sourced from ISSUE: 3 (Q1 criteria list, now mapped in "Criteria → tasks"; Q4 thresholds: "Largo = `kind: \"prism\"`, `roof` ausente o `\"flat\"`, sin `facade` ni `plates`, lado mayor ≥ 30 u y ≥ 3× el menor"; Q5 "se recortan segmento a segmento (Liang–Barsky contra el rectángulo de la caja)"; base branch: "Rama base: `feature/395-storybook-luces-encuadre`").
- Technical assumptions (no source): Q2 → decision 8; Q9 → `clipPolygon` dedupes consecutive points; Q14 → decision 9 (heights and `planta` moved into Task 2); Q12 visual → decision 10; Q5 strip on the edge itself → decision 2 (inclusive inside: passes whole, half-width overhang tolerated by the test).
- Spec ambiguities: none. Follow-up issues opened: none.
