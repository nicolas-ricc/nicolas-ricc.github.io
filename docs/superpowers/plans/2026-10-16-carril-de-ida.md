# Carril de ida desde el fondeadero de la bocana — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `ROUTE` por el carril de ida `LANE_OUT` (camino del centro del casco) que sale del fondeadero `BERTH` en la bocana y baja hasta salir del cover 16:9 por abajo-izquierda, con los tres barcos a una velocidad única.

**Architecture:** `ships.ts` gana `shipAt(kind, center, heading)`, que pasa del centro de la unidad (para `barge`, barcaza + empujador) al `at` de popa que usa `ship()`. `sea-anim.ts` exporta `LANE_OUT`, `BERTH` y `LANE_SPEED`; `routeAt` camina `LANE_OUT` y `shipFrame` posiciona con `shipAt`. `SHIPS` pierde `speed`.

**Tech Stack:** TypeScript, Vitest, PixiJS (solo en el lab; la animación es pura).

**Spec:** issue #63 (hijo de #57; decisiones 8–12 y 14 del plan de #57 son las heredadas). No hay spec en `docs/`: el texto del issue es la spec.

## Global Constraints

- `LANE_OUT` = `(362,−2) → (500,20) → (515,120) → (520,180) → (480,290) → (420,470) → (376,640)`, largo ≈ 783 u; no mover vértices más de 2 u sin revalidar.
- `BERTH = { x: 362, y: −2 }` = `LANE_OUT[0]`, exportado.
- `LANE_SPEED = 1.2`, igual para los tres barcos; `SHIPS` queda `{ kind, phase }` con fases 0, 1/3, 2/3.
- Desvanecido `FADE_U = 30` en ambos extremos (como hoy); al llegar al final el barco vuelve al inicio; `TURN_U = 20`.
- `reducedMotion` y los ids del `seaAnimator` (`sea.ship{k}`, `sea.wake{k}`, `sea.lights{k}`) sin cambios.
- `FERRY_ROUTE` intacta y su test en verde.
- Verificación: `npm test`, `npm run typecheck`, `npm run build` en verde.

## Review Focus

- Barcaza (`barge`): el "centro" es el de la unidad completa (empujador incluido, popa en `at − 10`), no `at + len/2`; si `shipAt` usa `len/2 = 25` el convoy queda 10 u adelantado. Test en Task 1.
- Puntos del carril con `y > WORLD.y1` (no solo `x > WORLD.x1`) caen en el sangrado: el test de agua debe usar `bleedTerrainAt` para cualquier punto fuera de `WORLD`. Test en Task 2.
- El último punto del carril tiene que estar fuera del cover y `BERTH` dentro: si no, el barco se desvanece a la vista. Test en Task 2.
- Rumbo en el vértice inicial: `routeAt(0).heading` es el del primer tramo (sin interpolar hacia un tramo previo inexistente). Test en Task 2.
- El wrap del ciclo: tras `L/LANE_SPEED` s el barco 0 vuelve a `dist ≈ 0` (y no a `L`). Test en Task 3.

---

### Task 1: `shipAt` — del centro del casco al `at` de popa

**Files:**
- Modify: `src/scenes/ships.ts`
- Test: `src/scenes/ships.test.ts`

**Interfaces:**
- Produces: `export function shipAt(kind: ShipKind, center: Vec2, heading: number): Vec2` — devuelve el `at` (popa de la barcaza / casco) tal que el punto medio de la unidad completa cae en `center`. Unidad = `[stern, len]` en coordenadas locales, con `stern = -10` para `barge` (empujador) y `0` para el resto; `at = center − ((len + stern)/2)·(cos h, sin h)`. Para `barge` hoy: `(40 − 10)/2 = 15`. La misma constante de popa del empujador la usa `wake()` (hoy `kind === "barge" ? -10 : 0`): extraerla a un helper local `sternOf(kind)` y usarla en ambos.

- [ ] **Step 1: Test que falla** (agregar a `describe("ships")` en `ships.test.ts`, importando `shipAt`)

