# Writing: water contact and wood texture of the raft (foam, contact shadow, wet band, submerged, grain, nails) and close captures (#455) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Writing raft read as a wooden object floating on the water. Every new face goes into the raft's single `timber` mesh (`raftAt`): a contact shadow ring, a foam ring, beams split at the waterline, a wet band on each plank's edge, grain and nails. Close-up and in-scene captures are taken at both sites.

**Architecture:** All the work is in `src/scenes/raft.ts`, plus one geometry helper in `src/iso/clip.ts`. The decal triangles are merged into convex polygons first. That frees the face budget: today 1077 faces, 986 of them decals. Merged, the decals come down to 221. Then the new faces are added in the issue's painter order. The exhibit boxes, the piece hash, `CONTEXT.md` and the captures follow.

**Tech Stack:** TypeScript, Vitest (node), Vite dev server, agent-browser for the captures.

**Spec:** issue #455, in full: "Decisiones heredadas", "Qué hacer" and "Criterios de aceptación". Story #451, plan comment (D3, D4).

## Global Constraints

- Mesh face order (painter): **contact shadow, foam, beams, sheet, planks back to front**. Each plank emits its prism faces, then its grain, then its nails, then its decals.
- `RAFT` gains: `wetZ: -0.7`, `ringZ: -0.98`, `foamW: 1.0`, `shadowW: 2.0`, `segment: 4`, `grainW: 0.06`, `grainEdge: 0.2`, `nail: 0.12`, `nailDa: 0.35`, `nailDb: 0.6`. The existing keys keep their values.
- Plank side faces (the two long ones and the two ends) are split at z −0.7. The part from −0.7 to −0.4 has the plank's tone. The part from −0.9 to −0.7 has the plank's tone − 2. The top and the bottom keep the plank's tone.
- Beam side and end faces are split at z −1. The part from −1 to −0.9 is −2. The part from −1.4 to −1 is −5. The top is −2 and the bottom −5.
- Foam: material `foam`, ring 1.0 u wide just outside `raftEnvelope()`, at z −0.98. Each side is cut into segments of ≈ 4 u, with `toneOffset` alternating 0 / −1. Each segment is one 4-point rectangle, counter-clockwise seen from above (world normal +z).
- Contact shadow: ring 2.0 u wide just outside the foam (offsets 1.0 → 3.0), z −0.98, material `waterCellMat(site.x, site.y) ?? "water"`, `toneOffset` −5. Same segmentation as the foam, no alternation.
- Grain: per plank, 2 quads 0.06 u wide (along b) and 30–60 % of the plank's length long (along a), coplanar with the top (z −0.4). `toneOffset` is the plank's tone − 1.
- Nails: per plank × beam crossing, 2 squares 0.12 u wide, coplanar with the top. `toneOffset` is the plank's tone − 2.
- Rng: one `createRng(SEED)`. Per plank, the draws come in this fixed order: ends (2), tone (1), grain (2 × 3). Nails draw nothing. No plank height variation.
- `PLATFORM_DECK` and `raftEnvelope()` do not change.
- The mesh has ≤ 1200 faces (`city-budget.test.ts`). `src/lab/signs.test.ts` stays unchanged and green. `staticContrast(BLOG_SIGNS[site]) ≥ 7` at both sites.
- The `plataforma` hash in `world-baseline.test.ts` is re-recorded once, with the comment `// #451: water contact and grain`.
- Code, comments and test names are in English (`src/english.test.ts`). The captures `README.md` is in Spanish.
- The `balanceo/` subfolder of `docs/superpowers/specs/assets/451-balsa-tablones/` belongs to another issue: do not create it or touch it.
- `npm test` and `npm run typecheck` are green at the end.

## Technical decisions (declared; not in the issue)

