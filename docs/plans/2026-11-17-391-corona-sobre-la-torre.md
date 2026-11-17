# Resume crown on the real tower, replacing the antenna and its light — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The real office tower of the plaza ends in the Resume crown (`towerCrown` at `CROWN_SITE`, built by `city()`), its antenna and pulsing antenna light are gone, and the `cartel-torre-escena` context exhibit becomes a plain crop of that world.

**Architecture:** `plazaAndTower` stops pushing the antenna cylinder and `TowerLights` loses `antenna`; `createCityAnim` and `cityAnimator` lose the antenna light and the `city.antenna` layer. `city()` calls `towerCrown(solids, accents, CROWN_SITE)` right after `plazaAndTower`, so the crown's solids and static accents flow through `CityScene` into `world()` / `assembleWorld` unchanged. The context exhibit drops `build` (the mechanism of #390 already makes it optional), and the existing gates (sign levels 1–2, level 3 report, docs cross-checks, framing rule of the exhibits) run on the world copy of the crown.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS v8 (renderer only), tsx scripts, agent-browser.

**Spec:** issue #391 (child of #389) — the issue body is the spec. Background: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§5, §7, §8) and `docs/superpowers/specs/2026-11-11-carteles-de-zona-assets-design.md` §7.

## Global Constraints

- Base branch: `feature/389-carteles-en-el-mapa`; the PR goes there, not to `main`.
- `npm test` and `npm run typecheck` green at the end of every task.
- Code, comments, strings and identifiers in `src/`, `lab/`, `scripts/`, README and CLAUDE.md in **English** (`src/english.test.ts`); exhibit ids and `docs/` stay in Spanish.
- `src/iso`, `src/kit`, `src/scenes` stay Pixi-free; deterministic (no `Math.random`); no hex outside `src/map/palette-iso.ts`.
- `world()`, `assembleWorld`, `src/main.ts`, `index.html`, `style.css` and the camera do not change.
- The `cartel-torre` piece does not change; `src/scenes/world-baseline.test.ts` stays green without re-recording.
- The antenna light is not relocated anywhere.
- `REPORT.md` is only written by `npm run legibility` (full run).

## Review Focus

1. **Height rules of the city** (`src/scenes/city.test.ts` "the tower is 30 tall… nothing else exceeds 21"): the crown reaches z ≈ 50 and some of its solids (panel, slab) may stick out of the `isTowerPiece` footprint. Expected: crown solids are exempt by identity with `towerCrown([], [], CROWN_SITE)`, nothing else is. (Task 2.)
2. **Accent colour rule of the city** (`city.test.ts` "…the accents are amber, windows or neons…"): the crown brings `greenMid` letters and edge lights. Expected: the rule learns `greenMid` with a `#391` note; `windowWarm` and `amber*` already pass. (Task 2.)
3. **Shared materials** (`src/scenes/world.test.ts`, `sharedWithCity`): the crown panel is the first `glass` solid of the city. Expected: `glass` joins `sharedWithCity` with a note; the comment "No glass: …" is corrected. (Task 2.)
4. **Stage / lab consumers of the removed layer**: nothing outside `city-animator.ts` may still ask for `city.antenna` (`layerLookup` throws on an unknown id). Expected: `grep -rn "antenna" src lab scripts` only hits the kit's `antenna` prop and unrelated monoblock tests. (Task 1.)
5. **Regions that now crop the crown** (`plaza`, `torre` in `src/lab/exhibits.ts`): their `h` must be re-measured with the framing/neighbour rule (spike: `h` 38 fails, 51 passes both rules; the plaza needs ≥ 50.2). (Task 2.)

---

### Task 1: The antenna and its light go away

**Files:**
- Modify: `src/city/fixed.ts:15-16,39-40,60` (`TowerLights`, `plazaAndTower`)
- Modify: `src/scenes/city-anim.ts` (header comment, `ANTENNA_STEP_MS`, `ANTENNA_*`, `antennaStep`, `antennaR`, `antenna()`, `CityAnimChanges.antenna`, `NONE`)
- Modify: `src/scenes/city-animator.ts` (layer `city.antenna`)
- Modify: `src/scenes/city.ts:35` (comment of `accents`: no antenna)
- Test: `src/city/fixed.test.ts:307-311`, `src/scenes/city.test.ts:117`, `src/scenes/city-anim.test.ts` (31-46, 81-91, 96, 300-301), `src/scenes/city-animator.test.ts:7-9`

