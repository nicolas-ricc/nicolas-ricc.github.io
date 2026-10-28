import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Bounds, Plate, Solid } from "../iso/solids";

/**
 * Tren EMU de la Línea Mitre: modelo real CSR Sifang (2014–16), librea Trenes Argentinos (caja blanca, banda azul cobalto),
 * alimentación por tercer riel, sin pantógrafo. Escala §3 de la spec: cada coche mide 11 × 3.4 × 4 (largo × ancho × alto de
 * caja) sobre bogies de 1 u; el piso queda a z 1 y el techo a 5.2 (con el aire acondicionado, 5.7). El tren anda sobre x y
 * nunca gira, así que no hay `heading`.
 *
 * `emu` devuelve `{ solids, lights }` en coordenadas de mundo, con el extremo oeste en `x0` sobre el eje `y`. El coche k arranca
 * en `x0 + COUPLER + k·(CAR_LEN + GAP)`. Cada coche lleva caja, techo, aire acondicionado, dos bogies, bastidor, librea, tres
 * puertas por lado y ventanas; los frentes de cabina, con parabrisas y enganche, van en los dos extremos de la formación y los
 * fuelles entre coches. `lights` trae el salón (`lit`), el cartel LED y los faros o luces rojas según `lead`.
 * Luces: salón (`lit`) un `cyanBleed` por tramo de ventanas del muro sur; cartel LED `amber` en los dos frentes; faros `cyan` en el
 * frente `lead` y luces rojas `magenta` en el otro; con `lead: null`, ni faros ni rojas.
 *
 * La caja de alineación (`trainBox`: x `x0..x0 + trainLen`, y ± 1.7, z `0..TRAIN_TOP`) es el contrato con el animador y con la
 * regla de oclusión de la estación: ningún sólido sale de ahí (las luces pueden ir 0.05 por fuera).
 */
export const CAR_LEN = 11, CAR_W = 3.4, CAR_H = 4, FLOOR_Z = 1, GAP = 0.6, COUPLER = 0.5;
export const trainLen = (cars: number) => cars * CAR_LEN + (cars - 1) * GAP + 2 * COUPLER;
export const TRAIN_TOP = 5.7; // techo 5.2 + aire acondicionado 0.5
export type Lead = "e" | "w" | null;
export interface EmuOpts { cars: 3 | 4; lead: Lead; lit: boolean }

const ROOF_Z = FLOOR_Z + CAR_H; // 5
const DOORS = [[0.07, 0.18], [0.445, 0.555], [0.82, 0.93]] as const;
const PANES = [[0.01, 0.07], [0.18, 0.445], [0.555, 0.82], [0.93, 0.99]] as const;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], plates?: Plate[]): Solid =>
  ({ kind: "prism", at: { x, y, z }, w, d, h, mat, ...(plates && { plates }) });
const rect = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"]): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat });
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Muro sur de la caja (se pinta en este orden): bastidor, filete, banda, ventanas, puertas y ventanillas. */
function southWall(): Plate[] {
  return [
    rect(2, 0, 1, FLOOR_Z, 1.25, "steel"), // bastidor
    rect(2, 0, 1, 1.4, 1.6, "livery"), // filete
    rect(2, 0, 1, 3.9, 4.7, "livery"), // banda ancha
    ...PANES.map(([u0, u1]) => rect(2, u0, u1, 2.5, 3.8, "glass")), // banda de ventanas, entre puertas y extremos
    ...DOORS.map(([u0, u1]) => rect(2, u0, u1, 1.05, 3.9, "livery")),
    ...DOORS.map(([u0, u1]) => rect(2, r6(u0 + 0.02), r6(u1 - 0.02), 2.5, 3.4, "glass")), // ventanilla de cada puerta
  ];
}

/** Frente de cabina: franja azul, mitad superior azul y parabrisas, en el muro `wall` (1 este, 3 oeste). */
const cabFront = (wall: number): Plate[] => [rect(wall, 0, 1, 1.6, 2.6, "livery"), rect(wall, 0, 1, 4.3, 5, "livery"), rect(wall, 0.1, 0.9, 2.6, 4.3, "asphalt")];

