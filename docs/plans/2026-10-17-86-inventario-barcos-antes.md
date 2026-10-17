# #86 Inventario "antes" de los barcos y time-lapse del recorrido viejo — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar en `docs/superpowers/specs/2026-10-17-barcos-inventario.md` el inventario verificado (código + sitio) de todos los conjuntos de assets de barco tal como están antes de #85, con capturas `antes-*.png`, conteos de PixiJS DevTools y un time-lapse que muestre el bucle del recorrido viejo.

**Architecture:** No cambia código. Tres entregables: (1) capturas instantáneas y conteos por frame tomados con `agent-browser` + PixiJS DevTools sobre `lab/world.html`; (2) un time-lapse compuesto dentro de la página (canvas 2D, `lighten`) durante un ciclo completo de los barcos; (3) el documento con la tabla, que también lee los números del código (`CYCLE_MS`, fases, estados). Un test de Vitest en `scripts/` (no en `src/`, que no debe cambiar) comprueba que el documento y las capturas existen y están completos.

**Tech Stack:** Vite dev server, PixiJS v8 (WebGL2), `agent-browser` 0.26 con la extensión PixiJS DevTools, Vitest, `tsx` para scripts de medición temporales en `.scratch/`.

**Spec:** issue #86 (hijo 1 de #85). Contexto y decisiones del padre en el comentario de plan de #85.

## Global Constraints

- Ningún archivo bajo `src/` cambia (`git diff --stat origin/feature/85-barcos-semirrecta -- src/` vacío).
- `npm test` y `npm run typecheck` verdes.
- Documento: `docs/superpowers/specs/2026-10-17-barcos-inventario.md`, frontmatter al estilo de `2026-10-16-barcos-referencia.md`: líneas `**Fecha:**`, `**Estado:**`, `**Issues:**`, `**Alcance:**`.
- Capturas en `docs/superpowers/specs/assets/85-barcos/`: `antes-cover.png`, `antes-recorrido.png`, `antes-darsena.png`, `antes-pecio.png`, `antes-lancha.png`, `antes-feria-botes.png`.
- Time-lapse copiado además a `.superpowers/barcos-timelapse-antes.png` (gitignored).
- Navegador: `http://localhost:5173/map/lab/world.html`, viewport `1600 900 2`, extensión PixiJS DevTools cargada según `CLAUDE.md`. Teclas `4` cover 16:9, `3` Blog, `0` mundo; `?speed=N` acelera los animadores.
- Columnas de la tabla: conjunto, archivo, instancias simultáneas, instancias por ciclo, dónde, animación, correcto sí/no + captura.
- Sección "Después" con el texto exacto `pendiente: lo completa el hijo de verificación de #85`.
- La misma tabla va en la descripción del PR (contra `feature/85-barcos-semirrecta`).
- Docs en castellano rioplatense, prosa sobria como el resto de `docs/superpowers/specs/`.

## Review Focus

- **Time-lapse negro o vacío:** Pixi WebGL con `preserveDrawingBuffer: false` devuelve un buffer en blanco a `drawImage` fuera del frame; un PNG oscuro uniforme pasaría por "existe". Esperado: el test exige que el PNG tenga dimensiones del canvas (≥ 1600×900) y el implementador lo abre con Read y confirma que se ven las trazas.
- **Ciclo incompleto:** si el headless corre a pocos FPS, `?speed=40` durante 45 s reales no cubre los 1805 s simulados. Esperado: medir el reloj simulado (sumar `deltaMS·speed` o comparar `state` antes/después) y extender la captura hasta cubrir ≥ 1 ciclo; anotar duración real y simulada en el doc.
- **Conjunto omitido:** la tabla del issue tiene ocho filas; un grep incompleto deja fuera, p. ej., la boya del pecio o el bote salvavidas de los kits. Esperado: el doc lista todo `kind: "hull"`, boyas, botes y lanchas de `src/scenes/*.ts`; el test exige las ocho filas por nombre y el implementador agrega las que encuentre.
- **Conteos de un solo instante:** el issue pide `totals` en al menos dos instantes. Esperado: dos (o más) bloques de `totals` en el doc, con el estado de los barcos en cada instante; el test exige al menos dos apariciones de `"sprites"`/`"graphics"` o una tabla con dos filas de conteo.
- **Enlace roto:** el doc cita una captura que no existe o con otro nombre. Esperado: el test resuelve cada `assets/85-barcos/*.png` citado y comprueba que existe.

