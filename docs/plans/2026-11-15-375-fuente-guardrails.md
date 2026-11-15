# Font with level-1 guardrails (#375) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Respace the sign font (`GRID.gap` 2 plus per-pair kerning), give every glyph its counter probes, expose the measurements of spec §4.1, and add a pure `checkFont` that fails when the font glues its letters again.

**Architecture:** `src/kit/lettering.ts` gets one layout function, `layoutText`, that every generator (`measureText`, `strokeText`, `fillText`) and every measurement (`letterGaps`, `rhythm`, `counterClearance`, `advances`, `overlapping`) is built on. A new pure module, `src/kit/legibility.ts`, holds the common sign measure `SIGN_FONT`, the rule table `FONT_RULES` and `checkFont`, which turns the measurements into a list of violations.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`).

**Spec:** issue #375 (body: "Qué hacer", "Decisiones que hereda", "Criterios de aceptación"). Story context: #374 and `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` §1 and §4.1. Where they differ, the issue wins.

## Acceptance criteria → tasks

- `GRID.gap` = 2, `KERN` exported, every glyph with `counters` → Task 1.
- `layoutText`, `letterGaps`, `rhythm`, `counterClearance`, `strokeRatio`, `advances`, `overlapping` exported and tested → Task 1 (`layoutText`, `advances`, `strokeRatio`) and Task 2 (the rest).
- `src/kit/legibility.ts` with `SIGN_FONT`, `FONT_RULES`, `Violation`, `checkFont`; `checkFont` = `[]` for the three words; each rule asserted on its own → Task 3.
- The air regression (a stroke that leaves 0.22 w) fails `air` → Task 3.
- `npm test` and `npm run typecheck` green; the four sign exhibits still build, with only the literals that depended on the old spacing adjusted → Task 1, Step 4, and the end of every task.

## Global Constraints

- Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes.
- `src/kit` stays Pixi-free (`src/iso/pixi-free.test.ts`); no `Math.random`; no hex outside `src/map/palette-iso.ts`.
- Code, comments, strings and identifiers in English (`src/english.test.ts`).
- `GRID.cap`, `GRID.xHeight`, `GRID.descender` and `GRID.space` do not change; no glyph is added. `GRID`, `KERN`, `GLYPHS`, `xHeightPx`, `sizeForXHeight` stay exported, and the last two do not change.
- The sign modules (`src/scenes/sign-helipad.ts`, `sign-graffiti.ts`, `sign-platform.ts`) keep their design. Only what the new spacing breaks gets adjusted (see Task 1).
- `SIGN_FONT` lives only in `src/kit/legibility.ts`. Nobody copies it.

## Decisions (technical assumptions)

- **Kerning table.** `KERN = { lo: -1, li: -1, io: -1, rt: -0.5, tf: -0.5 }`, in grid units. A prototype of the measurement with `gap` 2 at `SIGN_FONT` gives air 1.18 w on every stem pair, but 2.18 w on `l`·x and `i`·x (the 1-wide box leaves 1 u to the right of the stem), and 2.18 w on `r`·`t` and `t`·`f` (the flat ends of the arm and crossbars face each other). With this table, every pair of the three words falls in 1.18–1.68 w, and the rhythm is 1.43 (Portfolio), 1.00 (Resume) and 1.00 (Blog). The widths of `i` and `l` stay at 1, so the existing width test holds.
- **No polyline is redrawn.** The `s` needs no change: no rule probes it, and its air to its neighbors is 1.18 w.
- **Counter probes** (grid units): `o` (1.5, 2.5); `e` (1.5, 3.6), the upper eye between the crossbar at y 2.5 and the top; `P` and `R` (1.5, 5.5); `B` (1.5, 5.4) and (1.5, 1.9); `g` (1.5, 2.5); `m` (1.25, 2) and (3.75, 2); `u` (1.5, 3). Every other glyph gets `[]`.
- **What "the quads" are, for gaps.** `letterGaps` measures between each glyph's `fill` polygons (segment quads plus the joint squares), the outer contour that both renderings (stroke quads, filled letters) stay inside. A `quads`-only measure would ignore the corners of the joint squares, which can stick out of the stroke quads. For `"ll"` both give the same number.
- **Polygon distance.** For two convex polygons: 0 if any edge pair intersects or if one contains a vertex of the other; otherwise the minimum point-to-segment distance over the four endpoint/segment combinations of every edge pair. Pair distance = minimum over all (polygon of glyph i, polygon of glyph i+1).
- **Counter radius.** `r` = minimum distance from the probe (scaled to `size`, placed at the glyph's `left`) to every segment of that glyph's centerline polylines, minus `width / 2`. `counterClearance` = `2 · r`.
- **`layoutText` geometry.** Positions are in text space, in units of `size` (grid · `size / 7`). `left` is the left edge of the glyph's design box. `advance = (width + GRID.gap + (KERN[pair] ?? 0)) · size / 7`, with `pair` = this char + the next char. The kern is applied only when the next character is a glyph, and the gap is still added after the last glyph. A space advances `(GRID.space + GRID.gap) · k` and gets no entry. `box` is the ink extent of the polylines ± `width / 2`.
- **`advances(text, size)`**: one entry per glyph (spaces skipped), equal to `layout.advance` except the last, which is the glyph's width only. Invariant: their sum plus the space advances equals `measureText(text, size).width`.
- **`measureText`** = (Σ widths + `gap` · (n − 1) + Σ kerns of adjacent pairs) · `size / 7`, with spaces counting `GRID.space`. A kern applies only between two adjacent glyphs, never across a space. `strokeText` and `fillText` are built from `layoutText(...).quads` and `.fill`. Their order (glyph by glyph, polyline by polyline, the segment quads and then the joint squares) and their counts do not change.
- **Rule names** of `Violation.rule`: `strokeRatio`, `xHeightRatio`, `air`, `rhythm`, `counter`, `advance`, `overlap`. `limit` is a human string such as `"[1, 3]·w"`; `detail` carries the pair (`"Re"`) for `air` and the char for `counter` and `advance`.
- **The advance rule** reads `layoutText(...)[i].advance / size`, with the gap included (issue: "el avance incluye el gap"), for lowercase glyphs not in `FONT_RULES.advanceExempt`. Capitals are not checked.
- **Minimal sign adjustments** (measured with a prototype at `gap` 2 plus `KERN`):
  - `sign-platform.ts`: `POST_INSET` goes from 1 to 2. With 1, the posts leave the deck and the lower frame beam runs into the hut and the mast. With 2, all of `sign-platform.test.ts` passes again.
  - `sign-helipad.test.ts`: the literal `3.490` (`ROOF_WORD_SIZE`, the largest cap height that fits the triangle) becomes the new value the module computes. The geometric assertions of that test stay as they are.
  - Any other literal that the new spacing breaks gets its new value and nothing else.
- **Docs.** The `### Lettering` entry in `CONTEXT.md` changes "gap 1" to "gap 2" and names `KERN`, `layoutText` and the measurements, adding `src/kit/legibility.ts` (`SIGN_FONT`, `checkFont`) to its `Code:` line. A separate Legibility entry is left to #380, as the story plan says.

