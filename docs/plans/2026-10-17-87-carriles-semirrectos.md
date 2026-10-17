# Carriles semirrectos bocana → abajo-izquierda (#87) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los tres barcos del mar recorran una línea semirrecta entre la bocana y la esquina inferior izquierda del cover (ida y vuelta en carriles paralelos), sin fondeadero, con la boya y el pecio reubicados fuera de los carriles.

**Architecture:** Dos cortes en `src/scenes/sea-anim.ts`: primero la máquina de estados del ciclo (se quita `berth`, se agrega el segundo `offscreen` de `PORT_MS`, fade en las dos puntas de cada carril), con los carriles viejos todavía en su lugar; después la geometría (vértices nuevos de `LANE_OUT`/`LANE_BACK` y estáticos de `src/scenes/sea.ts`), con los tests de ruta reescritos y los comentarios/README al día. Todos los valores numéricos vienen del issue, ya validados por el planner con el validador tsx.

**Criterios de aceptación → tareas:** valores de `LANE_OUT`/`LANE_BACK`/`BUOYS`/`WRECK`/`WRECK_BUOY` → Task 2; `BERTH*`/`berth` eliminados y `PORT_MS` exportado → Task 1; validador en /tmp con cero violaciones → Task 2 Step 1/4; `npm test` + typecheck y cobertura de `sea-anim.test.ts` → Tasks 1 y 2; comprobación visual en `lab/world.html?speed=20` → Task 3; comentarios y README → Task 1 Step 3 (ciclo) y Task 2 Steps 5-6; PR contra `feature/85-barcos-semirrecta` con el porqué de los 42 u → etapa de PR del pipeline.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`), `tsx` para el validador, PixiJS 8 y `agent-browser` para la comprobación visual.

**Spec:** issue #87 (cuerpo y criterios de aceptación), con el ticket padre #85 y su comentario de plan como contexto.

## Global Constraints

- `LANE_OUT = [(362,−16), (398,40), (424,86), (437,114), (440,142), (434,176), (420,232), (377,647)]`, L ≈ 687.9.
- `LANE_BACK = [(424,600), (462,237), (475,185), (482,144), (477,102), (461,66), (434,18), (397,−39)]`, L ≈ 664.9.
- `BUOYS = [{ x: 398, y: 150 }, { x: 392, y: 200 }]`; `WRECK = { x: 490, y: 262, heading: Math.PI / 6 }`; `WRECK_BUOY = { x: 498, y: 272 }`.
- No mover ningún vértice ni estático más de 2 u sin volver a correr el validador (`/tmp/val87/validate.ts`, copiado del issue) con cero violaciones.
- Ciclo: `out → offscreen (OFF_MS = 15000) → back → offscreen (PORT_MS = 30000)`; `CYCLE_MS = OUT_MS + OFF_MS + BACK_MS + PORT_MS`; `PORT_MS` exportado.
- `SHIPS` sigue `cargo`/`tug`/`barge` con fases 0, 1/3, 2/3; `LANE_SPEED = 1.2`; `FADE_U = 30`; `TURN_U = 20`.
- `alphaAt(lane, d) = clamp(min(1, d/FADE_U, (L−d)/FADE_U))` para `out` y `back`; `offscreen` 0.
- `BERTH`, `BERTH_MS`, `BERTH_TURN_MS` y el estado `"berth"` dejan de existir; `ShipLane = Lane | "offscreen"`.
- `FERRY_ROUTE`, haz, neones, punta, faro, `COAST` y galería no cambian.
- Tests actualizados **sin relajar**; la única validación que se quita es `crossedAbyss`.
- Textos del repo en español.

## Review Focus

1. El barco que entra a puerto (fin de `back`) y vuelve a zarpar: con el fondeadero quitado, el barco aparece en `(362, −16)` desvanecido; si `shipStateAt` deja `dist` o `heading` del tramo anterior, el primer frame de la ida "salta". Test en Task 1: al cruzar `PORT_MS` el estado es `{ lane: "out", dist ≈ 0 }` y el frame tiene alpha 0.
2. Dos barcos en el mismo carril a la vez (la ida dura más de T/3): deben ir separados ≥ 100 u. Lo cubre el test de cobertura de Task 1.
3. Un `dt` enorme (pestaña en segundo plano) que cruza `back` y `PORT_MS` de una sola vez: tiene que caer en el estado correcto. Test en Task 1 ("un dt grande cruza `PORT_MS`").
4. Un barco a pleno detrás de un sólido estático mientras pasa junto a la punta, las boyas o el pecio nuevos: lo cubre `expectNotBehind` en ambos carriles (Task 2).
5. La lancha y los carriles nuevos: hoy no hay aserción para la lancha a > 20 u. Se agrega en Task 2.

---

### Task 1: Ciclo sin fondeadero (máquina de estados y alpha)

Los carriles quedan como están (todavía nacen y terminan en (232, 50)); sólo cambia el ciclo. Por eso en esta tarea el test de separación conserva su excepción de 200 u y los tests de ruta comparan contra el literal `{ x: 232, y: 50 }` en vez de `BERTH`. La Task 2 los reescribe.

**Files:**
- Modify: `src/scenes/sea-anim.ts` (constantes, `ShipLane`, `CYCLE_MS`, `shipStateAt`, `alphaAt`, `shipFrame`, párrafo del ciclo en el comentario de cabecera)
- Modify: `src/scenes/sea-anim.test.ts`
- Modify: `src/scenes/sea-animator.test.ts`

**Interfaces:**
- Produces: `export const PORT_MS = 30000`; `export type ShipLane = Lane | "offscreen"`; `export const CYCLE_MS = OUT_MS + OFF_MS + BACK_MS + PORT_MS`; `shipStateAt(ms)` con cuatro tramos; `alphaAt(lane, dist)` con fade en ambas puntas. `BERTH`, `BERTH_MS`, `BERTH_TURN_MS` eliminados.

- [ ] **Step 1: Tests que fallan.** En `sea-anim.test.ts`:
  - Import: quitar `BERTH`, `BERTH_MS`, `BERTH_TURN_MS`; agregar `PORT_MS`.
  - En "LANE_OUT nace en …" y "LANE_BACK nace …" reemplazar `BERTH` por el literal `{ x: 232, y: 50 }` (transitorio, la Task 2 los reescribe).
  - Borrar los tests "giro en el fondeadero: con el carguero centrado en BERTH …", "cerca del fondeadero nunca coinciden dos barcos …" y "giro en el fondeadero: el centro no se mueve …".
  - Reemplazar el test de cobertura por:

```ts
  it("cobertura: en 2·T, siempre uno en out y uno en back (y uno a pleno en cada uno), cada barco recorre out → offscreen → back → offscreen en orden, y dos en el mismo carril distan ≥ 100 u", () => {
    const { a } = setup();
    const ORDER = ["out", "offscreen", "back", "offscreen"] as const;
    const step = [0, 1, 2].map((k) => ORDER.indexOf(a.state(k).lane as (typeof ORDER)[number])), seen: string[][] = [[], [], []];
    for (let t = 0; t < 2 * CYCLE_MS; t += 997) {
      a.tick(997);
      const ss = [0, 1, 2].map((k) => a.state(k));
      expect(ss.some((s) => s.lane === "out")).toBe(true);
      expect(ss.some((s) => s.lane === "back")).toBe(true);
      expect(ss.some((s) => s.lane === "out" && alphaAt("out", s.dist) === 1)).toBe(true);
      expect(ss.some((s) => s.lane === "back" && alphaAt("back", s.dist) === 1)).toBe(true);
      ss.forEach((s, k) => {
        if (s.lane !== ORDER[step[k]!]) { step[k] = (step[k]! + 1) % 4; expect(s.lane).toBe(ORDER[step[k]!]); seen[k]!.push(`${step[k]}`); }
      });
      for (const lane of ["out", "back"] as const) {
        const ds = ss.filter((s) => s.lane === lane).map((s) => s.dist);
        if (ds.length === 2) expect(Math.abs(ds[0]! - ds[1]!)).toBeGreaterThanOrEqual(100);
      }
    }
    for (const k of [0, 1, 2]) for (const i of [0, 1, 2, 3]) expect(seen[k]).toContain(`${i}`);
  });
