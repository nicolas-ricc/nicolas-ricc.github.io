# Signs: common base (#360) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the shared base of the three zone signs (lettering module, green triad, `poly` plate, storybook cover-scale key `c`) and show it in the storybook through four placeholder exhibits whose scene modules the sign children replace later.

**Architecture:** A new Pixi-free module, `src/kit/lettering.ts`, holds the text planes, a stroke font on a 7-unit grid, and the stroke and fill generators. `Plate` becomes a union `PlateBox | PlatePoly`, and a `shiftPlateZ` helper is the only place that moves plate heights. The storybook gains a pure `cover-scale.ts` module and a `c` key. Three scene modules (`src/scenes/sign-*.ts`) build placeholder geometry with these pieces and are registered as four `piece` exhibits.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`), Vite dev server for the lab.

**Spec:** issue #360 (body, "Qué hacer" and "Criterios de aceptación"). Story context: #352, the planner comment of 2026-11-14 and `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md`. Where they differ, the issue wins.

## Global Constraints

- Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes. `git diff --stat origin/feature/352-carteles-zona -- src/world src/main.ts index.html src/style.css` must stay empty. Importing types *from* `src/world/frame.ts` is fine.
- `src/iso`, `src/scenes` and `src/kit` stay Pixi-free (`src/iso/pixi-free.test.ts`). `lettering.ts` imports only `src/iso/geometry` and `src/iso/project`.
- No hex colors outside `src/map/palette-iso.ts` (`palette-guard.test.ts`). No `Math.random`.
- Code, comments, strings and identifiers in English (`src/english.test.ts`). Exhibit ids stay Spanish: `cartel-helipuerto`, `cartel-helipuerto-b`, `grafiti`, `plataforma`.
- Names, signatures, values, ids, titles, groups and pads exactly as the issue writes them: the sign children (#361–#363) depend on them.
- The existing `solids.test.ts` snapshot does not change.

## Decisions (technical assumptions)

- **Stroke width lives in text space.** `strokeText` and `fillText` thicken each segment in (a, b) text coordinates, perpendicular to the segment, and `strokeText` then maps the corners through `toWorld`. On `diagonalWall` and `facade` (unit u and v) that equals world units. On `roofDiagonal` the thickness is stretched along v exactly like the glyphs, which is the point of the anamorphosis: on screen it matches `diagonalWall`.
- **Quad corners.** For a segment p→q with unit direction t and normal n = (−t.y, t.x), the corners in order are p + n·w/2, q + n·w/2, q − n·w/2, p − n·w/2.
- **Vertex squares** in `fillText` are axis-aligned in text space and centered on each interior vertex of a polyline (never on the endpoints), with side `width`. Output order: for each glyph, for each polyline, its segment quads, then its interior-vertex squares.
- **Space.** `" "` is accepted without a `GLYPHS` entry. It advances by `GRID.space` (3) and draws nothing. Separations work as for any glyph: `gap` between every pair of adjacent characters, none after the last one. Any other character missing from `GLYPHS` throws.
- **Measure.** `measureText(text, size)`: `width = (Σ widths + gap·(n − 1)) · size/7` (0 for `""`), `capHeight = size`, `xHeight = 5·size/7`, `descender = 2·size/7`.
- **Glyph design** is free within the grid rules of the issue. Use polylines (4–8 vertices for the curves of `o e s g P R B`), no zero-length segments, and the `i` dot as its own polyline in y 6..6.6.
- **Placeholders are centered.** `helipadSign` centers the word's (width × capHeight) text rectangle on the slab center. `helipadTubeSign` and `seaPlatform` center the word's width on the origin of their plane (baseline at the stated z). The placeholders are not supposed to fit their bases: children #361–#363 replace them.
- **Platform piles** stand at x ∈ {−6.5, 0, 6.5}, y ∈ {−5.5, 5.5}, `at.z = −1`, `h = 2.2`. The deck is `prism` at (−7, −6, 1.2), 14 × 12 × 0.4.
- **Graffiti wall** with L = `measureText("Portfolio", 8.55).width + 5` and t = 1.2 (both from the issue), at c = (0, 0), d = (1, −1)/√2, n = (1, 1)/√2, footprint `[D, C, B, A]` with D = c − d·L/2 + n·t/2, C = c + d·L/2 + n·t/2, B = c + d·L/2 − n·t/2, A = c − d·L/2 − n·t/2, `z: 0`, `h: 11.5`.
- **`ribs` and `door`** return `PlateBox` / `PlateBox[]`. Every function that reads `u0/u1/z0/z1` takes `PlateBox` (`plateWindows` in `reconversion.ts`). `publishGlass` skips `poly` plates. Test helpers that build rect plates use `PlateBox`.
- **Cover-scale log:** `[storybook] cover scale: ${coverScale ?? "real"}` (prints `real`, `1.17`, `0.83`).

## Review Focus

- **Space and empty text.** `measureText("")` gives width 0, and `strokeText("", …)` / `fillText("", …)` give `[]`. `measureText("Blog Blog", 7).width` = 2·Σ widths(Blog) + 3 (space) + 8 (gaps). Pinned in Task 1.
- **No NaN from degenerate segments.** Every point of every quad of "Portfolio", "Resume" and "Blog" is finite. Pinned in Task 1.
- **shiftPlateZ purity.** It does not mutate its input, for either shape. Pinned in Task 3.
- **Ctrl/Cmd+C and held keys.** `c` with a modifier is the browser's copy and must not cycle; a held `c` (`repeat`) must not cycle. Covered by the existing early return in the listener plus `!ev.repeat`. Verified in the browser script (stage 3).
- **Mode survives navigation and resize.** After `c`, changing exhibit or resizing keeps the fixed scale. Verified in the browser script (stage 3) by reading `stage.container.scale` through the PixiJS DevTools wrapper.

---

### Task 1: Lettering module

**Files:**
- Create: `src/kit/lettering.ts`
- Test: `src/kit/lettering.test.ts`
- Modify: `CONTEXT.md` (append `### Lettering`), `README.md` (the kit paragraph, around line 91, gets one sentence naming `src/kit/lettering.ts`)
- Test: `src/docs-glossary.test.ts` (Lettering: defined, and its `Code:` refs exist and name identifiers). Add a `SIGN_TERMS = ["Sign", "Lettering"]` loop that reuses `section`/`codeRefs`/`hasIdent`; `KIT_TERMS` and its order test are not touched

