# #424 Capturas de línea base antes de recomponer (#423 hijo 0) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar en `docs/superpowers/specs/assets/423-composicion-responsive/antes/` las diez capturas "antes" que pide §5 de la spec de composición responsive y un `README.md` que las describe, tomadas del mundo tal como está en `main` 6cbbe9e.

**Architecture:** No cambia código. Se levanta el dev server, se toman las capturas con `agent-browser` (viewport a escala 2) y se describen en un README. Un test de Vitest en `scripts/` (no en `src/`, que no debe cambiar) comprueba que los diez PNG existen con el tamaño exacto y que el README los cita a todos.

**Tech Stack:** Vite dev server, PixiJS v8, `agent-browser` 0.27, Vitest.

**Spec:** issue #424 (hijo 0 de #423); `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md` §5 ("Verificación visual").

## Global Constraints

- `git diff origin/main --stat -- src` vacío. Comprobado al planificar: la rama base `feature/423-composicion-responsive` está en `6cbbe9e`, igual que `origin/main`, así que no hace falta worktree. Si al capturar difiere, se para y se reporta: no se captura otro commit. Se comprueba además todo el árbol menos `docs/` (`git diff origin/main --stat -- . ':!docs'` vacío), porque el dev server sirve también `index.html`, `public/` y CSS.
- Capturas en `docs/superpowers/specs/assets/423-composicion-responsive/antes/`, con estos nombres exactos:
  - `mapa-390x750.png`, `mapa-430x932.png`, `mapa-820x1180.png`, `mapa-1024x768.png`, `mapa-1366x1024.png`, `mapa-1600x900.png`, `mapa-1920x955.png` (del mapa, `/`);
  - `blog-1920x955.png`, `blog-390x750.png` (de `/area/blog/`);
  - `boca-lab-1600x900.png` (`/lab/world.html` en 1600×900 tras pulsar `1`, encuadre Portfolio).
- Cada PNG mide exactamente 2·W × 2·H (`agent-browser set viewport W H 2`). El criterio lo exige para los del mapa; el plan lo exige para los diez.
- URL `http://localhost:5173/` (no `127.0.0.1`).
- Espera antes de cada captura (sitio, `/` y `/area/blog/`): la clase `mapa-listo` en `<html>` (la pone `src/main.ts:151` tras el primer `jumpTo`) y después la línea de consola `[mapa] bloom: …` (`src/world/bloom-runtime.ts:37`, que se imprime en dev, `src/main.ts:34`, al terminar de medir 60 cuadros: a ~2 fps son ~30 s), con tope de 120 s, leída con `agent-browser console` (comando listado en `agent-browser --help`); luego 3 s más. Cada captura reabre la página (`set viewport` y después `open`): ningún tamaño hereda el estado de un resize. En el lab no hay `mapa-listo`: se espera `[lab] first draw` y `[lab] bloom: …` (`src/lab/page.ts:58,72`), se pulsa `1` y se esperan 3 s.
- No hay transición de cámara que esperar: la carga directa de `/area/blog/` hace `render(current, false)` → `camera.jumpTo` (`src/main.ts:142-146`, `:84`), y en el lab `fit()` aplica el encuadre de una (`src/lab/page.ts:61-67`).
- `README.md` en la carpeta: fecha, commit, viewport y escala, y una línea por captura con lo que se ve (dónde cae cada cartel, si Writing está fuera de la ventana, dónde está el faro).
- `npm test` y `npm run typecheck` en verde.
- Docs en castellano rioplatense, prosa sobria como el resto de `docs/superpowers/specs/`.

## Assumptions (supuestos técnicos, declarados)

