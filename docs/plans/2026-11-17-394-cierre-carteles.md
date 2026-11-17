# Closing the signs integration (#394) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close story #389: world-wide gates for the three signs (legibility against every nearby world solid, ships and launch never crossing any sign's letters, a world accent cap), a headless frame measurement before/after, the integration spec, ADR 0003, and README / CONTEXT.md / previous specs brought up to date, every document cross-checked by tests.

**Architecture:** No runtime code changes. Three test files gain world-wide gates built from existing pure helpers (`checkSign`, `signBox`, `screenBounds`, `overlaps`, `hullsIntersect`, `laneAt`, `polyline`). Documentation is written in `docs/` (Spanish) and `docs/adr/`, README, CONTEXT.md (English), and `src/lab/docs.test.ts` / `src/docs-glossary.test.ts` recompute the numbers the documents carry from the constants, so a moved site or a changed framing fails a test.

**Tech Stack:** TypeScript, Vitest, Vite dev server, agent-browser (headless) for the frame measurement and `npm run legibility`.

**Spec:** issue #394 (child of #389); its body is the spec. Background: the #389 plan comment (decisions 1–11), `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§5, §7, §8), `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` §7, `docs/adr/0002-seam-at-90-station-land-stays-portfolio.md` (ADR format).

## Global Constraints

- Base branch `feature/389-carteles-en-el-mapa`; the PR goes there.
- `npm test`, `npm run typecheck` green after every task; `npm run build` green at the end.
- Code, comments, strings, identifiers in `src/`, `lab/`, `scripts/`, README and CLAUDE.md in **English** (`src/english.test.ts`); exhibit ids and `docs/` (specs) in Spanish; ADRs in English (format of 0002).
- `src/iso`, `src/kit`, `src/scenes` Pixi-free (`src/iso/pixi-free.test.ts`); deterministic (no `Math.random`); no hex outside `src/map/palette-iso.ts`.
- No change to `src/scenes/`, `src/world/`, `src/main.ts`, the camera or the sign specs: this issue only guards and documents.
- Negative numbers in spec tables use U+2212 (`−`), as `2026-11-15` §5 does.
- `REPORT.md` is only ever written by `npm run legibility`.

## Spike (measured while planning, current branch 45193b3)

- `checkSign(e.sign, s, near)` with `near` = world solids whose `screenBounds(bounds(s))` overlaps `signBox(e.sign)` grown 4 u: `[]` for the three contexts at 1.17 and 0.83 (`near`: taller 130, torre 49, plataforma 28 solids).
- Ships on both lanes every 2 u (three `SHIPS` kinds) and the launch on `FERRY_ROUTE` every 2 u, both headings: 0 crossings of any of the three letter boxes.
- `assembleWorld(undefined, { reducedMotion: true }).scene.accents.length` = 2 451 (issue measured 2 478 with a different motion flag / child; both ≤ 2 600).
- Framing (`coverView` × `signBox`, host px): 1366×657 (scale 1.1757): portfolio 600.1..688.3 × 69.6..86.1 `sign`; cv 393.7..466.7 × 236.7..251.0 `sign`; blog 747.5..846.5 × 397.2..425.2 `sign`. 390×750 (scale 1.2420): portfolio 307.4..400.6 × 101.5..118.9 `sign`; cv 89.4..166.5 × 278.0..293.1 `sign`; blog 463.2..567.8 × 447.6..477.1 `edge`.

So the gates of Task 1 pass on arrival: they guard what decisions 3 and 8 of #389 already resolved by position. They are still written first and run red against a deliberately broken input (Step 2 of Task 1) to prove they bite.

## Technical assumptions (declared)

