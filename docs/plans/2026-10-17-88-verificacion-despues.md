# #88 Verificación "después" de los carriles nuevos — plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar en el sitio los carriles de #87 y completar la sección "Después" de `docs/superpowers/specs/2026-10-17-barcos-inventario.md` con el time-lapse nuevo, seis capturas instantáneas del cover anotadas con los barcos que van y que vuelven, capturas por conjunto, conteos de PixiJS DevTools y la lista de desviaciones respecto de #85.

**Architecture:** No cambia código de `src/` salvo un defecto local (ver "Si algo falla"). Los entregables son PNG en `docs/superpowers/specs/assets/85-barcos/` y texto en el documento del inventario. El reloj de la página se controla a mano (se detiene el ticker de la app y se llama a su listener con un `deltaMS` fijo), así cada captura tiene un tiempo simulado conocido que se cruza con `shipStateAt`. Un test de Vitest en `scripts/barcos-inventario.test.ts` comprueba que las capturas existen y que lo anotado en el documento coincide con `shipStateAt`.

**Tech Stack:** Vite dev server, PixiJS v8 (WebGL2), `agent-browser` 0.26 con la extensión PixiJS DevTools, Vitest, `npx tsx` para cálculos con `src/scenes/sea-anim.ts`.

**Spec:** issue #88 (hijo 3 de #85). Decisiones del padre en el comentario de plan de #85; método del time-lapse en la sección "Método del time-lapse" del documento del inventario (#86).

## Global Constraints

- PR contra `feature/85-barcos-semirrecta`, no contra `main`.
- `src/` no cambia salvo un defecto local verificable con `src/scenes/sea-anim.test.ts` (vértice movido 1-2 u, nunca más de 2 u sin el validador del comentario de `LANE_OUT`). Si la causa no es local: issue nueva con `needs-triage` y `agent-follow-up`, cuerpo que empieza con `Follow-up of #88`, y se sigue.
- `npm test` y `npm run typecheck` verdes.
- Capturas en `docs/superpowers/specs/assets/85-barcos/`, prefijo `despues-`: `despues-recorrido.png`, `despues-cover-1.png` … `despues-cover-6.png`, `despues-pecio.png`, `despues-boyas.png`, `despues-lancha.png`, `despues-gradas.png`, `despues-feria-botes.png`. Todas PNG a 2x (ancho ≥ 3200).
- `despues-recorrido.png` copiado además a `.superpowers/barcos-timelapse.png` (gitignored).
- Time-lapse de al menos un `CYCLE_MS` completo (1 172 343 ms ≈ 1172 s).
- Seis capturas del cover separadas ≥ `CYCLE_MS/6` (≈ 195,4 s) de reloj simulado, cada una con ≥ 1 barco yendo y ≥ 1 volviendo a alpha 1 (fuera de los 30 u de fade).
- Conteos de `rendering.capture().totals` en dos instantes, comparados con los del "antes".
- Desviaciones respecto de #85, con su razón: sin fondeadero, 42 u en vez de ~30, boyas y pecio movidos, sin exigir cruce de la fosa.
- Docs en castellano rioplatense, prosa sobria como el resto del documento.

## Hechos que el plan ya resolvió

