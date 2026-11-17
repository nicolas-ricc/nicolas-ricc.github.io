# Portfolio tinker sign on the south hall, with its animator in the world; context exhibits become crops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `shipyard()` builds the PORTFOLIO tinker sign at `TINKER_SITE`, `assembleWorld` adds its `tinkerAnimator` tagged `portfolio`, and the `context` exhibit kind loses `build` and `animate` for good: every context exhibit is a crop of the world.

**Architecture:** `shipyard()` calls `tinkerSign(solids, accents, TINKER_SITE)` right after `halls(solids)`, so the sign's solids and static accents flow through `Scene` into `world()` like the halls, and `portfolioWindows` (which runs last) skips the hall windows the sign hides. `assembleWorld` pushes `tag(tinkerAnimator({ reducedMotion }), "portfolio")` when there is a shipyard. `ContextExhibit` drops `build?`/`animate?`; `contextScene` / `contextAnimators` keep their names (storybook, `signs.test.ts`, `scripts/legibility.ts`) and become `cropScene` / `cropAnimators`.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS v8 (renderer only), tsx scripts, agent-browser.

**Spec:** issue #392 (child of #389) — the issue body is the spec. Background: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§3.2, §5, §7, §8) and the plans of the previous children, `docs/plans/2026-11-17-390-plataforma-en-el-mar.md` and `docs/plans/2026-11-17-391-corona-sobre-la-torre.md`.

## Global Constraints

- Base branch: `feature/389-carteles-en-el-mapa`; the PR goes there, not to `main`.
- `npm test` and `npm run typecheck` green at the end of every task.
- Code, comments, strings and identifiers in `src/`, `lab/`, `scripts/`, README and CLAUDE.md in **English** (`src/english.test.ts`); exhibit ids and `docs/` stay in Spanish.
- `src/iso`, `src/kit`, `src/scenes` stay Pixi-free; deterministic (no `Math.random`); no hex outside `src/map/palette-iso.ts`.
- `src/main.ts`, `index.html`, `style.css` and the camera do not change.
- The `cartel-taller` piece does not change; `src/scenes/world-baseline.test.ts` stays green without re-recording.
- `sign-tinker.ts` geometry does not change (`TINKER_SITE`, `SHIPYARD_HALLS`, `tinkerSign`, `tinkerAnimator`).
- `REPORT.md` is only written by `npm run legibility` (full run).

## Review Focus

Measured in a spike (tinker call added to `shipyard()`, full suite): 9 tests fail beyond the issue's list of 4. Each one is owned below.

1. **Shipyard-local rules that never knew the sign** — `shipyard.test.ts` "accents outside the station are cyan" (the sign brings 114 + 84 amber/amberMid accents) and "north band … y −60..−13 and does not exceed z 22" (the sign reaches z 31.76 and its west posts stand at y ≈ −6.4). Expected: the sign is exempt by deep equality with `tinkerSign([], [], TINKER_SITE)`, with a count check so the exemption matches the sign and nothing else; real intruders still fail. (Task 1.)
2. **#247 plan rule against the factory siding** (`world.test.ts` "the shipyard in the north band does not touch the siding…"): the sign's west end leaves the hall; its beams at z ≥ 16.6 cross the siding only in plan, and one ground post (x 44.41..44.71, y −8.71..−8.41, z 0..16.6) stands on the siding's north rail strip (y −9..−8.6, z 0.1). Expected: sign solids exempt from this plan-only rule (same identity exemption); the post-on-rail is recorded as a deviation, not fixed here (assumption A1). (Task 1.)
3. **Shared materials** (`world.test.ts`, `sharedWithCity`): the sign's `officeDark` panels make `officeDark` the 17th Portfolio ∩ Resume material. Expected: it joins the list with a `#392` note. (Task 1.)
4. **Self-collision of the sign test** (`sign-tinker.test.ts` "no sign solid overlaps a world solid…" and "levels 1–2 against the world…"): the world now contains the sign, so the sign overlaps itself and the level-2 list holds two copies. Expected: the overlap test drops the world's copy (by deep equality) before comparing; the level-2 test uses the world as is, with no extra copy. (Task 1.)
5. **Context exhibit readers of `build`/`animate`** (`src/lab/storybook.ts:80`, `src/lab/crop.test.ts:270-318`, `exhibits.test.ts` `built`/`builders`/`measureContext`): after the type closes, nothing may read them. Expected: `npm run typecheck` fails on any reader left, and `grep -n "e\.build\|e\.animate\|\.animate?\|\.build?\." src lab scripts` only hits `piece` code paths. (Task 3.)

---

### Task 1: `shipyard()` builds the tinker sign