**Interfaces:**
- Produces: `interface TowerLights { litWindows: Accent[]; paperWindow: Vec3 }`; `interface CityAnimChanges { lit; papers; neon; windows: boolean }`; `CityAnim` without `antenna()`; `cityAnimator(...).ids` = `city.lit`, `city.papers`, `city.neon`, `city.windows`.

- [ ] **Step 1: Failing tests**
  - `fixed.test.ts`: rename to `"the tower: 8 lit windows, the paper window on the east wall and no antenna"`; drop the `antenna.z` assertion; add `expect(tower).not.toHaveProperty("antenna")` and, on `built().solids`, `expect(solids.some((s) => s.kind === "cylinder" && s.mat === "steel" && bounds(s).min.z >= TOWER_H)).toBe(false)` (no steel cylinder on the roof).
  - `city.test.ts:117`: replace with `expect(s.tower).not.toHaveProperty("antenna")`.
  - `city-anim.test.ts`: frame-0 test loses the two antenna lines and "antenna at radius 1.1" from its title; delete the "antenna pulses…" test and the `ANTENNA_STEP_MS` import; the three `toEqual({ lit…, antenna: false, … })` lose `antenna`.
  - `city-animator.test.ts`: `"exposes four accent layers…"`, ids `["city.lit", "city.neon", "city.papers", "city.windows"]`.
- [ ] **Step 2: Run** `npx vitest run src/city/fixed.test.ts src/scenes/city.test.ts src/scenes/city-anim.test.ts src/scenes/city-animator.test.ts` → FAIL (antenna still there, five ids).
- [ ] **Step 3: Implement.** Remove the `mast` cylinder and `antenna` from `plazaAndTower`/`TowerLights` (doc comment: "Windows of the lit floor and the paper window"); remove everything antenna from `city-anim.ts` (header: drop "the antenna light pulses") and the layer from `city-animator.ts`. Run `npm run typecheck` to find any other reader.
- [ ] **Step 4: Run** `npm test` → PASS; `npm run typecheck` → PASS; `grep -rn "antenna\|ANTENNA" src lab scripts` → only `src/kit/props*`, `src/kit/forms/composite*`, `src/scenes/neighborhood-monoblock*` and the `torre` region comment (fixed in Task 2).
- [ ] **Step 5: Commit** `feat(#391): the real tower loses its antenna and its pulsing light`.

### Task 2: The crown on the real tower, built by `city()`

**Files:**
- Modify: `src/scenes/city.ts` (`city()` calls `towerCrown` right after `plazaAndTower`; header and `accents` comment)
- Modify: `src/lab/exhibits.ts:181-185` (`plaza`, `torre`: `h` and comment)
- Test: `src/scenes/city.test.ts`, `src/scenes/city-budget.test.ts:13-17`, `src/scenes/world.test.ts:75-77`, `src/world/veil.test.ts`

**Interfaces:**
- Consumes: `towerCrown(out: Solid[], accents: Accent[], at: Vec3): void`, `CROWN_SITE` (`src/scenes/sign-crown.ts`); Task 1.
- Produces: `city(...).solids` contains every solid of `towerCrown([], [], CROWN_SITE)` and `.accents` every accent of it; `CityScene` type unchanged.

- [ ] **Step 1: Failing tests**
  - `city.test.ts`: `it("city() builds the Resume crown at CROWN_SITE: its solids and accents are towerCrown's (#391)")` → with `c: Solid[] = [], a: Accent[] = []; towerCrown(c, a, CROWN_SITE)`: each `s of c` → `expect(s_.solids).toContainEqual(s)`; each `x of a` → `expect(s_.accents).toContainEqual(x)`.
  - `city-budget.test.ts`: title `"raised solids ≤ 2 900, strip ≤ 190, static accents ≤ 1 300"`, cap `1300`, comment: `// accents: 789 + the crown's 402 (238 poly + 164 dot) = 1 191 measured (#391), ×1.1 rounded to the hundred`.
  - `veil.test.ts`: `describe("Resume crown accents (#391)")`, `it("every accent of the crown at CROWN_SITE is Resume")` → accents of `towerCrown([], acc, CROWN_SITE)`: both kinds present; each `expect(accentZone(a)).toBe("cv")`.
  - `city.test.ts` "the tower is 30 tall…": `isTowerPiece` also accepts a solid deep-equal to one of `towerCrown([], [], CROWN_SITE)` (build once at module level, compare by `JSON.stringify` key set); doc comment of `isTowerPiece` lists the crown instead of the mast.
  - `city.test.ts` accents colour rule: `NEON` check gains `a.color === "greenMid"` with comment `// greenMid: RESUME letters and helipad edge lights of the crown (#391)`.
  - `world.test.ts`: `sharedWithCity` gains `"glass"`; the "No glass: …" comment becomes `glass: the crown panel of the tower (#391); the city's other glass is facade faces, not a solid mat`.