## Review Focus

- **Space between words.** `letterGaps("Blog Blog", …)` measures no pair across the space: 6 values, not 7. `layoutText` gives no entry for the space. Pinned in Task 2.
- **A kern across a space.** `KERN["o "]` does not exist, and `"l o"` must not apply `lo`. `measureText("l o", 7).width` = (1 + 2 + 3 + 2 + 3) · 1. Pinned in Task 1.
- **Degenerate input.** `rhythm` of a 1-glyph word or of `""` is 1; `letterGaps("")` and `layoutText("")` are `[]`; an unknown char throws, as before. Pinned in Tasks 1 and 2.
- **Huge width.** `overlapping("Resume", 7, 5)` is true and `letterGaps` gives 0 for those pairs, never a negative number. Pinned in Task 2.
- **Strokes and fill unchanged in count.** `strokeText` and `fillText` give the same number of quads as before for the three words (the existing count tests). Pinned in Task 1.

---

### Task 1: Spacing, kerning, counters and `layoutText`

**Files:**
- Modify: `src/kit/lettering.ts`
- Test: `src/kit/lettering.test.ts`
- Modify (only what the spacing breaks): `src/scenes/sign-platform.ts` (`POST_INSET` 2), `src/scenes/sign-helipad.test.ts` (literal `3.490`), and any other sign or exhibit literal that fails
- Modify: `CONTEXT.md` (`### Lettering`)

