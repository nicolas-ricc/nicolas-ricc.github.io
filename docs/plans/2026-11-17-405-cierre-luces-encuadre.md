# Storybook lights and framing: closing — spec, README, CONTEXT.md and final captures (#405): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close story #395: the spec gets its status line, a before/after table over 22 final captures and a "Desvíos" section; README and `CONTEXT.md` describe what the branch changed; the docs tests pin all of it; `after-encuadre/` is gone.

**Architecture:** Docs only, plus docs tests. No change in `src/` except `src/lab/docs.test.ts` and `src/docs-glossary.test.ts`. The captures are taken by the controller with the dev server and agent-browser (Task 3), not by a subagent.

**Tech Stack:** Markdown, vitest (`node:fs` reads), agent-browser 0.26 for the captures.

**Spec:** issue #405 ("Decisiones heredadas" 1–4, "Criterios de aceptación"), parent #395 (plan comment), `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md`. Base branch `feature/395-storybook-luces-encuadre` (carries #399–#404).

## Global Constraints

- Test code, comments and test names in **English** (`src/english.test.ts`); spec prose stays Spanish (like the rest of `docs/superpowers/specs/`), README and `CONTEXT.md` in English.
- Capture paths: `docs/superpowers/specs/assets/2026-11-16-storybook-luces/after/{phone,desktop}-NN.png`, NN = `01`..`11` in the spec's table order (`playa-camiones`, `gradas`, `estacion`, `patio-contenedores`, `grua-muelle`, `cartel-taller-escena`, `silos`, `playa-contenedores`, `autitos-chocadores`, `faro`, `pecio`).
- Viewports: `agent-browser set viewport 412 915 1` (phone) and `1600 900 1` (desktop); PNG width × height equal the viewport (412×915, 1600×900).
- URL: `http://localhost:5173/lab/storybook.html?speed=0#<id>`.
- Status line, verbatim: `**Estado:** implementado (#395)`, as line 2 of the spec (index 1 of `split("\n")`).
- `after-encuadre/` is deleted.
- `npm test`, `npm run typecheck`, `npm run build` pass.

## Decisions (technical assumptions, declared)

1. **"Nothing references `after-encuadre`"** is checked over `README.md`, `CONTEXT.md`, `docs/superpowers/specs/**/*.md` and `src/**`. `docs/plans/` is excluded: plans are the record of past runs (`docs/plans/2026-11-17-400-encuadre-por-contenido.md` Task 4 names the folder it produced then); rewriting history is out of the issue.
2. **Beam-north frame.** "Cómo probarlo" asks for an extra `#faro` frame with the beam toward the north. It goes to `after/faro-norte.png` (desktop, 1600×900), linked under the table. It is not one of the 22. The beam angle comes from `angleAt` (`src/scenes/sea-anim.ts`); the controller advances with `__lab.tick` until the beam's far vertex has the smallest screen y.
3. **Table shape.** One `## Capturas antes y después` section before "Criterios de aceptación"; one row per exhibit: `| N | Exhibit | [antes](assets/…/NN.jpg) | [teléfono](assets/…/after/phone-NN.png) | [escritorio](assets/…/after/desktop-NN.png) |`.
4. **"Desvíos"** is a `## Desvíos` section after the table, one bullet per inherited deviation (issue decision 2), each naming the child issue where it happened.
5. **README world section** gains one sentence on the STS boom (nearly horizontal, over the water to the west, no tip light on the east bank) where it names "quay cranes". It names no sparks today (`grep -n "spark\|welding" README.md` is empty); the test pins that it stays so.
6. **README storybook paragraph** gains `__lab.tick` (DEV hook: advances the stage and renders, for headless time-lapses) and the words "shadows", "halos", "animation" already present stay. README's lab specs list gains `2026-11-16-storybook-luces-y-encuadre-design.md`.
7. **Glossary checks** reuse `section`/`codeRefs`/`hasIdent` of `src/docs-glossary.test.ts` for `Accent`, `Frame`, `Exhibit`.

