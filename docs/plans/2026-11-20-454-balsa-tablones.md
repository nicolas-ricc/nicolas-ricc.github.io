# Writing: the plank raft at rest with WRITING as a `navy` decal on `timber`, cap 20, at both sites (#454) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `officeDark` board and its cyan accent paint with a plank raft: one `kind: "mesh"` `timber` solid per pose, with WRITING painted as `navy` decal faces on the real horizontal plane (`groundDiagonal`), at cap height 20, at both Writing sites. The suite stays green.

**Architecture:** A new pure module `src/scenes/raft.ts` owns the text-space plan of the raft (planks, joints, beams, sheet), the posed text plane and the mesh. `sign-platform.ts` keeps its public surface (`signAt`, `BLOG_SIGNS`, `seaPlatformAt`, `seaPlatform`, `PLATFORM_DECK`, sites, heave), now built on `raft.ts`. The paint stops being accents: `platformAnimator` has a single solid layer. The lanes, the tall frame and the exhibit boxes are adjusted to the bigger raft. Docs get the minimum that `docs.test.ts` and `docs-glossary.test.ts` need.

**Tech Stack:** TypeScript, Vitest (node, no Pixi in `src/scenes`/`src/iso`), Vite dev server plus agent-browser for the level-3 probe and the captures.

**Spec:** issue #454. Its "Decisiones heredadas" and "Criterios de aceptación" are binding. Story #451: plan comment, D1–D6.

## Global Constraints

- Materials: `timber` = `cityLadder(0xfbefc5)`, `navy` = `cityLadder(0x0a1134)` in `BASE_TONES`. `ISO_TONES` gets the literals that `npm run palette` prints (expected `timber.top` 0xb0a78a, `navy.top` 0x070c24). The contrast `navy`/`timber` is ≥ 7.5 in `top` and in `up`. A plank's tone offset is in {0, +1}, never negative.
- `WRITING_CAP` = 20. `BOARD_TOP` = −0.4. `BOARD_PAD` = 1.6. `PAINT_LIFT` is deleted. `PLANK_W` 2.4, `JOINT` 0.15 (pitch 2.55), `PLANK_H` 0.5, `RAGGED` 0.3, `BEAM_OVERHANG` 1.2. Beam section: 1.4 along a × 0.5 (z −0.9 → −1.4). Beams sit at a = a0 + 1.5, (a0 + a1)/2 and a1 − 1.5.
- Text plane = `groundDiagonal`: u = (√½, −√½, 0), v = (−√½, −√½, 0). The sheet's centre falls on the site at z `BOARD_TOP`.
- `RaftPose = { dz: number; pitch: number; roll: number }`, `REST_POSE = { dz: 0, pitch: 0, roll: 0 }`. Posing uses `rigid(pts, C, pitch, roll, dz)` with C = (site.x, site.y, −1). The plane is posed the same way: `origin' = rigid([origin])`, `u' = rigid([origin + u]) − origin'`, `v'` likewise.
- `signAt(site, pose = REST_POSE)` = `signSpec({ id: "plataforma", text, size: WRITING_CAP, width: SIGN_FONT.width, decal: "navy", ground: true, plane, style: "fill", backing: [raftAt(site, pose)], layouts: LAYOUT, xHeight: CHAINSAW_X·WRITING_CAP, stroke: CHAINSAW_FACE·WRITING_CAP, bar: CHAINSAW_BAR·WRITING_CAP })`, with no `color`.
- `PLATFORM_LAYERS = { solid: "platform.solid" }`. The `platform.lights` layer goes away.
- `LANE_OUT`: (486, 347) → (501, 347) and (500, 405) → (515, 405). The sea end is moved along the direction (515, 405) → (523, 510) so the cover edge falls exactly `FADE_U` before the end. (456, 290), the other vertices and the whole of `LANE_BACK` are untouched. `zoneFrame("blog", "tall")` ends at y 450.
- Code, comments and test names are in English (`src/english.test.ts`). Spec and `CONTEXT.md` prose is in each file's language: Spanish for the spec, English for `CONTEXT.md`.
- `src/lab/signs.test.ts` keeps its rules. Only its call sites change, to the new signatures.
- `npm test` and `npm run typecheck` are green at the end.

