# Drop tower: the gondola hides the column lights (#396): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the fair animator, the column neon of the drop tower stops emitting the dots that the gondola hides in the current frame. Today the gondola seems to pass behind the column lights.

**Architecture:** Only the `neon()` accessor of `createFairAnim` (`src/scenes/fair-anim.ts`) changes. A private helper there decides, for each column point and the current `dropSolids(dropZ())`, whether the gondola hides it. A point is hidden when it lies inside the gondola's z span, or when its projection (`project`, `src/iso/project.ts`) falls inside the screen silhouette of one of the gondola solids while it is behind that solid (`isBehind`, `src/iso/depth.ts`). Hidden points are filtered out. Everything else stays as it is: the lit/at-rest rule, the other neons and the cyan tip light. The stage (`src/world/stage.ts`) is not touched: the issue rules out general accent occlusion.

**Tech Stack:** TypeScript, vitest, the iso engine in `src/iso`, agent-browser for the storybook captures.

**Spec:** issue #396 (its body is the spec).

## Global Constraints

- Fix it locally in `neon()` of `fair-anim.ts`. Do not add general accent occlusion to the stage.
- Use `project` (`src/iso/project.ts`) and the depth of `src/iso/depth.ts`, not a margin chosen by eye.
- Unchanged: lit (`magenta`, `NEON_R`) at or below the gondola, at rest (`magentaBleed`, `NEON_OFF_R`) above it, the cyan light at the tip (a static accent in `fair.ts`), and the other neons (marquee, ghost, mirror, lift).
- With `reducedMotion` (the gondola still at the base, `dropZ() = 1`) the output is the same as today, except for the dots the gondola hides.
- `src/scenes` and `src/iso` stay Pixi-free (`src/iso/pixi-free.test.ts`). Code, comments and identifiers are in English (`src/english.test.ts`).
- `npm test` and `npm run typecheck` pass.

## Decisions (technical assumptions, declared)

1. **Silhouette per solid, not of the AABB.** The silhouette of a solid is `convexHull` of `project` applied to every vertex of `tessellateAll(s)`. Every solid of the gondola is convex (an octagonal `cylinder` ring and eight `prism` seats), so its silhouette is exact. `screenHull(bounds(s))` would be the hexagon of the box, wider than the octagon: that would be the "margin by eye" the issue forbids. The gondola's silhouette is the union of the nine.
2. **"Behind" is `isBehind` from `depth.ts`.** It is called with the point as a degenerate box (`{ min: at, max: at }`) against `bounds(s)`. For a column point below the gondola it is true on z. Above the gondola it is false on every axis, which is correct: the ray toward the camera (`+x, +y, +z`) moves away from the gondola. Point in silhouette plus behind means the ray toward the camera crosses the solid in front of the point.
3. **The volume rule uses the gondola's bounds.** A column point hides if `minZ ≤ at.z ≤ maxZ`, where `minZ` and `maxZ` are the extremes of `bounds` over all of `dropSolids(z)`, that is `z` and `z + 2.2`. The plan position is not checked. Every column point is at `(DROP.x, DROP.y + 0.8)`, 0.8 from the axis and inside the ring's inscribed radius (2.4·cos 22.5° ≈ 2.22). The helper's comment says so. Without this rule, a point inside the ring is not "behind" on any axis, so the projection rule alone would let it through.
4. **Inside the polygon:** `pointInPolygon(x, y, flat)` from `src/map/geo.ts` (`depth.ts` already imports it) over the flattened hull.
5. **Known consequences, accepted:** with the gondola at the base (`reducedMotion`, frame 0) the lowest column dot (z 3, inside the span 1..3.2) disappears and five `magentaBleed` dots remain. At the top (`z = 21`, span 21..23.2) the last dot (z 22) disappears and five `magenta` dots remain. The two existing tests in `fair-anim.test.ts` that count six column dots change accordingly. That is the behavior the issue asks for.

## Review Focus

1. A point just below the gondola (0 < z − at.z ≲ 0.9): hidden by the projection rule only. The full-cycle test must actually hit such a frame. Assert that at least one frame hides a point that is not inside the z span.
2. Points above the gondola must keep being emitted (at rest). The test checks that emitted equals all minus hidden, not only that no hidden one is emitted.
3. The fall (600 ms, quadratic) jumps several units per 100 ms step. The cycle loop covers it because it walks all of `DROP_CYCLE_MS`.
4. Colors and radii of the remaining column dots: the same rule as today (`at.z <= z` → `magenta`/`NEON_R`, else `magentaBleed`/`NEON_OFF_R`).
5. The other neon families are unaffected: under `reducedMotion` their output equals today's.

