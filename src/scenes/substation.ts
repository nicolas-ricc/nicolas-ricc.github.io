import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate } from "../iso/translate";
import type { Material } from "../map/palette-iso";

/**
 * Outdoor substation of the factory (Pont-l'Abbé + Davis Dam lattice).
 * Spec: docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md §9; plan: docs/plans/2026-10-24-215-subestacion.md.
 *
 * The geometry is drawn in a local frame, the fence `x 149..190, y −60..−47`, and moved with
 * `SUBSTATION_SHIFT (−95, +58)` to today's spot: `x 54..95, y −2..11`, against the siding (#244).
 * Everything exported is in world coordinates; the local frame is private (`*_LOCAL` and the `*Local` builders).
 */
export const SUBSTATION_SHIFT = { x: -95, y: 58 } as const;

const SUBSTATION_LOCAL = { x0: 149, x1: 190, y0: -60, y1: -47 } as const;
const PHASES_LOCAL = [-57, -53.5, -50] as const;
const TRANSFORMERS_LOCAL = [-59, -53] as const; // y0 of each tank: T1 north, T2 south
const FIREWALL_LOCAL = { x: 171.5, y: -54.3, w: 7, d: 0.6, h: 5.5 } as const;

export const SUBSTATION = { x0: SUBSTATION_LOCAL.x0 + SUBSTATION_SHIFT.x, x1: SUBSTATION_LOCAL.x1 + SUBSTATION_SHIFT.x, y0: SUBSTATION_LOCAL.y0 + SUBSTATION_SHIFT.y, y1: SUBSTATION_LOCAL.y1 + SUBSTATION_SHIFT.y } as const;
export const PHASES_Y: readonly [number, number, number] = [PHASES_LOCAL[0] + SUBSTATION_SHIFT.y, PHASES_LOCAL[1] + SUBSTATION_SHIFT.y, PHASES_LOCAL[2] + SUBSTATION_SHIFT.y];
export const TRANSFORMERS_Y: readonly [number, number] = [TRANSFORMERS_LOCAL[0] + SUBSTATION_SHIFT.y, TRANSFORMERS_LOCAL[1] + SUBSTATION_SHIFT.y]; // y0 of each tank: T1 north, T2 south
export const FIREWALL = { ...FIREWALL_LOCAL, x: FIREWALL_LOCAL.x + SUBSTATION_SHIFT.x, y: FIREWALL_LOCAL.y + SUBSTATION_SHIFT.y } as const;

/** Builds with `build` in the local frame and pushes each solid moved to the world. */
const emit = (out: Solid[], build: (o: Solid[]) => void): void => {
  const local: Solid[] = [];
  build(local);
  for (const s of local) out.push(translate(s, SUBSTATION_SHIFT.x, SUBSTATION_SHIFT.y));
};

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });
const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });
const beam = (from: [number, number, number], to: [number, number, number], w: number, h: number, mat: Material): Solid => ({ kind: "beam", from: v3(...from), to: v3(...to), w, h, mat });
const wire = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Solid => beam([x0, y0, z0], [x1, y1, z1], 0.15, 0.15, "steel");
/** n skirts stacked from z0 (h 0.3), r 0.3 the even ones and 0.42 the odd ones. */
const skirts = (out: Solid[], x: number, y: number, z0: number, n = 6): void => { for (let i = 0; i < n; i++) out.push({ kind: "cylinder", at: v3(x, y, z0 + 0.3 * i), r: i % 2 ? 0.42 : 0.3, h: 0.3, mat: "whitewash" }); };

const ARM_Z = 4.4, CT_TOP_Z = 5.65; // axis of the disconnector arm and tip of the CT head: their jumpers land there
const BUSHINGS_X = [173.5, 175, 176.5] as const;
/** Tip of the bushing (at 35° over the tank lid): the transformer and its jumpers share it. */
const bushingTip = (x: number, y0: number): [number, number, number] => [x, y0 + 2 + 2.5 * Math.cos(Math.PI * 35 / 180), 4.5 + 2.5 * Math.sin(Math.PI * 35 / 180)];