1. **Decal merge.** The new faces come to about 280: beams +12, planks +12 each × 12, foam ≈ 60, shadow ≈ 64. On top of today's 1077 faces that would reach ≈ 1357, over the 1200 budget the issue requires. So, per plank and per glyph, the clipped triangles are merged greedily into convex polygons. Two pieces merge when they share an edge (in reverse, within 1e-7) and their union is convex (collinear vertices allowed). The ink area and its pixels do not change. Measured: 986 → 221 decal faces, ≈ 590 faces in total. Rejected: dropping faces the issue lists, which would break the spec; dropping plank bottoms, which saves only 12.
2. **Rings in text space.** The envelope `E = raftEnvelope()` = [a0, a1] × [b0, b1]. A ring between offsets d0 and d1 (foam 0 → 1, shadow 1 → 3) is 4 disjoint strips, emitted in this order:
   - b0 side: [a0−d1, a1+d1] × [b0−d1, b0−d0], walked with a increasing;
   - a1 side: [a1+d0, a1+d1] × [b0−d0, b1+d0], walked with b increasing;
   - b1 side: [a0−d1, a1+d1] × [b1+d0, b1+d1], walked with a decreasing;
   - a0 side: [a0−d1, a0−d0] × [b0−d0, b1+d0], walked with b decreasing.

   A strip of length L along its walk is cut into `n = max(1, round(L / 4))` equal segments. The foam's tone alternates through one counter that runs across all strips in emission order (k even → 0, k odd → −1).
3. **"Distance ≤ 3.0" means distance per axis in text space** (Chebyshev to E): `max(a0 − a, a − a1, b0 − b, b − b1)`. The issue's rings are rectangular offsets, so the outer corner of the shadow lies at Euclidean distance 3√2 from E but at per-axis distance 3. Every ring vertex has a per-axis distance in [0, 3] (±1e-9).
4. **Grain draws**, per grain, in this order: `len = (0.3 + 0.3·next())·(a1 − a0)`, then `bLo = b0 + 0.2 + next()·(b1 − b0 − 0.4 − 0.06)`, then `aLo = a0 + next()·(a1 − a0 − len)`. The quad is [aLo, aLo + len] × [bLo, bLo + 0.06].
5. **Nail pairs.** At each crossing, with beam centre `ac` and plank centre `bc`, the two nail centres are (ac − 0.35, bc − 0.6) and (ac + 0.35, bc + 0.6), a diagonal pair. They are emitted per beam in the plan's beam order, then per pair in that order.
6. **Wound like the top.** Grain, nails, foam and shadow use the top face's text order (a0, b0), (a0, b1), (a1, b1), (a1, b0), which gives a world normal of +z (the text frame is left-handed against z).
7. **Order inside a prism:** top, bottom, then each side's upper part followed by its lower part. Plank: 2 + 4·2 = 10 faces. Beam: 10 faces.
8. **The baseline hash goes red in Task 1 (the fingerprint hashes the solids, so merged decals already change it) and is re-recorded once, in Task 5.** Between those tasks `world-baseline.test.ts` is expected to be red; no other file should be. The exhibit boxes are grown in Task 5 because the rings make the raft's bounds about 46.9 u from the site in x and in y, which is past the current boxes (±45).

## Review Focus

- **Ring face facing down.** A ring segment wound clockwise would be culled and disappear. Task 4 test: "every ring face's world normal has z > 0".
- **Ring over the raft.** A foam or shadow vertex inside the envelope would paint under the planks and show through the joints. Task 4 test: per-axis distance ≥ 0.
- **Paint covering the texture.** The contrast must keep measuring decal against plank top, not against a grain or a nail. Covered by `src/lab/signs.test.ts` (unchanged) and `sign-platform.test.ts` (`staticContrast ≥ 7`). Task 3 also asserts that every grain and nail area is < 1/10 of its plank top's area.
- **Merged decal not convex.** A non-convex merged polygon would render wrong in Pixi's fill and break the oracle's receiving-face centroid. Task 1 test: "every merged piece is convex".
- **Determinism after the rng change.** Task 3 test: two builds are equal, and the plank tones still span {0, 1}.

