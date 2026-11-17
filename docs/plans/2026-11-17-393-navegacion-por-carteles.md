# Navigation by signs on the site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/`, the three 3D signs (RESUME crown, PORTFOLIO tinker, Writing platform) are the zone controls: a click or tap on a sign navigates to its zone before the geography is asked, and the `#zonas` links become invisible accessible controls laid over their sign, falling back to a visible edge label when less than half of the sign is inside the host. Rubik Doodle Shadow goes away; `.dim` becomes `aria-current="page"`.

**Architecture:** A pure module `src/world/signs.ts` (no Pixi, no DOM) holds `SIGNS`, the screen polygons and word box of each sign, the screen hit test `zoneAtScreen` and the label layout `labelLayout`. A small DOM module `src/labels.ts` applies a layout to an `<a>` (`applyLabel`) and marks the active link (`markCurrent`), so the wiring is testable under happy-dom without booting Pixi. `src/main.ts` only calls those; `index.html` and `src/style.css` drop the font and switch from a landmark label to `on-sign` / `on-edge`.

**Tech Stack:** TypeScript, Vitest (node + happy-dom), Vite, PixiJS v8 (renderer only, untouched here), agent-browser.

**Spec:** issue #393 (child of #389); its body is the spec. Background: parent plan comment on #389 (decisions 5–7), `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` §5, §7, §8.

## Global Constraints

- Base branch `feature/389-carteles-en-el-mapa`; PR goes there.
- `npm test`, `npm run typecheck` green at the end of every task; `npm run build` green at the end (Task 4).
- Code, comments, strings, identifiers in `src/`, `lab/`, `scripts/`, README, CLAUDE.md in **English** (`src/english.test.ts`); `docs/` and `index.html` comments stay in Spanish (index.html is `lang="es"` and is not under the English test).
- `src/iso`, `src/kit`, `src/scenes` Pixi-free; `src/world/signs.ts` Pixi-free and DOM-free too. Deterministic. No hex outside `src/map/palette-iso.ts` except the `STYLE_CSS_ALLOWLIST` of `src/map/palette-guard.test.ts` (no new hex in `style.css`).
- No change in `src/scenes/`, `src/world/stage.ts`, `src/world/veil.ts`, the camera (`coverView`, `zoneView`, `COVER_FOCUS_U`) or the sign specs.
- Unchanged in `main.ts`: `hot`, `setFocus`/`refreshFocus`, `navigate`, `popstate`, `Escape`, `#back`, `.mapa-listo`, `LABEL_MARGIN` (8).

## Spike (measured while planning, pure modules)

