# Occlusion of the fixed pieces' lights (#171): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the point lights and light puddles of the fixed pieces of Resume (bridge obelisks, avenue / plaza / promenade lamps, quay and pergola garlands, tower puddles, fountain), and the puddle of each `StreetNeon`, go through the same box occlusion as windows and neons; a hidden one is not published.

**Architecture:** `src/city/lights.ts` already owns the occlusion (`occluded`, a sweep by screen `minX` over `Target`s, each with the index of its own solid). It gains a `FixedLight` type (accents + the point that decides occlusion + the half-open range of its own solids), a builder `fixedLights(accents, own)`, a helper `placeLit(solids, out, lit)` and `visibleLights(ls, solids)`, which runs `occluded` over them and returns the accents of the visible ones. `Target.own` becomes a range so a lamp exempts its post and a fountain its basin and spout. The fixed pieces (`plazaAndTower`, `bridge`, `westQuay`, `promenade` in `fixed.ts`; `streets`/`lampRow` in `streets.ts`) stop pushing to `accents: Accent[]` and push `FixedLight`s; `city()` keeps them in `scene.fixedLights` and, once `solids` is complete (after `cars`), pours `visibleLights(fixed, solids)` into `scene.accents`. Inside `lights()`, each neon's puddle is tested the same way and dropped alone when hidden.

**Tech Stack:** TypeScript, Vitest.

**Spec:** issue #171, triage "Agent Brief" comment of 2026-11-08 (behaviour, acceptance criteria, out of scope). Absorbs #178.

## Global Constraints

