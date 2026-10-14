# Neones del distrito tecnológico (Resume) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las torres del distrito tecnológico de Resume tengan una corona de neón cian/magenta que pulsa y cambia de color, y que el mástil de telecomunicaciones tenga un anillo de tres luces magenta que corre; más el helper compartido `src/scenes/neon.ts` que reusan los hijos #14, #15 y #16.

**Architecture:** Helper puro `neon.ts` (`pulse`, `chase`, `flip`). La escena `tech.ts` expone la geometría estática nueva en `TechScene.neon`. El animador puro `tech-anim.ts` gana la capa `neon()` y el cambio `neon`; `tech-animator.ts` la publica como `tech.neon`. No se agregan animadores: la capa vive en el animador de tech, etiquetado `cv` en `assemble.ts`, y hereda el velo.

**Tech Stack:** TypeScript strict, Vitest, pixi.js 8 (solo en `src/world/` y `src/lab/`, no se toca).

**Spec:** issue #13 (cuerpo completo, "Qué hacer" y "Criterios de aceptación comunes"), dentro de la historia #11 (brief del triage y plan del planner en los comentarios de #11).

## Global Constraints

- `src/iso/` y `src/scenes/` no importan `pixi.js` (`src/iso/pixi-free.test.ts`).
- No se agregan colores ni se tocan valores del atlas; ningún literal hex fuera de `src/map/palette-iso.ts` / `palette-base.ts` / `seed.ts` (`src/map/palette-guard.test.ts`).
- Colores de los neones nuevos: solo `cyan*` y `magenta*`. Los acentos estáticos existentes y `signs` (ámbar) no cambian.
- Frame 0 = todo encendido y quieto. Con `reducedMotion: true`, `tick` no reporta nada y las capas devuelven ese estado fijo.
- Toda la aleatoriedad del animador sale del `rng` que recibe. `Math.random` prohibido.
- No agregar animadores (`src/world/assemble.test.ts` cuenta 2 en `cv`); agregar capas al existente.
- API exacta de `neon.ts`:
  - `pulse(clockMs, periodMs, phase = 0): number` = `0.5 + 0.5·cos(2π·(clock/period + phase))`.
  - `chase(n, step, lit): boolean[]`, índice `k` encendido sii `(k − step) mod n < lit` (módulo no negativo).
  - `flip<T>(step, a, b): T`, par → `a`, impar → `b`.
- Constantes: `NEON_STEP_MS = 150`, período de corona `2400` ms, alpha de corona `0.45..1`, cambio de color cada `rng.int(6000, 12000)` ms, anillo paso `200` ms, `r = 0.5`, color `magentaMid`.
- Comentarios y textos de tests en español, como el resto del repo. `npm test` y `npm run typecheck` verdes al final de cada task.

## Review Focus

1. **Frame 0 de coronas y anillo.** `chase(3, 0, 1)` solo enciende una luz y `pulse(0, 2400, k / n)` no vale 1 para `k > 0`, pero el contrato dice frame 0 = estado de reduced motion = alpha 1 y las tres luces encendidas. Decisión: mientras el paso de corona es 0 (clock < 150 ms) todas las coronas van a alpha 1, y mientras el paso del anillo es 0 (clock < 200 ms) las tres luces están encendidas; desde el paso 1 corren `pulse` desfasado y `chase(3, step, 1)`. Test: `neon()` antes de cualquier `tick` es igual a la geometría de la escena con las tres luces; tras `tick(200)` el anillo trae 1.
2. **Torres de dos cuerpos.** La corona va en el cuerpo superior (el mismo sobre el que está el `sign`), no en `Tower.box` (el primer cuerpo). Test: para cada corona existe un prisma `curtain` cuyo tope (`at.z + h`) es el tope de la corona y cuya cara sur está a 0.02 u detrás de la corona.
3. **Cambio de color sin parpadeo.** El cambio `cyan ↔ magenta` persiste (no vuelve en el paso siguiente). Test: tras el primer cambio, el número de coronas magenta difiere en ±1 del inicial y se mantiene en los ticks siguientes hasta el próximo cambio.
4. **Determinismo con ticks de distinto tamaño.** Dos animadores iguales con la misma secuencia de `tick` dan capas `toEqual`. Test en `tech-animator.test.ts`.
5. **Velo.** La capa nueva cae en un animador `zone: "cv"`; `focusAlphas("blog").cv.accents === ACCENT_DIM`. Test en `assemble.test.ts`.

---

