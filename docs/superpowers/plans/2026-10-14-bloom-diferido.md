# Bloom diferido con medición de presupuesto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El bloom de las luces se activa solo, en una tarea diferida después del primer dibujo, en el sitio y en el lab; se mide durante 60 frames y, si el promedio de tick + render supera 15 ms, cae al fallback. Se toman las medidas y capturas finales y se cierra la spec de la historia #11.

**Architecture:** `src/world/bloom.ts` es puro (sin Pixi): acumulador de muestras con veredicto, formato del log y `scheduleIdle`. `src/world/bloom-runtime.ts` cablea Pixi: `attachBloom` activa `on`, se cuelga de los runners `prerender`/`postrender` del renderer para medir el render de cada frame, recibe el `tick` de cada frame del llamador a través del objeto que devuelve (`probe.tick(ms)`: el llamador ya mide `stage.tick`, así no se envuelve ni se parchea el `Stage`) y al completar 60 frames aplica el veredicto, loguea y se descuelga. `main.ts` y `page.ts` lo programan con `scheduleIdle` tras su primer render.

**Tech Stack:** TypeScript, Pixi 8.20.1 (`SystemRunner` de `app.renderer.runners`), Vitest en `node`, Vite, `agent-browser` (Chrome headless vía CDP) para medidas y capturas.

**Spec:** issue #18 (hijo de la historia #11, rama base `feature/11-cyberpunk-neon`); spec de la historia `docs/superpowers/specs/2026-10-14-cyberpunk-crepusculo-neones-bloom-design.md`.

## Global Constraints

- `BLOOM_BUDGET_MS = 15`, `BLOOM_SAMPLE_FRAMES = 60`. Veredicto `fallback` si `promedio > 15`; `on` si `≤ 15`. Una sola decisión por carga; no se reevalúa.
- Diferido: `requestIdleCallback(fn, { timeout: 1000 })` si existe, si no `setTimeout(fn, 0)`. En el sitio se programa después del primer `render(current, false)`; en el lab, después del primer `fit()`.
- `buildStage` sigue dejando `off`. La línea `primer dibujo` no cambia de definición (mide `assembleWorld` + `buildStage` + `addChild` en el sitio; `buildStage` + `addChild` en el lab).
- Logs solo bajo `import.meta.env.DEV`. Formato exacto: `[mapa] bloom: promedio 12.3 ms en 60 frames (tick 4.1 + render 8.2), presupuesto 15 ms → activo` (o `→ fallback`); en el lab, prefijo `[lab]`. Forzado: `[lab] bloom forzado por URL: <modo>`, sin medir.
- Un decimal en los ms de `formatBloomVerdict`; el presupuesto se imprime tal cual (`15`).
- `deltaMS` no se usa como medida de costo (el sitio limita a 30 fps).
- `src/world/bloom.ts` no importa `pixi.js`. Ninguna dependencia nueva. Ningún color hex fuera del atlas (guard de paleta). Nada del lab entra al build.
- Estilo del repo: comentarios, logs y docs en castellano; líneas compactas; sin banners.

## Review Focus

1. Promedio exactamente igual a 15 ms → `on` (el límite es estricto `>`). Test en Task 1.
2. Muestras después del veredicto → `null`, nunca un segundo veredicto (una decisión por carga). Test en Task 1.
3. Modo cambiado a mano durante la medición en el lab (tecla `6`) → el veredicto se loguea pero no pisa el modo elegido: solo se aplica si `stage.bloom` sigue en `on`. Test en Task 2.
4. Tras el veredicto `attachBloom` se descuelga de los runners: frames posteriores no cuestan nada ni vuelven a llamar a `setBloom`. Test en Task 2.
5. Un frame renderizado sin `tick` registrado (p. ej. un render fuera del ticker) → cuenta `tick = 0`, no arrastra el `tick` del frame anterior. Test en Task 2.

---

### Task 1: `src/world/bloom.ts` — acumulador, formato y `scheduleIdle`

