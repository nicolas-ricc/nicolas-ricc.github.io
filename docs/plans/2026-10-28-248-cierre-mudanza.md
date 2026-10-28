# Cierre de #238 (mudanza de la fábrica) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la historia #238: README, docstrings y comentarios con la disposición nueva, `docs.test.ts` con un describe "(#238)", nota de desvío en la spec 10-24, spec de la mudanza implementada con `## 9. Desvíos`, capturas antes/después, tabla de caras y la verificación de las chimeneas en la cover.

**Architecture:** No cambia geometría ni tests de escena. Tres entregables: (1) docs fijados por tests en `src/lab/docs.test.ts` (patrón de #217); (2) mediciones con un script `tsx` efímero (no commiteado) y capturas con agent-browser en `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/`; (3) la sección `## 9. Desvíos` de la spec de la mudanza. Los tests de las tres tareas los escribe el orquestador en el stage 3 (evals), en rojo; cada tarea los pone en verde.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS 8, agent-browser (ver CLAUDE.md), `tsx`.

**Spec:** issue #248 ("Qué hacer" 1–8 y criterios) y `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` §5–§7. Contexto: plan de la historia en el comentario de #238; hijos #241–#247 (PRs #257, #259, #260, #261, #263, #266, #269) ya en `feature/238-fabrica-mudanza`.

## Global Constraints

- Rama base `feature/238-fabrica-mudanza`; el PR va contra esa rama.
- No se toca geometría ni tests de escena. `CLAUDE.md` no cambia.
- Capturas: agent-browser, `set viewport 1600 900 2` (PNG 3200×1800). Sitio en `http://localhost:517x/`; exhibits en `/lab/storybook.html?speed=0#<id>`.
- "Antes" = `origin/main` (worktree `/tmp/main`, `npm ci`, `npm run dev -- --host --port 5174`). "Después" = esta rama en 5173.
- Caras = `readout(cropScene(scene, box), cropAnimators(animators, box)).faces` (`src/lab/crop.ts`) con `assembleWorld(undefined, { reducedMotion: false })` (`src/world/assemble.ts`), caja del exhibit **de cada árbol**; piezas con `readout(pieceScene(e.build, e.pad), [])`. Exhibits: `planta`, `chimeneas`, `subestacion`, `playa-camiones`, `naves`, `cinta` (solo antes), `tanque-agua` (informativa).
- Idioma: castellano rioplatense. Los párrafos del README se envuelven a ~80 columnas como hoy.
- Los tests de #217 en `docs.test.ts` siguen en verde: el párrafo del mundo conserva `nave de calderas`, `maltería`, `tanque de agua`, `chimeneas … bandas` (sin punto entre medio), `subestación de intemperie`, `excavadora de rueda`; el docstring de `factory.ts` conserva la ruta de la spec 10-24.
- `npm test`, `npm run typecheck` y `npm run build` en verde.

## Review Focus

1. **El párrafo correcto del README.** El párrafo del mundo es el que contiene `` `factory.ts` ``; la frase sobre los galpones tiene que estar ahí y no en otro párrafo. Test: regex sobre ese párrafo con espacios colapsados (Task 1).
2. **Nada describe la posición vieja como actual.** "detrás (al norte) y al oeste del astillero" y "Banda norte x −60..205" desaparecen del docstring de `factory.ts`; `hinterland.ts` y el README dicen "al norte y al oeste de la fábrica" para la industria del margen, que no se movió y sigue siendo cierto. Test: el docstring de `factory.ts` no contiene `detrás (al norte) y al oeste del astillero` (Task 1).
3. **La nota de la spec 10-24 justo debajo del título de §2**, no en cualquier parte: el test toma la primera línea no vacía después de `## 2. Reglas de modelado` (Task 2).
4. **"Antes" con las cajas de `main`.** `playa-camiones` y `naves` cambiaron de caja: la tabla aclara que cada columna usa la caja de su árbol (Task 3/4).
5. **La fracción visible en la cover** depende del encuadre real: además de la fórmula del alero, se confirma que la boca y la base visible de cada chimenea caen dentro del viewport de `coverView(1600, 900)` y que el rótulo PORTFOLIO (`LABEL_AT.portfolio` en `src/main.ts`) no cae sobre la fábrica (Task 3).

## Assumptions

- **A1.** "Antes" de la cover es `origin/main` tal cual (incluye #237, costas, que la rama base no tiene). Lo que difiere fuera de la fábrica se anota.
- **A2.** Las capturas de los hijos con el mismo nombre (`planta-*`, `chimeneas-*`, `subestacion-*`, `naves-*`) se reemplazan; las demás (`vaciar-*`, `mundo-*`, `planta-9-vanos-*`, `playa-camiones-*`) quedan como registro de cada paso.
- **A4.** Ids que no existen en un árbol (`cinta` en la rama; ninguno más: `naves` y `playa-camiones` existen en los dos) se imprimen como "—", y así van a la tabla.
- **A5.** La cover se captura sin `?speed=0` (el issue: "en el sitio no hace falta"); se espera a que haya humo en pantalla (dos `wait 3000`) y el chequeo del humo es visual sobre esa captura. Las dos covers no son el mismo frame de animación; la comparación es de disposición, no de píxeles.
- **A6.** Si falla una captura, no se commitea nada de Task 3 hasta tener las once; los servidores se matan con `pkill -f "vite.*517[34]"` y el worktree con `git worktree remove --force /tmp/main`, en el paso de limpieza que corre el implementador siempre al final, aunque haya fallado antes.
- **A3.** Fracción visible = (altura total − z desde la que se ve) / altura total, con altura total = `STACK_BASE_H + h` (pedestal incluido): 25, 29 y 27. La escala de `coverView(1600, 900)` da la altura en píxeles CSS de la parte visible.

---

### Task 1: README, docstrings y comentarios

**Files:**
- Modify: `README.md` (párrafo "Mundo isométrico", líneas ~16–36; lista de specs, ~61–72)
- Modify: `src/scenes/factory.ts:15-25` (docstring)
- Review (cambiar solo si nombran la posición vieja como actual): `src/scenes/shipyard.ts`, `maltings.ts`, `boiler-house.ts`, `substation.ts`, `plant-frame.ts`, `src/lab/exhibits.ts` (comentarios)
- Test: `src/lab/docs.test.ts` (ya escrito en el stage 3)

**Interfaces:** ninguna.

- [ ] **Step 1: Correr los tests** — `npx vitest run src/lab/docs.test.ts -t "#238"`: fallan los de README, docstring de `factory.ts`.
- [ ] **Step 2: README.** En el párrafo del mundo, después de la frase de `factory.ts`, agregar que la fábrica ocupa el lugar que tenían los galpones del astillero, entre la playa de vías y la calle de transferencia, delante del desvío, con la cinta inclinada bajando a la playa de camiones (la cinta larga ya no está), y que las naves de montaje, los talleres y el patio de material del astillero quedan al norte, detrás de la fábrica. En la lista del lab, agregar `` `2026-10-27-fabrica-mudanza-design.md` `` al final, antes del `)`.
- [ ] **Step 3: Docstring de `factory.ts`.** Reescribir: "Fábrica de Portfolio, en el lugar que tenían los galpones del astillero (región x 4..98.7, y −4..99)…"; qué hay (planta, tanque, chimeneas, torre de enfriamiento, subestación, playa de camiones con cinta inclinada y faroles, con sus cotas actuales que ya da el docstring), qué se fue (cinta larga, ramal `SPUR_Y`, ramal embutido en la calle, chatas, rieles nave→grada), que en la banda norte quedan el desvío, la grúa torre y las naves/talleres/patio del astillero (`shipyard.ts`), la columna oeste igual que hoy. Referencias: mantener `2026-09-14-…§5` y `2026-10-24-fabrica-detalle-design.md`; agregar `Mudanza: docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md.`
- [ ] **Step 4: Revisar los demás.** `grep -n "−46\|-46\|y −60..0\|banda norte\|al oeste del astillero" src/scenes/{shipyard,maltings,boiler-house,substation,plant-frame}.ts src/lab/exhibits.ts` y leer cada docstring: los que hablan del marco local como "marco local" están bien; corregir cualquiera que diga que la fábrica está hoy en la banda norte.
- [ ] **Step 5: Correr** — `npx vitest run src/lab/docs.test.ts`: verdes los de #238 de esta tarea y todos los de #217.
- [ ] **Step 6: Commit** — `docs(#248): README, docstrings y comentarios con la fábrica en el lugar de los galpones`.

### Task 2: Nota en la spec 10-24 y estado de la spec de la mudanza

**Files:**
- Modify: `docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md` (debajo de `## 2. Reglas de modelado`)
- Modify: `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md:4`

- [ ] **Step 1: Correr** — `npx vitest run src/lab/docs.test.ts -t "#238"`: fallan nota y estado.
- [ ] **Step 2: Nota.** Línea en blanco tras el título y luego un párrafo en cursiva: `*Desvío (2026-10-27): las "huellas estables" de abajo quedaron reemplazadas por la mudanza del complejo al lugar de los galpones (`2026-10-27-fabrica-mudanza-design.md`, #238): cambian las posiciones de planta, portón, `STACKS`, cinta, playa de camiones y subestación. El detalle de §5–§9 sigue vigente. Lo que sigue queda como registro.*`
- [ ] **Step 3: Estado.** `**Estado:** implementado en #238 (rama `feature/238-fabrica-mudanza`, hijos #241–#247 y este cierre, #248); los desvíos están en §9`.
- [ ] **Step 4: Correr** y **commit** — `docs(#248): nota de desvío en la spec de la fábrica en detalle y mudanza implementada`.

### Task 3: Capturas, tabla de caras y chimeneas en la cover (sin código commiteado)

**Files:**
- Create/replace en `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/`: `cover-antes.png`, `cover-despues.png`, `planta-antes.png`, `planta-despues.png`, `chimeneas-antes.png`, `chimeneas-despues.png`, `subestacion-antes.png`, `subestacion-despues.png`, `naves-antes.png`, `naves-despues.png`, `cinta-antes.png`
- Create (no se commitea): `.scratch/caras-248.ts`, `.scratch/medicion-248.md`

**Interfaces:**
- Produces: `.scratch/medicion-248.md` con (a) tabla `| exhibit | caja antes | sólidos antes | caras antes | caja después | sólidos después | caras después |` y delta total de caras (suma de filas no informativas: todas menos `tanque-agua`); (b) por chimenea: z desde la que se ve, fracción, altura visible en px CSS a la escala de `coverView(1600, 900)`, y `sx, sy` de pantalla de la boca y de la base visible (deben caer en 0..1600 × 0..900); (c) observaciones de la cover (bandas, humo, rótulo, fachada sur, cabecera de la maltería).

- [ ] **Step 1: Worktree** — `git worktree add /tmp/main origin/main && (cd /tmp/main && npm ci)`.
- [ ] **Step 2: Caras** — `.scratch/caras-248.ts <raíz>` importa `src/lab/exhibits.ts`, `src/world/assemble.ts`, `src/lab/crop.ts` de esa raíz e imprime `id caja sólidos caras` para cada id de Global Constraints que exista. `npx tsx .scratch/caras-248.ts /tmp/main` y `… /work`. Chequeo: "después" de `planta` 164/1652 y `playa-camiones` 21/63 (PR #266), `subestacion` 361/1200 (PR #261), salvo cambios posteriores que se expliquen.
- [ ] **Step 3: Chimeneas** — con `STACKS`, `STACK_BASE_H` de `factory.ts`, alero norte y 43.4 z 14 y testero z 18.5 x 92..93, calcular z visible = `max(0, (cy − 23.8)/1.4)` (`Z_SCALE = 1.4` en `src/iso/project.ts:4`; 23.8 sale del alero: `sy = sx/2 + 43.4 − 1.4·14`; no depende de x porque el alero es paralelo al eje x, siempre que el `sx = cx − cy` de la chimenea caiga dentro del `sx` del alero, −14.4..48.6: la de (86, 32), con sx 54, queda fuera y la tapa el testero/torre) (y para la del este, también el tramo que tapa el testero); esperado 76 %, 94 %, 86 %. Proyectar con `coverView(1600, 900)` (escala y offset) boca y base visible a píxeles.
- [ ] **Step 4: Servidores** — 5173 (rama) y 5174 (`/tmp/main`); `curl -sf` a cada uno.
- [ ] **Step 5: Capturas** — agent-browser (CLAUDE.md), `set viewport 1600 900 2`. Cover: abrir `http://localhost:5174/`, esperar el primer dibujo (dos `wait 3000` y mirar), `screenshot …/cover-antes.png`; ídem 5173 → `cover-despues.png`. Exhibits: `http://localhost:517x/lab/storybook.html?speed=0#<id>` → `<id>-antes.png` / `<id>-despues.png`; `cinta` solo en 5174. Verificar con `file` que todo es PNG 3200 x 1800 y mirar cada uno (Read).
- [ ] **Step 6: Mirar la cover** — en `cover-despues.png`: bandas de balizamiento visibles en las tres chimeneas, humo desde las bocas, rótulo PORTFOLIO fuera de la fábrica, fachada sur de la nave, cabecera de la maltería. Anotar en `.scratch/medicion-248.md`. Si hay un problema de geometría, se anota en Desvíos y se informa al orquestador; no se arregla acá.
- [ ] **Step 7: Limpieza** (también si aborta): matar los `vite`, `agent-browser close`, `git worktree remove --force /tmp/main`.
- [ ] **Step 8: Commit** — `git add docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/ && git commit -m "docs(#248): capturas finales antes y después de la mudanza"`.

### Task 4: Spec de la mudanza — `## 9. Desvíos`

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` (sección nueva al final, después de §8)

**Interfaces:**
- Consumes: `.scratch/medicion-248.md` (Task 3).

- [ ] **Step 1: Correr** — `npx vitest run src/lab/docs.test.ts -t "#238"`: falla el de Desvíos.
- [ ] **Step 2: Escribir `## 9. Desvíos`**, una viñeta por punto, citando el hijo: ramal embutido eliminado entero, no solo al norte de y 96 (spec de la estación, #242); nave de 63 u (9 vanos de 7) en lugar de "unas 62" (#243); tanque en (15, 32) (#246); chimeneas en (58, 32), (72, 26), (86, 32) (#245); torre de enfriamiento (40, 14) (#245); subestación x 54..95, y −2..11 (#244); exhibit `cinta` eliminado y `planta` sin el tanque (#242, #246); marco local + `translate` con `PLANT_SHIFT (−15, +90)` en `plant-frame.ts` y `SUBSTATION_SHIFT (−95, +58)` en `substation.ts` (#241, #244, #246); estado intermedio de la rama sin galpones entre #242 y #247 (hijos en orden); cota sur del patio de material en y −58.62 (#247); farol de (5, 76) dentro de la caja `planta` (#266). Después:
  - `### 9.1 Caras por exhibit`: la tabla de Task 3 (filas `` | `planta` | … ``), delta total, nota de cajas por árbol.
  - `### 9.2 Chimeneas en la cover`: la tabla de fracciones y lo observado.
  - `### 9.3 Capturas`: enlaces relativos `assets/2026-10-27-fabrica-mudanza/<nombre>.png` a las once capturas.
- [ ] **Step 3: Correr** — `npx vitest run src/lab/docs.test.ts`, luego `npm test`, `npm run typecheck`, `npm run build`.
- [ ] **Step 4: Commit** — `docs(#248): desvíos de la mudanza con tabla de caras y capturas`.

### Tests del stage 3 (los escribe el orquestador antes de las tareas)

Nuevo `describe("documentación de la mudanza de la fábrica (#238)")` en `src/lab/docs.test.ts`:
- párrafo del mundo (espacios colapsados) matchea `/(galpones|naves de montaje)[^.]*(al norte|detrás)[^.]*fábrica/`;
- párrafo del lab contiene `2026-10-27-fabrica-mudanza-design.md`;
- docstring de `factory.ts` (hasta `export interface FactoryScene`) contiene `docs/superpowers/specs/2026-10-27-fabrica-mudanza-design.md` y no contiene `detrás (al norte) y al oeste del astillero`;
- `shipyard.ts` no contiene `patio de material → nave de montaje → grada`;
- spec 10-24: la primera línea no vacía después de `## 2. Reglas de modelado` empieza con `*Desvío (2026-10-27):` y el párrafo nombra `2026-10-27-fabrica-mudanza-design.md`;
- spec de la mudanza: `^## 9\. Desvíos$`; `**Estado:**` matchea `implementad` y no `listo para agente`; la sección tiene filas `` | `planta` | ``, `chimeneas`, `subestacion`, `playa-camiones`, `naves`, `cinta` y enlaces a `cover-antes.png` y `cover-despues.png`;
- `cover-antes.png` y `cover-despues.png` son PNG 3200×1800 (lectura del IHDR como el test de #217: `png.subarray(1, 4)` y `readUInt32BE(16/20)`); las demás capturas de Task 3 existen.

Los tests de shipyard y de "no contiene" ya pasan hoy (guardas de regresión): `patio de material → nave de montaje → grada` está en `origin/main` (`shipyard.ts:13`) y no en la rama. Cada tarea corre el describe entero y solo mira los suyos.

Todos los commits llevan la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa issue → tareas

| "Qué hacer" | Criterio | Tarea |
|---|---|---|
| 1 README | 1 | 1 |
| 2 docstrings | 1 | 1 |
| 3 docs.test | 1 | stage 3 |
| 4 nota 10-24 | 2 | 2 |
| 5 Estado + Desvíos | 2, 5 | 2, 4 |
| 6 capturas | 3 | 3 |
| 7 chimeneas en la cover | 4 | 3 (+ PR) |
| 8 tabla de caras y delta total | 5 | 3, 4 (+ PR) |
| verificación general | 6 | 4 |

## Grilling

- 1 ronda (revisiones menores: mapa issue → tareas, A4–A6, derivación de la fórmula, rango de hijos, línea de atribución). Griller: fable.
- 17 preguntas. Fuentes: ISSUE 7 (1, 4, 5, 9, 10, 11, 12), CODE 8 (2, 3, 5, 6, 8, 15, 16, 17), DOC 1 (13: CLAUDE.md, método de captura), NO SOURCE 4 → supuestos técnicos (2 ids ausentes → A4; 10 frame de la cover → A5; 13 limpieza → A6; 14 filtro `-t`, que matchea "(#238)" en el nombre del describe).
- Respuestas clave: el delta total lo pide el ítem 8 y el criterio 5 ("Tabla de caras … y delta total"). `cropScene`/`cropAnimators`/`pieceScene`/`readout` existen en `origin/main` (`crop.ts:54,83,113,161`), `assembleWorld(zones, { reducedMotion })` en `assemble.ts:20`; se importan en Node como hace `exhibits.test.ts:30` (`vitest.config.ts:4`, `environment: "node"`). `tsx` es devDependency (`package.json:31`). El "antes" desde `origin/main` lo fija el ítem 6 del issue; la base de la rama de la historia es b9550c5 (`git merge-base`). Los valores esperados de "después" salen de los PR #266 y #261; `chimeneas` y `naves` sin esperado (se miden). "§5–§9 sigue vigente" es cita del issue (ítem 4) y de la spec de la mudanza ("No cambia el detalle arquitectónico de cada pieza (§5–§9 de ese spec)"); "lo que sigue queda como registro" se refiere a las huellas, y se reescribe así. El reemplazo de capturas con el mismo nombre lo pide el ítem 6 ("Si un hijo anterior dejó una captura con el mismo nombre, reemplazarla por la final"). Rótulo: `LABEL_AT.portfolio = (66, −128, 0)` (`src/main.ts:35`), fuera de la región x 4..98.7, y −4..99 en mundo; en pantalla se confirma a ojo sobre `cover-despues.png`. `coverView` en `src/world/view.ts:30`. El header de `executing-plans` es el formato fijo del skill `writing-plans`; se ejecuta con `subagent-driven-development`.
- Supuestos: A1–A6.
- Issues abiertos: ninguno.