/** Power transformer: base, tank with plate, fins (east and, if `southBank`, south), conservator with pipe, 3 bushings and a 4-frame pit. */
function powerTransformerLocal(out: Solid[], y0: number, southBank: boolean): void {
  out.push(prism(172.5, y0 + 0.5, 0, 5, 3, 0.5, "concrete")); // base
  out.push({ ...prism(172, y0, 0.5, 6, 4, 4, "steel"), plates: [southBank ? { wall: 2, shape: "rect", u0: 0.05, u1: 0.1833, z0: 2, z1: 2.6, mat: "whitewash" } : { wall: 1, shape: "rect", u0: 0.77, u1: 0.97, z0: 2, z1: 2.6, mat: "whitewash" }] }); // tank + plate (T1 carries it to the east: the south bank does not fit)
  for (let i = 0; i < 6; i++) {
    out.push(prism(178, y0 + 0.925 + 0.4 * i, 1, 1.6, 0.15, 3, "steel"));                            // east fins
    if (southBank) out.push(prism(173.925 + 0.4 * i, y0 + 4, 1, 0.15, 1.6, 3, "steel"));             // south fins
  }
  out.push(beam([172.5, y0 + 1, 5.8], [178.5, y0 + 1, 5.8], 1.2, 1.2, "steel"));                     // conservator (axis 5.8, belly 5.2)
  for (const x of [173.35, 177.35]) out.push(prism(x, y0 + 0.85, 4.5, 0.3, 0.3, 0.7, "steel"));      // posts
  out.push(wire(178.3, y0 + 1, 5.2, 177.7, y0 + 1, 4.5));                                           // pipe
  for (const x of BUSHINGS_X) out.push(beam([x, y0 + 2, 4.5], bushingTip(x, y0), 0.4, 0.4, "whitewash")); // bushings
  out.push(prism(171.4, y0 - 0.6, 0, 7.2, 0.3, 0.3, "concrete"), prism(171.4, y0 + 4.3, 0, 7.2, 0.3, 0.3, "concrete")); // pit N and S
  out.push(prism(171.4, y0 - 0.3, 0, 0.3, 4.6, 0.3, "concrete"), prism(178.3, y0 - 0.3, 0, 0.3, 4.6, 0.3, "concrete")); // pit W and E
}

/** Lattice portal at x: 2 columns of 4 uprights with an X per panel on the east and south faces, Warren beam, tips and masts. */
function latticePortalLocal(out: Solid[], x: number): void {
  for (const c of [-58.5, -48.5]) {
    for (const dx of [-0.5, 0.3]) for (const dy of [-0.5, 0.3]) out.push(prism(x + dx, c + dy, 0, 0.2, 0.2, 9, "steel")); // uprights
    for (const [z0, z1] of [[0.1, 2.5], [2.5, 5], [5, 7.5], [7.5, 9]] as const) {                                         // panels (the last is 1.5; the first starts at 0.1: the diagonal's section does not go below z 0)
      out.push(wire(x + 0.4, c - 0.4, z0, x + 0.4, c + 0.4, z1), wire(x + 0.4, c + 0.4, z0, x + 0.4, c - 0.4, z1));     // X east face
      out.push(wire(x - 0.4, c + 0.4, z0, x + 0.4, c + 0.4, z1), wire(x + 0.4, c + 0.4, z0, x - 0.4, c + 0.4, z1));     // X south face
    }
    out.push({ kind: "cone", at: v3(x, c, 9), r: 0.7, h: 1, mat: "steel", sides: 4 });                                  // tip
    out.push(prism(x - 0.075, c - 0.075, 10, 0.15, 0.15, 2, "steel"));                                                  // mast (top z 12)
  }
  for (const z of [9, 10]) out.push(beam([x, -58, z], [x, -49, z], 0.3, 0.3, "steel")); // chords
  for (let i = 0; i < 8; i++) out.push(wire(x, -58 + (9 * i) / 8, 9 + (i % 2), x, -58 + (9 * (i + 1)) / 8, 9 + ((i + 1) % 2))); // Warren zigzag
}