---

### Task 1: Merge decal triangles into convex polygons

**Files:**
- Modify: `src/iso/clip.ts` (new export)
- Modify: `src/scenes/raft.ts` (`decalsPerPlank`)
- Test: `src/iso/clip.test.ts`, `src/scenes/raft.test.ts`

**Interfaces:**
- Produces: `mergeConvex(pieces: readonly Vec2[][]): Vec2[][]` in `clip.ts`. Each input piece is convex; the output is CCW in its own (x, y) frame, every piece convex, total area equal. The function is deterministic: it repeatedly merges the first pair (i < j) that shares an edge and whose union is convex.

- [ ] **Step 1: Failing tests.** In `clip.test.ts`:
  - "mergeConvex joins two triangles of a square into one quad": `mergeConvex([[(0,0),(1,0),(1,1)], [(0,0),(1,1),(0,1)]])` has length 1, 4 points, area 1.
  - "mergeConvex keeps an L apart": the pieces of a non-convex L stay at ≥ 2 pieces, the total area is unchanged and every piece is convex.
  - "mergeConvex accepts either winding": the same square with one triangle given CW still merges to 1 piece.

  In `raft.test.ts`:
  - "decals are merged: fewer than 300 decal faces, each convex in text space".
  - The existing "decal area is conserved" test stays and must pass.