## Technical decisions (declared; not in the issue)

1. **No import cycle.** `raft.ts` must not import `sign-platform.ts`, because `BLOG_SIGNS` is built at module load and calls `raftAt`. So `raft.ts` owns `WRITING_CAP`, `BOARD_TOP`, `BOARD_PAD`, `WritingSite`, `PLATFORM_SITES`, `RaftPose`, `REST_POSE` and `LAYOUT`. `sign-platform.ts` re-exports `WRITING_CAP`, `BOARD_TOP`, `WritingSite`, `PLATFORM_SITES`, `RaftPose` and `REST_POSE`, so every existing consumer keeps its import path.
2. **What `RAFT` and `buildRaft` are.** `RAFT` is the frozen record of constants `{ plankW: 2.4, joint: 0.15, plankH: 0.5, ragged: 0.3, beamW: 1.4, beamH: 0.5, beamInset: 1.5, beamOverhang: 1.2 }`. `buildRaft(): RaftPlan` is the deterministic text-space plan: `{ sheet: Rect; planks: { a0, a1, b0, b1, tone }[]; beams: Rect[] }`, with `Rect = { a0, a1, b0, b1 }`. Planks are listed back to front (b decreasing), and the plan is memoised once per module. `raftAt(site, pose): Solid & { kind: "mesh" }` builds the world mesh. `raftPlane(site, pose): TextPlane` is the posed plane.
3. **Rng draw.** `createRng(SEED)`. For each plank in list order, three draws: `a0 += (2·next() − 1)·0.3`, then `a1 += (2·next() − 1)·0.3`, then `tone = next() < 0.6 ? 0 : 1`.
4. **The text frame is left-handed against z** (u × v = (0, 0, −1)). Every face is wound so that `polygonNormal` points outward in the world, for example the top face (a0, b0), (a0, b1), (a1, b1), (a1, b0). A clipped decal is reversed when its world normal has z < 0, so every decal faces +z at rest, like the top it lies on.
5. **Degenerate decal pieces are dropped.** A `clipPolygon` result whose shoelace area is < 1e-9 is not emitted, because a zero-area sliver has no receiving centroid.
6. **The "area" acceptance test, as written, cannot hold.** The ink crosses joints, and the part inside a joint is cut away on purpose. The test therefore checks conservation: for each glyph, the sum of its decal areas plus the area of its triangles clipped to the joint strips equals the sum of its triangle areas (±1e-6). This proves that clipping loses or duplicates nothing beyond the joints.
7. **The tasks run in order, and two of them leave tests red.** After Task 3, the docs tests (`src/lab/docs.test.ts`, `src/docs-glossary.test.ts`) are the only red files, and Task 4 fixes them. Task 2 does not touch any consumer.
8. **The lane length pin changes.** The pin `|laneLength("out") − 560.7| < 5` in `sea-anim.test.ts` is re-pinned to the new length (rounded to 0.1) with a `// #451` comment, because moving two vertices 15 u east makes the lane about 8 u longer.

9. **Captures outside the tree.** The issue says the captures are not versioned here (step 7), but the PR has to carry them. Two PNGs are pushed to an orphan branch `captures/454` and embedded in the PR body with their raw URLs. Rejected: committing them under `docs/` (the issue forbids it) and describing them only in text (fails the criterion "El PR lleva las dos capturas").
10. **The sheet** is the ink box of `LAYOUT` (min and max over the glyph boxes) grown by `BOARD_PAD` on each side: [a0, a1] × [b0, b1]. It is one face at z −0.9 (`BOARD_TOP − PLANK_H`), which is also the top plane of the beams. The issue defines it as «Lámina = caja de tinta de `marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING)` + `BOARD_PAD` por lado» and «Lámina de fondo: una cara en z −0.9».

## Assumptions

