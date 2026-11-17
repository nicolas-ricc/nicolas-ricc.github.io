# Writing platform in the sea, at (392, 178), and context exhibits as world crops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Writing platform (Blog's sign) stands in the real world at `PLATFORM_SITE` = (392, 178, 0), built by `sea()`, and the `plataforma-escena` context exhibit becomes a plain crop of that world (no `build`).

**Architecture:** `sea()` calls `seaPlatformAt(solids, accents)` last, so the platform's solids and its static accents (2 dots + the sign's cyan triangles) flow into `SeaScene` and from there into `world()` / `assembleWorld` unchanged. In `src/lab/exhibits.ts` the `context` kind gets optional `build`/`animate`; `contextScene`/`contextAnimators` (`src/lab/crop.ts`) apply them only when present. The gates that already exist (lanes, sign levels 1–2, level 3 report, docs cross-checks) are run against the world copy of the sign.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS v8 (only in the renderer; `src/iso`, `src/kit`, `src/scenes` are Pixi-free), tsx scripts, agent-browser.

**Spec:** issue #390 (child of #389) — the issue body is the spec. Background: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§5, §7, §8) and `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` §7.

## Global Constraints

- Base branch: `feature/389-carteles-en-el-mapa`; the PR goes there, not to `main`.
- `npm test` and `npm run typecheck` green at the end of every task.
- Code, comments, strings and identifiers in `src/`, `lab/`, `scripts/`, README and CLAUDE.md are in **English** (`src/english.test.ts`); exhibit ids and `docs/` documents stay in Spanish.
- `src/iso`, `src/kit` and `src/scenes` stay Pixi-free (`src/iso/pixi-free.test.ts`); deterministic (no `Math.random`); no hex colour outside `src/map/palette-iso.ts`.
- `LANE_OUT`, `LANE_BACK` and `FERRY_ROUTE` (`src/scenes/sea-anim.ts`) do not change.
- `world()`, `assembleWorld` and the camera (`coverView`, `zoneView`, `COVER_FOCUS_U`) do not change.
- `src/scenes/world-baseline.test.ts`: the `plataforma` piece hash (`ebaa8a89/86e21d29`) is not touched.
- `REPORT.md` is only written by `npm run legibility` (full run).

## Review Focus

1. **Material rules of the sea and world scenes.** The platform brings `boxGrey` (hut) and `officeDark` (sign panel) into `sea().solids`; `sea.test.ts` (`SEA_MATS`) and `world.test.ts` (`sharedWithBlog`) pin the sea's materials. Expected: both lists accept those two materials with a `#390` comment; nothing else moves. (Task 1, measured in a planning spike.)
2. **Exact-accent assertion in `sea.test.ts` "buoys and wreck…"** compares `s.accents` with exactly the keeper window and the wreck dot; with the platform it must compare the non-platform accents only. (Task 1.)
3. **A context exhibit without `build`** must not crash the storybook (`src/lab/storybook.ts` → `contextScene`/`contextAnimators`) nor `scripts/legibility.ts`. Expected: the crop alone renders; the context test block skips build-only assertions. (Task 2.)
4. **Region `boyas` now crops the deck**: its `h` must be re-measured with the same framing/neighbour rule, not guessed. (Task 2.)
5. **Docs cross-checks** (`src/lab/docs.test.ts`): §5 must carry `(392, 178)` and §8.1 the regenerated `REPORT.md` cells for `plataforma-escena`. (Task 3.)

---

### Task 1: The platform at (392, 178), built by `sea()`, with its gates