- [ ] **Step 2: Run** `npx vitest run src/scenes/city.test.ts src/scenes/city-budget.test.ts src/world/veil.test.ts src/scenes/world.test.ts` → the "builds the Resume crown" test FAILS; the veil test passes already (pure function of `towerCrown`), that is fine.
- [ ] **Step 3: Implement.** `city()`: `towerCrown(solids, accents, CROWN_SITE);` on the line after `plazaAndTower`; header comment: "plaza and tower (crowned by the Resume sign, src/scenes/sign-crown.ts)"; `accents` comment drops "and the antenna" and adds "the crown's letters, bulbs and lights". In `exhibits.ts`, measure `h` of `plaza` and `torre` with the test's rule (framing `h ≥ max(inside, accents)` and `≤ max(withAnim, accents) + SLACK`; neighbours ≤ `h`) and set the smallest integer that passes (spike: 51 for both). Replace `// h + 8: the antenna reaches z 37.9` with `// h 51: the Resume crown (#391) tops out at z ≈ 50.2; smallest integer that passes framing and neighbors`, and the same note on `plaza`.
- [ ] **Step 4: Run** `npm test` → PASS (including `exhibits.test.ts`, `signs.test.ts`, `world-baseline.test.ts`, `stage.test.ts`); `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#391): Resume crown on the real tower, built by city()`.

### Task 3: `cartel-torre-escena` is a crop of the world

**Files:**
- Modify: `src/lab/exhibits.ts:217-218` (`cartel-torre-escena`: no `build`; comment)
- Test: `src/lab/exhibits.test.ts:460-470` (describe "cartel-torre-escena (#378)")

**Interfaces:**
- Consumes: `contextScene(scene, e)` (`src/lab/crop.ts`), Task 2.

- [ ] **Step 1: Failing test.** In the describe "(#378)", the `it` becomes `"after cartel-torre, in the city, the issue's box, a crop of the world (no build), signed RESUME_SIGN"`: keeps the order and `toMatchObject` assertions; adds `expect(e.build).toBeUndefined()`; with `c, d` from `towerCrown(c, d, CROWN_SITE)` and `cs = contextScene(scene, e)`: each `s of c` → `expect(cs.solids).toContainEqual(s)`; each `x of d` → `expect(cs.accents).toContainEqual(x)`.
- [ ] **Step 2: Run** `npx vitest run src/lab/exhibits.test.ts` → FAIL (`build` defined).
- [ ] **Step 3: Implement.** Remove `build` from `cartel-torre-escena`; re-run the context framing rule; keep `h: 52` if it is still the smallest integer that passes, else the measured one; its comment says what sets `h` (crop of the world, #391).
- [ ] **Step 4: Run** `npx vitest run src/lab` → PASS (including `signs.test.ts` levels 1–2 at 1.17 and 0.83 on the world copy); `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#391): cartel-torre-escena is a crop of the world`.

### Task 4: Level 3 report and spec

**Files:**
- Regenerate: `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` and its PNG crops (`npm run legibility`, full run)
- Modify: `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` (§8.1 rows of `cartel-torre-escena`, and any other row whose cells moved; §8.2 bullet "Luz de la antena real (#378)": add that #391 removed the antenna and its light, the crown tops the tower)
- Test: `src/lab/docs.test.ts` (existing cross-checks)

- [ ] **Step 1:** `npm run legibility` (full). Expected: `REPORT.md` with 18 ✓ and "Sin violaciones.".
- [ ] **Step 2:** `npx vitest run src/lab/docs.test.ts` → FAIL only if cells changed; sync §8.1 rows with `REPORT.md` and the §8.2 note.
- [ ] **Step 3: Run** `npx vitest run src/lab/docs.test.ts` → PASS; `npm test`, `npm run typecheck` → PASS.
- [ ] **Step 4: Commit** `docs(#391): level 3 report and spec §8 with the crown in the world`.

### Task 5: Site capture

**Files:**
- Create: `docs/superpowers/specs/assets/389-carteles-sitio/corona-sitio.png` (2732 × 1314)

- [ ] **Step 1:** `npm run dev -- --host --port 5173`; agent-browser `set viewport 1366 657 2`, open `http://localhost:5173/`, wait ~3 s, screenshot to the path.
- [ ] **Step 2: Verify:** PNG is 2732 × 1314; looking at it, the crown with RESUME tops the plaza tower and there is no antenna.
- [ ] **Step 3: Commit** `docs(#391): site capture of the Resume crown`.
