# Writing: rigid-body pitch and roll (`poseAt`, `CYCLE_POSES`), level 2 and ships over the cycle, time-lapse (#456) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Writing raft heaves, pitches and rolls as one rigid body, on three quantized sines whose periods are not multiples of one another. `platformAnimator` drives it with a one-pose memo, and it stays still under `reducedMotion`. Level 2 and the ships rule are checked on the 17 poses of `CYCLE_POSES`, and a six-capture time-lapse documents the motion.

**Architecture:** `sign-platform.ts` gains the pose functions (`PITCH`, `ROLL`, `ANGLE_STEP`, `pitchAt`, `rollAt`, `poseAt`, `POSE_CYCLE_MS`) and the shared sample list `CYCLE_POSES`. `raft.ts` memoizes the unposed faces of each site, so `raftAt` only poses them. `platformAnimator` keeps its clock modulo `POSE_CYCLE_MS`. Per site, it keeps the last posed pose and rebuilds only when one of the three quantized fields changes. The level-2, ships and docs tests iterate `CYCLE_POSES`. The legibility oracle measures a ground sign's aspect on the projected box sides, not on its screen bounding box (Technical decision 1).

**Tech Stack:** TypeScript, Vitest (node, no Pixi), agent-browser with PixiJS DevTools for the captures.

**Spec:** issue #456 (its "Decisiones heredadas" and "Criterios de aceptación" are binding). Story #451, plan comment, D5.

## Global Constraints