**Files:**
- Create: `src/world/bloom.ts`
- Create: `src/world/bloom.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const BLOOM_BUDGET_MS = 15, BLOOM_SAMPLE_FRAMES = 60;`
  - `export interface BloomSample { tickMs: number; renderMs: number }`
  - `export interface BloomVerdict { frames: number; avgMs: number; avgTickMs: number; avgRenderMs: number; mode: "on" | "fallback" }`
  - `export function createBloomBudget(opts?: { frames?: number; budgetMs?: number }): { sample(s: BloomSample): BloomVerdict | null }`
  - `export function formatBloomVerdict(v: BloomVerdict, budgetMs: number): string`
  - `export function scheduleIdle(fn: () => void): void`

- [ ] **Step 1: Write the failing test** — `src/world/bloom.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { BLOOM_BUDGET_MS, BLOOM_SAMPLE_FRAMES, createBloomBudget, formatBloomVerdict, scheduleIdle, type BloomVerdict } from "./bloom";

const feed = (b: ReturnType<typeof createBloomBudget>, n: number, tickMs: number, renderMs: number) => {
  let v: BloomVerdict | null = null;
  for (let i = 0; i < n; i++) v = b.sample({ tickMs, renderMs });
  return v;
};

describe("createBloomBudget", () => {
  it("presupuesto 15 ms en 60 frames por defecto", () => {
    expect(BLOOM_BUDGET_MS).toBe(15);
    expect(BLOOM_SAMPLE_FRAMES).toBe(60);
  });
  it("devuelve null las primeras 59 muestras y el veredicto en la 60", () => {
    const b = createBloomBudget();
    expect(feed(b, 59, 1, 1)).toBeNull();
    expect(b.sample({ tickMs: 1, renderMs: 1 })).not.toBeNull();
  });
  it("promedia tick, render y su suma", () => {
    const b = createBloomBudget({ frames: 4 });
    b.sample({ tickMs: 1, renderMs: 4 });
    b.sample({ tickMs: 3, renderMs: 6 });
    b.sample({ tickMs: 2, renderMs: 8 });
    expect(b.sample({ tickMs: 2, renderMs: 2 })).toEqual({ frames: 4, avgMs: 7, avgTickMs: 2, avgRenderMs: 5, mode: "on" });
  });
  it("> presupuesto → fallback; = presupuesto → on", () => {
    expect(feed(createBloomBudget(), 60, 5, 10.01)!.mode).toBe("fallback");
    expect(feed(createBloomBudget(), 60, 5, 10)!.mode).toBe("on");
    expect(feed(createBloomBudget({ frames: 2, budgetMs: 4 }), 2, 2, 2.5)!.mode).toBe("fallback");
  });
  it("una sola decisión: después del veredicto devuelve null", () => {
    const b = createBloomBudget({ frames: 2 });
    expect(feed(b, 2, 1, 1)).not.toBeNull();
    expect(feed(b, 5, 1, 1)).toBeNull();
  });
});

describe("formatBloomVerdict", () => {
  it("activo y fallback, un decimal", () => {
    expect(formatBloomVerdict({ frames: 60, avgMs: 12.34, avgTickMs: 4.12, avgRenderMs: 8.22, mode: "on" }, 15))
      .toBe("promedio 12.3 ms en 60 frames (tick 4.1 + render 8.2), presupuesto 15 ms → activo");
    expect(formatBloomVerdict({ frames: 60, avgMs: 31, avgTickMs: 6, avgRenderMs: 25, mode: "fallback" }, 15))
      .toBe("promedio 31.0 ms en 60 frames (tick 6.0 + render 25.0), presupuesto 15 ms → fallback");
  });
});

describe("scheduleIdle", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("usa requestIdleCallback con timeout 1000 si existe", () => {
    const ric = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    const fn = () => {};
    scheduleIdle(fn);
    expect(ric).toHaveBeenCalledWith(fn, { timeout: 1000 });
  });
  it("si no, setTimeout 0: no corre en el acto", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    const fn = vi.fn();
    scheduleIdle(fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/bloom.test.ts`
Expected: FAIL — no existe `./bloom`.

- [ ] **Step 3: Write minimal implementation** — `src/world/bloom.ts`:

```ts
/** Presupuesto del bloom: promedio de tick + render por frame, medido con el bloom activo (#18). */
export const BLOOM_BUDGET_MS = 15, BLOOM_SAMPLE_FRAMES = 60;

export interface BloomSample { tickMs: number; renderMs: number }
export interface BloomVerdict { frames: number; avgMs: number; avgTickMs: number; avgRenderMs: number; mode: "on" | "fallback" }

/** Acumula muestras; devuelve el veredicto al completar `frames`, antes `null`. Después, siempre `null`: una decisión por carga. */
export function createBloomBudget(opts: { frames?: number; budgetMs?: number } = {}): { sample(s: BloomSample): BloomVerdict | null } {
  const frames = opts.frames ?? BLOOM_SAMPLE_FRAMES, budgetMs = opts.budgetMs ?? BLOOM_BUDGET_MS;
  let n = 0, tick = 0, render = 0;
  return {
    sample(s) {
      if (n >= frames) return null;
      n++; tick += s.tickMs; render += s.renderMs;
      if (n < frames) return null;
      const avgTickMs = tick / n, avgRenderMs = render / n, avgMs = avgTickMs + avgRenderMs;
      return { frames: n, avgMs, avgTickMs, avgRenderMs, mode: avgMs > budgetMs ? "fallback" : "on" };
    },
  };
}

/** El texto del log después de "bloom: ". */
export function formatBloomVerdict(v: BloomVerdict, budgetMs: number): string {
  return `promedio ${v.avgMs.toFixed(1)} ms en ${v.frames} frames (tick ${v.avgTickMs.toFixed(1)} + render ${v.avgRenderMs.toFixed(1)}), presupuesto ${budgetMs} ms → ${v.mode === "on" ? "activo" : "fallback"}`;
}

/** Corre `fn` cuando el navegador esté ocioso (a más tardar en 1 s); sin `requestIdleCallback`, en la próxima tarea. */
export function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 1000 });
  else setTimeout(fn, 0);
}
```

(Si TypeScript se queja de `requestIdleCallback` con `lib` sin DOM, el `tsconfig` ya incluye DOM: `main.ts` usa `document`.)

- [ ] **Step 4: Run tests** — `npx vitest run src/world/bloom.test.ts` → PASS; `npm run typecheck` → limpio.

- [ ] **Step 5: Commit** — `git add src/world/bloom.ts src/world/bloom.test.ts && git commit -m "feat(#18): presupuesto del bloom puro (acumulador, formato, scheduleIdle)"`

---

### Task 2: `src/world/bloom-runtime.ts` — `attachBloom`

**Files:**
- Create: `src/world/bloom-runtime.ts`
- Create: `src/world/bloom-runtime.test.ts`

**Interfaces:**
- Consumes (Task 1): `BLOOM_BUDGET_MS`, `createBloomBudget`, `formatBloomVerdict` de `./bloom`. De `./stage`: `type BloomMode`, `type Stage`.
- Produces:
  - `export interface BloomProbe { tick(ms: number): void }` — el llamador le pasa, en cada frame, el tiempo de CPU de `stage.tick` que ya mide.
  - `export function attachBloom(opts: { app: { renderer: { runners: { prerender: SystemRunner; postrender: SystemRunner } } }; stage: Pick<Stage, "bloom" | "setBloom">; log: boolean; prefix: string; force?: BloomMode | null }): BloomProbe`

**Diseño:**
- Con `force` definido (no `null`/`undefined`): `stage.setBloom(force)`; si `log`, `console.info(\`[${prefix}] bloom forzado por URL: ${force}\`)`; devuelve un probe cuyo `tick` no hace nada. No se cuelga de los runners.
- Sin `force`: `stage.setBloom("on")`; crea `createBloomBudget()`; agrega a `app.renderer.runners.prerender` un objeto `{ prerender() { t0 = performance.now(); } }` y a `postrender` uno `{ postrender() { … } }`. En `postrender`: `renderMs = performance.now() - t0`, `tickMs = pendingTick` y `pendingTick = 0` (un render sin tick previo cuenta 0); `const v = budget.sample({ tickMs, renderMs })`; si `v`: quitar ambos objetos de los runners (`remove`), `if (stage.bloom === "on") stage.setBloom(v.mode)` (si se cambió el modo a mano durante la medición, no se pisa), y si `log`: `console.info(\`[${prefix}] bloom: ${formatBloomVerdict(v, BLOOM_BUDGET_MS)}\`)`.
- `probe.tick(ms)`: `pendingTick = ms` (el último `stage.tick` antes del render del mismo frame; el ticker de la `Application` corre los callbacks de prioridad normal antes del render, que es `LOW`).

