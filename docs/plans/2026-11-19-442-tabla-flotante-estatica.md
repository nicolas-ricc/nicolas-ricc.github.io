# Static floating board with WRITING in Chainsaw Carnage at both sites (#442) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Writing sign becomes one flat `officeDark` board floating on the water with `WRITING` painted on it in Chainsaw Carnage, at both Writing sites, static; LostWages leaves the code; `npm test` and `npm run typecheck` green.

**Architecture:** `src/scenes/sign-platform.ts` keeps its public API (`WritingSite`, `PLATFORM_SITES`, `WRITING_CAP`, `PLATFORM_DECK`, `BLOG_SIGNS`, `seaPlatformAt`, `seaPlatform`) but builds a single `poly` (the board) plus the glyph triangles as cyan accents, on a `roofDiagonal` plane whose origin puts the board's centre on `PLATFORM_SITES[site]`. The word is the pre-composed `src/kit/chainsaw-writing.ts`, copied byte for byte from `origin/feature/writing-tabla-flotante` (228804a). `platformAnimator`, `zoneSigns`, `zoneView`, `writingSite` and the crops consume the API unchanged.

**Tech Stack:** TypeScript, Vitest, Python 3 (generator script only, not run here), PixiJS v8 (runtime only), agent-browser for the visual check.

**Spec:** issue #442 ("Decisiones tomadas (no se reabren)" and "Criterios de aceptación" are binding), child of story #441 (base branch `feature/441-writing-tabla-flotante`). Source of the word, the script arguments and the first geometry: `git show origin/feature/writing-tabla-flotante:<path>` for `src/scenes/sign-platform.ts`, `src/scenes/sign-platform.test.ts`, `src/kit/chainsaw-writing.ts`, `src/kit/marquee.ts`, `scripts/marquee-word.py`, `src/world/signs.test.ts`.

## Global Constraints

- `src/kit/chainsaw-writing.ts` is byte for byte `git show origin/feature/writing-tabla-flotante:src/kit/chainsaw-writing.ts` (382 triangles, credit «Chainsaw Carnage (GGBotNet, SIL Open Font License)»). Not regenerated. No `.ttf/.otf/.woff*` enters the repo.
- `src/kit/marquee.ts`: `export const CHAINSAW_FACE = 0.12, CHAINSAW_X = 0.77;` with the old branch's docstring; `LOSTWAGES_FACE` is removed.
- `scripts/marquee-word.py`: `main(path, word, name, credit, thin="0", air="0", close="0", speck="0", tol="0")`, `main(*sys.argv[1:10])`.
- Geometry: `WRITING_CAP = 10.8`, `WATER_Z = -1`, `export const BOARD_TOP = -0.4`, `BOARD_PAD = 1.6`, `PAINT_LIFT = 0.02`.
- `PLATFORM_SITES` unchanged: `wide` (570, 105, 0), `tall` (440, 400, 0).
- Paint: accents `{ kind: "poly", pts, color: "cyan", alpha: 0.85 }`, copies of `BLOG_SIGNS[site]` glyph quads; every vertex at z `BOARD_TOP + PAINT_LIFT`.
- `BLOG_SIGNS[site]`: `id "plataforma"`, `text "WRITING"`, `size WRITING_CAP`, `width SIGN_FONT.width`, `color "cyan"`, `style "fill"`, `backing [board]`, `xHeight CHAINSAW_X * WRITING_CAP`, `stroke CHAINSAW_FACE * WRITING_CAP`.
- Removed exports: `DECK_TOP`, `RAIL_POST`, `DECK_HALF`, `isSeaPatch`.
- `SIGN_RULES`, `FONT_RULES` and the ship rules are not loosened.
- Code, comments and test names in English (`src/english.test.ts`). Spec documents (`docs/superpowers/specs/`) are in Spanish.
- The specs and `docs/plans` are history: no LostWages text is removed from them.

## Technical decisions (declared; not in the issue's design)

