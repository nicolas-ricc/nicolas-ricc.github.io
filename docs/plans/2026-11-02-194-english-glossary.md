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
7. **The guard's heuristic.** A line fails if it contains `[áéíóúñÁÉÍÓÚÑ¿¡]`, or one of the whole, case-insensitive words `el los las del de la que por para con una sin como cada sobre entre hasta desde donde cuando pero está hay se al su sus es son queda va más también sólo solo`, unless an allowlist entry for that file matches. Also flagged: `este esta estos estas ese esa porque aunque mientras luego antes después ya muy qué cuál`. Excluded from the word list: `y`, `a`, `o`, `e`, `lo`, `en`, `no`, `un` (they are coordinates, variables or English words). Allowlist entries are per file and narrow (one pattern per decision-2 category or per named code token, each with a one-line comment that says why). A catch-all pattern is forbidden. Spanish that the heuristic misses (e.g. "no mover bloque") is the per-task reviewer's job: the reviewer reads the diff of the task's folders for leftover Spanish. Files covered: `src/**/*.{ts,css}` (except `__snapshots__`), `lab/*.html`, `README.md`, `CLAUDE.md`.

## Assumptions (from plan grilling)

- **"Valores esperados" means behavioral values** (geometry, counts, colors, hashes, URLs, render). Test strings that are messages or pinned prose are translated along with their source, because the owner asks for "los mensajes de log y de test" in English. Rejected alternative: leaving `validate.ts` errors and the `docs.test.ts` prose in Spanish, which would contradict "Todo en inglés".
- **English assertions are never looser than the Spanish ones.** Each translated `docs.test.ts` expectation pins the literal English phrase (or a regex with the same structure) for the same fact. Wildcards broader than the original are forbidden.
- **Zone ids `portfolio`/`cv`/`blog` stay.** They are not Spanish, and they are routes (`src/router.ts`). Only Spanish names are translated. Rejected alternative: renaming `cv`→`resume`, which would break URLs.
- **The rename table is the author's** (no source fixes it): `centro`→`downtown`, because `center` already names geometric centers (`centroid`, `center` in geometry); `nave`→`hall`, the industrial hall of the boiler house. Rejected alternatives: `center` and `bay`.
- **Literals the typecheck does not see.** After renaming a union member, the task runs `grep -rn '"<old>"' src lab` and fixes every hit that is not an allowlisted exhibit id.
- **Exhibit ids vs. other literals.** In `src/lab/exhibits.ts`, only the `id: "…"` field (and hashes in `exhibits.test.ts`/`storybook*.test.ts`) keeps Spanish. The allowlist pattern is `/\bid: "[a-z0-9-]+"/` plus `#<id>` hash strings, so `group: "fabrica"` is still flagged and translated.
- **Expected red per task.** A task is green when `npx vitest run --exclude src/english.test.ts --exclude src/docs-glossary.test.ts` passes, `npm run typecheck` passes, and `npx vitest run src/english.test.ts -t "<each path of the task>"` passes.
- **Reversibility.** Each task is one commit. A half-done task is undone with `git reset --hard HEAD && git clean -fd src lab`. `.scratch/` and the Task 9 worktree live outside the tracked tree and are only read by the step that wrote them.
- **`accentsByZone`** already exists under that name (`src/world/veil.ts:97`) and is not renamed. The ADR cites it as it is.