/** Formación de `cars` coches con el extremo oeste en `x0` sobre el eje `y`; `lead` es la punta con faros (la otra lleva luces rojas); `lit`, el salón encendido. */
export function emu(x0: number, y: number, opts: EmuOpts): { solids: Solid[]; lights: Accent[] } {
  const { cars } = opts;
  const solids: Solid[] = [];
  const lights: Accent[] = [];
  const yN = y - CAR_W / 2, ySur = y + CAR_W / 2 + 0.05;
  for (let k = 0; k < cars; k++) {
    const xk = x0 + COUPLER + k * (CAR_LEN + GAP), c = xk + CAR_LEN / 2;
    const plates = [...southWall(), ...(k === cars - 1 ? cabFront(1) : []), ...(k === 0 ? cabFront(3) : [])];
    solids.push(prism(xk, yN, FLOOR_Z, CAR_LEN, CAR_W, CAR_H, "whitewash", plates)); // caja
    solids.push(prism(xk, yN, ROOF_Z, CAR_LEN, CAR_W, 0.2, "paving")); // techo
    solids.push(prism(c - 1.8, y - 1, ROOF_Z + 0.2, 3.6, 2, 0.5, "steel", [rect(2, 0.1, 0.45, 5.3, 5.6, "asphalt"), rect(2, 0.55, 0.9, 5.3, 5.6, "asphalt")])); // aire acondicionado y rejillas
    for (const dx of [-3.2, 3.2]) solids.push(prism(c + dx - 1.2, y - 1.4, 0, 2.4, 2.8, FLOOR_Z, "steel")); // bogies
    if (opts.lit) for (const [u0, u1] of PANES) { // salón: un resplandor por tramo de ventanas del muro sur
      const xa = xk + CAR_LEN - u1 * CAR_LEN, xb = xk + CAR_LEN - u0 * CAR_LEN;
      lights.push({ kind: "poly", pts: [v3(xa, ySur, 2.5), v3(xb, ySur, 2.5), v3(xb, ySur, 3.8), v3(xa, ySur, 3.8)], color: "cyanBleed", alpha: 0.7 });
    }
    if (k < cars - 1) solids.push(prism(xk + CAR_LEN, y - 1.5, 1.2, GAP, 3, 3.6, "asphalt")); // fuelle hacia el coche siguiente
  }
  solids.push(prism(x0, y - 0.3, 1.3, COUPLER, 0.6, 0.4, "safety")); // enganche oeste
  solids.push(prism(x0 + trainLen(cars) - COUPLER, y - 0.3, 1.3, COUPLER, 0.6, 0.4, "safety")); // enganche este
  const xW = x0 + COUPLER - 0.05, xE = x0 + trainLen(cars) - COUPLER + 0.05; // frentes de cabina, luces 0.05 por fuera
  for (const x of [xW, xE]) { // cartel LED ámbar en los dos frentes, aunque no haya `lead`
    const ya = yN + 0.35 * CAR_W, yb = yN + 0.65 * CAR_W;
    lights.push({ kind: "poly", pts: [v3(x, ya, 4.4), v3(x, yb, 4.4), v3(x, yb, 4.75), v3(x, ya, 4.75)], color: "amber", alpha: 0.9 });
  }
  if (opts.lead) {
    const head = opts.lead === "e" ? xE : xW, tail = opts.lead === "e" ? xW : xE;
    for (const dy of [-1.3, 1.3]) {
      lights.push({ kind: "dot", at: v3(head, y + dy, 1.8), r: 0.3, color: "cyan" }); // faros
      lights.push({ kind: "dot", at: v3(tail, y + dy, 1.8), r: 0.25, color: "magenta" }); // luces rojas
    }
  }
  return { solids, lights };
}

/** Caja de alineación de la formación: contrato con el animador y con las reglas de oclusión. */
export function trainBox(x0: number, y: number, cars: 3 | 4): Bounds {
  return { min: { x: x0, y: y - CAR_W / 2, z: 0 }, max: { x: x0 + trainLen(cars), y: y + CAR_W / 2, z: TRAIN_TOP } };
}