**Interfaces:**
- Produces: `TextPlane { origin: Vec3; u: Vec3; v: Vec3 }`, `toWorld(plane, a, b): Vec3`, `diagonalWall(at: Vec3): TextPlane`, `roofDiagonal(at: Vec3): TextPlane`, `facade(a: Vec2, b: Vec2, z0: number): TextPlane`, `GRID`, `GLYPHS: Readonly<Record<string, { width: number; strokes: readonly Vec2[][] }>>`, `measureText(text, size): { width; capHeight; xHeight; descender }`, `strokeText(text, plane, size, width): Vec3[][]`, `fillText(text, size, width): Vec2[][]`, `xHeightPx(size, scale): number`, `sizeForXHeight(px, scale): number`.

- [ ] **Step 1: Failing tests** (written in stage 3, in `lettering.test.ts`):
  - every letter of "Portfolio", "Resume" and "Blog" has a glyph, the glyph set is exactly the 15 letters `P o r t f l i R e s u m B g`, every polyline has ≥ 2 points, and all points lie in `[0, width] × [−2, 7]`;
  - `GRID` equals `{ cap: 7, xHeight: 5, descender: 2, gap: 1, space: 3 }`; widths are 3, except `m` 5 and `i`/`l` 1;
  - on `diagonalWall(v3(0,0,0))`, a span of a 0..w projects with Δy' = 0 (±1e-9) and length √2·w, and b 0..1 projects vertically (Δx' = 0) with length 1.4;
  - the projected unit square on `roofDiagonal` has the same aspect ratio as on `diagonalWall` (within 2 %); `roofDiagonal(at).v` equals (−Z_SCALE, −Z_SCALE, 0);
  - `facade({x:0,y:0},{x:5,y:0},2)` gives u = (1, 0, 0), v = (0, 0, 1), origin (0, 0, 2);
  - `strokeText` returns as many quads as the glyphs have segments; each quad has 4 points coplanar with the plane (|(p − origin)·(u × v)| < 1e-9);
  - `fillText` returns segments + interior vertices;
  - `measureText("Blog", 7).width` = Σ widths of B, l, o, g + 3; `capHeight`, `xHeight`, `descender` as in Decisions;
  - `xHeightPx(sizeForXHeight(10, 1.17), 1.17)` ≈ 10, and `sizeForXHeight(10, 1.17)` ≈ 8.55 (2 decimals);
  - an unknown character (`"x"`) throws; the Review Focus cases (space, empty, finite).
