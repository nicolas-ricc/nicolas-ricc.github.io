# `npm run legibility` (level 3) with Blog at ✓: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm run legibility` opens every `context` exhibit of the storybook at 1.17 and 0.83 with bloom, measures the rendered pixels (contrast, halo, OCR), and writes `REPORT.md` with crops; the Blog sign (`plataforma-escena`) ends at ✓.

**Architecture:** The storybook publishes a DEV-only hook `window.__lab` that exposes the fit, the host size and `extract.pixels` of the Pixi stage. A Node script (`scripts/legibility.ts`) starts its own vite on port 5179, drives agent-browser (session `legibility`), reads the word's crop through the hook, rasterizes the masks from the level-2 geometry (`SignSpec`), measures and runs OCR with tesseract.js on versioned `eng` data. Everything pure lives in `scripts/legibility-measure.ts` and `scripts/png.ts`, tested in `scripts/legibility.test.ts`; the browser, vite and tesseract plumbing stays in `scripts/legibility.ts`, which no test executes.

**Tech Stack:** TypeScript, tsx, vitest, Pixi 8.20 (`extract.pixels`), agent-browser 0.27, tesseract.js 7.0.0 (dev), `node:zlib`.

**Spec:** issue #377 (body is the spec of this task) and `docs/superpowers/specs/2026-11-15-carteles-de-zona-rediseno-design.md` §4.3.

## Global Constraints

- Code, comments, strings and identifiers in English (`src/english.test.ts` scans `src/`, `lab/`, README, CLAUDE.md; `scripts/` follows the same convention). `REPORT.md` lives in `docs/` and is Spanish where the issue pins it (table header `| Métrica | Valor | Umbral | ✓/✗ |`).
- Nothing in `src/world/`, `src/main.ts`, `index.html` or `src/style.css` changes. `src/iso`, `src/kit`, `src/scenes` stay Pixi-free. No `Math.random`. No hex color outside `src/map/palette-iso.ts`.
- Only new dependency: `tesseract.js` (devDependency, `7.0.0`, the latest stable). No sharp, canvas or ImageMagick.
- `REPORT.md` is always regenerated whole; never hand-edited.
- Thresholds are §4.3's: contrast ≥ 4.5 at 1.17, ≥ 3 at 0.83; halo ≤ 0.5; OCR exact at 1.17, case-insensitive at 0.83. They are not tuned to make Blog pass.
- `storybook.test.ts` pins fragments of `storybook.ts` (`stage?.destroy()`, the logs, the `c` key, the header sentence about `c`): do not break them.
- Level 3 does not run in CI (no browser): `npm test` must not start vite, a browser or tesseract.

## Decisions (technical assumptions, declared)