Each assumption is listed with the alternative it rejects. They also go into the PR description.
- Decision 1, constants in `raft.ts`. Rejected: a third constants module, which would be one more file for six names.
- Decision 2, the shape of `RAFT` and `buildRaft`. Rejected: `buildRaft(site, pose)` returning the mesh, which would duplicate `raftAt`.
- Decision 6, the area test written as conservation. Rejected: equality to the triangles' area, which is false by construction, since the issue itself cuts every triangle at the joints.
- Decision 7, red docs tests after Task 3. Rejected: folding the docs into Task 3, which makes the task too large for one review. Only the PR head runs CI, and the squash merge drops the intermediate state.
- Decision 9, the orphan `captures/454` branch.

## Review Focus

- **Joint points under the oracle.** A backing sample or a quad corner that falls inside a joint must have the sheet behind it and no plank side face in front. Covered by `src/lab/signs.test.ts` (backing = 1, occlusion ≤ 0.05), unchanged, at rest and in 8 heave phases.
- **Decal winding.** A decal triangle wound clockwise in text space would be culled and become invisible. Test in Task 2: "every decal face's normal is +z at rest".
- **Paint over a ragged end or outside the planks.** No decal may lie outside its plank's rectangle (±1e-9). Test in Task 2.
- **Mutation through a shared spec.** `seaPlatformAt` must push a fresh mesh, never one reachable from `BLOG_SIGNS`. Test in Task 3: "seaPlatformAt pushes a fresh mesh (mutating it leaves BLOG_SIGNS intact)".
- **Animator cache.** A site change after a cached pose must report the layer and serve the other site's mesh. Kept in `platform-animator.test.ts` (Task 3).

---

### Task 1: Palette `timber` and `navy`

**Files:**
- Modify: `src/map/palette-base.ts` (two `BASE_TONES` entries with a `// #451 raft` comment), `src/map/palette-iso.ts` (the two lines printed by `npm run palette`)
- Test: `src/map/palette-iso.test.ts`, `src/map/palette-base.test.ts`

**Interfaces:**
- Produces: `Material` includes `"timber"` and `"navy"`, and `ISO_TONES.timber` and `ISO_TONES.navy` are nine-tone ladders.

- [ ] **Step 1: Write the failing tests:**
  - In `palette-iso.test.ts`: "raft paint contrast (#451): navy on timber ≥ 7.5 in top and up", using `contrastRatio(ISO_TONES.navy.top, ISO_TONES.timber.top) ≥ 7.5` and the same with `up`. Also "timber and navy are in the atlas": both `top` values are in `allIsoColors()`.
  - In `palette-base.test.ts`: "timber and navy come from cityLadder", with `cityLadder(0xfbefc5)` and `cityLadder(0x0a1134)` checked on the five tones through `near`, and `ISO_TONES[m].top === darken(top, DARKEN)`.
- [ ] **Step 2: Run** `npx vitest run src/map scripts/darken-palette.test.ts`. Expected: FAIL (unknown material).
- [ ] **Step 3: Implement.** Paste the `cityLadder` literals into `BASE_TONES`. Run `npm run palette`, then paste its `timber` and `navy` lines into `ISO_TONES`, in the same order as in `BASE_TONES`.
- [ ] **Step 4: Run** `npx vitest run src/map scripts && npm run typecheck`. Expected: PASS, including the existing `darken-palette` test "lo impreso es lo que está pegado".
- [ ] **Step 5: Commit** `feat(#454): timber and navy materials`.

### Task 2: `src/scenes/raft.ts`

**Files:**
- Create: `src/scenes/raft.ts`
- Test: `src/scenes/raft.test.ts`

**Interfaces:**
- Consumes: `rigid` (`src/iso/rigid.ts`), `clipPolygon`, `lerp2` (`src/iso/clip.ts`), `groundDiagonal`, `toWorld`, `TextPlane` (`src/kit/lettering.ts`), `marqueeLayout`, `CHAINSAW_WRITING`, `createRng`, `SEED`, `MeshFace`, `Solid`, `polygonNormal`.
- Produces:
  - `WRITING_CAP = 20`, `BOARD_TOP = -0.4`, `BOARD_PAD = 1.6`, `type WritingSite = "wide" | "tall"`, `PLATFORM_SITES` (unchanged values).
  - `interface RaftPose { dz; pitch; roll }` and `REST_POSE` (frozen).
  - `LAYOUT = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING)`.
  - `RAFT`, `RaftPlan`, `buildRaft(): RaftPlan`.
  - `raftPlane(site: WritingSite, pose?: RaftPose): TextPlane`.
  - `raftAt(site: WritingSite, pose?: RaftPose): Solid & { kind: "mesh" }`.
  - `raftEnvelope(): Rect`, the rest plan envelope in text space: [sheet.a0 − 0.3, sheet.a1 + 0.3] × [block − 1.2, block + 1.2].