- `hides()`, `isBehind()`, `hullsOverlap()`, `screenHull()` in `src/iso/depth.ts` are not edited.
- Occlusion box of a light = `lightBox([p])` (the point padded by 0.05) where `p` is: for a `dot`, its `at`; for a puddle (the three concentric polys of `puddle()`), its ground centre = `centroid` of the first ring's points. A puddle is one light: its three rings are kept or dropped together.
- A light is hidden if `hides(box, bounds(solid))` for some solid whose index is outside the light's own range `[from, to)`. Own solids: the lamp's post (`lamp().solids`), the fountain's basin and spout (`fountain().solids`), the obelisk prism and its cone for the obelisk point. Garland dots and the tower puddles have no own solids (`[0, 0]`).
- A neon's puddle has no own solids (as the neon slot today, `target(s.slot.pts, -1)`): it lies 1 u in front of a camera-facing wall, so the owner building is behind it on that axis and cannot hide it. If hidden, only the puddle's three rings leave `StreetNeon.accents`; the neon (halo + tube) stays. No rng draw moves.
- Unchanged: the kit's accents (`piece.accents` of every placed piece, the water tower and the footbridge: clocks, helipads, beacons, signs, the footbridge garland), `neon.signs`, `neon.promenade`, `tower`, `bathed`, the windows. `lamp()`, `puddle()`, `fountain()`, `place()`, `garland()` in `src/kit/props.ts` are not edited (other scenes use them).
- `src/scenes/world-baseline.test.ts`: only the `accents` hashes of `WORLD`, `ZONES.cv` and `RESUME_LAB` change, re-recorded once with a `// #171:` comment line. `solids`, `ground`, `renderList`, the other zones and `PIECES` must not move.
- Out of scope (brief): `neon.promenade` sliding lights and city-anim lights; partial clipping of puddles; the z false positive of `hides`; moving pieces or zoning; coplanar-contact windows (#144).
- `npm test` and `npm run typecheck` green.

## Measured on `main` (3fd6853), before any change

World seed (`city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3))`), brute-force `hides()` with the boxes above, own solids excluded:

- Hidden fixed lights: the obelisk point (275.4, 216.4, 7.1) behind an `office` prism of the block at (281.5..289.5, 219.5..227.5); six avenue lamps on y 205 at x ≈ −47.7, −23.7, 96.3, 108.3, 120.3, 156.3 (behind row-3 buildings and the tower); two west-quay garland dots at (191.2, 197.2, 3) and (191.2, 198.7, 3), behind the dock crane. The brief's "about ten lamps" counted with another box; the seed test asserts an empty offender list, so the count does not matter.
- Not hidden: the two tower puddles, the fountain puddle, the two plaza lamps, every neon puddle.
- Rejected box for puddles: the AABB of the whole 2.5-radius octagon. With it the crater-jungle cones south of the plaza mark the tower puddles hidden, which contradicts the criterion that they stay. #178 framed the test on the puddle's ground point.

## Acceptance criteria → tasks

- No fixed point or puddle left in `scene.accents` is hidden (world seed): task 3.
- Obelisk point (275.4, 216.4, 7.1) not in `scene.accents`: task 3.
- Each published `StreetNeon` puddle not hidden; a hidden one drops only the puddle: task 2.
- Tower puddles and visible plaza lamps stay: task 3.
- Synthetic: lamp with a foreign prism in front disappears; its post does not hide it: task 1.
- Kit accents unchanged: task 3.
- Baseline hashes + before/after screenshots: task 3 (hashes), task 4 (screenshots).
- `npm test`, `npm run typecheck`: end of every task.

## Assumptions

- Brief option chosen: run the fixed lights through the same box occlusion after building `solids` and drop the hidden ones (the brief's two options combined, which is its "Comportamiento esperado").
- The evaluating point is the light, not its halo: a dot's radius `r` is bloom, not geometry, like a window is tested by its quad and not its glow.
- Garland dots are tested one by one; a garland's posts are not "own" (a post in front of a bulb hides it). The brief counts the two quay garland dots as hidden, which only holds without that exemption, and the dock crane is not part of the garland anyway.
- `scene.fixedLights` (all fixed lights, before filtering) is added to `CityScene` so the tests can check the oracle against the own ranges; nothing else reads it.
- The fixed lights enter `scene.accents` after `cars()` (all solids exist) and before the windows of `lights()`. The order of `scene.accents` changes; drawing is additive and `accentsByZone` splits by position, so order is not observable on screen.
- No `CONTEXT.md` entry and no ADR: no new domain term; "fixed light" stays a docstring word in `lights.ts`.
- Every solid counts as an occluder, cars included (grilling Q3). The brief: "Si los tapa en pantalla una caja sólida que no es de la propia luz, no se publican". `cars()` parks static solids (`src/city/fixed.ts`, `cars`); nothing animates them. Rejected: running the filter before `cars()`, which would let a parked car cover a published lamp.
- The puddle's z is the z passed to `puddle()` (grilling Q5): the centroid of a ring is `(x, y, z)` of the call (`src/kit/props.ts`, `puddle`). For the neon puddle that is `lot.z` (`lights.ts`, `puddle(..., scene.placed[owner]!.placed.lot.z)`), for the tower puddles the default 0.12. Task 2 computes the same point from the slot, so the test oracle (ring centroid) and the implementation agree by construction.
- Task 2's synthetic occluder (grilling Q12) is a low prism (h ≤ 1) about 1.5 u in front of the puddle centre, on the camera side. It covers the ground point on screen but stays below the slot, which sits 2.4..3.6 above the lot, so `free` does not change. The implementer pins exact numbers by checking the slot stays in `neons`.
- The task 3 oracle also asserts all-or-none (grilling Q14): for each fixed light, either all its accents are in `s.accents` or none are.
- Captures (grilling Q16): the lab has no URL parameter for zoom. Task 4 frames Resume with key `2`, then zooms by setting the Pixi stage's scale and position through `window.__PIXI_DEVTOOLS_WRAPPER__.stage` (CLAUDE.md, "PixiJS DevTools in agent-browser"), at viewport `1600 900 2`. If that fails, it crops a full-frame capture.
- The stage-3 evals write the failing tests of tasks 1–3 ahead of the implementation; in stage 4 step 1 of each task is "confirm the test exists and fails".

## Review Focus

1. **Own range exemption.** With point boxes, today's own solids happen not to be strictly behind-separated from their light (the bulb straddles the post top, the fountain puddle lies inside the basin and spout's footprint), so the exemption is not visible on the world seed. It is still the brief's rule and guards future pieces (a taller spout, a lamp with a hood). The range must cover exactly the light's own solids and no neighbour. Pinned: task 1 test "a lamp with a foreign prism in front disappears" (the foreign prism is pushed after the lamp, outside its range) and task 3 test "tower puddles, fountain and plaza lamps stay".
2. **Puddle kept or dropped whole.** Three rings, one decision. Pinned: task 1 test "a puddle is one light".
3. **Kit accents untouched.** A refactor of `place()` would silently filter kit lamps of `landmarks.ts`. Pinned: task 3 test "kit accents unchanged" and `PIECES` hashes.
4. **Rng order.** The neon puddle check must not consume or reorder draws: every window, neon colour and flicker stays. Pinned: task 2 (existing quota/neon tests) and baseline `solids` hash unchanged in task 3.
5. **Baseline moves only accents.** Pinned: task 3 step on `world-baseline.test.ts`.

---

### Task 1: `FixedLight` and `visibleLights` in `lights.ts`

**Files:**
- Modify: `src/city/lights.ts` (`Target`, `target`, `occluded`, new exports)
- Test: `src/city/lights.test.ts` (new `describe("fixed lights")`)

**Interfaces:**
- Produces:
  - `export interface FixedLight { accents: Accent[]; at: Vec3; own: readonly [number, number] }` — `at` is the occlusion point; `own` the half-open range of own solids in the scene's `solids`.
  - `export function fixedLights(accents: Accent[], own?: readonly [number, number]): FixedLight[]` — each `dot` becomes one light at its `at`; all `poly` accents together become one light (a puddle) at `centroid` of the first poly's `pts`. `own` defaults to `[0, 0]`.
  - `export function placeLit(solids: Solid[], out: FixedLight[], lit: Lit): void` — pushes `lit.solids` and `fixedLights(lit.accents, [from, solids.length])`.
  - `export function visibleLights(ls: FixedLight[], solids: Solid[]): Accent[]` — accents of the lights not hidden, in input order.
- `Target.own` becomes `readonly [number, number]`; windows use `[o, o + 1]`, neon slots `[0, 0]`.

- [ ] **Step 1: Write the failing tests** in `lights.test.ts`:
  - `"a lamp with a foreign prism in front disappears"`: `const s: Solid[] = []; const out: FixedLight[] = []; placeLit(s, out, lamp(v3(0, 0, 0))); s.push(prism(1, 1, 0, 1, 1, 10));` → `expect(visibleLights(out, s)).toEqual([])`.
  - `"its own post does not hide the lamp"`: same lamp, no foreign prism → `expect(visibleLights(out, s)).toEqual(lamp(v3(0, 0, 0)).accents)` and `expect(out[0]!.own).toEqual([0, 1])`.
  - `"a puddle is one light, kept or dropped whole"`: `fixedLights(puddle(5, 5, "amberBleed"))` has length 1, `at` ≈ `(5, 5, 0.12)`; with `prism(6, 6, 0, 2, 2, 10)` in front, `visibleLights` returns `[]`; without it, the three rings.
  - `"a garland is one light per dot"`: `fixedLights(garland([v3(0, 0, 3), v3(0, 3, 3)]))` length equals the number of dots.
- [ ] **Step 2: Run** `npx vitest run src/city/lights.test.ts` — FAIL (exports missing).
- [ ] **Step 3: Implement** the interfaces above. `visibleLights` builds `Boxes` as `lights()` does and calls `occluded(ls.map(l => target([l.at], l.own)), boxes)`; the own check in `occluded` becomes `y.s >= t.own[0] && y.s < t.own[1]`.
- [ ] **Step 4: Run** `npx vitest run src/city/lights.test.ts` and `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `fix(#171): fixed lights through the box occlusion`.

### Task 2: the neon puddle

**Files:**
- Modify: `src/city/lights.ts` (`lights()`, building of `neons`)
- Test: `src/city/lights.test.ts`

**Interfaces:**
- Consumes: `target`, `occluded` (task 1 shapes).

- [ ] **Step 1: Write the failing tests:**
  - In the seed loop: `"no neon puddle is hidden (brute-force oracle)"`: for each `n` of `l.neons`, the puddle rings are the `n.accents` with `color` ending in `Bleed` and 8 points; their ground centre (`centroid` of the first ring) is not `hidden(lightBox([c]), bs, hs)`.
  - Synthetic, next to the corner-shop neon test: `"a hidden neon puddle is dropped, the neon stays"`: a bars piece with an open south neon slot (as the existing synthetic neon tests build it) plus a foreign tall prism just south of the puddle centre (`c.y + 1` side, in front) that does not cover the slot itself → the neon is in `neons`, its `accents` have the two neon polys and no 8-point ring.
- [ ] **Step 2: Run** — FAIL on the synthetic test.
- [ ] **Step 3: Implement:** after `free` is final, compute the puddle centre of each slot (`v3(c.x + slot.wall.x, c.y + slot.wall.y, lot.z)`, the same point `puddle()` gets today), `occluded` them with own `[0, 0]`, and build `accents` without the `puddle(...)` part when hidden. No extra rng draw; the colour draw order stays.
- [ ] **Step 4: Run** `npx vitest run src/city/lights.test.ts` — PASS (existing neon/quota tests included).
- [ ] **Step 5: Commit** `fix(#171): drop hidden neon puddles`.

### Task 3: fixed pieces publish `FixedLight`s, `city()` filters them

**Files:**
- Modify: `src/city/fixed.ts` (`plazaAndTower`, `bridge`, `westQuay`, `promenade`), `src/city/streets.ts` (`streets`, `streetFurniture`, `lampRow`), `src/scenes/city.ts` (`CityScene.fixedLights`, `city()`)
- Modify (signature follow-up): `src/city/fixed.test.ts`, `src/city/streets.test.ts` — the `built()` helpers pass a `FixedLight[]` and expose `accents = lights.flatMap(l => l.accents)`, so the existing assertions stay as they are.
- Modify: `src/scenes/world-baseline.test.ts` (accents hashes)
- Test: `src/scenes/city.test.ts` (new tests)

**Interfaces:**
- Consumes: `FixedLight`, `fixedLights`, `placeLit`, `visibleLights` (task 1).
- Produces: `plazaAndTower(solids, ground, lights: FixedLight[], rng)`, `bridge(solids, lights: FixedLight[])`, `westQuay(solids, lights: FixedLight[])`, `promenade(solids, lights: FixedLight[]): Vec3[]`, `streets(ground, solids, lights: FixedLight[])`; `CityScene.fixedLights: FixedLight[]`.

- [ ] **Step 1: Write the failing tests** in `city.test.ts` on the world seed scene:
  - `"no fixed light left in the accents is hidden (brute-force oracle)"`: for every `f` of `s.fixedLights` whose accents are all in `s.accents` (same reference), `bs.some((b, i) => (i < f.own[0] || i >= f.own[1]) && hides(lightBox([f.at]), b))` is false; and every hidden `f` has none of its accents in `s.accents`. Also `s.fixedLights.length > 50`.
  - `"the obelisk point behind the block is gone"`: no `dot` in `s.accents` within 0.05 of `(275.4, 216.4, 7.1)`.
  - `"tower puddles, fountain and plaza lamps stay"`: 6 polys `amberBleed` alpha 0.25 and 3 alpha 0.35 in `s.accents` inside the plaza rect; dots at `(PLAZA.x + 2.3, PLAZA.y + PLAZA.d / 2 + 0.3, 5.05)` and `(PLAZA.x + PLAZA.w - 2.3, …)` present.
  - `"kit accents unchanged"`: every accent of every `s.placed[i].piece.accents` is in `s.accents` (by reference).
  - The oracle test also asserts, for each `f`, that its accents are either all in `s.accents` or none are.
- [ ] **Step 2: Run** `npx vitest run src/scenes/city.test.ts` — FAIL.
- [ ] **Step 3: Implement.** Fixed pieces: lamps and the fountain with `placeLit`; obelisk point with `fixedLights([dot], [i, i + 2])` where `i` is the obelisk prism's index; garlands and tower puddles with `fixedLights(...)`. `city()`: `const fixed: FixedLight[] = []`, pass it to the five calls, and after `cars(solids, rng)` do `accents.push(...visibleLights(fixed, solids))`; return `fixedLights: fixed`. Update the `accents` comment of `CityScene`.
- [ ] **Step 4: Run** `npm test` — only the three `accents` hashes of `world-baseline.test.ts` fail; check `solids`/`ground`/`renderList` and `PIECES` pass. Re-record those three with a `// #171: hidden fixed lights and neon puddles are not published; accents re-recorded once.` line.
- [ ] **Step 5: Run** `npm test` and `npm run typecheck` — PASS.
- [ ] **Step 6: Commit** `fix(#171): fixed pieces' lights are occlusion-checked`.

### Task 4: before/after captures (controller, not an implementer)

- [ ] With the dev server (`npm run dev -- --host --port 5173`) and `agent-browser`, capture `/lab/resume.html` zoomed on the bridge's east head (x 264..282, y 207..224) and on the avenue's north sidewalk by the tower (x 90..125, y 200..210), on `origin/main` and on the branch. Save to `docs/superpowers/specs/assets/171-fixed-lights/` (`bridge-before.png`, `bridge-after.png`, `avenue-before.png`, `avenue-after.png`), as #142–#144 did.
- [ ] Commit `captures(#171): before/after screenshots`.

## Grilling

One round (griller model: fable). The revisions added assumptions and test assertions and kept the same seam, so no second round was run.

16 questions. Answers by source:
- CODE: 13
- ISSUE: 2
- DOC: 1
- NO SOURCE: 5, all technical assumptions; none was a spec ambiguity or out of scope

Answers:
1. **Order of `scene.accents`.** CODE `src/scenes/world-baseline.test.ts`: `buildRenderList(w.solids)` takes solids only. CODE `src/world/frame.ts:69-80`: `drawAccents` fills each accent independently. CODE `src/world/stage.ts:88,124`: `g.blendMode = "add"`, which commutes. DOC CONTEXT.md, Accent: "drawn on top of everything with additive blend".
2. **Which hashes move.** CODE `src/scenes/world.ts:62`: `city()` is built only when `cv` is among the zones, so `portfolio` and `blog` alone carry no city accents. Task 3 step 4 checks this empirically.
3. **Cars as occluders.** ISSUE (brief): "una caja sólida que no es de la propia luz". CODE `fixed.ts` `cars`: static solids. Recorded as an assumption.
4. **Point boxes.** CODE `src/city/lights.ts:30-33`: `lightBox` pads 0.05 today. Windows are already near-degenerate boxes (flat quads), so the sweep handles thin boxes. Task 1 tests point boxes.
5. **Puddle z.** NO SOURCE, technical assumption: the z passed to `puddle()`. Recorded.
6. **Obelisk own range.** CODE `fixed.ts`, `bridge`: the obelisk prism and its cone go in a single `solids.push(prism(...), { kind: "cone", ... })`, so the range is `[i, i + 2)`.
7. **What a puddle is.** CODE `src/kit/props.ts:98-104`: `fountain().accents = puddle(...)`, three polys. `lamp()` is one dot. `Lit` is exported from `src/kit/props.ts:13`. `fixedLights` is only fed fixed-piece accents: lamps, the fountain, single puddles, garlands and the obelisk dot.
8. **What `place()` does.** CODE `src/kit/props.ts:16`: it only pushes solids and accents. `lamp(at)` returns geometry at `at` (`props.ts:19-22`).
9. **Readers of `Target.own`.** CODE `lights.ts:35-57,72,103`: `Target`/`target` are not exported. The callers are the window targets and the neon slots. `y.s` indexes `boxes = scene.solids.map(bounds)`, the same array the pieces push into.
10. **Tower puddles and the box.** ISSUE (brief): "Los dos charcos de la torre (franja este de la plaza) hoy no están tapados y tienen que mantenerse." The brief defines no box. The AABB box breaks this criterion and the point box satisfies all of them: technical assumption, recorded in "Measured on main".
11. **Does `fixedLights` move a hash?** CODE `world-baseline.test.ts`: it hashes the named fields `w.solids`, `w.ground` and `w.accents` of `world()`, never the `CityScene`. No snapshot in the city tests (grep for `toMatchSnapshot`: none).
12. **Neon puddle occluder.** NO SOURCE, technical assumption: a low prism. Recorded.
13. **Positional asserts in the fixed tests.** CODE: grep for `toEqual` on accents in `fixed.test.ts` and `streets.test.ts` finds none; they filter and count. The pieces push either dots or puddles, never both mixed into one `Lit`.
14. **Partial puddles.** NO SOURCE, technical assumption: an all-or-none assertion was added to task 3.
15. **Other callers.** CODE: grep for `bridge(`, `streets(`, `westQuay(`, `promenade(`, `plazaAndTower(` finds only `src/scenes/city.ts:51-59`, `fixed.test.ts` and `streets.test.ts`.
16. **Captures.** CODE `src/lab/page.ts`: only the `bloom` and `speed` parameters. The assets folder exists (`docs/superpowers/specs/assets/142-plinth-ground/`). NO SOURCE for zooming, technical assumption: stage scale through the devtools wrapper. Recorded.

Issues opened: none.
