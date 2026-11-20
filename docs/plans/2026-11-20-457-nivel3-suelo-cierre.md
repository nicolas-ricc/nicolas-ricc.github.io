# Writing: level 3 for ground signs, final REPORT and captures, spec, ADR 0005 and docs closing (#457) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run legibility` measures a dark-ink ground sign correctly (symmetric halo, counters through the plane, OCR that does not see the raft's edge) at rest and at two instants of the pitch-and-roll cycle (`--tick`). The three reports are versioned, the captures are regenerated at cap 17.25, and story #451 closes in a spec, ADR 0005, `CONTEXT.md`, `README.md` and the docs tests.

**Architecture:** The pure part of level 3 lives in `scripts/legibility-measure.ts`, and `scripts/legibility.ts` drives the browser. The Writing context exhibits draw the raft as static solids (`contextScene`, `src/lab/crop.ts`), so a tick of the stage clock cannot pose it. Instead the exhibit reads `?tick=<ms>` and builds the raft at `poseAt(ms)`, and the script measures the oracle's `signAt(site, poseAt(ms))` against those pixels. Docs are Spanish prose pinned by `src/lab/docs.test.ts` against live values.

**Tech Stack:** TypeScript, Vitest (node), tsx, agent-browser 0.27 + tesseract.js (level 3, not in CI), PixiJS DevTools for the captures.

**Spec:** issue #457, as amended by the owner's comment (2026-11-20) and by #460, which was merged with the owner's approval. The story's context is #451 (body §3, the plan comment's D1–D8, and the 2026-11-20 size-decision comment).

## Global Constraints

- `WRITING_CAP` stays **17.25** and `SIGN_RULES.ground` stays as #460 left it (10.5 / 1.6 / 2 / 7:1 at 1.17, and 7.5 / 1.2 / 1.5 / 7:1 at 0.83). The issue's cap sweep 20→22 ("nunca por debajo de 20") is superseded by the owner's decision (#451 comment and #460).
- The closing condition, from the owner's comment: OCR `WRITING` at both sites, at 1.17 and 0.83, without lowering the ground floors. If the crop diagnosis is false and the OCR still fails, label #457 `ready-for-human`.
- Halo: `halo = min(core, holes) / max(core, holes)`. `LEVEL3.halo` stays 0.5, `LEVEL3.contrast` is unchanged, and the binarization of `ocrImage` is unchanged.
- `--tick <ms>`: files `<id>-<escala>-t<ms>.png` and `-ocr`, and the report goes to `REPORT-t<ms>.md` with a `Tick: <ms> ms` line under `Viewport`. Without `--tick`, everything is as today (`REPORT.md`, untagged files). A `--tick` with no number, or a negative one, throws.
- Three runs: `npm run legibility`, `-- --tick 7919` and `-- --tick 15838`. Each exits 0, and the four Writing rows of each have contrast ≥ 7:1, halo ✓ and OCR `WRITING` (`writing` admitted at 0.83). RESUME and PORTFOLIO stay ✓.
- `REPORT*.md` is only ever written by the script. Spec prose is in Spanish. The ADR and `CONTEXT.md`/`README.md` are in English, as they already are (ADR format of 0001–0004: Status, Context, Decision, Consequences, Sources). Code, comments and test names are in English (`src/english.test.ts`).
- Numbers in the docs take the form the tests build (`toFixed(2)`, comma decimal for the `writingSite` threshold).
- Captures: 1600×900 @2 (3200×1800), bloom on, with the method of `docs/plans/2026-11-20-445-nivel3-cierre.md` Task 3.

## Review Focus

- A wall sign's counter hole must stay the disc it was: the plane polygon of a `diagonalWall` counter must match the old `r·Z_SCALE·fit.scale·RES` disc within 1 px in width and height (Task 1 test).
- A non-ground sign's OCR input must not change: `ocrImage` without `keep` must be byte-identical to today's output (Task 1 test).
- `--tick 0` is a valid instant, not "no tick": `pickTick(["--tick", "0"])` is 0 and its files are tagged `-t0` (Task 2 test).
- Malformed `?tick=` in the storybook URL (negative, text, empty) means rest, never a crash or NaN pose: `tickFromSearch` returns 0 (Task 3 test).
- A non-Writing context exhibit ignores the tick: `contextSign(e, t)` is `e.sign`, and `contextScene(scene, e, t)` equals `contextScene(scene, e)` (Task 3 test).