## Mapa de archivos

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `src/scenes/neon.ts` | crear | `pulse`, `chase`, `flip` puros |
| `src/scenes/neon.test.ts` | crear | tests del helper |
| `src/scenes/tech.ts` | modificar | `TechScene.neon: { crowns: Accent[]; mastRing: Vec3[] }` |
| `src/scenes/tech.test.ts` | modificar | geometría de coronas y anillo |
| `src/scenes/tech-anim.ts` | modificar | capa `neon()`, cambio `neon`, `NEON_STEP_MS` |
| `src/scenes/tech-anim.test.ts` | modificar | animación de neones; reduced motion con `neon: false` |
| `src/scenes/tech-animator.ts` | modificar | id `tech.neon` |
| `src/scenes/tech-animator.test.ts` | modificar | ids exactos, cambio tras avanzar, determinismo |
| `src/world/assemble.test.ts` | modificar | `tech.neon` en un animador `cv`, velo |
| `docs/superpowers/specs/assets/2026-10-14-cyberpunk/` | crear | captura del lab con Resume enfocado |

---

### Task 1: helper `neon.ts`

**Files:**
- Create: `src/scenes/neon.ts`
- Test: `src/scenes/neon.test.ts`

**Interfaces:**
- Produces: `pulse(clockMs: number, periodMs: number, phase?: number): number`, `chase(n: number, step: number, lit: number): boolean[]`, `flip<T>(step: number, a: T, b: T): T`.

- [ ] **Step 1: test que falla**

```ts
import { describe, expect, it } from "vitest";
import { chase, flip, pulse } from "./neon";

describe("neon", () => {
  it("pulse vale 1 en fase 0, 0 a medio período y respeta la fase", () => {
    expect(pulse(0, 2400)).toBeCloseTo(1);
    expect(pulse(1200, 2400)).toBeCloseTo(0);
    expect(pulse(0, 2400, 0.5)).toBeCloseTo(0);
    expect(pulse(2400, 2400)).toBeCloseTo(1);
  });
  it("chase enciende `lit` luces y avanza un lugar por paso, también con pasos grandes", () => {
    expect(chase(3, 0, 1)).toEqual([true, false, false]);
    expect(chase(3, 1, 1)).toEqual([false, true, false]);
    expect(chase(3, 4, 1)).toEqual([false, true, false]);
    expect(chase(5, 2, 2)).toEqual([false, false, true, true, false]);
    for (let s = 0; s < 10; s++) expect(chase(4, s, 2).filter(Boolean)).toHaveLength(2);
    expect(chase(3, 7, 1)).toEqual(chase(3, 7, 1));
  });
  it("flip alterna: par → a, impar → b", () => {
    expect(flip(0, "cyan", "magenta")).toBe("cyan");
    expect(flip(1, "cyan", "magenta")).toBe("magenta");
    expect(flip(2, "cyan", "magenta")).toBe("cyan");
  });
});
```

- [ ] **Step 2:** `npx vitest run src/scenes/neon.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: implementación**

```ts
/**
 * Primitivas puras de los neones animados, compartidas por las escenas: un
 * pulso de intensidad, un chase de luces corredizas y un cambio de color por
 * paso. Sin estado: todo deriva del reloj o del paso que pasa el animador.
 */

/** Pulso 0..1 cuantizado: 1 en fase 0 (frame 0 encendido). */
export function pulse(clockMs: number, periodMs: number, phase = 0): number {
  return 0.5 + 0.5 * Math.cos(2 * Math.PI * (clockMs / periodMs + phase));
}

/** Qué índices de n están encendidos en un chase de `lit` luces que avanza un lugar por paso. */
export function chase(n: number, step: number, lit: number): boolean[] {
  return Array.from({ length: n }, (_, k) => (((k - step) % n) + n) % n < lit);
}

/** Alterna entre dos colores por paso: par → a, impar → b. */
export function flip<T>(step: number, a: T, b: T): T {
  return step % 2 === 0 ? a : b;
}
```

- [ ] **Step 4:** test en verde; `npm test` (pixi-free incluye `neon.ts`) y `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#13): helper neon con pulse, chase y flip`.

---

### Task 2: geometría de los neones en `tech.ts`

**Files:**
- Modify: `src/scenes/tech.ts` (`TechScene`, `tower()`, `telecom`, `tech()`)
- Test: `src/scenes/tech.test.ts`

