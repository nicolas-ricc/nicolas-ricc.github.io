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
