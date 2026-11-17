# Storybook content framing, `__lab.tick` and responsive layout (#400): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The storybook frames each exhibit by the projected bounds of everything it draws (faces, ground, clipped shadows, halos and 16 samples of the animation), the DEV hook gains `tick(dtMs)`, and `lab/storybook.html` stacks index, canvas and panel on narrow screens.

**Architecture:** A new pure module `src/lab/frame.ts` (no Pixi) exports `contentFrame`, which returns the `RenderItem[]` that `fitTransform` (`src/world/frame.ts`) already consumes. `src/lab/storybook.ts` computes it once per `show()`, before `buildStage`, and `fit()` reuses it; `fixedScaleFit` is unchanged. The layout change is CSS only.

**Tech Stack:** TypeScript, vitest, the iso engine (`src/iso`, Pixi-free), Pixi v8 (`storybook.ts` only), agent-browser for the pixel checks.

**Spec:** issue #400 (its body: "Decisiones heredadas" 1–5 and "Criterios de aceptación"), parent story #395, `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md` §2. Base branch `feature/395-storybook-luces-encuadre` (already carries #399: `buildRenderList(solids, heading, clip)`, `buildStage(scene, animators, { clip })`).

## Global Constraints

- Code, comments, strings and identifiers in **English** (`src/english.test.ts`); `docs/` prose may stay Spanish.
- `src/lab/frame.ts` imports no Pixi; `frame.test.ts` imports no Pixi (`src/iso/pixi-free.test.ts` rules).
- Halo reach for dots: `r × 4.5` (the largest `k` of `HALO_FALLBACK`, `src/world/frame.ts`), derived from the constant, not hard-coded.
- Animation samples: **16**, step `BEAM_PERIOD_MS / 16` (`BEAM_PERIOD_MS` = 8000, `src/scenes/sea-anim.ts`).
- `boxFrame(box, h ?? FRAME_H)` is part of the frame whenever `box` is given.
- `window.__lab` stays DEV-only (`import.meta.env.DEV`).
- `fixedScaleFit`, `cover-scale.ts` and `exhibits.test.ts` (including `SLACK` 8) do not change.
- Media query copied verbatim from the issue (decision 4). The HTML elements do not change.
- `npm test` and `npm run typecheck` pass.

## Decisions (technical assumptions, declared)

1. **Signature.** `contentFrame(scene: Pick<WorldScene, "terrain" | "ground" | "solids" | "accents">, animators: readonly Animator[], opts: { box?: Box; h?: number; clip?: Box } = {}): RenderItem[]`. It returns items, not bare points, so `fitTransform` takes it as is. The `Pick` lets tests build toy scenes without the world's sub-scenes.
2. **Sampling order.** For `k = 0..15`: read every layer of every animator (sample k), then `a.tick(BEAM_PERIOD_MS / 16)` on each animator. 16 reads, 16 ticks, 8 s total, so the beam ends at the angle where it started.
3. **Static terrain list** is `[...terrain.ground, ...terrain.bleed, ...terrain.water, terrain.foam, ...scene.ground, ...scene.solids]` in one `buildRenderList(…, undefined, clip)` call, as the issue writes it. The water claimed by animators is included too: a superset of what is drawn, and the animated bands cover the same area.
4. **`contentFrame` runs before `buildStage` in `show()`.** `buildStage` draws every animated layer once on construction (`src/world/stage.ts`, `redraw.get(id)!()`), so the stage starts from the post-sampling state. If it ran after, the 16 ticks would consume change flags the stage never sees (stale layers until the next change).
5. **Stored per show.** `show()` stores `content: RenderItem[]`; `fit()` computes `fitTransform(content, w, h)`. Resize and `c` never tick.
6. **Pieces:** `const { box, h } = solidsBox([...piece.ground, ...piece.solids])` and `contentFrame(piece, anims, { box, h })`, no `clip`. Regions and contexts: `{ box: e.box, h: e.h, clip: e.box }`.
7. **`tick` hook:** `tick(dtMs) { stage?.tick(dtMs); app.render(); }`. `stage.tick` already redraws the changed layers.
8. **The browser checks are the controller's task (Task 4)**, not a subagent's: they need the dev server and agent-browser with the PixiJS extension (`CLAUDE.md`). The script is `.scratch/evals-400.md` from stage 3.

## Criteria → tasks