- [ ] **Step 2:** `npx vitest run src/kit/lettering.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/kit/lettering.ts` per the issue and the Decisions above. `diagonalWall`: u = (1, −1, 0)/√2, v = (0, 0, 1). `roofDiagonal`: same u, v = (−Z_SCALE, −Z_SCALE, 0). `xHeightPx(size, scale) = size·5/7·Z_SCALE·scale`.
- [ ] **Step 4:** Add `### Lettering` at the end of `CONTEXT.md`: text planes, stroke font and fill of `src/kit/lettering.ts`, with a `Code:` line naming `src/kit/lettering.ts` (`TextPlane`, `diagonalWall`, `roofDiagonal`, `facade`, `strokeText`, `fillText`, `measureText`, `GLYPHS`). Add the README kit sentence.
- [ ] **Step 5:** `npx vitest run src/kit/lettering.test.ts src/docs-glossary.test.ts src/english.test.ts` → PASS; `npm run typecheck` → clean.
- [ ] **Step 6:** Commit `feat(#360): lettering module`.

### Task 2: Green triad and neon alpha

**Files:**
- Modify: `src/map/palette-iso.ts` (`ISO_COLORS`, `ACCENT_COLORS`), `src/kit/props.ts` (`neon`)
- Test: `src/map/palette-iso.test.ts`, `src/kit/props.test.ts`

**Interfaces:**
- Produces: `AccentColor` includes `"green" | "greenMid" | "greenBleed"`; `neon(pts: Vec3[], color: "amber" | "cyan" | "magenta" | "green", alpha = 1): Accent[]`.

- [ ] **Step 1: Failing tests.** In `palette-iso.test.ts`, the `ACCENT_COLORS` list has fifteen entries with `green, greenMid, greenBleed` after `magentaBleed`; `ISO_COLORS.green === 0x8ec07c`, `greenMid === 0x5a8c3e`, `greenBleed === 0x263d1d`; the triad loop includes `"green"`; the title becomes "the fifteen accents" where the twelve were named. In `props.test.ts`, `neon(front, "green", 0.5)` gives `[halo greenBleed alpha 0.3, tube green alpha 0.5]`, and `neon(front, "cyan")` keeps alphas 0.6 / 1.
- [ ] **Step 2:** Run both test files → FAIL.
- [ ] **Step 3:** Add the three colors and the list entries; give `neon` an `alpha = 1` parameter that scales the halo (0.6·alpha) and the tube (1·alpha). Keep the order. `palette-base.ts` and `scripts/darken-palette.ts` stay untouched.
- [ ] **Step 4:** Run both files plus `src/palette-guard.test.ts` (wherever it lives) → PASS; typecheck clean.
- [ ] **Step 5:** Commit `feat(#360): green accent triad and neon alpha`.

### Task 3: `poly` plate

**Files:**
- Modify: `src/iso/plate.ts`, `src/iso/solids.ts` (re-export `PlateBox`, `PlatePoly`), `src/kit/piece.ts:65`, `src/kit/forms/reconversion.ts` (`plateWindows` takes `PlateBox`; `publishGlass` skips `poly`), `src/kit/forms/industrial.ts` (`door` returns `PlateBox`), plus the test helpers that build rect plates through `Partial<Plate>` (`src/iso/solids.test.ts:1295`, `:1399`) and read `u0` off `ribs` (`src/iso/plate.test.ts`). A grep of `.u0`/`z0`/`: Plate` shows that the only non-test readers of box fields are `piece.ts:65` and `reconversion.ts:24-32`. `src/scenes/station.ts:150` reads `plateOutline`, which already works for `poly`. Every other file only builds `rect`/`disc` literals, which a union accepts
- Test: `src/iso/plate.test.ts`, `src/iso/solids.test.ts`, `src/kit/piece.test.ts`