---

### Task 1: Gondola occlusion of the column neon

**Files:**
- Modify: `src/scenes/fair-anim.ts` (imports; `neon()`; a new private helper)
- Test: `src/scenes/fair-anim.test.ts`

**Interfaces:**
- Consumes: `dropSolids(z: number): Solid[]` (`fair.ts`), `project` (`iso/project.ts`), `isBehind` (`iso/depth.ts`), `bounds`, `tessellateAll` (`iso/solids.ts`), `convexHull` (`iso/geometry.ts`), `pointInPolygon` (`map/geo.ts`).
- Produces: nothing public. `FairAnim` keeps its shape. Private `gondolaHides(at: Vec3, gondola: Solid[]): boolean` in `fair-anim.ts`.

- [ ] **Step 1: Write the failing tests** in `fair-anim.test.ts`, in a new `describe("fair-anim #396: the gondola hides the column lights")`. The test oracle `hidden(at, solids)` = (`at.z` within the min/max z of `bounds` over `solids`) OR some solid `s` has `isBehind({min: at, max: at}, bounds(s))` and `pointInPolygon` of `project(at)` inside `convexHull(tessellateAll(s) vertices → project)`.
  - `it("over the whole cycle no column dot is emitted inside or behind the gondola silhouette, and the rest still are")`: `a = createFairAnim(fair(createRng(7)), { reducedMotion: false })`. For each frame `t = 0, DROP_STEP_MS, …, < DROP_CYCLE_MS` (tick `DROP_STEP_MS` between frames): `g = dropSolids(a.dropZ())`. Expect `on(s.neon.column, a.neon())` to equal `s.neon.column.filter(p => !hidden(p, g)).map(p => ({ kind: "dot", at: p, r: p.z <= z ? NEON_R : NEON_OFF_R, color: p.z <= z ? "magenta" : "magentaBleed" }))`. Also expect no emitted column dot that is `hidden`. Count the frames where some point is hidden but not inside the z span; expect that count `> 0`. Count the frames where some point is hidden at all; expect `> 0`.
  - `it("reduced motion: same as today except the dot inside the gondola at the base")`: `r = createFairAnim(s, { reducedMotion: true })`. Column dots are `s.neon.column.slice(1)`, all `magentaBleed` with r 0.25. The non-column dots of `r.neon()` are the same as those of `a.neon()` at frame 0 (the marquee, ghost, mirror and lift dots, unchanged).
- Update the existing tests:
  - "frame 0 and reduced motion…": the column now has 5 dots (`Array(5).fill(["magentaBleed", 0.25])`).
  - "the column rises with the gondola…": at the top, 5 dots, all `magenta` (the z 22 one is hidden).

- [ ] **Step 2: Run** `npx vitest run src/scenes/fair-anim.test.ts`. Expected: the new tests FAIL (six column dots are emitted and some are hidden).

- [ ] **Step 3: Implement `gondolaHides(at: Vec3, gondola: Solid[]): boolean`** in `fair-anim.ts`, per Decisions 1 to 4. In `neon()`, compute `const g = dropSolids(z)` once and filter `scene.neon.column` with `!gondolaHides(at, g)` before mapping to dots. The color rule is unchanged.

- [ ] **Step 4: Run** `npx vitest run src/scenes/fair-anim.test.ts`, then `npm test` and `npm run typecheck`. Expected: all PASS.

- [ ] **Step 5: Commit** `fix(#396): the gondola hides the column lights it covers`.

### Task 2: Storybook captures (exhibit Drop tower)

**Files:**
- Create: `docs/superpowers/specs/assets/2026-11-16-feria/drop-tower-mid.jpg`, `docs/superpowers/specs/assets/2026-11-16-feria/drop-tower-top.jpg`

- [ ] **Step 1:** `npm run dev -- --host --port 5173`. Open `http://localhost:5173/lab/storybook.html?speed=0#torre-caida` in agent-browser (viewport 1600 × 900 × 2), with the PixiJS DevTools extension as in `CLAUDE.md`.
- [ ] **Step 2:** Hook the app ticker as in the time-lapse method (`docs/superpowers/specs/2026-10-17-barcos-inventario.md`, "Método del time-lapse"). Call its listener with `deltaMS` steps of 100 until 3000 ms of simulation (the gondola halfway up, z ≈ 11), then render and take a screenshot. Continue to 6500 ms (at the top, hold), render and take a screenshot.
- [ ] **Step 3:** Check in each capture that the `rust` ring and the seats cover the column dots that are behind or inside them. Crop to the exhibit, save as JPEG and commit `docs(#396): drop tower captures with the gondola halfway up and at the top`. The PR links both.