---

### Task 1: Level-3 measures for dark ink on a ground plane

**Files:**
- Modify: `scripts/legibility-measure.ts` (`Measures` JSDoc, `measure`, `Masks`, `signMasks`, `ocrImage`, `PREPROCESS`; drop `fillDisc` once unused)
- Modify: `scripts/legibility.ts` (pass `masks.backed` to `ocrImage` when `sign.ground`)
- Test: `scripts/legibility.test.ts`

**Interfaces:**
- Produces: `Masks = { w, h, core, ring, holes, backed }`. `backed` is the union of each glyph's ink box grown by `SIGN_RULES.backingW · sign.width` in its own plane, i.e. today's local `inner`; the ring keeps its definition. `ocrImage(px, w, h, core, ring, keep?: Uint8Array)` returns the same shape as before.

- [ ] **Step 1: Write the failing tests** (`scripts/legibility.test.ts`)
  - `"measure: symmetric halo; dark ink (core 0.4, holes 0.02) gives 0.05"`: core pixels gray `0xaaaaaa`, holes `0x272727` (luminances ≈ 0.402 and ≈ 0.0203). Assert `halo` equals `min/max` of those luminances (`toBeCloseTo`, 6), and that it is ≈ 0.05 within 0.002.
  - `"measure: light ink (core 0.8, holes 0.1) gives 0.125, as before"`: grays `0xe7e7e7` and `0x595959` give `holes / core` ≈ 0.125. Adjust the existing `"halo of holes over core"` test name to "symmetric halo".
  - `"signMasks: a groundDiagonal counter is an ellipse 2·r·√2·s·RES wide and 2·r·√½·s·RES high (±1 px)"`: one glyph on `groundDiagonal(at)`, with an empty `quads` list and one counter (`r` 2, `at` the glyph centre). The fit has `scale` s = 2. Measure the bounding box of `holes`.
  - `"signMasks: a diagonalWall counter is still the r·Z_SCALE·s·RES disc (±1 px)"`: the same glyph on `diagonalWall`; width and height both ≈ 2·r·Z_SCALE·s·RES.
  - `"signMasks: backed is the ink box grown by backingW·width, and the ring lies outside it"`: on `BLOG_SIGN`, every `ring` pixel has `backed` 0, and the glyph-box centre has `backed` 1.
  - `"ocrImage: without keep the output is unchanged; with keep, pixels outside it are white"`: a 2×1 image whose two pixels are both at the core luminance. With `keep = [1, 0]` the ×3 block of pixel 0 is black (0) and that of pixel 1 is white (255). Without `keep`, both are black.
  - `"PREPROCESS: a ground sign's OCR sees only its backed area"`: `PREPROCESS` contains `"cartel de suelo"` and `"margen de respaldo"`.
- [ ] **Step 2: Run** `npx vitest run scripts/legibility.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement**
  - `measure`: `halo: Math.min(core, holes) / Math.max(core, holes)`. NaN in, NaN out. JSDoc: "halo = the darker over the lighter of holes and core: with light ink it is holes/core; with dark ink it measures how much the holes darken".
  - `signMasks`: each counter `i` of glyph `g` becomes 16 points `at + r·(cos θk, sin θk)` in text space, with `at = g.layout.counters[i].at` and `r = g.counters[i].r`. They go to the world with `toWorld(g.plane, …)` and to the image with `toImage`, then `fillPolygon(holes, …)`. Rename `inner` to `backed` (grown by `SIGN_RULES.backingW`) and return it.
  - `ocrImage`: when `keep` is given and `keep[source pixel]` is 0, write 255.
  - `PREPROCESS`: append «En un cartel de suelo (`ground`) el OCR solo ve lo que el oráculo garantiza respaldado: los píxeles fuera de la caja de tinta de cada letra más el margen de respaldo (`backingW` · ancho, en su plano) quedan blancos, así el borde de la balsa no entra como un marco.»
  - `legibility.ts`: `ocrImage(px, w, h, m.core, m.ring, sign.ground ? masks.backed : undefined)`.
- [ ] **Step 4: Run** `npx vitest run scripts && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#457): level 3 measures dark ink on a ground plane`

