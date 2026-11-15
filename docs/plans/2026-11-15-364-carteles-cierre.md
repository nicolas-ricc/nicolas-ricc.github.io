# Signs: closing the story (#364) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close story #352 in the documents: the sign spec says implemented and gets `## 8. Desvíos y medición`, plus a credits index for the three photo folders, the sign exhibits in the storybook spec's §3 table, and a README sentence. Nothing is modelled.

**Architecture:** Docs only. Every acceptance criterion is pinned by a new `describe` block in `src/lab/docs.test.ts`, the file that already pins README and spec prose. The only other `src/` change widens the `src/lab/docs.test.ts` entry of `ALLOW` in `src/english.test.ts` so that the test can quote the Spanish table rows. The captures already exist; a test pins them.

**Tech Stack:** Markdown, Vitest (`npm test`), `tsc` (`npm run typecheck`).

**Spec:** issue #364 ("Qué hacer", "Reglas que hereda", "Criterios de aceptación"). Story: #352 and `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md`. The sources for §8 are the bodies of the child PRs #367 (#360), #370 (#361), #368 (#362) and #369 (#363) (`gh pr view <n> --repo nicolas-ricc/nicolas-ricc.github.io`).

## Global Constraints

- Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes. No code or geometry changes. In `src/`, only `src/lab/docs.test.ts` and `src/english.test.ts` (the `ALLOW` entry of docs.test) change.
- The docs under `docs/` may be in Spanish (the sign spec is). The README, and everything `src/english.test.ts` scans, is in English.
- The docs.test assertions that already pass stay untouched.
- Child PR facts are copied as measured. Do not round them again or "fix" them.

## Review Focus