```

  (El barco 0 arranca en `out` con `dist` 0; los tres empiezan en `out` o `back`, así que `indexOf` nunca da −1 en el frame 0.)
  - Agregar, en el mismo `describe("dos carriles")`:

```ts
  it("entrar a puerto: al terminar la vuelta pasa PORT_MS fuera de cámara y reaparece en el inicio de la ida, desvanecido", () => {
    const { a } = setup();
    const Lo = laneLength("out"), Lb = laneLength("back");
    a.tick(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + 1); // barco 0 recién llegado a la bocana
    expect(a.state(0)).toMatchObject({ lane: "offscreen", dist: Lb });
    expect(a.ship(0)).toEqual({ solids: [], lights: [], wake: [], alpha: 0 });
    a.tick(PORT_MS - 2);
    expect(a.state(0).lane).toBe("offscreen");
    a.tick(2);
    expect(a.state(0).lane).toBe("out");
    expect(a.state(0).dist).toBeLessThan(0.01);
    expect(a.ship(0).alpha).toBeLessThan(0.01);
  });

  it("un dt grande cruza la vuelta y PORT_MS de una vez: cae 6 u dentro de la ida siguiente", () => {
    const { a } = setup();
    const Lo = laneLength("out"), Lb = laneLength("back");
    a.tick((Lo / LANE_SPEED) * 1000 + OFF_MS);
    a.tick((Lb / LANE_SPEED) * 1000 + PORT_MS + 5000);
    expect(a.state(0).lane).toBe("out");
    expect(a.state(0).dist).toBeCloseTo(5 * LANE_SPEED, 6);
  });
