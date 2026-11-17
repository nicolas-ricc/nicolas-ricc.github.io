# Wreck: diagnóstico de la línea vertical (#404): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un barrido reproducible (`npm run wreck-sweep`) que recorre el exhibit `#pecio` con time-lapse en 3 modos de bloom × 2 disposiciones × 40 frames y cuenta los píxeles no-cielo fuera de la envolvente; con él, bisecar contra `main` y escribir el diagnóstico en el spec (§5 — diagnóstico).

**Architecture:** un módulo puro `scripts/sky-oracle.ts` (envolvente en px CSS del host a partir de los ítems de encuadre y el `Fit`; conteo de píxeles no-cielo en la zona prohibida; elección del encuadre que reproduce el `Fit` de la página) con sus tests, y un runner `scripts/wreck-sweep.ts` que copia el patrón de `scripts/legibility.ts` (vite propio, agent-browser, `window.__lab`). El runner calcula en Node el encuadre del `pecio` y lo valida contra `__lab.fit()`; si la página no tiene `__lab.tick` (como `main`), cae a modo vivo (`?speed=20`, una lectura cada 250 ms). El código del motor no cambia salvo que el barrido encuentre una causa.

**Tech Stack:** TypeScript, Vitest, tsx, agent-browser 0.26 con Chrome headless 148, PixiJS v8 (solo en la página).

**Spec:** issue #404 y `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md` §5 (captura `assets/2026-11-16-storybook-luces/11.jpg`).

## Global Constraints

- Oráculo: "Fuera de esa envolvente, en el host, todo píxel tiene que ser `ISO_COLORS.sky` (#100e19); dentro, por encima del vértice norte del rombo y del tope proyectado de los sólidos (z 7.3) + 2 px, también. Se lee con `__lab.pixels`."
- Envolvente: "el rectángulo proyectado de `contentFrame` (`__lab.fit()` lo contiene; podés calcularla en Node con `contentFrame` sobre `cropScene`/`cropAnimators` de la caja de `pecio`)".
- Time-lapse: "`?speed=0&bloom=<modo>`, y por cada frame `__lab.tick(250)` + lectura de píxeles; ≥ 40 frames (10 s simulados) por modo, en los modos `off`, `on` y `fallback`, y en dos disposiciones: `set viewport 900 1015 2` y `412 915 2`."
- Bisección: "repetir el barrido (modo `on` y `off`, 900 × 1015 @2) con `git worktree` de `origin/main` servido en otro puerto".
- Si la causa está en el código, se corrige en el origen (`src/world/stage.ts`, `src/world/veil.ts`, `src/world/frame.ts`, `src/scenes/sea.ts`) con test donde sea puro.
- `src/` en inglés (`english.test.ts`); nada de Pixi en los tests (`pixi-free.test.ts`); los tests nuevos van en `scripts/*.test.ts` (los incluye `vitest.config.ts`). `npm test` y `npm run typecheck` en verde.

## Datos

- `pecio`: caja `{ x0: 485, y0: 257, x1: 528, y1: 288 }`, `h: 9` (`src/lab/exhibits.ts:254`). Vértice norte del rombo: `project(485, 257, 0).y = 371`. Tope del mástil: z 7.3.
- `project(v) = { x: v.x − v.y, y: (v.x + v.y)/2 − 1.4·v.z }`. `fitTransform` centra con margen 4 %: un punto de pantalla `p` cae en el host en `p·scale + (x, y)`.
- `__lab.pixels(x, y, w, h)` devuelve RGBA en base64 a resolución 2 (`w·2 × h·2` píxeles), con `clearColor` sky = `[16, 14, 25]`.
- Sondeo previo (2026-11-17, rama, 900×1015 @2, bloom off): host 900 × 512, `fit.scale` 9.24, sin línea visible. Una lectura completa tarda ~1 s (9.8 MB de base64): 240 frames ≈ 5 min.

## Decisiones técnicas (declaradas)

