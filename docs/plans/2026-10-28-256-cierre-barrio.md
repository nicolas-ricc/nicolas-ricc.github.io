# Cierre de #240 (barrio residencial costero) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la historia #240: juntar la evidencia de §5, §7, §8 y §9 del spec (capturas antes/después, tabla de caras y acentos, `totals` del mundo, bloom en tres corridas por lado), bajar el tope de sólidos de `tech.test.ts` y poner al día README, docstring de `tech.ts`, la spec de mundo-3, el índice del storybook y la sección "Desvíos" de la spec del barrio.

**Architecture:** No cambia código de escena. Tres entregables: (1) docs fijadas por tests en `src/lab/docs.test.ts`, como hizo #217; (2) mediciones con un script `tsx` efímero y con agent-browser, sin commitear scripts, con las capturas en `docs/superpowers/specs/assets/2026-10-27-barrio/`; (3) la sección "11. Desvíos" de la spec, también fijada por test. El checklist del punto 4 del issue (zonificación, inventario §4.2, criterios §9) va en la descripción del PR (stage 8), no en un archivo.

**Tech Stack:** TypeScript, Vitest, Vite, PixiJS 8, agent-browser 0.27 (+ extensión PixiJS DevTools, ver CLAUDE.md), `tsx`, Python 3 (stdlib) para recortar PNG.

**Spec:** issue #256 (criterios de aceptación) y `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` §4.2, §5, §7, §8, §9. Contexto: plan de la historia en el comentario de #240 (decisiones 1–24). Hijos: #249–#255 (cerrados), PRs #262, #264, #265, #267, #268, #270, #271, ya en la rama base (`git log origin/main..origin/feature/240-barrio-costero`: d669cf3 … fa9ac76).

## Criterios de #256 → tareas

| Criterio de aceptación de #256 | Dónde |
|---|---|
| 1. Las seis PNG en `assets/2026-10-27-barrio/`, enlazadas en el PR | Task 3 (archivos y test), stage 8 (enlaces) |
| 2. Tabla de caras y acentos con porcentajes y `totals`, en el PR y en el spec; total ≤ +10 %, región ≤ +25 % | Task 3 (medición), Task 4 (§11.2–11.3), stage 8; los topes ya los verifica `tech.test.ts:156-159` |
| 3. Seis líneas de bloom y peor redibujo, medianas y delta, en el PR y en el spec | Task 3 Step 9, Task 4 (§11.4), stage 8 |
| 4. Checklist del punto 4 en el PR (zonificación, §4.2, §9) | Task 3 (g) produce la tabla; stage 8. El issue dice "Checklist completo **en el PR**" (punto 4 de "Qué hacer") |
| 5. Tope de sólidos recalculado | Task 2 |
| 6. README, docstring, nota de mundo-3, índice del storybook y "Desvíos" | Task 1 y Task 4 |
| 7. `npm test`, `npm run typecheck`, `npm run build` | Task 4 Step 4 y stage 4 |

## Global Constraints

