# English glossary, veil ADR and English codebase (#194): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add an English `CONTEXT.md` glossary and `docs/adr/0001` for the veil rule, and translate `src/`, `lab/`, `README.md` and `CLAUDE.md` to English without changing what the site renders.

**Architecture:** a guard test (`src/english.test.ts`) gives each file under `src/` and `lab/` a pass/fail verdict on leftover Spanish. A baseline test (`src/scenes/world-baseline.test.ts`) pins hashes of the whole world (`world(SEED)`: solids, ground, accents and the static render list) that were recorded on `main` before any translation. Tasks 2–7 translate one folder group each. A task renames that group's Spanish identifiers and files and updates every importer repo-wide, so `npm run typecheck` holds it to account. Task 8 writes the docs. Task 9 compares before/after screenshots pixel by pixel.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS v8, agent-browser.

**Spec:** issue #194 plus the owner's decision comment of 2026-11-01 (it absorbs #196). Sources for the glossary: `src/world/veil.ts`, `docs/plans/2026-10-19-26-velo-luces-por-posicion.md`, and the "Vocabulario" section of `docs/plans/2026-10-19-74-orden-piezas-barcos.md`.

## Global Constraints

- "Todo en inglés": `CONTEXT.md` (repo root) is an English glossary with at least **Veil, Zone, Accent, Animator, Deck piece, Side piece, Hull rule, Frame, Lanes, Exhibit**. `docs/adr/0001-*.md` records the veil rule in English.
- Translate to English: identifiers (variables, functions, types, file names), comments, and log and test messages written in Spanish in `src/` and `lab/`, plus `README.md` and `CLAUDE.md`.
- Do not touch: old specs and plans in `docs/`, and visitor-facing text (`content/`, plus visitor-visible strings that live in `src/`, e.g. `document.title`, labels rendered on the site).
- "Sin cambios de comportamiento": the render stays the same. Existing tests pass with their expected values unchanged (only names change). Before/after world captures are identical.
- US English spelling, matching existing code (`color`, `neighborhood`, `center`).
- Commits: `refactor(#194): ...` for translations, `docs(#194): ...` for docs.

## Technical decisions (declared)

1. **What counts as an identifier.** Every TS name (variables, functions, types, interfaces, properties, string-literal union members that only name things inside the code, such as `StyleId`, `GroupId` and `Barrio` kinds) and every file name gets translated.
2. **What stays Spanish because it is data, not a name.** (a) The keys of the `content/*.json` schema (`titulo`, `secciones`, `articulos`, `descripcion`, …) and the TS fields that mirror them: renaming them would mean editing `content/`. (b) Storybook exhibit `id`s, which are the URL hash (`#faro`, `#estacion`) and are cited by the old specs and by `README.md`. (c) Proper nouns (Tigre, Mitre, Mistley, Nicolás). (d) Visitor-visible strings and the Spanish test fixtures that stand in for visitor content in `src/content/*.test.ts`. The guard allowlists each of these explicitly, by file and pattern. The lab's human-facing labels (exhibit `title`, readout panel labels, help text) are developer-facing and get translated.
3. **Tests whose expected value is prose.** `src/lab/docs.test.ts` pins Spanish phrases from `README.md` and from source docstrings (`factory.ts`, `tech.ts`, `station.ts`, `train.ts`, `rail-anim.ts`, `shipyard.ts`). Translating that prose is what the issue asks for, so each such expectation becomes the English rendering of the same phrase, asserting the same fact. Assertions about the old Spanish specs in `docs/` (which stay untouched) keep their Spanish patterns. The task that translates a pinned file also updates the matching `docs.test.ts` assertion.
4. **Snapshots.** `src/iso/__snapshots__/solids.test.ts.snap` is keyed by test name. When a test name changes, the file is regenerated with `npx vitest run -u src/iso/solids.test.ts`, and the multiset of snapshot *values* must be byte-identical before and after (the check is in Task 2).
5. **Renaming order.** The tasks run sequentially. A task renames the exports of its own folders and fixes every importer anywhere in the repo. It translates only the comments and strings of its own folders. Files are renamed with `git mv`.
6. **Rename table (seed, keep it consistent):** barrio→neighborhood, casas→houses, escuela→school, costanera→waterfront, plaza→plaza, nave→hall, estacion→station, centro→downtown, bares→bars, residencial→residential, civico→civic, ribera→riverside, distrito→district, fabrica→factory, ciudad→city, fila→row, ancho→width, largo→length, techo→roof, ventanas→windows, nombre→name, mundo→world, parrafos→paragraphs, sinTorres→withoutTowers, Articulo→Article (type and function names only; JSON keys stay, decision 2), integracion-main→main-integration.
7. **The guard's heuristic.** A line fails if it contains `[áéíóúñÁÉÍÓÚÑ¿¡]`, or one of the whole, case-insensitive words `el los las del de la que por para con una sin como cada sobre entre hasta desde donde cuando pero está hay se al su sus es son queda va más también sólo solo`, unless an allowlist entry for that file matches. Excluded from the word list: `y`, `a`, `o`, `e`, `lo`, `en` (they are coordinates, variables or English words). Files covered: `src/**/*.{ts,css}` (except `__snapshots__`), `lab/*.html`, `README.md`, `CLAUDE.md`.