**Interfaces:**
- Produces: `TechScene.neon: { crowns: Accent[]; mastRing: Vec3[] }`. `crowns[k]` corresponde a `towers[k]` (mismo orden), `kind: "poly"`, `alpha: 1`, `color` `"cyan"` si `k` par y `"magenta"` si impar. `mastRing` = `[telecom − 3 z, − 6, − 9]` con `y + 0.6`.

- [ ] **Step 1: test que falla** (agregar al `describe("tech")`)

```ts
  it("neones: una corona por torre en su cara sur bajo la cornisa, a la altura del cartel; tres luces en el mástil", () => {
    const s = scene();
    expect(s.neon.crowns).toHaveLength(s.towers.length);
    s.neon.crowns.forEach((c, k) => {
      expect(c).toMatchObject({ kind: "poly", color: k % 2 === 0 ? "cyan" : "magenta", alpha: 1 });
      if (c.kind !== "poly") return;
      const ys = new Set(c.pts.map((p) => p.y)), zs = c.pts.map((p) => p.z), xs = c.pts.map((p) => p.x);
      expect(ys.size).toBe(1);
      const y = c.pts[0]!.y, top = Math.max(...zs), x0 = Math.min(...xs), x1 = Math.max(...xs);
      expect(top - Math.min(...zs)).toBeCloseTo(0.6);
      // misma y que el cartel de azotea de su torre (centrado sobre la torre)
      expect(s.signs.some((a) => a.kind === "poly" && Math.abs(a.pts[0]!.y - y) < 1e-9 && Math.abs((a.pts[0]!.x + a.pts[1]!.x) / 2 - (x0 + x1) / 2) < 1e-9)).toBe(true);
      // pegada al borde superior del cuerpo de muro cortina sobre el que va el cartel, 0.4 adentro por lado
      const body = s.solids.find((x) => x.kind === "prism" && x.mat === "curtain" && Math.abs(x.at.z + x.h - top) < 1e-9 && Math.abs(x.at.y + x.d + 0.02 - y) < 1e-9 && Math.abs(x.at.x + 0.4 - x0) < 1e-9 && Math.abs(x.at.x + x.w - 0.4 - x1) < 1e-9);
      expect(body).toBeDefined();
    });
    expect(s.neon.mastRing).toEqual([3, 6, 9].map((dz) => ({ x: s.telecom.x, y: s.telecom.y + 0.6, z: s.telecom.z - dz })));
  });
```

- [ ] **Step 2:** `npx vitest run src/scenes/tech.test.ts` → FAIL (`s.neon` undefined) y typecheck rojo.
- [ ] **Step 3: implementación**
  - `TechScene` gana `neon: { crowns: Accent[]; mastRing: Vec3[] }`.
  - `tower()` recibe `crowns: Accent[]` y, junto al `signs.push(sign(...))`, empuja la corona sobre el cuerpo superior (`tx, ty, tw, td`), con tope `top = z - 0.3` (el tope del muro cortina, bajo la cornisa de 0.3) e `y = ty + td + 0.02` (la misma que el poly del cartel: `ty + td − 0.4 + 0.42`):

```ts
/** Corona de neón: franja en la cara sur del cuerpo superior, pegada al borde de arriba; cian en torres pares, magenta en impares. */
function crown(k: number, x: number, y: number, top: number, w: number): Accent {
  const x0 = x + 0.4, x1 = x + w - 0.4, z0 = top - 0.6;
  return { kind: "poly", pts: [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, top), v3(x0, y, top)], color: k % 2 === 0 ? "cyan" : "magenta", alpha: 1 };
}
```

    En `tower()`: `crowns.push(crown(towers.length - 1, tx, ty + td + 0.02, z - 0.3, tw));` (antes de dibujar el helipuerto, cuando `z` ya es el tope + cornisa).
  - `tech()` arma `crowns` y `mastRing = [3, 6, 9].map((dz) => v3(telecomTop.x, telecomTop.y + 0.6, telecomTop.z - dz))` y devuelve `neon: { crowns, mastRing }`.
- [ ] **Step 4:** test en verde; el test de determinismo de `tech.test.ts` sigue verde; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#13): coronas de neón por torre y anillo del mástil en el distrito tecnológico`.

---

### Task 3: capa `neon()` en `tech-anim.ts`

**Files:**
- Modify: `src/scenes/tech-anim.ts`
- Test: `src/scenes/tech-anim.test.ts`