- `frame.test.ts` (toy shadow/clip, 4.5·r dot, poly, `boxFrame`, 16 positions of a moving accent, real `faro` beam at 8 angles) → Task 1.
- `__lab.tick` exists only in DEV and `storybook.test.ts` requires it in the member list → Task 2.
- Decisions 1–2 of the issue (storybook uses `contentFrame` for regions, contexts and pieces; computed once per `show()`; `fit()` reuses it) and the 8 s clock note in the header → Task 2.
- Decision 4 (responsive CSS) and the README paragraph → Task 3; the host size at 412 and the unchanged three columns at 1600 → Task 4.
- The 2 px sky ring on the 11 exhibits in both viewports and `faro` at 8 angles, `setCoverScale(1.17)` → `fit().scale` 1.17, the after captures → Task 4. `cover-scale.test.ts`, `exhibits.test.ts`, `npm test`, `npm run typecheck` green → every task (none touches those files).

## Assumptions

Recorded after the stage-2 grilling (every item is an engineering choice any option of which satisfies the issue):

1. `contentFrame` builds its dot/poly items by hand (`{ layer: "ground", pts, color: 0 }`, as `boxFrame` does): `accentItem` (`src/iso/accent.ts:14-20`) returns an `AccentItem`, not a `RenderItem`. Rejected: a new `RenderItem` layer kind (touches the engine for a lab need).
2. A dot's halo disc is reduced to its four axis extremes: `fitTransform` takes the axis-aligned min/max of the points (`src/world/frame.ts:46-55`), so the bounding box is the same as the disc's.
3. `terrain.foam` with no triangles is valid input: `tessellate` of a `ground` solid with `tris: []` yields no faces and `buildRenderList([])` returns `[]` (`src/iso/render-list.ts:31-48`).
4. The real `faro` test uses its own fresh `assembleWorld` so the sea clock starts at 0 (`src/scenes/sea-anim.ts:129`) and the 16 samples (every π/8 from angle 0, `angleAt`, `sea-anim.ts:156`) include the 8 asserted angles. Rejected: sharing the world with other tests (their ticks would shift the phase).
5. The source-text tests in Task 2 follow the existing style of `storybook.test.ts` (the file boots Pixi on import, so it is read as text, `storybook.test.ts:4-5`). Rejected: extracting a `show` factory for injection (refactors the page beyond the issue).
6. No `?frame=box` switch to compare old and new framing: the "before" captures `01..11.jpg` already exist and the issue does not ask for one. Each task is its own commit and can be reverted alone.
7. Re-sampling (and the 8 s clock jump) happens on every exhibit change only: `c` and `setCoverScale` call `fit()`, resize calls `fit()` (`storybook.ts:110,127`), and `fromHash` calls `show` only when the exhibit changes (`e !== current`).

## Review Focus

1. **Resize or key `c` after a show:** the frame must not change or tick the clock. Task 2 pins it: `contentFrame(` is called inside `show` only.
2. **Exhibit with reduced motion or no animators:** `tick` returns no changes; the frame is the static content plus the box. Task 1 test "without animators it is the static content plus the box".
3. **Animator whose layer list is empty in some samples** (ship offscreen, beam with `reducedMotion`): no crash, nothing added. Task 1 toy animator returns an empty accent layer on odd samples.
4. **Order with `buildStage`:** stage built after sampling. Task 2 source test: in `show`, `contentFrame(` comes before `buildStage(`.
5. **Narrow viewport at 412 CSS px:** host ≥ 400 × 0.45·915. Task 4 browser check (cannot be measured in jsdom).

---

### Task 1: `contentFrame` in `src/lab/frame.ts`

**Files:**
- Create: `src/lab/frame.ts`
- Test: `src/lab/frame.test.ts`

**Interfaces:**
- Consumes: `buildRenderList`, `RenderItem` (`src/iso/render-list.ts`); `accentItem` or `project` (`src/iso/accent.ts`, `src/iso/project.ts`); `boxFrame`, `FRAME_H`, `HALO_FALLBACK`, `Box` (`src/world/frame.ts`); `BEAM_PERIOD_MS` (`src/scenes/sea-anim.ts`); `Animator` (`src/scenes/animator.ts`); `WorldScene` (`src/scenes/world.ts`).
- Produces: `export function contentFrame(scene, animators, opts): RenderItem[]` (decision 1) and `export const FRAME_SAMPLES = 16`.