**Files:**
- Modify: `src/scenes/sign-platform.ts` (`PLATFORM_SITE`, its doc comment)
- Modify: `src/scenes/sea.ts` (`sea()` calls `seaPlatformAt` last; header comment mentions the platform)
- Test: `src/scenes/sign-platform.test.ts:117`, `src/scenes/sea.test.ts` (`SEA_MATS`, "buoys and wreck…", line 143), `src/scenes/world.test.ts` (`sharedWithBlog`), `src/world/veil.test.ts`, `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Consumes: `seaPlatformAt(out: Solid[], accents: Accent[]): void`, `BLOG_SIGN: SignSpec` (`glyphs[].quads: Vec3[][]`), `PLATFORM_SITE`.
- Produces: `PLATFORM_SITE = v3(392, 178, 0)`; `sea(rng).solids`/`.accents` contain the platform; `SeaScene` type unchanged.

- [ ] **Step 1: Failing tests**
  - `sign-platform.test.ts`: `it("PLATFORM_SITE is (392, 178, 0)")` → `expect(PLATFORM_SITE).toEqual({ x: 392, y: 178, z: 0 })`.
  - `sea.test.ts:143` replaced. Today the sea has 2 static accents: the keeper's window (`poly`, magentaBleed) and the wreck buoy (`dot`). The platform adds 2 `dot`s (hut, mast) and one `poly` per sign triangle. With `signTris = BLOG_SIGN.glyphs.flatMap(g => g.quads).length`: `expect(s.accents).toHaveLength(4 + signTris)`, `dots` = 3, `polys` = 1 + signTris. (Decision: the issue's "4 dot" counts the window, which is a poly, as one of "the two of today"; the test pins the real kinds, total 4 + signTris as the issue intends.)
  - `sea.test.ts` "buoys and wreck…": the `toEqual` on `s.accents` applies to the accents outside the platform: `s.accents.slice(0, 2)`; add `expect(s.accents.slice(2)).toEqual(platformAccents)` where `platformAccents` comes from calling `seaPlatformAt([], acc)`.
  - `sea.test.ts`: `it("sea() builds the Writing platform at PLATFORM_SITE: its solids and accents are seaPlatformAt's")` → every solid of `seaPlatformAt` is in `s.solids` (`toContainEqual`) and the tail of `s.accents` equals its accents.
  - `veil.test.ts`: `it("every accent of the Writing platform (dots and polys) is Blog")` → for each accent of `seaPlatformAt([], acc)`: `expect(accentZone(a)).toBe("blog")`.
  - `sea-anim.test.ts`: `it("no ship piece crosses the Writing letters on screen")` → rect = min/max of `project(p)` over all `BLOG_SIGN.glyphs[].quads` points, as a 4-point convex hull; for `lane of ["out","back"]`, `kind of SHIPS.map(s => s.kind)` (unique), `d = 0; d <= laneLength(lane); d += 2`: `p = laneAt(lane, d)`, for each solid of `ship(kind, shipAt(kind, p, p.heading), p.heading).solids`: `expect(hullsIntersect(screenHull(bounds(s)), rect), \`${lane} ${kind} ${d}\`).toBe(false)`.
- [ ] **Step 2: Run** `npx vitest run src/scenes src/world/veil.test.ts` → new/changed tests FAIL (site value, accents count).
- [ ] **Step 3: Implement.** `PLATFORM_SITE = v3(392, 178, 0)` (comment: moved from (400, 170) in #389: at 8.2 u from `LANE_OUT` the ship occlusion rule failed). `sea()` calls `seaPlatformAt(solids, accents)` after `buoysAndWreck`. Add `"boxGrey"` and `"officeDark"` to `SEA_MATS` and to `sharedWithBlog` only if `world.test` needs them (it fails on `boxGrey` today), each with a `#390` note (hut and sign panel of the Writing platform).
- [ ] **Step 4: Run** `npx vitest run src/scenes src/world` → PASS, including `sea-anim.test.ts` lanes and `world-baseline.test.ts` unchanged.
- [ ] **Step 5: Commit** `feat(#390): Writing platform in the sea at (392, 178)`.

### Task 2: Context exhibits as world crops; `plataforma-escena` without `build`

**Files:**
- Modify: `src/lab/exhibits.ts` (type `Exhibit` context kind; `plataforma-escena`; `boyas` `h`; doc comment)
- Modify: `src/lab/crop.ts` (`contextScene`, `contextAnimators` doc + optional calls)
- Test: `src/lab/exhibits.test.ts` (block "context exhibits (#376)"), `src/lab/crop.test.ts` if it builds a context

**Interfaces:**
- Consumes: Task 1 (platform in `assembleWorld`'s scene).
- Produces: `{ kind: "context"; box: Box; h?: number; build?: (out: Solid[], accents: Accent[]) => void; sign: SignSpec; animate?: (opts: { reducedMotion: boolean }) => Animator }`; `contextScene(scene, e)` = crop + `e.build?.(…)`; `contextAnimators` adds `e.animate` only if defined.

- [ ] **Step 1: Failing tests** in `exhibits.test.ts`:
  - `built(e)` helper returns empty arrays when `e.build` is undefined; "build is deterministic" and "every solid and every accent point of build falls inside the box" iterate `contexts.filter(e => e.build)`.
  - New: `it("every solid of sign.backing is in the crop (deep equality)")` → for every context: for each `s of e.sign.backing`: `expect(contextScene(scene, e).solids).toContainEqual(s)`.
  - `plataforma-escena` test: `toMatchObject({ title: "Writing platform sign in its scene", zone: "blog", group: "sea", kind: "context", box: { x0: 358, y0: 144, x1: 426, y1: 212 }, sign: BLOG_SIGN })` and `expect(e.build).toBeUndefined()`; title of the `it` says "a crop of the world".
- [ ] **Step 2: Run** `npx vitest run src/lab/exhibits.test.ts` → FAIL (box, build defined).
- [ ] **Step 3: Implement.** Optional `build`/`animate` on the context kind; `contextScene` uses `e.build?.(solids, accents)`; `plataforma-escena`: box {358, 144, 426, 212}, no `build`. Measure `h` for `plataforma-escena` and `boyas` with the test's rule (framing: `h ≥ max(inside, accents)` and `h ≤ max(withAnim, accents) + SLACK`; neighbours: no cut solid above `h`), pick the smallest integer that passes, and replace the comment above `plataforma-escena` with what sets it. Update the `Exhibit` doc comment (context = crop of the world, optionally plus a sign built whole).
- [ ] **Step 4: Run** `npx vitest run src/lab` → PASS, including `signs.test.ts` (levels 1–2 at 1.17 and 0.83 on the world copy).
- [ ] **Step 5: Commit** `feat(#390): plataforma-escena is a crop of the world`.

### Task 3: Level 3 report, spec and glossary

**Files:**
- Regenerate: `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` and its PNG crops (`npm run legibility`, full run)
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§5 site line; §8.1 rows; §8.2 note)
- Modify: `CONTEXT.md` (Sign entry: Blog sign is in the world at `PLATFORM_SITE` (392, 178), built by `sea()`; Exhibit entry: context = crop, optional `build`)
- Test: `src/lab/docs.test.ts` (existing cross-checks)

- [ ] **Step 1: Failing check**: `npx vitest run src/lab/docs.test.ts` → "§5 records the three candidate sites" FAILS (spec still says (400, 170)).
- [ ] **Step 2: Docs.** §5: `` `PLATFORM_SITE` = (392, 178) `` … plus "movida a (392, 178) en #389: a 8,2 u del carril de salida fallaba la regla de oclusión de los barcos". §8.2: add a bullet with the same note (no other (400, 170) mention exists there). CONTEXT.md as above (English).
- [ ] **Step 3: Level 3.** `npm run legibility` (full). Expected: `REPORT.md` with 18 ✓ and "Sin violaciones.". Sync the `plataforma-escena` rows of §8.1 (contrast px, halo, OCR) with the new cells; if the other contexts' cells changed, sync them too.
- [ ] **Step 4: Run** `npx vitest run src/lab/docs.test.ts` → PASS; then `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `docs(#390): level 3 report, spec §5/§8 and glossary for the platform at (392, 178)`.

### Task 4: Site capture

**Files:**
- Create: `docs/superpowers/specs/assets/389-carteles-sitio/plataforma-sitio.png` (2732 × 1314)

- [ ] **Step 1:** `npm run dev -- --host --port 5173`; agent-browser `set viewport 1366 657 2`, open `http://localhost:5173/`, wait ~3 s, screenshot to the path above.
- [ ] **Step 2: Verify**: PNG header size is 2732 × 1314; looking at it, the platform with "Writing" stands in the sea between the two buoys.
- [ ] **Step 3: Commit** `docs(#390): site capture of the Writing platform`.

## Assumptions

- **Accent count of `sea()`** (technical): the issue's "4 `dot` (the two of today plus hut and mast)" is pinned as total `4 + signTris` with the real kinds (3 dots, 1 + signTris polys), because one of "the two of today" is the keeper's window, a `poly` (`src/scenes/sea.ts` `keeperHouse`). Rejected: asserting 4 dots, which contradicts the code.
- **Sea materials** (technical): `SEA_MATS` gains `boxGrey` and `officeDark`, and `sharedWithBlog` gains only what `world.test.ts` rejects (`boxGrey`, the hut; `officeDark` only appears in the tech district, which that test does not compare). Rejected: changing the hut's material, which would move the `plataforma` piece hash the issue forbids touching.
- **CONTEXT.md** (technical): the Sign and Exhibit entries are corrected now (site (392, 178), Blog sign in the world, `build` optional) so the glossary does not lie between children; the full rewrite stays in #394.
- **Level 3 failure** (technical): if `npm run legibility` reports a ✗ or aborts, its outputs are restored with `git checkout -- docs/superpowers/specs/assets/carteles-legibilidad` and the stage is reported as blocked; no half-regenerated report is committed.

## Grilling

Round 1 (griller: fable), 16 questions. Sources: ISSUE 7, CODE 13, DOC 0 (several answers cite both), NO SOURCE 2 → technical assumptions (Q3 accent count, Q11 level-3 failure handling). No spec ambiguity, no out-of-scope issue opened. The plan did not change substantially (only `## Assumptions` added): no second round.

1. Lane measurement at (392, 178) — ISSUE: "Con el centro en **(392, 178)**: 14,7 u al carril, 0 muestras detrás, ninguna pieza de barco … cruza el rectángulo de pantalla de las letras". The planning spike also ran `npm test` with the site moved and `sea()` building the platform: `sea-anim.test.ts` passed.
2. Baseline — CODE: `src/scenes/world-baseline.test.ts:14-45` hashes only `piece` exhibits (`if (e.kind !== "piece") continue`); no world/sea hash exists.
3. NO SOURCE → assumption (accent count). ISSUE: "los acentos estáticos del mar son 4 `dot` (los dos de hoy más casilla y mástil) y tantos `poly` como triángulos"; CODE `sea.ts` `keeperHouse` pushes a `poly`.
4. CODE: `src/lab/crop.ts:28-31` `cropSolid` returns the solid whole when its bounds overlap the box (no clipping). The panel is inside: ISSUE "caja AABB de los sólidos x 361..423, y 147..209" ⊂ 358..426 × 144..212.
5. CODE: `src/scenes/sea.ts` `sea()` only `push`es in order; the tests call `sea(rng)` directly (`sea.test.ts` `scene()`), not `assembleWorld`.
6. CODE: `src/lab/signs.test.ts:20` uses `contextScene(scene, e).solids`, not `e.build`.
7. CODE: `src/lab/storybook.ts:79` goes through `contextScene`/`contextAnimators`; `scripts/legibility.ts` imports only `contextScene` (no `e.build`/`e.animate`). `signs.test.ts` and `exhibits.test.ts` exercise `contextScene` with the `build`-less exhibit.
8. CODE: `src/map/geo.ts` `worldZoneAt`; ISSUE: "toda la cubierta y todos los acentos en zona `blog`… En (391, 179) la esquina SO ya es `cv`: no correr más". Pinned by the new `veil.test.ts` test.
9. CODE: `src/lab/exhibits.test.ts:34` `SLACK = 8`; `:144-152` "framing…" and "neighbors…" (and `:425-434` for contexts); `src/lab/exhibits.ts:251-252` `boyas` `h: 4`. The spike failed both rules for `boyas`.
10. CODE: `src/scenes/sea-anim.test.ts:5-12` already imports `hullsIntersect`, `screenHull` (`../iso/depth`), `project`, `bounds`, `laneAt`, `laneLength`, `SHIPS` (`./sea-anim`), `ship`, `shipAt` (`./ships`). Nothing to create.
11. CODE: `src/lab/docs.test.ts:525-531` counts 18 = 3 contexts × 2 scales × 3 metrics; failure handling → assumption.
12. CODE: `src/scenes/world.test.ts:78-79` — every Blog material that Portfolio or the city also uses must be in `sharedWithBlog`; `officeDark` is not in it and is not used by those scenes.
13. CODE: `src/lab/exhibits.ts:265` `plataforma-escena` has no `animate`; ISSUE: "los acentos del cartel son estáticos y van a `SeaScene.accents`".
14. CODE: `src/lab/docs.test.ts:545-550` matches `PLATFORM_SITE` and `(392, 178)` built from the constant inside §5; `grep "400, 170"` finds only §5 line 204 in the spec, plus CONTEXT.md and the code.
15. CODE: branch created from `origin/feature/389-carteles-en-el-mapa` (6d5f569); `src/scenes/sign-platform.ts:25` `PLATFORM_SITE = v3(400, 170, 0)`, `src/lab/exhibits.ts:265` `plataforma-escena` with `build: seaPlatformAt`.
16. ISSUE: "se espera ~3 s y se captura; la plataforma con Writing se ve en el mar entre las boyas"; ISSUE (#389 plan comment, factory): "en `coverView(1366, 657)` … los tres carteles entran enteros". Task 4 verifies by looking at the capture.