```ts
  it("shipAt: el centro de la unidad (barcaza + empujador incluido) cae en el punto pedido, para cualquier rumbo", () => {
    for (const kind of KINDS) for (const h of [0, Math.PI / 2, 2.3, -0.7]) {
      const c = { x: 400, y: 100 }, at = shipAt(kind, c, h);
      const xs = ship(kind, at, h).solids.flatMap((s) => { const b = bounds(s); return [b.min, b.max]; });
      // proyectar sobre el eje del barco: los extremos de la unidad quedan simétricos respecto del centro
      const along = xs.map((p) => (p.x - c.x) * Math.cos(h) + (p.y - c.y) * Math.sin(h));
      const stern = kind === "barge" ? -10 : 0, len = SHIP_SPECS[kind].len;
      expect(Math.hypot(at.x - c.x, at.y - c.y)).toBeCloseTo((len + stern) / 2, 6);
      expect(Math.abs(Math.max(...along) + Math.min(...along))).toBeLessThan(5); // la unidad entera queda centrada (margen de la caja rotada)
    }
    expect(shipAt("barge", { x: 0, y: 0 }, 0)).toEqual({ x: -15, y: 0 });
    expect(shipAt("cargo", { x: 0, y: 0 }, 0)).toEqual({ x: -30, y: 0 });
  });
```

- [ ] **Step 2:** `npx vitest run src/scenes/ships.test.ts` → FAIL (`shipAt` no existe).
- [ ] **Step 3: Implementación mínima** en `ships.ts`:

```ts
/** Popa de la unidad en coordenadas locales: el empujador va 10 u detrás de la barcaza. */
const sternOf = (kind: ShipKind): number => (kind === "barge" ? -10 : 0);

/** `at` de popa para que el punto medio de la unidad completa (empujador incluido) caiga en `center`. */
export function shipAt(kind: ShipKind, center: Vec2, heading: number): Vec2 {
  const half = (SHIP_SPECS[kind].len + sternOf(kind)) / 2;
  return { x: center.x - half * Math.cos(heading), y: center.y - half * Math.sin(heading) };
}
```

y en `wake()` reemplazar `stern = kind === "barge" ? -10 : 0` por `stern = sternOf(kind)`. Actualizar el docstring del módulo: "Popa en `at`; `shipAt` lo deriva del centro de la unidad".

- [ ] **Step 4:** `npx vitest run src/scenes/ships.test.ts` → PASS.
- [ ] **Step 5:** `git commit -m "feat(#63): shipAt, del centro de la unidad al at de popa"`

### Task 2: `LANE_OUT` y `BERTH`; posición por centro

**Files:**
- Modify: `src/scenes/sea-anim.ts`
- Test: `src/scenes/sea-anim.test.ts` (`describe("ruta")`)

**Interfaces:**
- Consumes: `shipAt` (Task 1).
- Produces: `export const LANE_OUT: readonly Vec2[]`, `export const BERTH: Vec2` (mismo objeto que `LANE_OUT[0]` o igual en valor), `routeAt(dist)` devuelve el **centro** del casco sobre `LANE_OUT` (misma firma `{ x, y, heading }`), `routeLength()` = largo de `LANE_OUT`. `ROUTE` desaparece.

- [ ] **Step 1: Tests que fallan** — reemplazar los dos tests de `describe("ruta")`:

```ts
describe("ruta", () => {
  it("LANE_OUT nace en BERTH (dentro del cover) y termina fuera del cover; agua, profundidad ≥ 6, Blog para x ≥ 380, cruza la fosa", () => {
    expect(LANE_OUT[0]).toEqual(BERTH);
    expect(BERTH).toEqual({ x: 362, y: -2 });
    expect(inCoverQuad(BERTH.x, BERTH.y)).toBe(true);
    const end = LANE_OUT[LANE_OUT.length - 1]!;
    expect(inCoverQuad(end.x, end.y)).toBe(false);
    const L = routeLength();
    expect(L).toBeCloseTo(783, 0);
    const inWorld = (x: number, y: number) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;
    let crossedAbyss = false;
    for (let d = 0; d <= L; d += 1) {
      const p = routeAt(d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      if (t === "abyss") crossedAbyss = true;
    }
    expect(crossedAbyss).toBe(true);
    expect(routeAt(0).heading).toBeCloseTo(Math.atan2(22, 138), 6); // sale casi al este por la bocana
  });

  it("ningún punto del carril queda detrás de un sólido estático que se le superponga en pantalla", () => {
    const w = world(7);
    const statics = w.solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    for (let d = 0; d <= routeLength(); d += 4) {
      const p = routeAt(d);
      const parts = ship("cargo", shipAt("cargo", p, p.heading), p.heading).solids.map(bounds);
      const sb = { min: { x: Math.min(...parts.map((b) => b.min.x)), y: Math.min(...parts.map((b) => b.min.y)), z: -1 }, max: { x: Math.max(...parts.map((b) => b.max.x)), y: Math.max(...parts.map((b) => b.max.y)), z: 13 } };
      const scr = screenBounds(sb);
      for (const s of statics) if (overlaps(scr, s.sb)) expect(isBehind(sb, s.b)).toBe(false);
    }
  });

  it("el barco se dibuja centrado en el carril: el casco nace en shipAt(kind, routeAt(d))", () => {
    const { a } = setup();
    for (const k of [0, 1, 2]) {
      const p = routeAt(a.dist(k)), at = shipAt(SHIPS[k]!.kind, p, p.heading);
      const hull = a.ship(k).solids.find((s) => s.kind === "hull")!;
      expect(hull.kind === "hull" && hull.at.x).toBeCloseTo(at.x, 6);
      expect(hull.kind === "hull" && hull.at.y).toBeCloseTo(at.y, 6);
    }
  });
});
```

