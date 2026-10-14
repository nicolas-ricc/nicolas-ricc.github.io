# Neones de la feria (Portfolio, excepción) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la feria de la playa tenga neones animados cian/magenta en tres piezas: una marquesina de 8 luces sobre el cartel del portal, luces que suben por la subida del tren y una columna de luces en la torre de caída que sube con la góndola.

**Architecture:** La escena `fair.ts` expone las posiciones nuevas en `FairScene.neon: { marquee: Vec3[]; lift: Vec3[]; column: Vec3[] }`. El animador puro `fair-anim.ts` gana la capa `neon(): Accent[]` y el cambio `neon` en `FairChanges`; `fair-animator.ts` la publica como `fair.neon`. No se agregan animadores: la capa vive en el animador de la feria, etiquetado `portfolio` en `assemble.ts`, y hereda el velo de Portfolio.

**Tech Stack:** TypeScript strict, Vitest, pixi.js 8 (solo en `src/world/` y `src/lab/`, no se toca).

**Spec:** issue #16 (cuerpo completo: "Qué hacer", "Contexto común a los neones" y "Criterios de aceptación comunes"), dentro de la historia #11 (brief del triage y plan del planner en los comentarios de #11). Molde: `docs/superpowers/plans/2026-10-14-neones-ciudad-oficinas.md` (#14) y `2026-10-14-neones-distrito-tecnologico.md` (#13), ya en la rama base.

## Global Constraints

- `src/iso/` y `src/scenes/` no importan `pixi.js` (`src/iso/pixi-free.test.ts`).
- No se agregan colores ni se tocan valores del atlas; ningún literal hex fuera de `src/map/palette-iso.ts` / `palette-base.ts` / `seed.ts` (`src/map/palette-guard.test.ts`).
- Colores de los neones nuevos: solo `cyan*` y `magenta*`. Los acentos estáticos existentes de la feria (`FairScene.accents`) no cambian.
- `src/scenes/portfolio-accents.test.ts` sigue en verde **sin modificarlo** (astillero, fábrica, hinterland intactos).
- La feria no tiene `rng` en su animador: todo deriva del `clock`. `Math.random` prohibido.
- No agregar animadores (`src/world/assemble.test.ts` cuenta 3 en `portfolio`); agregar la capa al existente.
- Reusar `chase` y `flip` de `src/scenes/neon.ts` (existe en la rama base; no se modifica).
- Constantes del issue: `NEON_STEP_MS = 200`; marquesina `chase(8, step, 4)`, color `flip(k, "cyan", "magenta")` por índice, `r = 0.35`; subida `chase(n, step, 2)` en `cyanMid`; columna `magenta` si `z ≤ dropZ()`, si no `magentaBleed` con `r = 0.25`.
- `reducedMotion`: paso 0 (cuatro luces de marquesina y dos de subida encendidas), columna según `dropZ()` en reposo; `tick` no reporta nada.
- Comentarios y textos de tests en español, como el resto del repo. `npm test` y `npm run typecheck` verdes al final de cada task.

## Supuestos técnicos (declarados)