- **URL.** La del issue (`/map/lab/world.html`) no sirve el lab: `vite.config.ts` fija `base: "/"` y esa ruta cae al `index.html` del sitio (ya documentado por #86). Se usa `http://localhost:5173/lab/world.html`.
- **Velocidad.** Headless corre a ~2 fps y Pixi acota `deltaMS` a 100 ms: `?speed=40` rinde ~8 s simulados por s real y no alcanza un ciclo en 30 s. Se usa el método A de #86: llamar al listener del ticker con `deltaMS` fijo. Con `?speed=1` (sin parámetro) el `deltaMS` pasado es el tiempo simulado exacto (`stage.tick(ticker.deltaMS * speed)` en `src/lab/page.ts`).
- **Ciclo** (`npx tsx` contra `src/scenes/sea-anim.ts`): `CYCLE_MS` = 1 172 343 ms; ida 687,9 u; vuelta 664,9 u; `LANE_SPEED` 1,2 u/s; fases 0, ⅓, ⅔ para `cargo`, `tug`, `barge`.
- **Agenda de las seis capturas**, separadas 196 s (≥ T/6 ≈ 195,4 s). Se eligió para que los tres barcos estén a alpha 1 en las seis y cada uno quede a ≥ 66 u (≥ 55 s) de cualquier borde de estado o de fade: la clasificación no cambia aunque el reloj inicial real esté corrido hasta +25 s. Como en todas se ven los tres tipos, `despues-cover-1.png` es también la captura "un barco de cada tipo" que pide el issue:

  | Captura | t simulado (s) | cargo | tug | barge |
  |---|---|---|---|---|
  | 1 | 82 | ida 98 u | ida 567 u | vuelta 330 u |
  | 2 | 278 | ida 334 u | vuelta 97 u | vuelta 566 u |
  | 3 | 474 | ida 569 u | vuelta 332 u | ida 100 u |
  | 4 | 670 | vuelta 98 u | vuelta 567 u | ida 335 u |
  | 5 | 866 | vuelta 333 u | ida 101 u | ida 570 u |
  | 6 | 1062 | vuelta 568 u | ida 337 u | vuelta 100 u |

- **Reloj inicial.** Antes del gancho la app corre sola: `maxFPS` 30 (`src/lab/page.ts`) y Pixi acota cada tick a 100 ms, así que el reloj de los animadores es ≤ los segundos reales desde la carga (en headless, ~0,2 s simulados por s real). El gancho devuelve `performance.now()` al detener el ticker; esa es la cota que se anota. Si supera 25 s, recargar y enganchar más rápido.
- **Encuadre.** El contenedor es `__PIXI_DEVTOOLS_WRAPPER__.stage.children[0]`. Un punto de mundo (x, y) se centra a escala s con posición `(800 − (x − y)·s, 450 − ((x + y)/2)·s)` (viewport 1600 × 900 CSS). El cover es la tecla `4`: posición (625,63; 157,14), escala 1,4904.

## Criterios de aceptación del issue (transcriptos)

- [ ] `despues-recorrido.png` muestra dos trazas semirrectas paralelas bocana → abajo-izquierda, sin bucles ni tramos al norte o al este. → Task 2
- [ ] 6 capturas instantáneas del cover, cada una con ≥ 1 barco yendo y ≥ 1 volviendo a pleno, anotadas en el doc. → Tasks 3, 5
- [ ] Capturas por conjunto `despues-*.png` y conteos de DevTools en el doc; la sección "Después" ya no dice "pendiente". → Tasks 2, 4, 5
- [ ] Todas las imágenes referenciadas existen y se abrieron para comprobarlas. → Tasks 2-5 (cada una abre lo que produce con Read)
- [ ] `npm test` y `npm run typecheck` verdes. → todas
- [ ] PR contra `feature/85-barcos-semirrecta` con la tabla antes/después y las cuatro capturas comparativas en la descripción. → stage 8 del pipeline

## Review Focus

- **Reloj simulado desconocido:** si el ticker de la app sigue corriendo mientras se avanza a mano, el tiempo de cada captura deriva y la anotación "yendo/volviendo" deja de coincidir con la imagen. Esperado: el ticker de la app se detiene (`__tk.stop()`) antes de avanzar, y el tiempo inicial (los ticks de la carga) se acota y se anota; la Task 1 verifica que la anotación del doc coincide con `shipStateAt`, y cada captura se abre y se compara a ojo con lo anotado (rumbo y posición).
- **PNG negro:** `drawImage` de un canvas WebGL fuera del frame da negro. Esperado: render y `drawImage` en la misma tarea; la imagen se abre con Read antes de seguir.
- **Barco a medio fade contado como "a pleno":** α < 1 dentro de 30 u de cada punta. Esperado: la tabla del doc anota la distancia y el alpha de cada barco; el test recalcula alpha con `alphaAt` y exige ≥ 1 a pleno por carril.
- **Captura de conjunto sin el barco que la justifica:** `despues-pecio.png` tiene que mostrar la vuelta pasando al oeste del pecio sin taparse. Esperado: el tiempo de esa captura se elige con `shipStateAt` para que un barco de vuelta esté a la altura del pecio (y ≈ 262).
- **Enlace roto o imagen no citada:** Esperado: el test resuelve cada `assets/85-barcos/*.png` citado y exige que todas las `despues-*` estén citadas.

---

### Task 1: Evals del "después" en el test del inventario

**Files:**
- Modify: `scripts/barcos-inventario.test.ts`

**Interfaces:**
- Produces: el formato de la tabla de capturas instantáneas que la Task 5 tiene que escribir:
  `| Captura | t simulado (s) | cargo | tug | barge | Yendo | Volviendo |`, una fila por captura; la primera celda contiene el enlace `assets/85-barcos/despues-cover-N.png`; la celda de cada barco empieza con `ida`, `vuelta` o `fuera`, seguida de la distancia en u (`ida 205 u`), y lleva `(α 0,45)` si alpha < 1; "Yendo" y "Volviendo" listan los tipos a alpha 1 (`cargo`, `tug`, `barge`) separados por coma, entre backticks. La celda "t simulado (s)" lleva solo el número entero (`82`); la cota del reloj inicial va en prosa debajo de la tabla.
- Produces: tabla de conteos "después" con encabezado que contiene `sprites` y `graphics` y la palabra `después` en la columna "Página" o en el título de la subsección; ≥ 2 filas.

- [ ] **Step 1: Escribir los tests que fallan.** Reemplazar la aserción `pendiente` y agregar el bloque "después":

```ts
import { CYCLE_MS, SHIPS, alphaAt, shipStateAt } from "../src/scenes/sea-anim";

const AFTER = ["despues-recorrido", ...[1, 2, 3, 4, 5, 6].map((n) => `despues-cover-${n}`), "despues-pecio", "despues-boyas", "despues-lancha", "despues-gradas", "despues-feria-botes"];
const after = (): string => doc().slice(doc().search(/^## Despu[eé]s/m));
const LANE_WORD = { out: "ida", back: "vuelta", offscreen: "fuera" } as const;

describe("capturas después de los barcos (#88)", () => {
  it.each(AFTER)("capturas: %s.png existe y es un PNG a 2x", (name) => {
    const file = new URL(`${name}.png`, ASSETS);
    expect(existsSync(file)).toBe(true);
    expect(pngSize(file)?.w).toBeGreaterThanOrEqual(3200);
  });
  it("time-lapse: despues-recorrido.png tiene el tamaño del cover", () => {
    expect(pngSize(new URL("despues-recorrido.png", ASSETS))).toEqual(pngSize(new URL("antes-cover.png", ASSETS)));
  });
});

describe("documento del inventario, después (#88)", () => {
  it("documento: la sección Después está completa y el estado ya no dice pendiente", () => {
    expect(doc()).not.toMatch(/pendiente: lo completa el hijo/);
    expect(doc()).toMatch(/^\*\*Estado:\*\*(?!.*pendiente)/m);
  });
  it("documento: cita todas las capturas después", () => {
    const cited = [...after().matchAll(/assets\/85-barcos\/([\w-]+\.png)/g)].map((m) => m[1]!);
    for (const name of AFTER) expect(cited).toContain(`${name}.png`);
  });
  it("capturas instantáneas: seis, separadas ≥ T/6, con lo anotado igual a shipStateAt y ≥ 1 a pleno en cada carril", () => {
    const sub = after().slice(after().search(/^### Capturas instant[aá]neas/m));
    const rows = sub.slice(0, sub.indexOf("\n### ", 4) < 0 ? undefined : sub.indexOf("\n### ", 4)).split("\n").filter((l) => /^\|.*despues-cover-\d\.png/.test(l)).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
    expect(rows).toHaveLength(6);
    const times = rows.map((r) => Number(r[1]) * 1000);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(CYCLE_MS / 6);
    for (const [r, t] of rows.map((r, i) => [r, times[i]!] as const)) {
      const full: Record<"out" | "back", string[]> = { out: [], back: [] };
      SHIPS.forEach((s, k) => {
        const st = shipStateAt((s.phase * CYCLE_MS + t) % CYCLE_MS);
        expect(r[2 + k], `${r[0]} ${s.kind}`).toMatch(new RegExp(`^${LANE_WORD[st.lane]}\\b`));
        if (st.lane !== "offscreen" && alphaAt(st.lane, st.dist) === 1) full[st.lane].push(s.kind);
      });
      const listed = (cell: string): string[] => [...cell.matchAll(/`(\w+)`/g)].map((m) => m[1]!).sort();
      expect(full.out.length, `${r[0]} yendo`).toBeGreaterThanOrEqual(1);
      expect(full.back.length, `${r[0]} volviendo`).toBeGreaterThanOrEqual(1);
      expect(listed(r[5]!)).toEqual(full.out.sort());
      expect(listed(r[6]!)).toEqual(full.back.sort());
    }
  });
  it("documento: conteos de DevTools después en al menos dos instantes", () => {
    const lines = after().split("\n");
    const header = lines.findIndex((l) => l.startsWith("|") && /sprites/.test(l) && /graphics/.test(l));
    expect(header).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex((l, i) => i > header && !l.startsWith("|"));
    expect(lines.slice(header + 2, end < 0 ? undefined : end).filter((r) => /\d/.test(r)).length).toBeGreaterThanOrEqual(2);
  });
  it("documento: lista las desviaciones respecto de #85", () => {
    for (const re of [/fondeadero/, /42 u/, /boyas/, /pecio/, /fosa/]) expect(after()).toMatch(re);
  });
});
```

En el test viejo "describe el método del time-lapse y deja pendiente la sección Después", quitar la línea de `pendiente` (y su comentario) y renombrarlo a "describe el método del time-lapse y la sección Antes".

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run scripts/barcos-inventario.test.ts` → FAIL en las capturas `despues-*` (no existen) y en las aserciones del documento; los tests de #86 siguen PASS.
- [ ] **Step 3: `npm run typecheck`** → verde.
- [ ] **Step 4: Commit** `test(#88): evals`.

### Task 2: Arnés del navegador, time-lapse "después" y conteos de DevTools

**Files:**
- Create: `docs/superpowers/specs/assets/85-barcos/despues-recorrido.png`
- Create (gitignored): `.superpowers/barcos-timelapse.png`
- Create (sin commit): `.scratch/88-hook.js`, `.scratch/88-timelapse.js`, `.scratch/88-png.mjs`, notas `.scratch/88-notas.md` con lo medido (los usa la Task 5)

**Interfaces:**
- Produces: `window.__tk` (ticker de la app, detenido), `window.__adv(ms)` (avanza el reloj simulado `ms` en pasos de ≤ 15 000 ms, renderiza, devuelve el total simulado acumulado `window.__sim`), y `.scratch/88-png.mjs <dataurl.txt> <out.png>` que decodifica la salida de `agent-browser eval` a PNG. Las Tasks 3 y 4 los reutilizan; si la página se recarga, se vuelve a correr el gancho y `__sim` arranca de nuevo.

- [ ] **Step 1: Dev server.** `npm run dev -- --host --port 5173` en segundo plano con `nohup` (log en `.scratch/dev.log`); comprobar con `curl -s localhost:5173/lab/world.html | grep -c lab-host` → 1.
- [ ] **Step 2: Abrir el lab con DevTools.** Según `CLAUDE.md`:

```bash
export AGENT_BROWSER_SESSION=pixi88
agent-browser set viewport 1600 900 2
agent-browser --extension ~/.agent-browser/extensions/pixijs-devtools/ext --args "--headless=new" open http://localhost:5173/lab/world.html
agent-browser press 4
```

Comprobar `__PIXI_DEVTOOLS_WRAPPER__.isPixiActive === "pixi-active"` y la posición del contenedor ≈ (625,63; 157,14), escala ≈ 1,4904.
- [ ] **Step 3: Gancho del ticker.** Tomar el hash de Vite de pixi (`agent-browser eval "[...performance.getEntriesByType('resource')].map(e=>e.name).find(n=>n.includes('pixi__js'))"`) y correr `.scratch/88-hook.js`, que deja el ticker en `__tk`, lo detiene, y define el avance manual:

```js
(async () => {
  const m = await import(PIXI_URL); // la URL completa leída arriba, con ?v=
  const P = m.Ticker.prototype, o = P.update; let tk = null;
  P.update = function (t) { if (this._minElapsedMS) tk = this; return o.call(this, t); };
  await new Promise((r) => setTimeout(r, 1500)); P.update = o;
  tk.stop(); window.__tk = tk; window.__sim = 0;
  const l = tk._head.next, fn = l._fn, ctx = l._context, w = __PIXI_DEVTOOLS_WRAPPER__;
  window.__adv = (ms) => { while (ms > 0) { const d = Math.min(ms, 15000); fn.call(ctx, { deltaMS: d }); window.__sim += d; ms -= d; } w.renderer.render(w.stage); return window.__sim; };
  return [String(fn).slice(0, 120), `cota del reloj inicial: ${(performance.now() / 1000).toFixed(1)} s`];
})()
```

El reloj de los animadores al detener el ticker es como mucho los segundos reales desde la carga (cada tick ≤ 100 ms y headless corre a ~2 fps, o sea ≲ 0,2 s simulados por s real). El primer elemento devuelto tiene que contener `stage.tick` (si no, `_head.next` no es el listener de `page.ts` y hay que recorrer `_head.next.next`). Anotar la cota en `.scratch/88-notas.md`. Después de cualquier tecla (`4`) o encuadre manual, `__adv(0)` para renderizar: con el ticker detenido nada se redibuja solo. `fit()` solo corre en `keydown` y en `resize` del renderer (`src/lab/page.ts`), y el viewport se fija antes de abrir, así que el encuadre manual se mantiene hasta la captura.
- [ ] **Step 4: Time-lapse.** `.scratch/88-timelapse.js`: acumulador `lighten` como en el método A de #86, `DT` = 6 000 ms (7,2 u por cuadro), 200 cuadros = 1 200 s ≥ `CYCLE_MS`. En cada `requestAnimationFrame`: `__adv(DT)`, `gA.drawImage(src, 0, 0)` en la misma tarea; `window.__tl = { accA, n }`. Esperar con un bucle `until` corto que `__tl.n >= 200` (`agent-browser eval "__tl.n"` cada pocos segundos, en primer plano).
- [ ] **Step 5: Exportar.** `agent-browser eval "__tl.accA.toDataURL('image/png')" > .scratch/tl.txt` y `node .scratch/88-png.mjs .scratch/tl.txt docs/superpowers/specs/assets/85-barcos/despues-recorrido.png`:

```js
// .scratch/88-png.mjs
import { readFileSync, writeFileSync } from "node:fs";
const [, , src, out] = process.argv;
const txt = readFileSync(src, "utf8").trim().replace(/^"|"$/g, "");
writeFileSync(out, Buffer.from(txt.slice(txt.indexOf(",") + 1), "base64"));
```

Copiar a `.superpowers/barcos-timelapse.png`. Abrir el PNG con Read: se tienen que ver dos trazas paralelas desde la bocana hasta abajo-izquierda, sin bucle alrededor de la punta ni tramos al norte o al este. Si el tamaño no es 3200 × 1800, rehacer con el viewport 2x.
- [ ] **Step 6: Conteos.** En dos instantes (antes y después de `__adv(200000)`), `rendering.capture()` → `totals`, `instructions.length`, `renderTime`; anotar `containers`, `graphics`, `sprites`, `filters`, instrucciones y renderTime en `.scratch/88-notas.md` con `__sim` y la hora UTC.
- [ ] **Step 7:** `.scratch/` va en `.git/info/exclude` (lo agrega el stage 3 del pipeline). `npx vitest run scripts/barcos-inventario.test.ts -t "despues-recorrido"` → PASS esos dos casos. Commit `docs(#88): time-lapse después`.

### Task 3: Seis capturas instantáneas del cover

**Files:**
- Create: `docs/superpowers/specs/assets/85-barcos/despues-cover-1.png` … `despues-cover-6.png`
- Modify (sin commit): `.scratch/88-notas.md`

**Interfaces:**
- Consumes: `__adv`, `__sim` de la Task 2 (recargar la página y volver a correr el gancho para que `__sim` arranque en 0).

- [ ] **Step 1:** Recargar, tecla `4`, gancho. `__adv(82000)` y `agent-browser screenshot docs/superpowers/specs/assets/85-barcos/despues-cover-1.png`. Luego `__adv(196000)` antes de cada una de las capturas 2 a 6 (t = 278, 474, 670, 866, 1062 s).
- [ ] **Step 2:** Para cada captura, `npx tsx` (desde `/work`) con este script en `.scratch/88-estado.ts` y el t en segundos:

```ts
import { CYCLE_MS, SHIPS, alphaAt, laneAt, shipStateAt } from "../src/scenes/sea-anim";
const t = Number(process.argv[2]) * 1000;
for (const s of SHIPS) {
  const st = shipStateAt((s.phase * CYCLE_MS + t) % CYCLE_MS);
  const p = st.lane === "offscreen" ? null : laneAt(st.lane, st.dist);
  console.log(s.kind, st.lane, st.dist.toFixed(0), "α", st.lane === "offscreen" ? 0 : alphaAt(st.lane, st.dist).toFixed(2), p && `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})`, "rumbo", ((st.heading * 180) / Math.PI).toFixed(0));
}
```