- Rama base `feature/240-barrio-costero`; el PR va contra esa rama.
- **"Antes" = b9550c5** (merge-base de la rama con `main`; es el `main` sobre el que se midieron `TECH_FACES_BEFORE`/`REGION_FACES_BEFORE` y se tomó `cover-antes.png`). `origin/main` ya tiene a34dec0 (#237, costas de la isla), que la rama no tiene: medir contra `origin/main` mezclaría ese cambio en el delta. Worktree: `git worktree add /tmp/main b9550c5`.
- Capturas: agent-browser, `set viewport 1600 900 2` (PNG 3200×1800). Sitio en `http://localhost:5173/` (cover). Mundo en `/lab/world.html?speed=0`, tecla `2` (encuadre Resume). Exhibit en `/lab/storybook.html?speed=0#barrio`. "Antes" servido desde `/tmp/main` en el puerto 5174.
- Recorte de la esquina: 840×600 px (el tamaño de `assets/2026-10-27-anotaciones/barrio-4.jpg`), la **misma caja** en `cover-antes.png` y en `cover-despues.png`, ubicada como en `barrio-4.jpg`: el rótulo RESUME arriba a la izquierda (su caja empieza en ≈ (25, 50) del recorte) y la costa en diagonal abajo a la derecha.
- Exhibits de la tabla de caras: `monoblock`, `casas`, `escuela`, `club`, `plaza-barrio`, `costanera`, `barrio`. Caras = `readout(cropScene(scene, e.box), cropAnimators(animators, e.box)).faces` de `src/lab/crop.ts` (lo que muestra el panel), con `assembleWorld(undefined, { reducedMotion: false })`. "Antes" = la misma caja sobre el mundo de b9550c5 (labs y atrios). Se anota también el valor del marcador de #249 que dieron los PRs de los hijos.
- Caras de `tech`: `facesIn([...ground, ...solids], …)` sobre `tech(zoneRng(SEED, "cv", 2))`, igual que `tech.test.ts:157-158`. Antes = `TECH_FACES_BEFORE` (8458) y `REGION_FACES_BEFORE` (1286).
- Acentos de `tech` = `scene.accents.length` + frame 0 de todas las capas `accent` de `techAnimator(scene, createRng(SEED + 5), { reducedMotion: false })` (como `tech.test.ts:167-171`), en b9550c5 y en la rama.
- Bloom: `/lab/world.html` **sin parámetros**, una carga fría descartada y **tres corridas calientes** (recargas) por lado. Por corrida, copiar literal `[lab] bloom: …` y el primer `[lab] peor redibujo en 5 s: …` posterior. Medianas del promedio de bloom y del peor redibujo; delta = después − antes. Si el delta de la mediana de bloom supera 1 ms: decirlo tal cual en el PR y en "Desvíos", con las seis líneas crudas. Este issue no simplifica piezas ni abre follow-up por eso.
- Tope de sólidos de `tech.test.ts:23`: `ceil(medido × 1.10 / 100) × 100`, con medido = sólidos elevados (`!isFlat`) de la escena del test, `tech(createRng(7))`.
- Scripts de medición en `.scratch/` (ya está en `.git/info/exclude`), nunca commiteados. El script de caras importa **solo** desde la raíz que recibe. `facesIn` y `insideInflated` no existen en b9550c5, así que se copian al script (son tres líneas sobre `bounds`/`tessellate` de esa raíz). No se mezclan dos `src/` en un mismo proceso.
- Formatos de log: `[lab] bloom: promedio X ms en 60 frames (tick T + render R), presupuesto 15 ms → activo|fallback` (`src/world/bloom.ts:23-24`, `bloom-runtime.ts:37`). El número de la mediana es X. `[lab] peor redibujo en 5 s: W ms` (`src/lab/page.ts:91`). Las dos líneas son iguales en b9550c5.
- agent-browser: sesión `AGENT_BROWSER_SESSION=cierre256`. Los pids de vite van en `.scratch/pids`. Si una corrida no emite las dos líneas en 180 s, se repite una vez; si vuelve a fallar, se anota "sin línea" y se informa así.
- `CLAUDE.md` no cambia (el método de captura no cambió).
- `npm test`, `npm run typecheck` y `npm run build` en verde.
- Idioma de docs y comentarios: castellano rioplatense, como el resto del repo.

## Review Focus

1. **El README habla del barrio en el párrafo correcto y sin borrar el oeste.** Test: el párrafo que contiene `` `tech.ts` `` nombra barrio residencial costero, monoblocks, casas con techo de teja, escuela, club, plazas y costanera iluminada sobre el muelle; sigue diciendo "distrito tecnológico de Resume al oeste"; ya no dice "al oeste y al sur de la ciudad" (Task 1).
2. **La nota de mundo-3 queda encima de la tabla de tipos, no en cualquier lado.** Test: el texto entre `## 2. Decisiones` y `| Tema | Decisión |` cita `2026-10-27-barrio-costero-design.md` (Task 1).
3. **Recortes comparables.** Un recorte de distinto tamaño o caja no se compara. Test: `barrio-4-antes.png` y `barrio-4-despues.png` son PNG de 840×600; los cuatro de vista entera son 3200×1800 (Task 3).
4. **Mediciones headless.** agent-browser corre a ~2 fps y con GPU software, y el ruido entre corridas es ≈ 1 ms (#229). Se informa cada línea cruda, el `rendererType` y las medianas; la decisión del delta se toma sobre las medianas (Task 3).
5. **La sección de desvíos se puede encontrar y está completa.** Título exacto `## 11. Desvíos`; adentro, una fila por exhibit, `TECH_FACES_BEFORE`, seis líneas `[lab] bloom`, seis `peor redibujo`, "mediana" y los enlaces a `cover-despues`, `barrio-4-*`, `barrio-despues`, `mundo-*`. La línea `**Estado:**` dice "implementado" (Task 4).

## Assumptions

- **A1. "Antes" en b9550c5, no en `origin/main`.** Ver Global Constraints. Descartado: `origin/main` (a34dec0 agrega las costas de la isla, que la rama no tiene, y el delta de bloom y `totals` incluiría ese cambio).
- **A2. Caras "antes" por exhibit = la misma caja sobre b9550c5.** El issue permite "—" o el marcador. La caja vieja es lo que el barrio reemplazó y sirve para el presupuesto; el marcador se anota de los PRs de los hijos (monoblock 15, casas 25, escuela 6, club 6, plaza-barrio 16, costanera 94). Descartado: solo "—", que no compara nada.
- **A3. `totals` del mundo** en `/lab/world.html` sin parámetros, **después** de la línea `[lab] bloom:`: `stage.ts:164` agrega el slot del bloom recién cuando el modo es `on`, así que antes de esa línea el conteo no es estable. Se toman en la primera corrida caliente de cada lado y se anota el modo (`activo`/`fallback`). Se informan todas las claves y la suma sin `containers`. Descartado: con la página recién cargada, que depende del momento.
- **A4. Tope de sólidos sobre `tech(createRng(7))`**, la escena que usa el test. Descartado: la semilla del mundo, que el test no usa.
- **A5. `## 11. Desvíos`** sigue a §10 "Fuera de alcance", la última sección del spec.
- **A6. Recorte con Python stdlib** (`zlib` + `struct`, decodifica los filtros PNG y escribe con filtro 0). La máquina no tiene ImageMagick ni PIL. Descartado: agregar una dependencia npm.
- **A8. Cover del sitio sin `?speed`.** El sitio no lee `?speed` (`src/main.ts` no lo usa) ni usa `Date`/`Math.random`: la escena es determinística y solo cambia la fase de las animaciones (barcos, ventanas). `cover-antes.png` se tomó igual (#262). Se espera a que la red quede ociosa y 8 s más.
- **A9. Bloom por encima de +1 ms.** El issue lo resuelve: "Si el delta de la mediana supera 1 ms, decirlo tal cual en el PR y en 'Desvíos' con las seis líneas crudas (este hijo no simplifica piezas…)". El plan de #240 aclara que el bloom no es criterio de ningún hijo, por el ruido entre corridas de #229 (18.4 y 19.8 ms). No se abre follow-up: el pipeline solo abre follow-ups desde la revisión del plan.
- **A10. "implementado" antes de llegar a `main`.** Hay precedente en `2026-10-24-fabrica-detalle-design.md:4` ("implementado en #208–#217 (rama `feature/207-fabrica-detalle`)").
- **A7. Índice del storybook.** La fila "Resume: tecnológico" de `2026-10-17-storybook-estructuras-design.md` ya lista los siete (#249). La Task 1 lo fija con un test y no lo edita.

---

### Task 1: README, docstring de `tech.ts`, nota en mundo-3 e índice del storybook

**Files:**
- Modify: `README.md` (párrafo "Mundo isométrico", ~líneas 18–37, y lista de specs del párrafo de `/lab/world.html`, ~líneas 61–73)
- Modify: `src/scenes/tech.ts:20-29` (docstring), solo si hace falta para el test
- Modify: `docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md` (entre `## 2. Decisiones` y la tabla)
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Write the failing tests.** Agregar `describe("documentación del barrio costero (#256)")` en `src/lab/docs.test.ts`, con párrafos con espacios colapsados (`.replace(/\s+/g, " ")`):

```ts
const mundo = (parrafos.find((p) => p.includes("`tech.ts`")) ?? "").replace(/\s+/g, " ");
it("el párrafo del mundo cuenta el barrio costero y deja el distrito tecnológico al oeste", () => {
  for (const re of [/barrio residencial costero/, /monoblocks/, /casas con techo de teja/, /escuela/, /club/, /plazas/, /costanera iluminada sobre el muelle/]) expect(mundo).toMatch(re);
  expect(mundo).toMatch(/distrito tecnológico de Resume al oeste/);
  expect(mundo).not.toMatch(/al oeste y al sur de la ciudad/);
});
it("README lista la spec del barrio entre las specs", () => expect(lab).toContain("2026-10-27-barrio-costero-design.md"));
it("el docstring de tech.ts cuenta el barrio y apunta a su spec", () => {
  const doc = techSrc.slice(0, techSrc.indexOf("export interface Tower"));
  expect(doc).toMatch(/barrio residencial costero/);
  expect(doc).toContain("docs/superpowers/specs/2026-10-27-barrio-costero-design.md");
  expect(doc).not.toMatch(/laboratori|atrio/);
});
it("mundo-3 remite al spec del barrio encima de la tabla de tipos", () => {
  const head = mundo3.slice(mundo3.indexOf("## 2. Decisiones"), mundo3.indexOf("| Tema | Decisión |"));
  expect(head).toContain("2026-10-27-barrio-costero-design.md");
});
it("el índice del storybook lista los siete exhibits del barrio", () => {
  const row = story.split("\n").find((l) => l.startsWith("| Resume: tecnológico |")) ?? "";
  for (const t of ["monoblock", "casas con techo de teja", "escuela", "club", "plaza de barrio", "costanera", "barrio costero"]) expect(row).toContain(t);
});
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/lab/docs.test.ts`: fallan el del README (las dos aserciones), el de la lista de specs y el de mundo-3. El del docstring y el del índice pueden pasar ya.
- [ ] **Step 3: Editar.**
  - README, párrafo del mundo: reemplazar "`tech.ts` (distrito tecnológico de Resume al oeste y al sur de la ciudad)" por "`tech.ts` (distrito tecnológico de Resume al oeste de la ciudad y, al sur, sobre el estuario, un barrio residencial costero: monoblocks, casas con techo de teja, escuela, club, plazas y una costanera iluminada sobre el muelle)". El resto de la frase no cambia.
  - Lista de specs: agregar `` `2026-10-27-barrio-costero-design.md` `` al final, antes del `)`.
  - mundo-3: bajo `## 2. Decisiones`, antes de la tabla, un párrafo: `> **Nota (2026-10-28):** los laboratorios y los atrios de la fila "Suburbio → distrito tecnológico" ya no existen; al sur del distrito hay un barrio residencial costero. Ver \`2026-10-27-barrio-costero-design.md\`.`
  - Docstring de `tech.ts`: solo si el test falla.
- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/lab/docs.test.ts`.
- [ ] **Step 5: Commit.** `docs(#256): README, docstring de tech.ts y nota de mundo-3 con el barrio costero`.

### Task 2: Tope de sólidos elevados de `tech.test.ts`

**Files:**
- Modify: `src/scenes/tech.test.ts:23`

**Interfaces:** ninguna.

- [ ] **Step 1: Medir.** Con un `.scratch/solidos-256.ts` efímero: `tech(createRng(7)).solids.filter((x) => !isFlat(x)).length` → `N`. Tope = `Math.ceil(N * 1.1 / 100) * 100`. Anotar `N` y el tope en `.scratch/medicion-256.md`.
- [ ] **Step 2: Cambiar el test.** `expect(raised.length).toBeLessThan(<tope>)`. Antes del `expect`, un comentario de una línea: `// tope = medido (N, #256) × 1.10, redondeado a la centena superior`.
- [ ] **Step 3: Run, expect PASS.** `npx vitest run src/scenes/tech.test.ts`. Comprobación del ajuste: con un tope de `N` el test falla y con `N + 1` pasa. Probarlo a mano y no commitearlo. Si el tope calculado sale igual a 2500, no se cambia el número y se agrega solo el comentario. `N > 2500` no puede pasar, porque el test está en verde.
- [ ] **Step 4: Commit.** `test(#256): tope de sólidos elevados de tech al medido + 10 %`.

### Task 3: Mediciones y capturas (ningún script se commitea)

**Files:**
- Create: `docs/superpowers/specs/assets/2026-10-27-barrio/{cover-despues,barrio-4-antes,barrio-4-despues,barrio-despues,mundo-antes,mundo-despues}.png`
- Create (no se commitean): `.scratch/caras-256.ts`, `.scratch/crop-256.py`, `.scratch/medicion-256.md`
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: `EXHIBITS` (`src/lab/exhibits.ts`), `assembleWorld` (`src/world/assemble.ts`), `cropScene`/`cropAnimators`/`readout` (`src/lab/crop.ts`), `tech`, `techAnimator`, `facesIn`, `BARRIO_REGION`, `zoneRng`, `SEED`, `suburbBlocks`, `zoneKinds`, `inCoverQuad` (`src/map/geo.ts:54`).
- Produces: `.scratch/medicion-256.md`, con los bloques que copian la Task 4 y el PR:
  - (a) caras de `tech` total y región, antes, después y porcentaje;
  - (b) caras por exhibit: antes en b9550c5, marcador y después;
  - (c) acentos de `tech`, estáticos y frame 0, antes y después;
  - (d) `totals` de `rendering.capture()` del mundo, antes y después, con la suma sin `containers`;
  - (e) seis pares de líneas de bloom y peor redibujo, más medianas y delta;
  - (f) entorno: Pixi, `rendererType`, viewport;
  - (g) tabla de zonificación: `(x, y)`, tipo y si es visible en el cover (`inCoverQuad(x + 12, y + 9)`), para todas las manzanas de `suburbBlocks()` con `zoneKinds(zoneRng(SEED, "cv", 2), blocks)`, más el conteo por tipo.

- [ ] **Step 1: Write the failing test** (mismo `describe` de la Task 1):

```ts
const png = (n: string) => readFileSync(`${ROOT}docs/superpowers/specs/assets/2026-10-27-barrio/${n}.png`);
const size = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];
it("capturas del cierre: vistas enteras a 1600×900 ×2 y recortes de la esquina iguales", () => {
  for (const n of ["cover-despues", "barrio-despues", "mundo-antes", "mundo-despues"]) { const b = png(n); expect(b.subarray(1, 4).toString()).toBe("PNG"); expect(size(b)).toEqual([3200, 1800]); }
  for (const n of ["barrio-4-antes", "barrio-4-despues"]) { const b = png(n); expect(b.subarray(1, 4).toString()).toBe("PNG"); expect(size(b)).toEqual([840, 600]); }
});
```

- [ ] **Step 2: Run, expect FAIL** (ENOENT).
- [ ] **Step 3: Worktree "antes".** Si `/tmp/main` ya existe: `git worktree remove --force /tmp/main; git worktree prune`. Después: `git worktree add /tmp/main b9550c5 && (cd /tmp/main && npm ci)`. Esperado: `/tmp/main/node_modules` existe.
- [ ] **Step 4: Script de caras, acentos y zonificación.** `.scratch/caras-256.ts <raíz>` importa dinámicamente desde `<raíz>/src/...` e imprime (a), (b), (c) y, si existe `tech-zoning.ts`, (g). En b9550c5 los exhibits del barrio no existen: tomar las cajas de la rama (`/work/src/lab/exhibits.ts`) y aplicarlas a la escena de b9550c5. Correr `npx tsx .scratch/caras-256.ts /tmp/main` y `npx tsx .scratch/caras-256.ts /work`. Verificación: antes da total 8458 y región 1286 (las constantes); después, el total ≤ 9303 y la región ≤ 1607; `costanera` coincide con lo que mide el panel en el Step 6.
- [ ] **Step 5: Servidores.** `npm run dev -- --host --port 5173` en `/work` y `npm run dev -- --host --port 5174` en `/tmp/main`, con `nohup … &` y el pid guardado. Verificar con `curl -sf` las dos raíces.
- [ ] **Step 6: Capturas.**
  - Abrir agent-browser con la extensión, con el comando de CLAUDE.md y `set viewport 1600 900 2`. Primero correr el snippet de CLAUDE.md "¿enganchó?" (verificado con 0.26; acá corre 0.27): tiene que dar `active: "pixi-active"`. Si no engancha, las capturas se toman igual y el bloqueo de los `totals` se anota.
  - Sitio: `http://localhost:5173/`, `wait --load networkidle` y 8 s más (A8) → `cover-despues.png`.
  - Mundo: `http://localhost:5174/lab/world.html?speed=0`, `press 2`, esperar `[lab] primer dibujo` en `agent-browser console` → `mundo-antes.png`. Lo mismo en 5173 → `mundo-despues.png`.
  - Exhibit: `http://localhost:5173/lab/storybook.html?speed=0#barrio` → `barrio-despues.png`, y anotar las caras de los exhibits del panel.
  - Mirar cada PNG con Read para confirmar el encuadre.
- [ ] **Step 7: Recortes.** `.scratch/crop-256.py <in> <out> <x> <y> 840 600` (Python stdlib, correr con `python3 -I`). Elegir `x, y` mirando `cover-antes.png` contra `barrio-4.jpg`: el rótulo RESUME arriba a la izquierda y la costa abajo a la derecha. Aplicar la misma caja a `cover-antes.png` → `barrio-4-antes.png` y a `cover-despues.png` → `barrio-4-despues.png`. Mirar los dos con Read y anotar la caja en (f).
- [ ] **Step 8: `totals`.** En `world.html` de cada puerto, sin parámetros, después de la línea `[lab] bloom:` de la primera corrida caliente del Step 9 (A3), correr `agent-browser eval` con el snippet `rendering.capture()` de CLAUDE.md, y el de `__PIXI_DEVTOOLS_WRAPPER__` para la versión y el renderer → (d) y (f).
- [ ] **Step 9: Bloom.**
  - Para cada puerto (5174 primero), abrir `/lab/world.html` sin parámetros. Esa carga fría se descarta.
  - Después, tres veces: `agent-browser reload`, esperar a que aparezcan `[lab] bloom: …` y un `[lab] peor redibujo en 5 s: …` posterior, y copiar las dos líneas literales. Para esperar, usar `agent-browser wait 5000` en bucle (60 frames a ~2 fps tardan ~30–60 s) y leer `agent-browser console`. Limpiar la consola antes de cada recarga con `agent-browser console --clear` (existe en 0.27). Esperar hasta 180 s por corrida (Global Constraints).
  - Calcular las medianas del promedio de bloom y del peor redibujo, y el delta → (e).
- [ ] **Step 10: Run, expect PASS.** `npx vitest run src/lab/docs.test.ts`.
- [ ] **Step 11: Limpieza.** Hacerla también si la tarea aborta a mitad: matar los dos `vite`, `agent-browser close`, `git worktree remove --force /tmp/main`.
- [ ] **Step 12: Commit.** Los seis PNG y el test: `docs(#256): capturas del cierre del barrio (cover, esquina, exhibit y mundo)`.

### Task 4: Spec del barrio — estado y "Desvíos"

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-barrio-costero-design.md` (línea `**Estado:**` y sección nueva al final)
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: `.scratch/medicion-256.md` (Task 3); desvíos de los PRs #262, #264, #265, #267, #268, #270 y #271 y de los planes `docs/plans/2026-10-28-25{0..5}-*.md`, `2026-10-28-249-*.md`.
- Produces: la sección que enlaza el PR.

- [ ] **Step 1: Write the failing tests** (mismo `describe`):

```ts
const barrio = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-27-barrio-costero-design.md`, "utf8");
const at = barrio.search(/^## 11\. Desvíos$/m);
const desvios = at < 0 ? "" : barrio.slice(at);
it("la spec del barrio dice implementada", () => {
  const estado = barrio.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
  expect(estado).toMatch(/implementad/);
});
it("la spec del barrio cierra con desvíos, caras, acentos, totals y bloom", () => {
  expect(at).toBeGreaterThan(0);
  for (const id of ["monoblock", "casas", "escuela", "club", "plaza-barrio", "costanera", "barrio"]) expect(desvios).toMatch(new RegExp(`^\\| \`${id}\` \\|`, "m"));
  for (const s of ["TECH_FACES_BEFORE", "REGION_FACES_BEFORE", "totals", "mediana", "roofMat", "plaza-barrio", "ACCESSES"]) expect(desvios).toContain(s);
  expect(desvios.match(/\[lab\] bloom: /g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  expect(desvios.match(/\[lab\] peor redibujo en 5 s: /g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  for (const n of ["cover-antes", "cover-despues", "barrio-4-antes", "barrio-4-despues", "barrio-despues", "mundo-antes", "mundo-despues"]) expect(desvios).toContain(`assets/2026-10-27-barrio/${n}.png`);
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Editar la spec.**
  - `**Estado:**` → `implementado en #249–#256 (rama \`feature/240-barrio-costero\`); los desvíos y la medición están en §11`.
  - Sección `## 11. Desvíos`:
    - `### 11.1 Lo que la historia decidió distinto`: una línea por desvío, con su hijo:
      - ventanas por placas en banda en vez de `facade`, por presupuesto (#249, #250);
      - techos solo a dos aguas con `roofMat`, sin `hip` (#249, #251);
      - escuela de proporción ≈ 3:1 con fachada al este y vestíbulo (#252);
      - exhibit `plaza-barrio`, porque el id `plaza` ya existía (#249);
      - plazas con césped liso en vez de `tiles` y senderos `poly` (#254);
      - zonificación en pre-pase, con damero monoblock/campus, plazas fijas y `blockParity` por índice de fila en `ROWS` (#249);
      - costanera con `ACCESSES` y su recorte de presupuesto: 3 bancos, 3 cestos, sombrillas de 4 lados (#255);
      - casas: 4–5 por manzana, lote sur 0 vacío y ala solo al este (#251);
      - monoblock: no emite ventanas tapadas (`occluded()`) (#250);
      - club: luz de la banda sur solo en el tramo visible (#253);
      - sin cancha chica en la plaza ("cancha o arenero") (#254);
      - tope de sólidos `< <tope>` (Task 2).
    - `### 11.2 Caras y acentos`: tabla `| | antes | después | Δ |` con total `tech` (`TECH_FACES_BEFORE`), región (`REGION_FACES_BEFORE`) y acentos estáticos + frame 0. Después, la tabla `| exhibit | antes (b9550c5, misma caja) | marcador (#249) | después |`, una fila por exhibit con formato `` | `monoblock` | … ``. Las caras del marcador salen de los paneles de los PRs #265, #264, #268, #267, #270 y #271. `barrio` no tiene marcador informado: va "—".
    - `### 11.3 Capturas y totals`: la caja del recorte (x, y, 840×600 sobre 3200×1800), enlaces a los siete PNG de `assets/2026-10-27-barrio/` (antes y después del cover, de la esquina y del mundo, y el exhibit `barrio`), `totals` antes/después y su suma sin `containers`.
    - `### 11.4 Bloom`: las seis líneas `[lab] bloom: …` y las seis `[lab] peor redibujo en 5 s: …`, literales, en un bloque de código. Medianas, delta y entorno. Si el delta supera 1 ms, una frase que lo diga tal cual.
- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/lab/docs.test.ts`. Después `npm test`, `npm run typecheck` y `npm run build`.
- [ ] **Step 5: Commit.** `docs(#256): spec del barrio implementada, con desvíos y medición`.

### Después de las tareas (stage 8, no es tarea de implementador)

La descripción del PR lleva:
- las seis capturas nuevas, más `cover-antes`, enlazadas;
- la tabla de caras y acentos con porcentajes, y los `totals`;
- las seis líneas de bloom, con medianas y delta;
- la tabla de zonificación (g), en `<details>`, con las visibles marcadas;
- el inventario §4.2 entero, con cada casilla marcada y su captura (copiado de los PRs de los hijos, diciendo qué casilla no se ve en ninguna captura);
- los criterios de §9.

## Grilling

- 1 ronda. Los cambios fueron aclaraciones: el mapa de criterios a tareas, los formatos de log, el momento de los `totals`, el timeout, la sesión y los pids, el caso de empate del tope y la caja del recorte en la spec. No se agregaron ni se quitaron tareas. Griller: fable.
- 17 preguntas. Fuentes:
  - ISSUE: 4 (1, 7, 13 en parte, 14);
  - CODE: 11 (2, 3, 4, 5, 6, 9, 10, 11, 12, 16, 17);
  - NO SOURCE: 3 (8, 15, y 13 en el caso del empate).
- Respuestas clave:
  - `cover-antes.png` mide 3200×1800 y se tomó en b9550c5 (mensaje de d669cf3). `tech-budget.ts` dice "Medidos en b9550c5".
  - En b9550c5 existen `cropScene`/`cropAnimators`/`readout` (`crop.ts:54,83,161`), `assembleWorld` (`assemble.ts:20`), `isFlat` (`solids.ts:34`), la tecla `"2": "cv"` (`page.ts:12`) y las líneas `primer dibujo`/`peor redibujo` (`page.ts:56,91`).
  - `sprawl-grid.ts`, `geo.ts`, `world.ts`, `page.ts` y `main.ts` no cambian entre b9550c5 y la rama (`git diff --stat` vacío): las cajas eligen el mismo suelo.
  - Topes +10 %/+25 %: spec §5 y `tech.test.ts:156-159`.
  - `| Tema | Decisión |` aparece una sola vez, en la línea 35, después de `## 2. Decisiones` (línea 33).
  - Spec del barrio: `**Estado:**` en la línea 4 y `## 10. Fuera de alcance` en la 280.
  - `docs.test.ts` define `ROOT` y `readme` arriba; `parrafos` y `lab` son locales al `describe` de #217, así que el `describe` nuevo los define.
  - `` `tech.ts` `` aparece por primera vez en README:33, dentro del párrafo "Mundo isométrico".
- Supuestos: A1–A10.
- Issues abiertos: ninguno.