- [ ] **Step 1: Write the failing tests** in `src/lab/frame.test.ts`. A helper `rect(items)` returns `{ minX, minY, maxX, maxY }` of all points; `covers(items, pts)` asserts every screen point is within `rect(items)` ± 1e-9. Toy scene: empty terrain (`ground`, `bleed`, `water` `[]`, `foam` a `ground` solid with no triangles), empty `ground`/`accents`.
  - `"covers the shadow of a tall solid"`: one prism 2×2×10 at the origin; `covers(contentFrame(s, []), shadow items of buildRenderList([prism]))`.
  - `"clips that shadow with clip"`: same prism, `clip = { x0: -1, y0: -1, x1: 3, y1: 3 }`, no box: covers the clipped shadow items of `buildRenderList([prism], undefined, clip)`, and `rect(...).maxX` is below the max x of the unclipped shadow.
  - `"covers the 4.5·r halo disc of a dot"`: accent `dot` at `v3(10, 10, 5)`, `r` 1: covers `project(at)` ± 4.5 on x and on y.
  - `"covers the points of a poly"`: a 3-point poly accent: covers its projected points.
  - `"covers boxFrame(box, h), FRAME_H by default"`: covers `boxFrame(box, 7)` with `h: 7`, and `boxFrame(box)` without `h`.
  - `"covers the 16 positions of a moving accent and ticks 16 × BEAM_PERIOD_MS / 16"`: toy animator, one `accent` layer whose dot moves +10 in x per tick (on odd samples the layer is empty: Review Focus 3); records `dt`s. Expect `dts` to equal 16 × `BEAM_PERIOD_MS / 16`, and the frame to cover every even-sample position.
  - `"without animators it is the static content plus the box"`: result equals the concatenation for a scene with one prism and a box (just assert `covers` of both and that `contentFrame` with `[]` does not throw).
  - `"real world: faro covers the beam wedge over a whole turn"`: a fresh `assembleWorld(undefined, { reducedMotion: false })`, `e = EXHIBITS.find(id === "faro")`, `contentFrame(cropScene(scene, e.box), cropAnimators(animators, e.box), { box: e.box, h: e.h, clip: e.box })`; for `k = 0..7`, `a = k·π/4`, `o = scene.sea!.lantern`: covers `project` of `o`, `o + BEAM_LEN·(cos(a ∓ BEAM_HALF), sin(a ∓ BEAM_HALF), 0)`.