/** Three phases from 151.5 to 186.5 (local frame) at z 9.5: a chain of 9 discs at each anchor and the conductor between them (disjoint in x, for `sortByDepth`). */
function phasesLocal(out: Solid[]): void {
  for (const y of PHASES_LOCAL) {
    for (let i = 0; i < 9; i++) {
      const s = i % 2 ? 0.35 : 0.5, mat: Material = i % 2 ? "glass" : "whitewash";
      for (const x of [151.5 + 0.15 * i, 186.5 - 0.15 * (i + 1)]) out.push(beam([x, y, 9.5], [x + 0.15, y, 9.5], s, s, mat)); // disc
    }
    out.push(wire(152.85, y, 9.5, 185.15, y, 9.5)); // conductor
  }
}

/** Center-break disconnector: frame, two columns of 6 skirts and a `signal` arm. */
function disconnectorLocal(out: Solid[], y: number): void {
  out.push(prism(156.8, y - 0.3, 0, 2.4, 0.6, 2.5, "steel")); // frame
  for (const x of [157.1, 158.9]) skirts(out, x, y, 2.5);     // columns
  out.push(beam([157.1, y, ARM_Z], [158.9, y, ARM_Z], 0.2, 0.2, "signal")); // arm
}

/** Current transformer: 4-leg stand, lid, 6 skirts and a rounded head. */
function currentTransformerLocal(out: Solid[], y: number): void {
  for (const dx of [-0.4, 0.25]) for (const dy of [-0.4, 0.25]) out.push(prism(165 + dx, y + dy, 0, 0.15, 0.15, 2.5, "steel")); // legs
  out.push(prism(164.6, y - 0.4, 2.5, 0.8, 0.8, 0.15, "steel")); // lid
  skirts(out, 165, y, 2.65);
  out.push({ kind: "cylinder", at: v3(165, y, 4.45), r: 0.6, h: 0.8, mat: "whitewash" }); // head
  out.push({ kind: "cone", at: v3(165, y, CT_TOP_Z - 0.4), r: 0.6, h: 0.4, mat: "whitewash", sides: 8 }); // cap
}

/** Jumpers from disconnectors and CTs to the conductor (they end at its belly, z 9.425). */
function droppersLocal(out: Solid[]): void {
  for (const y of PHASES_LOCAL) out.push(wire(158, y, 9.425, 158, y, ARM_Z + 0.1), wire(165, y, 9.425, 165, y, CT_TOP_Z)); // disconnector (arm) and CT (head)
  TRANSFORMERS_LOCAL.forEach((y0, k) => { for (const x of BUSHINGS_X) { const t = bushingTip(x, y0); out.push(wire(x, PHASES_LOCAL[k + 1]!, 9.425, t[0], t[1], t[2])); } }); // bushings → nearest phase
}

/** Fence: 13 posts, diamond mesh (X per panel) to the south and east, and a two-leaf gate at x 168.5..171.5 (local frame). */
function fenceLocal(out: Solid[]): void {
  const post = (x: number, y: number): Solid => prism(x, y, 0, 0.15, 0.15, 2.2, "steel");
  const xs: number[] = [];
  for (let i = 0; i <= 10; i++) if (i !== 5) xs.push(Math.min(149 + 4.1 * i, 189.85)); // i = 5 falls on the gate
  const ys = [1, 2, 3].map((j) => Math.max(-47.15 - (13 / 3) * j, -60));                  // the southeast corner is already post i = 10
  for (const x of xs) out.push(post(x, -47.15));
  for (const y of ys) out.push(post(189.85, y));
  const sx = [...xs.filter((x) => x < 168.5).map((x) => x + 0.075), 168.5, 171.5, ...xs.filter((x) => x > 171.5).map((x) => x + 0.075)]; // mesh stops to the south
  const ey = [-47.075, ...ys.map((y) => y + 0.075)];                                                                                       // and to the east
  for (let k = 0; k < sx.length - 1; k++) if (sx[k] !== 168.5) out.push(wire(sx[k]!, -47.075, 0.1, sx[k + 1]!, -47.075, 2.1), wire(sx[k]!, -47.075, 2.1, sx[k + 1]!, -47.075, 0.1)); // 168.5 → 171.5 is the gate
  for (let k = 0; k < ey.length - 1; k++) out.push(wire(189.925, ey[k]!, 0.1, 189.925, ey[k + 1]!, 2.1), wire(189.925, ey[k]!, 2.1, 189.925, ey[k + 1]!, 0.1));
  out.push({ ...prism(168.5, -47.6, 0, 0.6, 0.6, 2.6, "concrete"), plates: [{ wall: 2, shape: "tri", u0: 0.15, u1: 0.85, z0: 1.5, z1: 2.1, mat: "safety" }] }); // bolt
  out.push({ ...prism(170.9, -47.6, 0, 0.6, 0.6, 2.6, "concrete"), plates: [{ wall: 2, shape: "rect", u0: 0.15, u1: 0.85, z0: 1.5, z1: 2.1, mat: "signal" }] }); // danger
  for (const a of [169.1, 170]) {
    for (let i = 0; i < 4; i++) out.push(prism(a + 0.25 * i, -47.375, 0, 0.15, 0.15, 2, "steel")); // bars
    out.push(wire(a, -47.3, 1.85, a + 0.9, -47.3, 1.85));                                           // rail
  }
}

