# El mar marca solo las capas que cambiaron (#71): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el tick del mar marque para redibujar solo las capas cuyo cuadro cambió desde el tick anterior, con la ganancia contada en un ciclo y medida en el lab.

**Architecture:** el cuadro de cada capa del mar es una función pura de un estado chico: el `ShipState` de cada barco (`lane`, `dist`, `heading`), el ángulo del haz, el paso de las boyas, el paso de los neones y la posición y el sentido de la lancha. `createSeaAnim().tick` compara ese estado antes y después de avanzar el reloj y devuelve banderas por barco en lugar de una sola para la flota. El adaptador (`seaAnimator`) traduce la bandera del barco `k` a sus tres capas. El runtime (`src/world/stage.ts`) no cambia: ya redibuja solo los ids que devuelve `tick`, y dibuja todas las capas al armarse.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (sin cambios), agent-browser.

**Spec:** issue #71, Agent Brief (último comentario de triage).

## Global Constraints

- Cada capa del mar se marca solo si su cuadro cambió desde el tick anterior: barcos, estelas, luces de barcos, haz, boyas, lancha y neones.
- Las transiciones de estado de un barco (`lane` distinto entre antes y después: zarpar, salir de pantalla, volver, entrar a puerto) siempre marcan sus tres capas.
- El primer tick marca todo. Con movimiento reducido el comportamiento es el de hoy: ningún id.
- El haz pasa por la misma regla (se marca si su ángulo cambió).
- Ningún cambio visual. Fuera de alcance: otros animadores (agua, humo), recorridos, tiempos o aspecto de los barcos, el velo por zona de las luces (#26).
- `npm test` y `npm run typecheck` en verde. Texto y comentarios en castellano, como el resto de `src/scenes/`. Commits `feat(#71): …`, `test(#71): …`, `docs(#71): …`.

## Decisiones técnicas (declaradas)

1. **Se compara estado, no geometría.** `shipFrame(k)` depende solo de `states[k]` y de `SHIPS[k].kind`, que es fijo. Comparar `lane`, `dist` y `heading` con `===` equivale a comparar el cuadro y cuesta tres comparaciones, mientras que construir el cuadro para compararlo costaría lo mismo que redibujarlo. El haz se compara por `beamAngle()`.
2. **La transición se chequea explícitamente** (`prev.lane !== next.lane`) aunque hoy un cambio de `lane` siempre cambie también `dist` o `heading`. Así la regla de #64 no depende de esa coincidencia.
3. **"Primer tick" = el primer tick que avanza el reloj** (`dtMs > 0` y sin movimiento reducido). Con `dtMs <= 0` el tick sigue devolviendo nada, como hoy: `?speed=0` (#114) congela sin redibujar. El runtime ya dibujó todas las capas al armarse, así que marcar todo en el primer tick es una red de seguridad, no una necesidad.
4. **Forma de `SeaChanges`:** `ships: boolean[]` (una bandera por barco, en el orden de `SHIPS`). Las otras banderas no cambian de forma. Con movimiento reducido o `dtMs <= 0`, `ships` es un arreglo de `false`.
5. **Boyas, neones y lancha ya cumplen la regla.** Su cuadro es función de `buoyStep`, `neonStep` y `(ferryDist, ferryDir)`, y hoy se marcan solo cuando esos valores cambian. Solo ganan la marca del primer tick.

## Review Focus

1. Un barco que pasa de `out` a `offscreen` en el mismo tick que otro sigue andando: se marcan los dos, el primero por transición (test en Task 1).
2. Un tick largo que deja al barco en el mismo `lane` pero en otro punto (por ejemplo, salta de `offscreen` a `offscreen` del ciclo siguiente) debe marcarlo: `dist` o `heading` cambian (cubierto por la equivalencia de Task 1).
3. El haz tras un período exacto de `BEAM_PERIOD_MS` queda con el mismo ángulo: no marcarlo es correcto, y la equivalencia debe seguir pasando (test en Task 1).
4. Con `?speed=0` (`dtMs = 0`) no se marca nada, ni siquiera en el primer tick (test en Task 1).
5. Movimiento reducido: ningún id, siempre (tests existentes, ajustados a `ships: boolean[]`).

---

### Task 1: banderas por barco y por capa en el tick del mar

**Files:**
- Modify: `src/scenes/sea-anim.ts` (`SeaChanges`, `tick`)
- Modify: `src/scenes/sea-animator.ts` (`tick` del adaptador)
- Test: `src/scenes/sea-anim.test.ts`, `src/scenes/sea-animator.test.ts`

**Interfaces:**
- Produces: `export interface SeaChanges { ships: boolean[]; beam: boolean; buoys: boolean; ferry: boolean; neon: boolean }`. `ships[k]` es la bandera del barco `SHIPS[k]`.
- `seaAnimator(...).tick(dtMs)` devuelve `sea.ship{k}`, `sea.wake{k}` y `sea.lights{k}` solo para los `k` con `ships[k]`.

- [ ] **Step 1: tests que fallan, en `src/scenes/sea-animator.test.ts`**

```ts
describe("seaAnimator marca solo lo que cambió (#71)", () => {
  const shipIds = (k: number) => [`sea.ship${k}`, `sea.wake${k}`, `sea.lights${k}`];
  const OUT = (laneLength("out") / LANE_SPEED) * 1000;

  it("un barco fuera de pantalla no marca sus capas; la transición sí", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    a.tick(OUT - 10); // primer tick: marca todo
    const enter = a.tick(1000); // barco 0: out → offscreen
    for (const id of shipIds(0)) expect(enter.has(id)).toBe(true);
    const still = a.tick(1000); // barco 0 sigue offscreen; 1 y 2 andan
    for (const id of shipIds(0)) expect(still.has(id)).toBe(false);
    for (const id of [...shipIds(1), ...shipIds(2)]) expect(still.has(id)).toBe(true);
    const leave = a.tick(OFF_MS); // offscreen → back
    for (const id of shipIds(0)) expect(leave.has(id)).toBe(true);
  });

  it("el primer tick que avanza marca todas las capas; con dtMs 0 no marca nada", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    expect(a.tick(0).size).toBe(0);
    expect([...a.tick(1)].sort()).toEqual([...a.ids].sort());
  });

  it("las capas no marcadas siguen iguales: el cuadro cacheado coincide con el real en todo un ciclo", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const cache = new Map(a.ids.map((id) => [id, a.layer(id)]));
    const steps = [16, 33, 100, 1000, 5000, BEAM_PERIOD_MS, 15000];
    for (let t = 0, i = 0; t < CYCLE_MS + 60000; i++) {
      const dt = steps[i % steps.length]!; t += dt;
      for (const id of a.tick(dt)) cache.set(id, a.layer(id));
      for (const id of a.ids) expect(cache.get(id)).toEqual(a.layer(id));
    }
  });

  it("en un ciclo completo marca menos capas que antes (#71)", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const dt = 1000 / 60, n = Math.ceil(CYCLE_MS / dt);
    let marked = 0, before = 0;
    for (let i = 0; i < n; i++) {
      const ids = a.tick(dt);
      marked += ids.size;
      // antes de #71: las 9 capas de barcos y el haz en cada tick, más las demás según su criterio
      before += SHIPS.length * 3 + 1 + [...ids].filter((id) => !/^sea\.(ship|wake|lights)\d$|^sea\.beam$/.test(id)).length;
    }
    expect(marked).toBeLessThan(before);
  });
});
```

Imports a sumar en ese archivo: `BEAM_PERIOD_MS`, `CYCLE_MS`, `OFF_MS` desde `./sea-anim`.

En `src/scenes/sea-anim.test.ts`, el test "el haz da una vuelta cada 8 s…" compara `r.tick(500)` con `{ ships: false, … }`: cambiarlo a `{ ships: [false, false, false], beam: false, buoys: false, ferry: false, neon: false }`. Sumar al mismo archivo:

```ts
it("el haz no se marca si vuelve al mismo ángulo; sí en cualquier otro tick (#71)", () => {
  const { a } = setup();
  a.tick(1); // primer tick
  expect(a.tick(BEAM_PERIOD_MS / 4).beam).toBe(true);
  expect(a.tick(0).beam).toBe(false);
});
```

- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts src/scenes/sea-animator.test.ts`. Esperado: fallan "fuera de pantalla", "primer tick", "menos capas" y el `toEqual` de reduced-motion.

- [ ] **Step 3: implementación en `src/scenes/sea-anim.ts`**

```ts
export interface SeaChanges { ships: boolean[]; beam: boolean; buoys: boolean; ferry: boolean; neon: boolean }
```

En `createSeaAnim`, junto a `let clock = 0, …`: `let first = true;`. El `tick`:

```ts
tick(dtMs) {
  if (opts.reducedMotion || dtMs <= 0) return { ships: SHIPS.map(() => false), beam: false, buoys: false, ferry: false, neon: false };
  const all = first; first = false;
  const angle = beamAngle();
  clock += dtMs;
  const c: SeaChanges = { ships: [], beam: all || beamAngle() !== angle, buoys: all, ferry: all, neon: all };
  for (let k = 0; k < SHIPS.length; k++) {
    const prev = states[k]!;
    cycle[k] = (cycle[k]! + dtMs) % CYCLE_MS; states[k] = shipStateAt(cycle[k]!);
    const next = states[k]!;
    // la transición de estado siempre marca (#64), aunque dist y rumbo coincidieran
    c.ships[k] = all || prev.lane !== next.lane || prev.dist !== next.dist || prev.heading !== next.heading;
  }
  // … boyas, lancha y neones como hoy (asignan `true`, nunca `false`)
  return c;
}
```

- [ ] **Step 4: adaptador, `src/scenes/sea-animator.ts`**

```ts
SHIPS.forEach((_, k) => { if (c.ships[k]) { out.add(`sea.ship${k}`); out.add(`sea.wake${k}`); out.add(`sea.lights${k}`); } });
```

Actualizar el comentario del doc de `seaAnimator` si menciona la marca de todos los barcos.

- [ ] **Step 5:** `npm test` y `npm run typecheck`. Esperado: verde.

- [ ] **Step 6: commit** `feat(#71): el mar marca solo las capas que cambiaron`.

### Task 2: conteo y medición antes y después

Sin cambios de comportamiento: produce los números para el PR.

**Files:**
- Create: `.scratch/measure-71.ts` (no versionado; `.scratch/` está en `.git/info/exclude`).

**Interfaces:**
- Consumes: `seaAnimator`, `assembleWorld`, `buildRenderList` (el mismo trabajo que el runtime hace por capa marcada, sin Pixi).

- [ ] **Step 1: conteo por ciclo.** Correr, en `origin/main` (worktree en `/tmp/m71-before`) y en la rama, un script con `npx tsx` que avance `seaAnimator(world(7).sea!, …)` un `CYCLE_MS` completo a 60 Hz y sume `tick(dt).size`, en total y por capa. Anotar los dos conteos.
- [ ] **Step 2: medición en Node, como la de triage.** En los dos árboles: 400 ticks de 16,7 ms en un punto fijo del ciclo con un barco offscreen y en otro con los tres en carril; por tick, `tick` más `buildRenderList` de cada capa marcada. Mediana y p95 del mar.
- [ ] **Step 3: medición en el lab, como #65 y #83.** `npm run dev -- --host --port 5173`; agent-browser a 1600×900, DPR 2; `/lab/blog.html` y `/lab/world.html`, dos corridas calientes cada una, antes (worktree de `origin/main`, otro puerto) y después. Leer `[lab] peor redibujo en 5 s` y la línea de `bloom:`. Presupuesto 15 ms.
- [ ] **Step 4: capturas idénticas.** En los dos árboles, en `/lab/blog.html`, con el método del time-lapse de `docs/superpowers/specs/2026-10-17-barcos-inventario.md` (llamar al listener del ticker con `deltaMS` fijo) avanzar a los mismos instantes simulados (0, `OUT_MS + 5000` con el carguero offscreen, y otros dos) y guardar PNG del canvas. Comparar por hash o píxel a píxel. Si difieren, investigar antes de seguir.
- [ ] **Step 5:** pegar conteos, mediciones y resultado de capturas en el comentario de la etapa; van al PR.
