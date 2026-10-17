import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid, type Tri } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { AnimLayer } from "../scenes/animator";
import type { WorldScene } from "../scenes/world";
import type { ZonedAnimator } from "../world/assemble";
import type { Box } from "../world/frame";

/** Solape en x e y, bordes incluidos; z no cuenta. */
export function overlaps(b: Bounds, box: Box): boolean {
  return b.min.x <= box.x1 && b.max.x >= box.x0 && b.min.y <= box.y1 && b.max.y >= box.y0;
}

const inside = (p: Vec3, box: Box): boolean => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;

// sin arrays intermedios: corre por tick sobre las bandas de agua del mundo entero
function triOverlaps({ pts: [a, b, c] }: Tri, box: Box): boolean {
  return Math.min(a.x, b.x, c.x) <= box.x1 && Math.max(a.x, b.x, c.x) >= box.x0 && Math.min(a.y, b.y, c.y) <= box.y1 && Math.max(a.y, b.y, c.y) >= box.y0;
}

/**
 * Un sólido dentro de la caja: entero si solapa, `null` si no. Las mallas
 * `ground` (terreno, agua, espuma) cubren el mundo entero: se filtran por
 * triángulo, sin cortar ninguno.
 */
export function cropSolid(s: Solid, box: Box): Solid | null {
  if (s.kind !== "ground") return overlaps(bounds(s), box) ? s : null;
  const tris = s.tris.filter((t) => triOverlaps(t, box));
  return tris.length === s.tris.length ? s : tris.length ? { ...s, tris } : null;
}

// el stage reconoce el agua reclamada por identidad: terreno y reclamos tienen que recortar al mismo objeto
const memo = new WeakMap<Box, WeakMap<Solid, Solid | null>>();

/** `cropSolid` memoizado por (caja, sólido), para el terreno y los reclamos. Las capas animadas no: mutan sus sólidos. La caja se compara por identidad: `cropScene` y `cropAnimators` tienen que recibir el mismo objeto. */
export function cropShared(s: Solid, box: Box): Solid | null {
  let m = memo.get(box);
  if (!m) memo.set(box, (m = new WeakMap()));
  if (!m.has(s)) m.set(s, cropSolid(s, box));
  return m.get(s)!;
}

export function cropSolids(solids: readonly Solid[], box: Box, crop = cropSolid): Solid[] {
  return solids.flatMap((s) => crop(s, box) ?? []);
}

export function cropAccents(accents: readonly Accent[], box: Box): Accent[] {
  return accents.filter((a) => (a.kind === "dot" ? inside(a.at, box) : a.pts.some((p) => inside(p, box))));
}

/** La escena reducida a la caja. Las subescenas y `landmarks` pasan tal cual: el stage no las lee. */
export function cropScene(scene: WorldScene, box: Box): WorldScene {
  const { terrain } = scene;
  return {
    ...scene,
    terrain: {
      ground: cropSolids(terrain.ground, box, cropShared),
      bleed: cropSolids(terrain.bleed, box, cropShared),
      water: cropSolids(terrain.water, box, cropShared),
      foam: cropShared(terrain.foam, box) ?? { kind: "ground", mat: "foam", tris: [] },
    },
    ground: cropSolids(scene.ground, box),
    solids: cropSolids(scene.solids, box),
    accents: cropAccents(scene.accents, box),
  };
}

function cropLayer(l: AnimLayer, box: Box): AnimLayer {
  if (l.kind === "solid") return { ...l, solids: cropSolids(l.solids, box) };
  if (l.kind === "accent") return { ...l, accents: cropAccents(l.accents, box) };
  return { ...l, water: cropSolids(l.water, box) };
}

const isEmpty = (l: AnimLayer): boolean => (l.kind === "solid" ? l.solids : l.kind === "accent" ? l.accents : l.water).length === 0;

/**
 * Cada animador envuelto: mismos ids, zona y tick; `layer` y `claims` filtrados
 * con las reglas de `cropScene`. Se descarta el que no tiene nada en la caja en
 * su estado inicial (no hace falta tickear el mar entero para mirar una chimenea).
 */
export function cropAnimators(animators: readonly ZonedAnimator[], box: Box): ZonedAnimator[] {
  return animators.flatMap((a) => {
    const layer = (id: string): AnimLayer => cropLayer(a.layer(id), box);
    if (a.ids.every((id) => isEmpty(layer(id)))) return [];
    return [{ zone: a.zone, ids: a.ids, claims: a.claims && cropSolids(a.claims, box, cropShared), layer, tick: (dt: number) => a.tick(dt) }];
  });
}

const PAD_M = 3; // margen del pad alrededor de la pieza, el mismo que el de las regiones

/** Caja en x/y y z más alto de un conjunto de sólidos: el encuadre de una pieza. */
export function solidsBox(solids: readonly Solid[]): { box: Box; h: number } {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  let h = -Infinity;
  for (const s of solids) {
    const { min, max } = bounds(s);
    box.x0 = Math.min(box.x0, min.x); box.y0 = Math.min(box.y0, min.y);
    box.x1 = Math.max(box.x1, max.x); box.y1 = Math.max(box.y1, max.y);
    h = Math.max(h, max.z);
  }
  return { box, h };
}

/**
 * Una pieza sola: lo que emite `build`, armado en el origen, sobre un pad
 * cuadrado de 1 u de espesor centrado en el origen que la cubre con margen.
 * La cara de arriba del pad va al piso de la pieza (−1 para los barcos, que
 * flotan en `WATER_Z`). Sin terreno ni subescenas: el stage no las lee.
 */
export function pieceScene(build: (out: Solid[], accents: Accent[]) => void, pad: Material = "paving"): WorldScene {
  const solids: Solid[] = [], accents: Accent[] = [];
  build(solids, accents);
  let r = 0, floor = Infinity;
  for (const s of solids) {
    const { min, max } = bounds(s);
    r = Math.max(r, -min.x, max.x, -min.y, max.y);
    floor = Math.min(floor, min.z);
  }
  const h = r + PAD_M, top = Math.floor(floor);
  // tapa y las dos caras que ve la cámara (este, sur), con la normal hacia afuera
  const nw = v3(-h, -h, top), ne = v3(h, -h, top), se = v3(h, h, top), sw = v3(-h, h, top);
  const neB = v3(h, -h, top - 1), seB = v3(h, h, top - 1), swB = v3(-h, h, top - 1);
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): Tri[] => [{ pts: [a, b, c] }, { pts: [a, c, d] }];
  const origin = v3(0, 0, 0);
  return {
    terrain: { ground: [], bleed: [], water: [], foam: { kind: "ground", mat: "foam", tris: [] } },
    ground: [{ kind: "ground", mat: pad, tris: [...quad(nw, ne, se, sw), ...quad(ne, neB, seB, se), ...quad(sw, se, seB, swB)] }],
    solids,
    accents,
    landmarks: { portfolio: origin, cv: origin, blog: origin },
    shipyard: null, city: null, factory: null, sea: null, hinterland: null, tech: null, fair: null,
  };
}