Word boxes (`signBox` × `coverView`, host px), matching the issue:
- 1366×657: RESUME x 394..467 y 237..251; PORTFOLIO x 600..688 y 70..86; Writing x 748..847 y 397..425 (the issue's 766..865 is for (400, 170); (392, 178) is ~19 px left, as it says).
- 390×750: RESUME x 89..167 (inside), PORTFOLIO x 307..401 (83 of 94 px inside → `sign`), Writing x 463..568 (outside → `edge`).
- Backing faces after `tessellate`: RESUME 2, PORTFOLIO 33, Writing 4; every face has 4 `pts`.

## Technical assumptions (declared)

- A1. "A point 3 u beyond the panel's ends" = in screen space at scale 1: on the row of the word box's vertical center, 3 units left of the minimum x and 3 units right of the maximum x over all `signPolygons(spec)` points. Neither point may lie in any polygon of that sign.
- A2. The grid test for `zoneAtScreen` far from the signs: `coverView(1366, 657)`, host points every 20 px on both axes, skipping points whose scale-1 screen position is inside any sign's polygons expanded by nothing (the test simply excludes points where any `pointInPolygon` over `signPolygons` of the three is true). On the rest, `zoneAtScreen` equals `worldZoneAt(pointerToWorld(v, px, py))`.
- A3. `labelLayout` "half of its width and height inside" = `overlap(x0, x1, 0, host.w) >= (x1 − x0) / 2` and the same on y, with `overlap(a0, a1, b0, b1) = max(0, min(a1, b1) − max(a0, b0))`. Equality counts as `sign`.
- A4. The DOM helpers live in a new `src/labels.ts` (not in `src/world/signs.ts`, which stays DOM-free). `main.ts` boots on import and cannot be unit-tested; the helpers carry the class/style/aria contract.
- A5. Edge mode keeps today's clamp exactly: center clamped to `[hw, w − hw] × [hh, h − hh]` with the same `clamp` that tolerates `hi < lo` (returns `lo`).
- A6. The issue's `x`/`y` "inside the margins" for the 390×750 edge case: `hw ≤ x ≤ 390 − hw` and `hh ≤ y ≤ 750 − hh` for a test pad `{ hw: 50, hh: 20 }`, and `x === 390 − 50` (stuck to the right edge).

## Assumptions (from the plan review)

- A7. The three signs' screen polygons are disjoint (spike, scale 1: PORTFOLIO x 44.3..123.7 y −26.2..−5.9; RESUME x −133.3..−62.7 y 114.1..134.3; Writing x 168.2..259.8 y 252.5..280.9). The order `portfolio, cv, blog` is the issue's contract and is kept, though no point exercises it. Rejected: a synthetic overlap test with fake specs (`zoneAtScreen` reads the fixed `SIGNS`, so it would need injection the issue does not ask for).
- A8. `transition: opacity 200ms ease` leaves `#zonas a` with `.dim`: nothing else changes the links' opacity. Rejected: keeping it as dead CSS.
- A9. `src/iso/pixi-free.test.ts` guards `src/iso` and `src/scenes` only (`DIRS`), and `src/world` holds Pixi modules (`stage.ts`), so `signs.ts` gets its own source guard in `signs.test.ts`. Rejected: adding `src/world` to `DIRS` (it would fail on `stage.ts`).
- A10. The "sign before geography" test uses a real point: the Writing platform's polygons cover ground that `worldZoneAt` classifies as `cv`. The crown and the tinker cover only ground of their own zone at scale 1 (spike: 0 mismatches), so they cannot exercise it.
- A11. The sign-mode link covers the word box only (the issue: "`signBox(spec)`: caja de pantalla de todos los `glyphs[].quads` proyectados (la palabra)" and "`placeLabels(v)` usa `labelLayout(signBox(SIGNS[id]), …)`"). A click on the rest of the sign falls through to the canvas and `zoneAtScreen` catches it. The sign-mode overflow of PORTFOLIO at 390 px is clipped by `#canvas-host { overflow: clip }` and `html, body { overflow: hidden }` (`src/style.css`).

## Review Focus

1. **A sign standing over another zone's geography** — the Writing platform's screen polygons cover points whose ground (`worldZoneAt(unproject(…))`) is `cv` (spike: 3 041 of 10 304 half-unit samples at scale 1); a hit test that skipped the polygons would send those clicks to Resume. Task 1 test `"zoneAtScreen prefers the sign over the geography beneath it"` pins it (A10). The three signs' polygons never overlap each other (A7), so the fixed order only matters by contract.
2. **Host smaller than the label** (`hi < lo` in the clamp): an edge label on a 40 px host must not produce NaN or jump out; Task 1 test: `labelLayout` with host `{ w: 40, h: 40 }`, pad `{ hw: 50, hh: 30 }` → `edge`, `x === 50`, `y === 30` (A5).
3. **Switching mode during a camera tween**: a link going from `sign` to `edge` must lose `width`/`height` and `on-sign`; Task 2 test applies `sign` then `edge` to the same `<a>` and asserts `style.width === ""`, `style.height === ""`, class `on-edge` only.
4. **Prerendered direct load on `/area/resume/`**: `render` runs before any hover; `markCurrent` must set `aria-current` on Resume only and clear it on the map (`null`). Task 2 test covers `cv` then `null`.
5. **No-canvas fallback** inherits inline `width`/`height` and `transform` from a previous layout: CSS must reset them (`width: auto; height: auto`, `transform: none !important`). Task 3 static test asserts the `.no-canvas #zonas a` rule contains `width: auto` and `height: auto`.

---

### Task 1: pure sign geometry and hit test, `src/world/signs.ts`

**Files:**
- Create: `src/world/signs.ts`
- Test: `src/world/signs.test.ts` (node environment)

**Interfaces:**
- Consumes: `RESUME_SIGN` (`src/scenes/sign-crown.ts`), `TINKER_SIGN` (`src/scenes/sign-tinker.ts`), `BLOG_SIGN` (`src/scenes/sign-platform.ts`), `SignSpec` (`src/kit/legibility.ts`), `tessellate` (`src/iso/solids.ts`), `project` (`src/iso/project.ts`), `toWorld` (`src/kit/lettering.ts`), `pointInPolygon`, `worldZoneAt` (`src/map/geo.ts`), `unproject`, `View` (`src/world/view.ts`), `ZoneId` (`src/map/zones.ts`).
- Also consumes (tests only): `pointerToWorld` (`src/world/view.ts:25`), `coverView` (`src/world/view.ts`).
- Produces:
  - `export const SIGNS: Record<ZoneId, SignSpec>` = `{ portfolio: TINKER_SIGN, cv: RESUME_SIGN, blog: BLOG_SIGN }`
  - `export const SIGN_ORDER: readonly ZoneId[]` = `["portfolio", "cv", "blog"]`
  - `export interface ScreenBox { minX: number; minY: number; maxX: number; maxY: number }`
  - `export function signPolygons(spec: SignSpec): number[][]` (memoized per spec with a `WeakMap`)
  - `export function signBox(spec: SignSpec): ScreenBox` (memoized the same way)
  - `export function zoneAtScreen(v: View, px: number, py: number): ZoneId`
  - `export type LabelLayout = { mode: "sign"; x: number; y: number; w: number; h: number } | { mode: "edge"; x: number; y: number }`
  - `export function labelLayout(box: ScreenBox, v: View, host: { w: number; h: number }, pad: { hw: number; hh: number }): LabelLayout`

- [ ] **Step 1: Write the failing tests** in `src/world/signs.test.ts`:
  - `it("SIGNS maps each zone to its sign and SIGN_ORDER is portfolio, cv, blog")`: `SIGNS.portfolio === TINKER_SIGN`, `SIGNS.cv === RESUME_SIGN`, `SIGNS.blog === BLOG_SIGN`; `SIGN_ORDER` equals `["portfolio", "cv", "blog"]`.
  - `it("signPolygons: one flat polygon per tessellated backing face plus one quad per glyph box")`: for each sign, `signPolygons(s).length === s.backing.flatMap(tessellate).length + s.glyphs.length`; every polygon has even length ≥ 6; the last `glyphs.length` have length 8; `signPolygons(s)` returns the same array on two calls (`toBe`).
  - `it("the projected center of every glyph lies in the sign's polygons")`: for each glyph, center = mean of `project` over all `g.quads.flat()`; `signPolygons(s).some(p => pointInPolygon(c.x, c.y, p))` is true.
  - `it("a point 3 u beyond either end of the panel is outside the sign")` (A1).
  - `it("signBox is the screen box of the projected glyph quads")`: equals min/max over `project` of `glyphs.flatMap(g => g.quads.flat())`; at `coverView(1366, 657)` its host-px box rounds to RESUME 394..467 × 237..251 and PORTFOLIO 600..688 × 70..86 (`toBeCloseTo(…, 0)` on each of the 8 numbers is too strict at ±0.5; use `Math.round`).
  - `it("zoneAtScreen on the center of each word returns its zone")`, for `v = { x: 0, y: 0, scale: 1 }` and `v = coverView(1366, 657)`: center of `signBox` taken to host px (`c × v.scale + v.x/y`) → the sign's zone, for the three.
  - `it("zoneAtScreen away from the signs equals worldZoneAt(pointerToWorld(…))")` (A2).
  - `it("labelLayout at coverView(1366, 657) puts the three on their sign")`: pad `{ hw: 50, hh: 20 }`, host `{ w: 1366, h: 657 }`; each result `mode === "sign"`, `x`/`y` = box min × scale + offset, `w`/`h` = box size × scale (`toBeCloseTo(…, 6)`).
  - `it("labelLayout at coverView(390, 750): RESUME and PORTFOLIO on their sign, Writing on the right edge")` (A6).
  - `it("labelLayout clamps the edge label to lo when the host is smaller than the label")` (Review Focus 2).
  - `it("zoneAtScreen prefers the sign over the geography beneath it")` (A10): scan `BLOG_SIGN`'s polygons at scale 1 on a 0.5-unit grid of its polygon bounding box, take the first point inside a polygon with `worldZoneAt(unproject(x, y)) === "cv"` (`expect(found).toBeDefined()`), and assert `zoneAtScreen({ x: 0, y: 0, scale: 1 }, x, y) === "blog"`.
  - `it("the three signs' polygons are disjoint")` (A7): the screen bounding boxes of `signPolygons` of each pair of signs do not intersect (a `View` is a uniform scale plus offset, so disjoint at scale 1 means disjoint at every camera).
  - `it("signs.ts imports neither pixi.js nor the DOM")` (A9): `readFileSync` of `src/world/signs.ts` matches neither `/["']pixi\.js["']/` nor `/\b(document|window|HTMLElement)\b/`.
- [ ] **Step 2: Run** `npx vitest run src/world/signs.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `src/world/signs.ts` with the interfaces above. `zoneAtScreen`: `sx = (px − v.x) / v.scale`, `sy = (py − v.y) / v.scale`; for `id of SIGN_ORDER`, if any polygon of `signPolygons(SIGNS[id])` contains (sx, sy) return `id`; else `worldZoneAt` of `unproject(sx, sy)`. `labelLayout` per A3/A5. File header doc: what the module is (the signs as the site's zone controls, #393), no Pixi, no DOM.
- [ ] **Step 4: Run** `npx vitest run src/world/signs.test.ts` → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#393): pure sign hit test and label layout`.

### Task 2: DOM helpers and `main.ts` wiring

**Files:**
- Create: `src/labels.ts`
- Test: `src/labels.test.ts` (`// @vitest-environment happy-dom` on line 1)
- Modify: `src/main.ts` (imports; delete `LABEL_AT` and its doc and the `v3`/`Vec3`/`project` imports if unused; `placeLabels`; `zoneUnder`; `render`'s `.dim` line; the comment above `zoneUnder` becomes "pointer → sign under it, else the zone by geography")

**Interfaces:**
- Consumes: `LabelLayout` (Task 1).
- Produces:
  - `export function applyLabel(a: HTMLElement, l: LabelLayout): void` — `sign`: classes `on-sign` on / `on-edge` off, `style.transform = translate(${x}px, ${y}px)` (numbers with `toFixed(1)`), `style.width`/`style.height` = `${w}px`/`${h}px` (`toFixed(1)`). `edge`: `on-edge` on / `on-sign` off, `style.transform = translate(${x}px, ${y}px) translate(-50%, -50%)` (`toFixed(1)`), `style.width = ""`, `style.height = ""`.
  - `export function markCurrent(labels: ReadonlyMap<ZoneId, HTMLElement>, id: ZoneId | null): void` — `aria-current="page"` on the link of `id`, attribute removed from the others (and from all when `id` is null).

- [ ] **Step 1: Write the failing tests** in `src/labels.test.ts`:
  - `it("applyLabel in sign mode sizes the link over the sign and marks it on-sign")`: `applyLabel(a, { mode: "sign", x: 10, y: 20.04, w: 73, h: 14.26 })` → `a.classList.contains("on-sign")`, not `on-edge`; `a.style.transform === "translate(10.0px, 20.0px)"`; `a.style.width === "73.0px"`, `a.style.height === "14.3px"`.
  - `it("applyLabel in edge mode centers the label and drops the sign size")`: first sign as above, then `applyLabel(a, { mode: "edge", x: 340, y: 411 })` → `on-edge` only; `transform === "translate(340.0px, 411.0px) translate(-50%, -50%)"`; `width === ""`, `height === ""` (Review Focus 3).
  - `it("markCurrent puts aria-current=page on the active zone's link only")`: three `<a>` in a `Map`; `markCurrent(m, "cv")` → `cv` has `getAttribute("aria-current") === "page"`, others `null`; then `markCurrent(m, null)` → all `null` (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run src/labels.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `src/labels.ts`. Then in `src/main.ts`:
  - `placeLabels(v)`: for each `[id, a]`: `applyLabel(a, labelLayout(signBox(SIGNS[id]), v, { w: host.clientWidth, h: host.clientHeight }, { hw: a.offsetWidth / 2 + LABEL_MARGIN, hh: a.offsetHeight / 2 + LABEL_MARGIN }))`. Note: in `sign` mode `offsetWidth` is the sign's width, but the pad is only used in `edge` mode, where CSS has already restored the plate size on the next frame; accept one frame of a wider pad on the switch (declared, not fixed).
  - `zoneUnder(e)`: `zoneAtScreen(camera.state, e.clientX − r.left, e.clientY − r.top)`.
  - `render`: replace the `.dim` toggle with `markCurrent(labels, id)`.
  - Remove the local `clamp` if unused.
- [ ] **Step 4: Run** `npx vitest run src/labels.test.ts` → PASS; `npm test` → PASS; `npm run typecheck` → PASS; `grep -n "LABEL_AT\|\"dim\"" src/main.ts` → no output.
- [ ] **Step 5: Commit** `feat(#393): main.ts places the zone links over their signs and hit-tests the signs first`.

### Task 3: `index.html` without the font, `style.css` with `on-sign` / `on-edge`

**Files:**
- Modify: `index.html` (delete the Rubik comment, the two `preconnect` and the Google Fonts `<link>`; the comment on line 6 becomes `<!-- los links de #zonas son los controles accesibles sobre los carteles 3D; solo se ocultan si hay JS que los va a colocar (ver #zonas a en style.css) -->`)
- Modify: `src/style.css` (the `#zonas` block and the `.no-canvas #zonas a` rule)
- Test: `src/site-shell.test.ts` (node, reads files with `readFileSync`)

**Interfaces:**
- Consumes: classes `on-sign`, `on-edge` and `aria-current` from Task 2.
- Produces: the CSS contract.

- [ ] **Step 1: Write the failing tests** in `src/site-shell.test.ts`:
  - `it("index.html loads no external font")`: no match for `/Rubik|fonts\.googleapis|fonts\.gstatic|preconnect/`; still has the three `<a href="/area/portfolio/" data-zone="portfolio">Portfolio</a>`, `…resume/" data-zone="cv">Resume</a>`, `…blog/" data-zone="blog">Writing</a>` in that order.
  - `it("style.css has no Rubik and no .dim")`: no `/Rubik/`, no `/\.dim\b/`.
  - `it("style.css hides the text on the sign but keeps it in the tree")`: a rule `#zonas a.on-sign {` whose block contains `color: transparent`, `background: none`, `padding: 0`, `box-sizing: border-box`, and contains neither `display: none`, `visibility: hidden` nor `font-size: 0`.
  - `it("style.css gives the edge label the plate and the system font")`: `#zonas a.on-edge {` block contains `font: 600 0.9rem/1 system-ui, sans-serif`, `letter-spacing: 0.08em`, `text-transform: uppercase`, `background:`.
  - `it("style.css focus ring for both modes and brightness on the edge only")`: `#zonas a:focus-visible {` with `outline: 2px solid var(--fg)` and `outline-offset: 4px`; selector `#zonas a.on-edge:hover, #zonas a.on-edge:focus-visible` with `filter: brightness(1.25)`; no selector `#zonas a:hover` (unqualified).
  - `it("style.css resets the sign size without a canvas")`: `.no-canvas #zonas a {` block contains `width: auto`, `height: auto`, `position: static` (Review Focus 5).
  - `it("main.ts has no LABEL_AT and no dim class")`.
  - `it("#zonas a has no opacity transition")` (A8): the `#zonas a {` block does not contain `transition`.
  - Helper: `block(css, selector)` = the text between `selector {` and the next `}`; fail the test if the selector is missing.
- [ ] **Step 2: Run** `npx vitest run src/site-shell.test.ts` → FAIL on index.html and style.css (main.ts passes after Task 2).
- [ ] **Step 3: Implement.** `#zonas a`: `position: absolute; left: 0; top: 0; pointer-events: auto; will-change: transform; text-decoration: none;` (no font, no plate; the `transition: opacity` goes with `.dim`, nothing else changes the links' opacity, A8). Then the `on-sign`, `on-edge` (plate `padding: 0.4rem 0.7rem; background: rgba(8, 10, 18, 0.62); border-radius: 0`), zone colors kept as today but scoped so they still apply to `on-edge` (the `on-sign` `color: transparent` must win: put `on-sign` after the zone-color rules or raise its specificity; the test does not check order, the browser script does), focus and hover rules, `.dim` removed. Comments rewritten: the nav is the accessible control layer over the 3D signs; `on-sign` invisible over the sign, `on-edge` the visible label when the sign is mostly off-host; no mention of Rubik or of a label over the landmark. The `.no-canvas #zonas a` rule keeps `position: static; transform: none !important; visibility: visible; padding: 0; background: none; font-size: 1.1rem; text-decoration: underline`, drops `font-family: inherit`, `letter-spacing: 0` and `text-transform: none` (the base rule no longer sets them) and adds `width: auto; height: auto`. No `on-sign` override there: `.no-canvas` is set when `boot` fails, before any `placeLabels`, so the links never carry a mode class in that state.
- [ ] **Step 4: Run** `npm test` → PASS (including `palette-guard.test.ts` and `english.test.ts`); `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#393): zone links invisible over their sign, edge label fallback, no Rubik Doodle Shadow`.

### Task 4: browser verification, screenshots, build

**Files:**
- Create: `docs/superpowers/specs/assets/389-carteles-sitio/sitio-laptop.png`, `sitio-laptop-resume.png`, `sitio-foco.png`, `sitio-telefono.png`
- Uses: `.scratch/evals-393.md` (the stage-3 agent-browser script; not committed)

- [ ] **Step 1:** `npm run dev -- --host --port 5173` (separate shell), then run `.scratch/evals-393.md` step by step with `agent-browser` at 2x: 1366×657 (`sitio-laptop.png`; eval: three `on-sign`, texts, hrefs, data-zone), click the center of the Resume `<a>`'s `getBoundingClientRect` (`sitio-laptop-resume.png`; pathname `/area/resume/`, `aria-current="page"` on Resume; PORTFOLIO and Writing visibly dimmed), back to `/`, `Tab` until `document.activeElement.dataset.zone === "cv"` (`sitio-foco.png`; ring around the sign), `Enter` → `/area/resume/`; 390×750 (`sitio-telefono.png`; Resume and Portfolio `on-sign`, Writing `on-edge`, its rect inside the viewport near the right edge; click → `/area/blog/`).
  Pass/fail expressions (the full script is `.scratch/evals-393.md`, written in pipeline stage 3; these are its core): `[...document.querySelectorAll('#zonas a')].map(a => [a.dataset.zone, a.className, a.textContent, a.getAttribute('href')])`; `location.pathname`; `document.querySelector('#zonas a[data-zone="cv"]').getAttribute('aria-current')`; `document.activeElement.dataset.zone`; for the phone, `getBoundingClientRect()` of the Writing link with `right <= innerWidth` and `right >= innerWidth - 60`.
- [ ] **Step 2:** Tab order check: from the document start, successive `Tab` presses reach `portfolio`, `cv`, `blog` in that order (other focusables in between are allowed only if they come before `portfolio`).
- [ ] **Step 3:** `npm run build` → exit 0.
- [ ] **Step 4: Commit** `docs(#393): site screenshots of the sign navigation`.

## Grilling

- Rounds: 1 (griller model: fable). The revisions added tests and assumptions inside existing tasks, with no new task or seam, so no second round.
- Questions: 18. Sources: ISSUE 4 (Q8, Q15 ×2 parts, Q2 part), CODE 15 (Q2 `src/world/veil.ts` `ACCENT_DIM` + `src/world/veil.test.ts:110-128` per-sign zone tests; Q3 `src/main.ts` canvas listeners + link `click` → `navigate`; Q4 `scripts/prerender.ts:8,15` copies the built `dist/index.html`, no booted DOM; Q5 `src/map/geo.ts:67,77` `WorldZone` never null, same union as `ZoneId`; Q7 `src/kit/legibility.ts:87` `quads: Vec3[][]` world, `toWorld` only for `layout.box`; Q9 `src/style.css` `overflow: clip`; Q10 `src/map/geo.ts:123`, `src/iso/solids.ts:439`, `src/world/view.ts:25`; Q11 `src/camera.ts:3`, `src/world/view.ts:5` "Same as CameraState"; Q12 grep: only `index.html` and `src/style.css` mention Rubik/googleapis; Q13 `palette-guard.test.ts` checks hex only, the rgba is in today's `style.css`), DOC 1 (Q18: `docs/adr/` has 0001 veil and 0002 seam only; the navigation ADR is assigned to sibling #394 by the parent plan, decision 10), NO SOURCE 4 → technical assumptions A7–A10 (Q1, Q6, Q16, Q17), plus Q14 resolved by inlining the eval expressions in Task 4.
- Spec ambiguities: none. Follow-up issues opened: none (the ADR is already #394's scope).