## Review Focus

- **Renamed string literals that end up in data.** If a renamed union member (`StyleId`) were serialized into solids, sorted, or hashed, the render could change. The world baseline test (Task 1) catches it. On a mismatch, investigate; never re-record the baseline.
- **Object key order.** Renaming the keys of `STYLES` or similar records must keep their insertion order, because iteration order can feed the RNG sequence. The baseline catches this too.
- **Visitor text translated by accident.** `src/views.ts`, `src/content/render.ts` and `src/router.ts` hold strings the visitor reads. Task 3 adds a guard assertion that `document.title` is still `"Nicolás Riccomini"` and that `renderContent` output for the existing fixture is unchanged (the existing tests already pin these, so it stays green).
- **Lab URLs.** `#faro`, `?speed=`, `?bloom=` and the keyboard keys keep working (decision 2b). `exhibits.test.ts` already pins the ids.
- **Log prefixes.** `[mapa]` and `[lab]` are prefixes, not Spanish prose. They stay byte-identical, because the old specs quote them (`[lab] bloom:`). Only the message text after the prefix is translated.

---

### Task 1: Evals: guard, baseline, docs tests (stage 3)

**Files:**
- Create: `src/english.test.ts`, `src/scenes/world-baseline.test.ts`, `src/docs-glossary.test.ts`