## Criteria → tasks

- 22 captures exist (PNG, right size), `after-encuadre/` gone, nothing references it → tests in Task 1, files in Task 3.
- Spec status line, before/after table, Desvíos → Task 4 (tests in Task 1).
- Old storybook spec deviation note → Task 4.
- README + CONTEXT.md + their tests; `spark|welding` → Task 2 (tests in Task 1).
- Final report on #395 → controller, after merge (stage 10).
- `npm test`, `npm run typecheck`, `npm run build` → every task; build checked in Task 4.

---

### Task 1: failing docs tests (stage 3 evals)

**Files:**
- Modify: `src/lab/docs.test.ts` (new `describe("storybook lights closing (#405)")` at the end)
- Modify: `src/docs-glossary.test.ts` (new `describe("storybook vocabulary (#405)")`)

- [ ] **Step 1: Write the tests** in `docs.test.ts`:
  - `"the 22 final captures exist as PNGs of the viewport size"`: for NN 01..11 and `phone` (412×915) / `desktop` (1600×900), the file exists and its IHDR (bytes 16–23, big-endian) gives that width and height.
  - `"after-encuadre/ is gone and nothing references it"`: the folder does not exist; no file in `README.md`, `CONTEXT.md`, `docs/superpowers/specs/**/*.md`, `src/**/*.ts` (except this test file) contains `after-encuadre`.
  - `"the spec says implemented on its second line"`: `spec.split("\n")[1] === "**Estado:** implementado (#395)"`.
  - `"the spec carries a before/after table with the three captures per exhibit"`: section `## Capturas antes y después` exists; for each NN a single line contains `assets/2026-11-16-storybook-luces/NN.jpg`, `after/phone-NN.png` and `after/desktop-NN.png`; it links `after/faro-norte.png`, which exists.
  - `"the spec lists its deviations"`: section `## Desvíos` exists and contains `poly`, `light: true`, `boyas`, `24`, `48`, `72`, `(32, −180)`, `(−150, −50)`, `(−180, 10)`, `terreno`, `sombras`, `` `h` ``.
  - `"README's storybook paragraph names __lab.tick, shadows, halos and animation"`.
  - `"README's world section describes the STS boom and no sparks"`: the `## Isometric world` section matches `/STS/` and `/boom/`; whole README does not match `/spark|welding/i`.
  - `"README lists the lights spec among the lab specs"`: lab paragraph contains `2026-11-16-storybook-luces-y-encuadre-design.md`.
  - `"the 2026-10-17 storybook spec notes the deviation after its framing paragraph"`: the paragraph after the one starting `**Encuadre.**` starts with `*Desvío (2026-11-17` and contains `2026-11-16-storybook-luces-y-encuadre-design.md`; its status line still matches `/implementad/`.
- [ ] **Step 2:** in `docs-glossary.test.ts`: `Accent` contains `spot()` and its `Code:` refs include `src/iso/accent.ts` with `spot`; `Exhibit` contains `contentFrame` and `clip`, `Code:` includes `src/lab/frame.ts` (`contentFrame`); `Frame` contains `contentFrame`; for the three entries every `Code:` file exists and holds its identifiers.
- [ ] **Step 3: Run** `npx vitest run src/lab/docs.test.ts src/docs-glossary.test.ts src/english.test.ts` → the new tests FAIL, the old ones and the English guard PASS.
- [ ] **Step 4: Commit** `test(#405): evals`.

### Task 2: README and CONTEXT.md

**Files:** Modify `README.md` (storybook paragraph, `## Isometric world`, lab specs list), `CONTEXT.md` (`Accent`, `Frame`, `Exhibit`).

