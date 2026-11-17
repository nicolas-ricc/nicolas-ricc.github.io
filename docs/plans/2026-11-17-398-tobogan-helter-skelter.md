# Giant slide rebuilt as a helter skelter (#398): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fair's giant slide (`slide()` in `src/scenes/fair.ts`) with a British helter skelter: a striped conical trunk, a lantern with windows, a segmented roof and a flag, a continuous chute of 2.5 turns on steel brackets, a straight run-out, a door with steps, and two piles of mats. The piece has no `dot` accents.

**Architecture:** Everything stays inside `slide(out, accents)` in `fair.ts`, built from existing primitives, plus two small engine extensions in `src/iso/solids.ts`. First, `cylinder` accepts `plates`; the tessellator already forwards them, so only the type is missing. Second, `dome` accepts an optional `alt` material for its odd sides, which gives the roof its gores. The trunk is a stack of 16-sided cylinders whose radius shrinks with height. The chute is three chains of `beam`s on a helix whose inner radius is `CHUTE.k ×` the tower radius. This clearance keeps the depth sort right; a prototype checked it with `sortByDepth`, see Decision 2.

**Tech Stack:** TypeScript, vitest, the iso engine in `src/iso`, agent-browser for the storybook captures.

**Spec:** `docs/superpowers/specs/2026-11-16-tobogan-helter-skelter-design.md` (issue #398).

## Global Constraints

- Only `FAIR_MATS` materials (`fair.ts:56`).
- **No `dot` accent** in the piece. No accent at all is needed: the piece must read well without lights.
- Every non-slender solid has max z ≤ 18.5. Beams count, and the flag is included (`fair.test.ts` "nothing non-slender exceeds 18").
- Fair budget: raised solids in (250, 700], accents ≤ 200. The baseline is 434 raised solids, 58 of them the old slide, and 147 accents.
- Footprint: the piece stays inside x 108…128, y −310…−272 (radius ≤ 10 around `(118, −292)`). It does not touch any other new or old piece's footprint (`fair.test.ts` "footprints of the new pieces").
- `legacyOnly`: the piece does not exist.
- The chute is built from `beam` chains only, never `rotBox`/`poly`/`ramp`.
- `src/scenes` and `src/iso` stay Pixi-free. Code, comments and identifiers are in English (`src/english.test.ts`).
- `npm test` and `npm run typecheck` pass.

## Decisions (technical assumptions, declared)

1. **Helix.** Parameter `t ∈ [0, 1]` with angle `θ(t) = π + 2π·turns·t`, so it goes from west (θ = π) to east (θ ≡ 0) with θ increasing. Since y points south, it passes north, then south, and so on. Height is `z(t) = CHUTE.z1 + (CHUTE.z0 − CHUTE.z1)·(1 − t)^1.2`, which is strictly decreasing and flattens toward the end ("la última media vuelta se aplana"). The vertices sit at `t = k / (CHUTE.perTurn·turns)` for k = 0…40, every 22.5°, so the 45° diagonals, where depth is weakest, are vertices. The run-out leaves from the east point, tangent, heading south (+y).
2. **Clearance instead of slicing.** The inner radius of the bed at height z is `CHUTE.k·(rAt(z) + (SLIDE.r − SLIDE.rTop)/8)`, with `rAt(z) = SLIDE.r − (SLIDE.r − SLIDE.rTop)·z/SLIDE.trunk` and `CHUTE.k = 1.25`. This radius is continuous and grows as the chute descends. A prototype sorted bands, lantern, chute chains and brackets with `sortByDepth` and checked that every chute piece facing the camera is drawn after every overlapping band at the same height, and that every piece facing away is drawn before. It got zero violations for k ≥ 1.15 with 4, 6, 8 or 12 bands and with 16 or 24 segments per turn. It failed with k ≤ 1.12. The spec's "≥ ~1.4" was a guess, and 1.25 leaves a margin. The gap is 1.15 u at the base and is bridged by the brackets.
3. **Trunk bands.** There are 7 cylinders with 16 sides each: band 0 spans z 0–3 (it holds the door and its sign), and bands 1–6 are 1.5 high each, from z 3 to 12. Each band's radius is `rAt(bottom)`. The step between bands is 0.175 (0.35 at z 3). It reads as a trim ring, and the stripes stay aligned because every band has the same `sides` and rotation.
4. **Stripes.** Band material is `whitewash`. Each even wall `i` gets a `signal` plate `{ wall: i, shape: "rect", u0: 0, u1: 1, z0: bottom, z1: top }`. Bands 1, 3 and 5 add a `safety` diamond (`shape: "poly"`) centred on each signal wall; this covers the optional diamonds. Wall `i` of `regular()` faces the angle `22.5°·(i + 1)`, so wall 3 faces south and wall 15 faces east.
5. **Roof gores.** `dome` gets `alt?: Material`: side `i` (in every ring) is painted `alt` when `i` is odd. The roof is `dome` `signal`/`alt: "whitewash"`, r 2.1 (11 % eave over the 1.9 lantern), h 1.5, 16 sides, 3 rings, at z 14.4.
6. **Door on the south.** The door is at θ = 90°, where the chute's lowest pass is at t = 0.7, z ≈ 3.0. That is above the door (sill 0.8, top 2.2) and the sign (2.3–2.8). The bracket at θ ≡ 90° is skipped so it does not cross the door. Brackets go on every even vertex (every 45°) whose z ≥ 1.2.

## Review Focus

1. Depth at every angle: a chute or bracket beam facing the camera must never end up under a trunk band (the tower "peeking over" the chute), and the back side must never paint over the tower. This is pinned by the sort test in Task 2, against the whole fair scene and not only the piece.
2. Chain continuity at the helix → run-out joint: the run-out's first beam starts exactly at the last helix beam's end, in each of the three chains.
3. The flag and the mast are the highest solids: their max z ≤ 18.5. The test does not count beams as slender, so the mast is checked.
4. The exhibit framing (`tobogan` in `src/lab/exhibits.ts`) must follow the new size, or the storybook crops the piece. This is pinned by the exhibits tests in Task 3.
5. `legacyOnly` must not leak any slide solid: pinned in Task 3.

---

### Task 1: Engine — cylinder plates, dome gores; tower of the slide

**Files:**
- Modify: `src/iso/solids.ts:22-24` (types), `solids.ts:227-245` (`dome`), `solids.ts:420-422` (`facesOf`)
- Modify: `src/scenes/fair.ts` (`SLIDE`, its comment, `slide()`: tower part)
- Test: `src/iso/solids.test.ts`, `src/scenes/fair.test.ts` (replace the `describe("giant slide (#327)")` block)

**Interfaces:**
- Produces: `Solid` `cylinder` gains `plates?: Plate[]`; `dome` gains `alt?: Material`.
- Produces: `export const SLIDE = { x: 118, y: -292, r: 3.5, rTop: 2.1, trunk: 12, h: 15.9, turns: 2.5 } as const;` with a rewritten doc comment (helter skelter: conical striped trunk of radius `r` → `rTop` up to `trunk`, lantern, roof tip at `h`, chute of `turns`).
- Produces: `export const CHUTE = { z0: 11.5, z1: 0.4, w: 1.1, k: 1.25, perTurn: 16, exit: 5 } as const;` (Task 2 uses it).
- Produces: private `rAt(z: number): number` and `chuteR(z: number): number` (the inner radius `Ri`) in `fair.ts` (Decision 2).

- [ ] **Step 1: Write the failing tests.**
  - `solids.test.ts`, `describe("cylinder plates and dome gores (#398)")`:
    - `it("a cylinder carries plates on its walls; bounds ignore them")`: a cylinder with `sides: 16` and `plates: [{ wall: 3, shape: "rect", u0: 0, u1: 1, z0: 0, z1: 1, mat: "signal" }]`. Expect `tessellateAll` to have exactly one `signal` face more than the cylinder without plates, with the normal of wall 3 (`y > 0.9`). Expect `bounds` to equal the bounds without plates.
    - `it("a dome paints its odd sides in alt")`: `dome` with `sides: 8, rings: 2, mat: "signal", alt: "whitewash"`. Walk `tessellateAll(s).slice(1)` (the base is face 0, and each ring has 8 faces in side order). Expect side `i` to have mat `i % 2 ? "whitewash" : "signal"`. Without `alt`, every face is `signal`.
  - `fair.test.ts`: replace the `giant slide (#327)` block with `describe("giant slide: helter skelter (#398)")`, starting with:
    - `it("SLIDE: base r 3.5, top r 2.1, trunk 12, roof tip 15.9, 2.5 turns")`: `expect(SLIDE).toEqual({ x: 118, y: -292, r: 3.5, rTop: 2.1, trunk: 12, h: 15.9, turns: 2.5 })`.
    - `it("trunk: 16-sided whitewash bands whose radius shrinks with height, signal stripes on alternate walls")`: `bands = build(slide).solids.filter(cylinder && mat whitewash && sides 16 && at.z < SLIDE.trunk)` sorted by `at.z`. Expect `bands.length >= 3`, `bands[0].at.z === 0`, `bands[0].r === SLIDE.r`, the last band's top `=== SLIDE.trunk`, `r` strictly decreasing, consecutive bands touching (`top(k) === bands[k+1].at.z`), and every `r >= SLIDE.rTop`. For every band: the set of walls with a full-width `signal` rect plate (`u0 0, u1 1`, spanning the band's z) is exactly the 8 even walls.
    - `it("lantern with 8 windows, gored roof at 15.9, flag ≤ 18.5")`: there is one cylinder `whitewash` with `at.z === SLIDE.trunk`, `r < SLIDE.rTop` and 8 `glass` plates. There is one `dome` with `alt` defined, `at.z + h === SLIDE.h` and `r` larger than the lantern's. The highest solid of the piece (`max bounds.max.z`) is > `SLIDE.h` and ≤ 18.5, and it is a beam or poly (mast or cloth).
    - `it("no dot accents")`: `build(slide).accents.filter(dot)` has length 0.
