# Industrial lamps and non-functional dots out of the 11 exhibits (#401): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the round haloed lights (accent `kind: "dot"`) that have no function from the scene builders behind the 11 storybook exhibits, whole `industrialLamp` calls included, and rewrite the tests that pin today's lamps to the new exact state.

**Architecture:** Pure data changes in the scene builders (`src/scenes/*.ts`): delete whole `place(out, accents, industrialLamp(...))` calls or shrink the coordinate lists that feed them; delete the bare `dot` pushes of the bumper cars and the station. `towerCrane` (`src/scenes/pieces.ts`) gains `light: AccentColor | null`. A test-only fixture module (`src/scenes/lamp-fixtures.ts`, same convention as `neighborhood-fixtures.ts`) finds orphan lamp posts and orphan lamp bulbs, shared by every scene test.

**Tech Stack:** TypeScript, vitest, the Pixi-free scene builders.

**Spec:** issue #401 (its body: "Sitios a tocar", "Decisiones heredadas" 1–4, "Criterios de aceptación"), parent story #395, `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md` §1. Base branch `feature/395-storybook-luces-encuadre`.

## Global Constraints

- `src/` in **English** (`src/english.test.ts`): code, comments, test names.
- Scene tests stay Pixi-free (`src/iso/pixi-free.test.ts`).
- `lamp()` and `industrialLamp()` in `src/kit/props.ts` do **not** change; `src/kit/props.test.ts` is untouched.
- Always remove the **whole** `place(out, accents, industrialLamp(...))`: never a post without its bulb nor a bulb without its post (inherited decision 1).
- `TowerCrane.light: AccentColor | null`; `null` emits no dot. Only `factory.ts` passes `null` (inherited decision 2). The other callers (`hinterland.ts`, `shipyard-fill.ts`, `kit/forms/modern.ts`, `lab/exhibits.ts`) keep their color.
- Functional lights are **not** touched here: station buffers (magenta r 0.35), signals, train, lighthouse gallery, wreck buoy, tinker marquee bulbs `bulbs()` (inherited decision 3). The floating dock towers' lamps (`floatingDock`, `shipyard-east.ts:47`), the quay lamps (`quay()`, `shipyard.ts:61`), the hinterland water tank dot, the power plant, transformer yard and bulk quay lamps stay.
- Numeric thresholds in tests ("≥ 30 cyan dots", "≥ 7", "≥ 5 poles") are rewritten to the new exact count with the list of remaining positions (inherited decision 4). Tests are rewritten, never deleted.
- `npm test` and `npm run typecheck` pass (the typecheck has `noUnusedLocals`/`noUnusedParameters`: drop parameters and imports that the removals leave unused).

## Decisions (technical assumptions, declared)

1. **Orphan rule, one formula for both lamp shapes.** A lamp post is a `prism` with `mat === "steel"`, `w === 0.6`, `d === 0.6` and `h` 5 or 6 (or 1.2 in the tinker sign, before this change); its bulb is a `dot` at `(at.x + 0.3, at.y + 0.3, at.z + h)` within 1e-9. That holds for `center` too (`industrialLamp` puts the post corner at `at − 0.3` and the bulb at `at + h`). The reverse direction looks at every `dot` with `r === 1.2` (the `industrialLamp` signature; the tinker floodlight was an amber r 1.2). `lamp()` posts (amber r 0.6) satisfy the post rule as well.
2. **Exact new counts** (measured on the prototype, seed 7): Portfolio cyan dots across shipyard + factory + hinterland of `world(7)` go from 52 to **33** (−6 factory, −6 shipyard, −2 east yard, −2 esplanade, −3 hinterland). Hinterland cyan dots north of `ROAD_Y` go from 5 to **4**. The fair's dot count is pinned to whatever exact number it has after Task 5 (the implementer reads it from a failing assertion and writes it with a comment listing what remains).
3. **`world-baseline.test.ts`** pins a fingerprint per piece exhibit; `cartel-taller` (the tinker sign on its stand-in hall) changes because its floodlight goes. Re-record **only** that entry, with a comment `// #401: floodlight removed`. Every other entry must stay identical.
4. **Exhibit framing.** The prototype showed `src/lab/exhibits.test.ts` (`framing`/`neighbors` per `h`, SLACK 8) still passes after the removals; if it fails, lower that region's `h` in `src/lab/exhibits.ts` to the measured value + ≤ 8 and update its comment, as the issue says.
5. `roofUnder` in `sign-tinker.ts` stays (the scaffold uses it at lines ~206 and ~235). `FLOOD_N`, `FLOOD_H`, `LAMP_W` go, and the `industrialLamp`/`place` imports there.

