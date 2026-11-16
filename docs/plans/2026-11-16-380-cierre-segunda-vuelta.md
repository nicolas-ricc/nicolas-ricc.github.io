# Closing the zone signs second pass (#380) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close story #374 in the documents: final level-3 report, the new spec's §5/§6/§8, deviation notes in the old spec, the storybook spec rows, README, CONTEXT.md (Sign, Lettering, Legibility) and the credits index, each pinned by a docs test.

**Architecture:** Nothing is modelled. Every document change gets a test in the existing docs guards (`src/lab/docs.test.ts`, `src/docs-glossary.test.ts`, `src/english.test.ts`). The measured numbers in the new spec's §8 are pinned against the live oracle (`signMetrics`, `staticContrast`, `letterGaps`, `rhythm`, `counterClearance`, `measureText`) formatted with `toFixed(2)`, so the doc cannot drift from the code.

**Tech Stack:** vitest, TypeScript, Markdown; `npm run legibility` (tsx + agent-browser + tesseract.js).

**Spec:** issue #380 (its body is the spec for this task) and `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (story spec, §4–§6).

## Global Constraints

- Base branch `feature/374-carteles-legibles`; the PR targets it.
- **Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes.** No sign module changes unless task 1 finds a ✗ (it does not today: see Task 1).
- Code, comments, test names, README and CONTEXT.md in **English** (`src/english.test.ts`). Docs under `docs/` stay in Spanish.
- `ALLOW["src/lab/docs.test.ts"]` in `src/english.test.ts` grows **only** with the Spanish literals the new tests cite.
- Facts are copied as measured; no rounding beyond the 2 decimals `toFixed(2)` gives, no "fixing".
- `REPORT.md` is written only by `npm run legibility`, never by hand.
- README paragraphs stay single paragraphs (tests split README on blank lines).
- `npm test` and `npm run typecheck` green at the end of every task.

## Measured facts (from the branch at 9597f59, `SIGN_FONT` = size 10.3, width 1.35)

These are what the docs must say. Tests recompute them; the table is here so the writer does not have to.

Level 1 (air and counters in w = 1.35 u):

| Word | air min–max (w) | rhythm | tightest counter (w) | word width `measureText` (u) |
|---|---|---|---|---|
| Resume | 1.18–1.18 | 1.00 | `e` 1.40 | 44.14 |
| Portfolio | 1.18–1.68 | 1.43 | `P` 2.08 | 52.97 |
| Blog | 1.18–1.18 | 1.00 | `B` 2.24 | 22.07 |

Level 2 (`signMetrics`, `staticContrast`; backing 1 and occlusion 0 for all three):

| Exhibit | scale | x-height px | stroke px | air px | static contrast |
|---|---|---|---|---|---|
| `cartel-torre-escena` | 1.17 / 0.83 | 12.05 / 8.55 | 2.21 / 1.57 | 2.64 / 1.87 | 8.09 |
| `cartel-taller-escena` | 1.17 / 0.83 | 12.05 / 8.55 | 2.21 / 1.57 | 2.15 / 1.52 | 8.06 |
| `plataforma-escena` | 1.17 / 0.83 | 12.05 / 8.55 | 2.21 / 1.57 | 2.64 / 1.87 | 13.26 |

Portfolio: baseline 0.03°, verticals 3.03°, aspect error 0.075; the other two 0°, 0°, 0.010.

Level 3: copy the six tables of `REPORT.md` as regenerated in Task 1 (today: torre 11.75/11.09 contrast, 0.07/0.05 halo; taller 9.76/9.25, 0.07/0.06; plataforma 8.96/8.96, 0.12/0.07; OCR exact at both scales).

Sizes for the integration (word width on screen = projected x-extent of the glyph quads × 1.17; host = projected x-extent of its plan rectangle × 1.17):

| Sign | word (u) | word px @1.17 | host | host px @1.17 |
|---|---|---|---|---|
| Resume | 44.14 | 75.27 | `TOWER` 16 × 14 | 35.10 |
| Portfolio | 52.97 | 90.34 | south assembly hall 90 × 16 (`SHIPYARD_HALLS[1]`) | 124.02 |
| Blog | 22.07 | 38.75 | platform deck 14 × 12 (`HALF_X`, `HALF_Y`) | 30.42 |

