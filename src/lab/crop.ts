import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { shadowPolygon } from "../iso/light";
import { bounds, type Bounds, type Solid, type Tri, tessellate } from "../iso/solids";
import type { AccentColor, Material } from "../map/palette-iso";
import type { Animator, AnimLayer } from "../scenes/animator";
import type { WorldScene } from "../scenes/world";
import type { ZonedAnimator } from "../world/assemble";
import type { Box } from "../world/frame";

/** Overlap in x and y, edges included; z does not count. */
export function overlaps(b: Bounds, box: Box): boolean {
  return b.min.x <= box.x1 && b.max.x >= box.x0 && b.min.y <= box.y1 && b.max.y >= box.y0;
}

const inside = (p: Vec3, box: Box): boolean => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;

// no intermediate arrays: runs every tick over the water bands of the whole world
function triOverlaps({ pts: [a, b, c] }: Tri, box: Box): boolean {
  return Math.min(a.x, b.x, c.x) <= box.x1 && Math.max(a.x, b.x, c.x) >= box.x0 && Math.min(a.y, b.y, c.y) <= box.y1 && Math.max(a.y, b.y, c.y) >= box.y0;
}

/**
 * A solid inside the box: whole if it overlaps, `null` if not. The `ground`
 * meshes (terrain, water, foam) cover the whole world: they are filtered by
 * triangle, without cutting any.
 */
export function cropSolid(s: Solid, box: Box): Solid | null {
  if (s.kind !== "ground") return overlaps(bounds(s), box) ? s : null;
  const tris = s.tris.filter((t) => triOverlaps(t, box));
  return tris.length === s.tris.length ? s : tris.length ? { ...s, tris } : null;
}

// the stage recognizes the claimed water by identity: terrain and claims must crop to the same object
const memo = new WeakMap<Box, WeakMap<Solid, Solid | null>>();

/** `cropSolid` memoized by (box, solid), for the terrain and the claims. Animated layers are not: they mutate their solids. The box is compared by identity: `cropScene` and `cropAnimators` must receive the same object. */
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

/** The scene reduced to the box. The subscenes and `landmarks` pass through as they are: the stage does not read them. */
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
 * Each animator wrapped: same ids, zone and tick; `layer` and `claims` filtered
 * with the rules of `cropScene`. The one with nothing in the box in its initial
 * state is dropped (no need to tick the whole sea to look at a chimney).
 */
export function cropAnimators(animators: readonly ZonedAnimator[], box: Box): ZonedAnimator[] {
  return animators.flatMap((a) => {
    const layer = (id: string): AnimLayer => cropLayer(a.layer(id), box);
    if (a.ids.every((id) => isEmpty(layer(id)))) return [];
    return [{ zone: a.zone, ids: a.ids, claims: a.claims && cropSolids(a.claims, box, cropShared), layer, tick: (dt: number) => a.tick(dt) }];
  });
}

const PAD_M = 3; // margin of the pad around the piece, the same as the regions'

/** Box in x/y and highest z of a set of solids: a piece's framing. */
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
 * A piece on its own: what `build` emits, built at the origin, on a pad
 * 1 u thick that covers it with a margin, both it and the shadow it casts
 * (with the engine's projector: the pad ends up off-center toward where the shadow falls).
 * The pad's top face goes at the piece's floor (−1 for the ships, which
 * float at `WATER_Z`). No terrain or subscenes: the stage does not read them.
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
  // the shadow falls ENE and reaches ~3 times the height: the pad covers it whole, even if it ends up off-center
  let x0 = -r, y0 = -r, x1 = r, y1 = r;
  for (const s of solids) for (const p of shadowPolygon(s) ?? []) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  x0 -= PAD_M; y0 -= PAD_M; x1 += PAD_M; y1 += PAD_M;
  // no solid, or only faceless ones: floor stays Infinity, so the pad sits at z = 0
  const top = Number.isFinite(floor) ? Math.floor(floor) : 0;
  // the top and the two faces the camera sees (east, south), with the normal pointing outward
  const nw = v3(x0, y0, top), ne = v3(x1, y0, top), se = v3(x1, y1, top), sw = v3(x0, y1, top);
  const neB = v3(x1, y0, top - 1), seB = v3(x1, y1, top - 1), swB = v3(x0, y1, top - 1);
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

export interface Readout {
  solids: number;
  ground: number;
  faces: number;
  accents: number;
  box: { min: Vec3; max: Vec3; w: number; d: number; h: number } | null;
  materials: Material[];
  accentColors: AccentColor[];
}

/**
 * What the storybook panel counts for an exhibit. `solids` is the scene
 * solids plus the current state of the animators' `solid` layers; the scene
 * ground is counted apart in `ground`. Faces, box and materials cover the
 * ground and the solids together. Terrain and water layers never count.
 * Materials are those of the faces `tessellate` draws (hull deck, gondolas
 * and facade glass included), not the `mat`/`topMat` fields.
 */
export function readout(scene: WorldScene, animators: readonly Animator[]): Readout {
  const layers = animators.flatMap((a) => a.ids.map((id) => a.layer(id)));
  const solids = [...scene.solids, ...layers.flatMap((l) => (l.kind === "solid" ? l.solids : []))];
  const drawn = [...scene.ground, ...solids];
  const accents = [...scene.accents, ...layers.flatMap((l) => (l.kind === "accent" ? l.accents : []))];
  const mats = new Set<Material>();
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  let faces = 0;
  for (const s of drawn) {
    const fs = tessellate(s);
    faces += fs.length;
    for (const f of fs) mats.add(f.mat);
    const b = bounds(s);
    min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y); min.z = Math.min(min.z, b.min.z);
    max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y); max.z = Math.max(max.z, b.max.z);
  }
  return {
    solids: solids.length,
    ground: scene.ground.length,
    faces,
    accents: accents.length,
    box: drawn.length ? { min, max, w: max.x - min.x, d: max.y - min.y, h: max.z - min.z } : null,
    materials: [...mats].sort(),
    accentColors: [...new Set(accents.map((a) => a.color))].sort(),
  };
}