1. **Criterion 6's grep and test files.** The issue itself requires test files to name the old fonts in order to assert their absence (`chainsaw-writing.test.ts`: «marquee.ts no menciona LOSTWAGES ni CHANCERY», «no existen src/kit/lostwages-writing.ts ni src/kit/chancery-writing.ts», «marquee-word.py … no menciona LostWages»; `docs.test.ts`: CONTEXT.md «no mencione LostWages») and to keep pinning the spec's LostWages history (§8.2 entry, «quedan como están»). So criterion 6 is read as: **no non-test file** under `src/` or `scripts/`, nor `CONTEXT.md`, matches `LostWages|LOSTWAGES|Black Chancery|CHANCERY`; in `*.test.ts` files those names appear only inside assertions of absence or of the spec history. A test in `chainsaw-writing.test.ts` pins the non-test part. Comments in test files that merely narrate (`world-baseline.test.ts`, `english.test.ts`, `scripts/legibility.test.ts` describe title) are reworded to cite the issue number instead of the font.
2. **Level-3 OCR exception stays (until #445).** `excused` in `scripts/legibility-measure.ts` and its tests keep their behaviour; only the wording loses the font's name (cite #437 and spec 2026-11-15 §8.2). Removing it is #445 ("nivel 3 sin excepciones"); `REPORT.md` is not regenerated here (the issue says another child does it).
3. **Spec 2026-11-15 tables pinned live.** `src/lab/docs.test.ts` checks that §8.1 (level-2 columns of `plataforma-escena` rows; the `WRITING` font row) and §8.3 (the `WRITING` row) carry what the code computes now. Measured in a planning spike, they fail with the board (e.g. `plataforma-escena` 1.17 x-height 13.62, §8.3 width 45.43). Those cells are updated in the spec to the new values and the §8.3 host cell describes the board (`tabla … (\`PLATFORM_DECK\`)`); the contrast/halo/OCR cells (read from `REPORT.md`) are not touched. The §8.2 LostWages entry assertions switch their live values to literals of that history: `` `WRITING_CAP` 9.4 ``, `` `LOSTWAGES_FACE` 0.138 ``, threshold `1,55` (all three are what the entry says today).
4. **Exhibit `h`.** Measured in the spike: with `writingSite` the crop of each Writing context holds only the board (top −0.4), so `h` becomes **1** for both, with the reason in the exhibit comment.
5. **`src/lab/signs.test.ts` sanity check.** "world solids besides the sign's own backing cross the letters' screen box" (`near.length > backing.length`) can no longer hold for Writing: the board lies alone on open sea (spike: `near` = the board). For the two Writing exhibits it becomes the stronger statement "nothing but the board crosses the letters' screen box" (`near` equals the backing); the other exhibits keep `>`. The `checkSign` gate itself (criterion 4) is unchanged.
6. **`marquee-word.py` order.** `speck` runs first (drops small bodies and holes), then `close`, then `tol` (simplify), then `thin`; with the documented command (`close` 0) the order changes nothing.

## Review Focus

1. A consumer that mutates what `seaPlatformAt` returned must not reach `BLOG_SIGNS` (footprint points and accent points are copies). Test in Task 2 (`not.toBe` on solid, footprint points and accent points).
2. `seaPlatform` (origin piece) must equal `seaPlatformAt("wide")` translated, so the `plataforma` exhibit and `PLATFORM_DECK` stay consistent: Task 2 test plus `PLATFORM_DECK` equals the wide footprint minus the site.
3. The board must stay on water and Blog at both sites (else the veil or the coast cuts it): Task 2 `waterCellMat` test on every 1 u cell centre under the plan, and `veil.test.ts` all accents Blog.
4. The paint must sit strictly above the board but flat (oracle needs the backing behind the glyph centres): Task 2 test, every paint vertex z = `BOARD_TOP + PAINT_LIFT` within 1e-9, and `staticContrast ≥ 7` (would be 1 if coplanar).
5. Ship lanes and hulls vs the new deeper plan: `sea-anim.test.ts` rules unchanged and green (Task 2 step "full suite").

---

**Stage 3 note.** The pipeline writes the failing tests of Tasks 1–3 before implementation (`test(#442): evals`). An implementer who finds a step's test already present runs it, confirms it fails for the expected reason, and moves on to the implementation step.

### Task 1: The word, its constants and its generator

**Files:**
- Create: `src/kit/chainsaw-writing.ts` (copy), `src/kit/chainsaw-writing.test.ts`
- Modify: `src/kit/marquee.ts` (add `CHAINSAW_FACE`, `CHAINSAW_X`; `LOSTWAGES_FACE` stays until Task 3), `scripts/marquee-word.py`

**Interfaces:**
- Produces: `CHAINSAW_WRITING` (from `src/kit/chainsaw-writing.ts`), `CHAINSAW_FACE = 0.12`, `CHAINSAW_X = 0.77` (from `src/kit/marquee.ts`).

- [ ] **Step 1: Write the failing tests** in `src/kit/chainsaw-writing.test.ts`, `describe("WRITING in Chainsaw Carnage (#442)")`:
  - the word is `WRITING`: `CHAINSAW_WRITING.text === "WRITING"`, letters joined = `"WRITING"` (7).
  - 382 triangles: the total of the word's triangles (sum over letters of the triangle count the file holds) is 382 — the guard that does not depend on the old branch existing.
  - `CHAINSAW_X`: `Math.min(...marqueeLayout(1, 0, CHAINSAW_WRITING).map((g) => g.box.y1 - g.box.y0))` `toBeCloseTo(CHAINSAW_X, 2)`.
  - credit: first line of `src/kit/chainsaw-writing.ts` is exactly `// Generated by scripts/marquee-word.py from Chainsaw Carnage (GGBotNet, SIL Open Font License).`
  - byte for byte: `readFileSync("src/kit/chainsaw-writing.ts")` equals `execFileSync("git", ["show", "origin/feature/writing-tabla-flotante:src/kit/chainsaw-writing.ts"])` — skip (`it.skipIf`) when that ref is not available (`git cat-file -e` fails), so a shallow CI clone does not fail.
  - script: `scripts/marquee-word.py` contains `https://www.1001fonts.com/chainsaw-carnage-font.html`, `https://www.1001fonts.com/download/chainsaw-carnage.zip`, `0 0.13 0 0.005 0.004 > src/kit/chainsaw-writing.ts`, `close="0", speck="0", tol="0"` and `sys.argv[1:10]`.
  - no font file: `git ls-files` has no line matching `/\.(ttf|otf|woff2?)$/i`.
- [ ] **Step 2: Run** `npx vitest run src/kit/chainsaw-writing.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement.** `git show origin/feature/writing-tabla-flotante:src/kit/chainsaw-writing.ts > src/kit/chainsaw-writing.ts`. Add `CHAINSAW_FACE`, `CHAINSAW_X` with the old branch's docstring to `marquee.ts`. Port `speck` (8th) and `tol` (9th) from the old branch into `marquee-word.py` keeping `closing()` and `close` (7th), order per technical decision 6; docstring: explain `speck` and `tol` as the old branch does, document the Writing command exactly as in Global Constraints with the font URL and the download URL; delete the LostWages paragraph and command (the `close` explanation stays, without naming LostWages).
- [ ] **Step 4: Run** the test file — all pass. `python3 -c "import ast,sys; ast.parse(open('scripts/marquee-word.py').read())"` succeeds.
- [ ] **Step 5: Commit** `feat(#442): Chainsaw Carnage word, constants and generator args`.

### Task 2: The board at both sites

**Files:**
- Modify: `src/scenes/sign-platform.ts` (rewrite), `src/scenes/sign-platform.test.ts` (rewrite on the old branch's, per site), `src/lab/exhibits.ts` (`h` 1 for `plataforma-escena*`, comments), `src/lab/exhibits.test.ts`, `src/lab/signs.test.ts`, `src/world/veil.test.ts`, `src/scenes/world-baseline.test.ts` (re-record `plataforma`), `src/lab/docs.test.ts` (§8.2 literals), `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§8.1/§8.3 cells), comments in `src/scenes/sea.test.ts`, `src/scenes/sea-anim.test.ts`, `src/scenes/city-budget.test.ts` where they describe the old platform.

**Interfaces:**
- Consumes: Task 1's `CHAINSAW_WRITING`, `CHAINSAW_FACE`, `CHAINSAW_X`.
- Produces (in `sign-platform.ts`): `WRITING_CAP = 10.8`, `BOARD_TOP = -0.4`, `type WritingSite`, `PLATFORM_SITES`, `PLATFORM_DECK: readonly Vec2[]` (board plan at the origin), `BLOG_SIGNS: Record<WritingSite, SignSpec>`, `signAt(site: WritingSite): SignSpec` (fresh spec; `BLOG_SIGNS[site]` is `signAt(site)` computed once), `seaPlatformAt(out: Solid[], accents: Accent[], site: WritingSite): void`, `seaPlatform(out: Solid[], accents: Accent[]): void`.

- [ ] **Step 1: Write the failing tests.** `sign-platform.test.ts`, `describe.each(["wide", "tall"] as const)("Writing board at the %s site (#442)")`, adapting each case of the old branch's file to `PLATFORM_SITES[site]` / `BLOG_SIGNS[site]`:
  - exactly one solid: `poly`, `officeDark`, `z === -1`, `z + h` close to `BOARD_TOP` (1e-12).
  - rectangle along u = (1, −1)/√2 and n = (1, 1)/√2, centred on the site (1e-9); `PLATFORM_DECK` equals the footprint minus the site (1e-9 per coordinate).
  - `BLOG_SIGNS[site]` `toMatchObject` the Global Constraints fields; glyphs spell `WRITING`; `backing` `toEqual` the built solids and `not.toBe` them (copies), footprint points not the same objects.
  - plane: every glyph `u` ≈ (√½, −√½, 0), `v` equals `(−Z_SCALE, −Z_SCALE, 0)`.
  - flat paint: every accent vertex `|p.z − (BOARD_TOP + 0.02)| < 1e-9` and `pointInPolygon` inside the footprint.
  - board exceeds each letter's ink box by ≥ `SIGN_FONT.width` on every side (old branch's computation).
  - `tessellate(board)` has an `officeDark` face with `normal.z > 0.99`.
  - accents are exactly the spec's triangles in cyan at 0.85 and nothing else (`toEqual`), accent points not the same objects as the spec's.
  - `staticContrast(BLOG_SIGNS[site]) >= 7`.
  - every 1 u cell centre `(floor(x)+0.5, floor(y)+0.5)` inside the footprint has `waterCellMat(x, y) !== null`.
  - deterministic: two `seaPlatformAt` builds are equal.
  - (in `src/kit/chainsaw-writing.test.ts`) level 1: `checkLayouts(marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING), WRITING_CAP, CHAINSAW_FACE * WRITING_CAP)` equals `[]`, with `WRITING_CAP` imported from `../scenes/sign-platform` (10.8 after this task).
  - outside the `describe.each`: `seaPlatform` equals `seaPlatformAt("wide")` translated by `−PLATFORM_SITES.wide` (old branch's rounding helper); `PLATFORM_SITES` equals the two sites above.
  
  `exhibits.test.ts`: the `plataforma-escena*` cases expect `h: 1`; "shows the platform once" becomes "one platform solid, the officeDark board, no deck, no platform animator" (`own` length 1, `own[0]` officeDark poly, no `deck` poly in `all`, `own` found in `all`); the backing case drops `isSeaPatch` (every backing solid is in the crop). `veil.test.ts`: the Writing case requires polys (no dots) and every accent Blog. `signs.test.ts`: technical decision 5.
- [ ] **Step 2: Run** `npx vitest run src/scenes/sign-platform.test.ts src/lab/exhibits.test.ts src/world/veil.test.ts src/lab/signs.test.ts` — expect FAIL.
- [ ] **Step 3: Implement `sign-platform.ts`.** Old branch's module generalised per site: `LAYOUT = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING)`; `INK` the ink box of all letters (min/max over every glyph box); `SHEET` = `INK` ± `BOARD_PAD`; the plane for site `c` is `roofDiagonal(v3(c.x − m.x, c.y − m.y, BOARD_TOP + PAINT_LIFT))` where `m = toWorld(roofDiagonal(v3(0, 0, BOARD_TOP + PAINT_LIFT)), sheetCentre)`; board footprint = the four `SHEET` corners through `toWorld`; `seaPlatformAt` pushes copies of `BLOG_SIGNS[site].backing` and its glyph quads as accents; `seaPlatform` = `seaPlatformAt("wide")` through `translate`/`translateAccent` by `−PLATFORM_SITES.wide`. Docstrings for `WRITING_CAP` (why 10.8: phone stroke 1.51 px vs 1.5 floor), `BOARD_TOP`, `PAINT_LIFT` (why 0.02: the oracle needs the backing strictly behind each glyph centre). Nothing else is built.
- [ ] **Step 4: Update dependents.** Spec cells are written from what the docs tests print against *this* implementation, never from the planning spike's numbers; no tolerance is widened. `exhibits.ts`: `h: 1` with the comment "the crop holds only the board, top −0.4: the least positive integer not below it". `world-baseline.test.ts`: re-record the `plataforma` hash (take the value the failing test prints) with a comment line `// #441: WRITING in Chainsaw Carnage painted flat on a floating board`. `docs.test.ts` §8.2 block: technical decision 3 literals. Spec 2026-11-15 §8.1/§8.3: update the cells the docs tests print (technical decision 3). Comments in `sea.test.ts`, `sea-anim.test.ts`, `city-budget.test.ts` that describe deck/piles/hut/posts: describe the board (comments only; budgets and rules untouched).
- [ ] **Step 5: Run** `npm test` and `npm run typecheck` — all green except Task 3's absence/CONTEXT tests.
- [ ] **Step 6: Commit** `feat(#442): WRITING painted on a floating board at both sites`.

### Task 3: LostWages leaves the code; CONTEXT.md describes the board

**Files:**
- Delete: `src/kit/lostwages-writing.ts`, `src/kit/lostwages-writing.test.ts`
- Modify: `src/kit/marquee.ts` (drop `LOSTWAGES_FACE`), `src/kit/chainsaw-writing.test.ts` (absence tests), `scripts/legibility-measure.ts` and `scripts/legibility.test.ts` (wording only), `src/english.test.ts` (comment; word list only if needed), `src/scenes/world-baseline.test.ts` (narrating comments), `src/lab/docs.test.ts` (CONTEXT assertion), `CONTEXT.md` (Lettering, Sign)

- [ ] **Step 1: Write the failing tests.** In `chainsaw-writing.test.ts`: `src/kit/marquee.ts` does not match `/LOSTWAGES|CHANCERY/`; `src/kit/lostwages-writing.ts` and `src/kit/chancery-writing.ts` do not exist; `scripts/marquee-word.py` does not match `/LostWages/`; every file from `git ls-files src scripts CONTEXT.md` not ending in `.test.ts` does not match `/LostWages|LOSTWAGES|Black Chancery|CHANCERY/`. In `docs.test.ts` the CONTEXT case: contains `` `WRITING` ``, `Chainsaw Carnage`, `` `src/kit/chainsaw-writing.ts` ``, and does not match `/LostWages/` nor `/Chancery/`.
- [ ] **Step 2: Run** them — expect FAIL.
- [ ] **Step 3: Implement.** Delete the two files and `LOSTWAGES_FACE`. Reword `scripts/legibility-measure.ts` (`excused` doc: "tesseract read the `I` of #437's font as `E`") and `scripts/legibility.test.ts` describe title ("the OCR exception of the Writing platform (#437, spec 2026-11-15 §8.2)"); behaviour untouched. `english.test.ts` and `world-baseline.test.ts` comments: cite issue numbers, not fonts. `CONTEXT.md`: Lettering — `WRITING` «distressed capitals in Chainsaw Carnage painted flat on a board floating on the water», file `src/kit/chainsaw-writing.ts`; Sign — the platform is the board (one `poly` `officeDark` from z −1 to `BOARD_TOP` −0.4, plan = ink box + `BOARD_PAD` 1.6, `roofDiagonal` plane, paint at `PAINT_LIFT`), the oracle's backing is the board; delete the sentences on the frame, the posts, the sea patch and the level-3 OCR exception (#437); add `BOARD_TOP` to the Code line of `sign-platform.ts`. `src/docs-glossary.test.ts` must stay green (code refs must exist).
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, and `grep -rIl -E 'LostWages|LOSTWAGES|Black Chancery|CHANCERY' src scripts CONTEXT.md` — only `*.test.ts` files listed, each hit an absence or spec-history assertion.
- [ ] **Step 5: Commit** `feat(#442): LostWages leaves the code; CONTEXT.md describes the board`.

### Task 4 (verification, no code): storybook check

- [ ] `npm run dev -- --host --port 5173`; agent-browser `http://localhost:5173/lab/storybook.html#plataforma-escena` and `#plataforma-escena-angosta`, key `c` toggles 1.17/0.83: a flat dark board on the water with cyan `WRITING`, no posts or beams. Save screenshots outside the repo for the PR.

## Assumptions

Decided during grilling (engineering choices; the rejected alternative in brackets):

- A1. Intermediate commits on the agent branch may be red (stage 3 commits failing evals by pipeline design); the PR is squash-merged, so only the branch head must be green. [Keep every commit green: impossible with test-first evals.]
- A2. The byte-for-byte test skips when `origin/feature/writing-tabla-flotante` is absent; the 382-triangle count and the credit line remain as permanent guards. [Pin a content hash: duplicates the file's identity in a magic number.]
- A3. Hits of the old fonts' names inside `*.test.ts` are allowed only in absence or spec-history assertions; the reviewer checks that by reading the grep in Task 3 Step 4; the mechanical guard covers non-test files only. [A guard over test files: would have to exempt itself.]
- A4. No OFL licence text is added: the repo ships only the composed word with a credit line, as it did for CNRGN Builder and Neon Light (the issue fixes the credit and forbids any font file). [Add `OFL.txt`: not asked by the issue.]
- A5. An implementer who finds a pre-written eval failing for a reason other than the expected one fixes the test only when it contradicts this plan or the issue, and reports it; otherwise fixes the code.
- A6. The storybook check (Task 4) is visual (screenshots for the PR, as the issue asks); a devtools `totals` count is not pinned.
- A7. The generator's new arguments are not executed here (no fontTools; the issue says the word is not regenerated): the generator-to-output link is verified only by the docstring command and the byte-for-byte copy.

## Grilling

- Rounds: 1 (griller model: fable). Questions: 18. Plan changes were local (level-1 case moved from Task 1 to Task 2, 382-triangle guard added, spec cells from the implementation), so no second round.
- Sources: ISSUE 9 (Q3, Q5, Q6, Q7, Q8, Q9, Q10, Q12, Q14), CODE 6 (Q1, Q8, Q11, Q13, Q18, Q12), NO SOURCE → technical assumption 6 (Q2, Q4, Q15, Q16, Q17, Q3-part) — A1–A7.
- Spec ambiguities: none. Follow-up issues opened: none.