- **Frame 0 = paso 0 del chase**, no "todas encendidas": el issue fija explícitamente que el estado de reposo son cuatro luces de marquesina y dos de subida. Eso es "encendido y quieto" para el criterio común. (#13/#14 eligieron todas encendidas porque su issue no fijaba el estado.)
- **`LIFT_SEGMENTS` se muda a `fair.ts`** (la escena lo necesita para las posiciones de la subida y `fair.ts` no puede importar de `fair-anim.ts`, que ya importa de `fair.ts`). `fair-anim.ts` lo reexporta para que sus importadores sigan compilando.
- **Marquesina:** `y = −177.98 − 0.02 = −178`, `z = 7.6`, `x = 86.5 + k` para `k = 0..7` (8 puntos, extremos incluidos, paso 1 u).
- **Subida:** vértices `0..LIFT_SEGMENTS` de `coasterPath()` (7 puntos) con `z + 0.8`; "ascendente" = `chase` con el paso creciente, que mueve las luces hacia índices mayores (hacia arriba del perfil).
- **Columna:** `z_k = (drop.at.z + 2) + k · ((drop.h − 2) − (drop.at.z + 2)) / 5`, `k = 0..5`, en `(DROP.x, DROP.y + 0.8)`: en este repo `+y` es sur (los carteles van en `y + d`, la cara sur). Las encendidas `magenta` usan `r = 0.35` (el issue solo fija el radio de las apagadas; se toma el de la marquesina). En reposo `dropZ() = drop.at.z = 1`, así que la columna entera queda en `magentaBleed`.
- **La luz más alta de la columna nunca se enciende.** La góndola llega a `DROP.h − 3 = 21` (`fair-anim.ts`, `top`) y la columna termina en `drop.h − 2 = 22`; con la regla literal `z ≤ dropZ()` del issue la sexta luz queda siempre en `magentaBleed`. Se respeta la regla tal cual (se lee como "la columna marca la altura de la góndola", y la góndola no pasa de 21). Alternativa descartada: comparar contra la cima de la góndola o terminar la columna en `top`, ambas contradicen números explícitos del issue.
- **Las luces apagadas del chase no se dibujan** (como `wheelLights` y el malecón de #14); la columna sí dibuja sus seis puntos siempre.
- **Cambio `neon`:** se marca cuando cambia el paso de neón (`floor(clock / 200)`) o cuando cambia `dropStep` (ya existe).

## Review Focus

1. **Reduced motion = paso 0 fijo.** `neon()` antes de cualquier `tick` y con `reducedMotion: true` tras `tick(1000)` son iguales; 4 marquesina + 2 subida + 6 columna, todo en `magentaBleed` la columna. Test en `fair-anim.test.ts`.
2. **La columna sigue a la góndola.** En la cima (`t = 6000..7000 ms`) las cinco luces de abajo están en `magenta` y la de arriba (z = 22 > cima 21) en `magentaBleed`; al volver a la base, ninguna en `magenta`. Test en `fair-anim.test.ts`.
3. **Colores de la marquesina por índice, no por paso.** La luz de la posición `k` es siempre `cyan` si `k` es par y `magenta` si es impar, en cualquier paso. Test en `fair-anim.test.ts`.
4. **Determinismo.** Dos animadores iguales con la misma secuencia de ticks de tamaños mezclados dan capas `toEqual`. Test en `fair-animator.test.ts`.
5. **Velo de Portfolio.** `fair.neon` cae en un animador `zone: "portfolio"`; `focusAlphas("cv").portfolio.accents === ACCENT_DIM`. Test en `assemble.test.ts`.

---

## Mapa de archivos

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `src/scenes/fair.ts` | modificar | `LIFT_SEGMENTS`, `FairScene.neon`, posiciones de marquesina, subida y columna |
| `src/scenes/fair.test.ts` | modificar | geometría de `neon` |
| `src/scenes/fair-anim.ts` | modificar | capa `neon()`, cambio `neon`, `NEON_STEP_MS`; reexporta `LIFT_SEGMENTS` |
| `src/scenes/fair-anim.test.ts` | modificar | animación de neones; reduced motion |
| `src/scenes/fair-animator.ts` | modificar | id `fair.neon` |
| `src/scenes/fair-animator.test.ts` | modificar | ids exactos, cambio tras avanzar, determinismo |
| `src/world/assemble.test.ts` | modificar | `fair.neon` en un animador `portfolio`, velo |
| `docs/superpowers/specs/assets/2026-10-14-cyberpunk/` | agregar | captura del lab con Portfolio enfocado |

---

### Task 1: posiciones de los neones en la escena

**Files:**
- Modify: `src/scenes/fair.ts`, `src/scenes/fair-anim.ts` (solo la constante)
- Test: `src/scenes/fair.test.ts`

**Interfaces:**
- Produces: `export const LIFT_SEGMENTS = 6` en `fair.ts`; `FairScene.neon: { marquee: Vec3[]; lift: Vec3[]; column: Vec3[] }`.

- [ ] **Step 1: test que falla** (en `fair.test.ts`; importar `LIFT_SEGMENTS` de `./fair`)

```ts
it("neon: marquesina de 8 sobre el cartel del portal, subida de LIFT_SEGMENTS + 1, columna de 6 al sur de la torre", () => {
  const s = scene();
  expect(s.neon.marquee).toHaveLength(8);
  expect(s.neon.marquee.map((p) => p.x)).toEqual([86.5, 87.5, 88.5, 89.5, 90.5, 91.5, 92.5, 93.5]);
  for (const p of s.neon.marquee) { expect(p.y).toBeCloseTo(-178, 9); expect(p.z).toBe(7.6); }
  const path = coasterPath();
  expect(s.neon.lift).toHaveLength(LIFT_SEGMENTS + 1);
  s.neon.lift.forEach((p, k) => expect(p).toEqual({ x: path[k]!.x, y: path[k]!.y, z: path[k]!.z + 0.8 }));
  expect(s.neon.column).toHaveLength(6);
  expect(s.neon.column[0]!.z).toBeCloseTo(s.drop.at.z + 2, 9);
  expect(s.neon.column[5]!.z).toBeCloseTo(s.drop.h - 2, 9);
  const steps = s.neon.column.slice(1).map((p, k) => p.z - s.neon.column[k]!.z);
  for (const d of steps) expect(d).toBeCloseTo(steps[0]!, 9);
  for (const p of s.neon.column) { expect(p.x).toBe(DROP.x); expect(p.y).toBe(DROP.y + 0.8); }
});
```

- [ ] **Step 2:** `npx vitest run src/scenes/fair.test.ts` → FAIL (`neon` no existe).

- [ ] **Step 3: implementación**

`fair.ts`, junto a las demás constantes:

```ts
/** Tramos del circuito que son la subida (lenta) del tren: los usan las luces de la subida y el animador. */
export const LIFT_SEGMENTS = 6;
```

`FairScene` gana `neon: { marquee: Vec3[]; lift: Vec3[]; column: Vec3[] }` (comentario corto: posiciones de los neones que anima fair-anim). Función nueva:

```ts
/** Neones: marquesina sobre el cartel del portal, una luz por vértice de la subida, columna al sur de la torre. */
function neon(drop: { at: Vec3; h: number }): FairScene["neon"] {
  const path = coasterPath(), z0 = drop.at.z + 2, z1 = drop.h - 2;
  return {
    marquee: Array.from({ length: 8 }, (_, k) => v3(86.5 + k, -177.98 - 0.02, 7.6)),
    lift: path.slice(0, LIFT_SEGMENTS + 1).map((p) => v3(p.x, p.y, p.z + 0.8)),
    column: Array.from({ length: 6 }, (_, k) => v3(DROP.x, DROP.y + 0.8, z0 + (k * (z1 - z0)) / 5)),
  };
}
```

`fair()` arma `const drop = { at: v3(DROP.x, DROP.y, 1), h: DROP.h }` y devuelve `drop, neon: neon(drop)`.

`fair-anim.ts`: quitar `LIFT_SEGMENTS = 6` de la línea de constantes, importarlo de `./fair` y reexportarlo (`export { LIFT_SEGMENTS } from "./fair";` o incluirlo en el import y `export { LIFT_SEGMENTS }`).

- [ ] **Step 4:** `npx vitest run src/scenes && npm run typecheck` → PASS (incluye `portfolio-accents.test.ts` sin tocar).

- [ ] **Step 5: commit** `feat(#16): posiciones de los neones de la feria en la escena`.

---

### Task 2: capa `neon()` en `fair-anim.ts`

**Files:**
- Modify: `src/scenes/fair-anim.ts`
- Test: `src/scenes/fair-anim.test.ts`

**Interfaces:**
- Consumes: `FairScene["neon"]` (Task 1), `chase`, `flip` de `./neon`.
- Produces: `FairAnim.neon(): Accent[]`; `FairChanges.neon: boolean`; `export const NEON_STEP_MS = 200`.

- [ ] **Step 1: tests que fallan** (en `fair-anim.test.ts`; importar `NEON_STEP_MS`, `DROP_RISE_MS`, y `fair` ya está)

```ts
const dots = (a: Accent[]) => a.flatMap((x) => (x.kind === "dot" ? [x] : []));
const on = (pts: Vec3[], a: Accent[]) => dots(a).filter((d) => pts.some((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z));

describe("fair-anim neon", () => {
  it("frame 0 y reduced motion: 4 de marquesina, 2 de subida, columna entera en magentaBleed; solo cyan/magenta", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false }), r = createFairAnim(s, { reducedMotion: true });
    const f0 = a.neon();
    expect(on(s.neon.marquee, f0)).toHaveLength(4);
    expect(on(s.neon.lift, f0)).toHaveLength(2);
    expect(on(s.neon.column, f0).map((d) => [d.color, d.r])).toEqual(Array(6).fill(["magentaBleed", 0.25]));
    for (const x of f0) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(r.neon()).toEqual(f0);
    expect(r.tick(1000).neon).toBe(false);
    expect(r.neon()).toEqual(f0);
  });
  it("la marquesina corre cada 200 ms y cada posición conserva su color (par cyan, impar magenta)", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    const m0 = on(s.neon.marquee, a.neon());
    expect(a.tick(NEON_STEP_MS).neon).toBe(true);
    const m1 = on(s.neon.marquee, a.neon());
    expect(m1).toHaveLength(4); expect(m1).not.toEqual(m0);
    for (let t = 0; t < 16; t++) {
      for (const d of on(s.neon.marquee, a.neon())) {
        const k = s.neon.marquee.findIndex((p) => p.x === d.at.x);
        expect(d.color).toBe(k % 2 === 0 ? "cyan" : "magenta"); expect(d.r).toBe(0.35);
      }
      a.tick(NEON_STEP_MS);
    }
  });
  it("la subida corre hacia arriba con dos luces cyanMid", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    const idx = () => on(s.neon.lift, a.neon()).map((d) => s.neon.lift.findIndex((p) => p.x === d.at.x && p.y === d.at.y && p.z === d.at.z)).sort((x, y) => x - y);
    expect(idx()).toEqual([0, 1]);
    a.tick(NEON_STEP_MS); expect(idx()).toEqual([1, 2]);
    for (const d of on(s.neon.lift, a.neon())) expect(d.color).toBe("cyanMid");
  });
  it("la columna sube con la góndola: en la cima las cinco de abajo en magenta, en la base ninguna", () => {
    const s = fair(createRng(7)), a = createFairAnim(s, { reducedMotion: false });
    for (let t = 0; t < DROP_RISE_MS + 500; t += 100) a.tick(100);
    // la góndola llega a DROP.h − 3 = 21 y la última luz está en drop.h − 2 = 22: nunca se enciende
    expect(on(s.neon.column, a.neon()).map((d) => d.color)).toEqual([...Array(5).fill("magenta"), "magentaBleed"]);
    for (let t = 0; t < DROP_CYCLE_MS - DROP_RISE_MS - 500 + 100; t += 100) a.tick(100);
    expect(on(s.neon.column, a.neon()).every((d) => d.color === "magentaBleed")).toBe(true);
    // a mitad de la subida hay de los dos
    const b = createFairAnim(s, { reducedMotion: false });
    for (let t = 0; t < DROP_RISE_MS / 2; t += 100) b.tick(100);
    const cs = new Set(on(s.neon.column, b.neon()).map((d) => d.color));
    expect(cs).toEqual(new Set(["magenta", "magentaBleed"]));
  });
});
```

(Importar `type Accent` de `../iso/accent` y `type Vec3` de `../iso/geometry`.) Actualizar el test existente de reduced motion: `toEqual({ ..., signs: false, neon: false })`.

- [ ] **Step 2:** `npx vitest run src/scenes/fair-anim.test.ts` → FAIL.

- [ ] **Step 3: implementación**

```ts
import { chase, flip } from "./neon";
export const NEON_STEP_MS = 200;
```

`FairChanges` gana `neon: boolean`; `FairAnim` gana `neon(): Accent[]`. En `createFairAnim`, estado `neonStep = 0` y:

```ts
neon: () => {
  const { marquee, lift, column } = scene.neon, z = dropZ();
  const lit = (pts: Vec3[], k: number, color: AccentColor, r: number): Accent[] => chase(pts.length, neonStep, k).flatMap((o, i) => (o ? [{ kind: "dot" as const, at: pts[i]!, r, color }] : []));
  return [
    ...chase(marquee.length, neonStep, 4).flatMap((o, k) => (o ? [{ kind: "dot" as const, at: marquee[k]!, r: 0.35, color: flip(k, "cyan" as const, "magenta" as const) }] : [])),
    ...lit(lift, 2, "cyanMid", 0.35),
    ...column.map((at) => (at.z <= z ? { kind: "dot" as const, at, r: 0.35, color: "magenta" as const } : { kind: "dot" as const, at, r: 0.25, color: "magentaBleed" as const })),
  ];
},
```

(La forma exacta puede simplificarse; lo que fija el test es el contenido.) En `tick`, tras el paso de la torre:

```ts
const ns = Math.floor(clock / NEON_STEP_MS); if (ns !== neonStep) { neonStep = ns; c.neon = true; }
if (c.drop) c.neon = true; // la columna sigue a la góndola
```

`c` inicial con `neon: false`. Comentario de cabecera: sumar los neones (marquesina, subida, columna) a la lista de animaciones y aclarar que en frame 0 corren en su paso 0 (cuatro luces de marquesina, dos de subida, columna en reposo).

- [ ] **Step 4:** `npx vitest run src/scenes && npm run typecheck` → PASS.

- [ ] **Step 5: commit** `feat(#16): marquesina, subida y columna animadas en fair-anim`.

---

### Task 3: id `fair.neon`, velo y captura

**Files:**
- Modify: `src/scenes/fair-animator.ts`
- Test: `src/scenes/fair-animator.test.ts`, `src/world/assemble.test.ts`
- Add: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/16-fair-neon-portfolio.png`

**Interfaces:**
- Consumes: `FairAnim.neon()`, `FairChanges.neon` (Task 2).
- Produces: id `fair.neon` en `fairAnimator(...).ids`.

- [ ] **Step 1: tests que fallan**

`fair-animator.test.ts`: los ids exactos pasan a `["fair.drop", "fair.neon", "fair.signs", "fair.train", "fair.wheel", "fair.wheelLights"]`; y

```ts
it("fair.neon es una capa de acentos cian/magenta que cambia al avanzar el reloj", () => {
  const a = fairAnimator(fair(createRng(7)), { reducedMotion: false });
  const l0 = a.layer("fair.neon");
  expect(l0.kind).toBe("accent");
  if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
  expect(a.tick(200).has("fair.neon")).toBe(true);
  expect(a.layer("fair.neon")).not.toEqual(l0);
});
it("mismo seed → misma secuencia", () => {
  const mk = () => fairAnimator(fair(createRng(7)), { reducedMotion: false });
  const a = mk(), b = mk();
  for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
});
```

`assemble.test.ts`:

```ts
it("la capa fair.neon vive en el animador de la feria, en Portfolio, y se atenúa con su velo", () => {
  const { animators } = assembleWorld(undefined, { reducedMotion: true });
  const a = animators.find((x) => x.ids.includes("fair.neon"));
  expect(a?.zone).toBe("portfolio");
  expect(focusAlphas("cv").portfolio.accents).toBe(ACCENT_DIM);
  expect(focusAlphas("blog").portfolio.accents).toBe(ACCENT_DIM);
  expect(a!.tick(1000).size).toBe(0);
});
```

- [ ] **Step 2:** `npx vitest run src/scenes/fair-animator.test.ts src/world/assemble.test.ts` → FAIL.

- [ ] **Step 3:** en `fair-animator.ts`, `"fair.neon": () => ({ kind: "accent", accents: anim.neon() })` y `if (c.neon) out.add("fair.neon")`. Docstring: sumar los neones a "luces y carteles como acentos".

- [ ] **Step 4:** `npm test && npm run typecheck` → PASS.

- [ ] **Step 5: commit** `feat(#16): capa fair.neon en el animador de la feria`.

- [ ] **Step 6 (orquestador, no implementador): captura.** `npm run dev -- --host --port 5173`, `agent-browser` a `http://localhost:5173/lab/world.html` (base `/map/` si la raíz no responde), tecla `1` (Portfolio), captura a `docs/superpowers/specs/assets/2026-10-14-cyberpunk/16-fair-neon-portfolio.png`. Commit `docs(#16): captura del lab con Portfolio enfocado`.

## Assumptions

- Frame 0 / reduced motion = paso 0 del chase (4 + 2 luces). Fuente: el issue lo fija ("`reducedMotion`: paso 0 (cuatro luces de marquesina y dos de subida encendidas)"). Alternativa descartada: todas encendidas como #13/#14.
- La sexta luz de la columna (z 22) nunca se enciende porque la góndola llega a 21 (`fair-anim.ts`, `top = DROP.h - 3`). Se aplica la regla literal del issue (`z ≤ dropZ()`, columna hasta `drop.h − 2`). Alternativa descartada: acortar la columna o comparar con la cima de la góndola (contradice números explícitos del issue).
- Las luces encendidas de la columna usan `r = 0.35` (el issue solo fija `0.25` para las del resto). Alternativa descartada: `0.4` de `wheelLights`; se eligió la de la marquesina, el neón hermano en la misma capa.
- La columna lee `dropZ()` en el momento del redibujo. Como `fair.neon` se reporta en todo paso de la góndola (100 ms), queda alineada con la góndola dibujada; en un paso de neón sin paso de góndola puede adelantarse a lo sumo 100 ms de subida (≤ 0.34 u), invisible. Alternativa descartada: cuantizar `dropZ` aparte (más estado sin efecto visible).
- "Subida" = vértices `0..LIFT_SEGMENTS` de `coasterPath()`, tal cual el issue ("un punto por vértice de los primeros `LIFT_SEGMENTS` tramos"); "ascendente" = el chase avanza en el sentido del recorrido del tren. El último vértice (z 13) ya es el inicio de la bajada; se respeta el conteo del issue.
- Marquesina y subida omiten las luces apagadas (precedente `wheelLights` en `fair-anim.ts` y el malecón de #14); la columna dibuja sus seis puntos porque el issue da color a todas ("el resto en `magentaBleed`").

## Grilling

- Rondas: 1 (respuestas sin cambios estructurales: solo se sumaron supuestos).
- Preguntas: 16. Fuentes: ISSUE 6, CODE 15, DOC 0, NO SOURCE 3 (varias respuestas citan más de una fuente).
- NO SOURCE → supuestos técnicos (arriba): radio de las luces encendidas de la columna (Q13), desfase continuo de `dropZ` entre pasos (Q5), luz superior de la columna nunca encendida (Q1: los números son del issue; la consecuencia se declara).
- Ambigüedades de spec: ninguna. Issues abiertos: ninguno.