Sites: `CROWN_SITE` = (129, 227, 30), `TINKER_SITE` = (60, −24, 13.5), `PLATFORM_SITE` = (400, 170).

## Review Focus

1. **Obsolete #364 assertions contradict the new state.** `describe("zone signs closing documentation (#364)")` pins the old storybook rows ("muro grafiteado", "cartel helipuerto (A y B)") and the README naming the deleted ids. Expected: those two `it`s are replaced by the #374 ones (Tasks 3, 4), not left failing and not weakened to pass both states. The rest of the #364 block (old §8, captures, its status) stays.
2. **Numbers in §8 drift from the code.** Expected: §8.1 numbers are asserted against the live oracle (Task 2), so a later glyph change fails the docs test.
3. **A deleted id resurfaces in README/CONTEXT/storybook rows** (`cartel-helipuerto`, `cartel-helipuerto-b`, `grafiti`). Expected: negative assertions in Tasks 3, 4, 5.
4. **`Code:` lines naming `scripts/…` go unchecked** because `codeRefs` only matches `src/` paths. Expected: `codeRefs` also reads `scripts/` paths (Task 5) with a unit assertion.
5. **The English guard flags new Spanish literals in `docs.test.ts`** or the allowlist grows too broad. Expected: ALLOW grows by targeted regexes only (each task that adds Spanish literals).

---

### Task 1: Final level-3 report

**Files:**
- Regenerate: `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` and its crops (by the script only)
- Test: `src/lab/docs.test.ts` (new `describe("zone signs redesign documentation (#374)")`, first `it`s)

**Interfaces:**
- Produces: the `describe("zone signs redesign documentation (#374)")` block with constants `SPECS = `${ROOT}docs/superpowers/specs/``, `CONTEXTS = ["cartel-torre-escena", "cartel-taller-escena", "plataforma-escena"]`, `png(path)` helper returning `[width, height]` after checking the PNG signature. Later tasks add `it`s to this block.

- [ ] **Step 1: Write the failing/guarding tests** in the new describe:
  - `"REPORT.md exists and has no failure mark"`: file `${SPECS}assets/carteles-legibilidad/REPORT.md` exists, does not contain `✗`, contains `## <id> a 1.17` and `## <id> a 0.83` for each of `CONTEXTS`, and contains `Sin violaciones.`
  - `"the six level-3 crops are PNGs"`: for each id and `117`, `083`: `carteles-legibilidad/<id>-<s>.png` has bytes 1..4 = `PNG`.
  - `"the six scene captures are 3200×1800"`: `assets/374-carteles/<id>-<s>.png` is `[3200, 1800]`.
- [ ] **Step 2:** `npx vitest run src/lab/docs.test.ts -t "#374"` — these pass already (the branch has the files); that is expected, they guard the deliverable.
- [ ] **Step 3:** `npm run legibility` (needs `npm ci` first if `tesseract.js` is missing). Expected: six `ok` lines, exit 0. If any row fails, fix that sign (or the font) until all pass with `npm test` green; today all six pass and the output is byte-identical except possibly the `Fecha:` line.
- [ ] **Step 4:** `git status` — commit `REPORT.md` and crops only if they changed: `git commit -m "docs(#380): final legibility report"`.

### Task 2: Story spec closes (`2026-11-15-carteles-de-zona-rediseno-design.md`)