- A1. The letters' screen box of a sign is `signBox(spec)` from `src/world/signs.ts` (box of `project` over every `glyphs[].quads` point): exactly the issue's "caja de `project` sobre `glyphs[].quads`". `src/lab/signs.test.ts` imports it. `src/scenes/sea-anim.test.ts` does not import from `src/world/` (scenes stay below world); it keeps its inline box and iterates `[RESUME_SIGN, TINKER_SIGN, BLOG_SIGN]` (the issue allows "o los tres specs").
- A2. "Ampliada 4 unidades de pantalla por lado" = scale-1 screen units (the unit of `screenBounds`), 4 on each of the four sides.
- A3. The launch is built as `createSeaAnim` builds it: `ship("ferry", p, heading)` at the route point (no `shipAt`), heading of the leg from `polyline(FERRY_ROUTE).at(d)`, and also that heading + π (the way back).
- A4. The world accent gate counts `assembleWorld(undefined, { reducedMotion: true }).scene.accents.length` (same world as the static polygon test next to it).
- A5. "Los seis números" of the frame table = first draw (ms), bloom average (ms) and first worst redraw in 5 s (ms), before (`origin/main`) and after (this branch). The table also carries the static polygon count and the bloom verdict (`on` / `fallback`) of each side; the "after" static polygon count is recomputed by `docs.test.ts` with the `stage.staticCount` computation (`buildRenderList([...terrain.ground, ...ground, ...solids]).length`).
- A6. §4 framing rows are recomputed in `docs.test.ts` as `coverView(w, h)` + `signBox(SIGNS[id])` → host px `x0..x1 × y0..y1` with `toFixed(1)` and the mode of `labelLayout(box, v, host, { hw: 0, hh: 0 })` (the mode does not depend on the pad).
- A7. The 2026-11-11 spec keeps its `**Estado:**` line (the issue asks only for its §7 note; its test literal stays). The 2026-11-15 `**Estado:**` literal changes in `docs.test.ts`.
- A8. The README storybook paragraph drops "candidate site" (the sites are final) for "crop of the real world"; the #374 README test is updated accordingly.

## Review Focus

1. **A gate that cannot fail.** The world-wide `checkSign` and the ship/launch gate pass on arrival; a wrong box (e.g. scale applied twice, or an empty `near`) would pass vacuously. Task 1 asserts `near.length > 0` per context and, for the ship gate, that the probe covers every lane sample (sample count > 0 per lane) — and Step 2 proves the gates bite with a sign box translated onto a lane.
2. **A moved site or a changed camera silently drifting from the spec.** §3 and §4 rows are recomputed from the constants (Task 3 tests), with U+2212 on negatives.
3. **Spanish leaking into README / CLAUDE.md / ADR** (english test covers README; the ADR is checked by eye in review).
4. **Stale literals in docs tests** after the status change (the 2026-11-15 literal is asserted in one place only; Task 4 updates it and adds the §7 notes test).
5. **Frame numbers copied wrong between console and spec**: the "after" static polygon count is recomputed (A5).

---

### Task 1: world-wide gates

**Files:**
- Modify: `src/lab/signs.test.ts`
- Modify: `src/scenes/sea-anim.test.ts` (describe "Writing sign and the lanes (#390)")
- Modify: `src/scenes/city-budget.test.ts`

**Interfaces:**
- Consumes: `signBox`, `SIGNS` (`src/world/signs.ts`); `screenBounds`, `overlaps`, `screenHull`, `hullsIntersect` (`src/iso/depth.ts`); `bounds` (`src/iso/solids.ts`); `polyline` (`src/iso/geometry.ts`); `FERRY_ROUTE`, `SHIPS`, `laneAt`, `laneLength` (`sea-anim.ts`); `ship`, `shipAt` (`ships.ts`); `RESUME_SIGN`, `TINKER_SIGN`, `BLOG_SIGN`.
- Produces: nothing for later tasks.

- [ ] **Step 1: `signs.test.ts`** — inside the existing `describe.each`, add a block: `near` = `scene.solids.filter((s) => overlaps(screenBounds(bounds(s)), grow(signBox(e.sign), 4)))`; test `"near world solids: some overlap the letters' box"` (`near.length > 0`); for each scale, test `` `checkSign against the whole world at ${scale} = []` `` (`checkSign(e.sign, scale, near)` → `[]`). Comment: crop gate vs. world gate.
- [ ] **Step 2: prove it bites (not committed)** — temporarily feed `checkSign` a `near` that adds a tall box in front of the letters (or shift `signBox` onto a lane in the ship gate) and see the test go red; revert.
- [ ] **Step 3: `sea-anim.test.ts`** — rename the describe to `"zone signs and the lanes (#390, #394)"`; the test `"no ship piece or launch piece crosses the letters of any sign on screen"` builds one rect per sign from `[RESUME_SIGN, TINKER_SIGN, BLOG_SIGN]` (inline box as today), runs both lanes × the three `SHIPS` kinds every 2 u, and the launch every 2 u along `polyline(FERRY_ROUTE)` with heading and heading + π (A3). `bad` entries name sign word, lane/kind or `ferry`, and distance; expect `bad` `[]`.
- [ ] **Step 4: `city-budget.test.ts`** — new test `"static accents of the whole world ≤ 2 600"` in the "Resume level 2 budget" describe (or its own describe `"world accents (#394)"`), over `assembleWorld(undefined, { reducedMotion: true }).scene.accents.length`. Comment with the count: 2 478 measured in #389 planning (1 222 world + 1 256 signs: crown 238 poly + 164 dot, tinker 114 + 84, platform 654 + 2; the tinker's 19 animated lights are not static), ×1.05.
- [ ] **Step 5:** `npx vitest run src/lab/signs.test.ts src/scenes/sea-anim.test.ts src/scenes/city-budget.test.ts` → PASS. Commit `test(#394): world-wide sign gates`.

