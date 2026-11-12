# Industrial lamp and parameterized tech props in the kit (#136) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No scene builds the cyan lamp, the helipad or the green terrace by hand. They use kit props (`industrialLamp`, `helipad(at, r)`, `rooftopGarden(…, cones)`), and the world looks exactly as it does today.

**Architecture:** `src/kit/props.ts` gets one named prop, `industrialLamp`, and two optional parameters with defaults that change nothing: the `helipad` radius and the `rooftopGarden` cone range. The eight inline copies of the cyan lamp (factory, hinterland, shipyard, shipyard-east, station) and the hand-built helipad and terrace in `tech.ts` are replaced with calls to these props, through `place(solids, accents, lit)`. Two things guard "no visual change". A scene fingerprint test pins the solids and accents of every touched scene, recorded on `main` before any edit. A source-scan test asserts that the copies are gone.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`).

**Spec:** issue #136, the "Agent Brief (ready-for-agent)" comment of 2026-11-12 (the owner's decision of 2026-11-11). It supersedes the issue body and the 2026-11-08 brief.

## Global Constraints

- Lamp, option (b): a named variant in the kit with a steel post of 0.6×0.6×5 and a **cyan** bulb of **r 1.2**. Base z, post height and centering are parameters. The amber `lamp` of the kit does not change.
- `helipad` takes an optional radius (**default 3**). `rooftopGarden` takes an optional cone count (**default 3..5**). `tech.ts` uses **r 2.5** and **1..3 cones**: **rng consumption does not change**.
- Do not change the color or the measures of any lamp. `waterfront.ts:24-26` (an amber lamp, 0.3×0.3×6.5) and the scaffolding at `shipyard.ts:100-101` are not copies of the lamp and stay untouched. The rest of Portfolio's props, and moving Portfolio to the kit, are out of scope.
- `hinterland.test.ts`, `factory.test.ts`, `portfolio-accents.test.ts`, `tech.test.ts` and the `PIECES` hashes of `world-baseline.test.ts` pass **without being edited**.
- Code and comments in English (`src/english.test.ts`).

## Decisions (technical assumptions)

- **Bulb offset.** All eight copies put the bulb 0.3 from the post's corner on x and on y, or on the post's axis when centered: the brief's "+0.8" in `shipyard.ts:197` is `STREET_EDGE + 0.5` (the post) + 0.3. So the offset is not a free parameter. The "offset of the dot" in the brief is covered by `center`, which decides whether `at` is the corner or the axis. An extra `dx/dy` would have no caller (YAGNI).
- **Name and constant.** The prop is `industrialLamp`, with the post height as a default parameter `h = 5` (no exported constant: nothing outside the prop would read it). The local `LAMP_H` constants of factory and hinterland are deleted if nothing else reads them.
- **Return shape.** `industrialLamp` returns `Lit & { bulb: Vec3 }`, the same shape as `lamp`.
- **Fingerprint guard.** `fingerprint` (`src/iso/fingerprint.ts`) rounds numbers to 1e-6, so a different float operation order (`(tx+0.5)+1` against `tx+1.5`) does not count as a change. The test is new and lives at `src/scenes/props-dedupe.test.ts`. It is recorded on `main` before Task 1, and it stays in the repo with a header like the one in `world-baseline.test.ts`: it guards #136, and it may be deleted when a later issue moves these scenes on purpose.

## Assumptions (from grilling)

- **The cone range is a positional tuple `cones = [3, 5]`, not an options object.** This mirrors the kit's positional optionals (`sign(at, w, h, face = "s")`, `puddle(…, z, alpha)`). The other callers, `src/kit/forms/reconversion.ts:58` and `src/kit/roofs.ts:53`, keep the default. Rejected alternative: `{ cones }`.
- **The intermediate red suite is accepted.** The `test(#136): evals` commit is red by design: the pipeline requires committing failing evals. CI (`.github/workflows/deploy.yml`) runs only on `pull_request` and on pushes to `main`, and the branch is pushed in stage 8, after Task 3.
- **The fingerprint baseline.** It is recorded from the working tree at the branch base `3a15116` (`origin/main`), before any scene edit, by running the scenes in a throwaway script and pasting the output. If `main` moves, the rebase in stage 8 runs the suite again, and a scene change from `main` shows up there as a fingerprint mismatch to explain.

## Review Focus

1. **Push order.** Solids and accents must come out in the same order as before. `place` pushes solids, then accents, into separate arrays, so order within each array is kept only if the call replaces the two pushes in the same spot. The scene fingerprint test pins this.
2. **rng in tech.** `helipad` uses no rng. `rooftopGarden` with `[1, 3]` must call `rng.int(1, 3)` and then two `rng.next()` per cone, as today. Pinned by the fingerprint of `tech(createRng(seed))` and by a test with a spy rng in Task 2.
3. **Centered lamp in station.** The post goes at `at − 0.3`, the bulb on the axis at `at.z + h` (6.15 with h 6 at z 0.15). Pinned by the `industrialLamp` unit test and the scene fingerprint.
4. **Lamps conditional on terrain** (hinterland `onIndustrial`, `ok`) keep their condition: only the body of `lamp()` is replaced. Pinned by the fingerprint.
5. **`portfolio-lights` / occlusion** may look for steel posts by their measures. With identical measures nothing changes. Pinned by the existing tests, which are not edited.

---

### Task 0 (stage 3, evals): scene fingerprint and source scan

**Files:**
- Create: `src/scenes/props-dedupe.test.ts`

- [ ] **Step 1:** Write `describe("props dedupe (#136)")`:
  - `it("touched scenes build the same solids and accents")`. For seeds `[1, 7, 42]`, build `factory(createRng(s))`, `hinterland(createRng(s))`, `shipyard(createRng(s))` (this one includes `station` and `shipyardEast`) and `tech(createRng(s))`. Record `${fingerprint(solids)}/${fingerprint(accents)}` per scene and seed, adding `ground` where the scene has it. Compare with `toEqual` against a literal `SCENES` record captured on `main`, before any edit.
  - `it("no inline cyan lamp, local lamp or hand-built helipad/terrace remains")`. Read the sources of `src/scenes/{factory,hinterland,shipyard,shipyard-east,station}.ts` and assert that each has no match for `/function lamp\b/` and none for `/r: 1\.2, color: "cyan"/`. Read `src/scenes/tech.ts` and assert that it has none for `/r: 2\.5, h: 0\.3/` (the inline helipad, `tech.ts:72`) and none for `/kind: "cone", at: v3\(tx/` (the inline terrace cones, `tech.ts:73`). Not `"leafDark"`: `tech.ts` also uses it at :42, :82, :104 and :127. The precedent for reading sources is `src/iso/pixi-free.test.ts` (`fileURLToPath(new URL("../../", import.meta.url))` + `readFileSync`). No formatter is configured (`package.json`), so the literals keep their key order.
- [ ] **Step 2:** Run `npx vitest run src/scenes/props-dedupe.test.ts`. Expected: the fingerprint test passes, because it was recorded on `main`, and the source-scan test FAILS.
- [ ] **Step 3:** Commit `test(#136): evals`.

### Task 1: `industrialLamp` in the kit, used by factory and hinterland

**Files:**
- Modify: `src/kit/props.ts` (next to `lamp`)
- Modify: `src/scenes/factory.ts:44-49`, `src/scenes/hinterland.ts:30-39`
- Test: `src/kit/props.test.ts`

**Interfaces:**
- Produces: `export function industrialLamp(at: Vec3, opts?: { h?: number; center?: boolean }): Lit & { bulb: Vec3 }`.
  - When `center` is false, `at` is the northwest corner of the post.
  - When `center` is true, `at` is the post's axis at its base.

- [ ] **Step 1: Failing tests** in `props.test.ts`:
  - `"industrialLamp: steel post 0.6×0.6×5 and cyan bulb r 1.2 on top"`: `only(l.solids)` toEqual `prism(AT.x, AT.y, AT.z, 0.6, 0.6, 5, "steel")` as a literal object (`{ kind: "prism", at: AT, w: 0.6, d: 0.6, h: 5, mat: "steel" }`). `l.accents` toEqual `[{ kind: "dot", at: v3(AT.x + 0.3, AT.y + 0.3, AT.z + 5), r: 1.2, color: "cyan" }]`. `l.bulb` equals that point.
  - `"industrialLamp: h and center"`: `industrialLamp(v3(195.5, 102, 0.15), { h: 6, center: true })` gives the post `{ at: v3(195.2, 101.7, 0.15), w: 0.6, d: 0.6, h: 6 }` (toBeCloseTo on x and y) and the bulb `v3(195.5, 102, 6.15)`.
  - `"lamp (amber) does not change"` is already covered by the existing `lamp` test: do not touch it.
- [ ] **Step 2:** Run `npx vitest run src/kit/props.test.ts`. Expected: FAIL (no export).
- [ ] **Step 3:** Implement it with `prism` from `city-pieces`. Doc comment: "Industrial lamp of Portfolio: steel post and cyan bulb r 1.2; `center` puts `at` on the post's axis."
- [ ] **Step 4:** In factory and hinterland, delete `function lamp` (and `LAMP_H` if nothing else uses it). Each call `lamp(o, a, x, y)` becomes `place(o, a, industrialLamp(v3(x, y, 0)))`, keeping its loop and its condition.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck`. Expected: green, except the tech/shipyard/station part of the Task 0 source scan.
- [ ] **Step 6:** Commit `feat(#136): industrialLamp in the kit; factory and hinterland use it`.

### Task 2: shipyard, shipyard-east and station use `industrialLamp`

**Files:**
- Modify: `src/scenes/shipyard.ts:60-63, 194-199, 205-208`, `src/scenes/shipyard-east.ts:45-48, 82-85`, `src/scenes/station.ts:258-261`

**Interfaces:** Consumes `industrialLamp`, `place` (Task 1).

- [ ] **Step 1:** Replace each pair (steel post push + cyan dot push) with one `place(out, accents, industrialLamp(...))`:
  - quay: `v3(QUAY_X - 1.4, y, 0)`;
  - street: `v3(STREET_EDGE + 0.5, y, 0)`;
  - seam fence: `v3(x, 88.2, 0)`;
  - floating dock: `v3(px, py, top)`;
  - yard: `v3(px, py, SLAB_TOP)`;
  - station: `industrialLamp(v3(195.5, y, 0.15), { h: 6, center: true })`, which keeps the comment "the coordinate is the center of the post".
- [ ] **Step 2:** Run `npm test` and `npm run typecheck`. Expected: green, except the tech part of the source scan. The scene fingerprint is unchanged.
- [ ] **Step 3:** Commit `refactor(#136): shipyard, shipyard-east and station use industrialLamp`.

### Task 3: `helipad` radius and `rooftopGarden` cones; tech uses them

**Files:**
- Modify: `src/kit/props.ts` (`helipad`, `rooftopGarden`), `src/scenes/tech.ts:72-73`
- Test: `src/kit/props.test.ts`

**Interfaces:**
- Produces: `helipad(at: Vec3, r = 3): Lit` and `rooftopGarden(at: Vec3, w: number, d: number, rng: Rng, cones: readonly [number, number] = [3, 5]): Solid[]`.

- [ ] **Step 1: Failing tests:**
  - `"helipad: optional radius, 3 by default"`: `helipad(AT)` toEqual `helipad(AT, 3)`. `only(helipad(AT, 2.5).solids)` toEqual `{ kind: "cylinder", at: AT, r: 2.5, h: 0.3, mat: "paving", sides: 8 }`. The dot is the same as with the default radius.
  - `"rooftopGarden: optional cone range, 3..5 by default"`:
    - `rooftopGarden(AT, 8, 6, createRng(s))` toEqual `rooftopGarden(AT, 8, 6, createRng(s), [3, 5])` for s in 1..20.
    - With `[1, 3]`, across seeds 1..50, the count of cones is in 1..3 and takes at least the values 1 and 3.
    - A spy rng (a wrapper that records calls) shows `int(1, 3)` first, then exactly 2·n calls to `next()`.
- [ ] **Step 2:** Run `npx vitest run src/kit/props.test.ts`. Expected: FAIL on the 2.5 radius and on the cone range.
- [ ] **Step 3:** Implement the defaults, and update the doc comments: "Center. Radius `r` (3)." and "… `cones` cones (3..5) …".
- [ ] **Step 4:** In `tech.ts`, the helipad branch becomes `place(out, accents, helipad(v3(tx + tw / 2, ty + td / 2, z), 2.5))`. The terrace branch becomes `out.push(...rooftopGarden(v3(tx + 0.5, ty + 0.5, z), tw - 1, td - 1, rng, [1, 3]))`. Import from `../kit/props`.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck`. Expected: all green, including both Task 0 tests and `tech.test.ts` unedited.
- [ ] **Step 6:** Commit `feat(#136): helipad radius and rooftopGarden cones; tech uses the kit`.

## Grilling

The griller ran one round (model: fable) and asked 18 questions.

**Answers by source:** CODE 15, ISSUE 2, DOC 0, NO SOURCE 3 (all technical assumptions).

- **Q1 (CODE).** `world-baseline.test.ts:9` hashes `PIECES` with the same `fingerprint`, which rounds to 1e-6 (`src/iso/fingerprint.ts:8`). `farol` is the kit `lamp` (brief), and that prop is not touched. The replaced call sites keep the same expressions: `tx + tw / 2` goes in as the `at` of `helipad` unchanged.
- **Q2 (CODE).** The eight lamps:
  - factory.ts:47-48 and hinterland.ts:37-38: post `(x, y, 0)`, h `LAMP_H` = 5 (factory.ts:41, hinterland.ts:28); bulb `(x+0.3, y+0.3, 5)`.
  - shipyard.ts:61-62: post `(QUAY_X−1.4, y, 0)`, h 5; bulb `(QUAY_X−1.4+0.3, y+0.3, 5)`.
  - shipyard.ts:196-197: post `(STREET_EDGE+0.5, y, 0)`; bulb x `STREET_EDGE+0.8`.
  - shipyard.ts:206-207: post `(x, 88.2, 0)`; bulb `(x+0.3, 88.5, 5)`.
  - shipyard-east.ts:46-47: post `(px, py, top)`; bulb `(px+0.3, py+0.3, top+5)`.
  - shipyard-east.ts:83-84: post `(px, py, SLAB_TOP)`; bulb `+0.3, +0.3, SLAB_TOP+5`.
  - station.ts:259-260: post `(195.5−0.3, y−0.3, 0.15)`, h 6; bulb `(195.5, y, 6.15)`.
- **Q3 (CODE).** `tech.ts:72-73` and `props.ts:120-131` match except for r and the cone count: the dot is `r 0.6 amberMid` at z+0.3, the solid is paving with 8 sides, the slab is leafDark 0.3, and the cones are r 1 h 2 at `at+1+rng·(w−2)`. tech's `tx+1.5`, `tw−3` is the same as the kit's `at = tx+0.5`, `w = tw−1`: a single inset.
- **Q4 (CODE).** `shipyard.ts:225` `station(solids, accents)` (station.ts:17: "deterministic and uses no rng"); `shipyard.ts:233` `shipyardEast(…, rng)`.
- **Q5.** The baseline is recorded at base `3a15116`. See Assumptions.
- **Q6 (CODE).** The push of the post and the push of the bulb are adjacent at every site. In hinterland the condition guards the call to `lamp()` (hinterland.ts:110, :185), so it covers both pushes.
- **Q7 (CODE).** `props.ts:16`: `place` pushes `...lit.solids` and then `...lit.accents`, and returns void.
- **Q8 (CODE).** `tech.ts:73` calls `rng.int(1, 3)` and then two `rng.next()` per cone; `props.ts:130` does the same with `int(3, 5)`.
- **Q9 (CODE).** Both are `lamp(out, accents, x, y)`, with LAMP_H 5.
- **Q10 (CODE).** `station.ts:259-260`.
- **Q11 (CODE).** The pattern `r: 1.2` appears in the 5 scenes only on the 8 lamp lines. The scan avoids `"leafDark"`; see Task 0.
- **Q12 (CODE).** The precedent is `src/iso/pixi-free.test.ts`. No formatter is configured.
- **Q13.** NO SOURCE, technical assumption (intermediate red commits accepted).
- **Q14.** NO SOURCE, technical assumption. The exported `INDUSTRIAL_LAMP_H` was dropped: `h = 5` is a default parameter.
- **Q15.** NO SOURCE, technical assumption (positional tuple). The other callers are reconversion.ts:58 and roofs.ts:53.
- **Q16 (CODE).** `src/scenes/portfolio-lights.ts` has no predicate on steel or 0.6. The guard is the scene fingerprint plus the tests the brief lists.
- **Q17 (ISSUE).** The two ADRs (veil, seam) do not govern the kit. The owner decided (brief, 2026-11-12): "Farol: opción (b). Se agrega al kit una variante con nombre, por ejemplo `industrialLamp`".
- **Q18 (CODE).** `props.ts:13` defines `Lit`; `props.ts:19` defines `lamp(at): Lit & { bulb: Vec3 }`.

**Spec ambiguities:** none. **Issues opened:** none. The plan changed in detail only (line numbers, scan regex, no exported constant), so there was no second round. **Result: ok.**