- [ ] **Step 1:** `src/english.test.ts`: one `it` per covered file (named by its repo-relative path, so `-t src/iso` filters). Each `it` asserts that the list of offending `file:line: text` entries is empty, following decision 7. The allowlist is a `Record<path, RegExp[]>` with the decision-2 entries.
- [ ] **Step 2:** `src/scenes/world-baseline.test.ts`: on unmodified `main`, compute `fingerprint(w.solids)`, `fingerprint(w.ground)`, an FNV hash of `JSON.stringify(w.accents)` with the `r6` rounding, and an FNV hash of `buildRenderList(w.solids)` for `w = world(SEED)`, and also for `world(SEED, { zones: [z] })` for each zone. Paste the values in as literal constants. This test is a guard and passes from the start.
- [ ] **Step 3:** `src/docs-glossary.test.ts`: `CONTEXT.md` exists and has a `### <Term>` heading for each term in Global Constraints. `docs/adr/` holds a file that matches `^0001-.*\.md$`, names `src/world/veil.ts` and `accentsByZone`, and states both the position rule and the ship exception (`/ship/i`). `README.md` links `CONTEXT.md` and `docs/adr/`.
- [ ] **Step 4:** Run `npx vitest run src/english.test.ts src/docs-glossary.test.ts`. Expected: FAIL (Spanish everywhere, no glossary). Run `npx vitest run src/scenes/world-baseline.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `test(#194): evals`.

### Task 2: `src/iso/`

**Files:** `src/iso/**` (23 files and the snapshot).
**Interfaces:** Produces the translated `src/iso` exports. Most of them are already English; the comments are the bulk of the work.

- [ ] **Step 1:** Save the snapshot values as they are now: `node -e` script printing `sha256` of the sorted list of values in `solids.test.ts.snap` (split on `exports[`; drop the key) → `.scratch/194-snap-before.txt`.
- [ ] **Step 2:** Translate comments, test names, messages and Spanish identifiers in `src/iso/`. `pixi-free.test.ts` keeps its regexes and the `PIXI_TESTS` set as they are.
- [ ] **Step 3:** `npx vitest run -u src/iso/solids.test.ts`, then recompute the hash from Step 1. Expected: identical. Also check that `git diff --stat` on the `.snap` shows the same number of entries.
- [ ] **Step 4:** `npx vitest run src/iso src/english.test.ts -t "src/iso"` → PASS. `npm run typecheck` and `npm test` show no new failures beyond the guard and the glossary tests for the other folders.
- [ ] **Step 5:** Commit `refactor(#194): src/iso in English`.

### Task 3: `src/map/`, `src/world/`, `src/content/` and the files at the `src/` root (`main.ts`, `views.ts`, `router.ts`, `camera.ts`, `style.css`)

- [ ] **Step 1:** Translate, respecting decision 2a/2d (content schema keys, visitor strings, Spanish fixtures). `validate.ts` error messages are build-time developer messages and get translated, and their test expectations change with them (they are messages, not values).
- [ ] **Step 2:** Guard for these paths, typecheck, `npm test` (only other folders' guard rows and the glossary tests still fail). The baseline passes.
- [ ] **Step 3:** Commit.

### Task 4: `src/kit/` (with `forms/`) and `src/city/`

- [ ] **Step 1:** Translate. `StyleId` members follow the decision-6 table and keep `STYLES` key order. Update `README.md`'s mention of the styles only in Task 8.
- [ ] **Step 2:** Guard for these paths, typecheck, `npm test`, baseline PASS.
- [ ] **Step 3:** Commit.

### Task 5: `src/scenes/`, Resume side

**Files:** `city*`, `tech*`, `barrio*` (renamed to `neighborhood*`), `costanera*` (→ `waterfront*`), `sprawl-grid*`, `city-grid*`, `city-pieces*`, `neon*`, `flora*`.

- [ ] **Step 1:** Translate and rename with `git mv`. Update the `tech.ts` docstring assertions in `src/lab/docs.test.ts` (decision 3).
- [ ] **Step 2:** Guard for these files, typecheck, `npm test`, baseline PASS.
- [ ] **Step 3:** Commit.

### Task 6: `src/scenes/`, Portfolio side

**Files:** `factory*`, `boiler-house*`, `maltings*`, `excavator*`, `substation*`, `plant-frame*`, `shipyard*`, `station*`, `train*`, `rail*`, `hinterland*`, `portfolio-accents*`, `pieces*`.

- [ ] **Step 1:** Translate. Update the `factory.ts`, `shipyard.ts`, `station.ts`, `train.ts` and `rail-anim.ts` docstring assertions in `docs.test.ts` (decision 3). `station.ts` still names Tigre.
- [ ] **Step 2:** Guard, typecheck, `npm test`, baseline PASS.
- [ ] **Step 3:** Commit.

### Task 7: `src/scenes/`, Blog side and shared files

**Files:** `sea*`, `ships*`, `water*`, `fair*`, `terrain*`, `world*`, `depth-map*`, `animator*`, `animators*`, `island-coast*`, `integracion-main.test.ts` (→ `main-integration.test.ts`), plus anything left in `src/scenes/`.

- [ ] **Step 1:** Translate. Guard for all of `src/scenes/`, typecheck, `npm test`, baseline PASS.
- [ ] **Step 2:** Commit.

### Task 8: `src/lab/`, `lab/*.html`, docs (`CONTEXT.md`, ADR, `README.md`, `CLAUDE.md`)

- [ ] **Step 1:** Translate `src/lab/` and `lab/*.html`. Exhibit `id`s stay as they are (decision 2b); titles, group labels, readout labels and help text are translated. Log text after `[lab]`/`[mapa]` is translated, and the prefixes stay.
- [ ] **Step 2:** `CONTEXT.md`: one `### Term` per glossary entry (each with its Spanish name in parentheses and its code anchor: file and identifier), with definitions taken from the sources in **Spec**. Deck piece and side piece come from plan #74 "Vocabulario". The hull rule covers the three rules of #74. Frame is the ship's local frame. Lanes are `LANE_OUT`/`LANE_BACK`. Exhibit is a storybook entry (`src/lab/exhibits.ts`). Zone means `portfolio`/`cv`/`blog` (`worldZoneAt`). Accent is a point light (`src/iso/accent.ts`). Animator is a zone-tagged animated layer (`src/world/assemble.ts`). Veil is the sky-colored overlay over unfocused zones and its accent dimming (`VEIL_ALPHA`, `ACCENT_DIM`).
- [ ] **Step 3:** `docs/adr/0001-veil-lights-follow-their-position.md` (Status / Context / Decision / Consequences): a light is veiled with the zone where it stands, static or animated, except lights mounted on a ship, which follow the ship's zone. It cites `accentsByZone` in `src/world/veil.ts`, issues #15 and #26, and the #26 plan.
- [ ] **Step 4:** Translate `README.md` and `CLAUDE.md` (they link `CONTEXT.md` and `docs/adr/`). Spec file names and anchors into old Spanish specs stay as they are. Update the README-prose assertions in `docs.test.ts` to English (decision 3), including `` `docs/plans/` (agent runs) ``.
- [ ] **Step 5:** The whole guard, the glossary test, typecheck and `npm test` all PASS. Commit.

### Task 9: Before/after captures

- [ ] **Step 1:** Run `.scratch/evals-194.md` (written in stage 3): the dev server runs on a worktree of `origin/main` (port 5174) and one on the branch (port 5173). Capture each with agent-browser at viewport 1600×900×2: `/lab/world.html?speed=0`, `/lab/storybook.html?speed=0#faro`, and the site root. Compare with a pixel diff (`node` + `pngjs` if present, otherwise a `sha256` of the decoded RGBA via the browser canvas). Expected: 0 differing pixels.
- [ ] **Step 2:** If they differ, investigate (the baseline should already have caught it). Record the result in the PR body.