Imports a sumar: `inCoverQuad, worldZoneAt` de `../map/geo`; `BERTH, LANE_OUT` de `./sea-anim` (quitar `ROUTE`); `shipAt` de `./ships`. (Para `barge` el primer sólido `hull` es el de la barcaza, en `at`; el del empujador está en `at − 10`; `find` devuelve el primero.)

- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts` → FAIL.
- [ ] **Step 3: Implementación** en `sea-anim.ts`:
  - Reemplazar `ROUTE` y su comentario largo por `LANE_OUT` y `BERTH`:

```ts
export const LANE_OUT: readonly Vec2[] = [{ x: 362, y: -2 }, { x: 500, y: 20 }, { x: 515, y: 120 }, { x: 520, y: 180 }, { x: 480, y: 290 }, { x: 420, y: 470 }, { x: 376, y: 640 }];
export const BERTH: Vec2 = LANE_OUT[0]!;
```

  - `const route = polyline(LANE_OUT);` (verificar que `polyline` acepta `readonly Vec2[]`; si no, `[...LANE_OUT]`).
  - `shipFrame`: `const p = routeAt(dists[k]!), kind = SHIPS[k]!.kind, at = shipAt(kind, p, p.heading);` y usar `at` en `buildShip(kind, at, p.heading)` y `wake(kind, at, p.heading)`.
  - Comentario largo nuevo sobre `LANE_OUT` (prosa en castellano, mismo tono que hoy), que explique: (a) es el camino del **centro** del casco (`shipAt`), así los tres tamaños comparten el fondeadero; (b) fondeadero en (362, −2), la bocana, 36 u al SE de la vieja popa (326, −24) para que el barco pueda girar sin pisar la selva de x < 344, y ≥ 24 ni quedar detrás de los galpones del muelle de alistamiento; no hay muelle; (c) sale **casi al este** (tramo a (500, 20)) porque la caja de alineación del test de profundidad (60 u de eslora, z −1..13) es mucho más ancha en pantalla que la silueta cuando la proa va en diagonal, y una salida diagonal da falsos positivos de `isBehind` con la boya (420, 80) y el arrecife (≈ 405, 111); casi horizontal la caja es angosta en y; (d) baja por **x ≥ 500 hasta y 180** para rodear la boya y el pecio por el este, lejos de la punta (Portfolio), en agua de Blog y cruzando la fosa; (e) recién al sur de y 180 vira al sur-suroeste porque abajo-izquierda en pantalla es +y, levemente −x; (f) **termina fuera del cover 16:9** (376, 640) para que el barco no se desvanezca a la vista; el desvanecido ocurre en el sangrado. Validado contra agua, `depthAt ≥ 6`, `worldZoneAt === "blog"` para x ≥ 380, `isBehind` con la caja del carguero y `coverQuad(16/9)`: no mover vértices más de 2 u sin revalidar.
  - Docstring del módulo: "tres barcos que zarpan del fondeadero de la bocana, rodean la boya y el pecio por el este, cruzan la fosa y salen del cover por abajo-izquierda".
- [ ] **Step 4:** `npx vitest run src/scenes` → PASS (el test viejo de `barcos` puede seguir usando `speed` hasta la Task 3).
- [ ] **Step 5:** `git commit -m "feat(#63): carril de ida LANE_OUT desde el fondeadero, posición por centro del casco"`

### Task 3: velocidad única `LANE_SPEED` y fases 0 / ⅓ / ⅔

**Files:**
- Modify: `src/scenes/sea-anim.ts`
- Test: `src/scenes/sea-anim.test.ts` (`describe("barcos")`), `src/scenes/sea-animator.test.ts`

**Interfaces:**
- Produces: `export const LANE_SPEED = 1.2`; `SHIPS: readonly { kind: ShipKind; phase: number }[]` = cargo 0, tug 1/3, barge 2/3.

- [ ] **Step 1: Test que falla** — reemplazar el primer test de `describe("barcos")`:

```ts
  it("tres barcos a la misma velocidad con fases 0, ⅓, ⅔; alpha en [0, 1]; el barco 0 vuelve al inicio tras L/LANE_SPEED segundos", () => {
    const { a } = setup();
    expect(LANE_SPEED).toBe(1.2);
    expect(SHIPS.map((s) => s.kind)).toEqual(["cargo", "tug", "barge"]);
    expect(SHIPS.map((s) => s.phase)).toEqual([0, 1 / 3, 2 / 3]);
    for (const s of SHIPS) expect(Object.keys(s).sort()).toEqual(["kind", "phase"]);
    const L = routeLength();
    expect([0, 1, 2].map((k) => a.dist(k))).toEqual(SHIPS.map((s) => s.phase * L));
    const cycleMs = (L / LANE_SPEED) * 1000, n = Math.round(cycleMs / 100), dt = cycleMs / n;
    let seenMid = false;
    for (let i = 0; i < n; i++) {
      a.tick(dt);
      for (const k of [0, 1, 2]) { const s = a.ship(k); expect(s.alpha).toBeGreaterThanOrEqual(0); expect(s.alpha).toBeLessThanOrEqual(1); expect(s.wake.length).toBe(1); }
      if (a.ship(0).alpha === 1) seenMid = true;
      const ds = [0, 1, 2].map((k) => a.dist(k)); // velocidad única: la separación en el carril no cambia
      expect(((ds[1]! - ds[0]! + L) % L) / L).toBeCloseTo(1 / 3, 6);
    }
    expect(seenMid).toBe(true);
    const d0 = a.dist(0);
    expect(Math.min(d0, L - d0)).toBeLessThan(1e-6);
    expect(Math.abs(a.dist(1) - L / 3)).toBeLessThan(1e-6); // un ciclo entero: todos vuelven a su fase
  });
