# Carril de vuelta, rotación de barcos y giro en el fondeadero — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar el carril de vuelta `LANE_BACK` y un ciclo por barco `out → offscreen → back → berth → out` con giro en el lugar en el fondeadero, de modo que siempre haya al menos un barco yendo y uno volviendo sin superponerse en pantalla.

**Architecture:** `sea-anim.ts` pasa de un carril a dos: `laneAt(lane, dist)` / `laneLength(lane)` caminan `LANE_OUT` o `LANE_BACK` con el mismo suavizado de rumbo (`TURN_U`) que hoy tiene `routeAt`. Cada barco guarda un único reloj de ciclo en ms (`0..CYCLE_MS`); su estado (`lane`, `dist`, `heading`) se deriva de ese reloj con una función pura, así el `dt` sobrante al cambiar de estado se consume solo (avanzar = sumar y tomar módulo). `seaAnimator` no cambia: ya marca las tres capas de cada barco en cada tick.

**Tech Stack:** TypeScript, Vitest, PixiJS (solo en el lab; la animación es pura).

**Spec:** issue #64 (hijo de #57; decisiones 11–15 del plan de #57 son las heredadas). No hay spec en `docs/`: el texto del issue es la spec.

## Global Constraints

- `LANE_BACK` (exportado, sentido de marcha mar → fondeadero) = `(430,655) → (471,487) → (533,309) → (575,199) → (571,114) → (562,13) → (552,−50) → (400,−50) → (362,−2)`, largo ≈ 943 u; no mover vértices más de 2 u sin revalidar. Último punto = `BERTH`.
- `LANE_OUT`, `BERTH = (362, −2)`, `LANE_SPEED = 1.2`, `FADE_U = 30`, `TURN_U = 20` sin cambios.
- `OFF_MS = 15000`, `BERTH_MS = 24000`; el giro en el fondeadero ocurre entre los 8 s y los 16 s de la pausa, del rumbo de llegada al de salida por el arco más corto (`lerpAngle`), alrededor del centro `BERTH`.
- Período `T = L_out/v + OFF + L_back/v + BERTH` (≈ 1477.4 s); el barco k arranca en la fase `k·T/3` de su ciclo (`SHIPS[k].phase` = 0, 1/3, 2/3 ahora es fracción de `T`).
- Alpha: ida `min(1, (L_out − d)/FADE_U)`; vuelta `min(1, d/FADE_U)`; fondeadero 1; `offscreen` 0 con `solids/lights/wake` vacíos.
- `SeaAnim.state(k): { lane: "out" | "offscreen" | "back" | "berth"; dist: number; heading: number }`.
- Ids de capas del animador (`sea.ship{k}`, `sea.wake{k}`, `sea.lights{k}`) sin cambios; `reducedMotion`: frame inicial fijo, `tick` no hace nada.
- `FERRY_ROUTE` y la lancha intactas, su test en verde.
- Verificación: `npm test`, `npm run typecheck`, `npm run build` en verde.

## Decisiones técnicas (no están en el issue; declaradas acá)

- `routeAt` / `routeLength` se reemplazan por `laneAt(lane, dist)` / `laneLength(lane)` con `lane: "out" | "back"` (un solo caminante para los dos carriles, sin duplicar el suavizado). Solo los usan `sea-anim.ts` y su test.
- `SeaAnim.dist(k)` se elimina (lo cubre `state(k).dist`) y `alphaAt(dist)` pasa a `alphaAt(lane, dist)`.
- `state(k).dist` en las pausas: `offscreen` reporta `L_out` (donde dejó el carril de ida) y `berth` reporta `L_back` (donde terminó la vuelta). Así `dist` siempre es una distancia sobre un carril.
- En `berth` el barco está quieto: su `wake` es `[]` (no hay estela sin marcha). El issue no lo pide ni lo prohíbe; un barco fondeado con estela en V se lee como si navegara.

## Review Focus