- [ ] **Step 1: Write the failing tests** (`describe("raft (#454)")`):
  - "N planks at pitch 2.55, the block centred on the sheet": N = ceil((b1 − b0 + 0.15)/2.55). Consecutive planks satisfy b0[k] − b0[k+1] = 2.55 and b1 − b0 = 2.4 (±1e-9). The block's midpoint equals the sheet's midpoint.
  - "ragged ends within ±0.3 of the sheet and tones in {0, 1}".
  - "3 beams at a0 + 1.5, the centre and a1 − 1.5, 1.4 wide, overhanging the block by 1.2".
  - "every decal lies inside its plank's rectangle (±1e-9)". Map each world decal point back to text space through the rest plane.
  - "decal area is conserved: decals plus joint parts equal the glyph's triangles (±1e-6)". See technical decision 6.
  - "every decal face's normal is +z at rest, and every mesh vertex is at z ≤ BOARD_TOP (+1e-9)".
  - "under pitch 0.02 / roll 0.015 every decal's normal equals its plank top's normal (±1e-9)". Winding is fixed at rest, before `rigid`, which is a proper rotation.
  - "face order: beams (18 faces), sheet (1), then per plank, back to front: its 6 faces, then its decals". Each decal comes right after its plank's faces. The decal `mat` is `navy`, and its `toneOffset` equals the plank's. The sheet has `toneOffset` −5 and the beams −2.
  - "deterministic: two builds are equal".
  - "a pitch 0.02 / roll 0.015 pose keeps every vertex-to-vertex distance (±1e-9) and the posed plane has unit, perpendicular u′, v′".
  - "raftPlane(site) at rest is groundDiagonal with the sheet centre on the site at z BOARD_TOP".
- [ ] **Step 2: Run** `npx vitest run src/scenes/raft.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** Build the mesh at rest at the site, then pose every point with one `rigid` call per face. The plane follows Global Constraints. Clip with `clipPolygon(tri, { x0: ak0, x1: ak1, y0: bk, y1: bk + 2.4 }, lerp2)` in text space, then take the points to the world. The beam prisms span b over the block ±1.2.
- [ ] **Step 4: Run** `npx vitest run src/scenes/raft.test.ts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#454): raft.ts`.

### Task 3: The sign, the animator, lanes, frame, exhibits and the pinned tests

**Files:**
- Modify: `src/scenes/sign-platform.ts`, `src/scenes/platform-animator.ts`, `src/scenes/sea-anim.ts` (`LANE_OUT` and its comment), `src/world/frame.ts` (450 and its JSDoc), `src/lab/crop.ts` (the platform has no accents any more), `src/lab/exhibits.ts` (the two boxes and their comment).
- Tests: `src/scenes/sign-platform.test.ts`, `platform-animator.test.ts`, `sea-anim.test.ts`, `sea.test.ts`, `animators.test.ts` (if it pins layers), `city-budget.test.ts`, `world-baseline.test.ts`, `src/world/assemble.test.ts`, `veil.test.ts`, `view.test.ts`, `src/lab/crop.test.ts`, `exhibits.test.ts`, `signs.test.ts` (call sites only), and any other caller of `seaPlatformAt` or `signAt` that typecheck flags.

**Interfaces:**
- Consumes: Task 2's exports.
- Produces:
  - `seaPlatformAt(out: Solid[], site: WritingSite, pose: RaftPose = REST_POSE): void` pushes `raftAt(site, pose)`.
  - `seaPlatform(out: Solid[], accents: Accent[]): void` pushes the wide mesh translated by −`PLATFORM_SITES.wide` and does not touch `accents`.
  - `signAt(site, pose = REST_POSE): SignSpec`.
  - `BLOG_SIGNS`.
  - `PLATFORM_DECK: readonly Vec2[]`: the 4 corners of `raftEnvelope()` through the rest plane with its origin translated to (0, 0). Order: (a0, b0), (a1, b0), (a1, b1), (a0, b1).
  - `HEAVE`, `HEAVE_STEP` and `heaveAt` are unchanged. `PLATFORM_LAYERS = { solid: "platform.solid" }`.