1. **Zona prohibida.** Fuera del rectángulo de la envolvente (bounds de los ítems de encuadre en px del host), o dentro con `y < ceiling`, donde `ceiling = min(y del vértice norte a z 0, min y de los ítems `layer: "solid"`) − 2` en px del host. Comparación exacta con sky (tolerancia 0 por canal).
2. **Encuadre validado, no supuesto.** El runner arma candidatos `contentFrame(cropScene, cropAnimators, { box, h, clip: box })` y `boxFrame(box, h)` (este es el de `main`), y `pickFrame` elige el que reproduce `__lab.fit()` (|Δ| ≤ 1e-6 en x, y, scale). Si ninguno coincide, el runner falla: la envolvente sería mentira.
3. **Modo vivo para `main`.** Sin `__lab.tick` se abre con `?speed=20` y se lee cada 250 ms reales; el resultado dice `live`. El Ticker en headless da ~0.2·N s simulados por segundo real: se declara en el diagnóstico.
4. **Alcance del oráculo.** `pixels` re-renderiza `app.stage` con `extract`; no ve artefactos del compositor del dispositivo. Se declara en el diagnóstico.
5. **Datos por capa.** Si la rama da 0 en todo, el diagnóstico igual lista los candidatos (bordes de filtro de bloom y `AlphaFilter`, velos alpha 0, antialias de `drawLayer`, dispositivo) con el dato que los descarta, incluido un barrido con `stage.children[i].visible = false` por slot (opción `--hide <i,…>` del runner).

## Review Focus

- La página tarda en aparecer o en aplicar `?bloom=` (modo `on` lento en headless): el runner espera `exhibitId === "pecio"` y `bloom === modo` hasta 60 s antes de leer, y falla con mensaje si no.
- El host cambia de tamaño entre disposiciones: la envolvente se recalcula por disposición con `hostSize()`, nunca se reutiliza.
- Búfer de `pixels` con largo inesperado: `offSky` lanza si `rgba.length !== w·res·h·res·4`.
- Envolvente que se sale del host: se recorta al host, no da índices negativos (test).
- Un frame con la primera coordenada ofensora: se informa en px CSS del host, no en px de la textura (test).

---

### Task 1: oráculo de píxeles (`scripts/sky-oracle.ts`)

**Files:**
- Create: `scripts/sky-oracle.ts`
- Test: `scripts/sky-oracle.test.ts`

**Interfaces:**
- Consumes: `RenderItem` (`src/iso/render-list`), `Fit`, `Box`, `fitTransform` (`src/world/frame`), `project`, `v3`.
- Produces:
  - `export const SKY: readonly [number, number, number]` = `[0x10, 0x0e, 0x19]` (derivado de `ISO_COLORS.sky`).
  - `export interface Envelope { x0: number; y0: number; x1: number; y1: number; ceiling: number }` (px CSS del host).
  - `export function envelopeOf(items: readonly RenderItem[], fit: Fit, box: Box): Envelope`
  - `export function offSky(rgba: Uint8Array, host: { w: number; h: number }, res: number, env: Envelope): { count: number; first: { x: number; y: number } | null }` — recorre en orden de filas; un píxel de textura `(i, j)` se evalúa en su centro en px CSS, `((i + 0.5)/res, (j + 0.5)/res)`: es prohibido si cae fuera de `[x0, x1] × [y0, y1]` o si su `y < ceiling`; `first` en px CSS enteros (`floor(i / res)`, `floor(j / res)`).
  - `export function pickFrame<T extends { name: string; items: readonly RenderItem[] }>(candidates: readonly T[], fit: Fit, host: { w: number; h: number }): T | null`

- [ ] **Step 1: tests que fallan** en `scripts/sky-oracle.test.ts`:
  - `envelopeOf` con un ítem ground `[0,0, 10,0, 10,10, 0,10]`, uno solid `[4,2, 6,2, 6,8]`, `fit {x:5, y:7, scale:2}`, caja `{x0:0,y0:0,x1:2,y1:2}` (vértice norte y=0) → `{ x0: 5, y0: 7, x1: 25, y1: 27, ceiling: 5 }` (min(0, 2)·2 + 7 − 2).
  - `offSky` sobre un host 4×3 a res 2 todo sky → `{ count: 0, first: null }`.
  - un píxel `[17,14,25,255]` en (6, 1) de la textura, fuera de una envolvente `{x0:0,y0:0,x1:2,y1:3,ceiling:0}` → `count 1`, `first {x:3, y:0}`.
  - el mismo píxel dentro de la envolvente y por debajo del techo → `count 0`; dentro y por encima del techo → `count 1` (envolvente `{x0:0,y0:0,x1:4,y1:3}` con `ceiling: 0` → 0 y con `ceiling: 1` → 1; el centro del píxel está en (3.25, 0.75)).
  - envolvente más grande que el host (`x0: -10, x1: 99`) → no lanza, cuenta 0 sobre sky.
  - `rgba` de largo equivocado → lanza `/bytes/`.
  - `pickFrame`: dos candidatos, el `Fit` de `fitTransform(b.items, 900, 512)` → devuelve `b`; un `Fit` arbitrario → `null`.