- `dt` grande (pestaña en segundo plano: el ticker de Pixi puede entregar varios segundos de golpe) que cruza dos estados en un tick: el reloj de ciclo con módulo lo absorbe; test en Task 2 con `tick(OFF_MS + 5000)` desde el final de la ida.
- Giro por el arco más corto: llegada ≈ 128.4° y salida ≈ 9.1°: la diferencia es −119°, no +241°; test en Task 2 (el rumbo nunca pasa por ≈ 270°).
- Wrap del ciclo: tras `CYCLE_MS` exactos cada barco vuelve a su estado inicial (no a `L` ni a otro estado); test en Task 2.
- `reducedMotion`: `state(k)` estable e igual al inicial tras `tick`; test en Task 2.
- El barco en `offscreen` devuelve capas vacías con alpha 0 pero su capa se sigue marcando para redibujar (si no, la última silueta de la ida queda pintada); test en Task 2 sobre `seaAnimator`.

---

### Task 1: `LANE_BACK` y el caminante de dos carriles

**Files:**
- Modify: `src/scenes/sea-anim.ts`
- Test: `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Produces:
  - `export const LANE_BACK: readonly Readonly<Vec2>[]` (vértices de Global Constraints).
  - `export type Lane = "out" | "back"`.
  - `export function laneAt(lane: Lane, dist: number): { x: number; y: number; heading: number }` — mismo algoritmo que el `routeAt` actual, sobre la polilínea del carril.
  - `export const laneLength = (lane: Lane): number`.
  - `routeAt` y `routeLength` desaparecen; `shipFrame` usa `laneAt("out", …)` hasta la Task 2.

- [ ] **Step 1: Tests que fallan.** En `sea-anim.test.ts`: cambiar el import (`routeAt, routeLength` → `LANE_BACK, laneAt, laneLength`; sumar `convexHull, project` y `hullRings`) y reemplazar cada `routeAt(` por `laneAt("out", ` y cada `routeLength()` por `laneLength("out")` en el describe "ruta". Agregar, después de "ruta":

```ts
import { convexHull, v3, type Vec2 } from "../iso/geometry";
import { project } from "../iso/project";
import { bounds, hullRings, isFlat } from "../iso/solids"; // isFlat ya lo usa el test de la lancha

const inWorld = (x: number, y: number) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;

/** Silueta convexa en pantalla de un carguero centrado en `p`: anillo de cubierta proyectado a z −1 y z 13. */
const silhouette = (p: { x: number; y: number }, heading: number): Vec2[] => {
  const hull = ship("cargo", shipAt("cargo", p, heading), heading).solids.find((s) => s.kind === "hull")!;
  if (hull.kind !== "hull") throw new Error("sin casco");
  return convexHull(hullRings(hull).deck.flatMap((q) => [project(v3(q.x, q.y, -1)), project(v3(q.x, q.y, 13))]));
};
/** SAT entre dos polígonos convexos: se intersecan si ningún eje (normal de un lado) los separa. */
const intersects = (a: Vec2[], b: Vec2[]): boolean => {
  const axes = [a, b].flatMap((poly) => poly.map((p, i) => { const q = poly[(i + 1) % poly.length]!; return { x: p.y - q.y, y: q.x - p.x }; }));
  return axes.every((n) => {
    const pa = a.map((p) => p.x * n.x + p.y * n.y), pb = b.map((p) => p.x * n.x + p.y * n.y);
    return Math.max(...pa) >= Math.min(...pb) && Math.max(...pb) >= Math.min(...pa);
  });
};

describe("dos carriles", () => {
  it("LANE_BACK nace fuera del cover y termina en BERTH; agua, profundidad ≥ 6, Blog para x ≥ 380", () => {
    expect(LANE_BACK[0]).toEqual({ x: 430, y: 655 });
    expect(inCoverQuad(430, 655)).toBe(false);
    expect(LANE_BACK[LANE_BACK.length - 1]).toEqual(BERTH);
    const L = laneLength("back");
    expect(Math.abs(L - 943)).toBeLessThan(5); // ≈ 942.67; holgura para mover vértices hasta 2 u
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("back", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
    }
  });

  it("ningún punto de LANE_BACK queda detrás de un sólido estático que se le superponga en pantalla", () => {
    const statics = world(7).solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    for (let d = 0; d <= laneLength("back"); d += 4) {
      const p = laneAt("back", d);
      const parts = ship("cargo", shipAt("cargo", p, p.heading), p.heading).solids.map(bounds);
      const sb = { min: { x: Math.min(...parts.map((b) => b.min.x)), y: Math.min(...parts.map((b) => b.min.y)), z: -1 }, max: { x: Math.max(...parts.map((b) => b.max.x)), y: Math.max(...parts.map((b) => b.max.y)), z: 13 } };
      const scr = screenBounds(sb);
      for (const s of statics) if (overlaps(scr, s.sb)) expect(isBehind(sb, s.b)).toBe(false);
    }
  });

  it("separación: dos cargueros, uno en cada carril, no se tocan en pantalla salvo cerca del fondeadero (d_out + (L_back − d_back) < 200)", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    const backs = [] as { d: number; s: Vec2[] }[];
    for (let d = 0; d <= Lb; d += 4) { const p = laneAt("back", d); backs.push({ d, s: silhouette(p, p.heading) }); }
    for (let d = 0; d <= Lo; d += 4) {
      const p = laneAt("out", d), s = silhouette(p, p.heading);
      for (const b of backs) if (d + (Lb - b.d) >= 200) expect(intersects(s, b.s)).toBe(false);
    }
  });

  it("giro en el fondeadero: con el carguero centrado en BERTH, ningún rumbo entre el de llegada y el de salida lo deja detrás de un sólido estático", () => {
    const statics = world(7).solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    const arrive = laneAt("back", laneLength("back")).heading, leave = laneAt("out", 0).heading;
    let d = leave - arrive; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; // arco corto
    for (let t = 0; t <= 1; t += 0.02) {
      const h = arrive + d * t, parts = ship("cargo", shipAt("cargo", BERTH, h), h).solids.map(bounds);
      const sb = { min: { x: Math.min(...parts.map((b) => b.min.x)), y: Math.min(...parts.map((b) => b.min.y)), z: -1 }, max: { x: Math.max(...parts.map((b) => b.max.x)), y: Math.max(...parts.map((b) => b.max.y)), z: 13 } };
      const scr = screenBounds(sb);
      for (const s of statics) if (overlaps(scr, s.sb)) expect(isBehind(sb, s.b)).toBe(false);
    }
  });

  it("intersects (SAT) detecta superposición y separación", () => {
    const sq = (x: number, y: number): Vec2[] => [{ x, y }, { x: x + 2, y }, { x: x + 2, y: y + 2 }, { x, y: y + 2 }];
    expect(intersects(sq(0, 0), sq(1, 1))).toBe(true);
    expect(intersects(sq(0, 0), sq(3, 0))).toBe(false);
  });

  it("laneAt('back') interpola el rumbo en los vértices y en el extremo llega con el rumbo del último tramo", () => {
    const Lb = laneLength("back"), last = Math.atan2(-2 - -50, 362 - 400);
    expect(laneAt("back", Lb).heading).toBeCloseTo(last, 6);
    expect(laneAt("back", 0).heading).toBeCloseTo(Math.atan2(487 - 655, 471 - 430), 6);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts` → FAIL (`LANE_BACK`, `laneAt`, `laneLength` no existen).

- [ ] **Step 3: Implementación** en `sea-anim.ts`. Después de `BERTH` agregar el carril con su comentario; reemplazar `route`, `routeLength` y `routeAt` por:

```ts
// Carril de vuelta, en el sentido de marcha (mar → fondeadero): corre ~56 u al este del de ida y entra
// al fondeadero desde el noreste, por encima de la salida, sin cruzarla. Validado igual que la ida
// (agua, `depthAt` ≥ 6, Blog para x ≥ 380, `isBehind`, primer punto fuera del cover) y además con las
// siluetas de dos cargueros, uno por carril, que no se tocan en pantalla fuera de los 200 u (sumando
// distancias) más cercanos al fondeadero: no mover vértices más de 2 u sin revalidar.
export const LANE_BACK: readonly Readonly<Vec2>[] = [{ x: 430, y: 655 }, { x: 471, y: 487 }, { x: 533, y: 309 }, { x: 575, y: 199 }, { x: 571, y: 114 }, { x: 562, y: 13 }, { x: 552, y: -50 }, { x: 400, y: -50 }, { x: 362, y: -2 }];
```

```ts
export type Lane = "out" | "back";
const lanes: Record<Lane, Polyline> = { out: polyline(LANE_OUT), back: polyline(LANE_BACK) };
export const laneLength = (lane: Lane): number => lanes[lane].length;

/** Punto y rumbo a `dist` unidades del inicio del carril; el rumbo se interpola en los TURN_U alrededor de cada vértice. */
export function laneAt(lane: Lane, dist: number): { x: number; y: number; heading: number } {
  const route = lanes[lane], p = route.at(dist), seg = route.segs, i = p.seg, s = seg[i]!;
  // …resto idéntico al routeAt actual…
}
```

(importar `type Polyline` de `../iso/geometry`). En `createSeaAnim` cambiar `routeLength()` → `laneLength("out")` y `routeAt(` → `laneAt("out", `.

- [ ] **Step 4:** `npx vitest run src/scenes/sea-anim.test.ts` → PASS; `npm run typecheck` → limpio.
- [ ] **Step 5: Commit** `feat(#64): carril de vuelta LANE_BACK y caminante de dos carriles`.

---

### Task 2: ciclo por barco, giro en el fondeadero y `state(k)`

**Files:**
- Modify: `src/scenes/sea-anim.ts` (comentario de cabecera, constantes, `createSeaAnim`)
- Test: `src/scenes/sea-anim.test.ts` (describe "barcos" reescrito, describe "dos carriles" ampliado), `src/scenes/sea-animator.test.ts`

**Interfaces:**
- Consumes: `Lane`, `laneAt`, `laneLength`, `LANE_BACK` (Task 1).
- Produces:
  - `export const OFF_MS = 15000, BERTH_MS = 24000, BERTH_TURN_MS = { from: 8000, to: 16000 }`.
  - `export const CYCLE_MS: number` = `(laneLength("out") + laneLength("back")) / LANE_SPEED * 1000 + OFF_MS + BERTH_MS`.
  - `export type ShipLane = Lane | "offscreen" | "berth"`; `export interface ShipState { lane: ShipLane; dist: number; heading: number }`.
  - `export function shipStateAt(ms: number): ShipState` — pura, `ms` en `[0, CYCLE_MS)`.
  - `export function alphaAt(lane: ShipLane, dist: number): number`.
  - `SeaAnim` pierde `dist(k)` y `alphaAt`, gana `state(k): ShipState`.

- [ ] **Step 1: Tests que fallan.** En `sea-anim.test.ts`, reemplazar el describe "barcos" por:

```ts
describe("barcos", () => {
  it("tres barcos a la misma velocidad, cada uno arranca en la fase k·T/3 de su ciclo; tras CYCLE_MS todos vuelven a su estado", () => {
    const { a } = setup();
    expect(LANE_SPEED).toBe(1.2);
    expect(SHIPS.map((s) => s.kind)).toEqual(["cargo", "tug", "barge"]);
    expect(SHIPS.map((s) => s.phase)).toEqual([0, 1 / 3, 2 / 3]);
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(CYCLE_MS).toBeCloseTo(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + BERTH_MS, 6);
    const s0 = [0, 1, 2].map((k) => a.state(k));
    expect(s0[0]).toMatchObject({ lane: "out", dist: 0 }); // zarpando
    expect(s0[1]!.lane).toBe("out"); expect(s0[1]!.dist).toBeGreaterThan(Lo / 2); // lejos en la ida
    expect(s0[2]!.lane).toBe("back"); expect(s0[2]!.dist).toBeGreaterThan(Lb / 4); expect(s0[2]!.dist).toBeLessThan((3 * Lb) / 4); // a mitad de la vuelta
    const n = Math.round(CYCLE_MS / 1000), dt = CYCLE_MS / n;
    for (let i = 0; i < n; i++) a.tick(dt);
    a.tick(1); // la suma en coma flotante puede quedar un pelo antes de CYCLE_MS (fondeado): 1 ms más lo pasa a la ida
    for (const k of [0, 1, 2]) { const s = a.state(k); expect(s.lane).toBe(s0[k]!.lane); expect(s.dist).toBeCloseTo(s0[k]!.dist, 2); }
  });

  it("alpha: 1 en el fondeadero, 0 en los extremos de mar, 1 a FADE_U de ellos; offscreen 0", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(alphaAt("out", 0)).toBe(1);
    expect(alphaAt("out", Lo)).toBe(0);
    expect(alphaAt("out", Lo - FADE_U)).toBe(1);
    expect(alphaAt("back", 0)).toBe(0);
    expect(alphaAt("back", FADE_U)).toBe(1);
    expect(alphaAt("back", Lb)).toBe(1);
    expect(alphaAt("berth", Lb)).toBe(1);
    expect(alphaAt("offscreen", Lo)).toBe(0);
  });

  it("offscreen: el frame no tiene sólidos, luces ni estela y su alpha es 0", () => {
    const { a } = setup();
    a.tick((laneLength("out") / LANE_SPEED) * 1000 + OFF_MS / 2); // barco 0 a mitad del offscreen
    expect(a.state(0)).toMatchObject({ lane: "offscreen", dist: laneLength("out") });
    expect(a.ship(0)).toEqual({ solids: [], lights: [], wake: [], alpha: 0 });
  });

  it("un dt grande cruza estados y consume el sobrante: del final de la ida, OFF_MS + 5 s después va 6 u por la vuelta", () => {
    const { a } = setup();
    a.tick((laneLength("out") / LANE_SPEED) * 1000);
    a.tick(OFF_MS + 5000);
    expect(a.state(0).lane).toBe("back");
    expect(a.state(0).dist).toBeCloseTo(5 * LANE_SPEED, 6);
  });

  it("reduced motion: tick no cambia el estado de ningún barco", () => {
    const { a } = setup(true);
    const s0 = [0, 1, 2].map((k) => a.state(k));
    a.tick(60000);
    expect([0, 1, 2].map((k) => a.state(k))).toEqual(s0);
  });
});
```

y agregar al describe "dos carriles":

```ts
  it("cerca del fondeadero nunca coinciden dos barcos: LANE_SPEED · (T/3 − BERTH_MS) ≥ 200 u", () => {
    expect((LANE_SPEED * (CYCLE_MS / 3 - BERTH_MS)) / 1000).toBeGreaterThanOrEqual(200);
  });

  it("cobertura: en 2·T, siempre uno en out y uno en back, nunca dos en berth, cada barco recorre out → offscreen → back → berth en orden, y dos en el mismo carril distan ≥ 100 u", () => {
    const { a } = setup();
    const ORDER = ["out", "offscreen", "back", "berth"] as const;
    const prev = [0, 1, 2].map((k) => a.state(k).lane), seen: string[][] = [[], [], []];
    for (let t = 0; t < 2 * CYCLE_MS; t += 997) {
      a.tick(997);
      const ss = [0, 1, 2].map((k) => a.state(k));
      expect(ss.some((s) => s.lane === "out")).toBe(true);
      expect(ss.some((s) => s.lane === "back")).toBe(true);
      expect(ss.filter((s) => s.lane === "berth").length).toBeLessThanOrEqual(1);
      ss.forEach((s, k) => {
        if (s.lane !== prev[k]) { expect(s.lane).toBe(ORDER[(ORDER.indexOf(prev[k]!) + 1) % 4]); seen[k]!.push(s.lane); prev[k] = s.lane; }
      });
      for (const lane of ["out", "back"] as const) {
        const ds = ss.filter((s) => s.lane === lane).map((s) => s.dist);
        if (ds.length === 2) expect(Math.abs(ds[0]! - ds[1]!)).toBeGreaterThanOrEqual(100);
      }
    }
    for (const k of [0, 1, 2]) for (const lane of ORDER) expect(seen[k]).toContain(lane);
  });

  it("giro en el fondeadero: el centro no se mueve y el rumbo pasa del de llegada al de salida por el arco corto, entre los 8 s y los 16 s", () => {
    const { a } = setup();
    const Lo = laneLength("out"), Lb = laneLength("back");
    const arrive = laneAt("back", Lb).heading, leave = laneAt("out", 0).heading;
    a.tick(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + 1); // barco 0 recién fondeado
    const hullAt = () => { const h = a.ship(0).solids.find((s) => s.kind === "hull")!; if (h.kind !== "hull") throw new Error(); return h; };
    for (let t = 1; t < BERTH_MS; t += 250) {
      const s = a.state(0), h = hullAt(), want = shipAt("cargo", BERTH, s.heading);
      expect(s.lane).toBe("berth");
      expect(h.at.x).toBeCloseTo(want.x, 6); expect(h.at.y).toBeCloseTo(want.y, 6); // centro fijo en BERTH
      expect(a.ship(0).wake).toEqual([]); // fondeado: sin estela
      if (t < BERTH_TURN_MS.from) expect(s.heading).toBeCloseTo(arrive, 6);
      if (t > BERTH_TURN_MS.to) expect(s.heading).toBeCloseTo(leave, 6);
      const lo = Math.min(arrive, leave), hi = Math.max(arrive, leave); // arco corto: nunca sale de [salida, llegada]
      expect(s.heading).toBeGreaterThanOrEqual(lo - 1e-9); expect(s.heading).toBeLessThanOrEqual(hi + 1e-9);
      a.tick(250);
    }
    a.tick(1000); // zarpa
    expect(a.state(0).lane).toBe("out");
    expect(a.state(0).heading).toBeCloseTo(Math.atan2(22, 138), 6); // rumbo del primer tramo de LANE_OUT
  });
```

Actualizar el import de `./sea-anim` en el test: `BEAM_PERIOD_MS, BERTH, BERTH_MS, BERTH_TURN_MS, CYCLE_MS, FADE_U, FERRY_PAUSE_MS, FERRY_ROUTE, FERRY_SPEED, KEEPER_SIGN_MS, LANE_BACK, LANE_OUT, LANE_SPEED, NEON_STEP_MS, OFF_MS, SHIPS, alphaAt, createSeaAnim, laneAt, laneLength`. En el test "el barco se dibuja centrado en el carril", reemplazar `laneAt("out", a.dist(k))` por el estado: `const s = a.state(k), p = laneAt(s.lane as Lane, s.dist), at = shipAt(SHIPS[k]!.kind, p, s.heading);` (frame 0: barcos 0 y 1 en la ida, 2 en la vuelta; importar `type Lane`).

En `sea-animator.test.ts`, primer test: reemplazar la aserción de `sea.wake0` por

```ts
    expect(a.layer("sea.wake0")).toMatchObject({ kind: "water", alpha: 1 }); // fase 0: zarpando del fondeadero, a la vista
    expect(a.layer("sea.ship2")).toMatchObject({ kind: "solid", alpha: 1 }); // fase ⅔: a mitad de la vuelta
```

y agregar un test:

```ts
  it("al pasar a offscreen la capa del barco se marca para redibujar y queda vacía", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const toEnd = (laneLength("out") / LANE_SPEED) * 1000;
    a.tick(toEnd - 10);
    const ids = a.tick(1000);
    expect(ids.has("sea.ship0")).toBe(true); expect(ids.has("sea.wake0")).toBe(true); expect(ids.has("sea.lights0")).toBe(true);
    expect(a.layer("sea.ship0")).toEqual({ kind: "solid", solids: [], alpha: 0 });
  });
```

(importar `LANE_SPEED, laneLength` de `./sea-anim`).

- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts src/scenes/sea-animator.test.ts` → FAIL (`state`, `CYCLE_MS`, `OFF_MS`… no existen).

- [ ] **Step 3: Implementación** en `sea-anim.ts`:

Constantes (junto a `LANE_SPEED`):

```ts
export const OFF_MS = 15000, BERTH_MS = 24000, BERTH_TURN_MS = { from: 8000, to: 16000 };
```

Después de `laneAt`:

```ts
export type ShipLane = Lane | "offscreen" | "berth";
export interface ShipState { lane: ShipLane; dist: number; heading: number }

const OUT_MS = (laneLength("out") / LANE_SPEED) * 1000, BACK_MS = (laneLength("back") / LANE_SPEED) * 1000;
export const CYCLE_MS = OUT_MS + OFF_MS + BACK_MS + BERTH_MS;

/** Estado de un barco a `ms` del inicio de su ciclo (`0 ≤ ms < CYCLE_MS`): ida, fuera de cámara, vuelta, fondeado. */
export function shipStateAt(ms: number): ShipState {
  if (ms < OUT_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "out", dist, heading: laneAt("out", dist).heading }; }
  ms -= OUT_MS;
  if (ms < OFF_MS) return { lane: "offscreen", dist: laneLength("out"), heading: laneAt("out", laneLength("out")).heading };
  ms -= OFF_MS;
  if (ms < BACK_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "back", dist, heading: laneAt("back", dist).heading }; }
  ms -= BACK_MS;
  const turn = Math.max(0, Math.min(1, (ms - BERTH_TURN_MS.from) / (BERTH_TURN_MS.to - BERTH_TURN_MS.from)));
  return { lane: "berth", dist: laneLength("back"), heading: lerpAngle(laneAt("back", laneLength("back")).heading, laneAt("out", 0).heading, turn) };
}

/** Desvanecido solo en el extremo de mar de cada carril; en el fondeadero, a pleno. */
export function alphaAt(lane: ShipLane, dist: number): number {
  if (lane === "out") return Math.max(0, Math.min(1, (laneLength("out") - dist) / FADE_U));
  if (lane === "back") return Math.max(0, Math.min(1, dist / FADE_U));
  return lane === "berth" ? 1 : 0;
}
```

(`lerpAngle` tiene que estar declarado antes de `shipStateAt`; ya lo está arriba de `routeAt`/`laneAt`).

En `createSeaAnim`: borrar `L`, `dists` y el `alphaAt` local; usar

```ts
  const cycle = SHIPS.map((s) => s.phase * CYCLE_MS);
  const states = cycle.map(shipStateAt);
```

`shipFrame`:

```ts
  const shipFrame = (k: number): ShipFrame => {
    const s = states[k]!;
    if (s.lane === "offscreen") return { solids: [], lights: [], wake: [], alpha: 0 };
    const p = s.lane === "berth" ? BERTH : laneAt(s.lane, s.dist);
    const kind = SHIPS[k]!.kind, at = shipAt(kind, p, s.heading);
    const built = buildShip(kind, at, s.heading);
    const wakeTris = s.lane === "berth" ? [] : [{ kind: "ground" as const, mat: "foam" as const, tris: wake(kind, at, s.heading) }];
    return { solids: built.solids, lights: built.lights, wake: wakeTris, alpha: alphaAt(s.lane, s.dist) };
  };
```

En el objeto devuelto: quitar `dist` y `alphaAt`, agregar `state: (k) => states[k]!`. En `tick`, reemplazar el bucle de `dists` por

```ts
      for (let k = 0; k < SHIPS.length; k++) { cycle[k] = (cycle[k]! + dtMs) % CYCLE_MS; states[k] = shipStateAt(cycle[k]!); }
```

En la interfaz `SeaAnim`: quitar `dist(k)` y `alphaAt(dist)`, agregar `state(k: number): ShipState;`.

Reescribir el comentario de cabecera (JSDoc de arriba) para describir: los dos carriles (ida por `LANE_OUT`, vuelta por `LANE_BACK` ~56 u al este, entrando al fondeadero desde el noreste), el fondeadero `BERTH` (pausa de `BERTH_MS`, giro en el lugar entre los 8 y 16 s), la rotación (`out → offscreen (OFF_MS) → back → berth`, barco k a la fase k·T/3) y el período `T` ≈ 1477 s, más lo que ya dice del haz, boyas y neones.

- [ ] **Step 4:** `npm test` → PASS completo; `npm run typecheck` → limpio.
- [ ] **Step 5: Commit** `feat(#64): ciclo ida/offscreen/vuelta/fondeadero con giro en el lugar`.

---

### Verificación final (después de las tareas)

- `npm test`, `npm run typecheck`, `npm run build`.
- Lab: `npm run dev -- --host --port 5173`, `/lab/blog.html?speed=10`, tecla `4`: al menos un barco yendo y uno volviendo, cruzándose sin superponerse; el que llega fondea, gira y vuelve a salir (script `agent-browser` de la etapa de evals).

## Assumptions

Decisiones técnicas sin fuente escrita, tomadas en el grilling (van a la descripción del PR):

- `dtMs` negativo o 0 no avanza el reloj (guarda existente `if (opts.reducedMotion || dtMs <= 0) return none;`, `sea-anim.ts:156`). `NaN` no se blinda: el único llamador es `stage.tick(ticker.deltaMS * speed)` (`src/lab/page.ts:76` y el stage del sitio), y `deltaMS` de Pixi es finito. Alternativa rechazada: `Number.isFinite` en `tick` (defensa sobre un camino interno confiable).
- Barco fondeado sin estela (`wake: []`). Alternativa rechazada: conservar la V de estela con el barco quieto. `stage.ts:90,102` ya admite una capa `water` vacía (la de `offscreen` la exige el issue).
- `state(k).dist` es `L_out` en `offscreen` y `L_back` en `berth`. Alternativa rechazada: ms transcurridos en la pausa (mezclaría unidades en el mismo campo).
- `routeAt`/`routeLength`/`SeaAnim.dist`/`SeaAnim.alphaAt(dist)` se reemplazan en lugar de convivir con la API nueva. Alternativa rechazada: mantener alias (dos nombres para lo mismo).
- La no superposición en pantalla se mide con la silueta convexa del casco (anillo de cubierta a z −1 y z 13), exactamente como lo define el issue; mástiles y estela no entran (la silueta a z 13 ya cubre la altura de la caja de alineación).
- El commit intermedio de la Task 1 deja el repo en verde: el ciclo de un solo carril sigue funcionando sobre `laneAt("out", …)`.

## Grilling

- Rondas: 1 (la revisión agregó un test, no cambió la estructura; no hizo falta segunda ronda).
- Preguntas: 15. Fuentes: ISSUE 7, CODE 13, DOC 1, NO SOURCE 4 (varias respuestas citan más de una fuente).
- Supuestos técnicos: los 6 de `## Assumptions`.
- Ambigüedades de spec: 0. Issues abiertos fuera de alcance: 0.
- Cambio al plan: test nuevo en la Task 1, "giro en el fondeadero … ningún rumbo … detrás de un sólido estático" (pregunta 4). Sondeado antes de escribirlo: 0 contactos en 51 rumbos.
