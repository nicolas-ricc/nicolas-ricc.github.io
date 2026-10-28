import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { BOTTOM, DOCK, QUAY_W, QUAY_X, WORLD, eastBank, northCoastY } from "../map/geo";
import type { Rng } from "../map/seed";
import { jungle as flora } from "./flora";
import { station } from "./station";
import { clearOfWater } from "./terrain-classify";


/**
 * Portfolio: astillero en 2.5D. Mismo plano que terrain.ts: gradas al este de
 * la calle de transferencia N-S, que terminan en el agua; ribera dragada
 * recta en QUAY_X, dique seco al NE, playa al SO, muelle de alistamiento del
 * otro lado del río. Las naves de montaje, los talleres y el patio de
 * material van al norte, detrás de la fábrica, en la banda `y −58..−16`; la
 * fábrica de Portfolio queda entre la calle y la playa de vías. La zona de
 * producción al sur de las gradas es la estación cabecera (`station.ts`), al
 * final de la vía del oeste. Coordenadas en unidades del mapa viejo
 * (1 u ≈ 1 px).
 */

export interface Scene {
  ground: Solid[];     // suelo hundido del dique y franjas (calles, rieles)
  solids: Solid[];
  accents: Accent[];
  trolley: Solid & { kind: "prism" };
  trolleyRange: [number, number];
  weldSpots: Vec3[];
}

export const AREA_W = 344, AREA_H = 146;

const STREET_X = 100, STREET_W = 8;
export const STREET_EDGE = STREET_X + STREET_W; // x donde empiezan los faroles
const ROW_Y = [36, 56] as const;
const ROW_H = 16;
const HALL_X = 10, HALL_W = 90, HALL_H = 10;
const HALL_ROWS_Y = [-52, -32] as const; // naves de montaje, en la banda norte
const SLIP_X = 110;
export const RAIL_Y = [131, 134] as const; // vías del oeste; el hinterland las prolonga hacia el oeste hasta el borde del sangrado
const GANTRY_X = 150, GANTRY_H = 24;
const WATER_Z = -1;

// ---------------------------------------------------------------- piezas

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], roof?: "flat" | "gable" | "step"): Solid & { kind: "prism" } =>
  roof ? { kind: "prism", at: v3(x, y, z), w, d, h, mat, roof } : { kind: "prism", at: v3(x, y, z), w, d, h, mat };

const strip = (path: Vec2[], width: number, z: number, mat: Solid["mat"]): Solid => ({ kind: "strip", path, width, z, mat });

function quay(out: Solid[], accents: Accent[]): void {
  out.push(prism(QUAY_X, WORLD.y0, WATER_Z, QUAY_W, BOTTOM - WORLD.y0, 1.5, "concrete"));
  for (let y = WORLD.y0 + 6; y < BOTTOM; y += 12) out.push({ kind: "cylinder", at: v3(QUAY_X + 2, y, 0.5), r: 0.7, h: 1, mat: "steel", sides: 6 });
  for (const y of [20, 80]) { // faroles
    out.push(prism(QUAY_X - 1.4, y, 0, 0.6, 0.6, 5, "steel"));
    accents.push({ kind: "dot", at: v3(QUAY_X - 1.4 + 0.3, y + 0.3, 5), r: 1.2, color: "cyan" });
  }
}

function halls(out: Solid[]): void {
  for (const y of HALL_ROWS_Y) {
    out.push(prism(HALL_X, y, 0, HALL_W, ROW_H, HALL_H, "concrete", "gable"));
    out.push(prism(HALL_X + HALL_W - 8, y + 2, 0, 2, 3, 2, "rust"));   // autoelevador esperando en el portón este
    out.push(prism(HALL_X + 2, y + ROW_H - 5, 0, 3, 2, 2, "steel"));   // otro en el portón oeste
  }
}

function street(out: Solid[]): void {
  out.push(strip([{ x: STREET_X + STREET_W / 2, y: 0 }, { x: STREET_X + STREET_W / 2, y: BOTTOM }], STREET_W, -0.4, "road"));
  out.push(prism(STREET_X + 5, 88, -0.4, 3, 7, 2.5, "rust"));     // camión bajando por la calle
}

