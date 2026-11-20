# Ground-sign class in the legibility oracle (#452) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The level-2 oracle (`checkSign`) can audit a sign painted on a real horizontal plane: a `groundDiagonal` plane, a `ground` sign class whose expected aspect is `GROUND_ASPECT` (0.5), a separate horizontal-bar thickness `bar`, and paint as a `decal` material whose contrast is measured against the coplanar face that receives it.

**Architecture:** Three files in `src/kit/` change. `lettering.ts` gains a plane constructor. `marquee.ts` gains one constant. `legibility.ts` gains three optional `SignSpec` fields (`ground`, `bar`, `decal`), `color` becomes optional, `signSpec` checks that exactly one of `color`/`decal` is given, `signMetrics` reads `ground`/`bar`, and `contrastOf` gets a decal branch. Signs that do not set the new fields measure exactly as today.

**Tech Stack:** TypeScript, Vitest (node).

**Spec:** issue #452 (sections "Decisiones heredadas", "Qué hacer" and "Criterios de aceptación" are binding); story #451, plan comment, decision D1/D2.

## Global Constraints

- The `SIGN_RULES` floors and every other `SIGN_RULES` value stay unchanged.
- `groundDiagonal(at: Vec3): TextPlane` = `{ origin: at, u: (√½, −√½, 0), v: (−√½, −√½, 0) }`. `roofDiagonal` stays, untouched.
- `GROUND_ASPECT = Math.SQRT1_2 / Math.SQRT2` (0.5), exported from `legibility.ts`.
- `CHAINSAW_BAR = 0.15`, exported from `marquee.ts` next to `CHAINSAW_FACE`, with a JSDoc: the thickness of the thinnest horizontal bar (the arms of the G; the bar of the T measures 0.173), in cap heights.
- `SignSpec`: `color?: AccentColor`, `decal?: Material`, `ground?: true`, `bar?: number` (text units). `signSpec(o)` throws `Error` unless exactly one of `color`/`decal` is given.
- `backingMargin` and `occlusionRatio` do not change.
- The tests of `sign-crown`, `sign-tinker`, `sign-platform` and `src/lab/signs.test.ts` are not modified, and they pass.
- Code, comments and test names are in English (`src/english.test.ts`).
- `npm test` and `npm run typecheck` are green.

## Review Focus

- A `color` sign (every existing sign) after the refactor: its contrast still goes through the "nearest face behind the glyph centre" path, unchanged. Pinned by the untouched `sign-*` and `src/lab/signs.test.ts` tests (Task 4, Step 4), and by an extra test in Task 3: a `color` spec gives the same `staticContrast` as before.
- `bar` given without `stroke` (stroke-font sign): `bar` is ignored, and the stroke is the quads' shortest side as today (assumption 2). Test in Task 4.
- A decal face whose centroid falls on a receiver of the *same* material (two `officeDark` solids): it is not a receiver, so the value is 1. Covered by the "no receiver" test (Task 3), since only faces of another material count.
- Several coplanar receivers contain the centroid: the one with the largest projected area wins. Test in Task 3 (a small `whitewash` triangle and a large `foam`-or-other-material triangle; the larger one decides).
- A receiver that is parallel but not coplanar (the sheet under the planks, at z −0.5) is never the receiver. Pinned by the tracer test (Task 4), where the z −0.5 sheet sits under the decal.

## Acceptance criteria → where

1. «`groundDiagonal`, `GROUND_ASPECT` (0.5), `SignSpec.ground`, `SignSpec.bar`, `SignSpec.decal`, `color` opcional y `CHAINSAW_BAR` (0.15) existen con los tests de arriba» → Tasks 1–4.
2. «`checkSign` de un cartel de suelo en Chainsaw Carnage a caja alta 20 … pasa a 1.17 y 0.83 …; a caja 17 falla `xHeight`» → Task 4, tracer tests.
3. «El contraste de decal se mide decal contra cara receptora coplanar (test con `ground` tris)» → Task 3.
4. «`npm test` y `npm run typecheck` en verde; ningún cartel existente cambia de medidas» → Task 4, Step 4.

## Assumptions

