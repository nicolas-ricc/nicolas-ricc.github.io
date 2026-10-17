import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { inHeadland } from "../map/geo";
import { headlandZ, terrainAt } from "./terrain";

/**
 * Blog, parte estática: la punta de roca con el faro y la casa del farero
 * (clickean Portfolio), el arrecife, dos boyas, y en la fosa el pecio con su
 * boya (landmark del Blog): un costero partido en dos del que asoman la proa y
 * la casa de popa. Los barcos y el mar animado están en sea-anim.ts.
 * Spec §7.
 */
export interface SeaScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; lantern: Vec3; buoys: Vec3[]; neon: { gallery: Vec3[]; coast: Vec3[]; keeperSign: Accent } }

export const LIGHTHOUSE = { x: 396, y: 118, z: 7 } as const;
export const KEEPER = { x: 372, y: 108 } as const;
export const BUOYS: readonly Vec2[] = [{ x: 420, y: 80 }, { x: 430, y: 160 }];
export const WRECK_BUOY = { x: 470, y: 160 } as const;
export const WRECK = { x: 462, y: 150, heading: Math.PI / 6 } as const;
const WATER_Z = -1;
export const DRUM_R0 = 3.2;
const DRUMS = 6, DRUM_H = 4, DRUM_STEP = 0.2, GALLERY_H = 0.6, LANTERN_H = 3, CAP_H = 2;
/** Galería de neón y postes de la baranda: último tambor + 0.5. Las luces van a la altura de la plataforma (lantern.z − 2). */
export const GALLERY_R = DRUM_R0 - (DRUMS - 1) * DRUM_STEP + 0.5;
/**
 * Balizas de costa: arco a ~12.8 u de la punta, de NE a SE por el este. La punta y su orilla
 * (12 u) son Portfolio para `worldZoneAt`; a esta distancia ya es Blog (lo fija sea.test.ts).
 */
export const COAST: readonly Vec2[] = [{ x: 397.5, y: 99.5 }, { x: 403, y: 101.5 }, { x: 408, y: 104 }, { x: 411.5, y: 108.5 }, { x: 413, y: 114.5 }, { x: 413, y: 120.5 }, { x: 412, y: 126.5 }, { x: 408.5, y: 131.5 }];
export const COAST_Z = 1.2;
const REEF_CELLS = 20, BOULDERS = 20; // dos conos por celda de arrecife: hasta 40

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, roof?: "gable"): Solid => (roof ? { kind: "prism", at: v3(x, y, z), w, d, h, mat, roof } : { kind: "prism", at: v3(x, y, z), w, d, h, mat });
const cyl = (x: number, y: number, z: number, r: number, h: number, mat: Material, sides = 10): Solid => ({ kind: "cylinder", at: v3(x, y, z), r, h, mat, sides });

function lighthouse(out: Solid[]): Vec3 {
  const { x, y } = LIGHTHOUSE;
  let z = LIGHTHOUSE.z;
  for (let i = 0; i < DRUMS; i++) { out.push(cyl(x, y, z, DRUM_R0 - i * DRUM_STEP, DRUM_H, i % 2 === 0 ? "whitewash" : "rust")); z += DRUM_H; }
  out.push(cyl(x, y, z, 3, GALLERY_H, "steel")); z += GALLERY_H;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; out.push(prism(x + GALLERY_R * Math.cos(a) - 0.15, y + GALLERY_R * Math.sin(a) - 0.15, z, 0.3, 0.3, 1.2, "steel")); }
  out.push(cyl(x, y, z, 1.6, LANTERN_H, "glass", 8));
  const lantern = v3(x, y, z + LANTERN_H / 2);
  z += LANTERN_H;
  out.push({ kind: "cone", at: v3(x, y, z), r: 1.8, h: CAP_H, mat: "steel", sides: 8 });
  return lantern;
}

function keeperHouse(out: Solid[], accents: Accent[]): Accent {
  const z = headlandZ(KEEPER.x + 4);
  out.push(prism(KEEPER.x, KEEPER.y, z, 8, 6, 4, "whitewash", "gable"));
  const wx = KEEPER.x + 3, wy = KEEPER.y + 6.02; // ventana en la cara sur
  accents.push({ kind: "poly", pts: [v3(wx, wy, z + 1), v3(wx + 1.2, wy, z + 1), v3(wx + 1.2, wy, z + 2), v3(wx, wy, z + 2)], color: "magentaBleed", alpha: 0.9 });
  // Cartel 2 × 1 en la cara sur, apoyado en el alero, sobre una caja oscura como `sign()` en tech.ts: sin ella el blend
  // aditivo contra el techo encalado se lee blanco y no se ve el cambio de color.
  const sx = KEEPER.x + 3, sy = KEEPER.y + 6;
  out.push(prism(sx - 0.2, sy, z + 3.8, 2.4, 0.4, 1.4, "steel"));
  const fy = sy + 0.42;
  return { kind: "poly", pts: [v3(sx, fy, z + 4), v3(sx + 2, fy, z + 4), v3(sx + 2, fy, z + 5), v3(sx, fy, z + 5)], color: "cyan", alpha: 1 };
}

