import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { shadowPolygon } from "../iso/light";
import { Z_SCALE } from "../iso/project";
import type { Solid } from "../iso/solids";
import { MOUTH_Y, QUAY_X, type WorldZone } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import { BLOCK_D, BLOCK_W, BRIDGE, COLLAPSED, DISTRICT_COLS, DISTRICT_ROWS, EAST_COLS, MALECON, PLAZA, ROWS, SITE, TOWER, TOWER_H, WEST_COLS } from "../scenes/city-grid";
import { campus, lamp } from "../scenes/city-pieces";
import { STAIR_TOWER } from "../scenes/boiler-house";
import { excavator, excavatorBox, excavatorWheel } from "../scenes/excavator";
import { COOLING as FACTORY_COOLING, PLANT, RAIL_YARD_X, STACK_BASE_H, STACKS } from "../scenes/factory";
import { waterTower } from "../scenes/maltings";
import { PUFF_LIFT, PUFF_RANGE } from "../scenes/factory-anim";
import { ARCADE, BUMPER, CAROUSEL, COASTER, DROP, PIER, WHEEL } from "../scenes/fair";
import { jungle } from "../scenes/flora";
import { CONTAINER_YARD, COOLING, POWER, PYLON_H, PYLON_N, PYLON_STEP, PYLON_X0, PYLON_Y, SILOS, STACKS_N, TANKS } from "../scenes/hinterland";
import { towerCrane } from "../scenes/pieces";
import { BUOYS, DRUM_R0, KEEPER, LANTERN_Z, LIGHTHOUSE, WRECK } from "../scenes/sea";
import { BEAM_LEN } from "../scenes/sea-anim";
import { ship, shipAt, type ShipKind } from "../scenes/ships";
import { SUBURB_COLS } from "../scenes/sprawl-grid";
import { SUBSTATION } from "../scenes/substation";
import { ARENA, AUDITORIUM, TELECOM } from "../scenes/tech";
import type { Box } from "../world/frame";

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

/** Una estructura para mirar sola: una caja sobre el mundo real o una pieza reubicable armada en el origen (con `pad` opcional: el material del suelo bajo ella). */
export type Exhibit = { id: string; title: string; zone: WorldZone; group: GroupId } & (
  | { kind: "region"; box: Box; h?: number }
  | { kind: "piece"; build: (out: Solid[], accents: Accent[]) => void; pad?: Material }
);

const M = 3; // margen: veredas, faroles y sombras cortas

const stacksX = STACKS.map((s) => s.x), stacksY = STACKS.map((s) => s.y), stackR = Math.max(...STACKS.map((s) => s.r));
const tanksX = TANKS.map((t) => t.x), tanksY = TANKS.map((t) => t.y);
const stackTop = Math.max(...STACKS.map((s) => s.h)) + STACK_BASE_H;
const buoysX = BUOYS.map((b) => b.x), buoysY = BUOYS.map((b) => b.y);

// excavadora: su caja en planta más la sombra proyectada de cada sólido (rueda incluida)
const excavatorExtent = ((): Box => {
  const out: Solid[] = []; excavator(out, []); out.push(excavatorWheel(0));
  const b = { ...excavatorBox() };
  for (const s of out) for (const p of shadowPolygon(s) ?? []) { b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y); }
  return b;
})();

// un barco con el punto medio de la unidad (empujador incluido) en el origen, a flote sobre agua
const vessel = (kind: ShipKind) => (out: Solid[], accents: Accent[]): void => {
  const { solids, lights } = ship(kind, shipAt(kind, { x: 0, y: 0 }, 0), 0);
  out.push(...solids); accents.push(...lights);
};