- [ ] **Step 1:** README per decisions 5–6. `CONTEXT.md`: `Accent` adds the functional-light form: `spot(at, r, color, alpha)` returns a haloless diamond `poly` (lighthouse gallery, train, signals, buffer stops, wreck buoy, marquee bulbs), `Code:` gains `` `spot` `` inside `src/iso/accent.ts`'s parenthesis. `Exhibit` adds: region and context exhibits are built with `buildStage(…, { clip: box })` (shadows, terrain, strips and long prisms clipped to the box) and framed with `contentFrame` (`src/lab/frame.ts`); `Code:` gains `` `src/lab/frame.ts` (`contentFrame`) ``. `Frame`'s disambiguation sentence adds that the storybook frames with `contentFrame`.
- [ ] **Step 2: Run** `npx vitest run src/lab/docs.test.ts src/docs-glossary.test.ts src/english.test.ts` → the README/CONTEXT tests PASS (capture/spec tests still fail).
- [ ] **Step 3: Commit** `docs(#405): README and CONTEXT.md on spot, contentFrame, clip and the STS boom`.

### Task 3 (controller): final captures

Not a subagent task: needs the dev server and agent-browser.

- [ ] `npm run dev -- --host --port 5173`; for each viewport, for each id in order, open `…/storybook.html?speed=0#<id>`, wait for the bloom to attach (2 s), `agent-browser screenshot` to `after/{phone,desktop}-NN.png`.
- [ ] `#faro` at 1600×900: `__lab.tick` until the beam points north (decision 2), screenshot to `after/faro-norte.png`.
- [ ] `git rm -r …/after-encuadre`; look at every capture (nothing cut by the canvas edge).
- [ ] Commit `docs(#405): final captures; after-encuadre removed`.

### Task 4: spec closing

**Files:** Modify `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md`, `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`.

- [ ] **Step 1:** status line (line 2), `## Capturas antes y después` (decision 3, links `after/faro-norte.png`), `## Desvíos` (decision 4) with these bullets: marquee bulbs to `poly` (open question resolved by capture 06, #403); signals and crossing, all four converted (shared builder, #403); shoal buoys and coast lights stay dots (not in the 11 exhibits); kit quay crane keeps its tip light with `light: true` (#402); inventory corrected: seam fence lamps x 24/48/72, transfer street y 40/68/124, hinterland (32, −180), (−150, −50), (−180, 10) (#401); terrain and shadows clipped to the box besides strips and long prisms (#399); `h` kept as a reserve in the content frame (#400).
- [ ] **Step 2:** in the 2026-10-17 spec, after the `**Encuadre.**` paragraph of §6, a paragraph `*Desvío (2026-11-17, #395): …*` saying the frame is now `contentFrame` (projected bounds, clipped shadows, halos, animation samples) and pointing to `2026-11-16-storybook-luces-y-encuadre-design.md`. Status line untouched.
- [ ] **Step 3: Run** `npm test && npm run typecheck && npm run build` → PASS.
- [ ] **Step 4: Commit** `docs(#405): spec status, before/after table and deviations`.

## Review Focus

1. **A capture taken before the bloom attached or mid-load** (blank canvas or frame without bloom): the size test passes but the image is wrong. Task 3 inspects each image.
2. **A stale link** in the table (wrong NN or folder): Task 1 test reads every link per row.
3. **Glossary `Code:` identifiers that do not exist** (e.g. `spot` misspelled): Task 1 Step 2 checks them.
4. **English guard on Spanish literals in the tests** (`Capturas antes y después`, `antes`, `teléfono`): `english.test.ts` reads string and regex text of `docs.test.ts`. `Desvíos`, `*Desvío…*`, `**Estado:**` and `implementad` are already allowed (`src/english.test.ts` ALLOW for `src/lab/docs.test.ts`); other Spanish literals use `\u` escapes, as the #404 test does (`diagnóstico`). Task 1 Step 3 runs `src/english.test.ts` too.
5. **A `src/` file mentioning `after-encuadre`** (the test itself): excluded by path.