- [ ] **Step 1: Write the failing test** — `src/world/bloom-runtime.test.ts` (sin `Application`: un `app` falso con `SystemRunner` reales, que es lo que expone `app.renderer.runners`; `performance.now` espiado para controlar el tiempo):

```ts
import { SystemRunner } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachBloom } from "./bloom-runtime";
import type { BloomMode } from "./stage";

const fakeApp = () => ({ renderer: { runners: { prerender: new SystemRunner("prerender"), postrender: new SystemRunner("postrender") } } });
const fakeStage = () => {
  const s = { bloom: "off" as BloomMode, setBloom: vi.fn((m: BloomMode) => { s.bloom = m; }) };
  return s;
};
let now = 0;
/** Un frame: tick (si se pasa) y luego render de `renderMs`. */
const frame = (app: ReturnType<typeof fakeApp>, probe: { tick(ms: number): void }, tickMs: number | null, renderMs: number) => {
  if (tickMs !== null) probe.tick(tickMs);
  app.renderer.runners.prerender.emit();
  now += renderMs;
  app.renderer.runners.postrender.emit();
};

describe("attachBloom", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const setup = () => {
    now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    return { app: fakeApp(), stage: fakeStage(), info };
  };

  it("activa on al adjuntar y queda on si el promedio entra en el presupuesto", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "mapa" });
    expect(stage.bloom).toBe("on");
    for (let i = 0; i < 59; i++) frame(app, probe, 4, 8);
    expect(info).not.toHaveBeenCalled();
    frame(app, probe, 4, 8);
    expect(stage.bloom).toBe("on");
    expect(info).toHaveBeenCalledWith("[mapa] bloom: promedio 12.0 ms en 60 frames (tick 4.0 + render 8.0), presupuesto 15 ms → activo");
  });

  it("pasa a fallback si el promedio supera 15 ms", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "lab" });
    for (let i = 0; i < 60; i++) frame(app, probe, 6, 10);
    expect(stage.setBloom).toHaveBeenLastCalledWith("fallback");
    expect(stage.bloom).toBe("fallback");
    expect(info).toHaveBeenCalledWith("[lab] bloom: promedio 16.0 ms en 60 frames (tick 6.0 + render 10.0), presupuesto 15 ms → fallback");
  });

  it("se descuelga de los runners tras el veredicto: una sola decisión", () => {
    const { app, stage } = setup();
    const probe = attachBloom({ app, stage, log: false, prefix: "mapa" });
    for (let i = 0; i < 60; i++) frame(app, probe, 6, 10);
    expect(app.renderer.runners.prerender.items).toHaveLength(0);
    expect(app.renderer.runners.postrender.items).toHaveLength(0);
    stage.setBloom.mockClear();
    for (let i = 0; i < 120; i++) frame(app, probe, 1, 1);
    expect(stage.setBloom).not.toHaveBeenCalled();
  });

  it("un render sin tick previo cuenta tick 0, no el del frame anterior", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "mapa" });
    for (let i = 0; i < 30; i++) { frame(app, probe, 10, 2); frame(app, probe, null, 2); }
    expect(info).toHaveBeenCalledWith("[mapa] bloom: promedio 7.0 ms en 60 frames (tick 5.0 + render 2.0), presupuesto 15 ms → activo");
  });

  it("si el modo cambió a mano durante la medición, el veredicto no lo pisa", () => {
    const { app, stage } = setup();
    const probe = attachBloom({ app, stage, log: false, prefix: "lab" });
    stage.setBloom("off");
    for (let i = 0; i < 60; i++) frame(app, probe, 20, 20);
    expect(stage.bloom).toBe("off");
  });

  it("sin log no escribe en consola", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: false, prefix: "mapa" });
    for (let i = 0; i < 60; i++) frame(app, probe, 1, 1);
    expect(info).not.toHaveBeenCalled();
  });

  it("forzado: aplica el modo, loguea el forzado y no mide", () => {
    const { app, stage, info } = setup();
    const probe = attachBloom({ app, stage, log: true, prefix: "lab", force: "fallback" });
    expect(stage.setBloom).toHaveBeenCalledExactlyOnceWith("fallback");
    expect(info).toHaveBeenCalledExactlyOnceWith("[lab] bloom forzado por URL: fallback");
    expect(app.renderer.runners.prerender.items).toHaveLength(0);
    for (let i = 0; i < 60; i++) frame(app, probe, 20, 20);
    expect(stage.setBloom).toHaveBeenCalledOnce();
  });
});
```