/** Sendero de roca de la escollera al faro: diez tramos, cada uno a la altura de la punta en su centro (la punta sube de 1 a 7). */
function path(ground: Solid[]): void {
  const from = { x: 332, y: 115 }, to = { x: 393, y: 118 }, n = 10;
  for (let i = 0; i < n; i++) {
    const a = { x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n };
    const b = { x: from.x + ((to.x - from.x) * (i + 1)) / n, y: from.y + ((to.y - from.y) * (i + 1)) / n };
    ground.push({ kind: "strip", path: [a, b], width: 1.5, z: headlandZ((a.x + b.x) / 2) + 0.15, mat: "rock" });
  }
}

function rocks(out: Solid[], rng: Rng): void {
  for (const [cx, cy, r] of [[350, 112, 4], [362, 124, 3.5], [385, 110, 4.5], [378, 126, 3], [340, 104, 3], [392, 126, 2.5]] as const) { // afloramientos
    const n = rng.int(5, 6);
    const footprint: Vec2[] = Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; const rr = r * (0.7 + rng.next() * 0.3); return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) }; });
    out.push({ kind: "poly", footprint, z: headlandZ(cx) - 1.5, h: rng.int(2, 3), mat: "rock" });
  }
  let placed = 0; // pedruscos: conos chicos sobre la punta, sin pisar el sendero (y 113..120) ni el faro
  while (placed < BOULDERS) {
    const x = rng.int(340, 398), y = rng.int(99, 133);
    if (!inHeadland(x, y) || (y > 112 && y < 121) || Math.hypot(x - LIGHTHOUSE.x, y - LIGHTHOUSE.y) < 5) continue;
    out.push({ kind: "cone", at: v3(x, y, headlandZ(x) - 0.5), r: 1, h: 1.5, mat: "rock", sides: 5 });
    placed++;
  }
  const cells: Vec2[] = [];
  for (let y = 87; y < 147; y += 6) for (let x = 327; x < 417; x += 6) if (terrainAt(x, y) === "reef") cells.push({ x, y });
  for (let i = cells.length - 1; i > 0; i--) { const j = rng.int(0, i); [cells[i], cells[j]] = [cells[j]!, cells[i]!]; } // barajar
  for (const c of cells.slice(0, REEF_CELLS)) for (let k = 0; k < 2; k++) {
    const x = c.x + (rng.next() - 0.5) * 2, y = c.y + (rng.next() - 0.5) * 2;
    const p = terrainAt(x, y) === "reef" ? { x, y } : c; // el anillo mide 6: un desplazamiento puede caer en orilla o roca; entonces va al centro
    out.push({ kind: "cone", at: v3(p.x, p.y, 0.5), r: 1.5, h: 1, mat: "rock", sides: 5 });
  }
}

function buoysAndWreck(out: Solid[], ground: Solid[], accents: Accent[]): Vec3[] {
  const bases = BUOYS.map((b) => { out.push(cyl(b.x, b.y, WATER_Z, 0.8, 1.5, "rust", 6)); return v3(b.x, b.y, WATER_Z + 1.5); });
  out.push(cyl(WRECK_BUOY.x, WRECK_BUOY.y, WATER_Z, 1, 2, "steel", 6));
  accents.push({ kind: "dot", at: v3(WRECK_BUOY.x, WRECK_BUOY.y, 1), r: 1, color: "magentaMid" });
  const ring = Array.from({ length: 8 }, (_, k): { pts: [Vec3, Vec3, Vec3] } => {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, r0 = 1.6, r1 = 2.5;
    return { pts: [v3(WRECK_BUOY.x + r0 * Math.cos(a0), WRECK_BUOY.y + r0 * Math.sin(a0), -0.95), v3(WRECK_BUOY.x + r1 * Math.cos(a0), WRECK_BUOY.y + r1 * Math.sin(a0), -0.95), v3(WRECK_BUOY.x + r1 * Math.cos(a1), WRECK_BUOY.y + r1 * Math.sin(a1), -0.95)] };
  });
  ground.push({ kind: "ground", mat: "foam", tris: ring });
  wreck(out, ground);
  return bases;
}

