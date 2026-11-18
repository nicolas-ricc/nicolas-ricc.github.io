# Visual verification, level-3 legibility, ADR 0004 and closing docs (#429) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close story #423: take the "after" captures and the no-reload rotation, judge them, regenerate the level-3 legibility report with the four context exhibits, write ADR 0004 and bring the spec, `README.md`, `CONTEXT.md` and `src/lab/docs.test.ts` up to date with the code already on the branch.

**Architecture:** No runtime code changes, except `PLATFORM_SITES.wide` if the desktop judgement requires the north-east shift (Task 1, step 5). Every documentary criterion is pinned by `src/lab/docs.test.ts`, built from the live constants wherever the doc quotes a value, so a later change to the constants fails there. Captures come from agent-browser against the dev server; the report comes from `npm run legibility`.

**Tech Stack:** TypeScript, Vitest, agent-browser 0.27 (headless), `scripts/legibility.ts` (tsx, tesseract.js).

**Spec:** issue #429 ("Qué hacer" 1–6 and "Criterios de aceptación" are binding), within `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md` §5 ("Verificación visual") and §6. Parent story #423 (its "Decisiones de diseño" comment).

## Global Constraints

- Captures folder: `docs/superpowers/specs/assets/423-composicion-responsive/despues/`.
- Map captures `mapa-WxH.png` for 390×750, 430×932, 820×1180, 1024×768, 1366×1024, 1600×900, 1920×955; `blog-1920x955.png`, `blog-390x750.png` (`/area/blog/`); `boca-lab-1600x900.png` (`/lab/world.html`, key `1`). Viewport scale 2: every PNG is 2W×2H.
- Rotation: `rotacion-900x1440.png` → `set viewport 1440 900 2` without reopening, wait 1 s → `rotacion-1440x900.png`; and back (`rotacion-1440x900-ida…` naming is free, but the two required names must exist).
- URL `http://localhost:5173/` (never `127.0.0.1`); wait for `mapa-listo`, then ≥ 3 s (the `antes/README.md` sequence: also the `[mapa] bloom:` console line).
- Desktop ship check: `/lab/world.html?speed=50`, key `4`, 1600×900, four captures 5 s apart (or three map captures ≥ 60 s apart). If a ship crosses or visibly competes with Writing, move `PLATFORM_SITES.wide` by (+5, −5) per step, at most 20 u, with `npm test` green and the `plataforma-escena` box moved the same.
- `npm run legibility` exits 0; `REPORT.md` has `## <id> a 1.17` / `a 0.83` for `cartel-torre-escena`, `cartel-taller-escena`, `plataforma-escena`, `plataforma-escena-angosta`, all rows `✓`; crops `plataforma-escena-angosta-117.png`, `-083.png`, `-117-ocr.png`, `-083-ocr.png` exist.
- ADR 0004 path `docs/adr/0004-writing-site-follows-the-host.md`, title "The Writing site depends on the host", format of ADR 0003 (Status, Context, Decision, Consequences, Sources), in English.
- Spec 2026-11-18: `**Estado:** implementado (#423)`; final section `## 8. Desvíos y medición`. The spec and the assets READMEs are Spanish; `README.md`, `CONTEXT.md`, ADRs and code are English (`src/english.test.ts` checks `README.md` and `src/`).
- World counts before (`main`): 46 481 static polygons / 2 409 static accents.
- After the closing, `README.md` and `CONTEXT.md` mention neither `PLATFORM_SITE` nor `BLOG_SIGN` nor `SIGNS` as whole identifiers, nor "0,35"/"0.35" as the focus, nor "caps the shipyard".

## Technical decisions (declared)