- [ ] **Step 1: Rewrite the failing tests**, as the issue's step 4 lists them:
  - `sign-platform.test.ts`: one `mesh` `timber` solid; `WRITING_CAP` 20; the plane is `groundDiagonal` (exact u, v); `staticContrast(BLOG_SIGNS[site]) ≥ 7`; every mesh vertex at z ≤ `BOARD_TOP` + dz; water under every 1 u cell of `PLATFORM_DECK` moved to the site (> 1500 cells); determinism; `signAt(site, { dz, pitch: 0, roll: 0 })` backed by `seaPlatformAt` at the same pose in 8 heave phases; `seaPlatform` = the wide mesh translated; and the fresh-mesh test from Review Focus.
  - `platform-animator.test.ts`: `ids` = `["platform.solid"]`, and the layer holds `seaPlatformAt(…, { dz: step·HEAVE_STEP, pitch: 0, roll: 0 })`.
  - `assemble.test.ts`: `ids` = `["platform.solid"]`.
  - `exhibits.test.ts`: the new boxes (bounds of `raftAt(site, REST_POSE)` ± 3, rounded outward, h 1) and "one solid, the timber raft".
  - `crop.test.ts`: the platform adds solids only.
  - `sea-anim.test.ts`: the new `LANE_OUT` vertices and the length pin (decision 8).
  - `view.test.ts`: 450.
  - `world-baseline.test.ts`: re-record the `plataforma` hash with `// #451: plank raft, WRITING as a navy decal`.
  - `city-budget.test.ts`: "the raft has ≤ 1200 faces", via `tessellateAll(raftAt("wide", REST_POSE)).length ≤ 1200`.
  - `veil.test.ts` and `sea.test.ts`: no platform accents.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL in those files. Also run `git grep -n "platform.lights\|PAINT_LIFT\|boardAt\|planeAt"` and update every hit in code and tests. Layer ids are strings, so typecheck does not catch them. Today the hits are `platform-animator.ts`, `sign-platform.ts`, their tests, `assemble.test.ts`, `city-budget.test.ts` (a comment), `docs.test.ts`, `docs-glossary.test.ts` and `CONTEXT.md`; the last three belong to Task 4.
- [ ] **Step 3: Implement** `sign-platform.ts`. Delete `PAINT_LIFT`, `planeAt`, `boardAt` and the `roofDiagonal` import, and re-export from `raft.ts`. Implement `platform-animator.ts` with one layer, cached per `(site, step)` with a `Solid[]`.
- [ ] **Step 4: Implement the lanes.** `LANE_OUT` gets the two shifted vertices. Solve the sea end `E = (515, 405) + t·d̂`, with d̂ the unit direction to (523, 510), by bisection on t, so that `L − d_c = FADE_U`. Here `d_c` is the arc length where `inCoverQuad` flips to false along the lane. Write E rounded to 0.1. Then check that `inCoverQuad(laneAt(d)) === (L − d > FADE_U)` holds at every integer d. If it does not, move t by 0.1 until it does. Rewrite the `LANE_OUT` comment: distances to the narrow site's raft envelope (measured), screen turns (measured) and the #454 shift.
- [ ] **Step 5: Implement** `frame.ts` (450) and the exhibit boxes (computed once, written as literals with a comment on how they were derived). `crop.ts` stops collecting platform accents.
- [ ] **Step 6: Run** `npm test && npm run typecheck`. Expected: green, except `src/lab/docs.test.ts` and `src/docs-glossary.test.ts` (decision 7).
- [ ] **Step 7: Commit** `feat(#454): the raft at both Writing sites`.

### Task 4: Minimum docs

**Files:**
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§8.1 `plataforma-escena` rows and the WRITING row, §8.2 the new entry after #441, §8.3 the WRITING row), `CONTEXT.md` (Sign, Lettering, Legibility), `src/lab/docs.test.ts`, `src/docs-glossary.test.ts`.