## Review Focus

1. A lamp list shrunk in the wrong frame (factory plant frame: local (20, −14), (110, −3), (24, −13), (64, −13), (50, −13.5) are world (5, 76), (95, 87), (9, 77), (49, 77), (35, 76.5)): the factory test asserts exact world positions.
2. A post left behind when a hand-written removal deletes only the accent (station esplanade, tinker floodlight): the orphan fixture runs on every touched scene.
3. Over-removal: a functional light (buffers, quay lamps, floating dock, substation lamp (53, 12), (−30, 20)) or a non-scope tower crane light disappearing. Tests assert those still exist.
4. Seed dependence: hinterland `fairRoad` is guarded by `ok(...)`; tests use the same seeds as today's tests (`createRng(7)` / `world(7)`).
5. Fingerprint drift outside `cartel-taller` in `world-baseline.test.ts` would mean a piece exhibit changed by accident (e.g. `torre-grua`, which keeps `light: "amber"`).

---

### Task 1: Orphan-lamp fixture

**Files:**
- Create: `src/scenes/lamp-fixtures.ts`
- Test: `src/scenes/lamp-fixtures.test.ts`

**Interfaces:**
- Produces: `unpairedLampParts(solids: readonly Solid[], accents: readonly Accent[]): string[]` — one human-readable line per post without its bulb (`post at x,y,z h`) and per r 1.2 dot without its post (`bulb at x,y,z`); `[]` when everything pairs.

- [ ] **Step 1: Write the failing tests** in `lamp-fixtures.test.ts`:
  - `industrialLamp(v3(10, 20, 0))`, `industrialLamp(v3(5, 5, 0.15), { h: 6, center: true })` and `lamp(v3(0, 0, 0))` poured with `place` → `[]`.
  - Only the solids of an `industrialLamp` → one line starting with `post at`.
  - Only the accents of an `industrialLamp` → one line starting with `bulb at`.
  - A steel 0.6 × 0.6 prism with h 3 and no dot → `[]` (not a lamp post).