- [ ] **Step 2: Run** `npx vitest run src/iso/solids.test.ts src/scenes/fair.test.ts`. Expected: the new tests FAIL. TypeScript errors on `alt`/`plates` are acceptable red.
- [ ] **Step 3: Implement.** Engine: add `plates?: Plate[]` to `cylinder` and `alt?: Material` to `dome`, and pass `s.alt` through `facesOf` into `dome()`. `slide()`, tower part: the 7 bands of Decision 3 with the plates of Decision 4. Lantern: `cylinder` at z 12, r 1.9, h 2.4, 16 sides, `whitewash`, with 8 `glass` arch windows (`shape: "poly"`, pts `(0.25, 12.6) (0.75, 12.6) (0.75, 13.5) (0.5, 13.9) (0.25, 13.5)`) on the even walls. Roof: Decision 5. Mast: `beam` `steel` w 0.1 h 0.1 from `(x, y, 15.9)` to `(x, y, 17.6)`. Cloth: `poly` `livery`, footprint `(x+0.05, y−0.03)…(x+1.0, y+0.03)`, z 16.9, h 0.6, with a `whitewash` cross and a narrower `signal` cross as plates on its south wall (wall 2). Balcony at the chute start (west): `prism` `deck` from x `SLIDE.x − (Ri(11.5) + CHUTE.w)` to `SLIDE.x − rAt(10.5)·cos(π/16) − 0.01` (its east face is west of the top band's AABB, so the depth sort separates them on x), y −292…−290, z 11.5, h 0.15, plus two `steel` rail beams (outer edge and south edge) at +0.8. Remove the ladder, the old 24 treads and the amber dot.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#398): helter skelter tower: striped trunk, lantern, gored roof, flag`.

### Task 2: Chute, brackets and run-out, with depth pinned

**Files:**
- Modify: `src/scenes/fair.ts` (`slide()`: chute part)
- Test: `src/scenes/fair.test.ts` (same `describe` block)

**Interfaces:**
- Consumes: `SLIDE`, `CHUTE`, `rAt` (Task 1).
- Produces: inside `slide()`, three beam chains along Decision 1/2's helix (n = `CHUTE.perTurn·SLIDE.turns` = 40 beams each), followed by the run-out:
  - bed: `signal`, w `CHUTE.w`, h 0.15, axis at radius `Ri + w/2`, z `z(t) + 0.075`;
  - outer wall: `signal`, w 0.15, h 0.5, axis at radius `Ri + w − 0.075`, z `z(t) + 0.4`;
  - fillet: `whitewash`, w 0.2, h 0.08, same radius as the wall, z `z(t) + 0.69`.
  - Run-out: one beam per chain from the helix end `P` to `P + (0, CHUTE.exit, 0)`, same section, then a `deck` prism under the bed: x `x + Ri(z1)` … `+ CHUTE.w`, y `SLIDE.y` … `+ CHUTE.exit`, z 0, h `CHUTE.z1`.
  - Brackets: `steel` beam, w 0.15, h 0.15, at every even helix vertex with z ≥ 1.2 except θ ≡ 90°. Each runs from the trunk wall `(rAt(z − 1)·cos(π/16) + 0.02)` at z − 1 to radius `Ri + 0.4` at z − 0.05.

- [ ] **Step 1: Write the failing tests** (helper in the test: `chain(mat, w)` = the piece's beams with that mat and w, in emission order):
  - `it("chute: three continuous chains of ≥ 2 turns, z strictly decreasing, radius growing as it descends")`: for `chain("signal", CHUTE.w)`, `chain("signal", 0.15)` and `chain("whitewash", 0.2)`, drop the last beam (the run-out). Expect `beam[k].to` to equal `beam[k+1].from` within 1e-6 on x, y and z. Expect `from.z` to be strictly decreasing. Expect the plan radius of `from` around `(SLIDE.x, SLIDE.y)` to be strictly increasing. Expect the accumulated unwrapped angle to be ≥ 2·2π (and ≈ `SLIDE.turns`·2π within 1e-6). For the bed chain, expect the first `from.z − 0.075` ≈ `CHUTE.z0` and the last helix `to.z − 0.075` ≈ `CHUTE.z1`.
  - `it("run-out: straight, tangent at the helix end, at z ≤ 0.6, over a low deck")`: for each chain, the last beam's `from` equals the previous beam's `to` (1e-6) and its `from.z === to.z ≤ 0.6`. Its length is `CHUTE.exit`. Its direction is perpendicular to the radius at `from` (dot product < 1e-6). A `deck` prism exists under the bed run-out, with top `=== CHUTE.z1`.
  - `it("steel brackets every ~45° from the trunk to the bed")`: there are ≥ 15 `steel` beams with w 0.15. Each one's `to.z < from.z` is false (they rise outward). Consecutive bracket angles differ by ≤ 50° (one 90° gap is allowed at the door).
  - `it("depth: chute and brackets facing the camera are drawn after the trunk, those facing away before (whole fair sort)")`: `s = A()`, `order = sortByDepth(s.solids)`, `idx` = position map. Tower = the piece's `whitewash` 16-sided cylinders (bands and lantern, picked from `s.solids` inside x 108…128, y −310…−272). Beams = `s.solids` beams in the same box, except the mast. For each beam `b` and tower `c` with z overlap (`b.min.z < c.max.z && c.min.z < b.max.z`) and with silhouettes overlapping (`hullsOverlap` of `convexHull(project(tessellateAll(x) vertices))`): let `θ` = the angle of the beam's bounds centre around `(SLIDE.x, SLIDE.y)` and `f = cos(θ − π/4)`. If `f > 0.1`, expect `idx(b) > idx(c)`. If `f < −0.1`, expect `idx(b) < idx(c)`. Also expect the number of checked pairs to be > 50, so the test bites.
- [ ] **Step 2: Run** `npx vitest run src/scenes/fair.test.ts -t "#398"`. Expected: FAIL.
- [ ] **Step 3: Implement** the chains, run-out, deck and brackets as in Interfaces. Compute the helix vertices once per call; `Ri(z)` is as in Decision 2.
- [ ] **Step 4: Run** the same command. Expected: PASS. If the depth test fails, raise `CHUTE.k` (never above 1.45, footprint), and if that fails, report it. Do not loosen the 0.1 tolerance.
- [ ] **Step 5: Commit** `feat(#398): continuous helter skelter chute, brackets and run-out`.

### Task 3: Door, steps, mats; exhibit framing; legacy and footprint

**Files:**
- Modify: `src/scenes/fair.ts` (`slide()`: entrance and mats)
- Modify: `src/lab/exhibits.ts:175-177` (`tobogan` box, h and its comment)
- Test: `src/scenes/fair.test.ts` (#398 block; the `legacyOnly` test in "footprints of the new pieces"), `src/lab/exhibits.test.ts:109`

**Interfaces:**
- Consumes: `SLIDE`, `CHUTE` and the band layout of Task 1.

- [ ] **Step 1: Write the failing tests.**
  - `it("door with sign on the south wall, 8 steps with handrails, two mat piles")`: band 0 has a `hull` rect plate on wall 3 with `z0 ≥ 0.6` and `z1 ≤ 2.4`, and a sign plate (`safety`) on wall 3 above it, below `z 3`. There are 8 `deck` prisms with `d === 0.2` stepping down away from the door. Their `at.y` is strictly increasing and `h` strictly decreasing, the first one's `at.y ≥ SLIDE.y + SLIDE.r·cos(π/16)`. There are two `steel` handrail beams rising toward the door. There are exactly two groups of `deck` prisms with `h ≤ 0.2` stacked into piles (each pile ≥ 2 prisms, plan boxes overlapping), one within 2 u of the run-out's end and one within 2 u of the steps.
  - `it("footprint: whole piece inside x 108…128, y −310…−272")`: on the piece's bounds.
  - Update `legacyOnly builds the fair without the new pieces`: replace the `deck h 14` check with "no `whitewash` cylinder with `sides === 16` and no `dome` with `alt`".
  - `exhibits.test.ts:109`: `tobogan` box becomes the piece's plan box plus 1 u of margin, rounded outward to integers: x0 111, y0 −299, x1 127, y1 −284. If the measured extents differ, use the measured box rounded outward.
- [ ] **Step 2: Run** `npx vitest run src/scenes/fair.test.ts src/lab/exhibits.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Door: plate `hull`, wall 3, band 0, u 0.2…0.8, z 0.8…2.2. Sign: plate `safety`, wall 3, u 0.15…0.85, z 2.3…2.8. Steps: 8 `deck` prisms x 117.4…118.6, step `j` (0 next to the door) at `y = SLIDE.y + 3.5·cos(π/16) + 0.001 + 0.2j`, d 0.2, h `0.8 − 0.1j`. Handrails: `steel` beams w 0.08 at x 117.35 and 118.65 from `(·, steps' far y, 0.9)` to `(·, door y, 1.7)`. Mats: two piles of 3 `deck` prisms 1.4×0.8, h 0.15 each, stacked (z 0, 0.15, 0.3) with a 0.1 offset and alternating `tone: -1`. One pile sits south of the run-out's end, the other west of the steps. Exhibit: update `box` and `h` (the integer the framing test accepts, ≥ the piece's max z) and the comment with the measured heights.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: PASS. That covers the whole fair suite (height, budget, footprints) and the exhibits framing/neighbors.
- [ ] **Step 5: Commit** `feat(#398): helter skelter entrance, mats and exhibit framing`.

### Task 4: Visual verification and captures

**Files:**
- Create: `docs/superpowers/specs/assets/2026-11-17-tobogan/` (before/after JPGs)

- [ ] **Step 1:** Run the dev server and the stage-3 agent-browser script (`.scratch/evals-398.md`) for `lab/storybook.html#tobogan`: desktop 1600×900 at 2×, and phone 412×915 at 2×. Also capture the site at the fair (the world page centred on the slide). Check the inventory items visually: continuous chute, no tower over the chute on the front, no chute painted over the tower on the back, stripes aligned across bands.
- [ ] **Step 2:** Save the after captures next to the before ones taken in stage 3 and commit them with `docs(#398): helter skelter captures`.