**Interfaces:**
- Consumes: `pulse`, `chase` de Task 1; `scene.neon` de Task 2.
- Produces: `TechAnim.neon(): Accent[]` (coronas, luego los dots del anillo encendidos), `TechAnimChanges.neon: boolean`; exports `NEON_STEP_MS = 150`, `CROWN_PERIOD_MS = 2400`, `CROWN_FLIP_GAP_MS: [number, number] = [6000, 12000]`, `RING_STEP_MS = 200`.

- [ ] **Step 1: tests que fallan** (agregar al `describe("tech-anim")`, y cambiar el `toEqual` de reduced motion a `{ windows: false, signs: false, telecom: false, neon: false }`)

```ts
  it("neones frame 0: coronas a alpha 1 con sus colores iniciales y las tres luces del mástil", () => {
    const { scene, anim } = setup();
    const n = anim.neon(), crowns = n.slice(0, scene.towers.length), ring = n.slice(scene.towers.length);
    expect(crowns).toEqual(scene.neon.crowns);
    expect(ring).toEqual(scene.neon.mastRing.map((at) => ({ kind: "dot", at, r: 0.5, color: "magentaMid" })));
    for (const a of n) expect(["cyan", "cyanMid", "cyanBleed", "magenta", "magentaMid", "magentaBleed"]).toContain(a.color);
  });
  it("las coronas pulsan 0.45..1 en pasos de 150 ms y desfasadas; el anillo corre de a una luz cada 200 ms", () => {
    const { scene, anim } = setup();
    expect(anim.tick(NEON_STEP_MS).neon).toBe(true);
    expect(anim.tick(1).neon).toBe(false); // mismo paso de corona y de anillo
    anim.tick(CROWN_PERIOD_MS / 2 - NEON_STEP_MS - 1);
    const alphas = anim.neon().slice(0, scene.towers.length).map((a) => (a.kind === "poly" ? a.alpha! : 1));
    for (const a of alphas) { expect(a).toBeGreaterThanOrEqual(0.45); expect(a).toBeLessThanOrEqual(1); }
    expect(new Set(alphas).size).toBeGreaterThan(1);
    expect(Math.min(...alphas)).toBeCloseTo(0.45, 1);
    expect(anim.neon().slice(scene.towers.length)).toHaveLength(1);
  });
  it("cada 6..12 s una corona cambia cian ↔ magenta y se queda así", () => {
    const { scene, anim } = setup();
    const magentas = () => anim.neon().slice(0, scene.towers.length).filter((a) => a.color === "magenta").length;
    const m0 = magentas();
    let t = 0;
    while (magentas() === m0 && t <= CROWN_FLIP_GAP_MS[1] + 100) { anim.tick(100); t += 100; }
    expect(t).toBeGreaterThanOrEqual(CROWN_FLIP_GAP_MS[0] - 100);
    expect(t).toBeLessThanOrEqual(CROWN_FLIP_GAP_MS[1] + 100);
    const m1 = magentas();
    expect(Math.abs(m1 - m0)).toBe(1);
    for (let i = 0; i < CROWN_FLIP_GAP_MS[0] / 100 - 2; i++) { anim.tick(100); expect(magentas()).toBe(m1); }
  });
  it("con reduced-motion los neones quedan en el frame 0 aunque pase el tiempo", () => {
    const { scene, anim } = setup(true);
    for (let i = 0; i < 200; i++) anim.tick(100);
    expect(anim.neon()).toEqual([...scene.neon.crowns, ...scene.neon.mastRing.map((at) => ({ kind: "dot", at, r: 0.5, color: "magentaMid" }))]);
  });
```

  Importar `CROWN_FLIP_GAP_MS, CROWN_PERIOD_MS, NEON_STEP_MS` desde `./tech-anim`.

- [ ] **Step 2:** `npx vitest run src/scenes/tech-anim.test.ts` → FAIL.
- [ ] **Step 3: implementación** en `createTechAnim`:
  - Estado: `colors = scene.neon.crowns.map((c) => c.color)`, `neonStep = 0`, `ringStep = 0`, `flipTimer = nextFlip()` con `nextFlip = () => rng.int(CROWN_FLIP_GAP_MS[0], CROWN_FLIP_GAP_MS[1])`. Construirlo **después** de `lit` y `blinkTimer` para no correr la secuencia inicial de ventanas.
  - `neon()`:

