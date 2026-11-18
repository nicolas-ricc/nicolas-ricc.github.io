# #424 Capturas de línea base antes de recomponer (#423 hijo 0) — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar en `docs/superpowers/specs/assets/423-composicion-responsive/antes/` las diez capturas "antes" que pide §5 de la spec de composición responsive y un `README.md` que las describe, tomadas del mundo tal como está en `main` 6cbbe9e.

**Architecture:** No cambia código. Se levanta el dev server, se toman las capturas con `agent-browser` (viewport a escala 2) y se describen en un README. Un test de Vitest en `scripts/` (no en `src/`, que no debe cambiar) comprueba que los diez PNG existen con el tamaño exacto y que el README los cita a todos.

**Tech Stack:** Vite dev server, PixiJS v8, `agent-browser` 0.27, Vitest.

**Spec:** issue #424 (hijo 0 de #423); `docs/superpowers/specs/2026-11-18-composicion-responsive-design.md` §5 ("Verificación visual").

## Global Constraints

- `git diff origin/main --stat -- src` vacío. Antes de capturar se comprueba; si difiere, se captura desde un worktree en `6cbbe9e`.
- Capturas en `docs/superpowers/specs/assets/423-composicion-responsive/antes/`, con estos nombres exactos:
  - `mapa-390x750.png`, `mapa-430x932.png`, `mapa-820x1180.png`, `mapa-1024x768.png`, `mapa-1366x1024.png`, `mapa-1600x900.png`, `mapa-1920x955.png` (del mapa, `/`);
  - `blog-1920x955.png`, `blog-390x750.png` (de `/area/blog/`);
  - `boca-lab-1600x900.png` (`/lab/world.html` en 1600×900 tras pulsar `1`, encuadre Portfolio).
- Cada PNG mide exactamente 2·W × 2·H (`agent-browser set viewport W H 2`). El criterio lo exige para los del mapa; el plan lo exige para los diez.
- URL `http://localhost:5173/` (no `127.0.0.1`). El mapa está listo cuando `document.documentElement.classList.contains("mapa-listo")`; después se esperan ≥ 3 s más (el bloom se decide unos 60 cuadros después del primer render).
- `README.md` en la carpeta: fecha, commit, viewport y escala, y una línea por captura con lo que se ve (dónde cae cada cartel, si Writing está fuera de la ventana, dónde está el faro).
- `npm test` y `npm run typecheck` en verde.
- Docs en castellano rioplatense, prosa sobria como el resto de `docs/superpowers/specs/`.

## Supuestos técnicos (declarados)

- El criterio "solo entran archivos bajo `.../antes/`" se lee junto con su condición, "`git diff origin/main --stat -- src` vacío": nada de código. El pipeline de agentes agrega dos artefactos fuera de la carpeta, como en hijos anteriores de este tipo (#86: `docs/plans/2026-10-17-86-inventario-barcos-antes.md` y `scripts/barcos-inventario.test.ts`): este plan y el eval `scripts/capturas-antes-423.test.ts`. No tocan `src/` ni cambian el comportamiento del sitio.
- La extensión PixiJS DevTools no hace falta: no se miden conteos. Se usa agent-browser sin extensión, en headless.
- `/area/blog/` abre la zona Blog sobre el mapa; las capturas de blog se toman con el mismo criterio de espera (`mapa-listo` + 3 s) y la transición de cámara terminada (≥ 3 s).

## Criterios de aceptación del issue (transcriptos)

- [ ] Existen los 10 PNG con esos nombres y el README; cada PNG del mapa mide exactamente 2·W × 2·H. → Task 1 (capturas), Task 2 (README); eval `scripts/capturas-antes-423.test.ts`.
- [ ] `git diff origin/main --stat -- src` vacío en el PR. → todas; comprobado al final de Task 2.
- [ ] `npm test` y `npm run typecheck` en verde. → Task 2.

## Review Focus

- **Captura antes de tiempo:** una captura tomada antes de `mapa-listo` o sin el bloom muestra la escena a medio armar o los carteles ocultos (`visibility: hidden` hasta `mapa-listo`). Esperado: el implementador espera la clase más 3 s y abre cada PNG con Read para confirmar que se ven los carteles.
- **Tamaño equivocado:** `agent-browser screenshot` sin `set viewport W H 2` sale a 1x, o con la barra del navegador. Esperado: el eval lee el IHDR y exige 2·W × 2·H exactos en los diez.
- **Encuadre del lab sin aplicar:** la tecla `1` necesita que la página tenga el foco y que la transición de cámara termine. Esperado: la captura de la boca se ve a mayor escala que el sitio y muestra el cabo con el faro y el muelle; si no, se repite con un `click` en el canvas antes de la tecla.
- **README desincronizado:** una línea describe una captura con otro nombre o falta una. Esperado: el eval exige que el README cite los diez nombres y tenga fecha y commit.
- **Mundo recompuesto por error:** si `src/` ya cambió en la rama base, las capturas no son "antes". Esperado: la verificación de `git diff origin/main --stat -- src` corre antes de capturar.

---

## File Structure

- Create (stage 3 del pipeline, commit `test(#424): evals`): `scripts/capturas-antes-423.test.ts` — lee las dimensiones de cada PNG del IHDR (bytes 16–23) con `Buffer`, como `scripts/barcos-inventario.test.ts`. Exige: los diez archivos, firma PNG, 2·W × 2·H exactos, README con `**Fecha:**`, `**Commit:**` (con `6cbbe9e`), y los diez nombres citados.
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
- [ ] **Step 2:** Correr el eval: `npx vitest run scripts/capturas-antes-423.test.ts` → FAIL (faltan los PNG).
- [ ] **Step 3:** Levantar `npm run dev -- --host --port 5173` y, para cada tamaño del mapa: `agent-browser set viewport W H 2`, `open http://localhost:5173/`, esperar `mapa-listo` + 3 s, `screenshot <ruta>`.
- [ ] **Step 4:** Lo mismo para `/area/blog/` en 1920×955 y 390×750.
- [ ] **Step 5:** `/lab/world.html` en 1600×900: esperar el render, pulsar `1`, esperar ≥ 3 s, capturar `boca-lab-1600x900.png`.
- [ ] **Step 6:** Abrir cada PNG con Read y anotar lo que se ve (carteles, Writing dentro o fuera, faro).
- [ ] **Step 7:** Correr el eval: los tests de PNG pasan; el del README sigue fallando.

### Task 2: README y cierre

**Files:**
- Create: `docs/superpowers/specs/assets/423-composicion-responsive/antes/README.md`

- [ ] **Step 1:** Escribir el README: título, `**Fecha:** 2026-11-18`, `**Commit:** main 6cbbe9e`, viewport y escala (CSS W×H a escala 2, PNG 2W×2H; headless Chrome con agent-browser), cómo se esperó (`mapa-listo` + 3 s), y una línea por captura con lo observado en Task 1.
- [ ] **Step 2:** `npx vitest run scripts/capturas-antes-423.test.ts` → PASS.
- [ ] **Step 3:** `npm test` y `npm run typecheck` → verde; `git diff origin/main --stat -- src` vacío.
- [ ] **Step 4:** Commit `docs(#424): capturas antes de recomponer`.