### Task 2: `--tick`: argument, file tags and the report line

**Files:**
- Modify: `scripts/legibility-measure.ts` (`pickTick`, `tickTag`, `reportName`, `renderReport`)
- Test: `scripts/legibility.test.ts`

**Interfaces:**
- Produces: `pickTick(argv: readonly string[]): number | null`. `tickTag(tick: number | null): string` returns `""` or `"-t<ms>"`. `reportName(tick: number | null): string` returns `"REPORT.md"` or `"REPORT-t<ms>.md"`. `renderReport(r: { …; tick?: number | null })`.

- [ ] **Step 1: Write the failing tests**
  - `"pickTick: the number after --tick, null without it; no number or a negative one throws"`: `["--tick", "7919"]` gives 7919, `["--tick", "0"]` gives 0, `[]` and `["--only", "x"]` give null. `["--tick"]`, `["--tick", "-1"]`, `["--tick", "abc"]` and `["--tick", "--only"]` throw `/--tick/`.
  - `"tickTag and reportName"`: `tickTag(null)` is `""` and `tickTag(7919)` is `"-t7919"`. `reportName(null)` is `"REPORT.md"` and `reportName(15838)` is `"REPORT-t15838.md"`.
  - `"renderReport with tick writes Tick: 7919 ms under Viewport; without it, no Tick line"`: the line after `Viewport: …` (blank line apart) is `Tick: 7919 ms`.
