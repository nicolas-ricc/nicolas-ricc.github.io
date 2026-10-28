# Cierre de #239 (estación terminal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la historia #239: README, docstrings, nota de desvío en la spec 10-15, índice del storybook, spec de la estación implementada con casillas marcadas y `## 12. Desvíos` (§12.1 caras, §12.2 ciclo, §12.3 capturas), capturas "después", time-lapse de un ciclo y `docs.test.ts` con el describe "(#239)".

**Architecture:** No cambia geometría ni animación. Tres entregables: (1) textos fijados por tests en `src/lab/docs.test.ts` (patrón del describe "(#238)"); (2) mediciones con un script `tsx` efímero en `.scratch/` (no se commitea) y capturas con agent-browser en `docs/superpowers/specs/assets/2026-10-27-estacion/`; (3) la spec de la estación cerrada. Los tests los escribe el orquestador en el stage 3 (evals), en rojo; cada tarea pone en verde los suyos.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS 8, agent-browser + PixiJS DevTools (ver `CLAUDE.md`), `tsx`.

**Spec:** issue #282 ("Qué hacer" 1–9, "Reglas que hereda", criterios) y `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md` §5, §8–§10. Contexto: plan de la historia en el comentario de #239; hijos #276–#281 (PRs #283–#288) ya en `feature/239-estacion-tigre`.

## Global Constraints