1. **Tracer-test fixture tone (contrast).** The issue's tracer has `officeDark` paint on a `whitewash` receiver and expects `checkSign(…, 1.17, [])` to give `[]`. But `contrastRatio(officeDark.top, whitewash.top)` is 3.30, below the 4.5 floor at 1.17. (Measured on the base branch: `top/top` 3.30, `dim/top` 4.83, `top/pale` 4.39, `top/glow` 4.69.) The floors are not loosened (inherited decision), and the materials stay the ones the issue names. So the word's triangles in the tracer carry `toneOffset: −2` (`officeDark` `dim`, 4.83:1). The test is about size ("bala trazadora del tamaño"); the real paint's contrast (`navy` on `timber`, ≥ 7:1) belongs to #454. Rejected: changing the receiver material (the issue names `whitewash`); expecting `[contrast]` at 1.17 (the criterion says it passes).
2. **`bar` without `stroke`.** `bar` only changes the `stroke !== undefined` branch of `strokePx`. A stroke-font sign (no `stroke`) ignores it. Rejected: making `signSpec` throw (nothing asks for it).
3. **`signSpec` output.** `color`, `decal`, `ground` and `bar` are copied onto the spec only when given (the same `...(x === undefined ? {} : { x })` idiom as `xHeight`/`stroke`), so existing specs stay deep-equal to what they were.
4. **The decal path ignores glyphs.** With `decal`, the contrast is computed from `spec.backing` alone, as the issue's algorithm says. A spec with no glyphs still gets that value, not `Infinity`.
5. **Width of the tracer spec.** `width: SIGN_FONT.width` (1.35), as `sign-platform.ts` uses for `WRITING`. The backing margin (1·width) then fits inside the sheet's +3 u.
6. **`CONTEXT.md`.** The Lettering and Legibility entries name `groundDiagonal` and the ground class (`ground`, `bar`, `decal`, `GROUND_ASPECT`) in a sentence each, so the glossary describes the present. The broader closing of the docs is #457's.

---

### Task 1: `groundDiagonal` in `lettering.ts`

**Files:**
- Modify: `src/kit/lettering.ts` (next to `roofDiagonal`, line 18)
- Test: `src/kit/lettering.test.ts`

**Interfaces:**
- Produces: `export function groundDiagonal(at: Vec3): TextPlane`.

- [ ] **Step 1: Write the failing test** `it("groundDiagonal: a real horizontal plane, u to screen (√2, 0), v to screen (0, −√½)")`: `p = groundDiagonal(v3(3, 4, 0.5))`, `o = project(p.origin)`; `project(toWorld(p, 1, 0)) − o` ≈ (√2, 0) and `project(toWorld(p, 0, 1)) − o` ≈ (0, −√½), each within 1e-9 (`toBeCloseTo(…, 9)`); `dot(p.u, p.v) === 0` (≈ 1e-12); `p.u.z === 0`, `p.v.z === 0`; `p.origin` equals `v3(3, 4, 0.5)`.
- [ ] **Step 2:** `npx vitest run src/kit/lettering.test.ts` → FAIL (not exported).
- [ ] **Step 3:** Implement it with a one-line JSDoc: a real horizontal plane, unstretched (compare `roofDiagonal`); the word projects at half its flat aspect.
- [ ] **Step 4:** The same command → PASS.
- [ ] **Step 5:** Commit `feat(#452): groundDiagonal`.

### Task 2: `CHAINSAW_BAR` in `marquee.ts`

**Files:**
- Modify: `src/kit/marquee.ts` (next to `CHAINSAW_FACE`)
- Test: `src/kit/chainsaw-writing.test.ts`

**Interfaces:**
- Produces: `export const CHAINSAW_BAR = 0.15` (cap heights).