- [ ] **Step 2: Run** `npx vitest run scripts/legibility.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `pickTick` follows `pickContexts`'s style. The error messages start with `legibility:`.
- [ ] **Step 4: Run** `npx vitest run scripts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(#457): --tick argument, file tags and report line`

### Task 3: Pose the Writing context exhibit at a tick and drive the script with it

**Files:**
- Modify: `src/lab/page.ts` (`tickFromSearch`), `src/lab/crop.ts` (`contextScene` gains `tMs`, new `contextSign`), `src/lab/storybook.ts` (passes `tickFromSearch(location.search)`), `scripts/legibility.ts` (wiring)
- Test: `src/lab/page.test.ts` (or wherever `speedFromSearch` is tested), `src/lab/crop.test.ts`

**Interfaces:**
- Consumes: `poseAt`, `signAt`, `seaPlatformAt` (`src/scenes/sign-platform.ts`); Task 2's `pickTick`, `tickTag` and `reportName`.
- Produces: `tickFromSearch(search: string): number`, where a missing or invalid (negative, non-numeric, empty) value gives 0. `contextScene(scene, e, tMs = 0): WorldScene`. `contextSign(e: ContextExhibit, tMs = 0): SignSpec`.

- [ ] **Step 1: Write the failing tests**
  - `"tickFromSearch: ?tick=<ms>, rest (0) when missing or invalid"`: `"?tick=7919"` gives 7919. `""`, `"?tick="`, `"?tick=-5"` and `"?tick=abc"` give 0.
  - `"contextScene at a tick poses the Writing raft at poseAt(tMs)"`: for the `plataforma-escena` exhibit, `contextScene(scene, e, 15838).solids` equals `[...cropScene(scene, e.box).solids, ...cropSolids(posed, e.box)]`, with `posed` from `seaPlatformAt(out, "wide", poseAt(15838))`. With `tMs` 0 the result equals `contextScene(scene, e)`.
  - `"contextSign: the posed oracle sign of a Writing exhibit; e.sign otherwise"`: `contextSign(wide, 15838).glyphs[0].quads` deep-equals `signAt("wide", poseAt(15838)).glyphs[0].quads` and differs from `BLOG_SIGNS.wide`'s. `contextSign(wide, 0)` deep-equals `BLOG_SIGNS.wide`. For `cartel-torre-escena`, `contextSign(e, 15838)` is `e.sign` (`toBe`) and `contextScene(scene, e, 15838)` equals `contextScene(scene, e)`.
- [ ] **Step 2: Run** `npx vitest run src/lab/crop.test.ts src/lab/page.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**
  - `crop.ts`: memoize the raft per `${site}@${tMs}`. Update the JSDoc of `contextScene` and `contextAnimators`: the raft is static at `poseAt(tMs)` (rest by default), and the animator stays dropped.
  - `storybook.ts`: `contextScene(scene, e, tickFromSearch(location.search))`. Its header JSDoc names `?tick=`.
  - `legibility.ts`:
    - `const tick = pickTick(argv)`. The URL adds `&tick=${tick}` when `tick !== null`.
    - Per exhibit, `sign = contextSign(e, tick ?? 0)` feeds `wordCrop`, `signMasks`, `ocrImage`'s ground check, `verdicts` and `checkSign(sign, scale, contextScene(scene, e, tick ?? 0).solids)`.
    - Files are `${id}-${scaleTag(scale)}${tickTag(tick)}.png` and `-ocr`. The report goes to `reportName(tick)` with `tick`.
    - The header JSDoc gets the usage `[-- --tick <ms>]` and says the Writing raft is posed by the exhibit's `?tick=`.
- [ ] **Step 4: Run** `npx vitest run src/lab scripts && npm run typecheck`. Expected: PASS. Then run `npm run legibility -- --only plataforma-escena --tick 15838` once. Its crop must show the tilted raft, and its rows must pass. Then `git checkout -- docs/superpowers/specs/assets/carteles-legibilidad/` and delete the untracked `-t15838` files: Task 4 writes the real ones.
- [ ] **Step 5: Commit** `feat(#457): pose the Writing context exhibit at a tick; npm run legibility --tick`

### Task 4 (controller): the three level-3 runs

- [ ] `npm run legibility`, `npm run legibility -- --tick 7919` and `npm run legibility -- --tick 15838`, in the foreground with a 10 min timeout each. Each exits 0. Check every Writing row: contrast ≥ 7, halo ✓, OCR `WRITING` (or `writing` at 0.83). If an OCR fails, stop. The floors are not touched; label `ready-for-human` per the owner's comment.
- [ ] Commit `REPORT.md`, `REPORT-t7919.md`, `REPORT-t15838.md` and the 48 crops: `docs(#457): level-3 reports at rest and at t 7919 and 15838`.

### Task 5 (controller): captures at cap 17.25

- [ ] Regenerate the five captures with the #445 Task 3 method (storybook `?bloom=on&speed=0#<id>`, `__lab.setCoverScale`; site `/`):
  - `assets/374-carteles/plataforma-escena-117.png`, `-083.png` and `plataforma-real.png`
  - `assets/423-composicion-responsive/plataforma-escena-angosta-117.png` and `sitio-1600x900-ancho.png`
- [ ] Regenerate the four close captures of `assets/451-balsa-tablones/` with the method its README gives, and the six of `balanceo/` with the method its README gives. They were taken at cap 20 before #460. Re-measure the README's pixel verification (mean absolute RGB difference against `balanceo-1` over the raft's screen box) and update the numbers and the cap. Every PNG is 3200×1800.
- [ ] Commit `docs(#457): captures at cap 17.25`.

### Task 6: Spec, ADR 0005, story specs, glossary, README and the docs tests

**Files:**
- Create: `docs/superpowers/specs/2026-11-20-writing-balsa-tablones-design.md` (Spanish), `docs/adr/0005-ground-signs-have-their-own-floors.md` (English)
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` §8.1–§8.4, `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md` §8.3, `CONTEXT.md`, `README.md`
- Test: `src/lab/docs.test.ts`, plus `src/english.test.ts` only if a word list needs it

**Interfaces:** Consumes the three reports (Task 4), the captures (Task 5) and the live values (`WRITING_CAP`, `CHAINSAW_BAR`, `PITCH`, `ROLL`, `RAFT`, `ISO_TONES`, `writingSite`, `SIGN_RULES.ground`, `GROUND_ASPECT`, `LANE_OUT`).

- [ ] **Step 1: Write the failing tests** in `src/lab/docs.test.ts`, as a new `describe("WRITING on a plank raft (#451)")`. It reuses the `cell`/`threshold`/`png` helpers by lifting them to module scope, or by duplicating them minimally.
  - `"the three reports: the four Writing rows at ≥ 7:1, halo ✓ and OCR WRITING"`. This covers `REPORT.md`, `REPORT-t7919.md` and `REPORT-t15838.md`. The tick reports contain `Tick: 7919 ms` and `Tick: 15838 ms` respectively.
  - `"§8.2 #451 entry carries the live values and the readings of the three reports"`. The entry contains:
    - `` `WRITING_CAP` ${WRITING_CAP} `` and `` `CHAINSAW_BAR` ${CHAINSAW_BAR} ``
    - `PITCH.periodMs` and `ROLL.periodMs` (as `9100 ms` and `7300 ms`), and `RAFT.plankW`
    - `threshold()`
    - the hex of `ISO_TONES.timber.top` and of `ISO_TONES.navy.top`
    - every contrast, halo and OCR cell of the Writing rows of the three reports, plus `t 7919` and `t 15838`
  - `"the new spec exists and names the ground class, the materials, the motion, the lane, ADR 0005 and every capture of 451-balsa-tablones"`. The spec names `groundDiagonal`, `GROUND_ASPECT`, `CHAINSAW_BAR`, `timber`, `navy`, `PITCH`, `ROLL`, `LANE_OUT`, `SIGN_RULES.ground`, `0005-ground-signs-have-their-own-floors.md`, every `.png` under `assets/451-balsa-tablones/` (recursive, by relative path) and the `docs/plans/` of #452–#456 and #460.
  - `"ADR 0005 is Accepted and names SIGN_RULES and GROUND_ASPECT"`.
  - `"the five regenerated captures are 3200×1800"`, moved from the #441 block.
  - `"CONTEXT.md has ### Raft and ### Decal; Sign names raftAt, poseAt and --tick"`. Raft also names `PLATFORM_DECK` and `RAFT`. Decal names "bloom". Legibility names "halo" and `--tick`.
  - `"README lists the new spec and --tick"`.
  - Move the #441 block's live-value cases (REPORT readings, captures, `CONTEXT` Sign, the 2026-11-18 §8.3 sentence, the time-lapse README) into the #451 block, or retarget them. What stays in `#441` is the entry's existence and history, and the existence of the `441-tabla-flotante` captures.
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts`. Expected: the new cases FAIL.
- [ ] **Step 3: Write the docs**
  - **New spec.** Context: why the #441 board did not read as an object. Then the decisions:
    - the ground class (`groundDiagonal`, v projects at 0.707 and u at 1.414, `GROUND_ASPECT` 0.5, `CHAINSAW_BAR` 0.15 and its measurement)
    - the size: cap 20 under the vertical floors (option (a), the plan's figure), then the owner's mix, cap 17.25 with `SIGN_RULES.ground` (#460)
    - the decal in the solids pass and the decal/receiver contrast
    - `mesh` and the painter's order
    - the raft and its `RAFT` constants
    - `timber`/`navy` and 7:1 against the palette ceiling (L 0.388 / 0.0044, 8.05:1 in the plan; `staticContrast` 8.04:1 live)
    - the rigid pose `PITCH`/`ROLL`/`ANGLE_STEP` and the one-pose memo
    - `LANE_OUT` shifted 15 u, and `zoneFrame` tall 450
    - level 3 for ground signs: symmetric halo, counters through the plane, OCR inside the backed area, `--tick` with the exhibit's `?tick=`
    - what was left out: per-plank height variation, and why

    After the decisions: the level-2 tables (rest and worst pose, 1.17 and 0.83), the level-3 tables (three runs), the captures with their `assets/...` paths, and links to the children's `docs/plans/`.
  - **ADR 0005** (English, the 0001–0004 format). Decision: the oracle gains a ground-sign class (expected aspect `GROUND_ASPECT` 0.5, the x-height measured along v, `bar` along v, a coplanar decal measured against its receiver) and ground floors of its own (`SIGN_RULES.ground`). Considered and rejected: option (a), keeping the vertical floors with cap 20. Consequences: cap 17.25, the word ≈ 72.6 u, the lane shift, `zoneFrame` tall 450, level 3 as the safety net. Sources.
  - **Spec 2026-11-15:**
    - §8.1: the `plataforma-escena` rows with the new REPORT values, and the note "desde #457, nivel 3 de la balsa".
    - §8.2 #451 entry: the readings of the three runs, `PITCH`/`ROLL`, the crop diagnosis confirmed (the edge was the frame, and with the backed-area OCR it reads `WRITING`), the captures, and "no cap sweep: cap 17.25 by the owner's decision".
    - §8.3: the WRITING row (already live).
    - §8.4: the regenerated captures, the `-t7919`/`-t15838` crops and the `451-balsa-tablones` folder. Drop the note that #457 regenerates them.
  - **Spec 2026-11-18 §8.3:** the `plataforma-escena*` rows from `REPORT.md`, and «desde #451 el cartel es la balsa de tablones».
  - **`CONTEXT.md`:**
    - Sign: the final state, including that the context exhibits pose the raft by `?tick=` and level 3 with `--tick`.
    - Lettering: `groundDiagonal` as WRITING's plane.
    - Legibility: the ground class, and at level 3 the symmetric halo, the backed-area OCR and `--tick`.
    - New `### Raft` and `### Decal` entries, each with a `Code:` line.
  - **`README.md`:**
    - the `npm run legibility` bullet: `--tick <ms>` and `REPORT-t<ms>.md`
    - the signs paragraph: level 3 with `--tick`, no exceptions
    - the storybook paragraph: `?tick=`
    - the new spec in the specs list
- [ ] **Step 4: Run** `npx vitest run src/lab/docs.test.ts src/english.test.ts src/docs-glossary.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `docs(#457): spec, ADR 0005, story specs, glossary and README`

### Task 7 (controller): full gates

- [ ] `npm test` and `npm run typecheck`, both green.

## Technical decisions (declared; not in the issue)

1. **`--tick` poses the exhibit through the URL, not `__lab.tick`.** The issue asks `legibility.ts` to call `window.__lab.tick(ms)` once. That cannot move the raft. `contextAnimators` (`src/lab/crop.ts:171-173`) drops the platform animator of a Writing context exhibit, and `contextScene` (`:163-168`) adds the raft as static solids at rest. Also, the storybook's `contentFrame` (`src/lab/frame.ts:38-39`) already ticks every animator 8000 ms on load, so a stage tick would not start from 0 either. The exhibit reads `?tick=<ms>` and builds the raft at `poseAt(ms)`, the same pose the oracle checks with `signAt(site, poseAt(ms))`, so masks and pixels line up. The CLI contract (`--tick`, the `-t` tags, `REPORT-t<ms>.md`, the `Tick:` line) is the issue's.
2. **The OCR crop of a ground sign stays inside the backed area.** This answers the owner's comment ("recortar dentro de la lámina, o la regla equivalente"). The `wordCrop` rectangle is kept, so the PNG crops and the ring are unchanged. The OCR image whitens every pixel outside `backed`, the area that the level-2 `backing` rule (= 1) guarantees has the raft under it. The diagnosis was confirmed by a probe: the 0.83 OCR input shows the raft's edge as a black frame, and with the backed-area mask both sites read `WRITING` at both scales, at t 0, 7919 and 15838.
3. **ADR file name.** The issue names `0005-ground-signs-keep-the-floors.md` for option (a). Since #460 the decision is the owner's mix (own floors), so the ADR is `0005-ground-signs-have-their-own-floors.md` and records option (a) as rejected.
4. **The #451 close captures and the time-lapse are retaken.** They showed cap 20. The issue counted them as done because it was written before #460.

## Assumptions

(Filled by the plan review.)