(Si `SystemRunner.items` no fuese público en los tipos de 8.20.1, comprobar el desenganche con `.empty` o con un `vi.spyOn(runner, "remove")`; `emit` sobre un runner vacío no llama a nada.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/bloom-runtime.test.ts`
Expected: FAIL — no existe `./bloom-runtime`.

- [ ] **Step 3: Write minimal implementation** — `src/world/bloom-runtime.ts`:

```ts
import type { SystemRunner } from "pixi.js";
import { BLOOM_BUDGET_MS, createBloomBudget, formatBloomVerdict } from "./bloom";
import type { BloomMode, Stage } from "./stage";

/** El llamador pasa en cada frame el tiempo de CPU de `stage.tick`, que ya mide para su log. */
export interface BloomProbe { tick(ms: number): void }

interface BloomApp { renderer: { runners: { prerender: SystemRunner; postrender: SystemRunner } } }

/**
 * Activa el bloom y mide 60 frames: tick (lo pasa el llamador) + render (`postrender − prerender`).
 * Si el promedio supera el presupuesto pasa a `fallback`. Con `force` aplica ese modo y no mide.
 */
export function attachBloom(opts: { app: BloomApp; stage: Pick<Stage, "bloom" | "setBloom">; log: boolean; prefix: string; force?: BloomMode | null }): BloomProbe {
  const { app, stage, log, prefix, force } = opts;
  if (force) {
    stage.setBloom(force);
    if (log) console.info(`[${prefix}] bloom forzado por URL: ${force}`);
    return { tick() {} };
  }
  stage.setBloom("on");
  const budget = createBloomBudget();
  const { prerender, postrender } = app.renderer.runners;
  let t0 = 0, pendingTick = 0;
  const pre = { prerender() { t0 = performance.now(); } };
  const post = {
    postrender() {
      const v = budget.sample({ tickMs: pendingTick, renderMs: performance.now() - t0 });
      pendingTick = 0;
      if (!v) return;
      prerender.remove(pre);
      postrender.remove(post);
      // la tecla 6 del lab pudo cambiar el modo durante la medición: no se pisa
      if (stage.bloom === "on") stage.setBloom(v.mode);
      if (log) console.info(`[${prefix}] bloom: ${formatBloomVerdict(v, BLOOM_BUDGET_MS)}`);
    },
  };
  prerender.add(pre);
  postrender.add(post);
  return { tick(ms) { pendingTick = ms; } };
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/world/bloom-runtime.test.ts` → PASS; `npm run typecheck` → limpio (comprobar que `Application` real satisface `BloomApp` al usarlo en Task 3; si no, tipar `app` como `Pick<Application, "renderer">`).

- [ ] **Step 5: Commit** — `git add src/world/bloom-runtime.ts src/world/bloom-runtime.test.ts && git commit -m "feat(#18): attachBloom mide tick + render y decide on o fallback"`

---

### Task 3: Cableado en el sitio y en el lab

**Files:**
- Modify: `src/main.ts` (ticker y final de `boot()`)
- Modify: `src/lab/page.ts` (bloque `?bloom=` y ticker)

**Interfaces:**
- Consumes: `scheduleIdle` de `./world/bloom` (Task 1); `attachBloom`, `type BloomProbe` de `./world/bloom-runtime` (Task 2); `bloomFromSearch` y `nextBloomMode` ya existentes en `page.ts` (se mantienen, con sus tests).
- Produces: nada que importen otros módulos.

- [ ] **Step 1: `src/main.ts`** — importar `scheduleIdle` y `attachBloom`/`BloomProbe`. Reemplazar el callback del ticker por uno que mida `stage.tick` siempre y se lo pase al probe:

```ts
  let worst = 0, since = 0;
  let bloom: BloomProbe | null = null;
  app.ticker.add((ticker) => {
    camera.tick(performance.now());
    const t = performance.now();
    stage.tick(ticker.deltaMS);
    const dt = performance.now() - t;
    bloom?.tick(dt);
    if (log) {
      worst = Math.max(worst, dt);
      since += ticker.deltaMS;
      if (since > 5000) { console.info(`[mapa] peor redibujo en 5 s: ${worst.toFixed(2)} ms`); worst = 0; since = 0; }
    }
  });
```

y al final de `boot()`, justo después de `render(current, false);`:

```ts
  render(current, false);
  // el bloom entra en una tarea diferida: el primer dibujo se sirve sin filtro
  scheduleIdle(() => { bloom = attachBloom({ app, stage, log, prefix: "mapa" }); });
```

(La línea `primer dibujo` y su `t0` no se tocan.)

- [ ] **Step 2: `src/lab/page.ts`** — importar `scheduleIdle` y `attachBloom`/`BloomProbe`. Borrar las dos líneas del `?bloom=` con `requestAnimationFrame` (el comentario y el `if (forced) …`). Después del primer `fit();` agregar:

```ts
    fit();
    // diferido igual que el sitio; ?bloom= fuerza el modo y no mide
    let bloom: BloomProbe | null = null;
    scheduleIdle(() => { bloom = attachBloom({ app, stage, log, prefix: "lab", force: bloomFromSearch(location.search) }); });
```

y en el ticker, tras `const dt = performance.now() - t;`, `bloom?.tick(dt);`. La tecla `6` queda igual. Actualizar el doc-comment de `bootWorldPage`: "`?bloom=on|off|fallback` lo fuerza al cargar; sin parámetro se mide y decide solo".

- [ ] **Step 3: Verificar** — `npm test` → todo verde (incluidos `page.test.ts`, `lab-excluded`, guards); `npm run typecheck` → limpio.

- [ ] **Step 4: Verificar en el navegador** — `npm run dev -- --host --port 5173` y con `agent-browser` abrir `http://localhost:5173/lab/world.html` y `http://localhost:5173/` (la base real la fija `vite.config.ts`): en consola, la línea `primer dibujo` sale antes que `bloom: …`; con `?bloom=fallback` sale `[lab] bloom forzado por URL: fallback` y no sale ninguna línea `bloom: promedio`.

- [ ] **Step 5: Commit** — `git add src/main.ts src/lab/page.ts && git commit -m "feat(#18): bloom diferido y medido en el sitio y en el lab"`

---

### Task 4: Medidas, capturas, spec y README

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-cyberpunk-crepusculo-neones-bloom-design.md` (§3 "Después", §4 checklist + veredicto por criterio, `**Estado:**`)
- Create: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/despues-{mundo,portfolio,resume,blog}.png`, `bloom-forzado-on.png`, `bloom-forzado-fallback.png`
- Modify: `README.md` (sección "Mundo isométrico")

Esta tarea no tiene test automatizado: es evidencia. Headless de siempre: Chrome vía CDP con `agent-browser`, sin GPU, DPR 2, viewport 1600×900, segunda carga.

- [ ] **Step 1: Baseline en esta máquina.** Para que "igual o mejor" compare en la misma máquina: en un worktree de `origin/feature/11-cyberpunk-neon` (estado previo a #18), dev server en otro puerto, medir `primer dibujo` (segunda carga) en `/lab/world.html` y `/`. Anotar junto al "Antes" de la spec.
- [ ] **Step 2: Lab sin parámetro** — en la rama: `primer dibujo` (segunda carga), la línea `[lab] bloom: …` y cinco lecturas de `peor redibujo en 5 s`. Copiar las líneas crudas.
- [ ] **Step 3: Sitio `/`** — lo mismo con prefijo `[mapa]` (pestaña en primer plano, puntero moviéndose cada 2 s, como el baseline).
- [ ] **Step 4: Forzados** — `/lab/world.html?bloom=fallback` y `?bloom=on`: capturas `bloom-forzado-fallback.png` y `bloom-forzado-on.png` (Resume o Blog enfocado con tecla `2`/`3`, donde hay neones), y la línea `[lab] bloom forzado por URL: …`.
- [ ] **Step 5: Capturas "después"** — lab sin parámetro, esperar el veredicto, teclas `0`, `1`, `2`, `3` (más foco con `5` hasta la zona correspondiente para 1..3): `despues-mundo.png`, `despues-portfolio.png`, `despues-resume.png`, `despues-blog.png`. Indicar en la spec el modo que quedó.
- [ ] **Step 6: gzip** — `npm run build` y medir gzip de cada `dist/**/*.js` (`gzip -c f | wc -c`), total y por archivo, junto al "antes" de la spec (179 435 bytes).
- [ ] **Step 7: Spec** — reemplazar "Pendiente: …" de "Después" por números y líneas crudas, con las capturas embebidas; marcar `[x]` cada criterio de §4 que se cumpla y agregar "### Veredicto por criterio (#18, 2026-10-14)" con PASS / NO CUMPLIDO y la evidencia por criterio, como `2026-09-15-reintegracion-mundo-iso-design.md`; `**Estado:** implementada (2026-10-14)`. Agregar la medición del bloom (`attachBloom`, 60 frames, 15 ms) a las decisiones si algo cambió.
- [ ] **Step 8: README** — en "Mundo isométrico", un párrafo: el bloom de las luces se activa solo tras el primer dibujo (sitio y lab), se mide 60 frames y cae a `fallback` si el promedio de tick + render supera 15 ms; en desarrollo lo loguea `bloom: …` (ejemplo de línea); en el lab `?bloom=` lo fuerza sin medir y `6` lo rota. Sumar la spec nueva a la lista de specs.
- [ ] **Step 9: Verificar** — `npm test` y `npm run typecheck` en verde.
- [ ] **Step 10: Commit** — `git add docs README.md && git commit -m "docs(#18): medidas, capturas y cierre de la spec cyberpunk"`

## Assumptions

- **Protocolo de "igual o mejor" en `primer dibujo`** (Task 4). La issue no fija umbral. Se mide la segunda carga, como el baseline de la spec, en la misma máquina antes (worktree de `origin/feature/11-cyberpunk-neon`) y después; si la diferencia cae dentro del ruido (después peor por menos de 5 %), se repiten tres segundas cargas por lado y se comparan medianas. Se anotan todas las lecturas crudas. Alternativa descartada: una sola lectura por lado, frágil ante el ruido del headless sin GPU.
- **Guard del veredicto: "el modo sigue en `on`"** (Task 2, Review Focus 3). Si la tecla `6` del lab cambia el modo durante la medición y vuelve a `on`, el veredicto se aplica igual. Alternativa descartada: una bandera de "cambio manual" en el `Stage`, que agrega estado a una API compartida con el sitio por un caso exclusivo del lab.

## Grilling

- Rondas: 1 (las revisiones no cambiaron pasos ni costuras: solo se agregaron supuestos).
- Preguntas: 18. Fuentes: ISSUE 6 (1, 2, 3, 5, 8, 17), CODE 10 (4, 6, 7, 10, 11, 12, 13, 15, 16, 18), DOC 0, NO SOURCE 2 (9, 14 → supuestos técnicos).
- Respuestas clave: el warm-up cuenta ("Se acumulan **60 frames** desde que el bloom está activo"); `render` es `postrender − prerender` por la issue; la `Application` renderiza cada frame del ticker con `UPDATE_PRIORITY.LOW` (`pixi.js/lib/app/TickerPlugin.mjs:28`) y `ticker.add` usa `NORMAL` por defecto (`Ticker.mjs:187`), así `probe.tick` precede al `prerender` del mismo frame; los runners `prerender`/`postrender` viven en `AbstractRenderer` (común a WebGL y WebGPU, `AbstractRenderer.mjs:101-105`); `bloomFromSearch` devuelve `null` sin parámetro o con valor inválido (`src/lab/page.test.ts:11-14`); un veredicto `fallback` en el headless sin GPU es un resultado válido ("indicar en la spec qué modo quedó").
- Issues abiertas: ninguna.
