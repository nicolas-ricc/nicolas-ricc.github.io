# Zonificación de Resume (#44) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Partir Resume en seis barrios con catálogo de recetas del kit (`src/city/zoning.ts`), mover las piezas fijas de hoy a `src/city/fixed.ts` sin cambios y dejar `src/scenes/city.ts` como orquestador fino (≤ 120 líneas); `district.ts` desaparece.

**Architecture:** `zoning.ts` es puro: tabla de barrios sobre `blocks()`, catálogo por barrio, fijos, lote por manzana (`open`, `maxH`, `z`) y `assign(rng, districtRng): Placed[]`. `city.ts` recorre los `Placed`, pone zócalo, corre la receta del kit con el estilo del barrio y el `tone` de la manzana, y después llama a las piezas de `fixed.ts` y a `streets.ts` en el mismo orden de capas que hoy. `CityScene` gana `placed` para el hijo de luces (#45).

**Tech Stack:** TypeScript estricto, Vitest, sin Pixi en tests.

**Spec:** issue #44 (manda) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §6.

## Global Constraints

- `src/iso/` no importa Pixi; todo color sale de `src/map/palette-iso.ts` (sin literales hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`).
- `Math.random` prohibido: toda aleatoriedad sale del `Rng` recibido.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo (`x.test.ts`); sin dependencias nuevas.
- `src/scenes/city-grid.ts` no cambia. `src/scenes/world.ts` sigue llamando `city(zoneRng(seed, "cv"), zoneRng(seed, "cv", 1))`.
- Fila frente a la torre (`row 3`, `x 96..162`) ≤ 10; nada supera 18 salvo la torre (30), el distrito y las manzanas fijas (≤ 24 sobre el zócalo).
- `npm test` y `npm run typecheck` en verde al final de cada tarea.

## Decisiones técnicas (supuestos declarados)

1. `type Barrio = StyleId` (`src/kit/types.ts`): la unión es idéntica y así `STYLES[barrio]` tipa directo.
2. Tope de lote: `maxH = min(maxHeightFor(b, tall ? LANDMARK_MAX_H : MAX_BUILDING_H), maxDistrictHeight(b))` con `tall` = barrio `distrito` o manzana fija. El "24 si landmark" del issue se lee como "manzana fija o distrito": `classic` lleva `landmark: true` en el registro, y darle 24 en el centro rompería "nada supera 21 fuera de la torre y las manzanas fijas" (issue, tests).
3. `maxHeightFor(b, top = MAX_BUILDING_H)` devuelve `FRONT_CAP_H` (10) en la fila frente a la torre y `top` en el resto.
4. `eatenRuin` y `campus` ponen sus propias losas: su lote apoya en `z = 0` y no llevan zócalo de manzana (como hoy `campus` en `district.ts`).
5. `(12, 164)` entra en `FIXED` con `patioResidential`, para que la torre de agua tenga patio garantizado.
6. `open` "w" para la columna `EAST_COLS[0]` (280) de la ribera este: el issue deja la fórmula abierta (`EAST_RING.x1 + …`).
7. Lados contra la plaza: la manzana está a una calle (`STREET`) de la plaza y se solapan en el otro eje. Orden de `open`: `s`, `n`, `e`, `w` y al final el de la plaza si no estaba.
8. Reintentos del residencial: hasta 5 tiradas extra; si las cinco repiten, queda la última.
9. Los fijos usan el estilo de su barrio (la estación queda con el estilo `distrito`).
10. Los carteles `cyan`/`magenta` salen solo de los slots `sign` de piezas del barrio `distrito`, con `districtRng.chance(0.5)` después de la receta, como hoy.

## Review Focus

- La unión de los barrios reproduce `blocks()` exacto: una manzana sin barrio o con dos rompe la escena en silencio → test en Task 1.
- Determinismo con dos rngs: el distrito no puede depender del orden en que el resto consume `rng` más allá de `tone` → test de determinismo en Task 3.
- Lote del puente peatonal: tiene que empezar en el muelle (198) y terminar sobre la ribera este, no en el agua → test en Task 1.
- La torre de agua tiene que caer dentro del patio de `(12, 164)` → test en Task 3.
- Los carteles del distrito siguen coplanares y ≥ 6 con la semilla del mundo → test existente en `city.test.ts`.

---

### Task 1: `src/city/zoning.ts` (barrios, catálogos, fijos, lotes, asignación)

**Files:**
- Create: `src/city/zoning.ts`, `src/city/zoning.test.ts`
- Modify: `src/scenes/district.ts` (importa `maxDistrictHeight`/`MAX_DISTRICT_H` de `zoning.ts` en vez de definirlos; se borra en Task 3)

**Interfaces:**
- Consumes: `blocks()`, `Block`, `Rect`, constantes de `src/scenes/city-grid.ts`; `PLINTH_H` de `src/scenes/city-pieces.ts`; `LANDMARK_MAX_H` de `src/kit/piece.ts`; `Lot`, `Side`, `StyleId` de `src/kit/types.ts`.
- Produces:
  - `type Barrio = StyleId`
  - `barrioOf(b: Block): Barrio`
  - `CATALOGUE: Record<Barrio, { recipes: readonly { name: string; weight: number }[]; style: StyleId; lights: { on: number; warm: number } }>`
  - `FIXED: readonly { x: number; y: number; recipe: string }[]`, `WATER_TOWER_BLOCK = { x: 12, y: 164 }`
  - `MAX_BUILDING_H = 18`, `MAX_DISTRICT_H = 24`, `FRONT_CAP_H = 10`
  - `maxHeightFor(b: Block, top?: number): number`, `maxDistrictHeight(b: Rect): number`
  - `openSides(b: Block): Side[]`
  - `NO_PLINTH: readonly string[]` (`["eatenRuin", "campus"]`)
  - `interface Placed { block: Block; barrio: Barrio; recipe: string; lot: Lot; tone: number }`
  - `assign(rng: Rng, districtRng: Rng): Placed[]` (salta `plaza` y `collapsed`, que dibuja `fixed.ts`)
  - `waterTowerLot(court: Rect, z: number): Lot`, `FOOTBRIDGE_LOT: Lot`

- [ ] **Step 1: tests que fallan** (`src/city/zoning.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { createRng } from "../map/seed";
import { SEED } from "../world/assemble";
import { zoneRng } from "../scenes/world";
import { LIT_FLOOR, SITE, TOWER, TOWER_FLOORS, TOWER_H, WEST_QUAY, blocks, estuaryEast, type Block } from "../scenes/city-grid";
import { CATALOGUE, FIXED, FOOTBRIDGE_LOT, MAX_DISTRICT_H, WATER_TOWER_BLOCK, assign, barrioOf, maxDistrictHeight, maxHeightFor, openSides, waterTowerLot, type Barrio } from "./zoning";
import { RECIPES } from "../kit/index";

const blockAt = (x: number, y: number): Block => blocks().find((b) => b.x === x && b.y === y)!;
const key = (b: { x: number; y: number }) => `${b.x},${b.y}`;

describe("zoning", () => {
  it("toda manzana tiene barrio y la unión de barrios reproduce blocks()", () => { /* agrupar por barrioOf; sumar; comparar con blocks() por key */ });
  it("bares son exactamente las seis manzanas del muelle", () => { /* {102,132,162} × {164,188} */ });
  it("residencial, centro, cívico, ribera y distrito según la tabla", () => { /* conjuntos exactos del issue; plaza cívico; derrumbe ribera */ });
  it("los fijos están donde dice la tabla y existen en el kit", () => { /* station (-18,188), market (280,188), theatre (72,218), civicPalace (162,218), library (42,242), constructionSite en SITE, patioResidential en (12,164); RECIPES los tiene */ });
  it("catálogos: pesos del issue, recetas registradas y política de luces", () => { /* centro podiumTower 30 ...; on/warm */ });
  it("maxHeightFor topa a 10 la fila frente a la torre", () => { /* (102,242), (132,242) → 10; (72,242) → 18; con top 24 → 24 */ });
  it("maxDistrictHeight conserva la guarda del piso encendido", () => { /* manzana TOWER.x+20,TOWER.y+20 → 10; SITE → MAX_DISTRICT_H */ });
  it("open: avenida, muelle, ribera y plaza", () => { /* (102,188) ["s"]; (162,164) ["e"]; (162,188) ["s","e"]; (102,242) ["n"]; (72,218) contiene "e" */ });
  it("assign es determinístico, salta plaza y derrumbe, y arma lotes con vereda, zócalo y tope", () => { /* ... */ });
  it("con la semilla del mundo se usan ≥ 14 recetas distintas", () => { /* zoneRng(SEED,"cv"), zoneRng(SEED,"cv",1) */ });
  it("el residencial no repite receta en manzanas adyacentes", () => { /* semilla del mundo y seeds 1..20 */ });
  it("lotes de la torre de agua y el puente peatonal", () => { /* waterTowerLot centrado, lado ≥ 5; FOOTBRIDGE_LOT de 198 a ceil(estuaryEast(176))+1 */ });
});
```

(Los cuerpos completos van en el commit de evals, stage 3.)

- [ ] **Step 2:** `npx vitest run src/city/zoning.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: implementación** — `src/city/zoning.ts`:

```ts
export type Barrio = StyleId;
const BARES_X = [102, 132, 162], BARES_Y = [164, 188];
const CIVICO = [[72, 218], [162, 218], [42, 242]] as const;
const CENTRO = [[72, 164], [72, 188], [42, 218], [72, 242], [102, 242], [132, 242], [162, 242]] as const;
const isAt = (b: Block, cells: readonly (readonly [number, number])[]) => cells.some(([x, y]) => b.x === x && b.y === y);

export function barrioOf(b: Block): Barrio {
  if (b.kind === "district" || b.kind === "site") return "distrito";
  if (b.kind === "plaza") return "civico";
  if (b.bank === "east") return "ribera"; // el derrumbe incluido: lo dibuja fixed.ts
  if (BARES_X.includes(b.x) && BARES_Y.includes(b.y)) return "bares";
  if (isAt(b, CIVICO)) return "civico";
  if (isAt(b, CENTRO)) return "centro";
  return "residencial";
}

export const CATALOGUE = {
  centro: { recipes: [{ name: "podiumTower", weight: 30 }, { name: "decoStepped", weight: 20 }, { name: "chamfer", weight: 20 }, { name: "classic", weight: 15 }, { name: "cylinderTower", weight: 15 }], style: "centro", lights: { on: 0.45, warm: 0.3 } },
  bares: { recipes: [{ name: "shopRow", weight: 50 }, { name: "gallery", weight: 20 }, { name: "patioResidential", weight: 20 }, { name: "courtyardO", weight: 10 }], style: "bares", lights: { on: 0.7, warm: 0.9 } },
  residencial: { recipes: [{ name: "patioResidential", weight: 40 }, { name: "courtyardO", weight: 20 }, { name: "courtyardU", weight: 15 }, { name: "rowHouses", weight: 15 }, { name: "eatenRuin", weight: 10 }], style: "residencial", lights: { on: 0.55, warm: 0.95 } },
  civico: { recipes: [], style: "civico", lights: { on: 0.6, warm: 0.7 } },
  ribera: { recipes: [{ name: "classic", weight: 30 }, { name: "lTower", weight: 30 }, { name: "eatenRuin", weight: 40 }], style: "ribera", lights: { on: 0.25, warm: 0.5 } },
  distrito: { recipes: [{ name: "glassTower", weight: 30 }, { name: "twinTowers", weight: 20 }, { name: "classic", weight: 20 }, { name: "campus", weight: 20 }, { name: "cylinderTower", weight: 10 }], style: "distrito", lights: { on: 0.4, warm: 0.15 } },
} as const satisfies Record<Barrio, Catalogue>;

export const WATER_TOWER_BLOCK = { x: 12, y: 164 } as const;
export const FIXED = [
  { x: -18, y: 188, recipe: "station" }, { x: 280, y: 188, recipe: "market" }, { x: 72, y: 218, recipe: "theatre" },
  { x: 162, y: 218, recipe: "civicPalace" }, { x: 42, y: 242, recipe: "library" }, { x: SITE.x, y: SITE.y, recipe: "constructionSite" },
  { ...WATER_TOWER_BLOCK, recipe: "patioResidential" },
] as const;

// maxDistrictHeight + LIT se mudan tal cual desde district.ts.
export const maxHeightFor = (b: Block, top = MAX_BUILDING_H): number => (b.row === 3 && b.x >= 96 && b.x + b.w <= 162 ? FRONT_CAP_H : top);

/** Lado `side` de `b` que mira a `r` a través de una calle, si se solapan en el otro eje. */
function facing(b: Rect, r: Rect): Side | undefined { /* e, w, s, n con STREET */ }

export function openSides(b: Block): Side[] {
  const out: Side[] = [];
  if (b.y + b.d === AVENUE.y0) out.push("s");
  if (b.y === AVENUE.y1) out.push("n");
  if (b.x + b.w + STREET === WEST_QUAY.x0) out.push("e");
  if (b.bank === "east" && b.x === EAST_COLS[0]) out.push("w");
  const plaza = facing(b, PLAZA);
  if (plaza && !out.includes(plaza)) out.push(plaza);
  return out;
}

export const NO_PLINTH: readonly string[] = ["eatenRuin", "campus"];

function pick(rng: Rng, recipes: readonly { name: string; weight: number }[]): string { /* por peso con rng.next() */ }
const adjacent = (a: Block, b: Block) => Math.abs(a.x - b.x) <= BLOCK_W + STREET && Math.abs(a.y - b.y) <= BLOCK_D + STREET;

export function assign(rng: Rng, districtRng: Rng): Placed[] {
  // recorre blocks(); salta plaza y collapsed; fijos toman su receta; distrito tira con districtRng, el resto con rng;
  // residencial reintenta hasta 5 veces si repite la receta de una adyacente ya asignada; tone = rng.int(-1, 1).
  // lot = { x: b.x + SIDEWALK, y: b.y + SIDEWALK, w: b.w - 2*SIDEWALK, d: b.d - 2*SIDEWALK,
  //         z: NO_PLINTH.includes(recipe) ? 0 : PLINTH_H, open: openSides(b),
  //         maxH: Math.min(maxHeightFor(b, tall ? LANDMARK_MAX_H : MAX_BUILDING_H), maxDistrictHeight(b)) }
}

export function waterTowerLot(court: Rect, z: number): Lot {
  const s = Math.max(5, Math.min(court.w, court.d));
  return { x: court.x + (court.w - s) / 2, y: court.y + (court.d - s) / 2, w: s, d: s, z, open: [], maxH: LANDMARK_MAX_H };
}
export const FOOTBRIDGE_LOT: Lot = { x: WEST_QUAY.x1, y: 174, w: Math.ceil(estuaryEast(176)) + 1 - WEST_QUAY.x1, d: 4, z: -1, open: [], maxH: LANDMARK_MAX_H };
```

`district.ts`: borrar `LIT`, `MAX_DISTRICT_H`, `FRONT_CAP_H`, `maxDistrictHeight` y reexportar desde `../city/zoning` (`district.test.ts` sigue verde).

- [ ] **Step 4:** `npx vitest run src/city src/scenes/district.test.ts` → PASS; `npm run typecheck` → OK.
- [ ] **Step 5:** `git commit -m "feat(#44): zoning.ts con barrios, catálogos, fijos y asignación"`

### Task 2: `src/city/fixed.ts` (piezas de hoy, movidas sin cambios)

**Files:**
- Create: `src/city/fixed.ts`
- Modify: `src/scenes/city.ts` (borra las funciones movidas y las importa), `src/scenes/city.test.ts` (el test "las props salen del kit" lee también `src/city/fixed.ts`)

**Interfaces:**
- Produces (exportadas, cuerpos idénticos a los de `city.ts` hoy): `plazaAndTower(solids, ground, accents, rng): CityScene["tower"]`, `bridge(solids, accents)`, `westQuay(solids)`, `malecon(solids, accents): Vec3[]`, `collapsed(solids, rng)`, `greenery(solids, rng)`, `cars(solids, rng)`. `jungleOnLand` y `rectsOverlap` quedan privadas en `fixed.ts`. `CityScene` se importa como `import type` desde `../scenes/city`.

- [ ] **Step 1:** agregar `"src/city/fixed.ts"` a la lista de archivos del test "las props salen del kit" en `city.test.ts`; correrlo → FAIL (archivo no existe).
- [ ] **Step 2:** cortar y pegar las siete funciones (más `jungleOnLand`, `rectsOverlap`) a `fixed.ts` con sus comentarios, ajustar imports (`../scenes/city-grid`, `../scenes/city-pieces`, `../scenes/flora`, `../kit/props`, `../map/geo`, `../iso/...`). `city.ts` las importa. `git diff -M` debe mostrar el cuerpo idéntico.
- [ ] **Step 3:** `npm test` → PASS sin tocar otras expectativas (refactor puro: `JSON.stringify(city(createRng(7), createRng(8)))` igual antes y después; verificarlo a mano con un script de una línea).
- [ ] **Step 4:** `git commit -m "refactor(#44): piezas fijas de Resume a src/city/fixed.ts sin cambios"`

### Task 3: `city.ts` orquestador sobre el kit; `district.ts` fuera

**Files:**
- Modify: `src/scenes/city.ts` (reescritura, ≤ 120 líneas), `src/scenes/city.test.ts`, `README.md` (la lista de escenas menciona `district.ts`), `src/scenes/city-pieces.ts` (comentario que menciona `district.ts`)
- Delete: `src/scenes/district.ts`, `src/scenes/district.test.ts`

**Interfaces:**
- Consumes: `assign`, `NO_PLINTH`, `WATER_TOWER_BLOCK`, `waterTowerLot`, `FOOTBRIDGE_LOT`, `Placed` (Task 1); funciones de `fixed.ts` (Task 2); `recipe(name)` de `src/kit/index.ts`; `STYLES` de `src/kit/styles.ts`; `streets` de `src/city/streets.ts`.
- Produces:
  - `interface PlacedPiece { placed: Placed; piece: Piece; solidOffset: number }` (`solidOffset`: índice del primer sólido de la pieza en `scene.solids`)
  - `CityScene { ground; solids; accents; tower; neon: { signs; malecon }; placed: PlacedPiece[] }`
  - `city(rng: Rng, districtRng: Rng): CityScene` (misma firma)

- [ ] **Step 1: ajustar `city.test.ts`** (evals de stage 3):
  - `CITY_MATS` suma `plaster`, `terracotta`, `marble`, `awning`, `deck` y lo que el kit use (y el test exige que aparezcan esos cinco).
  - "edificios con fachada": cualquier sólido `prism`/`poly`/`cylinder` con `facade`, ≥ 90; zócalos (`paving`, `h === PLINTH_H`, `z === 0`, del tamaño de la manzana) ≥ 40.
  - Alturas: fuera de la torre, el distrito y las manzanas fijas nada supera 21; en las fijas, ≤ 25.
  - Fila frente a la torre ≤ 10 (igual que hoy).
  - Autos: una sola medida (`CAR.w × CAR.d × 1.2`).
  - `placed`: uno por manzana no plaza/derrumbe, `solidOffset` apunta al primer sólido de su pieza (`scene.solids[o] === piece.solids[0]`), barrios y recetas iguales a `assign` con los mismos seeds.
  - Torre de agua dentro del patio de `(12, 164)`; puente peatonal con tablero `stone` en `y 174..178` entre 198 y la ribera.
  - Carteles del distrito: pasan los de `district.test.ts` (plano en y, 1.6 de alto, `cyan`/`magenta`, alpha 1).
  - `strip ≤ 150` (ya está).
- [ ] **Step 2:** `npx vitest run src/scenes/city.test.ts` → FAIL.
- [ ] **Step 3: reescribir `city.ts`**:

```ts
export function city(rng: Rng, districtRng: Rng): CityScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [], signs: Accent[] = [], placed: PlacedPiece[] = [];
  for (const p of assign(rng, districtRng)) {
    const b = p.block, r = p.barrio === "distrito" ? districtRng : rng;
    if (!NO_PLINTH.includes(p.recipe)) solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
    const piece = recipe(p.recipe)(p.lot, r, { ...STYLES[p.barrio], tone: p.tone });
    placed.push({ placed: p, piece, solidOffset: solids.length });
    solids.push(...piece.solids); ground.push(...piece.ground); accents.push(...piece.accents);
    // el cartel consume el rng después de la receta, así las tiradas de la receta no dependen de cuántos slots haya
    if (p.barrio === "distrito") for (const s of piece.slots) if (s.kind === "sign") signs.push({ kind: "poly", pts: s.pts, color: districtRng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
  }
  const tower = plazaAndTower(solids, ground, accents, rng);
  // torre de agua en el patio de (12, 164) y puente peatonal sobre el estuario
  // streets, bridge, westQuay, malecon, collapsed, greenery, cars — en ese orden
  return { ground, solids, accents, tower, neon: { signs, malecon: maleconLights }, placed };
}
```

- [ ] **Step 4:** borrar `district.ts` y `district.test.ts`; actualizar README y el comentario de `city-pieces.ts`. `npm test` y `npm run typecheck` → PASS. `wc -l src/scenes/city.ts` ≤ 120.
- [ ] **Step 5:** `git commit -m "feat(#44): city.ts orquestador sobre el kit y la zonificación; district.ts fuera"`

### Verificación visual (stage 4, después de Task 3)

`npm run dev -- --host --port 5173`, `agent-browser` sobre `http://localhost:5173/map/lab/resume.html`, tecla `2`, captura 1600×900 a `docs/superpowers/specs/assets/2026-10-15-resume-nivel-2/44-resume-barrios.png`. Script en `.scratch/evals-44.md`.