export const EXHIBITS: readonly Exhibit[] = [
  // {2, 41, 98, 76}: x1 = borde este de la torre de escalera (STAIR_TOWER.x1); zócalo y tolva adentro; faroles y camiones afuera salvo el farol de (5, 76), que toca el borde sur (y1 76); chimeneas (y ≤ 36.05) y tanque (y ≤ 36.8, con la escalera) afuera por el norte; h 26: vértice del horno de la maltería
  { id: "planta", title: "Nave de calderas y maltería", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: PLANT.x - M, y0: PLANT.y - M, x1: STAIR_TOWER.x1, y1: PLANT.y + PLANT.d + 2 }, h: 26 },
  // el tanque (WATER_TOWER, al norte de la maltería) queda fuera de la caja de planta: solo, se ven patas, cruces, escalera y pasarela
  { id: "tanque-agua", title: "Tanque de agua", zone: "portfolio", group: "fabrica", kind: "piece", pad: "slab", build: (out) => waterTower(out, { x: 0, y: 0 }) },
  // el humo deriva al NNE hasta PUFF_RANGE: la caja se estira al norte para no cortar la columna
  // el humo deriva 0.45·PUFF_RANGE ≈ 12.6 al este (de ahí los 13); la plataforma sobresale r + 1.2 al sur; la subestación y su farol quedan adentro, detrás
  { id: "chimeneas", title: "Chimeneas y torre de enfriamiento", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: FACTORY_COOLING.x - FACTORY_COOLING.r - M, y0: Math.min(...stacksY) - stackR - PUFF_RANGE, x1: Math.max(...stacksX) + stackR + M + 13, y1: Math.max(...stacksY) + stackR + 1.2 + M },
    h: stackTop + PUFF_RANGE * PUFF_LIFT },
  // cerco de SUBSTATION más margen (3 y 1 al sur): {51, −5, 98, 12}; no toca los vagones del desvío (y ≤ −6.8) ni cruza x 99 (`calle-faroles`). h 13: los mástiles llegan a z 12; el humo pasa por encima.
  { id: "subestacion", title: "Subestación", zone: "portfolio", group: "fabrica", kind: "region", box: { x0: SUBSTATION.x0 - 3, y0: SUBSTATION.y0 - 3, x1: SUBSTATION.x1 + 3, y1: SUBSTATION.y1 + 1 }, h: 13 },
  // a mano {2, 76, 98, 92}: camiones y pallets de truckYard; la tolva (z 13.5) cruza el borde norte; el caballete más alto adentro llega a 8.3; la grúa ya no está
  { id: "playa-camiones", title: "Playa de camiones", zone: "portfolio", group: "fabrica", kind: "region", box: { x0: 2, y0: 76, x1: 98, y1: 92 }, h: 16 },
  { id: "playa-vias", title: "Playa de vías", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: RAIL_YARD_X[0] - 4, y0: 40, x1: -4, y1: 100 }, h: 21 }, // a mano en y: los acopios de mineral (rng, x −25..−13, y 44..96, privados en factory.ts) con vías y vagones; h cubre la excavadora (≈20,3)
  // x1 tope 4, borde oeste de la región nueva: la sombra cae al ENE sobre el astillero
  { id: "excavadora", title: "Excavadora de rueda de cangilones", zone: "portfolio", group: "fabrica", kind: "region",
    box: { x0: excavatorExtent.x0 - M, y0: excavatorExtent.y0 - M, x1: Math.min(excavatorExtent.x1 + M, 4), y1: excavatorExtent.y1 + M }, h: 21 }, // caja + sombras; h cubre la máquina (≈20,3), que es capa animada
  // las constantes de shipyard.ts son privadas: cajas a mano
  // gradas x 110..QUAY_X, y 36..72; el pórtico (x 150) monta sobre ellas y queda adentro
  { id: "gradas", title: "Gradas", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 108, y0: 33, x1: QUAY_X + 2, y1: 75 }, h: 28 },
  // el agua entre el muelle y la escollera, desde la bocana; sin barcos desde #87 (los carriles arrancan en la bocana)
  { id: "darsena", title: "Dársena", zone: "portfolio", group: "astillero", kind: "region", box: { x0: QUAY_X - 2, y0: MOUTH_Y, x1: 275, y1: 80 }, h: 5 },
  { id: "grua-portico", title: "Grúa pórtico", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 146, y0: 30, x1: 156, y1: 78 }, h: 28 },
  // calle de transferencia x 100..108 con los faroles en 108.5; al oeste de las gradas (x ≥ 110)
  { id: "calle-faroles", title: "Calle de faroles", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 99, y0: 8, x1: 111, y1: 128 }, h: 7 },
  // las dos naves de montaje: x 10..100, filas y −52 y −32 de 16; y1 −14 deja afuera el contrapeso de la grúa (y −13..−11, z 18.5..20) y x1 102 el patio (x ≥ 104)
  { id: "naves", title: "Naves de montaje", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 7, y0: -55, x1: 102, y1: -14 }, h: 14 },
  // la costa norte de la isla frente a los galpones: x 270..350, y 0..60; h es el menor entero que pasa encuadre y vecinos (medido con el `measure` de exhibits.test.ts)
  { id: "punta-norte", title: "Punta norte de la isla", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 270, y0: 0, x1: 350, y1: 60 }, h: 9 },
  // la estación terminal: x 108..198, y 98..143; h es el menor entero que pasa encuadre y vecinos (medido con el `measure` de exhibits.test.ts): marquesinas y cabezas de semáforo a z 4,7
  { id: "estacion", title: "Estación terminal", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 108, y0: 98, x1: 198, y1: 143 }, h: 5 },
  // el paso a nivel junto a la estación: x 98..112, y 124..142; h es el menor entero que pasa encuadre y vecinos (medido con el `measure` de exhibits.test.ts): semáforos a z 4,7
  { id: "paso-a-nivel", title: "Paso a nivel", zone: "portfolio", group: "astillero", kind: "region", box: { x0: 98, y0: 124, x1: 112, y1: 142 }, h: 5 },
  // pluma 24 al este y contrapluma 8 al oeste: con el mástil en x −8 queda en −16..16
  { id: "grua-torre", title: "Grúa torre", zone: "portfolio", group: "astillero", kind: "piece",
    build: (out, accents) => towerCrane(out, accents, { at: { x: -8, y: 0 }, mastH: 20, jibLen: 24, dir: "e", light: "amber" }) },
  { id: "farol", title: "Farol", zone: "portfolio", group: "astillero", kind: "piece", build: (out, accents) => { lamp(out, accents, -0.3, -0.3, 0); } },
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
  { id: "noria", title: "Noria", zone: "portfolio", group: "feria", kind: "region",
    box: { x0: WHEEL.x - WHEEL.r - M, y0: WHEEL.y - WHEEL.r - M, x1: WHEEL.x + WHEEL.r + M, y1: WHEEL.y + WHEEL.r + M }, h: WHEEL.hub + WHEEL.r },
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
  // la torre de oficinas está en el centro de la plaza: queda adentro
  { id: "plaza", title: "Plaza", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: PLAZA.x - M, y0: PLAZA.y - M, x1: PLAZA.x + PLAZA.w + M, y1: PLAZA.y + PLAZA.d + M }, h: TOWER_H + 8 },
  // h + 8: la antena llega a z 37.9
  { id: "torre", title: "Torre de oficinas", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: TOWER.x - M, y0: TOWER.y - M, x1: TOWER.x + TOWER.w + M, y1: TOWER.y + TOWER.d + M }, h: TOWER_H + 8 },
  // de rampa a rampa; al oeste y al este pegado a las manzanas vecinas (edificios hasta 10.7), al norte los árboles de la ribera
  { id: "puente", title: "Puente", zone: "cv", group: "ciudad", kind: "region",
    box: { x0: WEST_COLS[WEST_COLS.length - 1]! + BLOCK_W + 0.5, y0: BRIDGE.y0 - 1, x1: EAST_COLS[0]! + 1, y1: BRIDGE.y1 + M }, h: 8 },
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
  // la punta sur: x 270..380, y 300..400; necesita el mundo sin filtro de zonas (el storybook lo arma con `assembleWorld(undefined, …)`); h es el menor entero que pasa encuadre y vecinos (medido con el `measure` de exhibits.test.ts)
  { id: "punta-sur", title: "Punta sur de la isla", zone: "cv", group: "ciudad", kind: "region", box: { x0: 270, y0: 300, x1: 380, y1: 400 }, h: 10 },
  // patio 9×9 entre tres edificios de 6: 21×15; el suelo de la manzana va a `out` con los sólidos
  { id: "campus", title: "Campus", zone: "cv", group: "ciudad", kind: "piece",
    build: (out, accents) => campus(out, out, accents, createRng(SEED), { x: -12.5, y: -9.5, w: 25, d: 19 }, -10.5, -7.5, 21, 15) },
  { id: "selva", title: "Selva", zone: "cv", group: "ciudad", kind: "piece", build: (out) => jungle(out, createRng(SEED), { x0: -12, x1: 12, y0: -12, y1: 12 }, 14, 0) },
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
  // el haz nace en la linterna y gira: apuntando al norte su punta sube BEAM_LEN/√2 en pantalla, y el vértice norte de la caja ya está DRUM_R0 + M más arriba que el faro
  { id: "faro", title: "Faro", zone: "blog", group: "mar", kind: "region",
    box: { x0: LIGHTHOUSE.x - DRUM_R0 - M, y0: LIGHTHOUSE.y - DRUM_R0 - M, x1: LIGHTHOUSE.x + DRUM_R0 + M, y1: LIGHTHOUSE.y + DRUM_R0 + M },
    h: LANTERN_Z + (BEAM_LEN * Math.SQRT1_2 - DRUM_R0 - M) / Z_SCALE },
  // la casa es 8 × 6 (privado en sea.ts)
  { id: "casa-farero", title: "Casa del farero", zone: "blog", group: "mar", kind: "region",
    box: { x0: KEEPER.x - M, y0: KEEPER.y - M, x1: KEEPER.x + 8 + M, y1: KEEPER.y + 6 + M }, h: 13 }, // sobre la punta, z ≈ 7
  // las dos boyas del bajo al sur de la punta, a 50 u una de otra
  { id: "boyas", title: "Boyas", zone: "blog", group: "mar", kind: "region",
    box: { x0: Math.min(...buoysX) - 5, y0: Math.min(...buoysY) - 5, x1: Math.max(...buoysX) + 5, y1: Math.max(...buoysY) + 5 }, h: 4 },
  // el casco mide 40 u a 30°: llega a (WRECK.x + 35, WRECK.y + 20); la boya del pecio queda adentro
  { id: "pecio", title: "Pecio", zone: "blog", group: "mar", kind: "region",
    box: { x0: WRECK.x - 5, y0: WRECK.y - 5, x1: WRECK.x + 38, y1: WRECK.y + 26 }, h: 9 },
  // la viga del motor sola, girada en planta y en alto a la vez: la sección se ve nivelada; montada, en las plumas del carguero
  { id: "viga", title: "Viga", zone: "blog", group: "mar", kind: "piece", pad: "water",
    build: (out) => { out.push({ kind: "beam", from: v3(-3, -1.5, 0.5), to: v3(3, 1.5, 6.5), w: 0.8, h: 1, mat: "steel" }); } },
  { id: "carguero", title: "Carguero", zone: "blog", group: "mar", kind: "piece", build: vessel("cargo"), pad: "water" },
  { id: "remolcador", title: "Remolcador", zone: "blog", group: "mar", kind: "piece", build: vessel("tug"), pad: "water" },
  { id: "convoy", title: "Convoy con barcaza", zone: "blog", group: "mar", kind: "piece", build: vessel("barge"), pad: "water" },
  { id: "lancha", title: "Lancha colectiva", zone: "blog", group: "mar", kind: "piece", build: vessel("ferry"), pad: "water" },
];

/** El exhibit del hash (`#id` o `id`); vacío o desconocido, el primero. */
export function pickExhibit(hash: string, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  let id: string;
  try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch { id = ""; } // %-escape roto: como desconocido
  return list.find((e) => e.id === id) ?? list[0]!;
}

/** Vecino en el orden del índice, dando la vuelta en los extremos. */
export function stepExhibit(id: string, delta: 1 | -1, list: readonly Exhibit[] = EXHIBITS): Exhibit {
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) return list[0]!;
  return list[(i + delta + list.length) % list.length]!;
}

/** La entrada no entra entera en la vista del índice (rectángulos de `getBoundingClientRect`). */
export function outOfView(entry: { top: number; bottom: number }, view: { top: number; bottom: number }): boolean {
  return entry.top < view.top || entry.bottom > view.bottom;
}