### Task 2: frame measurement (controller, agent-browser)

**Files:** none committed; numbers to `.scratch/frame-394.md`.

- [ ] **Step 1:** `git worktree add /tmp/mapa-main origin/main`; symlink `node_modules`, copy `content/blog.generated.json`; `npx vite --port 5174 --strictPort` there; `npm run dev -- --port 5173` here.
- [ ] **Step 2:** for each port: `agent-browser set viewport 1366 657 2`, open `/` with an init script (or `eval` before reload) that wraps `console.info` into `window.__logs`; wait ≥ 12 s (bloom needs 60 frames at ~2 fps, then the 5 s worst redraw); read `[mapa] first draw`, `[mapa] bloom`, first `[mapa] worst redraw in 5 s`. If `agent-browser console` exposes the page console, use it instead.
- [ ] **Step 3:** write the six numbers + the two polygon counts + the two verdicts to `.scratch/frame-394.md`; remove the worktree.

### Task 3: integration spec + its docs test

**Files:**
- Create: `docs/superpowers/specs/2026-11-17-carteles-de-zona-integracion-design.md`
- Modify: `src/lab/docs.test.ts` (new describe `"zone signs integration spec (#394)"`)

**Interfaces:**
- Consumes: Task 2 numbers; `CROWN_SITE`, `TINKER_SITE`, `PLATFORM_SITE`; `coverView`; `signBox`, `SIGNS`, `SIGN_ORDER`, `labelLayout`; `assembleWorld`, `buildRenderList`.
- Produces: the spec path, cited by Tasks 4–6.