/** Power transformer with `y0` (of the tank) in world coordinates; see `powerTransformerLocal`. */
export const powerTransformer = (out: Solid[], y0: number, southBank: boolean): void => emit(out, (o) => powerTransformerLocal(o, y0 - SUBSTATION_SHIFT.y, southBank));
/** Lattice portal at world `x`; see `latticePortalLocal`. */
export const latticePortal = (out: Solid[], x: number): void => emit(out, (o) => latticePortalLocal(o, x - SUBSTATION_SHIFT.x));
/** The three phases in the world, from `SUBSTATION.x0 + 2.5` to `SUBSTATION.x1 - 3.5`; see `phasesLocal`. */
export const phases = (out: Solid[]): void => emit(out, phasesLocal);
/** Disconnector on world phase `y`; see `disconnectorLocal`. */
export const disconnector = (out: Solid[], y: number): void => emit(out, (o) => disconnectorLocal(o, y - SUBSTATION_SHIFT.y));
/** Current transformer on world phase `y`; see `currentTransformerLocal`. */
export const currentTransformer = (out: Solid[], y: number): void => emit(out, (o) => currentTransformerLocal(o, y - SUBSTATION_SHIFT.y));
/** Jumpers from disconnectors, CTs and bushings to the phases, in the world; see `droppersLocal`. */
export const droppers = (out: Solid[]): void => emit(out, droppersLocal);
/** Fence with mesh and gate in the world (x `SUBSTATION.x0 + 19.5`..`+ 22.5`, 73.5..76.5); see `fenceLocal`. */
export const fence = (out: Solid[]): void => emit(out, fenceLocal);

/** Everything in the local frame and a single move (the exported ones already move: calling them here would shift the substation twice). */
export function substation(out: Solid[]): void {
  emit(out, (o) => {
    o.push(strip([{ x: 149, y: -53.5 }, { x: 190, y: -53.5 }], 13, 0.03, "sand")); // gravel yard
    o.push(strip([{ x: 149, y: -60 }, { x: 190, y: -60 }, { x: 190, y: -47 }, { x: 149, y: -47 }, { x: 149, y: -60 }], 0.3, 0.05, "concrete")); // curb
    for (const x of [151, 187]) latticePortalLocal(o, x);
    phasesLocal(o);
    for (const y of PHASES_LOCAL) disconnectorLocal(o, y);
    for (const y of PHASES_LOCAL) currentTransformerLocal(o, y);
    powerTransformerLocal(o, TRANSFORMERS_LOCAL[0], false);
    powerTransformerLocal(o, TRANSFORMERS_LOCAL[1], true);
    o.push(prism(FIREWALL_LOCAL.x, FIREWALL_LOCAL.y, 0, FIREWALL_LOCAL.w, FIREWALL_LOCAL.d, FIREWALL_LOCAL.h, "concrete")); // firewall
    droppersLocal(o);
    o.push({ ...prism(182, -52, 0, 4, 3, 2.8, "whitewash"), facade: { floors: 1, cols: 2 }, plates: [{ wall: 2, shape: "rect", u0: 0.1, u1: 0.4, z0: 0, z1: 2.3, mat: "steel", toneOffset: -2 }] }); // control hut
    fenceLocal(o);
  });
}