**Files:**
- Modify: `src/scenes/shipyard.ts` (import; `shipyard()` calls `tinkerSign(solids, accents, TINKER_SITE)` on the line after `halls(solids)`; one line in the header doc: the tinker sign on the south hall's ridge, `sign-tinker.ts`)
- Modify: `src/lab/exhibits.ts:110` (`naves` `h` and a comment)
- Test: `src/scenes/shipyard.test.ts`, `src/scenes/city-budget.test.ts`, `src/scenes/world.test.ts`, `src/scenes/sign-tinker.test.ts`, `src/scenes/portfolio-accents.test.ts`, `src/world/veil.test.ts`

**Interfaces:**
- Consumes: `tinkerSign(out: Solid[], accents: Accent[], at: Vec3, halls = SHIPYARD_HALLS): void`, `TINKER_SITE`, `tinkerAnimator({ reducedMotion, at? })`, `tinkerLights(at)` (`src/scenes/sign-tinker.ts`).
- Produces: `shipyard(...).solids` contains every solid of `tinkerSign([], [], TINKER_SITE)` and `.accents` every accent of it; `Scene` type unchanged.

- [ ] **Step 1: Failing tests**
  - `shipyard.test.ts`: new `it("shipyard() builds the PORTFOLIO tinker sign at TINKER_SITE: its solids and accents are tinkerSign's (#392)")` → with `c: Solid[] = [], a: Accent[] = []; tinkerSign(c, a, TINKER_SITE)`: each `s of c` → `expect(scene().solids).toContainEqual(s)`; each `x of a` → `expect(scene().accents).toContainEqual(x)`; `expect(scene().solids.length).toBe(697)` is **not** asserted (the ≤ 900 test stays as is).
  - `shipyard.test.ts` "accents outside the station are cyan…": `outside` also drops accents deep-equal to one of `tinkerSign`'s (key set by `JSON.stringify`); title gains "; the tinker sign's are its own (#392)".
  - `shipyard.test.ts` "the north band…": `band` drops solids deep-equal to one of `tinkerSign`'s; assert in the same test that the number of shipyard solids matched that way equals the sign's solid count. Title gains "(the tinker sign aside, #392)".
  - `city-budget.test.ts`: `shipyard: 800`; the comment gains `// shipyard: 543 + the tinker sign's 154 = 697 (#392), ×1.1 rounded to the hundred`.
  - `world.test.ts`: `sharedWithCity` gains `"officeDark"`, with comment `// officeDark: panels of the tinker sign (#392) and offices of the city`; "#247" test: `band` drops the sign's solids (identity exemption as above) with comment `// the tinker sign (#392) stands over the siding at z ≥ 16.6 but for one ground post on its north rail: see the plan's assumption A1`.
  - `sign-tinker.test.ts` "no sign solid overlaps a world solid…": `world` drops solids deep-equal to one of `own` (the world's copy of the sign, #392); "levels 1–2 against the world…": `all` becomes `near` (the world holds the sign since #392), and the test also `expect(near).toEqual(expect.arrayContaining(sign(TINKER_SITE).out))`.
  - `portfolio-accents.test.ts`: `STATIC_COLORS` gains `"amberMid"`, `WARM` gains `"amberMid"`; `ruleViolations` gains a fourth allowed place, `tinker`: `p` inside the x/y box (`bounds` of every solid) of `tinkerSign([], [], TINKER_SITE)`, computed once at module level as `TINKER_BOX`; doc comment lists it. "rule 1 catches intruders" adds `{ kind: "dot", at: v3(TINKER_BOX.x1 + 1, -24, 20), r: 1, color: "amber" }` (east of the box) and `{ kind: "dot", at: v3(60, -24, 20), r: 1, color: "amberMid" }` must **not** be a violation (assert `ruleViolations([inside])` is `[]`); expected intruder count becomes 4.
  - `veil.test.ts`: `describe("Portfolio tinker sign accents (#392)")`, `it("every accent of the tinker sign at TINKER_SITE and of its tinker.lights layer is Portfolio")` → accents of `tinkerSign([], acc, TINKER_SITE)` (both kinds present) and the `tinker.lights` layer of `tinkerAnimator({ reducedMotion: true })` (non-empty): each `expect(accentZone(a)).toBe("portfolio")`.
- [ ] **Step 2: Run** `npx vitest run src/scenes/shipyard.test.ts src/scenes/city-budget.test.ts src/scenes/world.test.ts src/scenes/sign-tinker.test.ts src/scenes/portfolio-accents.test.ts src/world/veil.test.ts` → the new shipyard test FAILS (sign absent); `officeDark` in `sharedWithCity` FAILS; the veil test passes already (pure function of `tinkerSign`), that is fine.
- [ ] **Step 3: Implement** the `shipyard()` call. Then set `naves` `h` to the smallest integer that passes the framing and neighbour rules of `exhibits.test.ts` (spike: inside 31.63, cut neighbour 31.76 → **32**), comment `// h 32: the tinker sign (#392) tops out at z ≈ 31.76 (its top beam, cut by the box); smallest integer that passes framing and neighbors`. `chimeneas` keeps 36 (the sign's 22 solids there top at 17).
- [ ] **Step 4: Run** `npm test` → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#392): the shipyard builds the PORTFOLIO tinker sign on the south hall`.

### Task 2: The tinker animator joins the world

**Files:**
- Modify: `src/world/assemble.ts` (one line after the shipyard/train animators: `if (scene.shipyard) animators.push(tag(tinkerAnimator({ reducedMotion }), "portfolio"));`)
- Test: `src/world/assemble.test.ts`

**Interfaces:**
- Consumes: `tinkerAnimator`, Task 1.
- Produces: `assembleWorld(...).animators` includes one animator whose `ids` are `["tinker.lights"]`, `zone: "portfolio"`, whenever the shipyard is built.

- [ ] **Step 1: Failing tests** in `assemble.test.ts`:
  - "the whole world brings the eight animators…" → "…nine animators…"; Portfolio count 5, comment `// shipyard, train, tinker sign, factory, fair`; plus `expect(animators.filter((a) => a.ids.includes("tinker.lights"))).toHaveLength(1)` and that one's `zone` is `"portfolio"`.
  - "with a zone filter…": Portfolio count 4, comment `// shipyard, train, tinker sign and factory: without the fair (it lives in the bleed)`; `expect(animators.some((a) => a.ids.includes("tinker.lights"))).toBe(true)`.
  - new `it("with the [\"cv\"] filter no animator carries tinker.lights")`.
  - new `it("the tinker.lights layer lives in a Portfolio animator, is dimmed by the veil and with reducedMotion never redraws")` — the pattern of the `fair.neon` test.
- [ ] **Step 2: Run** `npx vitest run src/world/assemble.test.ts` → FAIL (4 Portfolio animators, no `tinker.lights`).
- [ ] **Step 3: Implement** the line in `assembleWorld`.
- [ ] **Step 4: Run** `npm test` → PASS (including `src/world/stage.test.ts` and `src/lab`); `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#392): the tinker animator joins the world, tagged portfolio`.

### Task 3: Close the `context` kind: crops only

**Files:**
- Modify: `src/lab/exhibits.ts:51-55` (type doc and `context` variant without `build?`/`animate?`), `:136-137` (`cartel-taller-escena`: box, `h`, `sign` only; comment)
- Modify: `src/lab/crop.ts:92-103` (`contextScene(scene, e)` = `cropScene(scene, e.box)`; `contextAnimators(animators, e)` = `cropAnimators(animators, e.box)`, the `reducedMotion` parameter and the `tag` import go; doc comments)
- Modify: `src/lab/storybook.ts:80` (`contextAnimators(animators, e)`)
- Modify: `CONTEXT.md` (Exhibit: a `context` is a crop of the world, no `build`; Sign: the Portfolio sign is in the world, built by `shipyard()`, its animator by `assembleWorld`, `cartel-taller-escena` is a crop)
- Test: `src/lab/exhibits.test.ts:386-449`, `src/lab/crop.test.ts:270-318`

**Interfaces:**
- Produces: `type ContextExhibit = { id; title; zone; group; kind: "context"; box: Box; h?: number; sign: SignSpec }`; `contextScene(scene: WorldScene, e: ContextExhibit): WorldScene`; `contextAnimators(animators: readonly ZonedAnimator[], e: ContextExhibit): ZonedAnimator[]`.

- [ ] **Step 1: Failing tests**
  - `exhibits.test.ts`: delete `built`, `builders`, "build is deterministic" and "every solid and every accent point of build falls inside the box"; `measureContext` loses `own` (`accents: accentReach(e.box)`); its doc becomes "Like `measure`, on the context scene". New `it("no context exhibit has build or animate (#392)")` → for every context, `expect("build" in e).toBe(false)` and `expect("animate" in e).toBe(false)`. The `plataforma-escena` and `cartel-torre-escena` tests replace `expect(e.build).toBeUndefined()` with `expect("build" in e).toBe(false)`. The "(#379)" test becomes `"cartel-taller-escena (#379, #392): after cartel-taller, in the shipyard, the issue's box, a crop of the world with the sign and its animator"`: `toMatchObject` gains `box: { x0: 20, y0: -58, x1: 100, y1: 0 }`; drops `expect(e.animate).toBeDefined()`; each solid of `tinkerSign(c, d, TINKER_SITE)` → `expect(cs.solids).toContainEqual(s)`, each accent → `expect(cs.accents).toContainEqual(x)`; `const a = contextAnimators(animators, e).find((x) => x.ids.includes("tinker.lights"))`, `expect(a?.zone).toBe("portfolio")`.
  - `crop.test.ts` describe "contextScene / contextAnimators (#376)" → "(#376, #392)": `base` without `build`; `it("the crop of the world, nothing added")` → `contextScene(scene, e)` deep-equals `cropScene(scene, box)`; "does not mutate" stays; `it("the same as cropAnimators")` stays (renamed from "without animate"); delete "with animate: appended…".
- [ ] **Step 2: Run** `npm run typecheck` → FAIL (`build`/`animate` still in the type is fine, but `cartel-taller-escena` tests fail at runtime); `npx vitest run src/lab/exhibits.test.ts src/lab/crop.test.ts` → FAIL ("no context exhibit has build or animate").
- [ ] **Step 3: Implement** the type, `crop.ts`, `storybook.ts`, `cartel-taller-escena` (drop `build` and `animate`; keep `h: 34` — it still passes, `31.76 ≤ 34 ≤ 39.76` — comment `// h 34: the sign tops out at z ≈ 31.76; the sign and its animator come from the world (shipyard() and assembleWorld, #392): no build, no animate`), and the two CONTEXT.md entries. Remove now-unused imports (`tinkerSign`, `tinkerAnimator`, `TINKER_SITE` in `exhibits.ts` if only the piece uses them; `tag` in `crop.ts`).
- [ ] **Step 4: Run** `npm run typecheck` → PASS; `npm test` → PASS (including `signs.test.ts` levels 1–2 and `world-baseline.test.ts`); `grep -n "e\.build\|e\.animate" src lab scripts` → only `piece` paths.
- [ ] **Step 5: Commit** `feat(#392): context exhibits are crops of the world, without build or animate`.

### Task 4: Level 3 report and spec

**Files:**
- Regenerate: `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` and its PNG crops (`npm run legibility`, full run)
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§8.1 rows of `cartel-taller-escena`, only if their cells moved)
- Test: `src/lab/docs.test.ts` (existing cross-checks)

- [ ] **Step 1:** `npm run legibility` (full). Expected: `REPORT.md` with 18 ✓ and "Sin violaciones.".
- [ ] **Step 2:** `npx vitest run src/lab/docs.test.ts` → FAIL only if cells changed; sync §8.1 rows with `REPORT.md`.
- [ ] **Step 3: Run** `npx vitest run src/lab/docs.test.ts` → PASS; `npm test`, `npm run typecheck` → PASS.
- [ ] **Step 4: Commit** `docs(#392): level 3 report with the tinker sign in the world`.

### Task 5: Site capture

**Files:**
- Create: `docs/superpowers/specs/assets/389-carteles-sitio/tinker-sitio.png` (2732 × 1314)

- [ ] **Step 1:** `npm run dev -- --host --port 5173`; agent-browser `set viewport 1366 657 2`, open `http://localhost:5173/`, wait ~3 s, screenshot to the path.
- [ ] **Step 2: Verify:** PNG is 2732 × 1314; looking at it, PORTFOLIO stands over the south assembly hall.
- [ ] **Step 3: Commit** `docs(#392): site capture of the PORTFOLIO tinker sign`.

## Assumptions

- **A1 — post on the siding rail** (technical): one ground post of the scaffold's west end stands on the factory siding's north rail strip (0.11 u of overlap, a 0.3 u post). The sign's geometry is #379's and the issue keeps it (`TINKER_SITE`, default halls); moving posts would change `sign-tinker.ts`, out of this issue. The #247 plan-only rule exempts the sign's solids; the 3D overlap test of `sign-tinker.test.ts` (solids, no strips) stays as it is.
- **A2 — exemptions by identity** (technical): every shipyard-local rule that the sign breaks exempts exactly the solids/accents deep-equal to `tinkerSign([], [], TINKER_SITE)`, with a count check where the rule filters solids. Rejected: widening boxes or z caps, which would also let unrelated solids through.
- **A3 — `naves` `h`** (technical): the smallest integer that passes the framing and neighbour rules (spike: 32). Rejected: the issue's "≈ 34", which also passes but is not the smallest; this is #391's rule for `plaza`/`torre`.
- **A4 — `cartel-taller-escena` `h`** (technical): stays 34 (still passes); the issue does not ask to change it, and keeping it keeps the level-3 crops comparable.
- **A5 — where the call goes** (technical): right after `halls(solids)`, before `portfolioWindows`, so a hall window the sign hides is not lit (spike: 1 window). Same choice as #391 (`city()` after `plazaAndTower`, the crown hid 26 city lights).
- **A6 — level 3 failure** (technical): if `npm run legibility` reports a ✗ or aborts, its outputs are restored with `git checkout -- docs/superpowers/specs/assets/carteles-legibilidad` and the stage is reported as blocked; no half-regenerated report is committed.