- [ ] **Step 1: test first.** The describe reads the spec (empty string when missing) and asserts:
  - title line, `**Fecha:** 2026-11-17`, `**Estado:** implementado`;
  - headings `## 1. ` … `## 7. ` in order;
  - §3: for each of `CROWN_SITE`, `TINKER_SITE`, `PLATFORM_SITE` a single row starting `` | `<NAME>` | `` that contains the value built from the constant with U+2212 (`(x, y, z)` for crown and tinker, `(x, y)` for the platform, as in the #374 test);
  - §4: for `[["laptop", 1366, 657], ["teléfono", 390, 750]]` × `SIGN_ORDER`, a single row starting `` | <label> <w>×<h> | `<id>` | `` containing `` `${x0}..${x1} × ${y0}..${y1}` `` (A6) and `` `<mode>` ``;
  - §5: rows `| first draw (ms) |`, `| bloom, promedio (ms) |`, `| peor redibujo en 5 s (ms) |` each with two numeric cells; row `| polígonos estáticos |` whose last cell is the recomputed count (A5); row `| acentos estáticos del mundo |` whose last cell is `scene.accents.length` with a non-breaking thousands space or plain digits (assert `replace(/\s/g, "")`);
  - §7 names the seven files of `assets/389-carteles-sitio/` and each exists.
  Run → FAIL (file missing).
- [ ] **Step 2: write the spec** (Spanish). §1 contexto (what was there; the #389 risks: lanes, framing, performance, guardrails). §2 decisiones (the ten of #389: each scene builds its sign; antenna out; platform site moved and why — 8.2 u from `LANE_OUT` failed the occlusion rule in 90 samples, (392, 178) leaves 14.7 u; contexts as crops; hit test sign → geography; invisible links with edge fallback; camera unchanged; Rubik out; occlusion by position and gates; budget). §3 sitios finales (table: Constante | Archivo | Valor | Lugar). §4 encuadre (table: Pantalla | Zona | Palabra | Caja (px del host) | Modo; plus the cover scale of each screen). §5 presupuesto y frame (table per sign: sitio, sólidos, caras, acentos; table antes/después with A5 rows; note: headless not representative, #229). §6 desvíos (the three do not fit on the phone — Writing in `edge`; the platform is not where 2026-11-15 §5 first put it, (400, 170) → (392, 178); the antenna is gone). §7 capturas (the seven PNGs of `assets/389-carteles-sitio/`).
- [ ] **Step 3:** run → PASS. Commit `docs(#394): integration spec`.

### Task 4: previous specs

**Files:**
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (`**Estado:**`, §7 first paragraph)
- Modify: `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` (§7 first paragraph)
- Modify: `src/lab/docs.test.ts` (the 2026-11-15 status literal; new test for the two §7 notes)

- [ ] **Step 1: tests.** In "zone signs redesign documentation (#374)" the status literal becomes `**Estado:** implementado (storybook e integración al sitio: #389, spec 2026-11-17)`. New test `"§7 of both previous specs opens with the integration note"`: for each spec, the first paragraph after `## 7. ` (`split(/\n\s*\n/)[1]`, whitespace collapsed) starts with `*Desvío (2026-11-17): integrado en #389; ver 2026-11-17-carteles-de-zona-integracion-design.md.*`. Run → FAIL.
- [ ] **Step 2:** edit both specs exactly so. Run → PASS. Commit `docs(#394): previous specs point at the integration`.

### Task 5: ADR 0003

**Files:**
- Create: `docs/adr/0003-signs-are-the-navigation.md`
- Modify: `src/docs-glossary.test.ts` (new describe `"signs ADR (#394)"`)

- [ ] **Step 1: test.** The file exists; has `## Status`, `## Context`, `## Decision`, `## Consequences` in that order; names `zoneAtScreen`, `worldZoneAt`, `src/world/signs.ts`, `labelLayout`, `coverView`; mentions "edge" (fallback) and "phone"; and each backticked `src/…` path it cites exists. Run → FAIL.
- [ ] **Step 2: write it** (English, 0002's shape): Status (Accepted, 2026-11-17, story #389, recorded in #394); Context; Decision (the 3D sign is its zone's control; `zoneAtScreen` tests the sign polygons before `worldZoneAt`; the `<a>` are the accessible controls, invisible over the sign, edge fallback when less than half of the word box is inside the host; the camera does not adapt to the signs); Consequences (portrait phone: Writing falls to the edge label; accents draw over everything, so occlusion is solved by position and held by the gates of `src/lab/signs.test.ts`, `src/scenes/sea-anim.test.ts`). Run → PASS. Commit `docs(#394): ADR 0003, signs are the navigation`.

### Task 6: README and CONTEXT.md

**Files:**
- Modify: `README.md`, `CONTEXT.md`
- Modify: `src/lab/docs.test.ts` (#374 README storybook test; lab paragraph lists the new spec), `src/docs-glossary.test.ts` (Sign/Zone/Exhibit content)

- [ ] **Step 1: tests.**
  - README runtime paragraph (the one with `coverView(host)`) contains `src/world/signs.ts`, `zoneAtScreen`, `labelLayout`, "edge", and "no external font";
  - README storybook paragraph: replace the "candidate site" requirement by "crop of the real world" (A8);
  - README lab paragraph (`/lab/world.html`) contains `2026-11-17-carteles-de-zona-integracion-design.md`;
  - CONTEXT.md Sign contains `assembleWorld`, `tinkerAnimator`, `src/world/signs.ts`, `SIGNS`, `zoneAtScreen`, `labelLayout`, not `None is in the world yet`, and its `Code:` line names `src/world/signs.ts` (`SIGNS`, `zoneAtScreen`, `labelLayout`); Zone contains `zoneAtScreen` and its `Code:` line names `src/world/signs.ts`; Exhibit says the `context` carries the `sign` the lab audits (contains `` `sign` `` and `cropScene` or `contextScene`). The existing per-term `Code:` existence tests already cover Sign; add the same loop for Zone and Exhibit.
  Run → FAIL.
- [ ] **Step 2:** edit README (English) and CONTEXT.md. Run `npx vitest run src/docs-glossary.test.ts src/lab/docs.test.ts src/english.test.ts` → PASS. Commit `docs(#394): README and CONTEXT.md tell the sign navigation`.

### Task 7: report and final checks (controller)

- [ ] **Step 1:** `npm run legibility`; `REPORT.md` must have 18 ✓; if it changed, the §8.1 rows of 2026-11-15 follow (docs test). Commit only if regenerated content differs beyond the date.
- [ ] **Step 2:** `npm test`, `npm run typecheck`, `npm run build` → green.
- [ ] **Step 3:** compute the per-sign table (site, solids, faces, static accents) for the PR body.