```

Import `LANE_SPEED` de `./sea-anim`. El segundo test (`alpha exactamente 0 al final...`) queda igual.

En `sea-animator.test.ts`, la aserción `sea.wake0` alpha 0 sigue valiendo (fase 0 = en el fondeadero, desvanecido de entrada); solo cambiar el comentario a `// fase 0: en el fondeadero, aún invisible: no hace falta redibujarlo`.

- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts` → FAIL (`LANE_SPEED` no existe, fases distintas).
- [ ] **Step 3: Implementación**:

```ts
export const SHIPS: readonly { kind: ShipKind; phase: number }[] = [{ kind: "cargo", phase: 0 }, { kind: "tug", phase: 1 / 3 }, { kind: "barge", phase: 2 / 3 }];
// Convoy: con velocidades distintas un barco alcanza al de adelante en el mismo carril y se superponen.
export const LANE_SPEED = 1.2;
```

y en `tick`: `dists[k] = dists[k]! + (LANE_SPEED * dtMs) / 1000;` (el wrap `>= L → − L` queda).

- [ ] **Step 4:** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5:** `git commit -m "feat(#63): velocidad única LANE_SPEED y fases 0, 1/3, 2/3"`

### Verificación final

- `npm test`, `npm run typecheck`, `npm run build`.
- Lab: `npm run dev -- --host --port 5173`, `/lab/blog.html?speed=10`, tecla `4` (cover) y `3` (Blog): los barcos salen de la bocana, bajan a abajo-izquierda y salen del encuadre por abajo; la lancha de la feria sigue igual.