- `PITCH = Object.freeze({ amp: (1.5 * Math.PI) / 180, periodMs: 9100 })`, a rotation about `RAFT_N`. `ROLL = Object.freeze({ amp: (1.0 * Math.PI) / 180, periodMs: 7300 })`, a rotation about `RAFT_U`. `HEAVE` stays `{ amp: 0.15, periodMs: 6700 }`. All three are sines at phase 0 (rest at t 0). **Do not raise the amplitudes.**
- `ANGLE_STEP = (0.1 * Math.PI) / 180`. `pitchAt(t) = round(PITCH.amp · sin(2π·phase / PITCH.periodMs) / ANGLE_STEP) · ANGLE_STEP`, with `phase` reduced modulo the period exactly as `heaveAt` does. `rollAt` is the same with `ROLL`. `poseAt(tMs): RaftPose = { dz: heaveAt(t), pitch: pitchAt(t), roll: rollAt(t) }`.
- `POSE_CYCLE_MS = 44_508_100` (the lcm of the three periods). The animator's clock is kept modulo it.
- `CYCLE_POSES` (exported from `sign-platform.ts`, frozen, 17 entries): `REST_POSE`, then the 8 corners `{ dz: ±HEAVE.amp, pitch: ±PITCH.amp, roll: ±ROLL.amp }`, then `poseAt(k · 7919)` for k = 1..8.
- Animator cache: the rest geometry once per site (in `raft.ts`), plus a one-entry memo per site `{ pose, solids }`. A rebuild happens only when one of `dz`, `pitch` or `roll` differs. A report happens when the site or the quantized pose changed since the previous tick. Budget: ≤ 250 reports in 10 simulated s of `tick(16.7)`. A `dtMs` that is non-finite, 0 or negative does not advance the clock. Under `reducedMotion` the raft stays at `REST_POSE`, and only a site change is reported.
- Time-lapse goes in `docs/superpowers/specs/assets/451-balsa-tablones/balanceo/`, and only that subfolder is created (its parent and the parent's `README.md` belong to another issue). It holds `balanceo-1..6.png` at t = 0, 1675, 3350, 5025, 7919 and 15838 ms, 3200×1800, plus a `README.md` in Spanish. Each line of that README gives `t` and the `poseAt(t)` values: dz with sign and two decimals, angles in degrees with sign and one decimal. Negative values use U+2212. `docs/superpowers/specs/assets/441-tabla-flotante/` is not touched.
- Code, comments and test names in English (`src/english.test.ts`). Docs prose in Spanish. `npm test` and `npm run typecheck` green.

## Technical decisions (declared; not in the issue)

1. **The aspect of a ground sign is measured on the projected box sides.** A probe over the current code shows the problem: at the 8 corners with roll −1°, `checkSign` fails `aspect` with 0.0924 > 0.08, at both sites and both scales. `signMetrics` divides the height of the screen *bounding box* of each glyph box by its width. A 1.5° pitch tilts the baseline, and that tilt makes the bounding box taller, so the tilt is counted again as stretch. The baseline rule (≤ 3°) already limits the tilt. The issue's own figure ("error de aspecto 0.035") is the stretch that roll alone causes. For a `ground` sign, the aspect becomes `|proj(box v side)| / |proj(box u side)|` over the flat ratio, divided by `GROUND_ASPECT`. Measured at the corners: worst 0.0347. Vertical signs keep the bounding-box measure, so no other sign changes its result. Rejected alternatives: lowering the amplitudes, which the issue forbids, and raising `aspectTol`, which would loosen every sign.
2. **The rest geometry lives in `raft.ts`, not in the animator.** `raftAt(site, pose)` keeps a per-site memo of the unposed faces and maps them through `rigid` on every call, so each call returns fresh objects. The animator's memo keeps only the last `{ pose, solids }` per site. `seaPlatformAt` keeps returning a value equal to `raftAt(site, pose)` (`toEqual`), because the floating-point path is the same.
3. **Assertion ranges.** `|pitch| ≤ PITCH.amp + 1e-12` and `|roll| ≤ ROLL.amp + 1e-12`, because `15 · ANGLE_STEP` can differ from `PITCH.amp` by one ulp.
4. **The #441 time-lapse becomes history.** `docs.test.ts` stops reading its README and its PNG sizes, and only checks that the folder exists. The §8.4 test of the 2026-11-15 spec that lists the four #441 captures is spec history and stays as it is.
5. **The time-lapse is the controller's task (Task 4).** It needs the dev server, agent-browser and DevTools. The hook is the one from the #445 plan (technical decision 2): `/lab/blog.html?bloom=on&speed=0.000001`. Walk the app ticker's listeners and keep the one whose `String(_fn)` contains `stage.tick(`. Call it with `deltaMS = Δt / 0.000001`, where Δt is the step to the next capture time (0, 1675, 1675, 1675, 2894, 7919), then `renderer.render(stage)`, then take the screenshot.
6. **Test runtime.** The level-2 cycle tests run 17 poses × 2 sites × 2 scales × (crop + world). Each `it` covers one pose and one scale, so no single test runs long. The ships test over `CYCLE_POSES` (34 signs) gets a 30 s timeout, up from 15 s.

## Assumptions (from the grilling)

- **A1. The oracle change is an engineering fix, not a product change.** Neither the issue nor the story authorizes rewriting `signMetrics`. But the acceptance criterion ("`checkSign` a 1.17 y 0.83 pasa en las 17 poses") and the inherited decision ("no subir las amplitudes") cannot both hold under the bounding-box measure. The issue's own expected value ("error de aspecto 0.035") is the one the box-side measure gives. Exact formula for a `ground` glyph with box `(x0, y0, x1, y1)` and `P(a, b) = project(toWorld(plane, a, b))`: `|(|P(x0,y1) − P(x0,y0)| / |P(x1,y0) − P(x0,y0)|) / ((y1 − y0) / (x1 − x0)) / GROUND_ASPECT − 1|`. `GROUND_ASPECT` is defined in `src/kit/legibility.ts:80`. Both sites use the same `groundDiagonal` u and v (`raft.ts` `restPlane`), so the one constant holds for both. Rejected alternatives: lowering the amplitudes (forbidden by the issue), widening `aspectTol` for every sign, and blocking on the owner. The story's final pull request is under human review (`Review: human` on #451), and that is where the owner sees this decision.
- **A2. No ADR here.** The ground-sign ADR (0005) belongs to #457 (story D8). The PR flags the aspect measure for it.
- **A3. `heaveAt` is refactored onto the shared `quantizedSine` helper** (DRY). Its tests are unchanged, so its behaviour is too. Rejected alternative: three copies of the same formula.
- **A4. `reducedMotion` is read from `opts` on every tick, as it is today.** The site never changes it at runtime, so the issue specifies nothing for a live toggle.

## Review Focus

- **A clock that wraps** (`tick(POSE_CYCLE_MS)` after 1 s of ticks) leaves the same pose and reports nothing. Task 3.
- **A site change mid-swing** reports the new site at the current pose, and posing the new site does not evict the old site's memo. Task 3: "a site change mid-swing moves the raft at its current pose".
- **`tick(16.7)` at 60 fps** stays within 250 reports in 10 s. The probe gives 188. Task 3.
- **Every corner of the pose cube** passes level 2 in the crop and against the world at both sites (this is what Technical decision 1 fixes). Task 2.
- **Ships crossing the word while it tilts**: the raft's screen box changes with pitch, roll and dz, and the 34 signs of the ships test cover it. Task 2.

---

### Task 1: pose functions and the rigid body over `CYCLE_POSES`

**Files:**
- Modify: `src/scenes/sign-platform.ts`
- Test: `src/scenes/sign-platform.test.ts`

**Interfaces:**
- Consumes: `heaveAt`, `HEAVE`, `REST_POSE`, `RaftPose`, `raftAt`, `raftPlane`, `signAt` (existing). `RAFT_U` and `RAFT_N` from `src/iso/rigid.ts`.
- Produces: `PITCH`, `ROLL: Readonly<{ amp: number; periodMs: number }>`, `ANGLE_STEP: number`, `pitchAt(tMs: number): number`, `rollAt(tMs: number): number`, `poseAt(tMs: number): RaftPose`, `POSE_CYCLE_MS: number`, `CYCLE_POSES: readonly Readonly<RaftPose>[]`.

- [ ] **Step 1: Write the failing tests** in `describe("poseAt: heave, pitch and roll (#456)")`:
  - `PITCH, ROLL and ANGLE_STEP are pinned`: `toEqual({ amp: (1.5*Math.PI)/180, periodMs: 9100 })`, `{ amp: Math.PI/180, periodMs: 7300 }`, `ANGLE_STEP === (0.1*Math.PI)/180`, `POSE_CYCLE_MS === 44_508_100`, and `Object.isFrozen(PITCH)` and `Object.isFrozen(ROLL)`.
  - `poseAt(0) is REST_POSE`: `toEqual(REST_POSE)`.
  - `periodic in POSE_CYCLE_MS`: 20 instants `t = k · 2_345_671` (k 0..19). Each of the three fields of `poseAt(t + POSE_CYCLE_MS)` is within 1e-9 of `poseAt(t)`.
  - `pitch and roll are bounded by amp and multiples of ANGLE_STEP`: t from 0 to 20 000 step 37. `|pitch| ≤ PITCH.amp + 1e-12`, `|roll| ≤ ROLL.amp + 1e-12`, and `|x/ANGLE_STEP − round(x/ANGLE_STEP)| ≤ 1e-12` for both.
  - `at least 20 distinct pitch and roll values per period sampled every 50 ms` (round(x/ANGLE_STEP) into a Set).
  - `the three fields do not share a phase`: over t 0..10 000 step 50, some t has `dz === 0 && pitch !== 0`, and some t has `pitch === 0 && roll !== 0`.
  - `CYCLE_POSES: rest, the 8 corners of the cube, then poseAt(k·7919) for k 1..8`: length 17, `[0]` equals `REST_POSE`, `slice(1, 9)` as a set equals the 8 sign combinations, `slice(9)` equals `[1..8].map(k => poseAt(k*7919))`, and the list is frozen.
- [ ] **Step 2: Replace the `PHASES` describe with one over `CYCLE_POSES`**, `describe.each(["wide","tall"])` × `it.each(CYCLE_POSES)`:
  - `raftAt keeps the distances between its vertices`: flatten the rest mesh's vertices and the posed mesh's vertices, which share indexing. Take 50 pairs `(i, j)` with `i = (k·7919) % n` and `j = (k·104729 + 1) % n`. Each distance equals the rest distance within 1e-9.
  - `every decal vertex lies on the posed text plane`: for faces with `mat === "navy"`, `|dot(p − plane.origin, normalize(cross(plane.u, plane.v)))| ≤ 1e-9`, where `plane = raftPlane(site, pose)`.
  - `the posed plane's u′ and v′ are unit and perpendicular`: within 1e-12.
  - `signAt(site, pose).backing` equals `[raftAt(site, pose)]` (`toEqual`).
  - Keep the `signAt(site, REST_POSE) is BLOG_SIGNS[site]` test.
- [ ] **Step 3: Run** `npx vitest run src/scenes/sign-platform.test.ts`. Expected: FAIL (`poseAt` is not exported).
- [ ] **Step 4: Implement** the Produces list in `sign-platform.ts`. `pitchAt` and `rollAt` share one private helper `quantizedSine(wave, step, tMs)`. Have `heaveAt` use it too, with `(HEAVE, HEAVE_STEP)`. `CYCLE_POSES` is built at load, after `poseAt`.
- [ ] **Step 5: Run** the file again. Expected: PASS. Then `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(#456): poseAt with pitch and roll, CYCLE_POSES`.

### Task 2: ground-sign aspect on the box sides; level 2 and ships over `CYCLE_POSES`

**Files:**
- Modify: `src/kit/legibility.ts` (`signMetrics`, aspect)
- Test: `src/kit/legibility.test.ts`, `src/lab/signs.test.ts`, `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Consumes: `CYCLE_POSES`, `signAt`, `seaPlatformAt` (Task 1).
- Produces: no new names. `signMetrics(spec, scale).aspectError` changes for `ground` signs only.

- [ ] **Step 1: Failing test** in the ground-sign block of `legibility.test.ts`, `a pitched ground sign's aspect counts the stretch, not the tilt (#456)`. Build the WRITING ground sign used there (the `ground: true` helper at line ~405) on a plane whose u and v are `rigid`-posed with pitch 1.5° and roll −1° (origin at 0). Assert `signMetrics(...).aspectError` is within 1e-3 of the axis-length value `|(|v′p| / |u′p|) / GROUND_ASPECT − 1|`, with `u′p = project(u′) − project(0)` and the same for v′, and that it is `< 0.08`. Also assert that a vertical sign (one of the file's existing `diagonalWall` specs) gives the same `aspectError` as before: pin the current value computed in the test with the bounding-box formula.
- [ ] **Step 2: In `signs.test.ts`**, the describe "level 2 across the heave cycle" iterates `CYCLE_POSES` (index i, label `pose i/17 (dz, pitch°, roll°)`). Use `signAt(site, pose)` and `seaPlatformAt(…, pose)`, with `checkSign` at 1.17 and 0.83 = [] in the crop and against the world. Rename the describe to "… across the pose cycle … (#444, #456)". `platform(site, pose)` takes a `RaftPose`.
- [ ] **Step 3: In `sea-anim.test.ts`**, "no ship piece … crosses the Writing word at any pose of the heave cycle" becomes "… at every pose of CYCLE_POSES, at either site (#444, #456)", with 34 signs and a 30 000 ms timeout. Drop the now-unused `HEAVE` and `heaveAt` imports.
- [ ] **Step 4: Run** `npx vitest run src/kit/legibility.test.ts src/lab/signs.test.ts src/scenes/sea-anim.test.ts`. Expected: FAIL on `aspect` at the 8 roll −1° corners, and on the new legibility test.
- [ ] **Step 4b:** The existing ground-sign tests of `legibility.test.ts` (#452, synthetic `groundDiagonal` planes at rest) must stay green unchanged: at rest the two measures coincide. WRITING is the only `ground` sign in `src/` (`src/scenes/sign-platform.ts:38`).
- [ ] **Step 5: Implement** the aspect measure in `signMetrics`: for `spec.ground`, use the ratio of the projected lengths of the box's sides `(x0,y0)→(x0,y1)` and `(x0,y0)→(x1,y0)`. Otherwise keep the bounding-box ratio. Update the JSDoc line ("the aspect error is measured …").
- [ ] **Step 6: Run** the three files plus `src/scenes/sign-platform.test.ts`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(#456): level 2 and the ships rule over CYCLE_POSES; ground aspect on the box sides`.

### Task 3: `platformAnimator` with pitch and roll

**Files:**
- Modify: `src/scenes/raft.ts` (per-site rest memo), `src/scenes/platform-animator.ts`
- Test: `src/scenes/platform-animator.test.ts`, `src/world/assemble.test.ts` (its heave test stays and must stay green)

**Interfaces:**
- Consumes: `poseAt`, `POSE_CYCLE_MS`, `REST_POSE`, `seaPlatformAt`.
- Produces: `platformAnimator(opts)` with the same signature and the same `PlatformAnimator` interface.

- [ ] **Step 1: Rewrite the `#444` describe** as `describe("platformAnimator pitches, rolls and heaves the raft (#444, #456)")`. `at(site, pose)` builds with `seaPlatformAt`.
  - `before any tick the layer is the rest pose`.
  - `tick(100) over 30 s reports the layer exactly when poseAt(clock) changes, and the layer is seaPlatformAt at poseAt(clock)`. Keep `prev = poseAt(0)`. Each tick, `changed = !sameFields(poseAt(t), prev)` and `expect(r.size > 0).toBe(changed)`. When it reports, `toEqual(at("wide", poseAt(t)))`. Count ≥ 100 reports.
  - `two consecutive ticks on the same quantized pose: the second reports nothing and reuses the array`. Find a t after a report where `poseAt(t+1)` equals `poseAt(t)` in all three fields, then `tick(1)` → empty set and `solidsOf` is the same object (`toBe`).
  - `after ten ticks of 100 ms, tick(POSE_CYCLE_MS) leaves the same pose and reports nothing`: empty set, layer `toEqual` the one before, and `toEqual(at("wide", poseAt(1000)))`.
  - `tick(NaN|Infinity|0|−5) does not advance`: keep the existing test, with 300 paired ticks.
  - `a site change mid-swing moves the raft at its current pose`: 10 × `tick(100)`, `setSite("tall")`, `tick(100)` → reported, `toEqual(at("tall", poseAt(1100)))`, and `poseAt(1100)` ≠ `REST_POSE`.
  - The two existing `reducedMotion` tests stay (rest, nothing in 10 s; a site change reported once with rest).
  - `budget: tick(16.7) over 10 simulated seconds reports at most 250 times (≤ 25 per second)`, and more than 0.
  - Remove "each pose is built once: the same (site, dz) reuses its arrays". "each site is built once: coming back to a site reuses its arrays" (STILL) stays.
- [ ] **Step 2: Run** `npx vitest run src/scenes/platform-animator.test.ts`. Expected: FAIL (the layer has no pitch and roll).
- [ ] **Step 3: Implement.** In `raft.ts`, a module-level `Map<WritingSite, MeshFace[]>` holds the unposed faces, built once. `raftAt` maps them through `rigid` into fresh faces (`{ ...f, pts: rigid(...) }`), so it never returns or mutates the memo. In `platform-animator.ts`: `clock = (clock + dtMs) % POSE_CYCLE_MS` and `pose = poseAt(clock)` (or `REST_POSE` under `reducedMotion`). A per-site memo `Map<WritingSite, { pose: RaftPose; solids: Solid[] }>` rebuilds when any field differs. A report happens when `site !== seen` or the pose differs from `seenPose` in any field. Update the JSDoc, which today says "about 9 times per second": say ≤ 25 per second, and say "one memo per site".
- [ ] **Step 4: Run** `npx vitest run src/scenes/platform-animator.test.ts src/scenes/raft.test.ts src/scenes/sign-platform.test.ts src/world/assemble.test.ts`. Expected: PASS. `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(#456): platformAnimator poses the raft with poseAt, one-pose memo per site`.

### Task 4: time-lapse captures and their README (controller, needs the browser)

**Files:**
- Create: `docs/superpowers/specs/assets/451-balsa-tablones/balanceo/balanceo-{1..6}.png`, `…/balanceo/README.md`
- Scratch (not committed): `.scratch/evals-456.md`, `.scratch/lapse-diff.mjs`

- [ ] **Step 1:** `npm run dev -- --host --port 5173`. Launch agent-browser with the DevTools extension (`CLAUDE.md`) at viewport 1600×900 @2, then open `/lab/blog.html?bloom=on&speed=0.000001`.
- [ ] **Step 2:** Hook the listener (Technical decision 5). Take `balanceo-1` before any call, then reach each next t with `deltaMS = Δt / 0.000001`, render, and screenshot.
- [ ] **Step 2b:** Check the rendered pose. The listener passes `ticker.deltaMS * speed` to `stage.tick` (`src/lab/page.ts:88`), so the animator's clock is the floating-point sum of `(Δt / 1e-6) · 1e-6` plus the page's own frames (≈ 1e-4 ms each). In `.scratch/`, accumulate that sum exactly as the page does and assert that `poseAt` of the sum equals `poseAt(T)` for all six T. If it does not, the README states the pose of the sum.
- [ ] **Step 3:** Get the raft's screen box: the corners of `PLATFORM_DECK` at the wide site, at z −1.4 and −0.2, projected and taken to pixels with the stage container's position and scale (from `__PIXI_DEVTOOLS_WRAPPER__.stage`). `.scratch/lapse-diff.mjs` checks that each PNG is 3200×1800 and that the mean absolute RGB difference inside that box between `balanceo-1` and each of the other five is > 1 level. Note the six values for the PR.
- [ ] **Step 4:** Write the `README.md` (Spanish). Each line has the form ``- `balanceo-N.png` — t = T ms: dz D, pitch P°, roll R° (poseAt).``, with D, P and R formatted as in the Global Constraints. Then a "Cómo se tomaron" section with the method and the diff values.
- [ ] **Step 5: Commit** `docs(#456): pitch and roll time-lapse`.

### Task 5: `docs.test.ts` and `CONTEXT.md`

**Files:**
- Modify: `src/lab/docs.test.ts`, `CONTEXT.md` (entry **Sign**)

**Interfaces:**
- Consumes: `poseAt`, the Task 4 folder.

- [ ] **Step 1: Failing tests** in `docs.test.ts`:
  - `LAPSE` becomes `${SPECS}assets/451-balsa-tablones/balanceo/` and `POSES` becomes 6 files with `TIMES = [0, 1675, 3350, 5025, 7919, 15838]`. The size test covers the six (3200×1800). `existsSync(`${SPECS}assets/441-tabla-flotante`)` is true.
  - `the pitch and roll README names each capture with t and poseAt's dz, pitch and roll`: exactly one line starts with ``- `balanceo-N.png` ``, and it contains `t = ${T} ms`, `dz ${signed(dz, 2)}`, `pitch ${signed(deg(pitch), 1)}°` and `roll ${signed(deg(roll), 1)}°`. `signed(v, d)` uses U+2212 for negatives and `+` for positives, and gives no sign for a zero after rounding. The README also contains `poseAt`.
  - The CONTEXT.md Sign test also requires `` `PITCH` ``, `` `ROLL` ``, `` `ANGLE_STEP` ``, `` `poseAt` ``, `` `CYCLE_POSES` `` and `one pose`.
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts`. Expected: FAIL on CONTEXT.md, until Step 3.
- [ ] **Step 3: Update CONTEXT.md Sign:** `platformAnimator` poses the raft with `poseAt`: heave (`HEAVE`), pitch about n (`PITCH`, ±1.5°, 9.1 s) and roll about u (`ROLL`, ±1.0°, 7.3 s), quantized to `HEAVE_STEP` and `ANGLE_STEP` (0.1°), periodic in `POSE_CYCLE_MS`. It keeps the rest geometry once per site and a one-pose memo, it reports only when the quantized pose or the site changes, and it is still under `reducedMotion`. `CYCLE_POSES` lists the 17 poses that level 2 and the ships rule sample. Add the new names to the Code line.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: green.
- [ ] **Step 5: Commit** `docs(#456): docs tests pin the pitch and roll time-lapse; CONTEXT.md Sign`.

## Grilling

- Rounds: 1 (griller model: fable). 19 questions.
- Sources: ISSUE 9 (Q3, Q8, Q10, Q11, Q12, Q14 in part, Q16, Q17, Q1 for the 0.035 figure); CODE 10 (Q2 `sign-platform.ts:38`, Q4 `platform-animator.test.ts` "without it, the world's platform heaves", which counts reports ≥ 20 in 67 ticks; Q5/Q15 `src/lab/page.ts:84-88`; Q6 `src/iso/rigid.ts:5-6`, where `RAFT_N` is the cross axis in plan, z = 0, not the normal; Q7 `legibility.ts:150-156`, a baseline fit on the projected left-baseline points, which passed at every corner in the probe; Q13 `MeshFace { pts, mat?, toneOffset? }`, primitives only; Q18 `platform-animator.ts` tick; Q19 `src/english.test.ts:189-190`, which walks `src/` and `lab/` only; Q9 measured: `signs.test` plus `sea-anim.test` run in 21 s today, with no global `testTimeout`); NO SOURCE 3 (Q1 oracle authority → A1; Q19 ADR → A2; Q3 `heaveAt` refactor → A3).
- Roll at 50 ms sampling gives 21 distinct values, pitch 31. `HEAVE.amp` 0.15 is 15 × `HEAVE_STEP`, so the dz corners are reachable.
- Plan changes: Task 4 Step 2b (verify the rendered pose against the page's accumulated clock), Task 2 Step 4b (the #452 ground tests stay unchanged), and the Assumptions section.
- Assumptions: A1–A4. Follow-up issues opened: none. Status: ok.
