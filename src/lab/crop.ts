import type { Accent } from "../iso/accent";
import type { Vec3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid, type Tri } from "../iso/solids";
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

/** `cropSolid` memoizado por (caja, sólido), para el terreno y los reclamos. Las capas animadas no: mutan sus sólidos. */
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