Abrir cada PNG con Read y confirmar que cada barco a pleno está donde dice el cálculo (posición en pantalla con la fórmula de encuadre) y con el rumbo que corresponde: yendo = proa hacia abajo-izquierda, volviendo = proa hacia arriba-derecha. Anotar en `.scratch/88-notas.md`, por captura: t, estado/distancia/alpha por barco, quiénes van y vuelven a pleno, y cualquier anomalía (barco tapado por un sólido, sobre la boya, el pecio, la punta o la lancha, o solape entre carriles).
- [ ] **Step 3: Tres tipos.** En las seis capturas los tres barcos están a pleno (ver la agenda). En `despues-cover-1.png` confirmar casco, superestructura, luces y estela de `cargo`, `tug` y `barge`; si alguno no se lee a escala de cover, tomar además un recorte a escala 4 centrado en él (`despues-cover-1-detalle.png`) y citarlo.
- [ ] **Step 4:** `npx vitest run scripts/barcos-inventario.test.ts -t "capturas"` → los casos de `despues-cover-*` PASS. Commit `docs(#88): capturas instantáneas del cover`.

### Task 4: Capturas por conjunto

**Files:**
- Create: `despues-pecio.png`, `despues-boyas.png`, `despues-lancha.png`, `despues-gradas.png`, `despues-feria-botes.png` en `docs/superpowers/specs/assets/85-barcos/`