- **Guard mechanics (round 2).** The allowlist *strips* the matched substrings before the check, so the rest of the line is still checked. It does not pass the whole line. Before the word check, the guard also strips code tokens that collide with the word list: `Math.<fn>` member names (`Math.sin`), path-like tokens (`[\w./-]+\.(md|png|ts|html|json|pdf)` and anything inside a `docs/…` path), and `lang="es"` in `lab/*.html` (the pages' language attribute; it is data, not Spanish prose). The word check runs on tokens delimited by whitespace or punctuation other than `-`, `_`, `.` and `/`, so `velo-luces-por-posicion` is not a hit. Spanish identifiers are caught by a second list of Spanish stems from the decision-6 table (`barrio`, `costanera`, `escuela`, `casas`, `fila`, `ancho`, `largo`, `techo`, `ventanas`, `nombre`, `mundo`, `parrafos`, `sinTorres`, `Articulo`, `centro`, `bares`, `residencial`, `civico`, `ribera`, `distrito`, `fabrica`, `ciudad`, `astillero`, `desvios`), checked as identifier substrings.
- **CSS classes emitted into the visitor DOM** (`externo`, `proyectos`, `articulos` in `src/content/render.ts`, pinned by `render.test.ts`) and their rules in `src/style.css` are rendered site output, so they stay (decision 2d) and get explicit allowlist entries. Rejected alternative: renaming them, which changes the prerendered HTML and `render.test.ts`'s expected values.
- **`src/lab/docs.test.ts`:** assertions about the old Spanish specs keep their Spanish patterns, and each one gets a narrow allowlist entry for its literal (e.g. `/"\*\*Estado:\*\*"/`, `/\/implementad\/`). The README and docstring assertions are translated (Assumption 2), as are the local variable names (`parrafos`→`paragraphs`, `desvios`→`deviations`).
- **Sorting.** No sort is keyed by a style, neighborhood or group name. The only `.sort()` calls outside tests are `src/lab/crop.ts:186-187` (material names and accent colors, both English and not renamed), and there is no `localeCompare` in `src/`. The objects the baseline hashes carry material names, colors and numbers. Every string field that would carry a renamed literal is caught by a baseline mismatch, and the rule then is to keep the Spanish literal (allowlisted) rather than change the render.
- **Wider baseline.** Besides `world(SEED)` and the per-zone scenes, `world-baseline.test.ts` hashes the output of every `kind: "piece"` exhibit `build` in `src/lab/exhibits.ts` (solids and accents). Region exhibits are crops of `world(SEED)` and are already covered. Animators and the veil constants are pinned by their existing tests (`*-anim.test.ts`, `veil.test.ts`), whose expected values do not change.
- **Task 9 capture region.** Before each capture, an `agent-browser eval` hides every element in the page except the Pixi canvas, so translated lab text (the readout panel, help) does not enter the comparison. `?speed=0` parses to `0` (`speedFromSearch`, `src/lab/page.ts:26-30`: finite and ≥ 0 is kept as is). Animators read only the ticker delta; `performance.now()` is used only for logging (`page.ts:56,87`, `storybook.ts:52,100`).
- **Task 9 worktree.** `git worktree add /tmp/main-194 origin/main` plus `ln -s /work/node_modules /tmp/main-194/node_modules` and `npm run feed` in it. The orchestrator writes `.scratch/evals-194.md` in stage 3; Task 9 runs in the orchestrator's session.
- **Red commits.** CI (`.github/workflows/deploy.yml`) runs `typecheck`, `npm test` and `build` on `pull_request`, i.e. on the PR head. Intermediate commits may be red only on the two eval tests. The `test(#194)` prefix comes from the pipeline's stage 3.
- **Undoing Task 8:** `git reset --hard HEAD && git clean -fd` (repo-wide, not only `src lab`).
- **`lab/*.html` file names** are already English (`world`, `blog`, `kit`, `portfolio`, `resume`, `storybook`), and no renamed literal shows up in a URL query, a `localStorage` key or `location.hash`: the hash carries only exhibit ids, which are kept.

## Review Focus

- **Renamed string literals that end up in data.** If a renamed union member (`StyleId`) were serialized into solids, sorted, or hashed, the render could change. The world baseline test (Task 1) catches it. On a mismatch, investigate; never re-record the baseline.
- **Object key order.** Renaming the keys of `STYLES` or similar records must keep their insertion order, because iteration order can feed the RNG sequence. The baseline catches this too.
- **Visitor text translated by accident.** `src/views.ts`, `src/content/render.ts` and `src/router.ts` hold strings the visitor reads. Task 1 Step 2b pins `"Nicolás Riccomini"` in `src/views.ts`; `src/content/render.test.ts` already pins the `renderContent` HTML and keeps its expected values. Each task also runs the `git diff --exit-code` check over `content/` and the old docs.
- **Lab URLs.** `#faro`, `?speed=`, `?bloom=` and the keyboard keys keep working (decision 2b). `exhibits.test.ts` already pins the ids.
- **Log prefixes.** `[mapa]` and `[lab]` are prefixes, not Spanish prose. They stay byte-identical, because the old specs quote them (`[lab] bloom:`). Only the message text after the prefix is translated.

---

### Task 1: Evals: guard, baseline, docs tests (stage 3)

**Files:**
- Create: `src/english.test.ts`, `src/scenes/world-baseline.test.ts`, `src/docs-glossary.test.ts`

- [ ] **Step 1:** `src/english.test.ts`: one `it` per covered file (named by its repo-relative path, so `-t src/iso` filters). Each `it` asserts that the list of offending `file:line: text` entries is empty, following decision 7. The allowlist is a `Record<path, RegExp[]>` with the decision-2 entries.
- [ ] **Step 2:** `src/scenes/world-baseline.test.ts`: on the branch before any translation (its `src/` is byte-identical to `origin/main` at 0f4e234; record that SHA in the test's comment), compute `fingerprint(w.solids)`, `fingerprint(w.ground)`, an FNV hash of `JSON.stringify(w.accents)` with the `r6` rounding, and an FNV hash of `buildRenderList(w.solids)` for `w = world(SEED)`, and also for `world(SEED, { zones: [z] })` for each zone. Paste the values in as literal constants. This test is a guard and passes from the start.
- [ ] **Step 2b:** In `src/english.test.ts`, also assert that visitor text survives: `src/views.ts` still contains `"Nicolás Riccomini"`. `content/*.json` is not part of the guard. `content/` and the old `docs/` are checked separately in each task's verification with `git diff --exit-code origin/main -- content/ docs/superpowers/ $(ls docs/plans/*.md | grep -v 194-)`.
- [ ] **Step 3:** `src/docs-glossary.test.ts`: `CONTEXT.md` exists and has a `### <Term>` heading for each term in Global Constraints. `docs/adr/` holds a file that matches `^0001-.*\.md$`, names `src/world/veil.ts` and `accentsByZone`, and states both the position rule and the ship exception (`/ship/i`). `README.md` links `CONTEXT.md` and `docs/adr/`.
- [ ] **Step 4:** Run `npx vitest run src/english.test.ts src/docs-glossary.test.ts`. Expected: FAIL (Spanish everywhere, no glossary). Run `npx vitest run src/scenes/world-baseline.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `test(#194): evals`.

### Task 2: `src/iso/`

**Files:** `src/iso/**` (23 files and the snapshot).
**Interfaces:** Produces the translated `src/iso` exports. Most of them are already English; the comments are the bulk of the work.

- [ ] **Step 1:** Save the snapshot values as they are now: a `node` script that evaluates `solids.test.ts.snap` (`new Function("exports", src)` into an object) and writes `{count, values: sorted values}` → `.scratch/194-snap-before.json`.
- [ ] **Step 2:** Translate comments, test names, messages and Spanish identifiers in `src/iso/`. `pixi-free.test.ts` keeps its regexes and the `PIXI_TESTS` set as they are.
- [ ] **Step 3:** `npx vitest run -u src/iso/solids.test.ts`, then rerun the Step 1 script. Expected: same `count` and a deep-equal sorted `values` array (a dropped duplicate shows up as a lower count).
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

- [ ] **Step 1:** Run `.scratch/evals-194.md` (written by the orchestrator in stage 3, uncommitted per the pipeline; `.scratch/` is in `.git/info/exclude`): the dev server runs on a worktree of `origin/main` (port 5174) and one on the branch (port 5173). Capture each with agent-browser at viewport 1600×900×2: `/lab/world.html?speed=0&bloom=off`, `/lab/resume.html?speed=0&bloom=off`, `/lab/storybook.html?speed=0&bloom=off#faro`. `?speed=0` multiplies every tick by 0 (`src/lab/page.ts:83-88`) and `?bloom=off` skips the timing-dependent bloom measurement (`page.ts:72`), so both servers show the deterministic first frame. The site root is not pixel-compared because it animates without `?speed=`; it builds the same scene as `lab/world.html` (`assembleWorld(undefined, …)`, `src/main.ts:54`), which the baseline test pins. Remove the worktree afterwards. Compare with a pixel diff (`node` + `pngjs` if present, otherwise a `sha256` of the decoded RGBA via the browser canvas). Expected: 0 differing pixels.
- [ ] **Step 2:** If they differ while the baseline passes, capture twice on the same server to rule out nondeterminism, then bisect by task commit. Record the result in the PR body.

## Grilling

- Rounds: 2 (griller model: fable). Questions: 20 + 17 = 37.
- Sources: CODE 21 (`src/main.ts:54`, `src/world/assemble.ts:23`, `src/lab/page.ts:26-30,56,72,83-88`, `src/kit/types.ts:14`, `src/city/zoning.ts:16`, `src/world/veil.ts:97`, `src/lab/exhibits.ts:47-100`, `src/lab/crop.ts:186`, `src/content/render.ts:12-57`, `src/lab/docs.test.ts`, `.github/workflows/deploy.yml`), ISSUE 6 (owner's comment of 2026-11-01), technical assumption 10 (recorded under Assumptions).
- Spec ambiguities: none. Out of scope: none, so no follow-up issues were opened.
