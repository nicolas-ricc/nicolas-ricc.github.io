# Storybook 2 (#93): catálogo completo de regiones con test de no-vacío — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el índice de `/lab/storybook.html` lista las 38 regiones de la tabla de la spec §3, agrupadas por zona (fábrica, astillero, hinterland, feria, ciudad, tecnológico, mar) y en ese orden; cada una encuadra su estructura entera con `h` según su altura real y sin vecinos altos cortados por el borde.

**Architecture:** el catálogo es dato puro en `src/lab/exhibits.ts`. Se agrega un campo `group` al `Exhibit` (el grupo del índice: "Portfolio: fábrica", …) con la lista ordenada `GROUPS`; `src/lab/storybook.ts` arma el índice por grupo en vez de por `WorldZone`. Las cajas salen de las constantes exportadas de cada escena; donde la constante es privada la caja va a mano con un comentario. `exhibits.test.ts` vigila contra `world(SEED)` (vía `assembleWorld`) que cada región recorte sólidos, que `h` cubra la estructura sin sobrar, y que ningún vecino cortado por el borde suba más que `h`.

**Tech Stack:** TypeScript estricto, Vite, Vitest (sin Pixi en tests), PixiJS v8 solo en la página.

**Spec:** `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §3 (lista inicial) y §8 (test de no-vacío); issue #93 (manda sobre la spec donde difieren).

## Global Constraints

- `src/lab/exhibits.ts` no importa Pixi; `src/iso/` no importa Pixi; `Math.random` prohibido; ningún hex fuera de `src/map/palette-iso.ts`.
- `ids` en minúsculas sin acentos, `^[a-z0-9-]+$`, únicos.
- Cajas desde constantes exportadas donde existan; donde la constante es privada (gradas, dársena, pórtico, subestación, cinta, y además muelle de la feria, calle de faroles, naves, torre de enfriamiento de la fábrica) la caja va a mano y el test la vigila.
- Si una estructura no se puede aislar sin cortar a otra, se elige la caja que mejor la muestra y se anota en un comentario de la entrada; **no se cambian las escenas**.
- Comentarios y nombres de tests en castellano; tests al lado del módulo. Sin dependencias nuevas. Commits `feat(#93): …`.
- `npm test` y `npm run typecheck` en verde; `lab/world.html` no cambia: el código que se toca vive solo en `src/lab/` (fuera de ahí solo entran las capturas en `docs/superpowers/specs/assets/93-storybook/`).

## Decisiones técnicas (declaradas)

1. **Grupo del índice.** El issue pide el índice "agrupado por zona" con siete grupos (fábrica, astillero, …), pero `WorldZone` tiene tres valores. Se agrega `group: GroupId` al `Exhibit` y `GROUPS` (lista ordenada `{ id, zone, title }`); `zone` se conserva como manda la spec §3 y el test exige que coincida con la del grupo. `ZONE_TITLE` deja de usarse y se borra (su único consumidor es `storybook.ts`).
2. **Encuadre medible.** "Encuadra bien (`h` según su altura real)" se vuelve test: sea `zEstática` la z máxima de los sólidos estáticos (`ground` + `solids` de `cropScene`) enteramente dentro de la caja y `zTodo` la misma z sumando los sólidos iniciales de las capas animadas recortadas. Se exige `zEstática ≤ h ≤ zTodo + 8`. Las capas animadas no entran en la cota inferior porque se mueven (el humo de las chimeneas pasa por encima de la subestación); sí en la superior, para que la noria (rueda animada, 43) y el humo valgan. Sin `h` cuenta 30 (`FRAME_H` de `frame.ts`), así que una estructura baja necesita su `h`.
3. **"Sin vecinos que la tapen" medible.** Ningún sólido estático que el recorte conserva sin estar entero dentro de la caja (un vecino cortado por el borde) puede subir más que `h`. Se excluyen los `kind: "ground"` (mallas de piso). Las capas animadas quedan fuera: se mueven.
4. **El animado se exige solo a los cuatro exhibits de #92** (`chimeneas`, `noria`, `torre`, `faro`): el resto de las regiones son estáticas (tanques, silos) y el issue solo pide un sólido.
5. **Margen `M = 3`**, como #92, salvo donde un vecino obliga a ajustar un lado (comentado en la entrada).
6. **Casos que no se pueden aislar** (anotados en la entrada): la grúa pórtico monta sobre las gradas y queda dentro de "gradas"; la grúa torre del desvío queda dentro de "playa de camiones" y de "cinta" (la cinta corre 93 u por la playa de camiones); la torre de oficinas está en el centro de la plaza. El issue pide "la estructura completa", así que las estructuras largas van enteras aunque encuadren finas: el malecón (168 u), la línea de alta tensión (8 torres, 336 u), las dos boyas. "Torres" toma las dos torres de la fila `ROWS[1]` (el distrito tiene decenas: es un ejemplo del tipo, no una estructura única).
7. **`torre` pasa de `h: TOWER_H + 6` a `TOWER_H + 8`**: la antena llega a z 37.9 y el test de encuadre lo exige.
8. **Dársena** es el fondeadero del astillero (`BERTH` en `sea-anim.ts`, #83), frente al muelle `QUAY_X`, no el dique seco: la spec §3 pone la dársena entre las constantes privadas, y el dique seco tiene la constante exportada `DOCK` (`src/map/geo.ts:142`); `sea-anim.ts:25` llama "dársena del astillero" al fondeadero.
9. **Piezas de #94.** Las piezas también llevan `group`: el de su fila en la tabla de la spec §3 (grúa torre y farol en `astillero`, campus y selva en `ciudad`, barcos en `mar`), y van dentro del bloque de su grupo para que el test de contigüidad siga en verde. El test de catálogo solo cuenta regiones.
10. **Capturas en el PR**: una región por grupo, guardadas en `docs/superpowers/specs/assets/93-storybook/` (como hizo #92) y enlazadas por SHA.

## Review Focus

1. Una región cuya escena se muda o cuyo rng deja la caja vacía → test rojo con el id en el mensaje, no un exhibit vacío (Task 2, `no-vacío`).
2. Un vecino alto que entra por el borde de la caja (árbol, edificio de la manzana de al lado) → test rojo (Task 2, `vecinos`).
3. Una estructura baja con el `h` por defecto de 30 → queda chica en el cuadro; test rojo por la cota superior (Task 2, `encuadre`).
4. Orden del índice y del recorrido con flechas: `stepExhibit` recorre `EXHIBITS` en orden, así que los grupos tienen que ser contiguos y en el orden de `GROUPS` (Task 1).
5. Hash sin cambio: `pickExhibit("")` ahora devuelve `planta` (el primero) y los tests de selección no dependen de un id fijo (Task 1, los tests existentes ya usan `EXHIBITS[0]`).

---

## File Structure

- Modify: `src/lab/exhibits.ts` — `GroupId`, `GROUPS`, campo `group`, las 38 entradas.
- Modify: `src/lab/exhibits.test.ts` — completitud por grupo, encuadre, vecinos.
- Modify: `src/lab/storybook.ts` — índice por grupo.

## Shared test code (lo escribe la etapa de evals, antes de las tareas)

Reemplaza el `describe("catálogo de exhibits", …)` de `src/lab/exhibits.test.ts`; el `describe("selección por hash", …)` queda igual.

```ts
import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../iso/solids";
import { BLEED, WORLD } from "../map/geo";
import { assembleWorld } from "../world/assemble";
import type { Box } from "../world/frame";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS, GROUPS, type GroupId, pickExhibit, stepExhibit } from "./exhibits";

const regions = EXHIBITS.flatMap((e) => (e.kind === "region" ? [e] : []));

// el índice de la spec §3, en orden; las piezas (#94) no cuentan
const CATALOG: Record<GroupId, string[]> = {
  fabrica: ["planta", "chimeneas", "subestacion", "playa-camiones", "playa-vias", "cinta"],
  astillero: ["gradas", "darsena", "grua-portico", "calle-faroles", "naves"],
  hinterland: ["central-termica", "tanques", "silos", "alta-tension", "playa-contenedores"],
  feria: ["noria", "montana-rusa", "torre-caida", "carrusel", "arcade", "autitos-chocadores", "muelle"],
  ciudad: ["plaza", "torre", "puente", "malecon", "manzana-derrumbada", "manzana-distrito", "obra"],
  tecnologico: ["mastil", "arena", "auditorio", "torres"],
  mar: ["faro", "casa-farero", "boyas", "pecio"],
};
const ANIMATED = ["chimeneas", "noria", "torre", "faro"];
const FRAME_H = 30; // el de frame.ts, cuando el exhibit no trae h
const SLACK = 8;    // más alto que esto sobre la estructura y queda chica en el cuadro

const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
const within = (s: Solid, b: Box): boolean => { const r = bounds(s); return r.min.x >= b.x0 && r.max.x <= b.x1 && r.min.y >= b.y0 && r.max.y <= b.y1; };
const top = (solids: readonly Solid[]): number => Math.max(0, ...solids.map((s) => bounds(s).max.z));

/** Alturas de lo que la caja recorta: estático adentro, estático + capas animadas adentro, y el vecino cortado más alto. */
function measure(box: Box): { inside: number; withAnim: number; neighbour: number } {
  const cs = cropScene(scene, box);
  const fixed = [...cs.ground, ...cs.solids];
  const anim = cropAnimators(animators, box).flatMap((a) => a.ids.flatMap((id) => { const l = a.layer(id); return l.kind === "solid" ? l.solids : []; }));
  const inside = top(fixed.filter((s) => within(s, box)));
  return {
    inside,
    withAnim: Math.max(inside, top(anim.filter((s) => within(s, box)))),
    neighbour: top(fixed.filter((s) => s.kind !== "ground" && !within(s, box))),
  };
}

describe("catálogo de exhibits", () => {
  it("ids únicos con el patrón del hash", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("los grupos del índice son contiguos, en el orden de GROUPS y con la zona de su grupo", () => {
    const order = GROUPS.map((g) => g.id);
    const seen = EXHIBITS.map((e) => e.group).filter((g, i, all) => i === 0 || all[i - 1] !== g);
    expect(seen).toEqual(order.filter((g) => seen.includes(g)));
    for (const e of EXHIBITS) expect(e.zone, e.id).toBe(GROUPS.find((g) => g.id === e.group)!.zone);
  });
  it("cada caja cae dentro del mundo más el sangrado y no está invertida", () => {
    for (const { id, box } of regions) {
      expect(box.x0, id).toBeLessThan(box.x1); expect(box.y0, id).toBeLessThan(box.y1);
      expect(box.x0, id).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(box.x1, id).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(box.y0, id).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(box.y1, id).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
  });
  it("los cuatro exhibits de #92 recortan un animador que no es el agua", () => {
    for (const id of ANIMATED) {
      const e = regions.find((r) => r.id === id)!;
      expect(cropAnimators(animators, e.box).some((a) => a.zone !== null), id).toBe(true);
    }
  });

  describe.each(GROUPS.map((g) => g.id))("grupo %s", (group) => {
    const mine = regions.filter((e) => e.group === group);
    it("tiene las regiones de la spec, en orden", () => {
      expect(mine.map((e) => e.id)).toEqual(CATALOG[group]);
    });
    it("no-vacío: contra el mundo real cada región recorta al menos un sólido", () => {
      for (const e of mine) expect(cropScene(scene, e.box).solids.length, e.id).toBeGreaterThan(0);
    });
    it("encuadre: h cubre la estructura y no sobra más de SLACK", () => {
      for (const e of mine) {
        const h = e.h ?? FRAME_H, m = measure(e.box);
        expect(h, e.id).toBeGreaterThanOrEqual(m.inside);
        expect(h, e.id).toBeLessThanOrEqual(m.withAnim + SLACK);
      }
    });
    it("vecinos: ningún sólido cortado por el borde sube más que h", () => {
      for (const e of mine) expect(measure(e.box).neighbour, e.id).toBeLessThanOrEqual(e.h ?? FRAME_H);
    });
  });
});
```

Los `it` por grupo son los que cada tarea pone en verde: una tarea que llena el grupo `fabrica` corre `npx vitest run src/lab/exhibits.test.ts -t "grupo fabrica"`.

---

### Task 1: grupos del índice

**Files:**
- Modify: `src/lab/exhibits.ts`
- Modify: `src/lab/storybook.ts:9,22-32`
- Test: `src/lab/exhibits.test.ts` (código compartido de arriba)

**Interfaces:**
- Produces: `export type GroupId = "fabrica" | "astillero" | "hinterland" | "feria" | "ciudad" | "tecnologico" | "mar"`; `export const GROUPS: readonly { id: GroupId; zone: WorldZone; title: string }[]`; `Exhibit` gana `group: GroupId`. `ZONE_TITLE` se borra.

- [ ] **Step 1: el test ya está escrito (etapa de evals).** Correr `npx vitest run src/lab/exhibits.test.ts -t "contiguos"`. Esperado: FAIL de compilación/import (`GROUPS` no existe).

- [ ] **Step 2: implementar en `exhibits.ts`.** Reemplazar el tipo y `ZONE_TITLE`:

```ts
export type GroupId = "fabrica" | "astillero" | "hinterland" | "feria" | "ciudad" | "tecnologico" | "mar";

/** Grupos del índice, en orden: la tabla de la spec §3. */
export const GROUPS: readonly { id: GroupId; zone: WorldZone; title: string }[] = [
  { id: "fabrica", zone: "portfolio", title: "Portfolio: fábrica" },
  { id: "astillero", zone: "portfolio", title: "Portfolio: astillero" },
  { id: "hinterland", zone: "portfolio", title: "Portfolio: hinterland" },
  { id: "feria", zone: "portfolio", title: "Portfolio: feria" },
  { id: "ciudad", zone: "cv", title: "Resume: ciudad" },
  { id: "tecnologico", zone: "cv", title: "Resume: tecnológico" },
  { id: "mar", zone: "blog", title: "Blog: mar" },
];

/** Una estructura para mirar sola: una caja sobre el mundo real o una pieza reubicable armada en el origen. */
export type Exhibit = { id: string; title: string; zone: WorldZone; group: GroupId } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void }
);
```

y agregar `group` a las cuatro entradas existentes, reordenándolas por grupo: `chimeneas` → `group: "fabrica"`, `noria` → `"feria"`, `torre` → `"ciudad"`, `faro` → `"mar"`. Títulos sin la coletilla de zona (el grupo ya la dice): "Chimeneas y torre de enfriamiento", "Noria", "Torre de oficinas", "Faro".

- [ ] **Step 3: índice por grupo en `storybook.ts`.** Import: `import { EXHIBITS, type Exhibit, GROUPS, pickExhibit, stepExhibit } from "./exhibits";`. El bucle:

```ts
for (const g of GROUPS) {
  const mine = EXHIBITS.filter((x) => x.group === g.id);
  if (!mine.length) continue;
  const h = document.createElement("h2");
  h.textContent = g.title;
  const ul = document.createElement("ul");
  for (const e of mine) {
    const a = document.createElement("a");
    a.href = `#${e.id}`; a.textContent = e.title; a.dataset.id = e.id;
    const li = document.createElement("li"); li.appendChild(a); ul.appendChild(li);
  }
  nav.append(h, ul);
}
```

- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts -t "contiguos|ids únicos|sangrado|#92|hash"` → PASS. `npm run typecheck` → limpio. (Los `grupo …` siguen rojos hasta las tareas 2–5.)

- [ ] **Step 5: commit** `feat(#93): grupos del índice del storybook`.

### Task 2: Portfolio — fábrica y astillero

**Files:** Modify `src/lab/exhibits.ts`. Test: `exhibits.test.ts`, `-t "grupo fabrica|grupo astillero"`.

**Interfaces:** Consumes `GroupId`, `M`, `Exhibit` de la Task 1. Imports nuevos: `PLANT, RAIL_YARD_X` de `../scenes/factory`; `MOUTH_Y, QUAY_X` de `../map/geo`.

- [ ] **Step 1:** `npx vitest run src/lab/exhibits.test.ts -t "grupo fabrica|grupo astillero"` → FAIL (faltan regiones).
- [ ] **Step 2:** en `EXHIBITS`, el grupo `fabrica` (reemplaza la entrada `chimeneas` existente, conserva su caja salvo `x1`/`y1`) y luego `astillero`:

```ts
  // fábrica
  // al sur 1 u: la grúa torre del desvío (y −12) queda afuera
  { id: "planta", title: "Planta de ladrillo", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: PLANT.x - M, y0: PLANT.y - M, x1: PLANT.x + PLANT.w + M, y1: PLANT.y + PLANT.d + 1 }, h: PLANT.h + 4 }, // dientes de sierra
  // el humo deriva al NNE hasta PUFF_RANGE: la caja se estira al norte para no cortar la columna (la subestación queda adentro, detrás)
  // la torre de enfriamiento es privada en factory.ts: (172, −36), r 9
  { id: "chimeneas", title: "Chimeneas y torre de enfriamiento", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: Math.min(...stacksX) - stackR - M, y0: Math.min(...stacksY) - stackR - PUFF_RANGE, x1: 172 + 9 + M, y1: -36 + 9 + M },
    h: stackTop + PUFF_RANGE * PUFF_LIFT },
  // a mano: cerco 149..190 × −60..−47 (privado en factory.ts); y1 −46 deja afuera la torre de enfriamiento (y ≥ −45). El humo pasa por encima
  { id: "subestacion", title: "Subestación", zone: "portfolio", group: "fabrica", kind: "region", box: { x0: 146, y0: -63, x1: 193, y1: -46 }, h: 10 },
  // a mano: camiones y pallets de truckYard; la grúa torre (60, −12) está en medio de la playa y queda adentro
  { id: "playa-camiones", title: "Playa de camiones", zone: "portfolio", group: "fabrica", kind: "region", box: { x0: 17, y0: -15, x1: 113, y1: 2 }, h: 22 },
  { id: "playa-vias", title: "Playa de vías", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: RAIL_YARD_X[0] - 4, y0: 40, x1: -4, y1: 100 }, h: 10 }, // vías, vagones y acopios de mineral
  // a mano: del portón este (x 121, y −20) al patio de material (x 30, y 1..3); la grúa torre del desvío queda adentro y manda en h
  { id: "cinta", title: "Cinta transportadora", zone: "portfolio", group: "fabrica", kind: "region", box: { x0: 28, y0: -15, x1: 125, y1: 4 }, h: 22 },
  // astillero: las constantes de shipyard.ts son privadas, las cajas van a mano
  // gradas x 110..QUAY_X, y 36..72; el pórtico (x 150) monta sobre ellas y queda adentro
  { id: "gradas", title: "Gradas", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 108, y0: 33, x1: QUAY_X + 2, y1: 75 }, h: 28 },
  // el fondeadero BERTH (232, 50) entre el muelle y la escollera, desde la bocana
  { id: "darsena", title: "Dársena", zone: "portfolio", group: "astillero", kind: "region", box: { x0: QUAY_X - 2, y0: MOUTH_Y, x1: 275, y1: 80 }, h: 12 },
  { id: "grua-portico", title: "Grúa pórtico", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 146, y0: 30, x1: 156, y1: 78 }, h: 28 },
  // calle de transferencia x 100..108 con los faroles en 108.5; entre las naves (x ≤ 98) y las gradas (x ≥ 110)
  { id: "calle-faroles", title: "Calle de faroles", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 99, y0: 8, x1: 111, y1: 128 }, h: 7 },
  // las dos naves de montaje: x 8..98, filas y 36 y 56 de 16
  { id: "naves", title: "Naves de montaje", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 5, y0: 33, x1: 101, y1: 75 }, h: 14 },
```

- [ ] **Step 3:** `npx vitest run src/lab/exhibits.test.ts -t "grupo fabrica|grupo astillero"` → PASS. Si una caja falla (vecino o encuadre), ajustar ese lado o `h` según el mensaje y dejar el porqué en el comentario; no tocar escenas.
- [ ] **Step 4:** `npm run typecheck` limpio. Commit `feat(#93): regiones de la fábrica y el astillero`.

### Task 3: Portfolio — hinterland y feria

**Files:** Modify `src/lab/exhibits.ts`. Test: `-t "grupo hinterland|grupo feria"`.

**Interfaces:** imports nuevos: `CONTAINER_YARD, COOLING, POWER, PYLON_H, PYLON_N, PYLON_STEP, PYLON_X0, PYLON_Y, SILOS, STACKS_N, TANKS` de `../scenes/hinterland`; `ARCADE, BUMPER, CAROUSEL, COASTER, DROP, PIER` (más `WHEEL`, ya importado) de `../scenes/fair`.

- [ ] **Step 1:** test → FAIL.
- [ ] **Step 2:** grupos `hinterland` y `feria` (la entrada `noria` existente pasa a ser la primera de `feria`):

```ts
  // hinterland
  { id: "central-termica", title: "Central térmica y torre de enfriamiento", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: COOLING.x - COOLING.r - M, y0: POWER.y - M, x1: STACKS_N[0].x + 2 + M, y1: COOLING.y + COOLING.r + M }, h: 30 }, // chimeneas de 28
  // radio de tanque rng 7..9
  { id: "tanques", title: "Tanques", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: Math.min(...tanksX) - 9 - M, y0: Math.min(...tanksY) - 9 - M, x1: Math.max(...tanksX) + 9 + M, y1: Math.max(...tanksY) + 9 + M }, h: 12 },
  { id: "silos", title: "Silos", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: SILOS.x0 - SILOS.r - M, y0: SILOS.y0 - SILOS.r - M, x1: SILOS.x0 + (SILOS.cols - 1) * SILOS.step + SILOS.r + M, y1: SILOS.y0 + (SILOS.rows - 1) * SILOS.step + SILOS.r + M },
    h: SILOS.h + 4 }, // elevador de granos h + 3
  // la línea entera, 336 u: encuadra fina; la montaña rusa y los autitos quedan cortados por el borde sur, más bajos
  { id: "alta-tension", title: "Línea de alta tensión", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: PYLON_X0 - 4, y0: PYLON_Y - 4, x1: PYLON_X0 + (PYLON_N - 1) * PYLON_STEP + 4, y1: PYLON_Y + 4 }, h: PYLON_H + 2 },
  // las grúas de la playa van de y0 − 4 a la última fila + 6
  { id: "playa-contenedores", title: "Playa de contenedores", zone: "portfolio", group: "hinterland", kind: "region",
    box: { x0: CONTAINER_YARD.x0 - M, y0: CONTAINER_YARD.y0 - 4 - M, x1: CONTAINER_YARD.x1 + M, y1: CONTAINER_YARD.y0 + (CONTAINER_YARD.rows - 1) * CONTAINER_YARD.rowStep + 6 + M }, h: 13 },
  // feria
  { id: "noria", /* … entrada existente, title "Noria", group: "feria" … */ },
  { id: "montana-rusa", title: "Montaña rusa", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: COASTER.x0 - M, y0: COASTER.y0 - M, x1: COASTER.x1 + M, y1: COASTER.y1 + M }, h: 17 }, // perfil hasta 14
  { id: "torre-caida", title: "Torre de caída", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: DROP.x - 5, y0: DROP.y - 5, x1: DROP.x + 5, y1: DROP.y + 5 }, h: DROP.h + 3 },
  { id: "carrusel", title: "Carrusel", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: CAROUSEL.x - 9, y0: CAROUSEL.y - 9, x1: CAROUSEL.x + 9, y1: CAROUSEL.y + 9 }, h: 11 }, // luces a r 6.5
  // al oeste pegado al alero (x − 1): el portal de la feria llega a x 94.75; al norte la montaña rusa llega a y −193
  { id: "arcade", title: "Arcade", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: ARCADE.x - 1, y0: ARCADE.y - 0.5, x1: ARCADE.x + 24 + M, y1: ARCADE.y + 14 + M }, h: 10 },
  // al norte pegado: la montaña rusa llega a y −193
  { id: "autitos-chocadores", title: "Autitos chocadores", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: BUMPER.x - M, y0: BUMPER.y - 0.5, x1: BUMPER.x + 14 + M, y1: BUMPER.y + 10 + M }, h: 6 },
  // el muelle arranca en x 227 (bayShoreX en fair.ts, privado)
  { id: "muelle", title: "Muelle de la feria", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: 227 - M, y0: PIER.y - M, x1: 227 + PIER.len + M, y1: PIER.y + PIER.d + 6 }, h: 10 },
```

con `const tanksX = TANKS.map((t) => t.x), tanksY = TANKS.map((t) => t.y);` junto a `stacksX`.

- [ ] **Step 3:** test → PASS (mismo criterio de ajuste que la Task 2). **Step 4:** typecheck; commit `feat(#93): regiones del hinterland y la feria`.

### Task 4: Resume — ciudad y tecnológico

**Files:** Modify `src/lab/exhibits.ts`. Test: `-t "grupo ciudad|grupo tecnologico"`.

**Interfaces:** imports nuevos de `../scenes/city-grid`: `BLOCK_D, BLOCK_W, BRIDGE, COLLAPSED, DISTRICT_COLS, DISTRICT_ROWS, EAST_COLS, MALECON, PLAZA, ROWS, SITE, WEST_COLS` (más `TOWER, TOWER_H`); `ARENA, AUDITORIUM, TELECOM` de `../scenes/tech`; `SUBURB_COLS` de `../scenes/sprawl-grid`.

- [ ] **Step 1:** test → FAIL.
- [ ] **Step 2:**

```ts
  // ciudad
  // la torre de oficinas está en el centro de la plaza: queda adentro
  { id: "plaza", title: "Plaza", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: PLAZA.x - M, y0: PLAZA.y - M, x1: PLAZA.x + PLAZA.w + M, y1: PLAZA.y + PLAZA.d + M }, h: TOWER_H + 8 },
  // entrada existente; h + 8: la antena llega a z 37.9
  { id: "torre", title: "Torre de oficinas", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: TOWER.x - M, y0: TOWER.y - M, x1: TOWER.x + TOWER.w + M, y1: TOWER.y + TOWER.d + M }, h: TOWER_H + 8 },
  // de rampa a rampa; al oeste y al este pegado a las manzanas vecinas (edificios hasta 10.7), al norte los árboles de la ribera
  { id: "puente", title: "Puente", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: WEST_COLS[WEST_COLS.length - 1] + BLOCK_W + 0.5, y0: BRIDGE.y0 - 1, x1: EAST_COLS[0] + 1, y1: BRIDGE.y1 + M }, h: 8 },
  // entero, 168 u: encuadra fino. Al oeste pegado y al norte 2 u adentro: los árboles de la selva del cinturón (hasta 8.4) quedan afuera
  { id: "malecon", title: "Malecón", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: MALECON.x0 - 1, y0: MALECON.y0 + 2, x1: MALECON.x1 + M, y1: MALECON.y1 + M }, h: 7 },
  // la losa caída llega a x − 16; al sur pegado, la selva
  { id: "manzana-derrumbada", title: "Manzana derrumbada", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: COLLAPSED.x - 16 - M, y0: COLLAPSED.y - M, x1: COLLAPSED.x + COLLAPSED.w + M, y1: COLLAPSED.y + COLLAPSED.d + 1 }, h: 6 },
  { id: "manzana-distrito", title: "Manzana del distrito", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: DISTRICT_COLS[0] - M, y0: DISTRICT_ROWS[1] - M, x1: DISTRICT_COLS[0] + BLOCK_W + M, y1: DISTRICT_ROWS[1] + BLOCK_D + M }, h: 12 },
  { id: "obra", title: "Obra en construcción", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: SITE.x - M, y0: SITE.y - M, x1: SITE.x + SITE.w + M, y1: SITE.y + SITE.d + M }, h: 25 },
  // tecnológico: cada estructura ocupa una manzana BLOCK_W × BLOCK_D
  { id: "mastil", title: "Mástil de telecomunicaciones", zone: "cv", group: "tecnologico", kind: "region",
    box: { x0: TELECOM.x - M, y0: TELECOM.y - M, x1: TELECOM.x + BLOCK_W + M, y1: TELECOM.y + BLOCK_D + M }, h: 26 },
  { id: "arena", title: "Arena", zone: "cv", group: "tecnologico", kind: "region",
    box: { x0: ARENA.x - M, y0: ARENA.y - M, x1: ARENA.x + BLOCK_W + M, y1: ARENA.y + BLOCK_D + M }, h: 15 },
  { id: "auditorio", title: "Auditorio", zone: "cv", group: "tecnologico", kind: "region",
    box: { x0: AUDITORIUM.x - M, y0: AUDITORIUM.y - M, x1: AUDITORIUM.x + BLOCK_W + M, y1: AUDITORIUM.y + BLOCK_D + M }, h: 14 },
  // las dos torres de la fila ROWS[1], columnas SUBURB_COLS[1] y [0]; la altura sale del rng: el test la vigila
  { id: "torres", title: "Torres del distrito tecnológico", zone: "cv", group: "tecnologico", kind: "region",
    box: { x0: SUBURB_COLS[1] - M, y0: ROWS[1] - M, x1: SUBURB_COLS[0] + BLOCK_W + M, y1: ROWS[1] + BLOCK_D + M }, h: 22 },
```

- [ ] **Step 3:** test → PASS. **Step 4:** typecheck; commit `feat(#93): regiones de la ciudad y el distrito tecnológico`.

### Task 5: Blog — mar

**Files:** Modify `src/lab/exhibits.ts`. Test: `-t "grupo mar"` y luego `npm test` entero.

**Interfaces:** imports nuevos de `../scenes/sea`: `BUOYS, KEEPER, WRECK` (más `DRUM_R0, LIGHTHOUSE`).

- [ ] **Step 1:** test → FAIL.
- [ ] **Step 2:** después de `faro` (existente, `group: "mar"`):

```ts
  // la casa es 8 × 6 (privado en sea.ts)
  { id: "casa-farero", title: "Casa del farero", zone: "blog", group: "mar", kind: "region",
    box: { x0: KEEPER.x - M, y0: KEEPER.y - M, x1: KEEPER.x + 8 + M, y1: KEEPER.y + 6 + M }, h: 13 }, // sobre la punta, z ≈ 7
  // las dos boyas, a 80 u una de otra: encuadra fino. Al oeste 5 u: las rocas de la punta (z 7) quedan afuera
  { id: "boyas", title: "Boyas", zone: "blog", group: "mar", kind: "region",
    box: { x0: BUOYS[0]!.x - 5, y0: BUOYS[0]!.y - 5, x1: BUOYS[1]!.x + 5, y1: BUOYS[1]!.y + 5 }, h: 4 },
  // el casco mide 40 u a 30°: llega a (497, 170); la boya del pecio queda adentro
  { id: "pecio", title: "Pecio", zone: "blog", group: "mar", kind: "region",
    box: { x0: WRECK.x - 5, y0: WRECK.y - 5, x1: WRECK.x + 38, y1: WRECK.y + 26 }, h: 9 },
```

- [ ] **Step 3:** `npx vitest run src/lab/exhibits.test.ts` → todo PASS. `npm test` y `npm run typecheck` → verde.
- [ ] **Step 4:** commit `feat(#93): regiones del mar`.

### Task 6: verificación visual (sin código salvo ajustes)

- [ ] `npm run dev -- --host --port 5173`; correr `.scratch/evals-93.md` (lo escribe la etapa de evals del pipeline, antes de la Task 1; no se versiona) con agent-browser (viewport 1600 900 2): el índice muestra los siete grupos en orden con sus 38 entradas; cada exhibit dibuja algo; una captura por grupo (`planta`, `gradas`, `central-termica`, `montana-rusa`, `puente`, `arena`, `pecio`) en `docs/superpowers/specs/assets/93-storybook/`.
- [ ] `lab/world.html` sigue dibujando igual (no se tocó nada fuera de `src/lab/`).
- [ ] Si una caja se ve mal (estructura cortada, vecino que tapa), ajustarla con su comentario, volver a correr el test. Commit `feat(#93): capturas del catálogo`.

## Criterios de aceptación → tareas

- "`exhibits.test.ts`: ids únicos y con el patrón; cada región dentro del mundo más sangrado; contra `world(SEED)` cada región recorta al menos un sólido" → código de test compartido (etapa de evals); verde al cerrar la Task 5.
- "Todas las regiones de la tabla presentes; captura de una región por zona en el PR" → tests `grupo …` (Tasks 2–5) y capturas (Task 6).
- "`npm test` y `npm run typecheck` en verde" → Task 5 Step 3 y Task 6.
- "Cada una encuadra bien (`h` según su altura real) y muestra la estructura completa sin vecinos que la tapen" → tests de encuadre y vecinos (Tasks 2–5) y la revisión visual de la Task 6.

## Assumptions

Decididas en la revisión del plan, sin fuente escrita; cualquier opción razonable cumple el issue.

1. **Commits intermedios en rojo.** Las tareas 2–4 hacen commit con los `grupo …` de las tareas siguientes todavía en rojo. El pipeline pide commitear primero los tests de evals fallando, y CI solo corre sobre el PR (rama entera). Alternativa descartada: marcar con `it.skip` los grupos pendientes y quitarlo tarea por tarea, que agrega pasos y no cambia el resultado.
2. **Reubicación privada no detectada.** Si una estructura privada se muda y la caja vieja encuadra otra cosa no vacía de altura parecida, ningún test lo nota: se acepta como no testeado, cubierto por la revisión visual. Alternativa descartada: fijar un conteo exacto de sólidos por región, que se rompe con cualquier retoque legítimo de la escena.
3. **Encuadre de animados con el estado inicial.** `measure` ve solo los sólidos iniciales de las capas animadas. Las bocanadas de humo arrancan repartidas a lo largo de `PUFF_RANGE` (`factory-anim.ts:25`), así que el estado inicial ya llega a la altura máxima, y la rueda de la noria también.
4. **Estructuras largas enteras** (malecón, alta tensión, boyas, cinta). Alternativa descartada: un tramo representativo, que encuadra más grande pero no "muestra la estructura completa".

## Grilling

- Rounds: 1 (the revision changed four boxes and some wording, not the steps or the seam, so there was no second round).
- Questions: 17. By source: ISSUE 3 (1, 2 via "estructura completa", 16), CODE 11 (3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15), DOC 1 (17, spec §3 table), NO SOURCE 3 (10, 11, and part of 2), all technical assumptions.
- Plan changes:
  - The conveyor, pylon line, malecón and buoys are now shown whole ("muestra la estructura completa", issue #93).
  - Global Constraint reworded: only screenshots go outside `src/lab/`.
  - Added the #94 pieces-group note, the AC → task map, and a source for the dársena decision.
- Assumptions: see `## Assumptions` (1 red intermediate commits, 2 private relocation not detected, 3 animated framing from the initial state, 4 long structures whole).
- Issues opened: none.
- Status: ok.

## Rebase onto #87 and #94

While this branch was open, `main` merged #94 (piece exhibits) and #87 (semi-straight lanes with no anchorage, buoys and wreck moved). The branch was rebuilt on top of `origin/main`:
- The eight pieces carry the `group` of their row in the spec §3 table and sit inside that group's block.
- `boyas` takes its box from the min/max of `BUOYS`, because the buoys moved to (398, 150) and (392, 200).
- `pecio` still derives from `WRECK`.
- `darsena` no longer has a ship at the anchorage, so `h` drops from 12 to 5 (the lamp at the corner). It still shows the quay, the bollards and the riprap.