/**
 * Pecio (#83): un costero de 40 u partido en dos y hundido de popa en el talud de la fosa. El centro del
 * casco está bajo el agua; asoman la proa (una cuña oxidada con su cubierta y la bita) y la casa de popa
 * (banda de casco oxidada, caseta encalada con ventanas, chimenea y mástil). Coordenadas locales como
 * en el kit de ships.ts: x de popa (0) a proa (`WRECK_LEN`), y a estribor, giradas por `WRECK.heading`.
 * Las piezas quedan todas por encima del agua (z ≥ −1): el motor dibuja los sólidos sobre el agua, así
 * que un casco "hundido" entero se vería a flote.
 */
const WRECK_LEN = 40;
function wreck(out: Solid[], ground: Solid[]): void {
  const c = Math.cos(WRECK.heading), s = Math.sin(WRECK.heading);
  const local = (dx: number, dy: number): Vec2 => ({ x: WRECK.x + dx * c - dy * s, y: WRECK.y + dx * s + dy * c });
  const plate = (pts: [number, number][], z: number, h: number, mat: Material, facade?: { floors: number; cols: number }): Solid => ({ kind: "poly", footprint: pts.map(([dx, dy]) => local(dx, dy)), z, h, mat, ...(facade ? { facade } : {}) });
  const foam = (dx: number, dy: number, r0: number, r1: number): void => {
    const o = local(dx, dy);
    ground.push({ kind: "ground", mat: "foam", tris: Array.from({ length: 8 }, (_, k): { pts: [Vec3, Vec3, Vec3] } => {
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
      return { pts: [v3(o.x + r0 * Math.cos(a0), o.y + r0 * Math.sin(a0), -0.95), v3(o.x + r1 * Math.cos(a0), o.y + r1 * Math.sin(a0), -0.95), v3(o.x + r1 * Math.cos(a1), o.y + r1 * Math.sin(a1), -0.95)] };
    }) });
  };
  // proa: cuña con obra viva oscura, franja oxidada de obra muerta, cubierta de madera y la bita; el agua lame alrededor
  const bow: [number, number][] = [[27, -3.6], [37, -2.4], [WRECK_LEN, 0], [37, 2.4], [27, 3.6]];
  out.push(plate(bow, WATER_Z, 0.8, "hull"), plate(bow, WATER_Z + 0.8, 0.9, "rust"));
  out.push(plate([[28, -2.8], [36.5, -1.9], [39, 0], [36.5, 1.9], [28, 2.8]], WATER_Z + 1.7, 0.2, "deck"));
  const bitt = local(36, 0);
  out.push(cyl(bitt.x, bitt.y, WATER_Z + 1.9, 0.4, 0.5, "steel", 6));
  foam(33, 0, 5.5, 6.8);
  // popa: banda de casco oxidada que asoma, caseta de dos niveles con ventanas, chimenea y mástil
  out.push(plate([[3, -3.6], [12, -3.6], [12, 3.6], [3, 3.6]], WATER_Z, 1, "rust"));
  out.push(plate([[4, -3], [11, -3], [11, 3], [4, 3]], WATER_Z + 1, 1.5, "whitewash", { floors: 1, cols: 4 }));
  out.push(plate([[6, -2.2], [10.5, -2.2], [10.5, 2.2], [6, 2.2]], WATER_Z + 2.5, 1.3, "whitewash", { floors: 1, cols: 3 }));
  const funnel = local(5, 0);
  out.push(cyl(funnel.x, funnel.y, WATER_Z + 2.5, 0.7, 2.2, "rust", 8));
  out.push({ kind: "poly", footprint: [local(9.8, -0.25), local(10.2, -0.25), local(10.2, 0.25), local(9.8, 0.25)], z: WATER_Z + 3.8, h: 4.5, mat: "steel" }); // mástil sobre la caseta
  foam(7.5, 0, 5.5, 6.8);
}

export function sea(rng: Rng): SeaScene {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [];
  const lantern = lighthouse(solids);
  const keeperSign = keeperHouse(solids, accents);
  path(ground);
  rocks(solids, rng);
  const buoys = buoysAndWreck(solids, ground, accents);
  const gallery = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return v3(LIGHTHOUSE.x + GALLERY_R * Math.cos(a), LIGHTHOUSE.y + GALLERY_R * Math.sin(a), lantern.z - 2); });
  return { ground, solids, accents, lantern, buoys, neon: { gallery, coast: COAST.map((p) => v3(p.x, p.y, COAST_Z)), keeperSign } };
}
