# Cierre de #207 (fábrica en detalle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la historia #207: juntar la evidencia de §12 (vista del mundo antes/después, tabla de caras, `totals` del mundo, medición de rendimiento) y poner al día README, el docstring de `factory.ts` y la spec con su sección de desvíos.

**Architecture:** No cambia código de escena. Tres entregables: (1) docs (README + docstring) fijados por tests de documentación en `src/lab/docs.test.ts`, como ya hace el repo para barcos y storybook; (2) mediciones tomadas con un script `tsx` efímero y con agent-browser, sin commitear el script, con las capturas en `docs/superpowers/specs/assets/207-fabrica/`; (3) la sección "14. Desvíos y medición" de la spec, también fijada por test. El checklist de §12 va en la descripción del PR (stage 8), no en un archivo.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS 8, agent-browser (+ extensión PixiJS DevTools, ver CLAUDE.md), `tsx`.

**Spec:** issue #217 (criterios de aceptación) y `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` §12. Contexto: plan de la historia en el comentario de #207. Hijos: issues #208–#216 (todos cerrados), PRs del kit #219–#222 y de las piezas #224–#228, ya mergeados en la rama base (`git log origin/feature/207-fabrica-detalle`: 79505d4 … ec8e8e5).

## Global Constraints

- Rama base `feature/207-fabrica-detalle`; el PR va contra esa rama.
- Capturas: agent-browser, viewport 1600×900, escala 2 (PNG 3200×1800), `/lab/world.html`, tecla `1` (encuadre Portfolio).
- "Antes" = `origin/main` (worktree en `/tmp/main`, `npm ci`, servido en otro puerto, p. ej. 5174). "Después" = esta rama en 5173.
- Exhibits de la tabla: `planta`, `chimeneas`, `subestacion`, `playa-vias`, `cinta`, `excavadora` (antes de `excavadora`: "—"). Se suma `tanque-agua` como fila informativa (exhibit de pieza de #214, antes "—").
- Caras = `readout(cropScene(scene, box), cropAnimators(animators, box)).faces` de `src/lab/crop.ts`, con la caja del exhibit **de cada árbol** (antes: la caja de `main`; después: la de la rama). Es lo que muestra el panel. El script no se commitea.
- Presupuesto de `bloom-runtime`: 15 ms (`BLOOM_BUDGET_MS`). Si el promedio de `[lab] bloom` supera 15 ms se abre un follow-up (label `needs-triage` + `agent-follow-up`, cuerpo empieza con `Follow-up of #217`) con la medición y los exhibits ordenados por caras. Este issue no simplifica piezas.
- `CLAUDE.md` no cambia (el método de captura no cambió).
- `npm test`, `npm run typecheck` y `npm run build` en verde.
- Idioma de docs y comentarios: castellano rioplatense, como el resto del repo.

## Review Focus

1. **El README habla de la fábrica en el párrafo correcto.** El párrafo "Mundo isométrico" (el que nombra `factory.ts`) es el que tiene que describir las piezas; un test que busque en todo el README pasaría con una mención en otra parte. Test: el párrafo que contiene `` `factory.ts` `` nombra nave de calderas, maltería, tanque, chimeneas con bandas, subestación y excavadora de rueda (Task 1).
2. **La spec en la lista del párrafo del laboratorio**, no en cualquier lado: mismo patrón que el test del storybook (Task 1).
3. **Mediciones en headless**: agent-browser corre a ~2 fps y con GPU software; el número de `[lab] bloom` puede no representar una máquina real. Se informa tal cual, con el entorno (renderer, `rendererType`), y la decisión del follow-up se toma sobre ese número (Task 2).
4. **"Antes" con las cajas viejas**: las cajas de `planta`, `subestacion` y `playa-vias` cambiaron en los hijos; la tabla aclara que cada columna usa la caja de su árbol (Task 2/3).
5. **La sección de desvíos se puede encontrar**: el título exacto `## 14. Desvíos y medición`, con la tabla y los enlaces a `mundo-antes.png`/`mundo-despues.png` adentro; la línea `**Estado:**` deja de decir "pendiente" (Task 3).

## Assumptions

- **A1. Entorno de la medición.** La única máquina disponible es agent-browser headless (método de captura de CLAUDE.md). El issue no dice en qué entorno medir, así que se mide ahí y se informa con `rendererType`. Alternativa descartada: no medir. **Regla:** se abre follow-up si **cualquiera** de las dos corridas calientes supera 15 ms (descartada: exigir que las dos lo superen).
- **A2. Suma de `totals`.** El issue pide "sumar los `totals`" sin decir qué claves. Se informan todas las claves y dos sumas: con y sin `containers`. Descartada: una sola suma.
- **A3. "Antes" con la caja de `main`.** Es lo que muestra el panel en `main`, y coincide con los "antes" de los hijos (#224: 165 caras; #225: planta 39, cinta 99; #226: 67; #228: playa-vias 42). Descartada: la caja nueva sobre `main`.
- **A4. `## 14.`** sigue a §13 "Fuera de alcance", la última sección. Si más adelante aparece un §15, el slice del test lo incluye; eso no rompe nada.
- **A5. #223** (pilastra de la maltería en x 44, abierto): #227 D2 la corrió a x 43.5..44. Se anota en desvíos sin cerrar el issue, porque cerrarlo no es alcance de #217.

---

### Task 1: README y docstring de `factory.ts`

**Files:**
- Modify: `README.md` (párrafo "Mundo isométrico", líneas ~16–33, y la lista de specs del párrafo del laboratorio, ~líneas 51–62)
- Modify: `src/scenes/factory.ts:14-24` (docstring de la escena)
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Write the failing tests** — nuevo `describe("documentación de la fábrica en detalle (#217)")` en `src/lab/docs.test.ts`:

```ts
const factorySrc = readFileSync(`${ROOT}src/scenes/factory.ts`, "utf8");
const mundo = readme.split(/\n\s*\n/).find((p) => p.includes("`factory.ts`")) ?? "";
const lab = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/world.html")) ?? "";
it("el párrafo del mundo isométrico describe la fábrica nueva", () => {
  for (const re of [/nave de calderas/, /maltería/, /tanque de agua/, /chimeneas[^.]*bandas/, /subestación de intemperie/, /excavadora de rueda/]) expect(mundo).toMatch(re);
});
it("README lista la spec de la fábrica en detalle entre las specs", () => {
  expect(lab).toContain("2026-10-24-fabrica-detalle-design.md");
});
it("el docstring de factory.ts apunta a la spec nueva", () => {
  const doc = factorySrc.slice(0, factorySrc.indexOf("export interface FactoryScene"));
  expect(doc).toContain("docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md");
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lab/docs.test.ts`: fallan los tres nuevos.
- [ ] **Step 3: Editar README y docstring.** README: en el párrafo del mundo, tras "`factory.ts` (fábrica de Portfolio" agregar una frase: nave de calderas (Fábrica de Luz), maltería de Mistley y tanque de agua sobre patas, tres chimeneas con bandas de balizamiento, subestación de intemperie y excavadora de rueda de cangilones con la rueda animada (`factory.wheel`). Lista de specs: agregar `` `2026-10-24-fabrica-detalle-design.md` `` al final, antes del `)`. Docstring: mantener la línea de `2026-09-14-…§5` y agregar `Detalle de planta, chimeneas, subestación y excavadora: docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md.`
- [ ] **Step 4: Run, expect PASS** — `npx vitest run src/lab/docs.test.ts`.
- [ ] **Step 5: Commit** — `docs(#217): README y docstring de factory.ts con la fábrica en detalle`.

### Task 2: Mediciones y vista del mundo (sin código commiteado)

**Files:**
- Create: `docs/superpowers/specs/assets/207-fabrica/mundo-antes.png`, `mundo-despues.png`
- Create (no se commitea): `.scratch/caras-217.ts`, `.scratch/medicion-217.md`

**Interfaces:**
- Consumes: `EXHIBITS` (`src/lab/exhibits.ts`), `assembleWorld` (`src/world/assemble.ts`), `cropScene`/`cropAnimators`/`readout`/`pieceScene` (`src/lab/crop.ts`).
- Produces: `.scratch/medicion-217.md` con cuatro bloques que la Task 3 y el PR copian: (a) tabla de caras por exhibit (sólidos y caras antes → después), (b) `totals` de `rendering.capture()` del mundo antes y después y su suma, (c) dos corridas calientes de `[lab] bloom: …` y `[lab] peor redibujo en 5 s: …` (después), (d) entorno: versión de Pixi, `rendererType`, viewport.

- [ ] **Step 1: Worktree de main.** `git worktree add /tmp/main origin/main && (cd /tmp/main && npm ci)` (`predev` corre `npm run feed`). Esperado: `/tmp/main/node_modules` existe.
- [ ] **Step 2: Script de caras.** `.scratch/caras-217.ts` recibe por argumento la raíz del árbol, importa dinámicamente `src/lab/exhibits.ts`, `src/world/assemble.ts` y `src/lab/crop.ts` de esa raíz, arma `assembleWorld(undefined, { reducedMotion: false })` (como el panel del storybook y `exhibits.test.ts:28`) y, para cada id de la lista de Global Constraints que exista, imprime `id sólidos caras` (region: `readout(cropScene(scene, e.box), cropAnimators(animators, e.box))`; piece: `readout(pieceScene(e.build, e.pad), [])`). Correr con `npx tsx .scratch/caras-217.ts /tmp/main` y `npx tsx .scratch/caras-217.ts /work`. Verificación: las **caras** "antes" coinciden con los que informaron los hijos (planta 39, chimeneas 165, subestacion 67, playa-vias 42, cinta 99) y los "después" con el panel del storybook en `#excavadora` (ver Step 4).
- [ ] **Step 3: Servidores.** `npm run dev -- --host --port 5173` (rama) y en `/tmp/main` `npm run dev -- --host --port 5174`, en foreground con `timeout`/`nohup` gestionado por el shell del implementador; verificar con `curl -sf http://localhost:5173/lab/world.html` y `:5174`.
- [ ] **Step 4: Capturas del mundo.** agent-browser con la extensión DevTools (comando de CLAUDE.md), `set viewport 1600 900 2`, abrir `http://localhost:5174/lab/world.html?speed=0`, `press 1`, esperar a que `agent-browser console` muestre `[lab] primer dibujo` (`page.ts:56`), `screenshot docs/superpowers/specs/assets/207-fabrica/mundo-antes.png`; lo mismo en 5173 → `mundo-despues.png`. Verificar con `file` que ambos son PNG 3200 x 1800 y mirarlos (Read) para confirmar que la fábrica entera está en cuadro.
- [ ] **Step 5: `totals`.** En cada página (ya con `1` apretado), `agent-browser eval` con `rendering.capture()` (snippet de CLAUDE.md) y anotar `totals` e `instructions.length`. Sumar los conteos de `totals` (containers excluidos: sumar graphics + meshes + sprites + texts + filters + masks; anotar la suma y el desglose).
- [ ] **Step 6: Rendimiento.** En 5173, `http://localhost:5173/lab/world.html` sin `?bloom` ni `?speed`, `press 1`; el log solo sale con el dev server (`import.meta.env.DEV`, `page.ts:44`) y `[lab] bloom` llega tras `BLOOM_SAMPLE_FRAMES = 60` frames (`bloom.ts:2`), ~30–60 s a ~2 fps; esperar con `agent-browser wait` en bucle y leer `agent-browser console` hasta ver `[lab] bloom: …` y un `[lab] peor redibujo en 5 s: …`. Recargar (corrida caliente 1) y repetir (corrida caliente 2): se informan las dos corridas posteriores a la primera carga. Anotar `rendererType`.
- [ ] **Step 7: Follow-up condicional.** Si alguna corrida caliente informa promedio > 15 ms: `gh issue create … --label needs-triage --label agent-follow-up` con cuerpo que empieza `Follow-up of #217`, la medición, el entorno y la tabla de caras ordenada de mayor a menor. Anotar el número en `.scratch/medicion-217.md`. Si no, anotar "≤ 15 ms, sin follow-up".
- [ ] **Step 8: Limpieza** (también si la tarea aborta a mitad): matar los dos `vite`, `agent-browser close`, `git worktree remove --force /tmp/main`. `.scratch/` está en `.git/info/exclude`.
- [ ] **Step 9: Commit** — `git add docs/superpowers/specs/assets/207-fabrica/mundo-*.png && git commit -m "docs(#217): vista del mundo con la fábrica antes y después"`.

### Task 3: Spec — estado y sección "Desvíos y medición"

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` (línea `**Estado:**` y sección nueva al final)
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: `.scratch/medicion-217.md` (Task 2); desvíos de los PRs #219–#222 y #224–#228 y planes `docs/plans/2026-10-24-21{2..6}-*.md`.
- Produces: la sección que el PR enlaza.

- [ ] **Step 1: Write the failing tests** — en el mismo `describe` de Task 1:

```ts
const fab = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md`, "utf8");
const desvios = fab.slice(fab.search(/^## 14\. Desvíos y medición$/m));
it("la spec de la fábrica dice implementada", () => {
  const estado = fab.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
  expect(estado).toMatch(/implementad/);
  expect(estado).not.toMatch(/pendiente/);
});
it("la spec cierra con desvíos, tabla de caras y medición", () => {
  expect(fab).toMatch(/^## 14\. Desvíos y medición$/m);
  for (const id of ["planta", "chimeneas", "subestacion", "playa-vias", "cinta", "excavadora"]) expect(desvios).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
  expect(desvios).toContain("assets/207-fabrica/mundo-antes.png");
  expect(desvios).toContain("assets/207-fabrica/mundo-despues.png");
  expect(desvios).toMatch(/\[lab\] bloom/);
  expect(desvios).toMatch(/peor redibujo/);
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/lab/docs.test.ts`.
- [ ] **Step 3: Editar la spec.** `**Estado:**` → `implementado en #208–#217 (rama \`feature/207-fabrica-detalle\`); los desvíos están en §14`. Sección nueva `## 14. Desvíos y medición` con:
  - `### 14.1 Desvíos`, una lista por sección del spec, una línea cada uno, citando el hijo. Mínimo: §4.1 `beam` ya existía (#78) con firma `{ from, to, w, h }`, no `{ a, b, size }`; §4.3 placas como campo `plates` en `prism`/`poly`/`ramp` (#210); §5 portones sur quitados, farol de (58, −16) movido a (50, −13.5), pilastras fuera del muro (y −16..−15.5), tolva y cinta corridas, techo desde x 44, faldón norte en 5 tramos, `sortByDepth` sin aristas entre cajas separadas por dos planos (#213); §6 fachada uniforme en todas las caras (la este con 8 ventanas por piso), techo partido alrededor del horno (6 rampas), óculos a z 19.7, impostas lisas (sin dentículos) (#214); §7 tanque visible entero solo en el exhibit `tanque-agua` (#214); §8 plataforma en una junta entre bandas, escalera por fuera de la plataforma, zunchos en las juntas de los tramos (#212); §9 código en `substation.ts`, conductor entre cadenas, T1 sin aletas sur y placa en la cara este, base bajo cada cuba (#215); §10 máquina estática en la capa `factory.excavator`, superestructura a z 11..16, cabina corrida, acopios rng al norte, caja del exhibit recortada en x ≤ 4 (#216); §11 exhibit de pieza nuevo `tanque-agua` (#214).
  - `### 14.2 Caras por exhibit`: tabla `| exhibit | sólidos antes | caras antes | sólidos después | caras después |` con una fila por exhibit (formato `` | `planta` | … ``), "—" en el antes de `excavadora` y `tanque-agua`; nota de que cada columna usa la caja de su árbol.
  - `### 14.3 Vista del mundo y totals`: enlaces `assets/207-fabrica/mundo-antes.png` y `assets/207-fabrica/mundo-despues.png`, `totals` antes/después y suma.
  - `### 14.4 Rendimiento`: las dos corridas `[lab] bloom: …` y `[lab] peor redibujo en 5 s: …` copiadas literal, el entorno y la decisión sobre el follow-up.
- [ ] **Step 4: Run, expect PASS** — `npx vitest run src/lab/docs.test.ts`; luego `npm test`, `npm run typecheck`, `npm run build`.
- [ ] **Step 5: Commit** — `docs(#217): spec de la fábrica implementada, con desvíos y medición`.

### Después de las tareas (stage 8, no es tarea de implementador)

La descripción del PR lleva: capturas antes/después de cada exhibit (enlaces a los PNG de `207-fabrica/` en la rama base: `planta-*`, `planta-malteria-*`, `chimeneas-*`, `subestacion-*`, `playa-vias-*`, `cinta-*`, `excavadora-despues`, `tanque-agua-despues`) más `mundo-*`; la tabla de caras y `totals`; las mediciones; los inventarios §5–§10 con cada casilla marcada y su captura (copiados de #224–#228), señalando que el tanque §7 se ve en `tanque-agua-despues.png` y no en `planta`.

## Grilling

- 1 ronda (las revisiones fueron menores: rangos de PR, `reducedMotion: false`, paso de limpieza, regla del follow-up). Griller: fable.
- 17 preguntas. Fuentes: ISSUE/PRs de los hijos 3 (1, 10, 11), CODE 12 (2, 4–9, 12, 14–17), NO SOURCE 2 (3, 13).
- Respuestas clave: el criterio 4 (checklist §12) se cumple solo en la descripción del PR, que arma el orquestador en el stage 8. `assembleWorld` corre en Node (`vitest.config.ts` con `environment: "node"`, `exhibits.test.ts:28`). `origin/main` exporta las mismas firmas (`crop.ts:54,83,113,161`, `assemble.ts:20`, `page.ts:12,23,56,91`). README: `factory.ts` aparece por primera vez en la línea 18 (párrafo del mundo) y `/lab/world.html` en la 45 (párrafo con la lista de specs, que el test del storybook ya usa). `export interface FactoryScene` está en `factory.ts:24`. `tanque-agua` está en `exhibits.ts:73` y `pieceScene(build, pad)` en `crop.ts:113`.
- Supuestos: A1–A5.
- Issues abiertos: ninguno.