- Rama base `feature/239-estacion-tigre`; el PR va contra esa rama.
- **No se toca geometría ni animación**: solo documentación, tests de documentación y capturas. Un defecto visto en una captura se anota en §12 y se abre un issue `agent-follow-up` (ver A5); no se corrige acá.
- El "antes" ya existe (`cover-antes.png`, `portfolio-antes.png`): **no se regenera**. Las capturas "después" son del estado final de la rama.
- Capturas: agent-browser, `set viewport 1600 900 2` (PNG 3200×1800). Sitio `http://localhost:5173/`; lab `/lab/world.html` + tecla `1`; exhibits `/lab/storybook.html?speed=0.001#<id>`.
- Caras (lo que muestra el panel, con las capas animadas en ms 0) = `readout(cropScene(scene, box), cropAnimators(animators, box))` (`src/lab/crop.ts:161`) con `assembleWorld(undefined, { reducedMotion: false })` (`src/world/assemble.ts:21`), caja del exhibit **de cada árbol**; piezas con `readout(pieceScene(e.build, e.pad), e.animate ? [e.animate({ reducedMotion: false })] : [])`. Total del astillero = `tessellate` de `shipyard(createRng(7))` `ground + solids` (antes: 1061 en `main` 05318e5).
- Idioma: castellano rioplatense. Párrafos del README y de las specs envueltos a ~80 columnas como hoy.
- Los describes existentes de `docs.test.ts` (#65/#83, #97, #69, #217, #238) siguen en verde: el párrafo del mundo conserva `factory.ts`, `nave de calderas`, `maltería`, `tanque de agua`, `chimeneas … bandas`, `subestación de intemperie`, `excavadora de rueda`, y la frase de los galpones "al norte, detrás de la fábrica".
- `npm test`, `npm run typecheck` y `npm run build` en verde.
- Commits con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **La nota de la spec 10-15 antes de la primera mención de `−18, 188`**, no después: el test compara índices (Task 2). La segunda mención (lista del plan de entrega, línea ~421) lleva la misma nota.
2. **El docstring de `shipyard.ts` no nombra la calderería** (ni "calderería" ni "calderas" del astillero). `nave de calderas` es de la fábrica y vive en `factory.ts`/README: el test mira solo el docstring de `shipyard.ts` (Task 1).
3. **El time-lapse cubre un ciclo entero**: ≥ 52 cuadros de 2000 ms (≥ 104 s simulados, `CYCLE_MS` ≈ 101,7 s) desde el estado inicial, con el reloj de la página neutralizado (`?speed=0.001`, ver Task 3): si el ticker propio sumara tiempo, el número de cuadros anotado no describiría el ciclo (Task 3).
4. **Cajas por árbol en §12.1**: `gradas` y `calle-faroles` se miden en las dos ramas con su caja; `estacion`, `paso-a-nivel` y `tren` no existen en `main` y van con "—" (Task 3/4).
5. **El máximo de `rail.train` en todo el ciclo**, no en una muestra: se barre el ciclo cada 250 ms con `trainStateAt`/`emu` (Task 3), y debe dar ≤ 600.

## Assumptions

- **A1.** "Antes" de las cifras de exhibits = `main` en 05318e5 (lo nombra el issue), en un worktree `/tmp/main-05318e5` con `node_modules` enlazado al de `/work` (las escenas no dependen de nada que haya cambiado de versión).
- **A2.** Capturas de exhibits con el reloj llevado a mano (método del CLAUDE.md): `tren-despues.png` en ms 0; `paso-a-nivel-despues.png` a 21,5 s (tren sobre el cruce, como #281); `estacion-despues.png` a 52 s (tren detenido en `STOP_X`). `portfolio-despues.png` a 52 s también (tren en la estación). `cover-despues.png` en el sitio sin tocar el reloj (el sitio no tiene `?speed=`; la comparación con el "antes" es de disposición).
- **A3.** La spec 10-15 tiene una tercera mención de la estación en `landmarks.ts` (línea ~205, `vault` + `dome`); el issue nombra dos. Se anota también ahí la misma nota, porque describe la misma pieza descartada. El test solo exige la de antes de `−18, 188`.
- **A4.** Los conos perdidos se copian de la tabla del PR #287 (medidos con `world(7)`): 11 en total (hinterland 4, astillero 4, ciudad 1, tecnológico 1, fábrica 1).
- **A5.** Si una captura muestra un defecto, el follow-up se abre con `gh issue create … --label needs-triage --label agent-follow-up` y el cuerpo empieza con `Follow-up of #282` (el issue lo pide; formato del pipeline). Lo hace el orquestador, no el implementador: el implementador lo anota en `.scratch/medicion-282.md`.
- **A6.** Las casillas de §5 y §10 se marcan `[x]` con la referencia al final del ítem, entre paréntesis: `(captura `estacion-despues.png`; test `station.test.ts` "…")`. Las referencias salen de los PRs #283–#288.
- **A8.** Los commits intermedios de Task 1–3 dejan en rojo los `it` del describe "(#239)" que les tocan a tareas posteriores (los escribe en rojo el stage 3, como en el plan de #248). Cada tarea pone en verde solo los suyos; `npm test` entero en verde se exige al cerrar Task 4. Alternativa rechazada: escribir cada test con su tarea, que contradice el stage 3 del pipeline (evals antes de implementar).
- **A9.** Si el máximo de `rail.train` supera 600, o una captura muestra un defecto, no se toca código (regla del issue): se anota en §12 y va a un follow-up (A5).
- **A10.** La regla "calderería solo en 'en el lugar de la calderería'" del README no tiene test: la verifica el revisor de la tarea.
- **A11.** Una casilla de §5/§10 que se cumpla con desvío se marca `[x]` y remite a §12; si alguna no se cumple, se deja `[ ]` con la explicación y el test de "§5 sin `- [ ]`" se ajusta en el stage 6 con el motivo. Los PRs #283–#288 cubren todo §5.
- **A12.** Las capturas de Task 3 se commitean juntas o ninguna; si Task 3 se repite, se regeneran las seis.
- **A7.** El log `[lab] bloom` se toma de la consola de `/lab/world.html` (`agent-browser console`) después de ~10 s; en headless puede quedar `fallback`: se anota como riesgo, no bloquea.

---

### Task 1: README y docstrings

**Files:**
- Modify: `README.md` (párrafo "Mundo isométrico", lista de specs del lab, párrafo del storybook)
- Modify: docstrings de `src/scenes/shipyard.ts:11-21`, `src/scenes/station.ts:7-23`, `src/scenes/train.ts:5-19`, `src/scenes/rail-anim.ts:10-31`
- Test: `src/lab/docs.test.ts` (escrito en el stage 3)

**Interfaces:** ninguna.

- [ ] **Step 1: Correr** — `npx vitest run src/lab/docs.test.ts -t "#239"`: fallan README y docstrings.
- [ ] **Step 2: README, párrafo del mundo.** Al final del párrafo que contiene `` `factory.ts` ``, una oración: al final de la vía del oeste, en el lugar de la calderería del astillero, está la estación cabecera (`station.ts`, modelada sobre la Estación Tigre de la Línea Mitre: edificio de ladrillo con techos de teja, torre del reloj, andenes con marquesinas verdes, topes y paso a nivel), con una formación estacionada de tres coches en la vía 2 y un tren EMU de cuatro coches (`train.ts`) que entra por la vía del oeste desde el borde del sangrado, espera 30 s contra los topes y vuelve a salir (`rail.train`, `rail-anim.ts`). No usar la palabra "calderería" en otra cosa que no sea "en el lugar de la calderería".
- [ ] **Step 3: README, lista del lab.** Agregar `` `2026-10-27-estacion-terminal-design.md` `` después de `` `2026-10-27-fabrica-mudanza-design.md` ``, antes del `)`.
- [ ] **Step 4: README, párrafo del storybook.** Después de "(o armado solo en el origen, para las piezas reubicables como barcos y grúa torre)", nombrar los exhibits de la estación: `#estacion` y `#paso-a-nivel` (regiones, con el tren animado) y `#tren` (pieza con las luces que se invierten cada 4 s). El párrafo no puede mencionar `/lab/world.html` (test #97).
- [ ] **Step 5: `shipyard.ts`.** Cambiar "La zona de producción al sur de las gradas es la estación cabecera (`station.ts`), al final de la vía del oeste." por "Al sur de las gradas, al final de la vía del oeste, está la estación cabecera (`station.ts`)." Sin "calderería".
- [ ] **Step 6: `station.ts`.** Primer párrafo: modelo real (Estación Tigre, cabecera de la Línea Mitre, 1995: ladrillo, teja, torre del reloj de piedra, pórtico y marquesinas verdes); disposición (región `STATION` x 100..197, y 80..142; vías 1..3 en `TRACKS_Y`, abanico `LADDER`, andenes `ISLAND`/`SIDE`/`HEAD`, topes en `BUFFER_X`, edificio, torre y explanada al este de `HEAD`, paso a nivel sobre la calle x 100..108); conservar los párrafos de `PARKED` y de oclusión tal cual; última línea `Spec: docs/superpowers/specs/2026-10-27-estacion-terminal-design.md (desvíos en §12).`
- [ ] **Step 7: `train.ts`.** Agregar al final del docstring: `Spec: docs/superpowers/specs/2026-10-27-estacion-terminal-design.md §5.4 (desvíos en §12).`
- [ ] **Step 8: `rail-anim.ts`.** Agregar un párrafo de desvíos de §7 antes del último: frente a 2 u del tope y no ≈ 1 (`STOP_X` 158, tope h 1.2), sin rng (nada es aleatorio; el spec pedía `createRng(SEED + n)`), ciclo ≈ 101,7 s y no ≈ 120; mantener el del paso a nivel; última línea `Spec: docs/superpowers/specs/2026-10-27-estacion-terminal-design.md §7 (desvíos en §12).`
- [ ] **Step 9: Correr** — `npx vitest run src/lab/docs.test.ts`: verdes los `it` de esta tarea (README, docstrings) y todos los describes anteriores; los de Task 2–4 siguen en rojo (A8). `npm run typecheck`.
- [ ] **Step 10: Commit** — `docs(#282): README y docstrings de la estación terminal y el tren`.

### Task 2: Nota en la spec 10-15 e índice del storybook

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` (líneas ~205, ~263, ~421)
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md:73` (fila del astillero de §3)

**Interfaces:** ninguna.

- [ ] **Step 1: Correr** — `npx vitest run src/lab/docs.test.ts -t "#239"`: fallan nota e índice.
- [ ] **Step 2: Nota.** Texto exacto (el test lo busca con espacios colapsados): `*Desvío (2026-10-28): la estación va al final de la vía del oeste del astillero, en el lugar de la calderería; ver `2026-10-27-estacion-terminal-design.md`. Esta pieza queda descartada.*`
  - Antes del párrafo "Piezas singulares fijas, además de las de la tabla: **estación** en `−18, 188`": la nota como párrafo propio, con una línea en blanco antes y después.
  - En el ítem 3 de la lista del plan de entrega (línea ~421, "piezas fijas nuevas del mapa (estación, …"): la nota como continuación del ítem, en una línea nueva con la sangría del ítem (3 espacios).
  - En la fila de `landmarks.ts` de la tabla (línea ~205): después de `**estación** (`vault` + `dome` sobre el hall + reloj)`, agregar ` *(descartada: ver la nota de §6)*` dentro de la celda (A3); no partir la tabla.
- [ ] **Step 3: Índice.** Fila "Portfolio: astillero": regiones `gradas, dársena, grúa pórtico, calle de faroles, naves, punta norte, estación, paso a nivel`; piezas `grúa torre, farol, tren`.
- [ ] **Step 4: Correr** — `npx vitest run src/lab/docs.test.ts` en verde para los de esta tarea.
- [ ] **Step 5: Commit** — `docs(#282): estación de la spec 10-15 descartada e índice del storybook`.

### Task 3: Mediciones, capturas "después" y time-lapse (sin código commiteado)

**Files:**
- Create en `docs/superpowers/specs/assets/2026-10-27-estacion/`: `cover-despues.png`, `portfolio-despues.png`, `estacion-despues.png`, `paso-a-nivel-despues.png`, `tren-despues.png`, `time-lapse-ciclo.png`
- Create (no se commitea): `.scratch/caras-282.ts`, `.scratch/medicion-282.md`, `.scratch/hook-ticker.js`, `.scratch/timelapse.js`

**Interfaces:**
- Produces: `.scratch/medicion-282.md` con (a) tabla `| exhibit | sólidos antes | caras antes | sólidos después | caras después |` para `gradas`, `calle-faroles`, `estacion`, `paso-a-nivel`, `tren` ("—" donde no existe); (b) total estático del astillero antes (1061) y después, con delta y %; (c) máximo de caras de `rail.train` en el ciclo y el ms donde ocurre; (d) ciclo medido: `IN_MS`, `DWELL_MS`, `OUT_MS`, `OFF_MS`, `CYCLE_MS` de `rail-anim.ts` y, del time-lapse, cuántos cuadros, `deltaMS`, ms simulados; (e) línea `[lab] bloom …` de la consola; (f) observaciones de cada captura (defectos visibles).

- [ ] **Step 1: Worktree** — `git worktree add /tmp/main-05318e5 05318e5 && ln -s /work/node_modules /tmp/main-05318e5/node_modules`.
- [ ] **Step 2: Caras** — `.scratch/caras-282.ts <raíz>`: importa `src/lab/exhibits.ts`, `src/world/assemble.ts`, `src/lab/crop.ts`, `src/scenes/shipyard.ts`, `src/map/seed.ts`, `src/iso/solids.ts` de `<raíz>` (import dinámico con `pathToFileURL`); imprime `id sólidos caras` para los cinco ids (los ausentes como `—`) y el total estático del astillero. `npx tsx .scratch/caras-282.ts /tmp/main-05318e5` y `… /work`. Chequeo: antes = 1061 (#239); después ≈ 1300 + edificio + 105 de la formación (PRs #284, #285, #286), salvo cambios posteriores que se expliquen.
- [ ] **Step 3: Máximo de `rail.train`** — en el mismo script, solo con `/work`: para `ms` de 0 a `CYCLE_MS` cada 250, `trainStateAt(ms)`, y si `alpha > 0`, `emu(s.x0, TRACK_Y, { cars: 4, lead: s.lead, lit: true }).solids` teselado; imprimir el máximo y su `ms`. Esperado ≤ 600; si no, A9.
- [ ] **Step 4: Servidor** — `npm run dev -- --host --port 5173` en segundo plano con `nohup … > .scratch/vite.log &` (no esperar su fin); `curl -sf http://localhost:5173/lab/world.html`.
- [ ] **Step 5: Cover** — agent-browser con la extensión (CLAUDE.md), `set viewport 1600 900 2`, `open http://localhost:5173/`, dos `wait 3000`, `screenshot …/cover-despues.png`.
- [ ] **Step 6: Gancho del ticker** — `.scratch/hook-ticker.js` como en `2026-10-17-barcos-inventario.md` "Método del time-lapse" (tomar el `?v=` del import de `pixi__js.js` del bundle servido); deja `window.__tk`; el texto que devuelve (`String(_fn)`) tiene que contener `stage.tick(ticker.deltaMS * speed)` (`src/lab/page.ts:85`, `src/lab/storybook.ts:141`); si no, se avanzó otro listener. Avanzar el reloj: `__tk._head.next._fn.call(__tk._head.next._context, { deltaMS: ms / speed })`, con `speed` = 0.001 en el storybook (`?speed=0.001`) y en el lab (`/lab/world.html?speed=0.001`).
- [ ] **Step 7: Portfolio** — `/lab/world.html?speed=0.001`, `press 1`, gancho, avanzar 52 000 ms, `renderer.render(stage)`, `screenshot …/portfolio-despues.png`. Copiar la línea `[lab] bloom` de `agent-browser console`.
- [ ] **Step 8: Exhibits** — `/lab/storybook.html?speed=0.001#tren` (ms 0) → `tren-despues.png`; `#paso-a-nivel` a 21 500 ms → `paso-a-nivel-despues.png`; `#estacion` a 52 000 ms → `estacion-despues.png`. Recargar la página entre exhibits para empezar en ms 0.
- [ ] **Step 9: Time-lapse** — recargar `/lab/world.html?speed=0.001` (el Step 7 ya avanzó el reloj), `press 1`, gancho; el primer cuadro no tiene que mostrar el tren (en ms 0 el frente está en el borde del sangrado, `alpha` 0); `.scratch/timelapse.js` = el bucle del método A con `DT = 2000/0.001` por cuadro (2000 ms simulados), acumulador `lighten` solo (sin `accB`), parar a los 55 cuadros (110 s ≥ `CYCLE_MS`); exportar `accA.toDataURL("image/png")` y escribirlo a `…/time-lapse-ciclo.png` (por `eval` en trozos o `screenshot` de un `<img>` a pantalla completa; cualquiera que dé 3200×1800).
- [ ] **Step 10: Verificar y mirar** — `node -e` que lea el IHDR (bytes 16..23) de los seis PNG: 3200×1800. Abrir cada uno (Read) y anotar en `.scratch/medicion-282.md` qué se ve y cualquier defecto (A5).
- [ ] **Step 11: Limpieza** (también si aborta): `pkill -f "vite.*5173"`, `agent-browser close`, `git worktree remove --force /tmp/main-05318e5`.
- [ ] **Step 12: Commit** — `git add docs/superpowers/specs/assets/2026-10-27-estacion/ && git commit -m "docs(#282): capturas después y time-lapse de un ciclo del tren"`.

### Entre Task 3 y Task 4 (orquestador)

Si `.scratch/medicion-282.md` anota defectos o un máximo > 600, el orquestador abre el follow-up (A5) y pasa el número a Task 4; si no hay, §12.3 dice "sin defectos vistos".

### Task 4: Spec de la estación — estado, casillas y `## 12. Desvíos`

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md` (línea 4, §5, §10, sección nueva al final, después de §11)

**Interfaces:**
- Consumes: `.scratch/medicion-282.md` (Task 3); referencias de los PRs #283–#288.

- [ ] **Step 1: Correr** — `npx vitest run src/lab/docs.test.ts -t "#239"`: fallan estado, §12 y tabla.
- [ ] **Step 2: Estado.** `**Estado:** implementado en #239 (rama `feature/239-estacion-tigre`, hijos #276–#281 y este cierre, #282); los desvíos están en §12.` El resto del encabezado (dependencia de la mudanza) queda.
- [ ] **Step 3: Casillas.** Todas las de §5 y §10 en `[x]` con la referencia (A6). Las que se cumplen con desvío (4 coches → estacionada de 3; andenes ≈ 37 u; +20 %) remiten a §12.
- [ ] **Step 4: `## 12. Desvíos`.** Una viñeta por punto, citando el hijo:
  - andenes de ≈ 37 u, no ≈ 50: el abanico arranca en x 108; la formación detenida (x 111.2..158) sobresale 12 u al oeste del andén isla (#277);
  - frente a 2 u del tope (`STOP_X` 158), tope de h 1.2 por la regla de oclusión del este (#277, #281);
  - formación estacionada de 3 coches en la vía 2, no 4 en la vía 1: la vía 1 recta mide 24 u (#279);
  - animador sin rng: nada es aleatorio (#281);
  - ciclo ≈ 101,7 s, no ≈ 120 (#281);
  - paso a nivel apagado durante la espera salvo los últimos 5 s (#281);
  - `roofMat` y placas en gable como extensión del kit; materiales `tile`, `canopy`, `livery` (#276);
  - +20 % de caras no aplicable: la calderería eran 138 caras; delta en §12.1;
  - conos perdidos: tabla por escena (A4), y la quinta selva (empalme de la fábrica) (#280);
  - de los PRs: semáforos y paso a nivel con la esquina NO como punto (#277 A1); hastiales del remate (#278 A3); ventanas sur del hall sin luz (#278 A18); piso del tope de caras ≥ 120 (#279 A1); caja de `paso-a-nivel` con `x0` 95 (#281); luz del poste norte del paso a nivel sobre el tren (#281); `asphalt`, `deck`, `stone`, `paving` compartidos (#277, #278). Antes de escribir cada número, confirmarlo en el código de la rama (`grep` de la constante o del test) y no solo en el PR.
  - `### 12.1 Caras por exhibit`: tabla de Task 3 con filas `` | `gradas` | ``, `` `calle-faroles` ``, `` `estacion` ``, `` `paso-a-nivel` ``, `` `tren` ``; total del astillero antes/después con delta; máximo de `rail.train` (≤ 600). Sin umbral.
  - `### 12.2 Ciclo medido`: fases y `CYCLE_MS`; cuadros, `deltaMS` 2000 y ms simulados del time-lapse; línea `[lab] bloom`.
  - `### 12.3 Capturas`: enlaces relativos `assets/2026-10-27-estacion/<nombre>.png` a `cover-antes`, `cover-despues`, `portfolio-antes`, `portfolio-despues`, `estacion-despues`, `paso-a-nivel-despues`, `tren-despues`, `time-lapse-ciclo` y a las de los hijos (`estacion-vias`, `estacion-edificio`, `tren-estacionado`, `corredor-sur`, `tren`, `paso-a-nivel`, `tren-llegando`); defectos vistos (si hay) con el issue de follow-up.
- [ ] **Step 5: Correr** — `npx vitest run src/lab/docs.test.ts`, luego `npm test`, `npm run typecheck`, `npm run build`.
- [ ] **Step 6: Commit** — `docs(#282): estación implementada, casillas marcadas y desvíos con caras, ciclo y capturas`.

### Tests del stage 3 (los escribe el orquestador antes de las tareas)

Nuevo `describe("documentación de la estación terminal (#239)")` en `src/lab/docs.test.ts`:
- párrafo del mundo (el que contiene `` `factory.ts` ``, espacios colapsados) matchea `/estaci[oó]n/` y `/EMU|tren/`;
- párrafo del lab contiene `2026-10-27-estacion-terminal-design.md`;
- párrafo del storybook contiene `estacion`, `paso-a-nivel` y `tren`;
- docstring de `shipyard.ts` (de `/**` hasta `export interface Scene`) no matchea `/calderer[ií]a/i`;
- docstrings de `station.ts`, `train.ts` y `rail-anim.ts` (hasta su primer `export const`) contienen `docs/superpowers/specs/2026-10-27-estacion-terminal-design.md`; el de `station.ts` matchea `/Tigre/`;
- spec de la estación: `**Estado:**` matchea `implementad` y no `listo para agente`; `^## 12\. Desvíos$`; la sección tiene `^### 12\.1`, `^### 12\.2`, `^### 12\.3` y filas `` | `estacion` | ``, `` | `paso-a-nivel` | ``, `` | `tren` | ``; enlaza `cover-antes.png`, `cover-despues.png` y `time-lapse-ciclo.png`; §5 no tiene casillas `- [ ]`;
- `cover-antes.png`, `cover-despues.png` y `time-lapse-ciclo.png` son PNG 3200×1800 (IHDR como #217); las demás "después" existen;
- spec 10-15 (espacios colapsados): contiene la nota exacta y su índice es menor que el de la primera `−18, 188`;
- tabla del storybook (fila que empieza `| Portfolio: astillero |`) nombra `estación`, `paso a nivel` y `tren`.

Cada tarea corre el describe entero y solo mira los suyos.

## Mapa issue → tareas

| "Qué hacer" | Criterio | Tarea |
|---|---|---|
| 1 README | 1 | 1 |
| 2 docstrings | 1 | 1 |
| 3 spec (estado, casillas, §12) | 1 | 4 |
| 4 nota 10-15 | 1 | 2 |
| 5 índice storybook | 1 | 2 |
| 6 capturas y time-lapse | 2 | 3 (+ enlaces en 4) |
| 7 delta de caras | 3 | 3, 4 |
| 8 docs.test | 4 | stage 3 |
| 9 PR (inventario, caras, time-lapse, conos, bloom) | 5 | stage 8 |

## Grilling

- 1 ronda. El griller fue `fable`. Las revisiones fueron menores, sin cambio de costura: A8–A12, la recarga antes del time-lapse, el chequeo del listener, el paso del orquestador entre Task 3 y Task 4, y la confirmación de los números en el código.
- 18 preguntas, con estas fuentes:
  - ISSUE: 3 (5, 7, 18).
  - CODE: 8 (4, 6, 9, 11, 12, 14, 18).
  - DOC: 2 (10, 3).
  - NO SOURCE: 6 (1, 2, 8, 13, 15, 16). Todas son supuestos técnicos, A8–A12. Ninguna es ambigüedad de spec ni queda fuera de alcance.
- Respuestas clave:
  - En `main` 05318e5:
    - `gradas` y `calle-faroles` tienen las mismas cajas que en la rama (`exhibits.ts:90,95` contra `:92,97`).
    - `readout`, `cropScene`, `cropAnimators` y `pieceScene` están en `crop.ts:161,54,83,113`.
    - `assembleWorld(zones, opts)` está en `assemble.ts:20`.
    - `package.json` y `package-lock.json` no cambian entre 05318e5 y HEAD (`git diff --stat` vacío), así que el `node_modules` enlazado vale (A1).
  - Valores de `rail-anim.ts`: `IN_MS` = 25 833 ms, `phaseStart("out")` = 55 833 ms y `CYCLE_MS` = 101 667 ms. A los 52 s el tren está detenido. Los 21,5 s sobre el cruce salen del PR #288 ("`#paso-a-nivel` a 21,5 s con el tren sobre el cruce").
  - El tope de 600 es de la capa: spec §6.3 ("su capa lleva un tope de **600 caras**") e issue ítem 7 ("el máximo de `rail.train` (≤ 600)").
  - El listener del lab usa `ticker.deltaMS * speed` (`page.ts:83-85`, `storybook.ts:138-141`). Llamarlo directo esquiva el tope `_maxElapsedMS`, que vive en `Ticker.update` (CLAUDE.md; método A de `2026-10-17-barcos-inventario.md`).
  - Los conos de A4 siguen vigentes: después de #287 solo entró #288, y #288 no toca `flora.ts` ni las escenas (`git diff 726ab5c f96897f --stat`).
  - El ítem 9 (cuerpo del PR) lo produce el stage 8 del pipeline, fuera del plan.
  - La atribución de los commits sale de las instrucciones de la sesión.
- Issues abiertos: ninguno.