function slipways(out: Solid[], weldSpots: Vec3[]): void {
  const w = QUAY_X - SLIP_X, deckZ = 1.5;
  ROW_Y.forEach((y, i) => {
    out.push({ kind: "ramp", at: v3(SLIP_X, y, 0), w, d: ROW_H, h: deckZ, mat: "concrete", dir: "e" });
    const cy = y + ROW_H / 2;
    if (i === 0) {
      // quilla y cuadernas: el casco todavía es un esqueleto
      out.push(prism(SLIP_X + 10, cy - 0.3, deckZ, 70, 0.6, 1, "rust"));
      for (let x = SLIP_X + 12; x < SLIP_X + 80; x += 4) {
        const t = (x - SLIP_X - 12) / 68;
        const half = t > 0.75 ? Math.max(1, 5 * (1 - t) / 0.25) : 5;
        out.push(prism(x, cy - half, deckZ, 0.6, half * 2, 4, "rust"));
        weldSpots.push(v3(x + 0.3, cy - half, deckZ + 4));
        weldSpots.push(v3(x + 0.3, cy + half, deckZ + 4));
      }
    } else {
      out.push({ kind: "hull", at: v3(SLIP_X + 8, cy, deckZ), len: 74, beam: 10, h: 4, mat: "hull" });
      out.push(prism(SLIP_X + 14, cy - 2.5, deckZ + 4, 8, 5, 3, "concrete")); // superestructura en popa
    }
    for (let x = SLIP_X + 6; x < QUAY_X - 8; x += 9) { // andamios
      out.push(prism(x, y + 1, deckZ, 0.6, 0.6, 5, "steel"));
      out.push(prism(x + 4, y + ROW_H - 1.6, deckZ, 0.6, 0.6, 5, "steel"));
    }
  });
}

function gantry(out: Solid[]): { trolley: Solid & { kind: "prism" }; range: [number, number] } {
  const y0 = ROW_Y[0] - 3, y1 = ROW_Y[1] + ROW_H + 1;
  out.push(strip([{ x: SLIP_X, y: y0 + 1.5 }, { x: QUAY_X, y: y0 + 1.5 }], 0.5, 0.05, "rail"));
  out.push(strip([{ x: SLIP_X, y: y1 + 1.5 }, { x: QUAY_X, y: y1 + 1.5 }], 0.5, 0.05, "rail"));
  out.push(prism(GANTRY_X, y0, 0, 3, 3, GANTRY_H, "steel"));
  out.push(prism(GANTRY_X, y1, 0, 3, 3, GANTRY_H, "steel"));
  out.push(prism(GANTRY_X, y0, GANTRY_H, 3, y1 + 3 - y0, 2, "steel")); // viga
  const range: [number, number] = [y0 + 5, y1 - 6];
  const trolley = prism(GANTRY_X - 1, range[0], GANTRY_H + 2, 5, 4, 2, "rust");
  return { trolley, range };
}

// ---------------------------------------------------------------- patio de material (banda norte)

function materialYard(out: Solid[], rng: Rng): void {
  for (const [x, y] of [[104, -58], [118, -58], [104, -50], [118, -50], [132, -56]] as const) { // chapas apiladas con desfase
    const layers = rng.int(2, 4);
    for (let l = 0; l < layers; l++) out.push(prism(x + l * 0.4, y + l * 0.4, l * 0.5, 10, 2, 0.5, "steel"));
  }
  for (const [x, y] of [[104, -42], [122, -42], [140, -44]] as const) { // mazos de caños
    for (let i = 0; i < 4; i++) out.push(prism(x, y + i * 1.2, 0, 14, 1, 1, "rust"));
  }
  for (let i = 0; i < 6; i++) out.push({ kind: "cylinder", at: v3(149 + (i % 3) * 5, -57 + Math.floor(i / 3) * 5, 0), r: 1.5, h: 1.5, mat: "rust", sides: 8 }); // bobinas
  for (let i = 0; i < 4; i++) out.push(prism(150 + (i % 2) * 12, -46 + Math.floor(i / 2) * 6, 0, 9, 4, 3, "steel", "step")); // secciones de casco
  out.push({ kind: "cylinder", at: v3(174, -54, 0), r: 5, h: 8, mat: "concrete" });
  out.push({ kind: "cylinder", at: v3(186, -42, 0), r: 4, h: 6, mat: "concrete" });
}

// ---------------------------------------------------------------- dique seco (NE)

function dryDock(out: Solid[], ground: Solid[]): void {
  const { x, y, w, d, depth } = DOCK;
  const z = -depth;
  ground.push({ kind: "ground", mat: "concrete", tris: [
    { pts: [v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z)], toneOffset: -1 },
    { pts: [v3(x, y, z), v3(x + w, y + d, z), v3(x, y + d, z)], toneOffset: -1 },
  ] });
  out.push(prism(x - 2, y - 2, z, w + 4, 2, depth, "concrete"));        // muro norte
  out.push(prism(x - 2, y + d, z, w + 4, 2, depth, "concrete"));        // muro sur
  out.push(prism(x - 2, y, z, 2, d, depth, "concrete"));                // muro oeste
  out.push(prism(x + w, y, z, QUAY_X - x - w, d, depth, "concrete"));   // muro este hasta el muelle
  out.push(prism(QUAY_X - 3, y + 2, z, 3, d - 4, depth + 1, "rust"));   // compuerta
  out.push({ kind: "hull", at: v3(x + 6, y + d / 2, z), len: 60, beam: 10, h: 5, mat: "hull" });
  out.push(prism(x + 12, y + d / 2 - 2.5, z + 5, 8, 5, 3, "concrete")); // superestructura
  out.push(prism(x + w - 10, 0, 0, 8, 4, 4, "concrete", "step"));       // casa de bombas (x 182..190, no pisa el muelle en 198..202)
}

// ---------------------------------------------------------------- talleres (banda norte)