---

## Datos ya medidos (para el doc)

Con `npx tsx` sobre `src/scenes/sea-anim.ts` (estado de `origin/feature/85-barcos-semirrecta` = `main` 9dc191c):

- `CYCLE_MS` = 1 805 380 ms (≈ 1805 s). `OUT_MS` ≈ 796 168 ms (carril de ida 955.4 u a 1.2 u/s), `OFF_MS` 15 000, `BACK_MS` ≈ 970 212 ms (vuelta 1164.3 u), `BERTH_MS` 24 000 (giro en el lugar entre 8 y 16 s).
- Fases 0, ⅓, ⅔. Combinaciones de estados de los 3 barcos a lo largo de un ciclo (muestreo cada 100 ms):

| ida / vuelta / fondeo / fuera | fracción del ciclo |
|---|---|
| 2 ida + 1 vuelta | 32.4 % |
| 1 ida + 2 vuelta | 61.3 % |
| 1 ida + 1 vuelta + 1 fondeado | 3.9 % |
| 1 ida + 1 vuelta + 1 fuera de cámara | 2.4 % |

Es decir: siempre hay 2 o 3 barcos en pantalla en algún carril; 3 instancias por ciclo (una por `ShipKind`), cada una pasa una vez por ida, fuera, vuelta y fondeo.

## File Structure

- Create: `docs/superpowers/specs/2026-10-17-barcos-inventario.md` — el inventario (Task 3).
- Create: `docs/superpowers/specs/assets/85-barcos/antes-{cover,darsena,pecio,lancha,feria-botes}.png` (Task 1), `antes-recorrido.png` (Task 2).
- Create (stage 3, ya en la rama antes de las tareas): `scripts/barcos-inventario.test.ts` — eval que comprueba doc y capturas.
- Modify: `README.md` — agregar el doc nuevo a la lista de specs (Task 3).
- Scratch, no versionado: `.scratch/` (en `.git/info/exclude`), `.superpowers/` (gitignored).

---

### Task 1: Capturas instantáneas y conteos por frame

**Files:**
- Create: `docs/superpowers/specs/assets/85-barcos/antes-cover.png`, `antes-darsena.png`, `antes-pecio.png`, `antes-lancha.png`, `antes-feria-botes.png`
- Create (scratch): `.scratch/86-conteos.md` con los `totals` crudos y las observaciones por conjunto (lo consume la Task 3)
- Test: `scripts/barcos-inventario.test.ts` (casos de capturas instantáneas)

**Interfaces:**
- Produces: cinco PNG en `docs/superpowers/specs/assets/85-barcos/`; `.scratch/86-conteos.md` con, por instante, `{ t, estados de los 3 barcos, totals, instructions.length, renderTime }` y, por conjunto, "se ve correcto sí/no" con el motivo.

- [ ] **Step 1: Correr el test y ver que falla**

Run: `npx vitest run scripts/barcos-inventario.test.ts`
Expected: FAIL en los casos de `antes-cover.png` etc. (no existen).

- [ ] **Step 2: Levantar el dev server**

```bash
cd /work && (npm run dev -- --host --port 5173 > /tmp/vite.log 2>&1 &) ; until curl -sf http://localhost:5173/map/lab/world.html >/dev/null; do sleep 1; done
```

- [ ] **Step 3: Abrir el lab con PixiJS DevTools y comprobar el gancho**

```bash
export AGENT_BROWSER_SESSION=pixi86
agent-browser set viewport 1600 900 2
agent-browser --extension ~/.agent-browser/extensions/pixijs-devtools/ext --args "--headless=new" open "http://localhost:5173/map/lab/world.html?speed=20"
agent-browser eval "(() => { const w = window.__PIXI_DEVTOOLS_WRAPPER__; return JSON.stringify({ active: w.isPixiActive, ver: w.version, renderer: w.rendererType, stageKids: w.stage.children.length }); })()"
```
Expected: `"active":"pixi-active"`. Si `set viewport` antes de `open` no aplica en la sesión nueva, repetirlo después de `open`.

- [ ] **Step 4: Cover con barcos a la vista + conteo #1**

`agent-browser press 4`, esperar ~2 s, `agent-browser screenshot docs/superpowers/specs/assets/85-barcos/antes-cover.png`. Luego:

```bash
agent-browser eval "(async () => { const r = await window.__PIXI_DEVTOOLS_WRAPPER__.rendering.capture(); return JSON.stringify({ totals: r.totals, drawCalls: r.drawCalls, renderTime: r.renderTime, instrucciones: r.instructions.length }); })()"
```
Anotar en `.scratch/86-conteos.md` el resultado y la hora de reloj real. Abrir la captura con Read: debe verse al menos un barco. Si ninguno está a la vista, esperar unos segundos y repetir.

- [ ] **Step 5: Conteo #2 en otro instante**

Esperar ≥ 30 s reales (con `?speed=20`, 600 s simulados: los barcos cambiaron de tramo) y repetir el `capture()`. Anotarlo como instante 2. Opcional: un tercero con `?speed=` distinto o tras `0` (mundo completo), indicando el encuadre.

- [ ] **Step 6: Capturas de detalle**

Para encuadrar detalles las teclas no alcanzan (encuadran zonas). Mover y escalar el contenedor del stage directamente, que es lo que hace `fit()` en `src/lab/page.ts` (`stage.container.position/scale`). El contenedor es `window.__PIXI_DEVTOOLS_WRAPPER__.stage.children[0]`. Proyección: `sx = x − y`, `sy = (x + y)/2 − 1.4·z`. Helper para centrar el punto de mundo `(x, y)` con escala `s` en un canvas de `W×H` CSS px:

```bash
agent-browser eval "(() => { const c = window.__PIXI_DEVTOOLS_WRAPPER__.stage.children[0]; const [x, y, s] = [232, 50, 6]; const sx = x - y, sy = (x + y) / 2; const W = innerWidth, H = innerHeight; c.scale.set(s); c.position.set(W / 2 - sx * s, H / 2 - sy * s); return JSON.stringify({ sx, sy }); })()"
```
(Si las coordenadas de pantalla de la escena tienen un desplazamiento —el mundo arranca en (−60, −60)—, calibrar primero con un punto conocido: encuadrar el faro o `BERTH` y ajustar.) Tomar:

- `antes-darsena.png`: centro `BERTH` (232, 50) más las gradas al oeste (`SLIP_X`, `ROW_Y` en `src/scenes/shipyard.ts`); que se vean el casco en construcción (grada 1), el casco de grada 2 y, de ser posible, un barco fondeado. El estado `berth` dura 24 s simulados por barco y ciclo (3.9 % del ciclo); la página no expone `state(k)`, así que con `?speed=20` tomar varias capturas seguidas del encuadre y quedarse con la que muestre un barco en el fondeadero, o dejar el fondeadero vacío y decirlo en el doc. Incluir el dique seco si entra en el encuadre.
- `antes-pecio.png`: centro `WRECK` (462, 150), que se vean la boya del pecio (470, 160) con su anillo de espuma y las boyas de canal (420, 80) y (430, 160).
- `antes-lancha.png`: centro ~ (265, −170), ruta `FERRY_ROUTE` (279, −252) → (290, −212) → (241, −84); la lancha visible.
- `antes-feria-botes.png`: centro sobre la orilla de la feria en y −284..−200 (`beach()` en `src/scenes/fair.ts`), que se vean los botes `hull` de 5 u.

Abrir cada PNG con Read y anotar en `.scratch/86-conteos.md`, por conjunto: renderizado completo (casco, superestructura, luces, estela), tapado o no por sólidos estáticos, solapes con otros barcos, fade solo en el sangrado. Escribir "no" con el motivo cuando algo se vea mal; no corregir nada (este issue no cambia código).

- [ ] **Step 7: Correr el test**