**Interfaces:**
- Consumes: the live values `WRITING_CAP`, `CHAINSAW_BAR`, `ISO_TONES.timber.top`, `ISO_TONES.navy.top`, `staticContrast(BLOG_SIGNS.wide)`, `GROUND_ASPECT`, `writingSite`, `signMetrics`.

- [ ] **Step 1: Write the failing tests.** In `docs.test.ts`, the block "WRITING on a floating board (#441)" requires the #441 entry to exist only. A new `entry451` (title `- **WRITING sobre la balsa de tablones (#451).**`, after the #441 one) must contain `` `WRITING_CAP` 20 ``, `` `CHAINSAW_BAR` 0.15 ``, `timber`, `navy`, both `top` hex values, `staticContrast` with its value `toFixed(2)`, `` `GROUND_ASPECT` 0.5 ``, `threshold()` (1,57), `LANE_OUT`, `450` and `platform.lights`. `CONTEXT.md` Sign no longer requires `platform.lights`; it requires `timber`, `navy`, `decal`, `groundDiagonal`, `platform.solid` and `20`, and does not match `PAINT_LIFT`, `officeDark` or `roofDiagonal`. In `docs-glossary.test.ts`, line 202 drops `platform.lights`.
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts src/docs-glossary.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the docs.**
  - The §8.2 entry, in Spanish, covers why cap 20 was chosen: an x-height ≥ 12 px at 1.17 with v projecting 0.707, and the planned 1° roll. It also covers `CHAINSAW_BAR` and its measurement, the materials and their contrast, `GROUND_ASPECT`, the threshold, the lane shift, the 450 frame, and the removal of `platform.lights`.
  - §8.1 and §8.3: update the WRITING rows with the new oracle values, each with the note «desde #451, caja alta 20».
  - `CONTEXT.md`, as the issue says: the `Code:` line of Sign drops `PAINT_LIFT` and adds `src/scenes/raft.ts` (`raftAt`, `RAFT`, `REST_POSE`).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all green.
- [ ] **Step 5: Commit** `docs(#454): raft entry, CONTEXT`.

### Task 5: Level-3 probe and captures (information for the PR)

- [ ] Add `.scratch/` to `.git/info/exclude`, so the captures cannot reach a commit.
- [ ] Start the dev server (`npm run dev -- --host --port 5173`), then run `npm run legibility -- --only plataforma-escena` in the foreground with a 10-minute timeout. Note the OCR and contrast it reads, then run `git checkout -- docs/superpowers/specs/assets/carteles-legibilidad`, even if the run timed out or failed. Then check that `git status --porcelain` is empty. The probe gates nothing: the issue's step 6 says «no es criterio acá».
- [ ] Take the captures `/lab/storybook.html?bloom=on&speed=0#plataforma` and `#plataforma-escena` at `__lab.setCoverScale(1.17)`, 1600×900 @2, into `.scratch/`. They are not committed. They are attached to the PR as information.
- [ ] The PR has to carry the images even though they are not committed on this branch. They are pushed to an orphan branch `captures/454` (only those two PNGs) and the PR body embeds them with `raw.githubusercontent.com` URLs. This is technical decision 9.

## Grilling

- Rounds: 1 (the revisions were additions, not a new seam). Questions: 18.
- Sources: ISSUE 9 (Q1, Q3, Q6 pivot, Q8, Q10, Q11, Q13, Q14, Q16), CODE 7 (Q4 `legibility.ts:168` covers via `tessellate`; Q5 `solids.ts:345` + `render-list.test.ts:113` + `solids.test.ts:1690`; Q6 `rigid.ts`; Q7 `clip.ts:27`; Q9 git grep; Q15 `world-baseline.test.ts:40` hashes piece exhibits only; Q11 `sea-anim.test.ts:47`), NO SOURCE → technical assumption 4 (Q2 captures, Q12 red intermediate commit, Q17 decal normals under a pose, Q18 `.scratch/` exclude).
- Assumptions: see `## Assumptions` (decisions 1, 2, 6, 7, 9).
- Issues opened: none. Spec ambiguities: none.
