# Stage: modos de bloom (off / on / fallback) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El `Stage` del mundo aprende tres modos de bloom sobre la capa de acentos (`off`, `on`, `fallback`) y el lab de mundo los fuerza por URL (`?bloom=`) o los rota con la tecla `6`.

**Architecture:** `frame.ts` gana un estilo de halo parametrizable para `drawAccents`. `stage.ts` construye perezosamente, en el primer `setBloom("on")`, un `bloomSlot` aditivo con `BlurFilter` justo debajo de `accentSlot`, con una `Graphics` espejo por cada `Graphics` de acentos que comparte su `GraphicsContext` (sigue los redibujos sin CPU extra). `fallback` no usa filtro: redibuja todos los acentos con un halo más grande. El lab lee `?bloom=` y aplica el modo después del primer dibujo.

**Tech Stack:** TypeScript, Pixi 8.20.1 (`Graphics`, `Container`, `BlurFilter` del core; sin `pixi-filters`), Vitest en `node`, Vite.

**Spec:** issue #17 (hijo de la historia #11, rama base `feature/11-cyberpunk-neon`).

## Global Constraints

- No se agrega `pixi-filters` ni ninguna dependencia nueva.
- `buildStage` deja `bloom === "off"` y no crea `bloomSlot` ni filtros sobre los acentos: el primer dibujo no cambia ni en trabajo ni en capas.
- `bloomSlot` va **justo debajo** de `accentSlot` (encima de los velos); `blendMode = "add"`; `filters = [new BlurFilter(BLOOM_FILTER)]`.
- Parámetros iniciales `BLOOM_FILTER = { strength: 6, quality: 2, resolution: 0.5, blendMode: "add" }`, exportado desde `stage.ts` y pasado **por referencia** a `new BlurFilter(BLOOM_FILTER)`: cualquier ajuste (incluido `padding`) se hace editando `BLOOM_FILTER`, no esparciéndolo. Los finales se anotan en el PR. (`blendMode: "add"` en el filtro: la última pasada del `BlurFilter` compone con `this.blendMode`, que por defecto es `"normal"`; el `"add"` del `Container` solo llega a sus hijos dentro de la textura del filtro.)
- `HALO_BASE = [{ k: 2.2, alpha: 0.18 }]`, `HALO_FALLBACK = [{ k: 2.2, alpha: 0.18 }, { k: 4.5, alpha: 0.1 }]`. `off` y `on` usan `HALO_BASE`.
- Transiciones `off → on`, `on → off`, `on → fallback`, `off → fallback`, `fallback → off`; `setBloom(modo actual)` no hace nada.
- Logs del lab solo bajo `import.meta.env.DEV`, con prefijo `[lab] `.
- `src/iso` y `src/scenes` siguen sin importar `pixi.js` (guard `pixi-free`); ningún color hex fuera del atlas (guard de paleta); nada del lab entra al build (`lab-excluded`).
- Estilo del repo: comentarios y mensajes en castellano, líneas compactas, sin banners.

## Review Focus

1. `?bloom=` con un valor inválido (`?bloom=foo`, `?bloom=`) → se ignora, el lab queda en `off`, sin excepción. Test en Task 3 (`bloomFromSearch`).
2. `setBloom("on")` repetido o `on → off → on` → un único `bloomSlot` en el contenedor, reutilizado (no se reconstruye ni se duplican espejos). Test en Task 2.
3. Una capa de acentos animada que se redibuja **estando** en `fallback` → usa `HALO_FALLBACK`, no vuelve al halo base. Test en Task 2.
4. Cambio de foco con bloom activo → cada espejo copia el alpha de su original tras `tick` (si no, el bloom de una zona velada brilla a pleno). Test en Task 2.
5. Acentos `poly` → el halo no los toca (solo los `dot` llevan halo). Test en Task 1.

---

### Task 1: Halo parametrizable en `drawAccents`