**Interfaces:**
- Produces: `GRID` (gap 2), `KERN: Readonly<Record<string, number>>`, `GLYPHS: Readonly<Record<string, { width: number; strokes: readonly Vec2[][]; counters: readonly Vec2[] }>>`, `interface GlyphLayout { char; left; advance; strokes: Vec2[][]; quads: Vec2[][]; fill: Vec2[][]; box: { x0; y0; x1; y1 }; counters: { at: Vec2; r: number }[] }`, `layoutText(text: string, size: number, width: number): GlyphLayout[]`, `advances(text: string, size: number): number[]`, `strokeRatio(size: number, width: number): number`.

- [ ] **Step 1: Failing tests** (written in stage 3):
  - `GRID` equals `{ cap: 7, xHeight: 5, descender: 2, gap: 2, space: 3 }`; `GRID.gap >= 2`;
  - `KERN` keys are 2-char strings over glyph letters, and its values are finite numbers in (−2, 0];
  - each glyph has `counters`, with the counts `o e P R g u` 1, `B m` 2 and the rest 0; every probe lies inside `[0, width] × [−2, 7]`;
  - `layoutText("Resume", 7, 1)` has 6 entries with chars in order, a strictly increasing `left`, and `advance = (width + 2 + (KERN[pair] ?? 0)) · 1`; `layoutText("Blog Blog", …)` has 8 entries; `layoutText("", 7, 1)` is `[]`;
  - `box` contains every point of `strokes` and is padded by `width / 2`;
  - `layoutText("o", 7, 1)[0].counters[0].r` is ≈ 1.0 (1.5 − 0.5);
  - `measureText("Blog", 7).width` = 3 + 1 + 3 + 3 + 3·2 + KERN.lo = 15; `measureText("l o", 7).width` = 11; scaling with `size / 7` still holds;
  - `advances("Blog", 7)` = [5, 2, 5, 3] (B 3 + 2, l 1 + 2 − 1, o 3 + 2, g 3), and its sum equals `measureText("Blog", 7).width`;
  - `strokeRatio(10.3, 1.35)` ≈ 7.63;
  - the existing count, coplanarity and thickness tests of `strokeText` and `fillText` stay green;
  - the old test "GRID: cap 7, x-height 5, descender 2, gap 1, space 3" is replaced. In "measureText(\"Blog\", 7): sum of widths + 3 gaps", `sum + 3` becomes `sum + 3·2 + KERN.lo`. In "space advances by GRID.space…", `2 * blog + 3 + 2` becomes `2 * blog + 3 + 2·GRID.gap`;
  - every counter probe sits inside its counter. For `o e P R B g`, the probe is inside the closed outline of its bowl (a ray-casting point-in-polygon test, written in the test file, over the bowl polyline, closed back to its first point). For `m` and `u`, the probe's x lies strictly between two stems and its y lies in (0, 5).
- [ ] **Step 2:** `npx vitest run src/kit/lettering.test.ts` → FAIL (gap 1, `layoutText` not exported).
- [ ] **Step 3:** Implement in `src/kit/lettering.ts`: `gap: 2`, `KERN` (see Decisions), `counters` on every glyph (the `glyph()` helper takes them), `GlyphLayout`, `layoutText`, `advances` and `strokeRatio`. `measureText`, `strokeText` and `fillText` are rebuilt on `layoutText`; `layout`/`quadsOf` go away if nothing else uses them.
- [ ] **Step 4:** Run `npx vitest run` (whole suite). Fix only literals that depended on gap 1 in `src/scenes/sign-*.test.ts` and `src/lab/exhibits.test.ts`, plus `POST_INSET = 2` in `sign-platform.ts`. Each change gets a one-line reason in the commit message.
- [ ] **Step 5:** Update `CONTEXT.md` `### Lettering` (gap 2, `KERN`, counters, `layoutText`); `npx vitest run src/docs-glossary.test.ts` passes.
- [ ] **Step 6:** `npm test && npm run typecheck` green; commit `feat(#375): font spacing gap 2, kerning, counters and layoutText`.