- **Tables copied with wrong numbers.** §8 must carry the measured values: A cap height 3.490 and 4.08 px, B 10.0035 px, Portfolio 10.003 px, Blog 10.00 px, and the stroke widths 1.31–1.65 px. The Task 1 test pins the key numbers.
- **The 6.8 u forecast.** The plan in #352 forecast ≈ 6.8 u / ≈ 8 px for A. PR #370 measured 3.490 u / 4.08 px and showed that 6.8 does not fit the plan's own rule. §8 must say this and must not repeat 6.8 as the result. The test asserts `3.490`.
- **The index count drifts from the folder.** The photo count per folder has to match the `.jpg` files on disk. The test counts them with `readdirSync`.
- **Stale placeholder captures.** The four `<id>-real-base.png` files (780 × 437, from #360) still show the placeholders. They are not among the twenty. §8 names them as historical, so nobody reads them as the final signs.
- **The README sentence breaks old pins.** The storybook paragraph must stay a single paragraph that contains `/lab/storybook.html` (docs.test #97 and #328 split the README on blank lines). The new sentence goes inside it, with no blank line.

---

### Task 1: Sign spec — status, §8 deviations and measurement, §6 ticked

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` (line 4 `**Estado:**`, §6 checkboxes, new `## 8.` at the end)
- Test: `src/lab/docs.test.ts` (new `describe("zone signs closing documentation (#364)")`), `src/english.test.ts` (`ALLOW["src/lab/docs.test.ts"]`)

**Interfaces:**
- Produces: the heading `## 8. Desvíos y medición` and subsections `### 8.1 Medición de legibilidad`, `### 8.2 Desvíos de la historia`, `### 8.3 Desvíos de los hijos`, `### 8.4 Capturas`.

- [ ] **Step 1: Write the failing tests** in the new describe block (`spec` = the sign spec's text, `at = spec.search(/^## 8\. Desvíos y medición$/m)`, `dev = spec.slice(at)`):
  - `"the sign spec says implemented, pending integration"`: the `**Estado:**` line equals `**Estado:** implementado (storybook; integración pendiente, §7)`.
  - `"§6 is ticked off"`: the slice between `## 6.` and `## 7.` has no `- [ ]` and has 8 `- [x]`.
  - `"§8 carries the three legibility tables with the measured values"`: `at` > the index of `## 7.`; `dev` contains `### 8.1`; for each of `3.490`, `4.08`, `10.0035`, `10.003`, `10.00`, `8.55`, `30.54`, `37.86`, `15.879` → `toContain`; the rows `| **A** (pista) |`, `| **B** (tubo) |`, `| Portfolio |` and `| Blog |` match `^…` (multiline).
  - `"§8 lists the story deviations and each child's"`: `dev` contains `(−1.4, −1.4, 0)`, `fillText`, `6.8` (the forecast, quoted as not fitting; the result asserted is `3.490`), `CREDITS.md`, `1.27`, `1366×768`, and `#360`, `#361`, `#362`, `#363`, `#367`, `#368`, `#369`, `#370`.
  - `"§8 names the twenty captures and the stale placeholders"`: for each of the four ids and each of the five suffixes, `dev` contains `assets/352-carteles/<id>-<suffix>.png`; it also contains `real-base`.
  - In `src/english.test.ts`, widen the docs.test entry of `ALLOW` with **only** the literals the guard rejects: add `Resume: ciudad|Blog: mar` to the existing row regex, and add one regex for the new Spanish literals the test quotes (at least `plataforma con cartel` and `integración pendiente, §7`; run the guard to find the rest). Extend the comment above the entry if the new literals fall outside what it lists.

- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts src/english.test.ts`. Expected: the new #364 tests FAIL; `english.test.ts` PASSES.

- [ ] **Step 3: Edit the spec.**
  - `**Estado:**` line as above.
  - Tick all eight §6 boxes. All of them are delivered by #360–#363 (the lettering, plate `poly`, exhibits and `c` key from #360; the measurements and inventories from #361–#363; the glossary entries; the empty diff of `src/world/` etc. against `main`, which you verify with `git diff --stat $(git merge-base origin/main HEAD) HEAD -- src/world src/main.ts index.html src/style.css` (against the merge base: `main` moved on with #365/#366 after the story branched, so a plain `origin/main` diff shows their changes, not the story's)).
  - Append `## 8. Desvíos y medición`, in Spanish:
    - **8.1** The three tables, copied from the PRs. Helipad (A and B, the #370 table with its columns), Portfolio (the #368 row), Blog (the #369 table). Each one carries a verdict line: A ✗ (4.08 px < 10 at 1.17, the largest cap height that fits on the pad, 3.490 u; the "≈ 6.8 u" of the plan does not fit its own rule), B ✓, Portfolio ✓, Blog ✓. Add the criterion's arithmetic: `sizeForXHeight(10, 1.17)` ≈ 8.547 → 8.55 literal, because `xHeightPx(8.547…)` < 10 in floating point. Add what 0.83 shows: B, Portfolio and Blog are recognizable; A is a small green smudge. The A/B choice stays with the user (§3.1).
    - **8.2** The story deviations listed in the issue: the exact anamorphic factor `(−1.4, −1.4, 0)` instead of "· 2"; `fillText` fill derived from the stroke (quad per segment plus a square at each vertex), not an outline font; one `CREDITS.md` per photo folder plus the index; the `c` key fixes 1.17/0.83 as constants (`coverView` gives 1.27 at a whole 1366×768).
    - **8.3** Per child, the deviations each PR declared (one bullet each, with PR and issue numbers):
      - #367/#360: 14 glyphs, not 15; stroke width in text space; space advances; placeholders centred.
      - #370/#361: A at 3.490; B 8.55 literal; `interlock()` only on the steel; lower beam of B split in two; B posts from z 32.95; tensors shifted out; low floodlight h 1; `industrialLamp` bulb recoloured amber; notes for the A/B choice (SE floodlight over the "u", edge lights on A's baseline, white "H" on white).
      - #368/#362: interior stroke 1.0 u, not 0.5; floodlights h 1.2, not 5; interpenetration checked in the wall frame too; container placement; signature over the final "o"; faint beams at 0.12.
      - #369/#363: sign posts behind the frame; `g` descender below the frame; "discreet" from alpha 0.75; beacon partly behind the `g`.
      - The size note: every sign is large against its base (B 30.5 u on a 16 × 14 tower, wall 42.9 u, Blog frame 10.8 u over a 14 × 12 deck), as data for the integration (§4).
    - **8.4** The twenty captures (`assets/352-carteles/<id>-{real-bloom,real-nobloom,117-bloom,117-nobloom,083}.png`, 3200 × 1800) per id, plus the extra `plataforma-real-noaccents.png`, and the four `<id>-real-base.png` from #360 (780 × 437) as historical captures of the placeholders.

- [ ] **Step 4: Run** `npx vitest run src/lab/docs.test.ts src/english.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `docs(#364): sign spec implemented, §8 deviations and measurement`.

### Task 2: Credits index and capture check

**Files:**
- Create: `docs/superpowers/specs/assets/carteles-refs/CREDITS.md`
- Test: `src/lab/docs.test.ts` (same describe block)

- [ ] **Step 1: Write the failing tests:**
  - `"the credits index links each folder's CREDITS.md with its photo count"`: for each folder in `helipuerto`, `grafiti` and `plataforma`, find the line of the index that contains `](<folder>/CREDITS.md)`. It must contain `` `${n} fotos` ``, where `n` is the count of `.jpg` files in that folder (from `readdirSync`), and it must match `/CC BY-SA/`.
  - `"the twenty sign captures are 3200×1800 PNGs"`: for each id and suffix, read the PNG; check the `PNG` magic and that `[readUInt32BE(16), readUInt32BE(20)]` equals `[3200, 1800]`. This one passes already. That is expected: the issue only asks to verify the captures.
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts`. Expected: the index test FAILS; the capture test PASSES.
- [ ] **Step 3: Write the index** in Spanish: a title, one sentence, and one line per folder: `- [helipuerto](helipuerto/CREDITS.md): 6 fotos, licencia más restrictiva CC BY-SA 4.0 (cartel de Resume, #361)`. Do the same for grafiti (8, CC BY-SA, #362) and plataforma (7 plus one stock photo by URL only, CC BY-SA, #363). Read the licences from each folder's `CREDITS.md`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `docs(#364): credits index of the sign reference photos`.

### Task 3: Storybook spec §3 and README

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md:73,76,78`, `README.md` (the storybook paragraph that starts "`/lab/storybook.html` is the structures storybook", and the specs list of the lab paragraph)
- Test: `src/lab/docs.test.ts` (same block)

- [ ] **Step 1: Write the failing tests:**
  - `"the storybook index names the signs in the shipyard, city and sea rows"`: the row that starts with `| Portfolio: astillero |` contains `muro grafiteado`; `| Resume: ciudad |` contains `cartel helipuerto (A y B)`; `| Blog: mar |` contains `plataforma con cartel`. Each of them is in the last cell, the part after the last-but-one `|`.
  - `"README names the four sign exhibits and the c key in the storybook paragraph"`: the storybook paragraph (the README split on blank lines, `p.includes("/lab/storybook.html")`) contains `#cartel-helipuerto`, `#cartel-helipuerto-b`, `#grafiti`, `#plataforma` and `` `c` ``. Each id is in `EXHIBITS`.
  - `"README lists the sign spec among the lab specs"`: the paragraph with `/lab/world.html` contains `2026-11-11-carteles-de-zona-assets-design.md`.
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts`. Expected: these three FAIL.
- [ ] **Step 3: Edit:**
  - Storybook spec: append `, muro grafiteado`, `, cartel helipuerto (A y B)` and `, plataforma con cartel` to the "Exhibits pieza" cell of each of the three rows.
  - README: append to the storybook paragraph, after the seam sentence and with no blank line, an English sentence along the lines of: "The zone signs of #352 are four pieces: `#cartel-helipuerto` and `#cartel-helipuerto-b` (Resume, the helipad with the word on the pad and the rooftop tube variant), `#grafiti` (Portfolio, the harbour graffiti wall) and `#plataforma` (Blog, the sea platform); judge them at the cover scales with `c`."
  - In the lab paragraph's spec list, add `2026-11-11-carteles-de-zona-assets-design.md` after `2026-10-27-barrio-costero-design.md`, before the closing `)`.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: all green.
- [ ] **Step 5: Commit** `docs(#364): storybook index and README name the signs`.

## Assumptions

- **Evals land before the docs.** Stage 3 commits every test of the three tasks at once, failing. So the intermediate commits of Tasks 1–2 are red on the tests of the later tasks, and the branch is green from Task 3 on. Rejected: one test commit per task, because the pipeline asks for a single `test(#364): evals` commit.
- **The §6 box "Nada de `src/world/`… cambia"** is checked against the merge base with `main` (65f73a5), not against `origin/main`. `main` gained #365 (`src/world/view.ts`) and #366 after the story branched; that diff is empty for the story.
- **The 1.27 of `coverView`** was measured on the story's base, before #365 reworked `coverView` on `main` (plan comment of #352: "`coverView(w, h)` hoy da 1.272 en 1366×768"). §8.2 says it was measured before #365. Rejected: re-measuring on `main`, because the story does not integrate the signs and the `c` constants do not depend on it.
- **The Spanish literals in the test** are added to `ALLOW["src/lab/docs.test.ts"]`. The comment above that entry already says the docs test pins literals of the Spanish specs (status line, headings, table rows, exhibit names). Rejected: a fixture file, because no other docs test uses one.
- **The `<id>-real-base.png` captures** of #360 stay as they are, named in §8.4 as captures of the placeholders. The issue asks for the twenty, not for those four. Rejected: re-shooting or deleting them, because the issue scopes the captures to the twenty (PR #368 deferred refreshing `grafiti-real-base.png` to #364, but #364's body does not take it up); the #367 links are commit-pinned blob URLs either way.

## Grilling

- Rounds: 1 (griller model: fable). Questions: 17.
- Sources:
  - ISSUE: 6 (1, 3, 4, 8, 12, 17);
  - CODE: 7 (5, 6, 9, 10, 11, 14, 16);
  - DOC: 3 (2, 7, 15);
  - NO SOURCE → technical assumption: 1 (13).
- Plan changes:
  - the §6 diff is taken against the merge base (question 14 found that the plain `origin/main` diff is not empty);
  - `6.8` is asserted (question 12);
  - the Assumptions section above was added.
- No spec ambiguity. No follow-up issues opened.