1. **Counts "after"** are computed with the same expressions as `src/scenes/city-budget.test.ts` (`buildRenderList([...w.terrain.ground, ...w.ground, ...w.solids]).length` and `assembleWorld(undefined, { reducedMotion: true }).scene.accents.length`) and written in §8 as literals; `docs.test.ts` recomputes them and checks §8 contains them, so the spec cannot drift.
2. **The level-3 numbers of `plataforma-escena` are pinned in the 2026-11-15 spec §8.1** by the test "§8.1 carries the level-3 measures of REPORT.md in the same rows". If the regenerated report changes them (the exhibit moved to the wide site in #427), that test keeps checking only `cartel-torre-escena` and `cartel-taller-escena` against the 2026-11-15 spec, and the new §8 of the 2026-11-18 spec carries the level-3 rows of the two Writing contexts, checked by a new test. The 2026-11-15 spec is history and is not rewritten. The "18 metric rows" count becomes 24.
3. **`SIGNS` grep**: checked as a whole identifier (`` `SIGNS` `` or `\bSIGNS\b`), so `BLOG_SIGNS`/`zoneSigns` are allowed; `PLATFORM_SITE` as `\bPLATFORM_SITE\b` (so `PLATFORM_SITES` is allowed); `BLOG_SIGN` as `\bBLOG_SIGN\b`.
4. **The rotation check** stores a marker (`window.__rot429 = Date.now()`) and the `transform` (computed style) of `a[data-zone="blog"]` before resizing; after: marker equal, transform different. The values go into the `despues/README.md`.

## Review Focus

1. A viewport resize alone (no reload) must move the Writing link: if `transform` is equal after rotation, the ResizeObserver path is broken — Task 1 records the before/after values, and fails the task instead of capturing.
2. The narrow site (`plataforma-escena-angosta`) at 0.83 is the smallest Writing on screen; its OCR row must be `✓`, not just present — the existing "no `| ✗ |`" assertion covers it once the section exists (Task 2).
3. A wide-site move (Task 1 step 5) must keep `plataforma-escena`'s box centred on the site, else the level-2 gate audits empty water: `src/lab/signs.test.ts` plus a docs test that §8 quotes the live `PLATFORM_SITES` (Task 4).
4. README's "no `COVER_FOCUS_U` fits the three" sentence lives in ADR 0003 too: ADR 0003 keeps its history but gains the "Revised by 0004" line; README must not repeat the old claim (Task 4 grep test).
5. The `/area/blog/` captures at 390×750 must show the tall-site sign in the map pane (zoneView with site): judged line in the README (Task 1).

---

**Stage 3 note.** The pipeline writes the failing tests of Tasks 2–4 in `src/lab/docs.test.ts` before implementation (`test(#429): evals`), plus `.scratch/evals-429.md` (the agent-browser script for Task 1). An implementer who finds a step's test already present runs it, confirms it fails for the expected reason, and moves on.

### Task 1: "After" captures, rotation and judgement

**Files:**
- Create: `docs/superpowers/specs/assets/423-composicion-responsive/despues/*.png`, `…/despues/README.md`
- Maybe modify: `src/scenes/sign-platform.ts` (`PLATFORM_SITES.wide`), `src/lab/exhibits.ts` (`plataforma-escena` box), tests that pin (550, 125)
- Test: `src/lab/docs.test.ts` (describe "#423 closing (#429)": captures exist with 2W×2H; README has one line per capture)

- [ ] **Step 1:** Run the docs test "after captures" — FAIL (folder missing).
- [ ] **Step 2:** Start `npm run dev -- --host --port 5173` (foreground-safe: started in the background by the shell with `nohup`/`&` and polled with `curl` until it answers; killed at the end of the task). Take the 10 captures with the `antes/README.md` sequence (reopen per size).
- [ ] **Step 3:** Rotation 900×1440 → 1440×900 → 900×1440 without reopening, per decision 4; captures `rotacion-900x1440.png`, `rotacion-1440x900.png` (and the return pair `rotacion-vuelta-*.png`).
- [ ] **Step 4:** Desktop ship check (four lab captures, `barcos-lab-1600x900-{1..4}.png`). Look at every capture (Read the PNG).
- [ ] **Step 5 (only if a ship crosses Writing):** shift `PLATFORM_SITES.wide` (+5, −5) per round, max 4 rounds, moving the `plataforma-escena` box the same; `npm test` green; retake `mapa-1600x900.png`, `mapa-1920x955.png`, `blog-1920x955.png` and the ship check. Record the final value and the reason.
- [ ] **Step 6:** Write `despues/README.md` in Spanish, same layout as `antes/README.md` (date, commit, viewport and scale, how it waited, command sequence, "Qué se ve" with one line per capture judging: three signs and the headland with its lighthouse; Writing lower right; at 390×750 no edge label; the mouth without holes or loose terrain; on desktop no ship over Writing). Include the rotation section with marker and transforms.
- [ ] **Step 7:** Docs test PASS; commit `docs(#429): capturas después y rotación`.

### Task 2: Level-3 legibility with the four contexts

**Files:**
- Regenerate: `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` and its crops
- Modify: `src/lab/docs.test.ts` (the "18" count → 24; `CONTEXTS` of the REPORT checks gain `plataforma-escena-angosta`; decision 2)
- Test: new `it("REPORT.md has plataforma-escena-angosta at both scales and its four crops")`

- [ ] **Step 1:** The new test FAILS (no section).
- [ ] **Step 2:** `npm run legibility` (foreground, timeout 10 min); exit code 0. If a row fails, stop and report: changing sign design is out of scope (spec §7).
- [ ] **Step 3:** Run `src/lab/docs.test.ts`; apply decision 2 if the 2026-11-15 coupling broke.
- [ ] **Step 4:** PASS; commit `docs(#429): legibilidad nivel 3 con los cuatro contextos`.

### Task 3: ADR 0004 and the ADR 0003 revision line

**Files:**
- Create: `docs/adr/0004-writing-site-follows-the-host.md`
- Modify: `docs/adr/0003-signs-are-the-navigation.md` (one line under Consequences: `- Revised by 0004: …`, one sentence)
- Test: `docs.test.ts`: ADR 0004 has `# 0004. The Writing site depends on the host` and `## Status`, `## Context`, `## Decision`, `## Consequences` in order plus a `Sources:` line; Status mentions "2026-11-18" and "#423"; ADR 0003 Consequences contains "Revised by 0004".

- [ ] **Step 1:** Tests FAIL.
- [ ] **Step 2:** Write the ADR with the content listed in issue #429 step 5 (Context, Decision, Consequences, Sources exactly as enumerated there).
- [ ] **Step 3:** PASS; commit `docs(#429): ADR 0004`.

### Task 4: Spec §8, README, CONTEXT and docs tests

**Files:**
- Modify: `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md`, `README.md`, `CONTEXT.md`, `src/lab/docs.test.ts`
- Test (new, in "#423 closing (#429)"):
  - `**Estado:**` line contains "implementado (#423)".
  - `## 8. Desvíos y medición` exists after `## 7.` and contains: `HEADLAND_SHIFT` with `(${x}, ${y})` from the constant; `PLATFORM_SITES` with both sites from the constant; `COVER_FOCUS_U` formatted with comma decimal (`0,39`); every vertex of `LANE_OUT` and `LANE_BACK` as `(x, y)`; `1,48`; `900×1440` and `1440×900`; `46 481`, `2 409`, and the after counts recomputed (decision 1) formatted with a thin/normal space thousands separator as written.
  - README and CONTEXT do not match `/\bPLATFORM_SITE\b/`, `/\bBLOG_SIGN\b/`, `/(?<![A-Z_])SIGNS\b/`, `/0[.,]35/` near "focus"/`COVER_FOCUS_U` (simply: no `0.35`/`0,35` in the README; in CONTEXT only the veil's `ACCENT_DIM` (0.35) is allowed), `/caps the shipyard/`.
  - README's runtime paragraph (`coverView(host)`) contains "0.39".

- [ ] **Step 1:** Tests FAIL.
- [ ] **Step 2:** Compute the after counts with a throwaway vitest (or `npx tsx`) and write §8 (Spanish): final values, lane vertices, threshold ≈ 1,48, rotation note, counts before/after, wide-site deviation if Task 1 step 5 moved it.
- [ ] **Step 3:** README: runtime paragraph says the focus is 0.39 and why; storybook paragraph keeps the Writing ids; world paragraph describes the headland on the east coast (Blog) with the lighthouse, and the lanes (outbound east of the headland and the narrow site, return west of the wide site); fix "`LANE_OUT` goes down toward the lower-left" only if it contradicts the code (the #87 test requires "lower-left": keep the phrase if still true on screen).
- [ ] **Step 4:** CONTEXT pass: Zone, Lanes, Sign, Cover frame, Landmark coherent with each other and with the code (site values, focus, headland position, lighthouse (410, 290)).
- [ ] **Step 5:** `npm test` and `npm run typecheck` green; commit `docs(#429): spec §8, README y CONTEXT`.