```

  - En `describe("barcos")`: en el primer test cambiar `+ BERTH_MS` por `+ PORT_MS`. Reemplazar el test de alpha por:

```ts
  it("alpha: 0 en los dos extremos de cada carril, 1 a FADE_U de ellos; offscreen 0", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(alphaAt("out", 0)).toBe(0);
    expect(alphaAt("out", FADE_U)).toBe(1);
    expect(alphaAt("out", Lo / 2)).toBe(1);
    expect(alphaAt("out", Lo - FADE_U)).toBe(1);
    expect(alphaAt("out", Lo)).toBe(0);
    expect(alphaAt("back", 0)).toBe(0);
    expect(alphaAt("back", FADE_U)).toBe(1);
    expect(alphaAt("back", Lb - FADE_U)).toBe(1);
    expect(alphaAt("back", Lb)).toBe(0);
    expect(alphaAt("out", FADE_U / 2)).toBeCloseTo(0.5, 6);
    expect(alphaAt("offscreen", Lo)).toBe(0);
  });
```

  - En `sea-animator.test.ts`, la línea de `sea.wake0` pasa a `toMatchObject({ kind: "water", alpha: 0 }); // fase 0: zarpa en el inicio de la ida, desvanecido`.

- [ ] **Step 2: Correr y ver que fallan.** `npx vitest run src/scenes/sea-anim.test.ts src/scenes/sea-animator.test.ts` → FAIL (`PORT_MS` no existe, alpha 1 en `out` 0, etc.).

- [ ] **Step 3: Implementación** en `sea-anim.ts`:

```ts
export const OFF_MS = 15000, PORT_MS = 30000;
// …
export type ShipLane = Lane | "offscreen";
// …
export const CYCLE_MS = OUT_MS + OFF_MS + BACK_MS + PORT_MS;
const OUT_END_HEADING = laneAt("out", laneLength("out")).heading, BACK_END_HEADING = laneAt("back", laneLength("back")).heading;

/** Estado de un barco a `ms` del inicio de su ciclo (`0 ≤ ms < CYCLE_MS`): ida, fuera de cámara, vuelta, en puerto (fuera de cámara). */
export function shipStateAt(ms: number): ShipState {
  if (ms < OUT_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "out", dist, heading: laneAt("out", dist).heading }; }
  ms -= OUT_MS;
  if (ms < OFF_MS) return { lane: "offscreen", dist: laneLength("out"), heading: OUT_END_HEADING };
  ms -= OFF_MS;
  if (ms < BACK_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "back", dist, heading: laneAt("back", dist).heading }; }
  return { lane: "offscreen", dist: laneLength("back"), heading: BACK_END_HEADING };
}

/** Desvanecido de FADE_U en las dos puntas de cada carril; fuera de cámara, 0. */
export function alphaAt(lane: ShipLane, dist: number): number {
  if (lane === "offscreen") return 0;
  return Math.max(0, Math.min(1, dist / FADE_U, (laneLength(lane) - dist) / FADE_U));
}
```

  `shipFrame`: quitar las ramas `berth` (`const p = laneAt(s.lane, s.dist)` y estela siempre). Borrar `BERTH`, `BERTH_MS`, `BERTH_TURN_MS`, `ARRIVE_HEADING`, `LEAVE_HEADING`. En el comentario de cabecera, reescribir la frase del ciclo: `out → offscreen (OFF_MS) → back → offscreen (PORT_MS)`, sin giro en el lugar (la descripción de la ruta la reescribe la Task 2).

- [ ] **Step 4: Correr.** `npx vitest run src/scenes/` y `npm run typecheck` → PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(#87): ciclo sin fondeadero, fade en las dos puntas y PORT_MS"`

### Task 2: Carriles nuevos, estáticos reubicados, tests de ruta, comentarios y README

**Files:**
- Modify: `src/scenes/sea.ts` (`BUOYS`, `WRECK`, `WRECK_BUOY`, comentario de cabecera y del pecio)
- Modify: `src/scenes/sea-anim.ts` (`LANE_OUT`, `LANE_BACK` y sus comentarios; párrafo de ruta de la cabecera)
- Modify: `src/scenes/sea-anim.test.ts` (describe "ruta", "dos carriles", boyas)
- Check: `src/scenes/sea.test.ts` (usa las constantes; debe seguir verde sin cambios)
- Modify: `README.md` (~líneas 19-25), `src/lab/blog.ts:3`, `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: Task 1 (`PORT_MS`, ciclo sin `berth`, `alphaAt` con dos puntas).
- Produces: `LANE_OUT`, `LANE_BACK`, `BUOYS`, `WRECK`, `WRECK_BUOY` con los valores de Global Constraints.

- [ ] **Step 1: Validador.** Copiar el bloque "Validador" del issue a `/tmp/val87/validate.ts` (fuera del repo). Después de editar `sea.ts` en el Step 4 debe dar `✔ sin violaciones` con `npx tsx /tmp/val87/validate.ts`.

- [ ] **Step 2: Tests que fallan.** En `sea-anim.test.ts`, reemplazar los dos tests de cabecera y el de separación:

```ts
  it("LANE_OUT nace en la bocana (362, −16), dentro del cover, y termina fuera; agua, profundidad ≥ 6, Blog para x ≥ 380; el fade de mar cae en el sangrado", () => {
    expect(LANE_OUT[0]).toEqual({ x: 362, y: -16 });
    expect(inCoverQuad(362, -16)).toBe(true);
    const end = LANE_OUT[LANE_OUT.length - 1]!;
    expect(inCoverQuad(end.x, end.y)).toBe(false);
    const L = laneLength("out");
    expect(Math.abs(L - 687.9)).toBeLessThan(5); // holgura para mover vértices hasta 2 u
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("out", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(inCoverQuad(p.x, p.y)).toBe(L - d > FADE_U); // a pleno siempre a la vista; el fade de mar, nunca
    }
    expect(laneAt("out", 0).heading).toBeCloseTo(Math.atan2(56, 36), 6); // sale de la bocana hacia el sursureste
  });
```

```ts
  it("LANE_BACK nace fuera del cover y termina en la bocana (397, −39); agua, profundidad ≥ 6, Blog para x ≥ 380; el fade de mar cae en el sangrado", () => {
    expect(LANE_BACK[0]).toEqual({ x: 424, y: 600 });
    expect(inCoverQuad(424, 600)).toBe(false);
    expect(LANE_BACK[LANE_BACK.length - 1]).toEqual({ x: 397, y: -39 });
    expect(inCoverQuad(397, -39)).toBe(true);
    const L = laneLength("back");
    expect(Math.abs(L - 664.9)).toBeLessThan(5);
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("back", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(inCoverQuad(p.x, p.y)).toBe(d > FADE_U);
    }
  });
```

```ts
  it("separación: dos cargueros, uno en cada carril, nunca se tocan en pantalla", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    const backs = [] as Vec2[][];
    for (let d = 0; d <= Lb; d += 4) { const p = laneAt("back", d); backs.push(silhouette(p, p.heading)); }
    for (let d = 0; d <= Lo; d += 4) {
      const p = laneAt("out", d), s = silhouette(p, p.heading);
      for (const b of backs) expect(intersects(s, b)).toBe(false);
    }
  });

  it("la lancha pasa a más de 20 u de los dos carriles", () => {
    const ferry = polyline(FERRY_ROUTE);
    for (const lane of ["out", "back"] as const) for (let d = 0; d <= laneLength(lane); d += 2) {
      const p = laneAt(lane, d);
      for (let f = 0; f <= ferry.length; f += 2) { const q = ferry.at(f); expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(20); }
    }
  });