**Interfaces:**
- Consumes: `__adv` de la Task 2 y `.scratch/88-estado.ts` de la Task 3.

Encuadre con `stage.children[0].position.set(800 − (x − y)·s, 450 − ((x + y)/2)·s)` y `.scale.set(s)`, seguido de `__adv(0)` o un render.

| Captura | centro (x, y) | s | Qué tiene que verse | Tiempo |
|---|---|---|---|---|
| `despues-pecio` | (470, 262) | 5 | pecio (490, 262) y su boya (498, 272), un barco de vuelta al oeste del pecio, por delante, sin taparse | t = 82 s: el `barge` va por la vuelta a 330 u, en `laneAt("back", 330)` ≈ (458, 272), 32 u al oeste del pecio |
| `despues-boyas` | (410, 175) | 5 | boyas (398, 150) y (392, 200) al oeste de la ida, un barco de ida pasando por delante | t con un barco de ida en y ≈ 170 |
| `despues-lancha` | (262, −160) | 3,5 | la lancha en su ruta, lejos de los carriles | cualquiera |
| `despues-gradas` | (185, 48) | 4 | casco en construcción en la grada 1, casco en grada 2, dique seco; ya no hay fondeadero ni barco girando | cualquiera |
| `despues-feria-botes` | (236,5, −241,5) | 11 | los cuatro botes de la feria; anotar si el bote 3 sigue enterrado en el muelle (defecto de #86, no de este ticket) | cualquiera |

- [ ] **Step 1:** Para cada fila, recargar si hace falta, gancho, `__adv(t)`, encuadre, `agent-browser screenshot <archivo>`.
- [ ] **Step 2:** Abrir cada PNG con Read y anotar en `.scratch/88-notas.md` qué se ve y si es correcto. Si una captura sale negra o vacía (canvas WebGL sin `preserveDrawingBuffer`), exportarla con `__adv(0); __PIXI_DEVTOOLS_WRAPPER__.canvas.toDataURL('image/png')` en la misma llamada a `eval` y `.scratch/88-png.mjs`, como el time-lapse. Un defecto (barco detrás de un sólido, pisando boya/pecio/punta) se trata según "Si algo falla".
- [ ] **Step 3:** `npx vitest run scripts/barcos-inventario.test.ts -t "capturas"` → todos los PNG `despues-*` PASS. Commit `docs(#88): capturas por conjunto`.

### Task 5: Sección "Después" del documento del inventario

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-barcos-inventario.md`

**Interfaces:**
- Consumes: `.scratch/88-notas.md` (Tasks 2-4); formato de tablas de la Task 1.

- [ ] **Step 1: Frontmatter.** `**Estado:**` → `"antes" y "después" completos`; `**Issues:**` agrega #87 y #88; `**Alcance:**` agrega que "Después" es `feature/85-barcos-semirrecta` tras #87 (commit 11586e2).
- [ ] **Step 2: Sección "## Después"** (reemplaza la línea `pendiente`), con estas subsecciones:
  1. **Inventario después:** la misma tabla de "Inventario" con columnas "Instancias simultáneas", "Instancias por ciclo", "Animación", "Correcto" con captura `despues-*`, una fila por conjunto (las nueve del "antes"). Los barcos: 3, de 1 a 3 a la vista; ciclo `out → offscreen (OFF_MS) → back → offscreen (PORT_MS)`; fade en las dos puntas. Las boyas y el pecio con sus coordenadas nuevas.
  2. **Ciclo después:** `CYCLE_MS` 1 172 343 ms, ida 687,9 u, vuelta 664,9 u, y la tabla de proporción de combinaciones de estados con el script de #86 adaptado (sin `BERTH_MS`).
  3. **Time-lapse:** `![time-lapse del recorrido nuevo](assets/85-barcos/despues-recorrido.png)`, método (método A con el ticker detenido, `DT` 6 000 ms, 200 cuadros, 1 200 s simulados) y lectura.
  4. **Capturas instantáneas:** la tabla con el formato de la Task 1 y una línea por captura con lo que se ve.
  5. **Capturas por conjunto:** tabla de encuadres como la de "Antes", con el t simulado de cada una.
  6. **Conteos por frame:** tabla con encabezado `| # | Página | Instante | containers | graphics | sprites | filters | instrucciones | renderTime ms |` y la comparación con el "antes" (8/82/0/2/53 y 9/105/0/3/63).
  7. **Desviaciones respecto de #85**, cada una con su razón tomada de los comentarios de `sea-anim.ts` / `sea.ts` y del plan de #85: sin fondeadero (el tramo dársena → bocana era el gancho que se quería sacar; los barcos aparecen y desaparecen con fade en la bocana); 42 u en vez de ~30 (con 30 o 36 u dos cargueros a la par se superponen en pantalla); boyas (398, 150) y (392, 200) y pecio (490, 262) movidos (un barco al oeste o al norte de un sólido que se le superpone en pantalla queda detrás); no se exige cruce de la fosa (propiedad de la ruta vieja, no listada por #85).
  8. **Defectos encontrados**, o "ninguno" con lo que se miró.
  9. **Tabla final antes/después** (una fila por conjunto, columnas antes / después / captura antes / captura después), que es la que va en el PR junto con los dos pares comparativos que nombra el issue: `antes-cover.png` / `despues-cover-1.png` y `antes-recorrido.png` / `despues-recorrido.png`.

  Ninguna tabla fuera de "Capturas instantáneas" cita `despues-cover-N.png` en una fila (el test cuenta las filas de esa subsección); en las demás, citar `despues-cover-1` en prosa o con la captura del conjunto. Un defecto derivado a otra issue se escribe "derivado a #N", no "pendiente".
- [ ] **Step 3:** `npm test` y `npm run typecheck` → verdes. Abrir con Read cada PNG citado que no se haya abierto todavía.
- [ ] **Step 4: Limpieza.** `agent-browser close` (sesión `pixi88`) y matar el dev server (`pkill -f "vite.*5173"`). Si una task anterior falló a mitad, lo único que queda son PNG sin commit en `assets/85-barcos/` y archivos en `.scratch/`: se borran o se rehacen; nada de `src/` cambió.
- [ ] **Step 5: Commit** `docs(#88): sección Después del inventario de barcos`.

## Si algo falla

Una captura con un barco detrás de un sólido, pisando boya/pecio/punta, un solape entre carriles, o un instante sin barco yendo o sin barco volviendo: no se arregla a ojo. Se documenta (`ms` simulado, barco, posición) en la sección "Defectos encontrados" y en el PR. Se corrige en código solo si la causa es local y verificable con `sea-anim.test.ts` (vértice movido ≤ 2 u); si no, issue de seguimiento (ver Global Constraints) y se sigue.

## Assumptions

- **Imágenes en la descripción del PR** (stage 8): con URL absoluta `https://github.com/nicolas-ricc/nicolas-ricc.github.io/blob/<rama>/docs/superpowers/specs/assets/85-barcos/<archivo>?raw=true` de la rama del PR, que ya está empujada cuando se crea el PR. Alternativa rechazada: rutas relativas, que no se ven en la descripción.
- **`despues-recorrido.png` se compone con `DT` = 6 000 ms** (7,2 u por cuadro, 200 cuadros) en vez de los 15 000 ms del "antes" (18 u por cuadro, 170 cuadros): trazas más continuas por el mismo costo. Las dos cubren más de un ciclo.
- **Capturas con `agent-browser screenshot` después de `__adv(0)`**, con el ticker detenido. Si sale negra, se exporta con `toDataURL` en la misma tarea del render (Task 4, Step 2).

- **Agenda de capturas con los tres barcos a pleno y margen ≥ 55 s** en vez de la primera agenda (separación 200 s, con barcos en pleno fade a 2,4 s de cambiar de estado). La cota del reloj inicial (≤ segundos reales desde la carga) podía invertir la clasificación de un barco cerca del borde. Alternativa rechazada: medir el reloj inicial exacto (no está expuesto: `createSeaAnim` no se publica).
- **`despues-cover-1.png` hace de captura "un barco de cada tipo"**, sin un archivo aparte, porque en las seis capturas se ven los tres tipos a pleno. Alternativa rechazada: un `despues-cover-tipos.png` redundante.
- **Gancho del ticker parcheando `Ticker.prototype.update`**, el método A ya probado en #86 (sección "Método del time-lapse" del documento del inventario), en vez de buscar el ticker por `__PIXI_DEVTOOLS_WRAPPER__`, que no expone el ticker de la `Application`.
- **El test lee las filas de capturas solo dentro de `### Capturas instantáneas`**, y la ausencia de "pendiente" se comprueba sobre la línea vieja exacta y sobre `**Estado:**`, no sobre toda la sección: así un defecto derivado o las otras tablas no rompen el test por casualidad.

## Grilling

- Rondas: 2 (griller `fable`). Preguntas: 17 + 16 = 33.
- Fuentes de las respuestas: CODE 21, DOC 6 (CLAUDE.md, documento del inventario de #86), ISSUE 4, NO SOURCE 2 (supuestos técnicos de abajo).
- Respuestas clave:
  - `stage.tick(d)` pasa `d` sin tope: `src/lab/page.ts:76` (`stage.tick(ticker.deltaMS * speed)`, `ticker` es el parámetro del callback); `src/world/stage.ts:155-156` (reparte `dtMs` a los animadores); `src/scenes/sea-animator.ts:25` (`anim.tick(dtMs)`); `src/scenes/sea-anim.ts`, `tick`: `cycle[k] = (cycle[k] + dtMs) % CYCLE_MS; states[k] = shipStateAt(cycle[k])`, sin tope y cruzando cualquier cantidad de estados (cubierto por `sea-anim.test.ts:183` y `:231`, "un dt grande cruza estados").
  - El barco k en t es `shipStateAt((SHIPS[k].phase·CYCLE_MS + t) % CYCLE_MS)`: `sea-anim.ts`, `createSeaAnim`: `const cycle = SHIPS.map((s) => s.phase * CYCLE_MS)` más el `tick`. `SHIPS` = `cargo` 0, `tug` ⅓, `barge` ⅔, en ese orden. `CYCLE_MS`, `SHIPS`, `alphaAt`, `shipStateAt`, `laneAt` están exportados.
  - `alphaAt` = `Math.max(0, Math.min(1, dist/FADE_U, (L − dist)/FADE_U))` da exactamente 1 a pleno, y es el alpha que usa el frame del barco (`shipFrame`).
  - `maxFPS = 30`: `src/lab/page.ts:42`, así que `_minElapsedMS` ≠ 0. El render de `Application` se registra con `UPDATE_PRIORITY.LOW` (`node_modules/pixi.js/lib/app/TickerPlugin.mjs:28`), y el listener de `page.ts` (prioridad normal) queda antes: `_head.next`. El gancho lo comprueba con el código fuente del listener.
  - `fit()` solo corre en `keydown` y en `resize` del renderer: `src/lab/page.ts:61-66`, y es inmediato.
  - `base: "/"`: `vite.config.ts:4`. `CLAUDE.md` está desactualizado (`/map/`); #86 lo documentó en "Método del time-lapse". Su corrección queda fuera de alcance → #101 (duplicado de #99).
  - "Un barco de cada tipo": ISSUE: "y una del cover con un barco de cada tipo (`cargo`, `tug`, `barge`) a la vista si el reloj lo permite".
  - Cuatro capturas comparativas: ISSUE: "junto con `antes-cover.png`/`despues-cover-1.png` y `antes-recorrido.png`/`despues-recorrido.png`".
  - Los helpers `doc()`, `pngSize()`, `ASSETS` y la aserción `pendiente: lo completa el hijo de verificación de #85`: `scripts/barcos-inventario.test.ts`. Los conteos "antes" (containers/graphics/sprites/filters/instrucciones/renderTime) están en la tabla "Conteos por frame" del documento del inventario. `.superpowers/` está en `.gitignore`.
  - Validación de vértices: comentario de `LANE_OUT` en `sea-anim.ts` ("No mover vértices más de 2 u sin revalidar") y `sea-anim.test.ts:116` ("separación: dos cargueros, uno en cada carril, nunca se tocan en pantalla").
- Supuestos técnicos: los de "Assumptions" (agenda, captura de tipos, gancho, filas del test, imágenes del PR, `DT`, capturas con el ticker detenido).
- Ambigüedades de spec: ninguna.
- Issues abiertas: #101 (CLAUDE.md dice base `/map/` y `vite.config.ts` fija `/`), cerrada después como duplicado de #99, que ya lo registraba.
- Estado: ok.