Run: `npx vitest run scripts/barcos-inventario.test.ts -t "capturas"`
Expected: PASS los casos de las cinco capturas instantáneas.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/assets/85-barcos/antes-{cover,darsena,pecio,lancha,feria-botes}.png
git commit -m "docs(#86): capturas antes de los conjuntos de barcos"
```

---

### Task 2: Time-lapse del recorrido viejo

**Files:**
- Create: `docs/superpowers/specs/assets/85-barcos/antes-recorrido.png`; copia en `.superpowers/barcos-timelapse-antes.png`
- Append (scratch): método usado, duración real y simulada, en `.scratch/86-conteos.md`
- Test: `scripts/barcos-inventario.test.ts` (caso del time-lapse)

**Interfaces:**
- Consumes: sesión `agent-browser` y dev server de la Task 1 (o abrirlos de nuevo igual que en sus Steps 2–3).
- Produces: `antes-recorrido.png` del tamaño del canvas de Pixi (3200×1800 a 2x), encuadre cover (tecla `4`).

- [ ] **Step 1: Correr el test y ver que falla**

Run: `npx vitest run scripts/barcos-inventario.test.ts -t "time-lapse"`
Expected: FAIL (`antes-recorrido.png` no existe).

- [ ] **Step 2: Abrir con `?speed=40`, encuadre cover**

```bash
agent-browser --extension ~/.agent-browser/extensions/pixijs-devtools/ext --args "--headless=new" open "http://localhost:5173/map/lab/world.html?speed=40"
agent-browser press 4
```

- [ ] **Step 3: Componer en la página (método A: `drawImage` tras render forzado)**

Con `preserveDrawingBuffer` falso el buffer WebGL se borra después de presentarse; dibujarlo justo después de un `render` síncrono evita el negro:

```bash
agent-browser eval "(() => { const w = window.__PIXI_DEVTOOLS_WRAPPER__, src = w.canvas; const acc = document.createElement('canvas'); acc.width = src.width; acc.height = src.height; const g = acc.getContext('2d'); g.globalCompositeOperation = 'lighten'; let n = 0; const t0 = performance.now(); window.__tl = { acc, n: 0, t0 }; window.__tlId = setInterval(() => { w.renderer.render(w.stage); g.drawImage(src, 0, 0); window.__tl.n = ++n; }, 500); return JSON.stringify({ w: acc.width, h: acc.height }); })()"
```

Comprobar a los ~5 s que no está negro: `agent-browser eval "(() => { const d = window.__tl.acc.getContext('2d').getImageData(0, 0, window.__tl.acc.width, window.__tl.acc.height).data; let s = 0; for (let i = 0; i < d.length; i += 4000) s += d[i] + d[i+1] + d[i+2]; return s; })()"` — debe ser claramente > 0. Si da 0, ir al método B (Step 5).

- [ ] **Step 4: Cubrir un ciclo completo y exportar**

`CYCLE_MS` ≈ 1805 s simulados. A `speed=40` y 30 FPS son ~45 s reales, pero headless puede correr más lento: medir el reloj simulado acumulando `ticker.deltaMS * 40` (`w.pixi`/`app.ticker` si está accesible) o, más simple, esperar 120 s reales y comprobar en la imagen que se ve la ida y la vuelta completas (bucle de la bahía + bajada por el este + vuelta por el noreste). Entonces:

```bash
agent-browser eval "(() => { clearInterval(window.__tlId); return window.__tl.acc.toDataURL('image/png').split(',')[1]; })()" > .scratch/tl.b64
```
Si la salida viene entre comillas JSON, quitarlas (`tr -d '"\n'`). Si es demasiado grande para una sola salida, devolver por trozos de 1 MB (`.slice(i, i + 1e6)`) en varios `eval` y concatenar. Decodificar:

```bash
tr -d '"\n' < .scratch/tl.b64 | base64 -d > docs/superpowers/specs/assets/85-barcos/antes-recorrido.png
mkdir -p .superpowers && cp docs/superpowers/specs/assets/85-barcos/antes-recorrido.png .superpowers/barcos-timelapse-antes.png
```

- [ ] **Step 5: Método B, solo si A sale negro**

`agent-browser screenshot .scratch/tl-NN.png` cada ~1 s real durante el ciclo; luego en la página cargar cada PNG como `Image` desde data URL (`base64 -w0`, inyectado por `eval` en trozos) y componer con `lighten` en un canvas 2D; exportar igual que el Step 4.

- [ ] **Step 6: Verificar a ojo**

Abrir `antes-recorrido.png` con Read. Debe distinguirse el bucle: zarpe de la dársena, subida de la bahía, salida por la bocana, bajada por x ≥ 500, viraje al sur-suroeste y la vuelta cruzando la bahía por el norte. Anotar en `.scratch/86-conteos.md` el método que funcionó (A o B), número de cuadros, duración real y simulada.

- [ ] **Step 7: Correr el test**

Run: `npx vitest run scripts/barcos-inventario.test.ts -t "time-lapse"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/assets/85-barcos/antes-recorrido.png
git commit -m "docs(#86): time-lapse del recorrido viejo de los barcos"
```

---

### Task 3: Documento del inventario

**Files:**
- Create: `docs/superpowers/specs/2026-10-17-barcos-inventario.md`
- Modify: `README.md` (lista de specs del párrafo "Specs en `docs/superpowers/specs/`")
- Test: `scripts/barcos-inventario.test.ts` (casos del documento)

**Interfaces:**
- Consumes: capturas de las Tasks 1–2, `.scratch/86-conteos.md`, la sección "Datos ya medidos" de este plan.
- Produces: el doc; su tabla se copia al cuerpo del PR en stage 8.

- [ ] **Step 1: Correr el test y ver que falla**

Run: `npx vitest run scripts/barcos-inventario.test.ts -t "documento"`
Expected: FAIL (no existe el doc).

- [ ] **Step 2: Completar el inventario en código**

Repasar `grep -n 'kind: "hull"\|boya\|bote\|lancha\|buoy\|wreck' src/scenes/*.ts` y confirmar cada fila de la tabla del issue con archivo y función. Además de las ocho del issue, como mínimo: la boya del pecio (`WRECK_BUOY`, cilindro `steel` con luz fija `magentaMid` y anillo de espuma, en `buoysAndWreck()` de `sea.ts`); los botes salvavidas y balsas que llevan los kits (`ships.ts`) cuentan como piezas del barco, no como conjunto aparte: mencionarlos en la fila del barco. Contar instancias de los estáticos (p. ej. los botes de la feria: hasta 4, los que caen dentro de `fairAt`; contar los que realmente se construyen, con un `tsx` en `.scratch/` que llame a `fair(rng)` con la misma semilla que `assembleWorld`, o contarlos en la captura).

- [ ] **Step 3: Escribir el documento**

Estructura (prosa, en castellano):

```markdown
# Inventario de los conjuntos de barcos (antes de #85)

**Fecha:** 2026-10-17
**Estado:** "antes" completo; "después" pendiente (#88)
**Issues:** #85 (regresión de los barcos), #86 (este inventario). Lo completa el hijo de verificación de #85.
**Alcance:** inventario verificado en código y en el sitio de todos los conjuntos de assets de barco, tal como están en `main` 9dc191c, con capturas y conteos por frame. No cambia código.

## Inventario

| Conjunto | Archivo | Instancias simultáneas | Instancias por ciclo | Dónde | Animación | Correcto |
|---|---|---|---|---|---|---|
| `cargo`, `tug`, `barge` | … | … | … | … | … | sí/no — [antes-cover](assets/85-barcos/antes-cover.png) |
| `ferry` (lancha colectiva) | … |
| pecio partido | … |
| boya del pecio | … |
| boyas de canal | … |
| casco en construcción (quilla y cuadernas) | … |
| casco entero en grada 2 | … |
| casco en el dique seco | … |
| botes del muelle de la feria | … |

(una fila por conjunto; "Animación" dice también qué no se anima)

### Ciclo de los barcos
(los números de "Datos ya medidos": CYCLE_MS, OUT/OFF/BACK/BERTH, fases y la tabla de combinaciones)

## Conteos por frame (PixiJS DevTools)
(una tabla con una fila por instante: instante, encuadre, estado de los barcos, containers, graphics, meshes, sprites, texts, filters, masks, instrucciones, renderTime; nota sobre `drawCalls` = 0 en headless)

## Método del time-lapse
(método A o B, intervalo, `?speed=`, duración real y simulada, cuadros)

## Antes
![time-lapse del recorrido viejo](assets/85-barcos/antes-recorrido.png)
(descripción del bucle; capturas por conjunto con enlaces)

## Después

pendiente: lo completa el hijo de verificación de #85
```

- [ ] **Step 4: README**

En `README.md`, en la lista de specs entre paréntesis, agregar `` `2026-10-17-barcos-inventario.md` `` después de `` `2026-10-16-barcos-referencia.md` ``. Comprobar que `src/lab/docs.test.ts` sigue verde (no se toca el texto de la flota).

- [ ] **Step 5: Correr toda la suite y el typecheck**

Run: `npm test && npm run typecheck`
Expected: todo PASS. Además: `git diff --stat origin/feature/85-barcos-semirrecta -- src/` vacío.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-10-17-barcos-inventario.md README.md
git commit -m "docs(#86): inventario de los conjuntos de barcos antes de #85"
```