```ts
    neon: () => {
      const n = scene.neon.crowns.length, at = neonStep * NEON_STEP_MS;
      const crowns = scene.neon.crowns.map((c, k): Accent => (c.kind === "poly" ? { ...c, color: colors[k]!, alpha: opts.reducedMotion || neonStep === 0 ? 1 : CROWN_ALPHA[0] + (1 - CROWN_ALPHA[0]) * pulse(at, CROWN_PERIOD_MS, k / n) } : c));
      const on = ringStep === 0 ? scene.neon.mastRing.map(() => true) : chase(scene.neon.mastRing.length, ringStep, 1); // paso 0 = frame 0: todo encendido, como con reduced motion
      return [...crowns, ...scene.neon.mastRing.filter((_, k) => on[k]).map((p): Accent => ({ kind: "dot", at: p, r: RING_R, color: "magentaMid" }))];
    },
```

    con `const CROWN_ALPHA = [0.45, 1] as const, RING_R = 0.5;`.
  - En `tick`, después de telecom:

```ts
      flipTimer -= dtMs;
      if (flipTimer <= 0) { flipTimer = nextFlip(); const k = rng.int(0, colors.length - 1); colors[k] = colors[k] === "cyan" ? "magenta" : "cyan"; c.neon = true; }
      const ns = Math.floor(clock / NEON_STEP_MS); if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      const rs = Math.floor(clock / RING_STEP_MS); if (rs !== ringStep) { ringStep = rs; c.neon = true; }
```

  - Actualizar el docstring del módulo (coronas y anillo).
- [ ] **Step 4:** tests en verde; `npm test`, `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#13): las coronas pulsan y cambian de color, el anillo del mástil corre`.

---

### Task 4: `tech.neon` en el animador y en el mundo

**Files:**
- Modify: `src/scenes/tech-animator.ts`
- Test: `src/scenes/tech-animator.test.ts`, `src/world/assemble.test.ts`

**Interfaces:**
- Consumes: `TechAnim.neon()`, `TechAnimChanges.neon` de Task 3.
- Produces: id `"tech.neon"` → `{ kind: "accent", accents: anim.neon() }`.

- [ ] **Step 1: tests que fallan**

  `tech-animator.test.ts`: los ids exactos pasan a `["tech.neon", "tech.signs", "tech.telecom", "tech.windows"]`, y:

```ts
  it("tech.neon es una capa de acentos cian/magenta que cambia al avanzar el reloj", () => {
    const a = techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    const l0 = a.layer("tech.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    let seen = false;
    for (let i = 0; i < 20; i++) if (a.tick(100).has("tech.neon")) seen = true;
    expect(seen).toBe(true);
    expect(a.layer("tech.neon")).not.toEqual(l0);
  });
  it("mismo seed → misma secuencia", () => {
    const mk = () => techAnimator(tech(createRng(7)), createRng(3), { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
```

  `assemble.test.ts` (importar `ACCENT_DIM`, `focusAlphas` de `./veil`):

```ts
  it("la capa tech.neon vive en un animador de Resume y se atenúa con el velo", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("tech.neon"));
    expect(a?.zone).toBe("cv");
    expect(focusAlphas("blog").cv.accents).toBe(ACCENT_DIM);
    expect(focusAlphas("portfolio").cv.accents).toBe(ACCENT_DIM);
    expect(a!.tick(1000).size).toBe(0);
  });
```

- [ ] **Step 2:** `npx vitest run src/scenes/tech-animator.test.ts src/world/assemble.test.ts` → FAIL.
- [ ] **Step 3: implementación**: agregar `"tech.neon": () => ({ kind: "accent", accents: anim.neon() })` a `layers` y `if (c.neon) out.add("tech.neon");` en `tick`; docstring "cuatro capas de acentos".
- [ ] **Step 4:** `npm test`, `npm run typecheck` en verde.
- [ ] **Step 5:** commit `feat(#13): el animador del distrito tecnológico publica tech.neon`.

---

### Task 5: revisión visual y captura

**Files:**
- Create: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/13-tech-neon-resume.png`

- [ ] **Step 1:** `npm run dev -- --host --port 5173` y abrir `http://localhost:5173/lab/world.html?speed=0.2` con `agent-browser` (viewport 1600×900, DPR 2), tecla `2` (Resume) y `5` dos veces (foco en Resume).
- [ ] **Step 2:** verificar a ojo que las coronas se ven sobre el borde sur de las torres, que hay cian y magenta, y que el anillo del mástil se ve; con `prefers-reduced-motion` emulado, encendidas y quietas.
- [ ] **Step 3:** captura y commit `docs(#13): captura del lab con Resume enfocado`.