**Files:**
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (status line, §5, §6, new §8)
- Test: `src/lab/docs.test.ts` (#374 block)
- Modify: `src/english.test.ts` (ALLOW, only if a new literal trips the guard)

**Interfaces:**
- Consumes: `signMetrics`, `staticContrast`, `COVER_LAPTOP`, `COVER_PHONE`, `SIGN_FONT` from `src/kit/legibility.ts`; `letterGaps`, `rhythm`, `counterClearance`, `measureText` from `src/kit/lettering.ts`; `EXHIBITS` (already imported).

- [ ] **Step 1: Failing tests** (`redesign` = the spec text; `dev` = text from `## 8. Desvíos y medición` to the end; `f = (n: number) => n.toFixed(2)`):
  - status line equals `**Estado:** implementado (storybook; integración pendiente, §7)`.
  - §6 (from `## 6. ` to `## 7. `) has no `- [ ]` and exactly 9 `- [x]`.
  - §5 (from `## 5. ` to `## 6. `) contains `CROWN_SITE`, `(129, 227, 30)`, `TINKER_SITE`, `(60, −24, 13.5)`, `PLATFORM_SITE`, `(400, 170)`.
  - `dev` exists after `## 7. ` and has headings `### 8.1 `, `### 8.2 `, `### 8.3 `, `### 8.4 `; contains `REPORT.md`, `SIGN_FONT`, the three `-escena` ids, `CROWN_SITE`, `TINKER_SITE`, `PLATFORM_SITE`.
  - **Row-wise pins** (a number must sit in its own row, not anywhere in §8). `row(prefix)` = the single line of `dev` that starts with `prefix`.
  - level 2 pinned live: §8.1 has one row per exhibit and scale, starting `` | `<id>` | 1.17 | `` / `` | `<id>` | 0.83 | ``. For each context exhibit `e` and scale `s`, `m = signMetrics(e.sign, s)`: that row contains `f(m.xHeightPx)`, `f(m.strokePx)`, `f(m.airPx)`, `f(staticContrast(e.sign))`.
  - level 3 pinned against `REPORT.md` parsed at test time: for each section `## <id> a <s>` of `REPORT.md`, the second cell of its `| contraste |` and `| halo |` rows (e.g. `9.76:1`, `0.07`) and the OCR word appear in the same §8.1 row `` | `<id>` | <s> | ``.
  - level 1 pinned live: a font table with rows starting `| Resume |`, `| Portfolio |`, `| Blog |`; with `width = SIGN_FONT.width` (1.35 u, the stroke), each row contains `f(Math.min(...letterGaps(w, size, width)) / width)`, `f(Math.max(...)/width)`, `f(rhythm(w, size, width))`, `f(Math.min(...counterClearance(w, size, width).map(c => c.clearance)) / width)`.
  - §8.3 pinned live: a sizes table with rows `| Resume |`, `| Portfolio |`, `| Blog |` (in the 8.3 slice) containing `f(measureText(w, size).width)` and the word's screen width `f(xExtent(sign quads) * 1.17)` and the host's `f(xExtent(rect) * 1.17)`, where `xExtent` = max − min of `project(p).x` (`src/iso/project.ts`) and the rects are `TOWER` (`src/scenes/city-grid.ts`), `SHIPYARD_HALLS[1]` (`src/scenes/sign-tinker.ts`) and ±`HALF_X`, ±`HALF_Y` (`src/scenes/sign-platform.ts`).
  - 8.4 names `assets/374-carteles/<id>-117.png` and `-083.png` for the three context ids, and `carteles-legibilidad/` crops `<id>-117.png`, `<id>-083.png`.
- [ ] **Step 2:** run the block; expect FAIL on status/§5/§6/§8.
- [ ] **Step 3: Edit the spec.** Status line as above. §5: append a bullet list "Sitios candidatos" with the three constants, their values, their module (`src/scenes/sign-crown.ts`, `sign-tinker.ts`, `sign-platform.ts`) and one line each on what the site is (center of the real tower's rooftop; ridge of the south assembly hall; open sea between the two buoys). §6: tick all nine. New `## 8. Desvíos y medición` with:
  - **8.1 Medición**: one table, one row per exhibit and scale (`` | `<id>` | 1.17 | … ``) — level 2 (alto de x, trazo, aire in px; static contrast; backing; occlusion; baseline/verticals/aspect) and level 3 (contraste, halo, OCR as in `REPORT.md`); then a font table, rows `| Resume |`, `| Portfolio |`, `| Blog |` (air min–max in w, rhythm, tightest counter in w), values from "Measured facts".
  - **8.2 Desvíos de la historia**, one bullet each: `SIGN_FONT` 10.3/1.35 with `GRID.gap` 2 and `KERN` (#375); Blog's `officeDark` backing panel inside the frame, frame longer than the deck and `POST_INSET` 6.5 (#376); the crown as a panel along (1, −1) with the helipad slab on top, panel bottom +3.2, slab r 7 (#378); the tinker's host is the south assembly hall ridge, site kept at `TINKER_SITE` with `DECK_RISE` 3.5 because of the factory gantry (#379); counters measured by probe points, not raster (#375); occlusion and backing by flat faces (`tessellate`) and ray depth, not AABB (#376); level-3 pixels via `extract.pixels` through `window.__lab` (#377); glyph changes: `m` arch tops 1 grid unit (#378) and the `i` dot squared to the stroke width (#379); marquee alpha 0.7 (#379); the real antenna light shows through the crown panel (#378, for the integration); follow-up #382 (`strokePx` and the `i` dot).
  - **8.3 Tamaño frente al host**: the sizes table from "Measured facts", rows `| Resume |`, `| Portfolio |`, `| Blog |`.
  - **8.4 Capturas**: list of `assets/374-carteles/*.png` (all twelve, 3200 × 1800) and `assets/carteles-legibilidad/*.png` (six crops plus six `-ocr`), with `REPORT.md` linked.
- [ ] **Step 4:** run the block; PASS. `npx vitest run src/english.test.ts` PASS (add ALLOW regexes only for literals this task's tests cite).
- [ ] **Step 5:** commit `docs(#380): close the story spec — §5 sites, §6, §8 deviations and measurement`.

### Task 3: Old sign spec notes and storybook spec rows

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` (§3.1, §3.2, §3.3 only; §8 untouched)
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (three rows of the §3 table)
- Test: `src/lab/docs.test.ts` (#374 block; replace the #364 `it("the storybook index names the signs in the shipyard, city and sea rows")`)
- Modify: `src/english.test.ts` (ALLOW)

- [ ] **Step 1: Failing tests:**
  - old spec: paragraphs split on `/\n\s*\n/` (as in the #238 test); the first paragraph after the `### 3.1 ` heading and after `### 3.2 ` starts with `*Desvío (2026-11-15):` and (whitespace collapsed) contains `2026-11-15-carteles-de-zona-rediseno-design.md`; the 3.1 note contains `cartel-torre`, the 3.2 note contains `cartel-taller`. The first paragraph after `### 3.3 ` starts with `*Desvío (2026-11-15):` and contains `respaldo`.
  - old spec §8 unchanged: the existing #364 assertions on §8 keep passing (no edit).
  - storybook spec: last cell of `| Portfolio: astillero |` contains `cartel-taller` and `cartel-taller-escena` and not `grafiteado`; `| Resume: ciudad |` contains `cartel-torre`, `cartel-torre-escena` and not `helipuerto`; `| Blog: mar |` contains `plataforma` and `plataforma-escena`.
  - delete the #364 `it` on the rows (it pins the deleted pieces).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Write the notes, Spanish, italic, one paragraph each, before the existing text of each section: 3.1 — helipuerto A/B reemplazado por la corona de la torre corporativa (`cartel-torre`, `cartel-torre-escena`) de la segunda vuelta; 3.2 — muro grafiteado reemplazado por el cartel del tinker (`cartel-taller`, `cartel-taller-escena`); 3.3 — Blog ganó el panel `officeDark` de respaldo dentro del marco (y su exhibit `plataforma-escena`). Each links `2026-11-15-carteles-de-zona-rediseno-design.md`. Rows: replace `muro grafiteado` with `cartel del taller (\`cartel-taller\`; en escena, \`cartel-taller-escena\`)`, `cartel helipuerto (A y B)` with `corona de la torre (\`cartel-torre\`; en escena, \`cartel-torre-escena\`)`, `plataforma con cartel` with `plataforma con cartel (\`plataforma\`; en escena, \`plataforma-escena\`)`.
- [ ] **Step 4:** PASS, including `src/english.test.ts`.
- [ ] **Step 5:** commit `docs(#380): deviation notes in the first-pass spec and new sign rows in the storybook spec`.

### Task 4: README

**Files:**
- Modify: `README.md` (storybook paragraph, lab paragraph's spec list and lettering sentence)
- Test: `src/lab/docs.test.ts` (#374 block; replace the #364 `it("README names the four sign exhibits and the c key in the storybook paragraph")`)

- [ ] **Step 1: Failing tests** (`storybook`, `lab` = README paragraphs as the existing tests find them, whitespace collapsed where matching phrases):
  - storybook paragraph contains `` `#<id>` `` for the six ids `cartel-torre`, `cartel-torre-escena`, `cartel-taller`, `cartel-taller-escena`, `plataforma`, `plataforma-escena`, each in `EXHIBITS`; contains `in its scene`, `candidate site`, `npm run legibility`, `contrast`, `halo`, `OCR`, `not in CI` (or `does not run in CI`: pick `does not run in CI`), and `` `c` ``; does not contain `cartel-helipuerto` nor `grafiti`.
  - lab paragraph (the one containing `/lab/world.html`, as the existing tests find it) contains `2026-11-15-carteles-de-zona-rediseno-design.md`, `src/kit/lettering.ts` and `src/kit/legibility.ts`. The storybook paragraph is the one containing `/lab/storybook.html`.
  - delete the #364 README-ids `it` and its `DELETED_BY_374` set.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Replace the "The zone signs of #352 are four pieces…" sentence with one naming the three pairs, saying the "in its scene" exhibits show each sign at its candidate site in the real world, that `c` judges them at the cover scales, and that `npm run legibility` measures contrast, halo and OCR with a browser and does not run in CI. Add the spec to the lab list (after `2026-11-11-…`). Extend the lettering sentence: "…lettered with, and `src/kit/legibility.ts` the legibility guardrails they are checked against."
- [ ] **Step 4:** PASS (`docs.test.ts`, `docs-glossary.test.ts`, `english.test.ts`).
- [ ] **Step 5:** commit `docs(#380): README names the three sign pairs and npm run legibility`.

### Task 5: CONTEXT.md — Sign, Lettering, Legibility

**Files:**
- Modify: `CONTEXT.md` (entries `### Sign`, `### Lettering`; new `### Legibility` after `### Sign`)
- Test: `src/docs-glossary.test.ts`

- [ ] **Step 1: Failing tests:**
  - `SIGN_TERMS = ["Sign", "Lettering", "Legibility"]` (the existing loop then checks Legibility's `Code:` files/identifiers).
  - `codeRefs` matches `` `(src|scripts)/…` `` paths; add to the unit test: `codeRefs("Code: \`scripts/a.ts\` (\`X\`).")` → `[{ file: "scripts/a.ts", idents: ["X"] }]`.
  - Lettering contains `gap 2`, `KERN`, `layoutText`, `letterGaps`, `rhythm`, `counterClearance`, `probe`.
  - Sign contains the six exhibit ids, `CROWN_SITE`, `TINKER_SITE`, `PLATFORM_SITE`, `src/lab/signs.test.ts`, `npm run legibility`, and still not `cartel-helipuerto` nor `grafiti`.
  - Legibility contains `level 1`, `level 2`, `level 3`, `SIGN_FONT`, `checkFont`, `SignSpec`, `checkSign`, `SIGN_RULES`, `npm run legibility`; its `Code:` line names `src/kit/legibility.ts` and `scripts/legibility.ts`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Rewrite Sign as the definitive entry (three signs, modules, piece and scene exhibits, candidate sites with values, the gate `src/lab/signs.test.ts`, `npm run legibility`). Lettering: grid with gap 2, `KERN`, `layoutText`, the measures `letterGaps`, `rhythm`, `counterClearance` with counters measured by probe points in each glyph (`GLYPHS[c].counters`); move the guardrail sentence to Legibility. New Legibility entry: three levels (font in vitest, projected sign in vitest, rendered pixels with a browser), `SIGN_FONT`, `FONT_RULES`, `checkFont`, `SignSpec`, `signSpec`, `checkSign`, `SIGN_RULES`, `COVER_LAPTOP`/`COVER_PHONE`, `npm run legibility` and `REPORT.md`. `Code:` `src/kit/legibility.ts` (`SIGN_FONT`, `FONT_RULES`, `checkFont`, `SignSpec`, `signSpec`, `checkSign`, `SIGN_RULES`, `COVER_LAPTOP`, `COVER_PHONE`), `scripts/legibility.ts` (`main`, `startVite`), `src/lab/signs.test.ts`.
- [ ] **Step 4:** PASS (`docs-glossary.test.ts`, `english.test.ts`).
- [ ] **Step 5:** commit `docs(#380): CONTEXT.md Sign, Lettering and a Legibility entry`.

### Task 6: Credits index

**Files:**
- Modify: `docs/superpowers/specs/assets/carteles-refs/CREDITS.md`
- Test: `src/lab/docs.test.ts` (#374 block)

- [ ] **Step 1: Failing test** `"the credits index lists helipuerto, corona, taller and plataforma"`: for each folder, the line containing `](<dir>/CREDITS.md)` contains `<n> fotos` with `n` = count of `.jpg` in the folder on disk, and matches `/CC BY-SA/`; the index has no `grafiti/` link.
- [ ] **Step 2:** FAIL (no corona/taller lines; grafiti line present).
- [ ] **Step 3:** Index lines: helipuerto 6 fotos (Resume #361; still the reference for the crown's helipad, #378), licencia más restrictiva CC BY-SA 3.0 y 4.0; corona 5 fotos (#378), CC BY-SA 3.0 y 4.0; taller 7 fotos (#379), CC BY-SA 2.0 y 4.0; plataforma unchanged. Drop the grafiti line; the intro names both passes (#352 and #374).
- [ ] **Step 4:** PASS (the #364 credits `it` for helipuerto and plataforma still passes).
- [ ] **Step 5:** commit `docs(#380): credits index with the corona and taller folders`.

## Assumptions

- Plan location: `docs/plans/` like the sibling plans #375–#379.
- `npm run legibility` is run in Task 1 on this branch, which already contains #378 and #379; all six rows pass today and the output is byte-identical to the committed one, so there may be nothing to commit.
- The storybook spec rows use the exhibits' ids in parentheses so the test can match them exactly; the table keeps its three columns.
- `scripts/legibility.ts` identifiers named in CONTEXT.md must exist in that file (`main`, `startVite`).
- If `npm run legibility` ever shows a ✗, the issue authorises fixing that sign or the font ("se corrige ese cartel o la fuente hasta que los tres pasen"); the live pins of Task 2 then fail until §8 is rewritten from the new measures. Rejected: hardcoding §8 numbers in the test.
- §8.2 deviation bullets are prose sourced from the sibling PR descriptions (#381, #383, #384, #385, #386) and the code constants (`POST_INSET`, `DECK_RISE`, …); only headings and identifiers are pinned. Rejected: pinning every prose number.
- The #364 `it`s on the storybook rows and the README ids are replaced by the #374 ones in the same commit that changes those documents; the other #364 `it`s (old status, §6, §8 tables and captures, helipuerto/plataforma credits, lab spec list) keep passing unchanged. Stage 3 commits all new tests failing on purpose (pipeline), so "green per commit" applies from the implementation commits on.
- Unicode: the spec writes the minus as U+2212 (`−24`), like the existing specs (`−18, 188`); tests use the same literal. Whitespace collapsing does not touch it.
- `tesseract.js` was missing from `node_modules` (installed from `main`); `npm ci` on this branch installs it. If the script cannot run, Task 1 stops and the run is blocked (the ✓ is a criterion).

## Grilling

- Rounds: 1 (griller model: fable). Questions: 18.
- Sources: ISSUE 5 (1, 7, 8, 13, 16 partly), CODE 11 (2, 3, 5, 6, 10, 11, 12, 13, 14, 15, 17), technical assumption 5 (1, 4, 9, 16, 18). No spec ambiguity, nothing out of scope.
- Plan changes: §8.1, font and §8.3 pins are row-wise (Q4); level 3 parsed from `REPORT.md` at test time (Q5, Q6); §8.3 pinned live (Q15); paragraph anchors made explicit (Q10, Q11); assumptions above.
- Issues opened: none.
