# Writing with two sites (#427) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Writing platform leaves the static sea and becomes a relocatable animator with two sites (`wide` (550, 125), `tall` (440, 400)); signs, hit test, storybook and docs follow the active site. The site itself stays pinned to `wide` (the host rule comes in #428).

**Architecture:** `sign-platform.ts` builds deck and sign around any point `at` (no translate round trip) and exports one `SignSpec` per site. A new `platformAnimator` owns two layers (`platform.solid`, `platform.lights`), caches one build per site and reports both layers on the first tick after a site change. `assembleWorld` registers it just before `seaAnimator`; `signs.ts` gets `zoneSigns(site)`; the storybook's context exhibits add the platform of their `writingSite` and drop the animator.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (runtime only; nothing here touches Pixi), agent-browser for captures.

**Spec:** issue #427 (its "Diseño (decidido)" and "Criterios de aceptación" are binding), within `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md` §3.2, §5.4, §5.6, §5.7. Parent story #423.

## Global Constraints

- `PLATFORM_SITES = { wide: v3(550, 125, 0), tall: v3(440, 400, 0) }`; `type WritingSite = "wide" | "tall"`.
- `PLATFORM_SITE` and `BLOG_SIGN` disappear; `SIGNS` disappears (`zoneSigns(site)` replaces it).
- Both `BLOG_SIGNS` entries keep `id: "plataforma"`, 7 glyphs ("Writing"), one `officeDark` panel as `backing`.
- Layer ids are exactly `platform.solid` and `platform.lights`; the lights layer has no `zone`.
- The platform animator is tagged `"blog"` and sits **immediately before** the `seaAnimator` in `animators`.
- `main.ts` keeps the site fixed: `const site: WritingSite = "wide"` with a comment that the host rule is wired by a later child (#428).
- Exhibit boxes: `plataforma-escena` `{ x0: 516, y0: 91, x1: 584, y1: 159 }`, `plataforma-escena-angosta` `{ x0: 406, y0: 366, x1: 474, y1: 434 }`, both `h: 24`; new title "Writing platform sign in its scene, tall site"; order `plataforma`, `plataforma-escena`, `plataforma-escena-angosta`.
- Budgets: static world accents ≤ 2600 and static polygons ≤ 56 000 stay; both must drop below the base branch's 2 409 accents and 46 518 polygons.
- Code, comments and test names in English; exhibit ids stay Spanish (`src/english.test.ts`).
- The 2026-11-17 spec is history: its tables are not regenerated, its tests pin the literals it already has.

## Review Focus

1. `setSite("tall")` then `setSite("wide")` before any tick: the site did not change since the last tick, so `tick` returns the empty set (no needless redraw). Test in Task 2.
2. Flipping sites back and forth reuses the cached build: `layer("platform.solid").solids` is the same array object each time a site comes back (no rebuild, no garbage per flip). Test in Task 2.
3. `tick` with `dt` 0, negative or `NaN` still reports a pending site change (the site change is not motion; `reducedMotion` does not apply). Test in Task 2.
4. A crop of the wide-site context exhibit never shows two platforms: the crop adds the platform of `writingSite` and drops the animator even when the animator's platform lies in the box. Test in Task 4 (exactly one `deck` poly across scene + animator layers).
5. A consumer that mutates the animator's solids must not reach `BLOG_SIGNS[site].backing` (the panel in the layer is an equal copy, not the same object). Test in Task 1 (`seaPlatformAt` panel `toEqual` but `not.toBe` the backing).

---

**Importers of the removed names** (grep on the base branch): `PLATFORM_SITE` — `src/lab/docs.test.ts`, `src/scenes/sign-platform.test.ts`; `BLOG_SIGN` — `src/world/signs.ts`, `src/lab/exhibits.ts`, `src/lab/exhibits.test.ts`, `src/scenes/sea.test.ts`, `src/world/signs.test.ts`, `scripts/legibility.test.ts`; `SIGNS` — `src/main.ts`, `src/scenes/sea-anim.test.ts`, `src/lab/docs.test.ts`, `src/world/signs.test.ts`; `seaPlatformAt` — `src/scenes/sea.ts`, `src/world/veil.test.ts`, `src/scenes/sea.test.ts`. `zoneAtScreen` has one runtime caller, `src/main.ts:99`. Other `assembleWorld` callers (`src/lab/page.ts`, `src/lab/storybook.ts`, `scripts/legibility.ts`, `scripts/wreck-sweep.ts`) destructure `{ scene, animators }` and need no change: the new `platform` field is additive, and the platform is in `animators`.

**Ordering note.** Tasks 1–4 are one migration: Task 1 removes `PLATFORM_SITE`/`BLOG_SIGN`, so typecheck and the files importing them stay red until Task 4 ends. Each task runs its own test files; `npm test` and `npm run typecheck` must be green from the end of Task 4 on. Tasks 5 and 6 keep them green.

### Task 1: Two sites in `sign-platform.ts`

**Files:**
- Modify: `src/scenes/sign-platform.ts`
- Test: `src/scenes/sign-platform.test.ts`, `src/scenes/world-baseline.test.ts`

**Interfaces:**
- Produces: `export type WritingSite = "wide" | "tall"`; `export const PLATFORM_SITES: Record<WritingSite, Vec3>`; `export const BLOG_SIGNS: Record<WritingSite, SignSpec>`; `export function seaPlatformAt(out: Solid[], accents: Accent[], site: WritingSite): void`; `export function seaPlatform(out: Solid[], accents: Accent[]): void` (piece at the origin). `DECK_HALF`, `PLATFORM_DECK`, `WRITING_CAP`, `DECK_TOP`, `RAIL_POST` unchanged.

- [ ] **Step 1: Failing tests** in `sign-platform.test.ts` (replace the `PLATFORM_SITE` / `BLOG_SIGN` ones; keep the piece tests on `seaPlatform`):
  - `PLATFORM_SITES` equals `{ wide: { x: 550, y: 125, z: 0 }, tall: { x: 440, y: 400, z: 0 } }`.
  - `describe.each(["wide", "tall"])`: `BLOG_SIGNS[site]` matches `{ id: "plataforma", text: "Writing", size: WRITING_CAP, … }` as today, 7 glyphs spelling "Writing"; `seaPlatformAt(…, site)` cyan polys equal the triangles of `BLOG_SIGNS[site].glyphs` at 0.85; its single `officeDark` poly `toEqual(BLOG_SIGNS[site].backing)` and `not.toBe(BLOG_SIGNS[site].backing[0])`; the panel/frame tests that today use `BLOG_SIGN` run per site.
  - `seaPlatform is seaPlatformAt(site) moved by −PLATFORM_SITES[site]` for both sites, with the existing 1e-9 rounding helper.
- [ ] **Step 2: Run** `npx vitest run src/scenes/sign-platform.test.ts` — expect FAIL (`PLATFORM_SITES` undefined).
- [ ] **Step 3: Implement.** Generalise the module-level `site(q)`, `WORD_ORIGIN` and `PANEL` into functions of `at: Vec2`; build deck, fittings and sign directly around `at` (the origin piece is `at = (0, 0)`, with its own internal `SignSpec`). `BLOG_SIGNS` holds one `signSpec` per site; `sign()` reads the glyphs of the spec for its `at` and still copies the panel. No `translate`/`translateAccent` remains in this module.
- [ ] **Step 4: Run** `npx vitest run src/scenes/sign-platform.test.ts src/scenes/world-baseline.test.ts`. If only the `plataforma` hash changed, re-record it and extend the comment: `#427: built at the origin directly instead of moved back from its site (float noise)`. Any other baseline change is a bug.
- [ ] **Step 5: Commit** `feat(#427): two Writing sites in sign-platform`.

### Task 2: `platformAnimator`

**Files:**
- Create: `src/scenes/platform-animator.ts`
- Test: `src/scenes/platform-animator.test.ts` (no Pixi)

**Interfaces:**
- Consumes: `seaPlatformAt`, `WritingSite` (Task 1); `Animator`, `AnimLayer`, `layerLookup` (`src/scenes/animator.ts`).
- Produces: `export interface PlatformAnimator extends Animator { readonly site: WritingSite; setSite(site: WritingSite): void }`; `export function platformAnimator(opts: { site?: WritingSite } = {}): PlatformAnimator` (default `"wide"`).

- [ ] **Step 1: Failing tests:**
  - `ids` equal `["platform.solid", "platform.lights"]`; default `site` is `"wide"`; `platformAnimator({ site: "tall" }).site` is `"tall"`.
  - `layer("platform.solid")` is `{ kind: "solid", solids }` with `solids` equal to `seaPlatformAt(…, "wide")`'s solids; `layer("platform.lights")` is `{ kind: "accent", accents }` equal to its accents and has no `zone` key.
  - `tick(16)` with no change → empty set. `setSite("tall")`; `tick(16)` → `new Set(["platform.solid", "platform.lights"])`; then `layer("platform.solid").solids` equals `seaPlatformAt(…, "tall")`'s; a second `tick(16)` → empty.
  - `setSite` with the current site → next tick empty.
  - Review Focus 1: `setSite("tall"); setSite("wide"); tick(16)` → empty.
  - Review Focus 2: after wide → tall → wide (ticking between), `layer("platform.solid").solids` is `toBe` the first wide array.
  - Review Focus 3: `setSite("tall")` then `tick(0)` / `tick(NaN)` → both layers.
  - Unknown layer id throws (via `layerLookup`).
- [ ] **Step 2: Run** `npx vitest run src/scenes/platform-animator.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement** in `platform-animator.ts`: a `Map<WritingSite, { solids; accents }>` filled lazily with `seaPlatformAt`; `site` getter; `tick` compares the current site with the one seen at the previous tick (initial value: the starting site).
- [ ] **Step 4: Run** the test — PASS.
- [ ] **Step 5: Commit** `feat(#427): platformAnimator, the relocatable Writing platform`.

### Task 3: The world takes the platform from the animator

**Files:**
- Modify: `src/scenes/sea.ts` (drop the `seaPlatformAt` call and import; fix the buoy/platform comments), `src/world/assemble.ts`, `src/world/signs.ts`, `src/main.ts`
- Test: `src/scenes/sea.test.ts`, `src/world/veil.test.ts`, `src/scenes/city-budget.test.ts`, `src/scenes/world.test.ts`, `src/scenes/sea-anim.test.ts`, `src/world/signs.test.ts`, `src/world/assemble.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `Assembled = { scene: WorldScene; animators: ZonedAnimator[]; platform: PlatformAnimator | null }` (non-null iff `scene.sea`); `export function zoneSigns(site: WritingSite): Record<ZoneId, SignSpec>` (memoised per site so `signBox`/`signPolygons` memo by identity keeps working); `export function zoneAtScreen(v: View, px: number, py: number, site: WritingSite): ZoneId`.

- [ ] **Step 1: Failing tests:**
  - `sea.test.ts`: "sea() no longer builds the Writing platform": no solid of `seaPlatformAt` at either site is `toContainEqual`-ed in `sea(rng).solids`, no `deck`-poly / `boxGrey` solid, and `s.accents` has length 2 (keeper's window poly, wreck buoy spot); `world(7).solids`/`.accents` contain none of either site's platform pieces. Drop the old `4 + signTris` count and `slice(2)` platform check. `SEA_MATS` loses `boxGrey`, `officeDark`.
  - `veil.test.ts`: every accent of `seaPlatformAt(…, site)` is `blog` for `wide` and `tall`.
  - `assemble.test.ts`: whole world → `platform` non-null, `platform.site === "wide"`, `animators` includes it with `zone === "blog"`, `animators.indexOf(platform) === animators.findIndex((a) => a.ids.includes("sea.beam")) - 1`; blog count becomes 2 (sea, platform). `assembleWorld(["portfolio"])` → `platform === null`; `assembleWorld(["blog"])` → non-null.
  - `city-budget.test.ts`: limits stay (≤ 56 000, ≤ 2600) and two new assertions pin the drop: static polygons `< 46518` and static accents `< 2409` (the base branch's values, issue: "los valores bajan respecto de `main`"); the comment drops "platform 654 + 2" and says the platform is animated (`platform.lights`), not static. Expected: accents 2409 − 656 = 1753.
  - `world.test.ts`: `sharedWithBlog` loses `boxGrey` and `officeDark` (and their comment) if the test then fails because blog no longer has them — keep the list exact to what the test measures.
  - `sea-anim.test.ts`: the two occlusion tests use `staticsOf([...world(7).solids, ...platformSolids("wide"), ...platformSolids("tall")])`; "no ship piece … crosses the letters" iterates the letters of `zoneSigns("wide")` and `zoneSigns("tall")` (dedupe the shared portfolio/cv signs; name failures `${site} ${id}`).
  - `world/signs.test.ts`: `zoneSigns(site)` maps portfolio → `TINKER_SIGN`, cv → `RESUME_SIGN`, blog → `BLOG_SIGNS[site]` for both sites and returns the same object on repeated calls; `ALL` covers both sites; `zoneAtScreen` tests take a site (the "sign wins over geography" test searches each site's blog sign for a point whose `worldZoneAt` differs from `blog`, or over a non-blog sign if no such point exists — keep the assertion that the sign wins); the 390×750 `labelLayout` test uses `zoneSigns("wide").blog` and asserts the mode the code computes (record the measured mode in the test comment).
- [ ] **Step 2: Run** those files — FAIL.
- [ ] **Step 3: Implement.** `assembleWorld`: `const platform = scene.sea ? platformAnimator() : null;` push `tag(platform, "blog")` right before the sea animator. `signs.ts`: drop `SIGNS`; `zoneSigns`; `zoneAtScreen` iterates `zoneSigns(site)`. `main.ts`: `const site: WritingSite = "wide"; // the host rule is wired by a later child (#428)`, `platform?.setSite(site)` after `assembleWorld`, `zoneSigns(site)[id]` in `placeLabels`, `zoneAtScreen(…, site)`.
- [ ] **Step 4: Run** the files above — PASS.
- [ ] **Step 5: Commit** `feat(#427): the world takes the Writing platform from platformAnimator`.

### Task 4: Storybook exhibits per site

**Files:**
- Modify: `src/lab/exhibits.ts`, `src/lab/crop.ts`
- Test: `src/lab/exhibits.test.ts`, `src/lab/crop.test.ts`, `src/lab/signs.test.ts`, `src/english.test.ts`, `scripts/legibility.test.ts` (only if it imports `BLOG_SIGN`: use `BLOG_SIGNS.wide`)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: context variant of `Exhibit` gains `writingSite?: WritingSite`; `contextScene(scene, e)` and `contextAnimators(animators, e)` keep their signatures.

- [ ] **Step 1: Failing tests:**
  - `exhibits.test.ts`: `plataforma-escena` matches `{ title: "Writing platform sign in its scene", zone: "blog", group: "sea", kind: "context", box: { x0: 516, y0: 91, x1: 584, y1: 159 }, h: 24, sign: BLOG_SIGNS.wide, writingSite: "wide" }`; `plataforma-escena-angosta` matches `{ title: "Writing platform sign in its scene, tall site", …, box: { x0: 406, y0: 366, x1: 474, y1: 434 }, h: 24, sign: BLOG_SIGNS.tall, writingSite: "tall" }`; ids order `plataforma`, `plataforma-escena`, `plataforma-escena-angosta` consecutive. The existing framing test (`h` ≤ measured + SLACK) covers the re-measured `boyas` `h`.
  - Review Focus 4, in `exhibits.test.ts`, for both writing exhibits: across `contextScene(scene, e).solids` plus the solid layers of `contextAnimators(animators, e)`, exactly one `deck` poly and exactly 75 solids equal to `seaPlatformAt(…, e.writingSite)`'s (and `seaPlatformAt` builds 75); no animator of `contextAnimators` has `platform.solid`; `readout(cs, anims).solids` equals `cs.solids.length` plus the animators' solid-layer lengths.
  - `crop.test.ts`: with a toy context exhibit carrying `writingSite: "tall"`, `contextScene` equals `cropScene` plus the cropped platform solids/accents of that site; `contextAnimators` drops an animator whose ids include `platform.solid` and keeps the others.
  - `signs.test.ts`: `near` = solids of `[...scene.solids, ...(e.writingSite ? platform(e.writingSite) : [])]` crossing the grown box; the existing gates then run for `plataforma-escena-angosta` too.
  - `english.test.ts`: `EXHIBIT_IDS` alternation `plataforma(-escena(-angosta)?)?`.
- [ ] **Step 2: Run** those files — FAIL.
- [ ] **Step 3: Implement.** `crop.ts`: when `e.writingSite`, build `seaPlatformAt(…, e.writingSite)` once per site (memo), append `cropSolids`/`cropAccents` of it to the cropped scene's `solids`/`accents`; `contextAnimators` filters out `a.ids.includes("platform.solid")` before `cropAnimators`. `exhibits.ts`: the two entries above (comment the `h` reasoning as today); re-measure `boyas` `h` (smallest integer ≥ its tallest content; the platform is no longer in its box) and fix its comment.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` — both green (end of the migration).
- [ ] **Step 5: Commit** `feat(#427): storybook context exhibits per Writing site`.

### Task 5: Docs and the history spec

**Files:**
- Modify: `docs/superpowers/specs/2026-11-17-carteles-de-zona-integracion-design.md` (one line under **Estado**), `CONTEXT.md` (*Sign*, *Animator*), `README.md` (storybook paragraph)
- Test: `src/lab/docs.test.ts`, `src/docs-glossary.test.ts`

- [ ] **Step 1: Failing tests:**
  - `docs.test.ts` (2026-11-17 spec): the line after `**Estado:** implementado` is exactly `**Superada en parte:** #423 (spec 2026-11-18) muda la plataforma de Writing a dos sitios y cambia \`COVER_FOCUS_U\`; las tablas de §3, §4 y §5 describen el estado en #394.`; §3 test pins `PLATFORM_SITE` row to literal `(392, 178)`; §5 pins `polígonos estáticos` to `46518` and `acentos estáticos del mundo` to `2409` (comment: the spec is history since #427, the live values moved); §4 keeps computing `portfolio`/`cv` rows with `coverView` × `signBox(zoneSigns("wide")[id])` and pins both `blog` rows (laptop `747.5..846.5 × 397.2..425.2` `sign`, phone `463.2..567.8 × 447.6..477.1` `edge`) as literals. (Deviation from the issue, which expected the laptop `blog` row to keep passing: the sign moved, so its live box moved too.) In the 2026-11-15 redesign spec tests, `at(PLATFORM_SITE, false)` becomes the literal `(392, 178)`.
  - `docs-glossary.test.ts`: *Sign* names `PLATFORM_SITES`, `BLOG_SIGNS`, `platformAnimator`, `platform.solid`, `platform.lights`, `setSite`, `zoneSigns`, `plataforma-escena-angosta` and not `PLATFORM_SITE` as a word (`/\bPLATFORM_SITE\b/`) nor `BLOG_SIGN\b`; the `src/world/signs.ts` code ref lists `zoneSigns`, `zoneAtScreen`, `labelLayout`; *Animator* names `platform` returned by `assembleWorld` (`PlatformAnimator`).
  - `docs.test.ts` or `docs-glossary.test.ts`: README storybook paragraph contains `#plataforma`, `#plataforma-escena` and `#plataforma-escena-angosta`.
- [ ] **Step 2: Run** both files — FAIL.
- [ ] **Step 3: Edit** the spec line, `CONTEXT.md` and `README.md` as the issue's design items 7–8 say; every identifier a `Code:` line names must exist in its file.
- [ ] **Step 4: Run** `npm test` — green.
- [ ] **Step 5: Commit** `docs(#427): Writing two sites in CONTEXT, README and the 2026-11-17 spec`.

### Task 6: Captures

**Files:**
- Create: `docs/superpowers/specs/assets/423-composicion-responsive/plataforma-escena-angosta-117.png`, `…/sitio-1600x900-ancho.png`
- Test: `src/lab/docs.test.ts`

- [ ] **Step 1: Failing test:** both PNGs exist and are 3200×1800 (use the `size()` helper of `docs.test.ts`).
- [ ] **Step 2: Capture** with agent-browser (`agent-browser set viewport 1600 900 2`, dev server `npm run dev -- --host --port 5173`): `http://localhost:5173/lab/storybook.html?bloom=on#plataforma-escena-angosta`, press `c` until the cover scale reads 1.17, screenshot; then `http://localhost:5173/` after the first render, screenshot. "First render" = the `[mapa] first draw` / `[storybook]` console line has been printed and `__PIXI_DEVTOOLS_WRAPPER__.stage.children.length > 0`, then wait 3 s. Pass criterion: the tall exhibit shows the platform with sea around; the site shows the platform at (550, 125) bottom right and the rest as before.
- [ ] **Step 3: Run** `npm test` — green.
- [ ] **Step 4: Commit** `docs(#427): captures of the tall exhibit and the site at 1600×900`.

## Assumptions

- **Red typecheck between Tasks 1 and 4.** The per-task commits of the migration may leave `npm run typecheck` red; the branch is squash-merged (one commit lands on the story branch), so no red commit reaches `feature/423-composicion-responsive`. Rejected: keeping `PLATFORM_SITE`/`BLOG_SIGN` as temporary aliases (dead code at an old site the issue deletes). Rollback unit: the agent branch.
- **Budget drop asserted.** `city-budget.test.ts` pins `< 46518` and `< 2409` (base-branch values) besides the caps. Rejected: only reporting the numbers in the PR.
- **`blog` rows of the 2026-11-17 §4 table pinned as literals, laptop included.** The issue expected the laptop row to keep passing, but the sign moved from (392, 178) to (550, 125), so its live screen box moved too; the issue's intent ("es historia", pin the literals the spec already has) decides. Recorded in the PR.
- **Platform build in the storybook crop.** `contextScene` builds `seaPlatformAt(…, writingSite)` on its own (memoised per site in `crop.ts`), separate from the animator's cache; both come from the same builder, and `BLOG_SIGNS` stays the single definition of the sign. Rejected: reading the platform from the world's animator (the tall exhibit needs the tall build while the animator sits on wide).
- **Capture readiness signal.** Console line of the first draw plus a stage with children, then 3 s.

## Grilling

- Rounds: 1 (the plan changed by additions only: an importer list, two budget assertions, a capture criterion; no task added or removed, so no second round).
- Questions: 18. Sources: ISSUE 4 (Q2 "los valores bajan respecto de `main`", Q4 boxes and sites quoted from the issue's design items 1 and 5, Q10 "Si el hash de `plataforma` … cambia por ruido flotante, regrabalo", Q14 "es historia"), CODE 9 (Q3 `src/world/stage.ts:111-113,133,184`; Q5 `src/lab/page.ts:47`, `src/lab/storybook.ts:49`, `scripts/legibility.ts:45`, `scripts/wreck-sweep.ts:62`; Q6 `src/lab/crop.ts` `cropLayer` returns fresh arrays, no in-place writes to layer solids in `src/world`, `src/iso`, `src/lab`, same cache pattern as `src/scenes/sign-tinker.ts:276-277`; Q7 `src/world/signs.ts:25-26` WeakMaps keyed by the `SignSpec`, and `TINKER_SIGN`/`RESUME_SIGN` are the same objects in both records; Q8 `src/main.ts:99`; Q9 `src/world/stage.ts:133`; Q11 `src/scenes/sign-tinker.ts:284` (per-animator) and `src/world/stage.ts:184` (the host ticks every animator); Q13 sea-group exhibit boxes in `src/lab/exhibits.ts:246-267`, only `boyas` and `plataforma-escena` contain (392, 178); Q15 `src/world/stage.ts:115-118`, `src/world/veil.ts:87-99`, `src/map/geo.ts:78-81`), DOC 1 (Q18 `src/english.test.ts` guard on exhibit ids, README anchors get a test in Task 5), NO SOURCE 4 → technical assumptions (Q1 with Q17, Q12, Q16); 0 spec ambiguities; 0 out of scope.
- Assumptions: see above.
- Issues opened: none.