- [ ] **Step 2:** `npx vitest run src/scenes/lamp-fixtures.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement in `lamp-fixtures.ts` (doc comment in the style of `neighborhood-fixtures.ts`), post rule and bulb rule as in Decision 1, tolerance 1e-9.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `test(#401): orphan-lamp fixture`.

### Task 2: Factory and the tower crane's optional light

**Files:**
- Modify: `src/scenes/pieces.ts` (`TowerCrane`, `towerCrane`), `src/scenes/factory.ts` (`truckYard`, `lamps`, `factory`)
- Test: `src/scenes/pieces.test.ts`, `src/scenes/factory.test.ts`

**Interfaces:**
- Consumes: `unpairedLampParts` (Task 1).
- Produces: `TowerCrane.light: AccentColor | null`.

- [ ] **Step 1: Write the failing tests.**
  - `pieces.test.ts`: new `it("light null: same solids, no accent")` — same call as the first test with `light: null` → `accents` is `[]` and `out` deep-equals the `light: "cyan"` output.
  - `factory.test.ts`: rewrite "7 lamps…" to "2 lamps: the substation's (53, 12) and the one at (−30, 20); each with its cyan accent on top" — sorted positions `[[-30, 20], [53, 12]]`, the same per-lamp accent check. Rewrite "the lamp at (58, −16)…" to "the plant frame lamps are gone: none at (5, 76), (9, 77), (35, 76.5), (49, 77) or (95, 87)". In "the inclined belt…" the `toHaveLength(7)` becomes `2`. New: "the tower crane has no tip light": no `dot` with `color === "cyan"`, `r === 1` at `(90, −12, 19.4)` (1e-9), and `unpairedLampParts(s.solids, s.accents)` is `[]`.
- [ ] **Step 2:** `npx vitest run src/scenes/pieces.test.ts src/scenes/factory.test.ts` → the new/rewritten tests FAIL.
- [ ] **Step 3:** `TowerCrane.light: AccentColor | null`; push the tip dot only when `c.light !== null`; update the doc comment ("…and, unless `light` is null, a light at the tip"). In `factory.ts`: delete the lamp line of `truckYard` and the `emitPlant(...)` line of `lamps()` with its comment (keep the substation/(−30, 20) loop and its comment); `towerCrane(..., light: null)`. `truckYard` loses its `accents` parameter if it becomes unused (and the `emitPlant` accents argument with it: check `emitPlant`'s signature, keep it unchanged).
- [ ] **Step 4:** Same command → PASS; `npm run typecheck` → clean.
- [ ] **Step 5:** Commit `feat(#401): factory without plant-frame lamps or crane light`.

### Task 3: Shipyard street, seam fence and east container yard

**Files:**
- Modify: `src/scenes/shipyard.ts` (`lamps`, `seamFence` and its doc comment "six cyan lamps" → "three"), `src/scenes/shipyard-east.ts` (`containerYard` and its doc comment "and two lamps")
- Test: `src/scenes/seam-90.test.ts` (~123–131), `src/scenes/shipyard.test.ts` (~114–118), `src/scenes/shipyard-east.test.ts` (~135 "gatehouse…")

- [ ] **Step 1: Write the failing tests.**
  - `seam-90.test.ts`: title "… ≥ 26 posts, three cyan lamps at y 88.2 (x −48, −24, 0)"; the lamp poles at y 88.2 (`w 0.6`, `h 5`) have exactly the x set `[-48, -24, 0]`; the cyan dots at y 88.5, z 5 have exactly x `[-47.7, -23.7, 0.3]` (1e-9); the fence posts check (≥ 26) unchanged.
  - `shipyard.test.ts` "lamps…": the street poles (`x` in `STREET_EDGE..STREET_EDGE + 2`) have y exactly `[12, 96]`, each with its dot; new assertion `unpairedLampParts(s.solids, s.accents)` is `[]` (this scene includes the station and the east bank).
  - `shipyard-east.test.ts` "gatehouse…": the yard's cyan dots → `toHaveLength(0)`, and no steel 0.6 × 0.6 h 5 prism in `yard().out`. The "quay cranes" test (cyan tips) and the floating dock "two service towers" test stay as they are.
- [ ] **Step 2:** `npx vitest run src/scenes/seam-90.test.ts src/scenes/shipyard.test.ts src/scenes/shipyard-east.test.ts` → FAIL.
- [ ] **Step 3:** `lamps()`: `[12, 96]`. `seamFence`: `[-48, -24, 0]`. `containerYard`: delete the lamp line and the comment above it; drop the `industrialLamp`/`place` import only if `floatingDock` no longer needs it (it does: keep it). If `containerYard`'s `accents` stays used (gatehouse window) keep the signature.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(#401): shipyard street, seam fence and east yard lamps out`.

### Task 4: Terminal station

**Files:**
- Modify: `src/scenes/station.ts` (`canopies`, `portico`, `esplanade`, their doc comments; `industrialLamp`/`place` import)
- Test: `src/scenes/station.test.ts` (~115–145, ~292, ~404–406, ~444–448), `src/scenes/shipyard.test.ts` (~51–64)

- [ ] **Step 1: Write the failing tests.**
  - `station.test.ts` canopies test: title without "cyanMid lights"; the per-canopy lights assertion becomes "no cyanMid dot": `dots.filter((d) => d.color === "cyanMid")` is `[]` (replaces the `lights` arrays in `CANOPIES`, which go).
  - New `it("lights out (#401): no cyanMid, amber or cyan r 1.2 dot; the three magenta buffer lights stay")` over the whole `station(out, accents)` output: 0 dots `cyanMid`, 0 dots `amber`, 0 dots `cyan` with r 1.2; magenta dots r 0.35 exactly 3; `unpairedLampParts(out, accents)` is `[]`.
  - Esplanade test: title "esplanade: palms and railing, no lamps; …"; steel 0.6 × 0.6 posts with h 6 → `[]`; the z 0.15 check stays.
  - Night lights test: title "night lights: lantern, fanlight, windows and dials"; drop the portico/wall-lamp/cyan expectations and assert `bDots` has no `amber` and no `cyan`; the polys (dials, fanlight…) stay.
  - "station ↔ street lamps": title and list `y 12/96`.
  - `shipyard.test.ts` ~51–64: title "…; those of the station are magenta dots or polys"; `inside` keeps `toBeGreaterThanOrEqual(3)` with the comment "three buffer lights, plus the station's polys"; the dot color list for the station becomes `["magenta"]` (the parked train has `lead: null`, so `emu()` emits no headlight or red-light dots; its saloon and LED sign are polys); comment of `outside` "three street lamps (y 12, 96) and two quay lamps" with `toBeGreaterThanOrEqual(5)`.
- [ ] **Step 2:** `npx vitest run src/scenes/station.test.ts src/scenes/shipyard.test.ts` → FAIL.
- [ ] **Step 3:** Delete the two cyanMid loops of `canopies`, the two amber loops (and their comment) of `portico`, the lamp loop (and its comment) of `esplanade`. Drop the `accents` parameter of each function that no longer uses it and its call site argument; fix the doc comments ("…white fascia and lights" → "…and white fascia"; "light sign and night lights" → "and light sign"; "two tall lamps" out of `esplanade`'s). Remove the `../kit/props` import if unused.
- [ ] **Step 4:** Same command → PASS; `npm run typecheck` clean.
- [ ] **Step 5:** Commit `feat(#401): station without canopy, portico or esplanade lights`.

### Task 5: Hinterland and bumper cars

**Files:**
- Modify: `src/scenes/hinterland.ts` (`fairRoad`, `westHalls`), `src/scenes/fair.ts` (`bumperCars`)
- Test: `src/scenes/hinterland.test.ts` (~57–60, ~78), `src/scenes/fair.test.ts` (~55)

- [ ] **Step 1: Write the failing tests.**
  - `hinterland.test.ts` line ~78: `toHaveLength(4)` with comment "2 lamps of the transformer yard + 2 of the street (x 4 and 60)". New `it("lamps out (#401): fairRoad keeps x 4 and 60, westHalls keeps (−190, 44), (−130, 86), (−70, 20)")`: steel lamp posts at y `ROAD_Y - 4` with x in 0..84 are exactly `[4, 60]`; lamp posts with x < −60 and y in −60..90 are exactly `[[-190, 44], [-130, 86], [-70, 20]]` (sorted); `unpairedLampParts(s.solids, s.accents)` is `[]`.
  - `fair.test.ts` ~55: exact dot count (Decision 2), plus new `it("bumper cars: no dot over the floor")`: no `dot` with x in `BUMPER.x..BUMPER.x + 14` and y in `BUMPER.y..BUMPER.y + 10`.
- [ ] **Step 2:** `npx vitest run src/scenes/hinterland.test.ts src/scenes/fair.test.ts` → FAIL.
- [ ] **Step 3:** `fairRoad`: `[4, 60]`. `westHalls`: drop `[-150, -50], [-180, 10]`. `bumperCars`: delete the dot loop and the now-unused `accents` parameter (and its call-site argument).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(#401): hinterland lamps and bumper car dots out`.

### Task 6: Tinker sign floodlight, Portfolio count and baselines

**Files:**
- Modify: `src/scenes/sign-tinker.ts` (`tinkerSign` and its doc comment, constants line ~188, imports)
- Test: `src/scenes/sign-tinker.test.ts` (~239 "floodlight…", ~354 "posts and floodlight on a hall roof excused"), `src/scenes/portfolio-accents.test.ts` (~44), `src/scenes/world-baseline.test.ts` (`cartel-taller`), `src/lab/exhibits.test.ts` (run only)

- [ ] **Step 1: Write the failing tests.**
  - `sign-tinker.test.ts` ~239, `it.each(AT)`: "no floodlight (#401): no steel 0.6 × 0.6 prism and no amber r 1.2 dot (%s)"; also no `cyan` accent (kept), and `unpairedLampParts(out, accents)` is `[]`. Test ~354: title "…, posts on a hall roof excused" (adjust the excuse comment if it names the floodlight).
  - `portfolio-accents.test.ts` rule 2: title "rule 2: 33 cyan dots across the three scenes (#401)", assertion `.length` `toBe(33)`.
  - `world-baseline.test.ts`: leave failing until Step 4.
- [ ] **Step 2:** `npx vitest run src/scenes/sign-tinker.test.ts src/scenes/portfolio-accents.test.ts` → FAIL.
- [ ] **Step 3:** `tinkerSign`: delete the three floodlight lines; doc comment "…: the scaffold and the nine letters"; remove `FLOOD_N`, `FLOOD_H`, `LAMP_W` and the `industrialLamp`/`place` imports (keep `neon`, keep `roofUnder`).
- [ ] **Step 4:** Re-record only `cartel-taller` in `world-baseline.test.ts` from the assertion's received value, with the comment of Decision 3. Run `npx vitest run src/scenes/sign-tinker.test.ts src/scenes/portfolio-accents.test.ts src/scenes/world-baseline.test.ts src/lab/exhibits.test.ts` → PASS (Decision 4 if exhibits fails).
- [ ] **Step 5:** `npm test` and `npm run typecheck` → all green.
- [ ] **Step 6:** Commit `feat(#401): tinker sign without its floodlight`.