**Files:**
- Modify: `src/world/frame.ts` (función `drawAccents`, al final del archivo)
- Test: `src/world/frame.test.ts` (agregar un `describe`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `export type HaloStyle = readonly { k: number; alpha: number }[]`
  - `export const HALO_BASE: HaloStyle` = `[{ k: 2.2, alpha: 0.18 }]`
  - `export const HALO_FALLBACK: HaloStyle` = `[{ k: 2.2, alpha: 0.18 }, { k: 4.5, alpha: 0.1 }]`
  - `export function drawAccents(g: Graphics, accents: Accent[], halo: HaloStyle = HALO_BASE): void`

- [ ] **Step 1: Write the failing test** — en `src/world/frame.test.ts` (Graphics se instancia en node; `g.context.instructions` lista las órdenes de relleno):

```ts
import { Graphics } from "pixi.js";
import { HALO_BASE, HALO_FALLBACK, drawAccents } from "./frame";
import { v3 } from "../iso/geometry";
import type { Accent } from "../iso/accent";

describe("halo de los acentos", () => {
  const dot: Accent = { kind: "dot", at: v3(0, 0, 0), r: 1, color: "cyan" };
  const poly: Accent = { kind: "poly", pts: [v3(0, 0, 0), v3(1, 0, 0), v3(1, 1, 0)], color: "magenta" };
  const fills = (accents: Accent[], halo?: typeof HALO_BASE): number => { const g = new Graphics(); drawAccents(g, accents, halo); return g.context.instructions.length; };

  it("el fallback suma un disco más grande y más tenue que el base", () => {
    expect(HALO_FALLBACK.length).toBeGreaterThan(HALO_BASE.length);
    const maxK = (h: typeof HALO_BASE) => Math.max(...h.map((d) => d.k));
    const big = HALO_FALLBACK.find((d) => d.k === maxK(HALO_FALLBACK))!;
    expect(big.k).toBeGreaterThan(maxK(HALO_BASE));
    expect(big.alpha).toBeLessThan(Math.min(...HALO_BASE.map((d) => d.alpha)));
  });
  it("por defecto dibuja el halo de hoy: un disco más el punto", () => {
    expect(fills([dot])).toBe(2);
    expect(fills([dot], HALO_BASE)).toBe(2);
  });
  it("cada disco del halo es un relleno más por dot", () => {
    expect(fills([dot], HALO_FALLBACK)).toBe(HALO_FALLBACK.length + 1);
  });
  it("los poly no llevan halo", () => {
    expect(fills([poly], HALO_FALLBACK)).toBe(1);
  });
});
```

(Ajustar los imports al encabezado existente del archivo de test; `describe/it/expect` ya vienen de `vitest`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/frame.test.ts`
Expected: FAIL — `HALO_BASE` / `HALO_FALLBACK` no exportados.

- [ ] **Step 3: Write minimal implementation** — reemplazar `drawAccents` en `src/world/frame.ts`:

```ts
/** Discos translúcidos alrededor de cada luz `dot`: radio `r × k`, alpha propia. */
export type HaloStyle = readonly { k: number; alpha: number }[];

export const HALO_BASE: HaloStyle = [{ k: 2.2, alpha: 0.18 }];
/** Sin filtro de bloom: un segundo disco más grande y más tenue hace de resplandor barato. */
export const HALO_FALLBACK: HaloStyle = [{ k: 2.2, alpha: 0.18 }, { k: 4.5, alpha: 0.1 }];

export function drawAccents(g: Graphics, accents: Accent[], halo: HaloStyle = HALO_BASE): void {
  g.clear();
  for (const a of accents) {
    const it = accentItem(a);
    if (it.kind === "dot") {
      for (const h of halo) g.circle(it.x, it.y, it.r * h.k).fill({ color: it.color, alpha: h.alpha });
      g.circle(it.x, it.y, it.r).fill(it.color);
    } else {
      g.poly(it.pts, true).fill({ color: it.color, alpha: it.alpha });
    }
  }
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/world/frame.test.ts` → PASS; `npm run typecheck` → limpio.

- [ ] **Step 5: Commit** — `git add src/world/frame.ts src/world/frame.test.ts && git commit -m "feat(#17): halo parametrizable en drawAccents"`

---

### Task 2: Modos de bloom en el `Stage`

**Files:**
- Modify: `src/world/stage.ts`
- Create: `src/world/stage.test.ts`

**Interfaces:**
- Consumes (Task 1): `HaloStyle`, `HALO_BASE`, `HALO_FALLBACK`, `drawAccents(g, accents, halo)` de `./frame`.
- Produces:
  - `export type BloomMode = "off" | "on" | "fallback"`
  - `export const BLOOM_FILTER: BlurFilterOptions = { strength: 6, quality: 2, resolution: 0.5, blendMode: "add" }` (se pasa tal cual a `new BlurFilter(BLOOM_FILTER)`)
  - `export function nextHalo(mode: BloomMode): HaloStyle` → `HALO_FALLBACK` en `fallback`, `HALO_BASE` en el resto
  - `Stage` gana `readonly bloom: BloomMode` (getter) y `setBloom(mode: BloomMode): void`

**Diseño:**
- Guardar los acentos estáticos de cada zona junto a su `Graphics` para poder redibujarlos: `AccentGraphics` gana `draw: () => void` (estáticos: `() => drawAccents(g, byZone[z], halo)`; animados: el mismo closure de `redraw` de la capa). El closure lee una variable `let halo: HaloStyle = HALO_BASE` del `Stage`, así los redibujos de los animadores usan el halo vigente.
- `let bloomSlot: Container | null = null`; los espejos viven solo en `e.mirror` (fuente de verdad para `applyAlphas`). En el primer `setBloom("on")`: `bloomSlot = new Container(); bloomSlot.blendMode = "add"; bloomSlot.filters = [new BlurFilter(BLOOM_FILTER)];` y por cada entrada de `accents` un `new Graphics({ context: e.g.context })` con `blendMode = "add"`, agregado a `bloomSlot`, y guardado como `e.mirror`. Luego `container.addChildAt(bloomSlot, container.getChildIndex(accentSlot))`. Llamadas siguientes a `on` reinsertan el mismo `bloomSlot`. `buildBloomSlot()` asigna `bloomSlot` y lo devuelve. Transiciones no listadas en la issue (`fallback → on`) usan el mismo camino genérico.
- `off`/`fallback`: `bloomSlot?.removeFromParent()`.
- Si `nextHalo(mode) !== halo`: actualizar `halo` y llamar `e.draw()` para todas las entradas.
- `applyAlphas`: además de `e.g.alpha = …`, `if (e.mirror) e.mirror.alpha = e.g.alpha`. Llamar `applyAlphas()` al final de `setBloom` para que los espejos nazcan con el alpha correcto.
- `setBloom(modo actual)` retorna sin hacer nada.
- Actualizar el doc-comment de `buildStage` para mencionar el `bloomSlot` perezoso.

- [ ] **Step 1: Write the failing test** — `src/world/stage.test.ts`. Los filtros de Pixi (`AlphaFilter`, `BlurFilter`) compilan shaders y no se instancian en node; se reemplazan por un stub que guarda sus opciones. `Graphics`/`Container` son los reales.

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("pixi.js")>();
  // los filtros reales compilan shaders WebGL: en node solo importa que existan y con qué opciones
  class StubFilter { constructor(readonly options?: unknown) {} }
  return { ...real, AlphaFilter: StubFilter, BlurFilter: StubFilter };
});

import { Container, Graphics } from "pixi.js";
import { assembleWorld } from "./assemble";
import { HALO_BASE, HALO_FALLBACK } from "./frame";
import { BLOOM_FILTER, buildStage, nextHalo } from "./stage";

const build = (reducedMotion = true) => { const { scene, animators } = assembleWorld(undefined, { reducedMotion }); return buildStage(scene, animators); };
const kids = (c: Container) => c.children;
const accentSlotOf = (c: Container) => kids(c)[kids(c).length - 1] as Container;
const bloomSlotOf = (c: Container) => kids(c).find((k) => k.filters && (k.filters as unknown[]).some((f) => (f as { options?: unknown }).options === BLOOM_FILTER)) as Container | undefined;

describe("nextHalo", () => {
  it("fallback usa el halo grande; off y on el de hoy", () => {
    expect(nextHalo("fallback")).toBe(HALO_FALLBACK);
    expect(nextHalo("off")).toBe(HALO_BASE);
    expect(nextHalo("on")).toBe(HALO_BASE);
  });
});

describe("modos de bloom del Stage", () => {
  it("buildStage arranca en off, sin bloomSlot ni filtros sobre los acentos", () => {
    const s = build();
    expect(s.bloom).toBe("off");
    expect(kids(s.container)).toHaveLength(9);
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(accentSlotOf(s.container).filters ?? []).toHaveLength(0);
  });

  it("on agrega un bloomSlot con filtro justo debajo de accentSlot, con un espejo por Graphics de acentos", () => {
    const s = build();
    const accentSlot = accentSlotOf(s.container);
    s.setBloom("on");
    expect(s.bloom).toBe("on");
    const bloom = bloomSlotOf(s.container)!;
    expect(bloom).toBeDefined();
    expect(kids(s.container).indexOf(bloom)).toBe(kids(s.container).indexOf(accentSlot) - 1);
    expect(bloom.blendMode).toBe("add");
    expect(bloom.children).toHaveLength(accentSlot.children.length);
    bloom.children.forEach((m, i) => expect((m as Graphics).context).toBe((accentSlot.children[i] as Graphics).context));
    expect(accentSlot.filters ?? []).toHaveLength(0);
  });

  it("on → off → on reutiliza un único bloomSlot; on repetido es idempotente", () => {
    const s = build();
    s.setBloom("on");
    const first = bloomSlotOf(s.container);
    s.setBloom("on");
    expect(kids(s.container)).toHaveLength(10);
    s.setBloom("off");
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(kids(s.container)).toHaveLength(9);
    s.setBloom("on");
    expect(bloomSlotOf(s.container)).toBe(first);
    expect(kids(s.container)).toHaveLength(10);
  });

  it("fallback quita el bloomSlot y redibuja los dot con el halo grande; off los devuelve al de hoy", () => {
    const s = build();
    const accentSlot = accentSlotOf(s.container);
    const fills = () => accentSlot.children.reduce((n, g) => n + (g as Graphics).context.instructions.length, 0);
    const base = fills();
    s.setBloom("on");
    s.setBloom("fallback");
    expect(s.bloom).toBe("fallback");
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(fills()).toBeGreaterThan(base);
    s.setBloom("off");
    expect(fills()).toBe(base);
    s.setBloom("fallback"); // off → fallback directo
    expect(fills()).toBeGreaterThan(base);
  });

  it("en fallback, los redibujos de los animadores siguen con el halo grande", () => {
    const sFb = build(false), sOff = build(false);
    sFb.setBloom("fallback");
    for (let i = 0; i < 40; i++) { sFb.tick(100); sOff.tick(100); }
    const fills = (c: Container) => accentSlotOf(c).children.reduce((n, g) => n + (g as Graphics).context.instructions.length, 0);
    // mismos animadores deterministas, mismo reloj: solo cambia el halo
    expect(fills(sFb.container)).toBeGreaterThan(fills(sOff.container));
    sFb.setBloom("off");
    expect(fills(sFb.container)).toBe(fills(sOff.container));
  });

  it("los espejos copian el alpha de su original al cambiar el foco", () => {
    const s = build();
    s.setBloom("on");
    s.setFocus("blog");
    for (let i = 0; i < 20; i++) s.tick(100);
    const accentSlot = accentSlotOf(s.container), bloom = bloomSlotOf(s.container)!;
    expect(accentSlot.children.some((g) => g.alpha < 1)).toBe(true);
    bloom.children.forEach((m, i) => expect(m.alpha).toBeCloseTo(accentSlot.children[i]!.alpha));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/world/stage.test.ts`
Expected: FAIL — `BLOOM_FILTER`/`nextHalo` no exportados, `setBloom` no existe.

- [ ] **Step 3: Write minimal implementation** en `src/world/stage.ts` siguiendo el **Diseño** de arriba. Esqueleto de las piezas nuevas:

```ts
import { AlphaFilter, BlurFilter, type BlurFilterOptions, Container, Graphics } from "pixi.js";
import { HALO_BASE, HALO_FALLBACK, drawAccents, drawLayer, type HaloStyle } from "./frame";

export type BloomMode = "off" | "on" | "fallback";

/** Parámetros del BlurFilter del bloom; el lab los imprime. */
export const BLOOM_FILTER: BlurFilterOptions = { strength: 6, quality: 2, resolution: 0.5, blendMode: "add" };

/** `fallback` no tiene filtro: compensa con un halo más grande en cada luz. */
export function nextHalo(mode: BloomMode): HaloStyle {
  return mode === "fallback" ? HALO_FALLBACK : HALO_BASE;
}

export interface Stage {
  container: Container;
  staticCount: number;
  readonly bloom: BloomMode;
  setFocus(zone: WorldZone | null): void;
  setBloom(mode: BloomMode): void;
  tick(dtMs: number): void;
}

interface AccentGraphics { g: Graphics; zone: WorldZone | null; base: number; draw: () => void; mirror?: Graphics }
```

y en el objeto devuelto:

```ts
    get bloom() { return bloom; },
    setBloom(mode) {
      if (mode === bloom) return;
      // el slot se arma antes de cambiar el modo: si el filtro fallara, el Stage sigue en el modo anterior
      if (mode === "on") container.addChildAt(bloomSlot ?? buildBloomSlot(), container.getChildIndex(accentSlot));
      else bloomSlot?.removeFromParent();
      bloom = mode;
      const h = nextHalo(mode);
      if (h !== halo) { halo = h; for (const e of accents) e.draw(); }
      applyAlphas();
    },
```

- [ ] **Step 4: Run tests** — `npx vitest run src/world` → PASS; `npm test` → todo verde; `npm run typecheck` → limpio.

- [ ] **Step 5: Commit** — `git add src/world/stage.ts src/world/stage.test.ts && git commit -m "feat(#17): modos de bloom off/on/fallback en el Stage"`

---

### Task 3: Lab — `?bloom=` y tecla `6`

**Files:**
- Modify: `src/lab/page.ts`
- Create: `src/lab/page.test.ts`
- Modify: `lab/world.html` (aria-label: mencionar la tecla 6)
- Modify: `README.md` (sección "Mundo isométrico": `?bloom=` y tecla `6`)

**Interfaces:**
- Consumes (Task 2): `BloomMode`, `Stage.bloom`, `Stage.setBloom` de `../world/stage`.
- Produces (en `src/lab/page.ts`):
  - `export function bloomFromSearch(search: string): BloomMode | null` — `"on"|"off"|"fallback"` de `?bloom=`; cualquier otro valor o ausencia → `null`.
  - `export function nextBloomMode(mode: BloomMode): BloomMode` — `off → on → fallback → off`.

- [ ] **Step 1: Write the failing test** — `src/lab/page.test.ts` (importar `page.ts` en node es seguro: solo toca `document` al llamar `bootWorldPage`):

```ts
import { describe, expect, it } from "vitest";
import { bloomFromSearch, nextBloomMode } from "./page";

describe("bloom en el lab", () => {
  it("?bloom= acepta los tres modos", () => {
    expect(bloomFromSearch("?bloom=on")).toBe("on");
    expect(bloomFromSearch("?speed=0.1&bloom=fallback")).toBe("fallback");
    expect(bloomFromSearch("?bloom=off")).toBe("off");
  });
  it("sin parámetro o con un valor desconocido no fuerza nada", () => {
    expect(bloomFromSearch("")).toBeNull();
    expect(bloomFromSearch("?bloom=")).toBeNull();
    expect(bloomFromSearch("?bloom=ON")).toBeNull();
    expect(bloomFromSearch("?bloom=foo")).toBeNull();
  });
  it("la tecla 6 rota off → on → fallback → off", () => {
    expect(nextBloomMode("off")).toBe("on");
    expect(nextBloomMode("on")).toBe("fallback");
    expect(nextBloomMode("fallback")).toBe("off");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/lab/page.test.ts` → FAIL (no exportados).

- [ ] **Step 3: Write minimal implementation** en `src/lab/page.ts`:

```ts
import { type BloomMode, buildStage } from "../world/stage";

const BLOOM_CYCLE: readonly BloomMode[] = ["off", "on", "fallback"];

/** `?bloom=on|off|fallback` fuerza el modo de bloom; cualquier otro valor no fuerza nada. */
export function bloomFromSearch(search: string): BloomMode | null {
  const v = new URLSearchParams(search).get("bloom");
  return BLOOM_CYCLE.find((m) => m === v) ?? null;
}

export function nextBloomMode(mode: BloomMode): BloomMode {
  return BLOOM_CYCLE[(BLOOM_CYCLE.indexOf(mode) + 1) % BLOOM_CYCLE.length]!;
}
```

En `boot()`, después del log de `primer dibujo`:

```ts
    // ?bloom= se aplica después del primer dibujo, para no cambiar su medida
    const forced = bloomFromSearch(location.search);
    if (forced) requestAnimationFrame(() => { stage.setBloom(forced); if (log) console.info(`[lab] bloom forzado por URL: ${forced}`); });
```

En el handler de `keydown`:

```ts
      if (e.key === "6") { stage.setBloom(nextBloomMode(stage.bloom)); if (log) console.info(`[lab] bloom: ${stage.bloom}`); }
```

Actualizar el doc-comment de `bootWorldPage` (tecla 6, `?bloom=`), el `aria-label` de `lab/world.html` ("Tecla 6 rota el bloom: off, on, fallback.") y el párrafo del lab en `README.md` (después de la tecla `5`: "`6` rota el bloom de las luces entre `off`, `on` y `fallback`; `?bloom=on|off|fallback` lo fuerza al cargar.").

- [ ] **Step 4: Run tests** — `npm test` → verde (incluye `lab-excluded`); `npm run typecheck` → limpio.

- [ ] **Step 5: Commit** — `git add src/lab/page.ts src/lab/page.test.ts lab/world.html README.md && git commit -m "feat(#17): lab ?bloom= y tecla 6"`

---

### Task 4: Revisión visual, ajuste del filtro y medidas (controlador, en el headless)

**Files:**
- Modify (si el ajuste lo pide): `src/world/stage.ts` (`BLOOM_FILTER`, `padding`/`filterArea`)
- Create: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/bloom-{off,on,fallback}-{cv,blog}.png`

**Interfaces:** consume todo lo anterior; no produce API.

- [ ] **Step 1:** `npm run dev -- --host --port 5173`; con `agent-browser` (viewport 1600×900, DPR 2) abrir `/lab/world.html?bloom=on`, `?bloom=fallback`, `?bloom=off`; en cada uno, tecla `2` (Resume) y tecla `3` (Blog), captura.
- [ ] **Step 2:** verificar en consola: `[lab] bloom forzado por URL: <modo>`; con `on`, halo difuso alrededor de las luces y puntos nítidos; con `fallback`, discos más grandes y ningún filtro sobre acentos; con `off`, igual que `main`. Tecla `6` rota y loguea.
- [ ] **Step 3:** si el blur se ve recortado en los bordes, ajustar `padding` del filtro; si se lee como desenfoque de escena en vez de halo, ajustar `strength`/`quality`. Anotar valores finales.
- [ ] **Step 4:** medir `primer dibujo` (segunda carga) y `peor redibujo en 5 s` (5 lecturas) en `/lab/world.html` y `/lab/world.html?bloom=on`, y lo mismo en la base (`origin/feature/11-cyberpunk-neon`) para la comparación de `off`.
- [ ] **Step 5:** commit de capturas `docs(#17): capturas de los modos de bloom`; números y parámetros finales van al PR.

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas acá (van al PR):

1. **`blendMode: "add"` también en el `BlurFilter`**, no solo en el `bloomSlot`. La última pasada del blur compone con el `blendMode` del filtro (`node_modules/pixi.js/lib/filters/defaults/blur/BlurFilter.mjs`, `apply`: `this.blurYFilter.blendMode = this.blendMode`), y su valor por defecto es `"normal"` (`lib/filters/Filter.mjs:81`). Se descartó dejar solo el `"add"` del contenedor, porque ese modo solo afecta cómo se dibujan los espejos dentro de la textura del filtro.
2. **El `bloomSlot` se arma antes de cambiar `bloom`.** Si `new BlurFilter` fallara, el `Stage` queda en el modo anterior y un `setBloom("on")` posterior lo reintenta. Se descartó asignar primero, que dejaba `bloom === "on"` sin slot.
3. **`fallback → on` pasa por el mismo camino genérico** aunque la issue no lo lista. La rotación de la tecla 6 no lo alcanza, pero no hay razón para prohibirlo.
4. **`?bloom=` se aplica en un `requestAnimationFrame`.** Si alguien aprieta `6` antes de ese frame, el modo de la URL gana. Se descartó bloquear la tecla: es una herramienta de revisión del lab.
5. **Test de `stage.ts` con `vi.mock` de `AlphaFilter`/`BlurFilter`** (stub que guarda sus opciones), con `Graphics`/`Container` reales. Comprobado en esta sesión: con los filtros reales `buildStage` falla en node (`GlProgram`); con el stub, `buildStage` + `tick` corren. El setter de `filters` solo guarda el arreglo (`lib/scene/container/container-mixins/effectsMixin.mjs:59-73`). Se descartó cubrir solo lo puro, la alternativa mínima que admite la issue.
6. **Sin `destroy` del `bloomSlot` al quitarlo.** `Stage` no tiene `destroy` hoy (`src/world/stage.ts:12-17`) y el slot se reutiliza en el siguiente `on`.

## Grilling

- Rondas: 1 (las revisiones no agregaron ni quitaron tareas ni movieron la costura).
- Preguntas: 18.
- Fuentes: ISSUE 4 (Q2, Q8, Q11 junto con el código, Q15), CODE 12 (Q1, Q3, Q4, Q5, Q6, Q7, Q11, Q13, Q16, Q17, Q18, más la verificación de Q10), NO SOURCE → supuesto técnico 5 (Q7 la parte del blend, Q9, Q12, Q14, Q10). Ambigüedades de spec: 0. Fuera de alcance: 0.
- Supuestos: los 6 de arriba.
- Issues abiertas: ninguna.
