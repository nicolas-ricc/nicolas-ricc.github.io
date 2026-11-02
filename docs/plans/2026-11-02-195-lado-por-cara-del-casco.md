# Side pieces by the hull face they hang from (#195): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sortByDepth` decides the side of a piece against its hull by the outward normal of the hull face (band or end) the piece hangs from, and classifies a deckhouse sunk slightly below the midship deck as a deck piece, so the ferry's aft starboard fender at heading 0 is drawn after the hull.

**Architecture:** one function `hullSide` in `src/iso/depth.ts` replaces `restsOnHull` and `besideHull` (rules D1 steps 0–4 of the issue). The deck ring of each hull is computed once per `sortByDepth` call, rotated into the sort frame and flattened for `pointInPolygon`. `hullOrder`, `farAlong`/`isBehindView`, `depthKey` and the pair loop do not change.

**Tech Stack:** TypeScript, Vitest, agent-browser for the captures.

**Spec:** issue #195: the owner's decision of 2026-11-01 and the planner comment of 2026-11-02 (D1–D5 and its acceptance criteria). The planner comment is the design; this plan only cuts it into tasks.

## Global Constraints

- D1, verbatim order: 0. `hull.kind !== "hull"`, `other.kind === "hull"`, or no plan overlap of the frame boxes (same strict `<` test as today) → 0. 1. `ob.min.z >= deck - EPS`, `deck = hull.at.z + hull.h` → 1. 2. all four plan-box corners of the piece inside the hull's deck ring → 1 if `ob.max.z > deck + EPS`, else −1. 3. `ob.max.z <= hb.min.z + EPS` → 0. 4. `u = (ob.min.x + ob.max.x - hb.min.x - hb.max.x) / (hb.max.x - hb.min.x)`, `w` likewise on y; `|u| >= |w|` → normal `(sign(u), 0)`, else `(0, sign(w))`; `t = n · (vx, vy)`; `|t| <= EPS` → 0, else `sign(t)`. `u = w = 0` → 0.
- The ring is `hullRings(hull).deck` rotated into the sort frame with `x' = x·c + y·sn`, `y' = −x·sn + y·c` (as `worldAndFrameBounds`), z ignored; containment by `pointInPolygon(x, y, flat)` from `src/map/geo.ts`.
- Rings once per hull per `sortByDepth` call, never per pair.
- New or rewritten code, comments, test names and test messages in English (#194). Untouched Spanish stays.
- Commits `test(#195): …`, `fix(#195): …`, `docs(#195): …`.
- The static render list of `world(SEED)` stays identical to `main`'s, item by item.
- Out of scope: ordering between ships or ship vs. scenery, ship models, `CONTEXT.md` (#196), README. The tug stern corners changing side at 125–145°/305–325° and having no side at exactly 135°/315° is by design.
- `npm test` and `npm run typecheck` green.

## Review Focus

1. A non-ship scene with a hull sorted at heading 0 while the hull itself has another heading (shipyard, fair boats): the ring must be built from the hull's own heading (`hullRings` does) and rotated by the *sort* heading. Pinned by the static `world(SEED)` comparison in Task 3.
2. A piece exactly centred on the hull (u = w = 0) must give 0, not `sign(0)` normals that produce `-0`/NaN. Covered by `Math.sign(0) = 0` giving `t = 0`; Task 2 adds no extra test because no ship has such a piece below the deck outside the outline (step 2 catches centred pieces first).
3. A degenerate hull box (`hb.max.x === hb.min.x`) would divide by zero: hulls have `len, beam > 0`, so it cannot happen; not tested.
4. A piece inside the outline but under the keel never reaches step 3 (step 2 decides first, −1). This is the D1 rule order; the sweep test in Task 1 encodes the same order, so a divergence shows there.
5. Performance: rings once per hull; the ship sort timing must stay close to `main` (planner prototype 0.27 vs 0.28 ms). Checked by reading the code in review, not by a test.

---

### Task 1: Evals (red)

Done in pipeline stage 3, before any change to `depth.ts`.

**Files:**
- Modify: `src/scenes/ships-depth.test.ts:23-42`
- Modify: `src/iso/depth.test.ts` (`describe("sortByDepth con piezas de costado")`)

**Interfaces:**
- Consumes: `hullRings` (`src/iso/solids.ts`), `pointInPolygon` (`src/map/geo.ts`), `ship`, `SHIP_SPECS`.
- Produces: nothing used by code.

- [ ] **Step 1: sweep.** Replace the centroid formula in `ships-depth.test.ts` with an expected-side helper implementing D1 steps 1–4 on the ship-local boxes (`localBox`) and the hull's deck ring transformed with the same translation/rotation as `localBox`. Every `ShipKind`, 72 headings; mismatches collected into `fails` and `expect(fails).toEqual([])`. Test name and messages in English.
- [ ] **Step 2: ferry fender case.** A second `it`: `ship("ferry", AT, 0)`; the asphalt cylinder with the smallest local x (x 5, y 2.05) comes after the hull in `sortByDepth(solids, 0)`.
- [ ] **Step 3: depth.test.ts side pieces (D2).**
  - Replace the tug 145° case: ferry hull (`at (0,0,-1)`, `len 15, beam 4, h 1.2, sheer 0.3, heading 0`) with `rotCyl(0, 5, 2.05, -0.2, 0.22, 0.5)` → `[hull, fender]`, both input orders; port mirror `rotCyl(0, 5, -2.05, -0.2, 0.22, 0.5)` → `[fender, hull]`, both orders; tug 145° corner `rotCyl(h, 0.9, 1.7, 1, 0.45, 0.9)` → `[hull, corner]`, both orders.
  - Hull/cabin/fender at heading 0: expected `[hull, cabin, fender]` for the three input orders.
  - New hull-separates triple: tug hull (`at (0,0,-1)`, `len 19, beam 7, h 2.2, sheer 0.3`), `low = rotBox(h, 10, -1, 2, 2, 0, 1)`, `deckBox = rotBox(h, 7, -1, 2, 2, 1.2, 1.8)` → `[low, hull, deckBox]` for three input orders at headings 0 and π.
  - New sunk deckhouse: tug hull, `house = rotBox(h, 8.2, -2.2, 6, 4.4, 1.1, 1.7)` → `[hull, house]` for both input orders at 0°, 90°, 180°, 270°, 145°.
  - Same sunk deckhouse with the hull and house at heading 90° but sorted at heading 0 (`sortByDepth(input, 0)`) → `[hull, house]`: pins that the ring comes from the hull's own heading while the frame is the sort heading (the fair boats' case, `src/scenes/fair.ts:208`). See Assumption A1.
- [ ] **Step 4: run red.** `npx vitest run src/iso/depth.test.ts src/scenes/ships-depth.test.ts`. Expected failures: sweep (ferry, tug, barge), ferry fender case, the new fender/corner expectations, hull/cabin/fender, sunk deckhouse at 180°/270°/145°. Record them in the stage comment.
- [ ] **Step 5: commit** `test(#195): evals`.

### Task 2: `hullSide` in `depth.ts` (green)

**Files:**
- Modify: `src/iso/depth.ts` (replace `restsOnHull`/`besideHull`, the `sides` computation in `sortByDepth`, and the doc comment that names the three hull rules)

**Interfaces:**
- Consumes: Task 1 tests; `hullRings` from `./solids`; `pointInPolygon` from `../map/geo`.
- Produces: `function hullSide(hull: Solid, other: Solid, hb: Bounds, ob: Bounds, ring: number[] | undefined, vx: number, vy: number): number` (module-private), `ring` = flat `[x0, y0, x1, y1, …]` deck ring in the sort frame.

- [ ] **Step 1:** In `sortByDepth`, after `hulls`, build `rings: Map<number, number[]>` (or an array indexed like `hulls`) once per hull, rotated with the sort heading's `c`, `sn`.
- [ ] **Step 2:** Implement `hullSide` per D1 steps 0–4 exactly; replace the `restsOnHull(...) ? 1 : besideHull(...)` call with it. English JSDoc describing the four steps; update the `sortByDepth` paragraph that names `restsOnHull`/`besideHull`.
- [ ] **Step 3:** `npx vitest run src/iso/depth.test.ts src/scenes/ships-depth.test.ts` → all pass; the unchanged `sortByDepth con cascos` and barge 315° tests pass.
- [ ] **Step 4:** `npm test` and `npm run typecheck` green.
- [ ] **Step 5:** commit `fix(#195): side pieces by the hull face they hang from`.

### Task 3: Static list and captures

**Files:**
- Create: `docs/superpowers/specs/assets/195-ferry-fender/ferry-0-before.png`, `ferry-0-after.png`
- Scratch (not committed): `.scratch/static-list-195.ts`

- [ ] **Step 0:** `.scratch/` goes in `.git/info/exclude` (never committed); the `main` worktree lives in `/tmp/main-195` and is removed with `git worktree remove` at the end of this task.
- [ ] **Step 1:** Scratch script that builds `world(SEED)` and `buildRenderList([...terrain.ground, ...scene.ground, ...scene.solids])` as `src/world/stage.ts` does, dumps the items to JSON; run it on `main` (a `git worktree` of `origin/main`) and on the branch; compare item by item. Expected: identical count and 0 differing items.
- [ ] **Step 2:** Captures with agent-browser (viewport 1600×900 at 2×) of `http://localhost:5173/lab/storybook.html#lancha` on `main` (before) and on the branch (after), per `CLAUDE.md`. Before: the aft-most starboard fender half hidden by the hull; after: drawn over the hull.
- [ ] **Step 3:** commit `docs(#195): ferry fender captures`.

## Assumptions

- **A1.** One extra assertion beyond D2: the sunk deckhouse with hull heading 90° sorted at heading 0. D2 has no case where the hull heading differs from the sort heading, and the static comparison only proves "no change". Rejected: relying on the static `world(SEED)` comparison alone.
- **A2.** The `ships-depth.test.ts` oracle re-implements D1 on ship-local boxes, so it is not independent of D1's text; the independent pins are the literal expected orders of D2 in `depth.test.ts` and the ferry-fender `it`. D1 is the owner's/planner's fixed definition ("Design decisions (fixed; do not reopen)"). Rejected: a geometric oracle (e.g. rasterised occlusion), which the issue does not ask for.
- **A3.** The sweep keeps today's convention for "no side": a pair whose expected side is 0 is skipped, as `src/scenes/ships-depth.test.ts:39` does now (`if (Math.abs(t) <= EPS) continue`).
- **A4.** If the Task 3 static comparison reports a difference, Task 2 is not shipped as is: the difference contradicts the issue's "cannot change under any hull rule" and is taken back to the issue as a blocker (spec ambiguity), not patched over.
- **A5.** Red evals are committed on the branch before the fix (the issue's "Red-first" in "How to test"); the branch is squash-merged, so no red commit reaches `main`.
- **A6.** No guard against `len`/`beam` = 0: the `hull` solid type (`src/iso/solids.ts:25`) has no validation and every hull in the repo has literal positive sizes (`ships.ts` `SHIP_SPECS`, `fair.ts:208`, `shipyard.ts:89,141`).
- **A7.** Rings are kept in an array/map keyed by the hull's index in `solids`, the same key `sides` already uses (`src/iso/depth.ts`, `hulls` / `sides`).

## Grilling

- Rounds: 1 (the revisions add one assertion and a cleanup step; no seam changed, so no second round).
- Questions: 18. Sources: ISSUE 9, CODE 13, DOC 1 (several answers cite more than one); NO SOURCE → technical assumption 7 (A1–A7); spec ambiguity 0; out of scope 0.
- Issues opened: none.