- El criterio "solo entran archivos bajo `.../antes/`" se lee junto con su condición, "`git diff origin/main --stat -- src` vacío": nada de código. El pipeline de agentes agrega dos artefactos fuera de la carpeta, como en hijos anteriores de este tipo (#86: `docs/plans/2026-10-17-86-inventario-barcos-antes.md` y `scripts/barcos-inventario.test.ts`): este plan y el eval `scripts/capturas-423.test.ts`. No tocan `src/` ni cambian el comportamiento del sitio.
- No hay ningún README en `docs/superpowers/specs/assets/*/` que sirva de plantilla. Los campos `**Fecha:**` y `**Commit:**` siguen el estilo de frontmatter de las specs (`**Fecha:**`, que `scripts/barcos-inventario.test.ts:39-41` ya exige); el issue pide "fecha, commit, viewport y escala". Alternativa descartada: frontmatter YAML, que ninguna spec usa.
- El README registra además la secuencia de comandos de captura, para que el hijo de verificación (#429) repita el set "después" igual. Alternativa descartada: dejar el script solo en `.scratch/`, que no se versiona.
- Guardia contra cuadros vacíos: el eval exige que cada PNG pese ≥ 50 KB (un cuadro liso de 780×1500 comprime a unos pocos KB); el umbral se contrasta con el peso real de la captura más chica en Task 1 y se anota. Alternativa descartada: decodificar píxeles, que pide escribir un decodificador (el repo solo tiene `scripts/png.ts`, que codifica) para un hijo sin código. El encuadre Portfolio del lab no tiene oráculo automático: lo confirma la lectura de la captura con Read (se ven la boca, el muelle de alistamiento y el cabo a mayor escala que en el mapa).
- `src/lab/page.ts` no registra manejadores de puntero (solo `keydown` en `window`, `:76`): si `press 1` no llega, un `click` en el canvas no cambia el encuadre.
- Los barcos y otras piezas animadas están donde los deja el reloj al capturar: las capturas son instantáneas y #429 las compara a ojo, no por bytes. El README anota versión de agent-browser y Chrome y la secuencia de comandos en prosa con bloque de código; no es un contrato validado por el eval.
- La exigencia de 2·W × 2·H se extiende a blog y lab porque el tamaño del PNG lo fija el viewport de agent-browser, no la página; si alguno sale distinto es un error de captura, no del sitio.
- `**Fecha:**` es la del día en que se toman las capturas. `**Commit:**` es `6cbbe9e` porque el árbol sin `docs/` es idéntico a `origin/main` en ese commit; si `origin/main` avanzara con cambios fuera de `docs/` antes de capturar, se para (ver Global Constraints).
- Si el pipeline se corta entre `test(#424)` y `docs(#424)`, el rojo queda en la rama `agent/424-*`, que solo entra a la base por PR con checks verdes.
- Los commits van en este orden: `plan(#424)`, `test(#424): evals` (el eval falla: no hay PNG; el pipeline lo pide así), `docs(#424)` con capturas y README (suite verde). `vitest.config.ts:4` incluye `scripts/**/*.test.ts`, así que el eval corre en `npm test` y en CI.
- La extensión PixiJS DevTools no hace falta: no se miden conteos. Se usa agent-browser sin extensión, en headless.
- agent-browser instalado: 0.27.0 (`agent-browser --version`). Que `screenshot` sin `--full` capture solo el viewport y salga a 2W×2H se comprueba con el eval, no se supone.
- Los carteles que se reportan por captura son los tres de la spec §5 ("se ven los tres carteles y el cabo con su faro"): RESUME, PORTFOLIO y Writing, más el faro.

## Criterios de aceptación del issue (transcriptos)

- [ ] Existen los 10 PNG con esos nombres y el README; cada PNG del mapa mide exactamente 2·W × 2·H. → Task 1 (capturas), Task 2 (README); eval `scripts/capturas-423.test.ts`.
- [ ] `git diff origin/main --stat -- src` vacío en el PR. → todas; comprobado al final de Task 2.
- [ ] `npm test` y `npm run typecheck` en verde. → Task 2.

## Review Focus

- **Captura antes de tiempo:** una captura tomada antes de `mapa-listo` o del veredicto del bloom muestra la escena a medio armar o los carteles ocultos (`src/style.css:66`: `visibility: hidden` hasta `mapa-listo`). Esperado: el implementador espera la clase y la línea `[mapa] bloom:` más 3 s y abre cada PNG con Read para confirmar que se ven los carteles.
- **Tamaño equivocado:** `agent-browser screenshot` sin `set viewport W H 2` sale a 1x, o con la barra del navegador. Esperado: el eval lee el IHDR y exige 2·W × 2·H exactos en los diez.
- **Encuadre del lab sin aplicar:** la tecla `1` la escucha `window` (`src/lab/page.ts:76-78`, `KEY_ZONE["1"] = "portfolio"`, `:12`); si la página no tiene foco, no llega. Esperado: la captura de la boca se ve a mayor escala que el sitio y muestra el cabo con el faro y el muelle; si no, se repite con un `click` en el canvas antes de la tecla.
- **README desincronizado:** una línea describe una captura con otro nombre o falta una. Esperado: el eval exige que el README cite los diez nombres y tenga fecha y commit.
- **Mundo recompuesto por error:** si `src/` ya cambió en la rama base, las capturas no son "antes". Esperado: la verificación de `git diff origin/main --stat -- src` corre antes de capturar.

---

## File Structure

- Create (stage 3 del pipeline, commit `test(#424): evals`): `scripts/capturas-423.test.ts` — lee las dimensiones de cada PNG del IHDR (bytes 16–23) con `Buffer`, como `scripts/barcos-inventario.test.ts`. Exige: los diez archivos, firma PNG, 2·W × 2·H exactos, ≥ 50 KB cada uno, README con `**Fecha:**`, `**Commit:**` (con `6cbbe9e`), y los diez nombres citados.
- Create: `docs/superpowers/specs/assets/423-composicion-responsive/antes/*.png` (Task 1).
- Create: `docs/superpowers/specs/assets/423-composicion-responsive/antes/README.md` (Task 2).
- Scratch, no versionado: `.scratch/` (en `.git/info/exclude`): `evals-424.md` y el script de captura.

### Task 1: Capturas

**Files:**
- Create: los diez PNG listados en Global Constraints.

**Interfaces:**
- Consumes: el eval de stage 3.
- Produces: los PNG que describe Task 2.

- [ ] **Step 1:** `git diff origin/main --stat -- src` → vacío.
- [ ] **Step 2:** Correr el eval: `npx vitest run scripts/capturas-423.test.ts` → FAIL (faltan los PNG).
- [ ] **Step 3:** Agregar `.scratch/` a `.git/info/exclude`. Levantar `npm run dev -- --host --port 5173` y, para cada tamaño del mapa: `agent-browser set viewport W H 2`, `open http://localhost:5173/`, esperar según Global Constraints (`mapa-listo`, `[mapa] bloom:`, 3 s), `screenshot <ruta>`.
- [ ] **Step 4:** Lo mismo para `/area/blog/` en 1920×955 y 390×750.
- [ ] **Step 5:** `/lab/world.html` en 1600×900: esperar `[lab] bloom:`, `press 1`, esperar 3 s, capturar `boca-lab-1600x900.png`.
- [ ] **Step 6:** Abrir cada PNG con Read y anotar lo que se ve (carteles, Writing dentro o fuera, faro).
- [ ] **Step 7:** Correr el eval: los tests de PNG pasan; el del README sigue fallando.

### Task 2: README y cierre

**Files:**
- Create: `docs/superpowers/specs/assets/423-composicion-responsive/antes/README.md`

- [ ] **Step 1:** Escribir el README: título, `**Fecha:** 2026-11-18`, `**Commit:** main 6cbbe9e`, viewport y escala (CSS W×H a escala 2, PNG 2W×2H; headless Chrome con agent-browser), cómo se esperó y la secuencia de comandos de captura, y una línea por captura con lo observado en Task 1.
- [ ] **Step 2:** `npx vitest run scripts/capturas-423.test.ts` → PASS.
- [ ] **Step 3:** `npm test` y `npm run typecheck` → verde; `git diff origin/main --stat -- src` vacío.
- [ ] **Step 4:** Commit `docs(#424): capturas antes de recomponer`.

## Grilling

- Rondas: 2 (16 + 18 preguntas).
- Fuentes de las respuestas: ISSUE 9, CODE 17 (`src/main.ts`, `src/lab/page.ts`, `src/world/bloom-runtime.ts`, `src/style.css`, `vitest.config.ts`, `scripts/barcos-inventario.test.ts`, `agent-browser --help`), DOC 2 (CLAUDE.md, spec §5), NO SOURCE → supuesto técnico 6 (listados en Assumptions: lectura del criterio "solo `antes/`", formato del README, umbral de bytes, extensión de 2W×2H a los diez, fecha/commit, comandos en el README).
- Ambigüedades de spec: ninguna. Issues abiertos: ninguno.