```

  (`polyline` se importa de `../iso/geometry`.) Las líneas `let crossedAbyss`, `if (t === "abyss") crossedAbyss = true;` y `expect(crossedAbyss).toBe(true)` desaparecen con el test viejo (decisión 6 del issue). El test "laneAt('back') interpola…" pasa a: último tramo `Math.atan2(-39 - 18, 397 - 434)` y primero `Math.atan2(237 - 600, 462 - 424)`. Los dos tests `expectNotBehind` quedan tal cual. El test de las boyas busca `d.at.x === 398` y `392`. El aserto `expect(a.state(0).heading).toBeCloseTo(Math.atan2(56, 36), 6)` se agrega al test "entrar a puerto" de la Task 1 tras la reaparición.

- [ ] **Step 3: Correr y ver que fallan.** `npx vitest run src/scenes/sea-anim.test.ts` → FAIL (vértices viejos).

- [ ] **Step 4: Implementación.** En `sea.ts`, los tres estáticos con los valores de Global Constraints; en `sea-anim.ts`, `LANE_OUT` y `LANE_BACK` nuevos. Correr el validador → `✔ sin violaciones`.

- [ ] **Step 5: Comentarios.** Reescribir en `sea-anim.ts` la cabecera del módulo (ruta y ciclo), el comentario de `LANE_OUT` (sale de la bocana al sursureste, bordea la punta por el este a ~25 u de su orilla porque los conos del arrecife de la cara norte obligan a x ≥ 424 en y ≈ 86; giros suaves; recto 420 u desde (420, 232); extremo de mar puesto para que el borde del cover caiga a `FADE_U`; fade de la bocana a la vista; validaciones; no mover más de 2 u) y el de `LANE_BACK` (misma curva 42 u al este, invertida; por qué 42 y no ~30: con 30 y 36 u dos cargueros a la par se superponen en pantalla, 42 es el mínimo sin solape; la lancha queda lejos). En `sea.ts`: cabecera y comentario del pecio/boyas (por qué se movieron: la ida pasaba por la boya vieja y un barco al oeste o norte de un sólido que se le superpone en pantalla queda detrás; las boyas marcan el bajo al sur de la punta, al oeste de la ida; el pecio sigue en la fosa, el talud `abyssX(262)` ≈ 473 pasa por su popa, 35 u al este de la vuelta).

- [ ] **Step 6: README y lab.** README (~19-25): los tres barcos aparecen en la bocana y recorren dos carriles paralelos, `LANE_OUT` baja hacia abajo-izquierda hasta salir del cover y `LANE_BACK` vuelve a la bocana, donde se desvanecen ("entran a puerto"); sin mencionar el fondeadero. `src/lab/blog.ts:3`: misma idea en una línea. `src/lab/docs.test.ts`: el primer test pasa a exigir `/bocana/`, `/dos carriles/`, `/abajo-izquierda/`; el de recorridos viejos agrega `fondeadero|BERTH` a la lista prohibida para README y lab (por eso el README dice "no fondean", nunca la palabra "fondeadero"); el último exige `/bocana/` y `/abajo-izquierda/` en el lab.

- [ ] **Step 7: Correr todo.** `npm test` y `npm run typecheck` → PASS. `grep -n -i "fondead\|dársena\|BERTH" src/scenes/sea-anim.ts src/scenes/sea.ts README.md src/lab/blog.ts` no debe describir el fondeadero como vigente.

- [ ] **Step 8: Commit.** `git commit -m "feat(#87): carriles semirrectos bocana → abajo-izquierda, boyas y pecio reubicados"`

### Task 3: Comprobación visual

**Files:** ninguno del repo (capturas en `.scratch/`, gitignored vía `.git/info/exclude`).

- [ ] **Step 1:** `npm run dev -- --host --port 5173` y el script `.scratch/evals-87.md` (agent-browser, `http://localhost:5173/map/lab/world.html?speed=20`, tecla `4`, 3-4 capturas separadas en el tiempo).
- [ ] **Step 2:** En cada captura: un barco bajando a abajo-izquierda y otro subiendo a la bocana, sin bucles ni oclusión por la punta, boyas o pecio. Estado de los barcos leído con `__PIXI_DEVTOOLS_WRAPPER__` / capas si hace falta.
- [ ] **Step 3:** Las capturas van adjuntas al PR (subidas como comentario/asset), no al repo.