function workshops(out: Solid[]): void {
  for (const x of [106, 134]) {
    out.push(prism(x, -33, 0, 24, 14, 7, "concrete", "step"));
    out.push(prism(x + 3, -30, 7, 2, 2, 1, "steel"));
    out.push(prism(x + 18, -23, 7, 2, 2, 1, "steel"));
  }
}

// ---------------------------------------------------------------- playa y vías (SO)

function parkingAndRails(out: Solid[], rng: Rng): void {
  out.push(strip([{ x: 46, y: 113 }, { x: 98, y: 113 }], 26, -0.4, "road")); // playa
  for (let x = 48; x < 98; x += 4) out.push(strip([{ x, y: 102 }, { x, y: 106 }], 0.4, -0.3, "rail")); // líneas
  for (let i = 0; i < 5; i++) {
    const x = 49 + rng.int(0, 11) * 4, y = rng.chance(0.5) ? 102 : 116;
    out.push(prism(x, y, 0, 3, 4, 1.5, rng.chance(0.5) ? "steel" : "rust"));
  }
  for (const y of RAIL_Y) out.push(strip([{ x: 0, y }, { x: STREET_X + 4, y }], 0.5, 0.05, "rail")); // vías del oeste
  for (let x = 2; x < STREET_X; x += 4) out.push(prism(x, RAIL_Y[0] - 1, 0, 1, 5, 0.3, "rust")); // durmientes
}

// ---------------------------------------------------------------- muelle de alistamiento (E)

function fittingOut(out: Solid[], rng: Rng): void {
  for (const x of [304, 316]) out.push(prism(x, 24, 0, 8, 92, 6, "concrete", "gable"));
  out.push({ kind: "cylinder", at: v3(310, 122, 0), r: 4, h: 6, mat: "concrete" });
  for (let i = 0; i < 6; i++) out.push(prism(302 + rng.int(0, 24), 130 + rng.int(0, 10), 0, 3, 2, 1, "rust")); // chatarra
  const rock = (x: number, y: number): Solid => ({ kind: "cone", at: v3(x, y, 0), r: 1.6, h: 1.2, mat: "rock", sides: 5 });
  for (let y = 0; y < AREA_H; y += 3) { // escollera del río: solo donde ya hay tierra
    const x = eastBank(y) + 1.5;
    if (y >= northCoastY(x)) out.push(rock(x, y));
  }
  for (let x = Math.ceil(eastBank(30)) + 6; x < 300; x += 3) out.push(rock(x, northCoastY(x) + 1.5)); // escollera de la caleta; arranca 6 u al este de la ribera (eastBank(30) = 277) para no pisar el último cono del río
}

// ---------------------------------------------------------------- selva y faroles

function jungle(out: Solid[], rng: Rng): void {
  // siembra igual (el rng no se mueve) y descarta lo que queda a menos de 3 u del agua
  const cluster = (x0: number, x1: number, y0: number, y1: number, n: number) => {
    const tmp: Solid[] = [];
    flora(tmp, rng, { x0, x1, y0, y1 }, n);
    for (const s of tmp) {
      const b = bounds(s);
      if (clearOfWater(b.min.x, b.min.y, b.max.x, b.max.y, 3)) out.push(s);
    }
  };
  cluster(3, 39, 102, 125, 10);   // SO, al norte de las vías (r ≤ 4: nunca las pisa)
  cluster(3, 39, 139, 143, 4);    // SO, al sur de las vías
  cluster(332, 340, 50, 94, 6);   // borde este, entre la bahía y la punta (y0 50, Task 6: deja fuera del alcance diagonal del carguero que sale de la bahía)
  cluster(332, 340, 136, 143, 2); // al sur de la punta
  cluster(301, 328, 127, 143, 6); // al sur de los galpones, sin pisar la base de la punta (x ≥ 330)
}

function lamps(out: Solid[], accents: Accent[]): void {
  for (const y of [12, 40, 68, 96, 124]) {
    out.push(prism(STREET_EDGE + 0.5, y, 0, 0.6, 0.6, 5, "steel"));
    accents.push({ kind: "dot", at: v3(STREET_EDGE + 0.8, y + 0.3, 5), r: 1.2, color: "cyan" });
  }
}

export function shipyard(rng: Rng): Scene {
  const ground: Solid[] = [];
  const solids: Solid[] = [];
  const accents: Accent[] = [];
  const weldSpots: Vec3[] = [];
  quay(solids, accents);
  materialYard(solids, rng);
  dryDock(solids, ground);
  halls(solids);
  street(solids);
  slipways(solids, weldSpots);
  const g = gantry(solids);
  workshops(solids);
  parkingAndRails(solids, rng);
  station(solids, accents);
  fittingOut(solids, rng);
  jungle(solids, rng);
  lamps(solids, accents);
  ground.push(...solids.filter((s) => s.kind === "strip"));
  const raised = solids.filter((s) => s.kind !== "strip");
  return { ground, solids: raised, accents, trolley: g.trolley, trolleyRange: g.range, weldSpots };
}