- [ ] **Step 2:** `npx vitest run src/iso/clip.test.ts src/scenes/raft.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement `mergeConvex`. Normalise each piece to CCW. Merge on a shared reversed edge, tolerance 1e-7. Convexity check: every cross product ≥ −1e-9. In `decalsPerPlank`, clip each glyph's triangles to the plank, drop pieces under 1e-9 area, then `mergeConvex` per glyph.
- [ ] **Step 4:** Rerun. Expected: PASS. `src/lab/signs.test.ts` and `src/scenes/sign-platform.test.ts` are still green. `world-baseline.test.ts` is now red (decision 8); nothing else is.
- [ ] **Step 5:** Commit `feat(#455): merge decal triangles into convex polygons`.

### Task 2: Wet band on the planks and beams split at the waterline

**Files:**
- Modify: `src/scenes/raft.ts` (`prism`, `RAFT`, `raftAt`)
- Test: `src/scenes/raft.test.ts` (update the `groups` helper and the `RAFT` constant test)

**Interfaces:**
- Consumes: Task 1.
- Produces: `prism(plane, r, z0, z1, tones: { top: number; bottom: number; upper: number; lower: number; split: number }): MeshFace[]`, which returns 10 faces (decision 7). The `RAFT` keys from Global Constraints, all of them added here so the later tasks only read them.

- [ ] **Step 1: Failing tests.**
  - The `RAFT` test expects the full object, old keys plus new ones.
  - "beams: 10 faces each; side faces split exactly at z −1: [−1, −0.9] at −2, [−1.4, −1] at −5; top −2 at z −0.9, bottom −5 at z −1.4".
  - "planks: 10 prism faces each; side faces split exactly at z −0.7: [−0.7, −0.4] at the plank's tone, [−0.9, −0.7] at tone − 2". Each side face's z-range is one of those two intervals exactly (±1e-12).
  - Update `groups()` to the new layout (it is rewritten in Task 4 once the rings exist; here: 30 beam faces, sheet, then per plank 10 faces + decals).
- [ ] **Step 2:** Run `raft.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Beams: `split -1`, `{ top: -2, bottom: -5, upper: -2, lower: -5 }`. Planks: `split RAFT.wetZ`, `{ top: t, bottom: t, upper: t, lower: t - 2 }`.
- [ ] **Step 4:** Rerun. Expected: PASS. Also run `signs.test.ts`, `sign-platform.test.ts` and `city-budget.test.ts`. Expected: green.
- [ ] **Step 5:** Commit `feat(#455): wet band on the plank edges, beams split at the waterline`.

### Task 3: Grain and nails

**Files:**
- Modify: `src/scenes/raft.ts` (`buildRaft` draws the grain; `raftAt` emits it and the nails)
- Test: `src/scenes/raft.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `RaftPlan.planks[k].grain: Rect[]` (2 per plank), computed in `buildRaft` (decision 4), with a one-line comment that this rng order re-records the baseline hash. The nails are computed in `raftAt` from the plan (no rng).

- [ ] **Step 1: Failing tests.**
  - "every plank has 2 grain rects 0.06 wide, 30–60 % of its length, inside its rectangle, at least 0.2 from its long edges".
  - "per plank, the mesh emits 10 prism faces, 2 grain faces (tone − 1), 6 nail faces (tone − 2, 0.12 squares centred at beam centre ± 0.35, plank centre ± 0.6, paired − − / + +), then its decals".
  - "every grain and nail face is at z −0.4 (±1e-9), inside its plank's rectangle in text space, with a world normal of +z, and has < 1/10 of the plank top's area".
  - "every nail square lies inside its beam's a-range and its plank's b-range".
  - Keep "deterministic: two builds are equal" and "tones in {0, 1} with both present".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `raft.test.ts`, `signs.test.ts`, `sign-platform.test.ts` and `city-budget.test.ts`. Expected: green.
- [ ] **Step 5:** Commit `feat(#455): grain and nails on the planks`.

### Task 4: Foam and contact shadow rings

**Files:**
- Modify: `src/scenes/raft.ts` (import `waterCellMat` from `./terrain`; a `ring(plane, E, d0, d1, mat, tone: (k) => number)` helper)
- Test: `src/scenes/raft.test.ts`

**Interfaces:**
- Consumes: Task 3. `waterCellMat(x, y): WaterMat | null` from `src/scenes/terrain.ts`.
- Produces: the final face order (shadow, foam, beams, sheet, planks). The `groups()` test helper classifies the faces: shadow = the leading run whose `mat` is the site's water material, then foam = `mat === "foam"`, then 30 beam faces, then the sheet, then per plank 10 + 2 + 6 faces and the navy run.

- [ ] **Step 1: Failing tests** (both sites, `it.each`):
  - "shadow ring: material `waterCellMat(site.x, site.y) ?? \"water\"` (computed in the test, not hardcoded), toneOffset −5".
  - "foam ring: material foam, toneOffset alternating 0 / −1 in emission order".
  - "both rings: every face is 4 points at z −0.98, world normal z > 0; each segment is 2–6 u long along its strip".
  - "every foam vertex is at per-axis distance in [0, 1] of raftEnvelope(), every shadow vertex in [1, 3]" (decision 3; ±1e-9).
  - "ring faces are pairwise disjoint: the overlap of any two rects in text space has zero area (≤ 1e-9)".
  - "segment counts per strip are max(1, round(L/4))".
  - "emission order: every shadow index < every foam index < every beam index < sheet < every plank face; inside a plank: prism < grain < nails < decals".
  - "the face count stays under the budget (≤ 1200)", at both sites.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement following decision 2. Shadow `ring(..., 1, 3, water, () => -5)`, foam `ring(..., 0, 1, "foam", (k) => (k % 2 ? -1 : 0))`. Both are unshifted faces, posed with the rest by `rigid`.
- [ ] **Step 4:** Run `raft.test.ts`, `signs.test.ts`, `sign-platform.test.ts`, `city-budget.test.ts` and `sea-anim.test.ts`. Expected: green.
- [ ] **Step 5:** Commit `feat(#455): foam and contact shadow rings around the raft`.

### Task 5: Exhibit boxes, baseline hash, CONTEXT

**Files:**
- Modify: `src/lab/exhibits.ts` (lines 266–268: boxes and their comment)
- Modify: `src/lab/exhibits.test.ts` (pinned boxes, plus a containment test)
- Modify: `src/scenes/world-baseline.test.ts` (`plataforma` hash, comment `// #451: water contact and grain`)
- Modify: `CONTEXT.md` (entry **Sign**)

- [ ] **Step 1: Failing test** in `exhibits.test.ts`: "plataforma-escena(-angosta) boxes hold bounds(raftAt(site, REST_POSE)) with margin ≥ 3". Run it. Expected: FAIL for the current boxes.
- [ ] **Step 2:** Set each box to `bounds(raftAt(site, REST_POSE))` ± 3, rounded outward to integers. Update the comment: the values, and that the boxes grew because of the rings. Update the pinned boxes in the existing test. Run all of `src/lab/`. If a neighbour or framing test fails only because the bigger box legitimately takes in more world solids, update its pinned data (not its rule) and note why in a comment (assumption A3). If a rule fails, stop and report it.
- [ ] **Step 3:** Run `npx vitest run src/scenes/world-baseline.test.ts`, copy the new `plataforma` hash, add the comment line, and rerun. Expected: PASS.
- [ ] **Step 4:** `CONTEXT.md`, entry **Sign**: add one sentence naming `RAFT`: foam, contact shadow, wet band and submerged beams (water contact), grain and nails (texture). Run `src/docs-glossary.test.ts` and `src/lab/docs.test.ts`. Expected: green.
- [ ] **Step 5:** `npm test` and `npm run typecheck`. Expected: green.
- [ ] **Step 6:** Commit `feat(#455): exhibit boxes hold the rings; re-record plataforma; CONTEXT`.

### Task 6: Captures (controller, with agent-browser)

**Files:**
- Create (the folder does not exist yet): `docs/superpowers/specs/assets/451-balsa-tablones/{pieza-real,pieza-083,escena-ancho-117,escena-angosto-117}.png` and `README.md` (Spanish)

- [ ] **Step 1:** `npm run dev -- --host --port 5173`. Use agent-browser with viewport 1600×900 at scale 2 (method in `CLAUDE.md`, URLs in `README.md`): `/lab/storybook.html?bloom=on&speed=0#plataforma` at real scale; the same with `__lab.setCoverScale(0.83)`; `#plataforma-escena` and `#plataforma-escena-angosta` at 1.17.
- [ ] **Step 2:** Check each PNG is 3200×1800 and shows the planks, joints, beams, edge, foam and shadow.
- [ ] **Step 3:** `README.md`: one line per capture with its URL, scale and what to look at.
- [ ] **Step 4:** Commit `docs(#455): close and in-scene captures of the raft`.

## Assumptions

- A1. Ring "distance ≤ 3.0" is the per-axis (Chebyshev) distance in text space (decision 3). Rejected: Euclidean, which the issue's own rectangular segments ("Un rectángulo (4 puntos) por segmento") cannot meet at the corners.
- A2. Decal merge (decision 1). Rejected: dropping faces the issue lists.
- A3. Exhibit boxes grow to bounds ± 3, as the issue allows ("si la envolvente con anillos ya no cabe, agrandar la caja y anotar por qué"). If that makes neighbour data change, the pins are updated; the rules are not touched.
- A4. Grain draw order (decision 4), the nail pairing (decision 5), the order inside a prism (decision 7). Rejected: the other pairing or order. They are visually equivalent and the issue leaves them open.
- A5. Intermediate commits leave `world-baseline.test.ts` red until Task 5, because the issue asks for a single re-record.

## Grilling

- 1 round, 16 questions (griller model: fable). Sources: CODE 11, ISSUE 7, DOC 0 (some answers cite both). NO SOURCE: 4 (Q1 measurement, Q9, Q10, Q12), all technical assumptions (A1–A3, A5). No spec ambiguity. No follow-up issues opened.
- Revisions: the hash goes red from Task 1; the shadow-material test calls `waterCellMat` instead of hardcoding; the nail-over-beam test; what happens on a neighbour failure (A3); the captures folder is created. None of these is substantial, so no second round.