## Assumptions

- **Transición en la Task 1** (carriles viejos con el ciclo nuevo): con `Lo ≈ 955`, `Lb ≈ 1164` (valores de los tests actuales), T ≈ 1810 s; la ida a pleno dura (955 − 60)/1.2 ≈ 746 s y la vuelta ≈ 920 s, ambas > T/3 ≈ 603 s, y dos barcos en el mismo carril distan T/3 · 1.2 ≈ 724 u. El test de cobertura nuevo pasa con ambos juegos de carriles. Alternativa descartada: una sola tarea para ciclo y geometría (no permite rechazar una sin la otra). El commit intermedio no llega solo a `main`: el PR va contra la rama de la historia y se mezcla con squash.
- **Docs test:** se prohíbe `fondeadero|BERTH` en README y lab en vez de pedir "sin fondeadero" literal. Alternativa descartada: exigir la frase "sin fondeadero" (choca con la prohibición).
- **`src/lab/blog.ts` y `src/lab/docs.test.ts`** se tocan aunque el issue no los nombre: el test de docs exige hoy la frase "fondeadero de la dársena del astillero" en el README, que el issue manda reescribir.
- **`.scratch/evals-87.md`** se crea en la etapa de evals del pipeline y `.scratch/` va a `.git/info/exclude` en ese momento.

## Grilling