- [ ] **Step 1: Write the failing test** `it("CHAINSAW_BAR is the thinnest horizontal bar: the median vertical ink run of the T and the G at 300 px per cap")`. A helper in the test, `columnRunMedian(g: GlyphLayout, px = 300): number`: for each pixel column i from `floor(box.x0·px)` to `ceil(box.x1·px)`, walk the rows j from `floor(box.y0·px) − 1` to `ceil(box.y1·px) + 1`. A pixel is ink when its centre `((i + .5)/px, (j + .5)/px)` lies in some triangle of `g.fill` (`pointInPolygon` from `src/map/geo`). Collect the lengths, in cap heights, of the runs of consecutive ink pixels longer than 0.03, and return their median (the mean of the two middle values for an even count). On `marqueeLayout(1, 0, CHAINSAW_WRITING)` take the glyphs `T` and `G`: `m = min(T, G)`. Expect `CHAINSAW_BAR` ≥ `m − 0.03` and ≤ `m + 0.005`, and `CHAINSAW_BAR` toBe `0.15`. Measured on the base branch: T 0.173, G 0.150 (≈ 0.1 s).
- [ ] **Step 2:** `npx vitest run src/kit/chainsaw-writing.test.ts` → FAIL.
- [ ] **Step 3:** Add the constant with the JSDoc from Global Constraints. It says how it was measured (median of the vertical ink runs, columns, > 0.03 cap, at 300 px per cap: G 0.150, T 0.173, R 0.193, N 0.217, W 0.260), and that the horizontal runs (rows) give `CHAINSAW_FACE`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat(#452): CHAINSAW_BAR`.

### Task 3: `color?` / `decal` and the decal contrast

**Files:**
- Modify: `src/kit/legibility.ts` (`SignSpec`, `signSpec`, `contrastOf`, the `SignSpec` and `staticContrast` docstrings)
- Test: `src/kit/legibility.test.ts`

**Interfaces:**
- Consumes: `groundDiagonal` (Task 1).
- Produces: `SignSpec.color?: AccentColor`, `SignSpec.decal?: Material`; `signSpec(o)` accepts `color?` and `decal?` (exactly one). `staticContrast(spec)` and `checkSign` use the decal rule when `spec.decal` is set.

- [ ] **Step 1: Write the failing tests**, in a `describe("decal signs (#452)")`. Fixture helper `groundSolid(mat, tris: Vec3[][], toneOffset?)` → `{ kind: "ground", mat, tris: tris.map(pts => ({ pts, toneOffset })) }`. All triangles are at z = Z (e.g. 0.3), and the plane is `groundDiagonal(v3(0, 0, Z))`. The spec is built with `signSpec` and the text "Blog" from `layoutText` (`style: "stroke"`).
  - «signSpec throws with neither color nor decal, and with both»: `expect(() => signSpec({ …, no color/decal })).toThrow()`; the same with `color: "cyan", decal: "officeDark"`.
  - «a decal spec carries decal and no color»: `spec.decal === "officeDark"`, `"color" in spec === false`.
  - «decal contrast is decal against the coplanar receiving face»: backing `[whitewash big triangle (e.g. (−50,−50,Z),(50,−50,Z),(0,60,Z)), officeDark small triangle inside it (e.g. (−1,0,Z),(1,0,Z),(0,1,Z))]`, `decal: "officeDark"` → `staticContrast(spec)` ≈ `contrastRatio(ISO_TONES.officeDark.top, ISO_TONES.whitewash.top)` (`toBeCloseTo(…, 9)`).
  - «with toneOffset 1 on both triangles the up tones decide»: the same, both solids built with `toneOffset: 1` → `contrastRatio(ISO_TONES.officeDark.up, ISO_TONES.whitewash.up)`.
  - «a decal with no receiver gives 1»: the `officeDark` triangle moved outside the `whitewash` one (projected), e.g. offset by +200 in x → `staticContrast` = 1.
  - «a decal spec with no decal face in the backing gives 1»: only the `whitewash` solid → 1.
  - «a receiver that is not coplanar is not the receiver»: the `whitewash` triangle at Z − 0.5 (the same x, y) → 1.
  - «of several receivers the largest projected area decides»: a `whitewash` triangle of medium size and a larger `foam` triangle, both coplanar and both containing the decal centroid → the `foam` contrast (`contrastRatio(officeDark.top, foam.top)`).
  - «checkSign uses the decal contrast»: with the 3.30 pair at 1.17, `checkSign(spec, 1.17, [])` contains `{ rule: "contrast" }`, and its `value` ≈ the ratio above.
  - «a color spec still measures against the nearest face behind the glyph»: a `diagonalWall`-type existing case. The test asserts that `staticContrast` on a `color: "cyan"` spec over an `officeDark` poly behind it equals `contrastRatio(ISO_COLORS.cyan, toneColor("officeDark", <tone of that face>))`. If the file already has this test, reuse it and do not add a duplicate.
- [ ] **Step 2:** `npx vitest run src/kit/legibility.test.ts` → the new tests FAIL.
- [ ] **Step 3: Implement.** `SignSpec` and `signSpec`'s options get `color?: AccentColor; decal?: Material` (import `Material`). In `signSpec`, `if ((o.color === undefined) === (o.decal === undefined)) throw new Error("legibility: a sign needs exactly one of color and decal")`, then copy whichever is given (assumption 3). `contrastOf(spec, back)`: if `spec.decal`, return `decalContrast(spec.decal, back)`. Otherwise use today's body with `ISO_COLORS[spec.color!]`. `decalContrast` follows the issue's algorithm:
  - for each `c` in `back` with `c.face.mat === decal`:
    - its colour is `toneColor(decal, stepTone(tone, toneOffset))`;
    - its centroid is the mean of `face.pts`;
    - the receivers are the covers of another material where `pointInPolygon(project(centroid), c.poly)` holds and `|depth(face, centroid)| ≤ 1e-6`;
    - pick the receiver with the largest shoelace area of `poly`; with none, the value is 1;
  - the result is the min over those values, or 1 with no decal face.

  JSDoc on `staticContrast`: one sentence per path.
- [ ] **Step 4:** → PASS. `npm run typecheck` → no errors (every `spec.color` read now sees `AccentColor | undefined`; only `contrastOf` reads it).
- [ ] **Step 5:** Commit `feat(#452): decal signs, contrast against the coplanar receiving face`.

### Task 4: `ground`, `GROUND_ASPECT`, `bar` in `signMetrics`, and the size tracer

**Files:**
- Modify: `src/kit/legibility.ts` (`SignSpec`, `signSpec` options, `signMetrics`, `GROUND_ASPECT`)
- Modify: `CONTEXT.md` (Lettering and Legibility, one sentence each, assumption 6)
- Test: `src/kit/legibility.test.ts`

**Interfaces:**
- Consumes: `groundDiagonal` (Task 1), `CHAINSAW_BAR` (Task 2), `decal` (Task 3).
- Produces: `export const GROUND_ASPECT = Math.SQRT1_2 / Math.SQRT2`; `SignSpec.ground?: true`, `SignSpec.bar?: number`, and the matching `signSpec` options.

- [ ] **Step 1: Write the failing tests**, `describe("ground signs (#452)")`, plane `groundDiagonal(v3(0, 0, 0))`:
  - «GROUND_ASPECT is 0.5»: `toBeCloseTo(0.5, 12)`.
  - «a ground spec on groundDiagonal: aspect error 0, baseline 0°, vertical 0°; the same spec without ground: aspect error 0.5»: "Blog" with `layoutText` (`style: "stroke"`, `color: "cyan"`), `ground: true` → `aspectError` < 1e-9, `baselineDeg` < 1e-9, `verticalDeg` < 1e-9; without `ground` → `aspectError` ≈ 0.5 (`toBeCloseTo(0.5, 6)`).
  - «x-height of a ground spec at scale s is signXHeight·√½·s»: for s in {1.17, 0.83}, `signMetrics(spec, s).xHeightPx` ≈ `signXHeight(spec) * Math.SQRT1_2 * s` (1e-9).
  - «with bar the stroke is min(stroke·√2, bar·√½)·scale; without bar, stroke·√½·scale»: a fill spec (`marqueeLayout(20, 0, CHAINSAW_WRITING)`, `stroke: 2.4`): with `bar: 3` → `min(2.4·√2, 3·√½)·1.17`; with `bar: 5` → `min(2.4·√2, 5·√½)·1.17`, the u side; without `bar` → `2.4·√½·1.17`.
  - «bar is ignored without stroke»: "Blog" stroke-font spec, `bar: 100` → `strokePx` equals the same spec's value without `bar`.
  - «tracer: a Chainsaw Carnage ground sign at cap 20 on a flat backing passes at 1.17 and 0.83». Spec: `id: "ground"`, `text: "WRITING"`, `size: 20`, `width: SIGN_FONT.width`, `decal: "officeDark"`, `plane`, `style: "fill"`, `ground: true`, `layouts: marqueeLayout(20, 0, CHAINSAW_WRITING)`, `xHeight: CHAINSAW_X·20`, `stroke: CHAINSAW_FACE·20`, `bar: CHAINSAW_BAR·20`. The backing is three `kind: "ground"` solids. Let the ink box (union of `box`) grown by 3 u in text space be the rectangle a0..a1 × b0..b1, taken to the world as two triangles with `toWorld`:
    - (i) that rectangle in `whitewash` at z −0.5 (the points shifted in z);
    - (ii) the same two triangles in `whitewash` at z 0;
    - (iii) every `fill` triangle of the layouts taken to the world in `officeDark`, `toneOffset: −2` (assumption 1).

    Expect `checkSign(spec, 1.17, [])` toEqual `[]` and `checkSign(spec, 0.83, [])` toEqual `[]`.
  - «tracer: the same sign at cap 17 fails xHeight at 1.17»: `size`, `layouts`, `xHeight`, `stroke` and `bar` at 17, with the backing rebuilt the same way → `checkSign(spec, 1.17, []).map(v => v.rule)` toEqual `["xHeight"]` (measured: 10.83 px < 12).
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3: Implement.** Copy `ground`/`bar` in `signSpec` when given. In `signMetrics`:
  - `strokePx` in the `stroke` branch is `min(len(g, stroke, 0), len(g, 0, bar ?? stroke))`;
  - `aspectError` divides the projected-to-flat ratio by `spec.ground ? GROUND_ASPECT : 1` before subtracting 1.

  Update the `SignSpec` and `signMetrics` JSDocs: `ground` is a sign painted on a horizontal plane, whose expected aspect is `GROUND_ASPECT`; `bar` is the thickness of the horizontal strokes, measured along v. Then the two `CONTEXT.md` sentences.
- [ ] **Step 4:** `npx vitest run src/kit` → PASS. Then `npm test` and `npm run typecheck` → green. `git diff --stat` shows no changes to `src/scenes/sign-*.test.ts` or `src/lab/signs.test.ts`.
- [ ] **Step 5:** Commit `feat(#452): ground signs, GROUND_ASPECT and bar in signMetrics`.