- [ ] **Step 2:** `npx vitest run scripts/sky-oracle.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** implementar las firmas de arriba.
- [ ] **Step 4:** el mismo comando → PASS; `npm run typecheck` limpio.
- [ ] **Step 5:** commit `feat(#404): sky oracle for the wreck sweep`.

### Task 2: runner del barrido (`scripts/wreck-sweep.ts`, `npm run wreck-sweep`)

**Files:**
- Create: `scripts/wreck-sweep.ts`
- Modify: `scripts/sky-oracle.ts` (agrega `parseSweepArgs`, `formatSweepRow`), `scripts/sky-oracle.test.ts`, `package.json` (`"wreck-sweep": "tsx scripts/wreck-sweep.ts"`)

**Interfaces:**
- Consumes: Task 1; `contentFrame` (`src/lab/frame`), `cropScene`/`cropAnimators` (`src/lab/crop`), `EXHIBITS`, `assembleWorld`, `boxFrame`, `parseEval` (`scripts/legibility-measure`).
- Produces:
  - `export interface SweepArgs { origin: string | null; frames: number; modes: BloomMode[]; viewports: [number, number][]; hide: number[] }`
  - `export function parseSweepArgs(argv: readonly string[]): SweepArgs` — defaults: `origin null` (vite propio en 5180), `frames 40`, `modes ["off","on","fallback"]`, `viewports [[900,1015],[412,915]]`, `hide []`. Flags `--origin <url>`, `--frames <n>`, `--modes a,b`, `--viewports 900x1015,412x915`, `--hide 3,4`. Valor desconocido → lanza.
  - `export function formatSweepRow(r: { viewport: string; mode: string; clock: "tick" | "live"; frame: string; frames: number; count: number; first: { x: number; y: number } | null }): string` → p. ej. `900x1015 on tick content 40 frames: 0 off-sky px` o `…: 12 off-sky px, first at (420, 270)`.

- [ ] **Step 1: tests que fallan** para `parseSweepArgs` (defaults; `--modes on,off --frames 5 --origin http://localhost:5181 --viewports 900x1015 --hide 3`; `--modes bogus` lanza) y `formatSweepRow` (las dos formas de arriba).
- [ ] **Step 2:** `npx vitest run scripts/sky-oracle.test.ts` → FAIL.
- [ ] **Step 3:** implementar ambas y `scripts/wreck-sweep.ts`: sesión agent-browser `wreck-sweep`, por disposición `set viewport W H 2`, por modo `open <origin>/lab/storybook.html?speed=0&bloom=<modo>#pecio` (o `?speed=20` si `typeof __lab.tick !== "function"`), esperar listo, aplicar `--hide`, `pickFrame` sobre `[content, box]`, `envelopeOf`, 40 × (`tick(250)` o `sleep(250)` + `pixels(0,0,w,h)` + `offSky`), una línea por combinación con `formatSweepRow`, código de salida 1 si algún `count > 0`. Comentario de cabecera como el de `legibility.ts` (uso y qué mide).
- [ ] **Step 4:** tests → PASS; typecheck limpio; `npm run wreck-sweep -- --frames 2 --modes off --viewports 900x1015` corre y escribe una fila con 0.
- [ ] **Step 5:** commit `feat(#404): wreck sweep runner`.

### Task 3: barrido, bisección y diagnóstico

**Files:**
- Modify: `docs/superpowers/specs/2026-11-16-storybook-luces-y-encuadre-design.md` (sección nueva `## §5 — diagnóstico`), `README.md` (una línea `npm run wreck-sweep` en la lista de scripts), `src/lab/docs.test.ts` (test que fija ambas)
- Fuente si hay causa en el código: `src/world/stage.ts` / `veil.ts` / `frame.ts` / `src/scenes/sea.ts` con test puro.

- [ ] **Step 1: test que falla** en `src/lab/docs.test.ts`: el spec contiene `## §5 — diagnóstico` y `npm run wreck-sweep`; README contiene `npm run wreck-sweep`.
- [ ] **Step 2:** correr `npm run wreck-sweep` completo en la rama; guardar la salida.
- [ ] **Step 3:** `git worktree add /tmp/main-404 origin/main`, `npm ci`/symlink de `node_modules`, `npm run feed`, vite en 5181; `npm run wreck-sweep -- --origin http://localhost:5181 --modes on,off --viewports 900x1015` (modo vivo); si aparece, repetir ocultando slots para nombrar la capa y el cambio de la rama que la elimina; si no, barrido con `--hide` por slot para los candidatos.
- [ ] **Step 4:** escribir §5 — diagnóstico (qué se probó, qué se descartó con los datos, causa o "no reproducible en Chrome headless 148; candidatos descartados: …", qué cambio la elimina) y la línea del README. Tests → PASS.
- [ ] **Step 5:** commit `docs(#404): wreck vertical line diagnosis`.