### Task 2: Gap, rhythm, counter and overlap measurements

**Files:**
- Modify: `src/kit/lettering.ts`
- Test: `src/kit/lettering.test.ts`

**Interfaces:**
- Consumes: `layoutText` (Task 1).
- Produces: `letterGaps(text, size, width): number[]`, `rhythm(text, size, width): number`, `counterClearance(text, size, width): { char: string; clearance: number }[]`, `overlapping(text, size, width): boolean`.

- [ ] **Step 1: Failing tests** (written in stage 3):
  - `letterGaps("Resume", s, w)` has 5 values; `letterGaps("Blog Blog", …)` has 6; `letterGaps("")` and `letterGaps("B")` are `[]`;
  - `letterGaps("ll", size, width)[0]` ≈ `(1 + GRID.gap + (KERN.ll ?? 0)) · size / 7 − width`, for at least sizes 7 and 10.3 and widths 0.5 and 1.35;
  - `rhythm("B", …)` = 1; `rhythm` = max / min of `letterGaps`;
  - `counterClearance("o", 7, 1)` = `[{ char: "o", clearance: ≈ 2 }]`; `counterClearance("Blog", …)` has 3 entries (B 2, o 1, g 1), and `"m"` has 2;
  - `overlapping("Resume", 7, 5)` is true, every gap is ≥ 0, and those pairs give exactly 0; `overlapping("Resume", 10.3, 1.35)` is false.
- [ ] **Step 2:** `npx vitest run src/kit/lettering.test.ts` → FAIL (not exported).
- [ ] **Step 3:** Implement with the polygon distance in Decisions. Private helpers: `segDist(p, a, b)`, `segmentsCross(a, b, c, d)`, `polygonDistance(A, B)`.
- [ ] **Step 4:** Tests pass; `npm run typecheck` green.
- [ ] **Step 5:** Commit `feat(#375): letterGaps, rhythm, counterClearance, overlapping`.

### Task 3: `src/kit/legibility.ts` and `checkFont`

**Files:**
- Create: `src/kit/legibility.ts`
- Test: `src/kit/legibility.test.ts`
- Modify: `CONTEXT.md` (`src/kit/legibility.ts` (`SIGN_FONT`, `checkFont`) appended to the Lettering `Code:` line)

**Interfaces:**
- Consumes: `GRID`, `layoutText`, `letterGaps`, `rhythm`, `counterClearance`, `strokeRatio`, `overlapping` (Tasks 1 and 2).
- Produces: `SIGN_FONT = { size: 10.3, width: 1.35 } as const`, `FONT_RULES = { strokeRatio: [6, 10], xHeightRatio: [0.68, 0.76], airW: [1, 3], rhythm: 1.8, counterW: 1, advanceC: [0.45, 0.80], advanceExempt: "ilm" } as const`, `interface Violation { rule: string; value: number; limit: string; detail?: string }`, `checkFont(text: string, size: number, width: number): Violation[]`.