**Interfaces:**
- Produces: `PlateBox` (today's fields, `shape: "rect" | "disc" | "tri"`), `PlatePoly { wall: number; shape: "poly"; pts: Vec2[]; mat: Material; toneOffset?: number }`, `Plate = PlateBox | PlatePoly`, `shiftPlateZ(p: Plate, z: (z: number) => number): Plate`, and `ribs(...)`, which returns `PlateBox[]`.

- [ ] **Step 1: Failing tests.**
  - `plate.test.ts`: `plateOutline` of a `poly` returns its `pts` (deep-equal, same order); `shiftPlateZ` with `z => z + 2` moves `z0/z1` of a rect, and the `y` of every `pts` of a poly, leaving `x`, `wall`, `mat` and `toneOffset` alone; neither input is mutated.
  - `solids.test.ts`: on the existing prism `P`, a triangular `poly` plate on wall 2 with pts (0.2, 1), (0.8, 1), (0.5, 3) yields one face whose 3 points equal `at(u, z)` on the south edge, with the south wall's normal and `mat`. On a `poly` solid with the 45°-rotated rectangular footprint `[D, C, B, A]` (L 10, t 1.2, h 5), a `poly` plate on `wall: 0` lands on the face of normal ≈ (1, 1, 0)/√2, and its first point (u 0) projects to a smaller x' than its last (u 1).
  - `piece.test.ts`: `liftPiece` shifts the `y` of the `pts` of a `poly` plate by `dz`.
- [ ] **Step 2:** Run the three files → FAIL (types and behavior).
- [ ] **Step 3:** Implement the union, `plateOutline`'s `poly` case and `shiftPlateZ`. Replace the hand-written map at `piece.ts:65` with `shiftPlateZ(q, z)`. Narrow the box readers. `plateFaces` does not change.
- [ ] **Step 4:** `npm test` → all PASS, snapshot unchanged; `npm run typecheck` → clean.
- [ ] **Step 5:** Commit `feat(#360): poly plate and shiftPlateZ`.

### Task 4: Cover-scale key `c`

**Files:**
- Create: `src/lab/cover-scale.ts`
- Test: `src/lab/cover-scale.test.ts`
- Modify: `src/lab/storybook.ts`, `lab/storybook.html`, `src/lab/host-keyboard.test.ts` (`SHORTCUTS.storybook`), `README.md` (storybook paragraph)
- Test: `src/lab/docs.test.ts` (the storybook-keys list adds "`c`")

**Interfaces:**
- Consumes: `type Fit` from `src/world/frame.ts`.
- Produces: `COVER_SCALES = [1.17, 0.83] as const`, `nextCoverScale(current: number | null): number | null`, `fixedScaleFit(fit: Fit, w: number, h: number, scale: number): Fit`.

- [ ] **Step 1: Failing tests.**
  - `cover-scale.test.ts`: `COVER_SCALES` equals [1.17, 0.83]; the cycle goes null → 1.17 → 0.83 → null. For `fit = {x: 100, y: 50, scale: 2}`, w 800 and h 600, the world point that fell at the host center, ((400 − 100)/2, (300 − 50)/2), still maps to (400, 300) under `fixedScaleFit(fit, 800, 600, 1.17)`, and the returned scale is 1.17.
  - `host-keyboard.test.ts`: `SHORTCUTS.storybook` = `"ArrowRight ArrowDown ArrowLeft ArrowUp j k g h a 6 c"`.
  - `docs.test.ts`: the storybook paragraph contains "`c`".
  - A new storybook test (in `storybook.test.ts`): the `aria-label` of `lab/storybook.html` contains "Key c cycles the exhibit scale: real, 1.17 (laptop cover) and 0.83 (phone cover).", and the header comment of `storybook.ts` contains "c cycles the exhibit scale: real, 1.17 and 0.83, the cover scales of a laptop and a phone".
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `cover-scale.ts` (with the comment the issue fixes on `COVER_SCALES`). In `storybook.ts`: add a `coverScale: number | null` state next to `layers`; `fit()` applies `fixedScaleFit` when it is not null; in the keydown listener, `ev.key === "c" && !ev.repeat` advances the cycle, calls `fit()` and logs. Do not touch the ticker block or the `bloom` logs. Update the html attributes, the header comment and the README paragraph.
- [ ] **Step 4:** Run `src/lab` tests + typecheck → PASS.
- [ ] **Step 5:** Commit `feat(#360): storybook cover-scale key c`.

### Task 5: Sign placeholders and exhibits

**Files:**
- Create: `src/scenes/sign-helipad.ts`, `src/scenes/sign-graffiti.ts`, `src/scenes/sign-platform.ts` and a `.test.ts` for each
- Modify: `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/english.test.ts` (`EXHIBIT_IDS`), `CONTEXT.md` (append `### Sign`), `src/docs-glossary.test.ts` (Sign)

**Interfaces:**
- Consumes: Task 1 (`strokeText`, `fillText`, `measureText`, `diagonalWall`, `roofDiagonal`), Task 2 (`neon(..., "green" | "cyan", alpha)`), Task 3 (`PlatePoly`).
- Produces: `helipadSign(out: Solid[], accents: Accent[]): void`, `helipadTubeSign(out, accents)`, `graffitiWall(out, accents)`, `seaPlatform(out, accents)`.

- [ ] **Step 1: Failing tests.**
  - Each `sign-*.test.ts`, per function: ≥ 1 solid; every accent is `poly`; text accents are `green` / `greenBleed` (helipad), `cyan` / `cyanBleed` with tube alpha 0.75 (platform); two builds are deep-equal. Graffiti: the wall solid is a `poly` and every plate on it is a `shape: "poly"` plate of `wall: 0` with `mat: "safety"`, one per `fillText("Portfolio", 8.55, 1.6)` quad.
  - Helipad: the slab is `prism` `concrete` at (−11, −11, 0), 22 × 22 × 0.5. The text quads lie at z 0.55 (`helipadSign`) or on the vertical plane x + y = 0 (`helipadTubeSign`, min z 1.5 and an `x+y` of 0 within 1e-9). Platform: 6 cylinders `steel` r 0.3, `sides` 6, z −1..1.2, and the deck `prism` `deck` 14 × 12 × 0.4 at z 1.2.
  - `exhibits.test.ts`: "the sixteen pieces, each in its zone" adds `grafiti: portfolio`, `cartel-helipuerto: cv`, `cartel-helipuerto-b: cv`, `plataforma: blog`; `grafiti` comes right after `tren`, the two helipads right after `selva` in that order, `plataforma` right after `lancha`; pads `concrete` / default / `water`; titles as in the issue.
  - `english.test.ts`: `EXHIBIT_IDS` gains `cartel-helipuerto(-b)?`, `grafiti` and `plataforma`.
  - `docs-glossary.test.ts`: `Sign` is defined, and its `Code:` refs exist and name identifiers they hold.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the three modules (geometry per the issue §5 and the Decisions above; text quads become accents through `accents.push(...neon(q, color[, alpha]))`). Register the four exhibits. Append `### Sign` to `CONTEXT.md` with a `Code:` line naming `src/scenes/sign-helipad.ts` (`helipadSign`, `helipadTubeSign`), `src/scenes/sign-graffiti.ts` (`graffitiWall`), `src/scenes/sign-platform.ts` (`seaPlatform`), `src/lab/exhibits.ts` (`EXHIBITS`).
- [ ] **Step 4:** `npm test` and `npm run typecheck` → green. `git diff --stat origin/feature/352-carteles-zona -- src/world src/main.ts index.html src/style.css` → empty.
- [ ] **Step 5:** Commit `feat(#360): sign placeholder exhibits`.

## Assumptions (from grilling)

- **Stroke thickness in text space**, not world space. Rejected: offsetting in world units inside the plane, which on `roofDiagonal` would make the strokes along v look 1.98× thinner on screen than on `diagonalWall`, against the issue's "en pantalla el aspecto es idéntico al de `diagonalWall`".
- **Quad corner order and axis-aligned vertex squares.** Rejected: squares rotated to the segment. The issue only says "un cuadrado de lado `width` centrado en cada vértice interior".
- **Space** advances by `GRID.space` and draws nothing. Rejected: throwing on `" "`, which would make `GRID.space` dead.
- **Placeholder placement** (centered) and **pile positions** (x ∈ {−6.5, 0, 6.5}, y ∈ {−5.5, 5.5}). The issue gives sizes and z but not plan positions; children #361–#363 replace both.
- **Sign/Lettering glossary check** is a new `SIGN_TERMS` loop in `docs-glossary.test.ts`. Rejected: appending them to `KIT_TERMS`, which would change the "kit entries in order" test.

## Grilling

- Rounds: 1 (no substantial change to the plan: one Decisions line, one Files line and one test line refined). Griller model: fable.
- Questions: 20. Sources: ISSUE 13 (Q1 grid/measure values, Q2, Q3 partial, Q5, Q6, Q9, Q10 `repeat`, Q12, Q13, Q14 untouched files, Q15, Q16, Q17), CODE 11 (Q4 `plate.ts` `plateFaces`/`plateOutline`; Q5 `plate.ts` doc comment; Q7 grep; Q8 `solids.test.ts` inline snapshots and `__snapshots__/solids.test.ts.snap` cover existing solids only; Q10 `storybook.ts:89` alt/ctrl/meta early return; Q11 `host-keyboard.test.ts:13`, `storybook.ts:92` `!ev.repeat` on layers; Q13 contiguity in `exhibits.test.ts`; Q14 `ACCENT_COLORS` is only read by `ships-reference.test.ts:90` as membership; Q15 `props.ts:84-88` halo 0.6, no caller can pass a 3rd arg today; Q18 `src/iso/project.ts:4` exports `Z_SCALE`; Q19 `docs-glossary.test.ts` `codeRefs` reads several files on one line), NO SOURCE 4 → technical assumptions (Q1 corner order/squares/space, Q3 text-space thickness, Q12 pile positions, Q20 one commit per task, `tsc` points at each missed reader).
- Spec ambiguities: none. Out of scope / follow-ups: none.