- **`eng` data = `4.0.0_best_int`.** tesseract.js 7.0.0's default `langPath` (read in `node_modules/tesseract.js/src/worker-script/index.js`) is `https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int` for the LSTM-only default and `…/4.0.0` (10.9 MB, legacy + LSTM) otherwise. `@tesseract.js-data/eng@1.0.0` ships no `fast` folder; `4.0.0_best_int` (2.95 MB gz) is the LSTM-only, integer-quantized model the default worker downloads, the closest to the issue's "fast, ≈ 2 MB". Downloaded once by hand into `scripts/tessdata/eng.traineddata.gz`.
- **Extract with the page's background.** `extract.pixels` renders the target on a transparent texture; the hook passes `clearColor: ISO_COLORS.sky` (the `Application` background), so every pixel is opaque and alpha is ignored by the measurer.
- **Ring = union, not per glyph.** The ring is ⋃(ink box + 3 w) − ⋃(ink box + 1 w) − core − holes over all glyphs, so a glyph's ring never lies inside its neighbour's box (where the neighbour's own halo would be counted as background). Holes are subtracted too (stage-4 ruling) so air wider than 2 w never counts as background.
- **Contrast is symmetric** (stage-6 review): (lighter + .05)/(darker + .05) of the core and ring medians, as WCAG and level 2 do. For light ink it equals §4.3's (core + .05)/(ring + .05). The halo `holes/core` still assumes light ink (every sign is neon today).
- **Pixel coverage:** a mask pixel (i, j) is in a polygon or disc when its center (i + 0.5, j + 0.5) is inside or on the edge.
- **Exit code 1** when any table row is ✗ or any level-2 `Violation` is listed.
- **agent-browser `eval`** prints the JSON of the evaluated value (promises awaited) and exits ≠ 0 on a page error; the script parses stdout with `JSON.parse`.

## Assumptions

From the grilling (stage 2). Each one records the alternative that was rejected.

- `agent-browser eval` stdout is the JSON of the value (strings quoted, promises awaited, exit ≠ 0 on page error). This was observed with agent-browser 0.27.0 (`eval 'JSON.stringify({a:1})'` → `"{\"a\":1}"`, `eval 'Promise.resolve("ab")'` → `"ab"`); no document states it. It is parsed by the tested `parseEval` (rejected: returning `JSON.stringify` from the page and stripping quotes by hand).
- `eng` data `4.0.0_best_int`, see Decisions (rejected: `tessdata_fast` from GitHub. It is not the tesseract.js default `langPath`, which is what the issue says to download from).
- tesseract.js honours `tessedit_char_whitelist` in LSTM mode (Tesseract ≥ 4.1). If the OCR reads characters outside the whitelist, the run shows it in the report's OCR row and Task 7 reports it instead of tuning the sign (rejected: legacy OEM, which needs the 10.9 MB data).
- An empty `holes` mask gives NaN and a ✗. Blog has counters (`B`, `o`, `g`) and air between every pair; a sign with neither would be a design to review, not a pass (rejected: skipping the halo row).
- If Task 7 is still ✗ after three rounds, the edits that improved the numbers are kept, the report is committed as it is, and the PR states which row fails (rejected: reverting them, which hides the evidence).
- The vite child is `node …/vite.js`, not the `.bin` wrapper, so that `kill()` stops it (rejected: `npx vite`, whose grandchild survives the kill).

## File map

- Modify `src/lab/storybook.ts` (hook + header), `src/lab/storybook.test.ts` (hook test).
- Create `scripts/png.ts` (PNG encoder), `scripts/legibility-measure.ts` (pure: mapping, masks, metrics, preprocess, OCR text, report), `scripts/legibility.ts` (CLI), `scripts/legibility.test.ts` (tests of both pure modules), `scripts/tessdata/eng.traineddata.gz`.
- Modify `package.json` / `package-lock.json` (script + devDependency), `README.md` (one line under the scripts list).
- Generated: `docs/superpowers/specs/assets/carteles-legibilidad/{REPORT.md, plataforma-escena-117.png, -083.png, -117-ocr.png, -083-ocr.png}`.
- Possibly modify `src/scenes/sign-platform.ts` (Task 7, only if Blog fails).

## Review Focus

1. **Crop partly outside the host** (the word near the edge at 0.83): the crop is clamped to the host and the masks still line up with the pixels. Test in Task 3: `wordCrop` clamps to `[0, w] × [0, h]`.
2. **Empty mask** (a sign with no counters, or every air rectangle empty): the median of no pixels is `NaN` and the row is ✗, never a silent ✓. Test in Task 4.
3. **Hook never appears** (vite not ready, page error, not DEV): the script fails within 30 s with a clear message, and still kills vite and closes the browser. Covered by the `try/finally` in Task 6 and checked by hand in Task 6 (`--only nope`).
4. **Unknown `--only <id>`** or an id that is not a `context` exhibit: exit 1 with the list of context ids, before starting vite. Test in Task 4 (`pickContexts`).
5. **Dark letters on a light backing** (a future sign): the OCR threshold puts letters in black on whichever side of the midpoint the core median lies. Test in Task 4.

---

### Task 1: storybook hook `window.__lab`

**Files:**
- Modify: `src/lab/storybook.ts`
- Test: `src/lab/storybook.test.ts`

**Interfaces:**
- Produces (page contract the script relies on):
  ```ts
  export interface LabHook {
    readonly exhibitId: string | null; readonly coverScale: number | null; setCoverScale(s: number | null): void;
    readonly bloom: BloomMode | null; fit(): Fit | null; hostSize(): { w: number; h: number };
    pixels(x: number, y: number, w: number, h: number): Promise<string>; // base64 RGBA, resolution 2
  }
  declare global { interface Window { __lab?: LabHook } }
  ```

- [ ] **Step 1: Write the failing test** in `storybook.test.ts`, `describe("lab hook (#377)")`:
  - `src` contains `if (import.meta.env.DEV)` followed (same block) by `window.__lab = `.
  - `src` matches `/interface LabHook/` and `/declare global \{\s*interface Window \{\s*__lab\?: LabHook/`.
  - for each of `exhibitId coverScale setCoverScale bloom fit hostSize pixels`: the `interface LabHook { … }` body (slice from `interface LabHook {` to the first `\n}`) declares it; `tsc` then guarantees the `window.__lab = {…}` literal implements every member (the global `Window.__lab?: LabHook` types it).
  - `src` contains `extract.pixels(` and `resolution: 2`.
  - header comment (joined as in the `c` test) contains `window.__lab`.
- [ ] **Step 2:** `npx vitest run src/lab/storybook.test.ts` → the new tests FAIL.
- [ ] **Step 3: Implement.** In `boot()`: `fit()` stores the applied `Fit` in `let lastFit: Fit | null`. After the first `fromHash()`, `if (import.meta.env.DEV) window.__lab = { get exhibitId() { return current?.id ?? null; }, get coverScale() {…}, setCoverScale(s) { coverScale = s; fit(); }, get bloom() { return stage?.bloom ?? null; }, fit: () => lastFit, hostSize: () => ({ w: host.clientWidth, h: host.clientHeight }), async pixels(x, y, w, h) { const { pixels } = app.renderer.extract.pixels({ target: app.stage, frame: new Rectangle(x, y, w, h), resolution: 2, clearColor: ISO_COLORS.sky }); return base64 of pixels; } };` Base64 in chunks of 0x8000 bytes through `String.fromCharCode` + `btoa`. Add one header sentence: "In development the page publishes `window.__lab` (exhibit id, cover scale and its setter, bloom mode, last fit, host size and `pixels`, the stage's RGBA at resolution 2 with filters) for `npm run legibility`."
- [ ] **Step 4:** `npx vitest run src/lab/` and `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#377): window.__lab hook in the storybook (DEV)`.

### Task 2: PNG encoder

**Files:**
- Create: `scripts/png.ts`
- Test: `scripts/legibility.test.ts` (`describe("png")`)

**Interfaces:**
- Produces: `encodePng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Buffer` (RGBA 8-bit, color type 6, filter 0 per row, IDAT = `zlib.deflateSync`, CRC32 table-driven); throws if `rgba.length !== width * height * 4`.

- [ ] **Step 1: Failing tests:** for a 3×2 image with known bytes: bytes 0–7 equal the PNG signature `89 50 4E 47 0D 0A 1A 0A`; `readUInt32BE(16) === 3`, `readUInt32BE(20) === 2`; chunk type at 12..16 is `IHDR`; the IHDR CRC equals CRC32 of type+data (compute with `zlib.crc32` from Node ≥ 22.2 in the test only); IDAT data through `zlib.inflateSync` equals, row by row, `[0, ...row bytes]`; the file ends with the `IEND` chunk `00 00 00 00 49 45 4E 44 AE 42 60 82`. Wrong length throws.
- [ ] **Step 2:** `npx vitest run scripts/legibility.test.ts` → FAIL (module missing).
- [ ] **Step 3:** implement `scripts/png.ts`.
- [ ] **Step 4:** tests PASS, `npm run typecheck` PASS.
- [ ] **Step 5: Commit** `feat(#377): PNG encoder for the legibility crops`.

### Task 3: world → image mapping, crop and masks

**Files:**
- Create: `scripts/legibility-measure.ts`
- Test: `scripts/legibility.test.ts` (`describe("masks")`)

**Interfaces:**
- Consumes: `SignSpec`, `SignGlyph` (`src/kit/legibility.ts`), `toWorld`, `GRID` (`src/kit/lettering.ts`), `project` (`src/iso/project.ts`), `Fit` (`src/world/frame.ts`).
- Produces:
  ```ts
  export const RES = 2; // image px per CSS px
  export interface Crop { x: number; y: number; w: number; h: number } // CSS px of the host, integers
  export interface Masks { w: number; h: number; core: Uint8Array; ring: Uint8Array; holes: Uint8Array } // w·h, 1 = in; holes = counters ∪ air
  export function toImage(p: Vec3, fit: Fit, crop: Crop): Vec2;   // project → (x·scale + fit.x − crop.x)·RES, same for y
  export function wordCrop(sign: SignSpec, fit: Fit, host: { w: number; h: number }): Crop; // bbox of all projected quad points ± 3·width·1.4·scale, floor/ceil, clamped to the host
  export function fillPolygon(mask: Uint8Array, w: number, h: number, poly: Vec2[]): void; // convex, scanline, pixel centers
  export function fillDisc(mask: Uint8Array, w: number, h: number, c: Vec2, r: number): void;
  export function signMasks(sign: SignSpec, fit: Fit, crop: Crop): Masks;
  ```
  `signMasks`: core = every glyph quad mapped with `toImage`; ring = ⋃ glyph ink box grown 3·width (text space, through `toWorld(g.plane, …)`, then `toImage`) minus ⋃ box grown 1·width minus core; counters = disc at `toImage(c.at)` with radius `c.r · 1.4 · fit.scale · RES`; air = for consecutive glyphs i, i+1 with `box_i.x1 < box_{i+1}.x0`, the quad `toWorld(P_i, x1_i, 0), toWorld(P_{i+1}, x0_{i+1}, 0), toWorld(P_{i+1}, x0_{i+1}, xH), toWorld(P_i, x1_i, xH)` with `xH = GRID.xHeight·size/GRID.cap`; holes = (counters ∪ air) − core. Masks have `w = crop.w·RES`, `h = crop.h·RES`.

- [ ] **Step 1: Failing tests:**
  - `fillPolygon` of the square (2,1)–(5,4) on a 8×6 mask fills exactly the 9 pixels with i ∈ {2,3,4}, j ∈ {1,2,3}; a triangle fills a pixel whose center is on its edge.
  - `fillDisc` center (4,4) r 1.5 on an 8×8 mask fills exactly the pixels whose center satisfies `hypot(i + 0.5 − 4, j + 0.5 − 4) ≤ 1.5` (assert against that brute-force set; it is the 2×2 block i, j ∈ {3, 4}).
  - `toImage(v3(0,0,0), {x:10,y:20,scale:2}, {x:4,y:6,w:…})` = `{x:12, y:28}`; a point with z = 1 moves up by `1.4·2·2` image px.
  - `wordCrop` of `BLOG_SIGN` at a fit that places it fully inside contains every projected quad point with ≥ `3·1.35·1.4·scale − 1` CSS px of margin; with a fit that pushes it past the left edge, `x === 0`.
  - `signMasks(BLOG_SIGN, fit, crop)`: core, ring and holes are pairwise disjoint; each is non-empty; at least one pixel at each `counters[*].at` mapped point is in `holes`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS; `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(#377): legibility masks from the level-2 geometry`.

### Task 4: metrics, OCR preprocess and verdicts

**Files:**
- Modify: `scripts/legibility-measure.ts`
- Test: `scripts/legibility.test.ts` (`describe("metrics")`)

**Interfaces:**
- Consumes: `Masks` (Task 3), `relativeLuminance`, `COVER_LAPTOP`, `COVER_PHONE` (`src/kit/legibility.ts`), `ContextExhibit`, `EXHIBITS` (`src/lab/exhibits.ts`).
- Produces:
  ```ts
  export const LEVEL3 = { contrast: { [COVER_LAPTOP]: 4.5, [COVER_PHONE]: 3 }, halo: 0.5 } as const;
  export function median(xs: readonly number[]): number;                       // NaN for []
  export function luminances(px: Uint8Array | Uint8ClampedArray, mask: Uint8Array): number[]; // relativeLuminance of each RGB in the mask
  export interface Measures { core: number; ring: number; holes: number; contrast: number; halo: number } // medians; contrast = (core+.05)/(ring+.05); halo = holes/core
  export function measure(px: Uint8Array | Uint8ClampedArray, m: Masks): Measures;
  export function ocrImage(px: Uint8Array | Uint8ClampedArray, w: number, h: number, core: number, ring: number): { data: Uint8Array; w: number; h: number }; // RGBA ×3 nearest; ink side of (core+ring)/2 → black, else white
  export const OCR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  export const normalizeOcr = (s: string): string => …; // removes all whitespace
  export interface Row { metric: string; value: string; limit: string; ok: boolean }
  export function verdicts(m: Measures, ocr: string, text: string, scale: number): Row[]; // three rows: contrast, halo, OCR
  export function parseEval<T>(stdout: string): T; // JSON.parse of trimmed stdout; throws `legibility: unexpected eval output: <first 80 chars>`
  export function pickContexts(exhibits: readonly Exhibit[], argv: readonly string[]): ContextExhibit[]; // --only <id>; throws with the list of context ids when unknown
  ```
  Rows: `contraste` value `x.xx:1`, limit `≥ 4.5:1` / `≥ 3:1`; `halo` value `0.xx`, limit `≤ 0.5`; `OCR` value the normalized text in backticks, limit `` = `Blog` `` at 1.17 and `` ≈ `Blog` (sin mayúsculas) `` at 0.83. `NaN` makes a row ✗.

- [ ] **Step 1: Failing tests:** `median([3,1,2]) === 2`, `median([1,2,3,4]) === 2.5`, `median([])` is NaN; `measure` on a synthetic 4×1 image (core white, ring black, holes 50 % gray) gives contrast `(1.05)/(0.05)` and halo ≈ `relativeLuminance(0x808080)`; `ocrImage` on a 2×1 image [white, black] with core 1, ring 0 gives 6×3 with the left 3 columns black (0,0,0,255) and the right 3 white; with core 0, ring 1 (dark letters) the left 3 columns are white; `normalizeOcr(" Bl og\n") === "Blog"`; `verdicts` at 1.17 with OCR `"blog"` and text `"Blog"` → OCR row ✗, at 0.83 ✓; contrast 4.4 at 1.17 ✗ and at 0.83 ✓; halo 0.51 ✗; NaN core → contrast and halo ✗; `parseEval('"ab"\n') === "ab"`, `parseEval('{"x":1,"y":2,"scale":3}')` deep-equals the object, `parseEval("true") === true`, `parseEval("[object Object]")` throws; `pickContexts(EXHIBITS, [])` returns every context, `["--only","plataforma-escena"]` returns that one, `["--only","faro"]` and `["--only","nope"]` throw with a message containing `plataforma-escena`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS, typecheck PASS.
- [ ] **Step 5: Commit** `feat(#377): level-3 metrics, OCR preprocess and verdicts`.

### Task 5: report

**Files:**
- Modify: `scripts/legibility-measure.ts`
- Test: `scripts/legibility.test.ts` (`describe("report")`)

**Interfaces:**
- Consumes: `Row` (Task 4), `Violation` (`src/kit/legibility.ts`).
- Produces:
  ```ts
  export interface ReportEntry { id: string; text: string; scale: number; rows: Row[]; crop: string; ocrCrop: string } // file names, relative to the report
  export const PREPROCESS: string; // the one-paragraph description written in the report and the script header
  export function scaleTag(scale: number): string;  // String(Math.round(scale·100)).padStart(3, "0"): 1.17 → "117", 0.83 → "083"
  export function renderReport(r: { date: string; viewport: string; entries: ReportEntry[]; violations: { id: string; scale: number; list: Violation[] }[] }): string;
  export const reportFails = (r: { entries: ReportEntry[]; violations: { list: Violation[] }[] }): boolean => …;
  ```
  Layout: `# Legibilidad, nivel 3` · line `Generado por \`npm run legibility\`; no se edita a mano.` · date, viewport, `PREPROCESS` · per entry `## <id> a <scale>` + the table `| Métrica | Valor | Umbral | ✓/✗ |` + `![<id> <scale>](<crop>) ![OCR](<ocrCrop>)` · `## Nivel 2 (checkSign)` with `Sin violaciones.` or one bullet per violation `- <id> a <scale>: <rule> = <value> (<limit>)`.

- [ ] **Step 1: Failing tests:** `scaleTag(1.17) === "117"`, `scaleTag(0.83) === "083"`; a report with one ✓ entry and one ✗ entry contains the header row once per entry, `✓` and `✗` in the last column, both image links, the date and viewport, `PREPROCESS`, and `Sin violaciones.`; with a violation it lists it; `reportFails` true with a ✗ row or a violation, false otherwise.
- [ ] **Step 2–4:** FAIL → implement → PASS (+ typecheck).
- [ ] **Step 5: Commit** `feat(#377): REPORT.md renderer`.

### Task 6: the CLI, `npm run legibility`

**Files:**
- Create: `scripts/legibility.ts`, `scripts/tessdata/eng.traineddata.gz`
- Modify: `package.json`, `package-lock.json`, `README.md`

**Interfaces:**
- Consumes: everything in Tasks 1–5; `checkSign`, `COVER_LAPTOP`, `COVER_PHONE`; `contextScene` (`src/lab/crop.ts`) and `assembleWorld` for the level-2 footer (as in `src/lab/signs.test.ts`).

- [ ] **Step 1:** `npm i -D tesseract.js@7.0.0`; `package.json` script `"legibility": "tsx scripts/legibility.ts"`. Download `https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz` to `scripts/tessdata/` (re-read the default `langPath` in `node_modules/tesseract.js/src/worker-script/index.js` first; if it changed, use the new one and say so in the PR).
- [ ] **Step 2: Implement `scripts/legibility.ts`.** Header comment: what it does, that it is level 3 of spec §4.3, that it does not run in CI, the preprocess (`PREPROCESS`), the session and the port. Flow, in `main()` wrapped in `try/finally` (finally: `agent-browser close` with its errors ignored, since the session may never have opened; then kill vite):
  1. `pickContexts(EXHIBITS, process.argv.slice(2))` (before anything starts). Check `agent-browser --version` runs, else throw `"legibility: agent-browser not found on PATH"`.
  2. spawn `process.execPath` with `node_modules/vite/bin/vite.js --port 5179 --strictPort` (cwd repo root; no `.bin` shell wrapper, so `kill()` reaches vite itself); poll `fetch("http://localhost:5179/lab/storybook.html")` every 250 ms until 200, 30 s max, and fail at once with vite's stderr if the child exits first (port taken).
  3. `ab(...args)` = `execFileSync("agent-browser", args, { env: { ...process.env, AGENT_BROWSER_SESSION: "legibility" }, maxBuffer: 64 MB })`; `evalJson<T>(js)` = `JSON.parse(stdout)`. `ab("set","viewport","1600","900","2")`.
  4. per exhibit and scale `[COVER_LAPTOP, COVER_PHONE]`: `open "http://localhost:5179/lab/storybook.html?bloom=on&speed=0#<id>"`; poll `evalJson("window.__lab?.exhibitId === '<id>' && window.__lab.bloom === 'on'")` every 500 ms up to 30 s, else throw `legibility: window.__lab did not appear for <id> in 30 s`; `setCoverScale(scale)`; read `fit()` and `hostSize()`; `wordCrop`, `signMasks`; `pixels` → `Buffer.from(b64, "base64")`, throw if its length ≠ `crop.w·RES · crop.h·RES · 4` (masks and pixels must share the grid); `measure`; `ocrImage`; OCR with one worker created once: `createWorker("eng", OEM.LSTM_ONLY, { langPath: <abs scripts/tessdata>, gzip: true, cacheMethod: "none" })`, `setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: OCR_WHITELIST })`, `recognize(pngBuffer of the OCR image)`; `normalizeOcr`; `verdicts`.
  5. write the four PNGs and `REPORT.md` (`renderReport`, date `new Date().toISOString().slice(0,10)`, viewport `1600×900 @2`) into `docs/superpowers/specs/assets/carteles-legibilidad/` (mkdir -p); level-2 footer: `checkSign(e.sign, scale, contextScene(scene, e).solids)` for every picked exhibit and scale. Print one line per entry; `process.exitCode = reportFails(...) ? 1 : 0`. Any thrown error: print `legibility: <message>` and exit 1.
- [ ] **Step 3:** README, under the scripts list: `` - `npm run legibility` — level 3 of the sign legibility guardrails: starts its own vite on 5179, opens every context exhibit in agent-browser at 1.17 and 0.83 with bloom, measures contrast, halo and OCR in pixels and writes `docs/superpowers/specs/assets/carteles-legibilidad/REPORT.md` with the crops. Needs agent-browser; not run in CI. ``
- [ ] **Step 4: Verify:** `npm run typecheck` PASS; `npm test` PASS; `npm run legibility -- --only nope` exits 1 listing `plataforma-escena` without starting vite; `npm run legibility` runs end to end and writes the report (✓ or ✗; Task 7 owns the ✓); `ss -ltn | grep 5179` empty afterwards; with network blocked for the run (`unshare -n` is not needed: check that `REPORT.md` was produced with `langPath` local and grep the script for `http` outside `localhost`).
- [ ] **Step 5: Commit** `feat(#377): npm run legibility (level 3) with versioned eng data`.

### Task 7: Blog at ✓

**Files:**
- Generated: `docs/superpowers/specs/assets/carteles-legibilidad/*`
- Possibly modify: `src/scenes/sign-platform.ts` (or `src/kit/lettering.ts` glyphs for OCR)

- [ ] **Step 1:** `npm run legibility`. If every row of `plataforma-escena` at 1.17 and 0.83 is ✓, go to Step 3.
- [ ] **Step 2:** If halo or contrast fail, change only the Blog sign: the `neon` alpha (0.75), drop the tube's `Bleed` halo, darken the panel with `toneOffset`. If OCR fails, adjust glyphs in `src/kit/lettering.ts` keeping `legibility.test.ts`, `lettering.test.ts` and `signs.test.ts` green (`SIGN_FONT` unchanged). Never the world's bloom, never the thresholds. Re-run `npm test` and `npm run legibility`; at most three rounds, then document what fails.
- [ ] **Step 3:** look at the crops (Read the PNGs) to confirm a person reads `Blog`.
- [ ] **Step 4: Commit** the report and the crops: `feat(#377): Blog sign at ✓ in level 3 (REPORT.md and crops)`.

## Grilling

- Rounds: 1. The griller's model was `fable`. Revisions after the round were local (one test seam, `parseEval`, plus process and size checks; no task added or removed), so no second round.
- Questions: 18. Answered from **ISSUE**: 6 (extract applies filters; the `1.4·scale` radius and margin; the halo/contrast definitions; the AC mapping for `--only`, footer and exit 1; report and crops in the PR; DEV-only hook). From **CODE**: 8:
  - `storybook.ts`: `fit` goes on `stage.container`, `resolution`/`autoDensity`; `coverScale`; `ISO_COLORS` already imported.
  - `vitest.config.ts` and `tsconfig.json` include `scripts`; `signs.test.ts` imports `exhibits`/`crop` under node, and so does tsx.
  - `page.ts` `bloomFromSearch`/`speedFromSearch`; `BloomMode` in `stage.ts`.
  - `COVER_LAPTOP`/`COVER_PHONE` are literals in `legibility.ts:45-47`.
  - The tesseract `langPath` and local `readCache` at `worker-script/index.js:130-151`.
  - `signSpec`'s `glyphPlane` and the convex segment quads/squares in `lettering.ts`.

  **NO SOURCE → technical assumption**: 4 (eval stdout format, vite process handling, three failed rounds, the hook test's slice), plus 3 partial ones (best_int vs fast, the LSTM whitelist, empty holes). All are in `## Assumptions`.
- Spec ambiguities: 0. Follow-up issues opened: none.