- [ ] **Step 1: Failing tests** (written in stage 3), for each of `"Resume"`, `"Portfolio"` and `"Blog"` with `SIGN_FONT`:
  - `checkFont(word, 10.3, 1.35)` equals `[]`;
  - each rule on its own: `strokeRatio` in [6, 10]; `GRID.xHeight / GRID.cap` in [0.68, 0.76]; each gap in [1·w, 3·w]; `rhythm` ≤ 1.8; each `clearance` ≥ 1·w; each advance of a non-exempt lowercase glyph (`layoutText(...).advance / size`) in [0.45, 0.80]; `overlapping` false;
  - `xHeightPx(10.3, 1.17)` ≥ 12 and `xHeightPx(10.3, 0.83)` ≥ 8;
  - regression: `GRID.gap >= 2`, and with `width = 1.22 · 10.3 / 7`, `checkFont("Resume", 10.3, width)` contains a violation with `rule: "air"` and a `detail`;
  - a violation per broken rule that a size and width can break: `checkFont("Resume", 10.3, 3)` contains `strokeRatio`; `checkFont("Resume", 7, 5)` contains `overlap`; `checkFont("Portfolio", 10.3, 2.4)` contains `rhythm` (the prototype gives 5.4); `checkFont("o", 7, 3)` contains `counter` with `detail: "o"`. `xHeightRatio` and `advance` depend only on the grid (`GRID` and the glyph widths, not on `size` or `width`), so they cannot be broken from outside: they are asserted by value only (see Assumptions).
- [ ] **Step 2:** `npx vitest run src/kit/legibility.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `checkFont` as one pass per rule, in the order of the table, pushing a `Violation` per pair, glyph or word that breaks a rule. Keep the module pure: it imports only `./lettering`.
- [ ] **Step 4:** Update the Lettering `Code:` line in `CONTEXT.md`; `npm test && npm run typecheck` green.
- [ ] **Step 5:** Commit `feat(#375): legibility.ts with SIGN_FONT, FONT_RULES and checkFont`.

## Assumptions

Decided during the plan grilling (stage 2). Each one lists the alternative it rejected.

- **Kerning table** `{ lo, li, io: -1; rt, tf: -0.5 }` instead of changing the widths of `i` and `l`. The issue allows either; kerning keeps the existing width test. For `l`·`o`, the kern of −1 brings `o`'s left side to 2 grid units from `l`'s stem: 2k − w = 1.18 w.
- **Values from a prototype** (`.scratch/proto.ts`, not committed). The tests in Tasks 2 and 3 are what pins them.
- **`letterGaps` measures over the `fill` polygons**, not over the stroke quads alone. The fill is the outer contour of both renderings. The polygons are all convex: rectangles from non-zero-length segments (the existing "no zero-length segment" test) and axis-aligned squares.
- **`POST_INSET` from 1 to 2 in `sign-platform.ts`.** The issue allows "lo mínimo que el nuevo espaciado rompa". With gap 2 the posts left the deck and the lower beam ran into the hut and the mast. Moving the posts inward is the smallest change that keeps the design (word, colour, two-beam frame on two posts). The alternative of moving the hut or the mast changes more geometry. If a geometric assertion (not a literal) in a sign test fails, the same rule applies: the smallest constant in that sign module that restores it, recorded in the commit.
- **`KERN` values in (−2, 0]**: a kern at or below −`GRID.gap` would let two boxes touch. This is a sanity bound for the test, not a rule from the spec.
- **Rule names** of `Violation.rule` (`strokeRatio`, `xHeightRatio`, `air`, `rhythm`, `counter`, `advance`, `overlap`): only `air` is fixed by the issue. The rest follow the keys of `FONT_RULES`.
- **`xHeightRatio` and `advance` are not exercised as violations**: no `size` or `width` can break them with the current glyphs. They are asserted by value, as the issue asks ("cada regla afirmada por separado").
- **The last glyph's `advance`** in `layoutText` includes the gap: the issue says "advance = ancho + gap + kern con el siguiente", and `FONT_RULES` says "el avance incluye el gap". `advances()` drops it for the last glyph, as the issue says.

## Grilling

- Rounds: 1 (griller model: fable). Questions: 18.
- Sources: ISSUE 9, CODE 7, DOC 1, NO SOURCE → technical assumption 6 (some questions cite more than one source).
- The answers changed the plan without changing its seams, so there is no second round. Added: the criteria → tasks map; violation tests for `rhythm` and `counter`; a test that each probe sits inside its counter; the exact literals of the old `measureText` tests; this Assumptions section.
- Spec ambiguities: none. Out of scope: none. No issues opened.