- [ ] **Step 2: Run** `npx vitest run src/lab/frame.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `contentFrame` per decisions 1–3: (a) static list; (b) static accents → for a `dot` four one-point items at `(x ± R, y)` and `(x, y ± R)` with `R = r × max k of HALO_FALLBACK` (or one item holding the four points), `poly` its projected points; (c) the 16 samples (`solid` → `buildRenderList(l.solids, l.heading, clip)`, `accent` → (b), `water` → `buildRenderList(l.water)`); (d) `boxFrame(box, h ?? FRAME_H)` when `box`. Items' `layer`/`color` can be `"ground"`/`0`, as `boxFrame` does. JSDoc: one line naming the four parts and that it ticks the animators 8 s.
- [ ] **Step 4: Run** `npx vitest run src/lab/frame.test.ts` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `feat(#400): contentFrame, the projected bounds of what an exhibit draws`.

### Task 2: storybook framing by content and `__lab.tick`

**Files:**
- Modify: `src/lab/storybook.ts` (header comment, `LabHook`, `fit`, `show`, `window.__lab`)
- Test: `src/lab/storybook.test.ts`

**Interfaces:**
- Consumes: `contentFrame` (Task 1); `solidsBox` (`src/lab/crop.ts`).
- Produces: `LabHook.tick(dtMs: number): void`.

- [ ] **Step 1: Write the failing tests** in `src/lab/storybook.test.ts`:
  - In `"LabHook has every member the legibility script reads"` add `"tick"` to the list.
  - New `describe("content framing and tick (#400)")`:
    - `"fits contentFrame, not the box rhombus"`: `src` contains `fitTransform(content` (or a regex `/fitTransform\(\s*content\b/`) and does not match `/fitTransform\(\s*boxFrame\(/`.
    - `"contentFrame is computed once per show, before buildStage"`: with comments stripped (`src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")`), `match(/contentFrame\(/g)` has length 1 (the import has no parenthesis); inside the body of `const show = ` (slice to `const fromHash`), `indexOf("contentFrame(")` < `indexOf("buildStage(")`.
    - `"tick redraws the stage and renders"`: `src` matches `/tick\(dtMs\)\s*\{\s*stage\?\.tick\(dtMs\);\s*app\.render\(\);\s*\}/`.
    - `"the header documents tick and the 8 s clock advance"`: header (as in the #377 test) contains `tick` and `8 s`.
- [ ] **Step 2: Run** `npx vitest run src/lab/storybook.test.ts` → the new ones FAIL.
- [ ] **Step 3: Implement.** Replace `frame` with `let content: RenderItem[] | null`. In `show`, each branch sets `src` and `opts` (`{ box: e.box, h: e.h, clip: e.box }` for region/context; decision 6 for pieces); then `content = contentFrame(src[0], src[1], opts)`; then `stage = buildStage(...src, opts.clip ? { clip: opts.clip } : {})` (keep the comment about the crop memo). `fit()` uses `fitTransform(content, w, h)`. Add `tick(dtMs) { stage?.tick(dtMs); app.render(); }` to `window.__lab` and to `LabHook`. Header: add `tick(dtMs)` to the `window.__lab` list (for time-lapse checks in headless) and a sentence: the frame takes the projected bounds of what is drawn, sampling the animation 16 times over 8 s, which moves the shared clock 8 s on each exhibit change. Drop the `boxFrame` import if unused.
- [ ] **Step 4: Run** `npx vitest run src/lab` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `feat(#400): storybook frames by content; __lab.tick for time-lapse`.

### Task 3: responsive layout and README

**Files:**
- Modify: `lab/storybook.html` (`<style>` only), `README.md` (storybook paragraph)
- Test: `src/lab/storybook.test.ts`, `src/lab/docs.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - `storybook.test.ts`, `describe("responsive layout (#400)")`: the HTML (whitespace collapsed with `.replace(/\s+/g, " ")`) contains `@media (max-width: 60rem) { body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; } #exhibits { max-height: 22vh; } #readout { max-height: 22vh; } #lab-host { height: auto; min-height: 0; } }`; it still has `grid-template-columns: 14rem 1fr 16rem` and `overflow: hidden` on `html, body`; the body element order is still `exhibits`, `lab-host`, `readout`.
  - `docs.test.ts`, inside `describe("storybook documentation (#97)")`: the storybook paragraph contains `projected bounds` and `responsive`.
- [ ] **Step 2: Run** `npx vitest run src/lab/storybook.test.ts src/lab/docs.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Add the media query after the `#readout dd` rule. README, after the crop sentence: "The frame takes the projected bounds of what is drawn (faces, ground, the clipped shadows, the halos and 16 samples of the animation over 8 s), plus the box rhombus up to its `h`. The layout is responsive: under 60rem the index goes above the canvas and the readout below it, and the canvas takes the full width."
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(#400): responsive storybook layout; README on content framing`.

### Task 4 (controller): browser checks and after captures

Not a subagent task (decision 8). After Tasks 1–3, with `npm run dev -- --host --port 5173`, run `.scratch/evals-400.md`: for viewports `412 915 2` and `1600 900 1`, each of the 11 ids (`playa-camiones`, `gradas`, `estacion`, `patio-contenedores`, `grua-muelle`, `cartel-taller-escena`, `silos`, `playa-contenedores`, `autitos-chocadores`, `faro`, `pecio`) with `?bloom=off&speed=0`, the four 2 px edge strips of the host are all `[16, 14, 25, 255]`; `faro` repeated after each of 8 `__lab.tick(1000)`. `hostSize()` at 412: `w ≥ 400`, `h ≥ 0.45 × 915`. `__lab.setCoverScale(1.17)` → `fit().scale === 1.17`. Captures at device scale 1 into `docs/superpowers/specs/assets/2026-11-16-storybook-luces/after-encuadre/{phone,desktop}-NN.png` (NN 01..11, the spec's table order, which is the id order above). Commit `docs(#400): after captures of the content framing`. The eval output goes in the PR.

## Grilling

- Rounds: 1 (the revision added a criteria map, assumptions and one test tweak; no step added or removed, so no second round). Griller model: fable.
- Questions: 18. Sources: ISSUE 4 (Q2, Q3, Q4, Q16), CODE 13 (Q1 `stage.ts:104-133`; Q5 `sea-anim.ts:129,156`; Q6 `crop.ts:186`; Q7 `frame.ts:46-55`; Q8 `frame.ts:69-72`; Q10 `storybook.ts`; Q11 `storybook.ts:58`; Q12 `render-list.ts:31-48`; Q13 `accent.ts:14-20`; Q14 `exhibits.test.ts:36-75`; Q15 `page.ts:26-30`, `stage.ts:182-190`; Q17 git history; Q18 `docs.test.ts:39-53`), NO SOURCE 1 (Q9, a technical assumption).
- Assumptions: 1–7 above.
- Issues opened: none. Spec ambiguities: none.