- Rondas: 1 (los cambios fueron correcciones puntuales, no un corte distinto). Preguntas: 17. Griller: `fable`.
- Fuentes: ISSUE 7 (1, 3, 7, 11, 12, 13, 16), CODE 9 (5, 6, 8, 9, 10, 14, 15, 17, 13), DOC 1 (17: CLAUDE.md), NO SOURCE → technical assumption 3 (2, 4, 17-parcial). Ninguna ambigüedad de spec, ningún fuera de alcance.
- Respuestas:
  1. ISSUE, "Criterios de aceptación" (mapeo agregado arriba); `PORT_MS`: ISSUE "Exportar `PORT_MS`"; Task 3: ISSUE "Comprobación visual mínima en `http://localhost:5173/map/lab/world.html?speed=20`".
  2. Contradicción real del plan; corregida (assumption "Docs test").
  3. ISSUE trae el validador completo en `<details>` (terreno, `depthAt`, zona, cover con fade, oclusión, lancha, solape de siluetas); salida registrada en el comentario de la etapa 1 (`✔ sin violaciones`).
  4. Cálculo en Assumptions, con CODE `src/scenes/sea-anim.test.ts` (largos 955 / 1164).
  5. CODE `src/scenes/sea-anim.ts:203` — `cycle[k] = (cycle[k]! + dtMs) % CYCLE_MS`: módulo, sin clamp.
  6. CODE `src/scenes/sea-anim.ts:164` — offscreen devuelve exactamente `{ solids: [], lights: [], wake: [], alpha: 0 }`.
  7. ISSUE: "`inCoverQuad` verdadero para todo punto a más de `FADE_U` del extremo de mar y falso para los últimos `FADE_U`" y "`LANE_OUT[0]` es la bocana `(362, −16)` … su último punto `(397, −39)`"; el validador comprueba esa misma igualdad cada 1 u. Mover un vértice exige revalidar y actualizar el test (Global Constraints).
  8. CODE `src/map/geo.ts:19,28` — `WORLD` (−60..570, −60..336) y `BLEED` (342, 378): el sangrado llega a y = 714; los tests ya usan `bleedTerrainAt` fuera de `WORLD`.
  9. CODE `src/scenes/sea-anim.test.ts` — `staticsOf(world(7).solids)`: toma todos los sólidos de la escena (incluye los de `sea.ts`, construidos desde `BUOYS`/`WRECK`), cada 4 u, sin mirar alpha.
  10. CODE `src/scenes/sea.test.ts:51-64` — compara contra `BUOYS`, `WRECK_BUOY`, `WRECK` importados; la fosa la afirma ISSUE ("el talud `abyssX(262)` ≈ 473 pasa por su popa"), CODE `src/map/geo.ts:66`.
  11. CODE `src/scenes/sea-anim.test.ts:50-59`; ISSUE decisión 6 "Dejar de exigir que la ida cruce la fosa (`crossedAbyss` en el test)"; borrado explícito agregado a Task 2 Step 2.
  12. ISSUE decisión 4: "con 30 y con 36 u de separación lateral dos cargueros a la par se superponen en pantalla (el validador lo detecta); 42 u es el mínimo probado"; muestreo de 4 u igual al test actual (CODE `sea-anim.test.ts`, test de separación) y al validador.
  13. CODE `src/scenes/sea-animator.ts:18` — `sea.wake${k}` siempre se emite con `alpha: f.alpha`; ISSUE "fase 0 (`sea.wake0`) ahora tiene alpha 0".
  14. CODE `src/scenes/sea-anim.ts:203` — los estados se recalculan con `shipStateAt` puro; no hay suavizado. Review Focus 1 se mantiene como guarda de regresión.
  15. CODE `src/scenes/sea-anim.ts:91` (`lanes`) y `:109` (`OUT_MS`, `BACK_MS` = `laneLength / LANE_SPEED * 1000`), ambos después de `LANE_OUT`/`LANE_BACK` (`:43`, `:54`).
  16. ISSUE: "PR contra `feature/85-barcos-semirrecta`"; el merge del pipeline es squash (ver Assumptions).
  17. CODE `src/lab/page.ts:11` (tecla `4` = cover) y `:71-72` (`?speed=`); DOC CLAUDE.md (agent-browser); `.scratch/` en Assumptions.
- Issues abiertos: ninguno.
