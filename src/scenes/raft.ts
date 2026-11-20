import { clipPolygon, lerp2, mergeConvex } from "../iso/clip";
import { polygonNormal, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { rigid } from "../iso/rigid";
import type { MeshFace, Solid } from "../iso/solids";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";
import { groundDiagonal, toWorld, type TextPlane } from "../kit/lettering";
import { marqueeLayout } from "../kit/marquee";
import { createRng, SEED } from "../map/seed";

/**
 * Cap height of WRITING in Chainsaw Carnage, set by the level-3 OCR at the phone scale 0.83: at 10.8 it read `WRITHG`; 11.3..11.8 read `WRITING` at both sites.
 * The raft raised it to 20 so the ink reads over the plank joints (#451, under the vertical floors).
 * The owner's decision (2026-11-20) sets 17.25 with the ground-sign floors of `SIGN_RULES.ground` (#460).
 */
export const WRITING_CAP = 17.25;
/** The raft floats: its top face sits at this z, the same height all over. */
export const BOARD_TOP = -0.4;
/** Raft beyond the ink of the word on every side, in text units. At least the oracle backing margin (backingW·SIGN_FONT.width) plus RAFT.ragged, so every plank end covers the margin (#460). */
export const BOARD_PAD = 1.7;

/** The two places the Writing raft can float: `wide` (open sea between the two buoys) and `tall`. */
export type WritingSite = "wide" | "tall";
export const PLATFORM_SITES: Record<WritingSite, Vec3> = { wide: v3(570, 105, 0), tall: v3(440, 400, 0) };

/** The raft's pose over the water: a lift and a tilt, applied as one rigid motion about the site at z −1. */
export interface RaftPose { dz: number; pitch: number; roll: number }
export const REST_POSE: Readonly<RaftPose> = Object.freeze({ dz: 0, pitch: 0, roll: 0 });

/** The glyph layout of WRITING at `WRITING_CAP`, in text space. */
export const LAYOUT = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING);

/** The raft's constants, in text units: plank width and joint, plank and beam thickness, ragged ends, beam section, inset and overhang; the wet band's top z; the grain's width and edge margin, the nail's side and its offset along a and b from the beam centre / plank centre. */
export const RAFT = Object.freeze({ plankW: 2.4, joint: 0.15, plankH: 0.5, ragged: 0.3, beamW: 1.4, beamH: 0.5, beamInset: 1.5, beamOverhang: 1.2, wetZ: -0.7, grainW: 0.06, grainEdge: 0.2, nail: 0.12, nailDa: 0.35, nailDb: 0.6 });

export interface Rect { a0: number; a1: number; b0: number; b1: number }
export interface RaftPlan { sheet: Rect; planks: (Rect & { tone: number; grain: Rect[] })[]; beams: Rect[] }

const WATER_Z = -1;
const DECK_Z = BOARD_TOP - RAFT.plankH; // the sheet and the top of the beams
const BEAM_Z = DECK_Z - RAFT.beamH;
const PITCH = RAFT.plankW + RAFT.joint;

let planMemo: RaftPlan | undefined;
const clonePlan = (p: RaftPlan): RaftPlan => ({ sheet: { ...p.sheet }, planks: p.planks.map((k) => ({ ...k, grain: k.grain.map((g) => ({ ...g })) })), beams: p.beams.map((b) => ({ ...b })) });

/** The raft in text space, deterministic: the sheet (ink box + BOARD_PAD), the planks back to front (b decreasing) and the 3 beams. A fresh copy on every call. */
export function buildRaft(): RaftPlan {
  if (!planMemo) {
    const ink = { a0: Math.min(...LAYOUT.map((g) => g.box.x0)), a1: Math.max(...LAYOUT.map((g) => g.box.x1)), b0: Math.min(...LAYOUT.map((g) => g.box.y0)), b1: Math.max(...LAYOUT.map((g) => g.box.y1)) };
    const sheet: Rect = { a0: ink.a0 - BOARD_PAD, a1: ink.a1 + BOARD_PAD, b0: ink.b0 - BOARD_PAD, b1: ink.b1 + BOARD_PAD };
    const n = Math.ceil((sheet.b1 - sheet.b0 + RAFT.joint) / PITCH), mid = (sheet.b0 + sheet.b1) / 2, lo = mid - (n * PITCH - RAFT.joint) / 2, hi = lo + n * PITCH - RAFT.joint;
    const rng = createRng(SEED), planks: RaftPlan["planks"] = [];
    for (let k = 0; k < n; k++) {
      const b0 = lo + (n - 1 - k) * PITCH, a0 = sheet.a0 + (2 * rng.next() - 1) * RAFT.ragged, a1 = sheet.a1 + (2 * rng.next() - 1) * RAFT.ragged;
      const b1 = b0 + RAFT.plankW, tone = rng.next() < 0.6 ? 0 : 1, grain: Rect[] = [];
      // Rng order per plank: a0 end, a1 end, tone, then per grain len, bLo, aLo. Reordering it re-records the baseline hash.
      for (let g = 0; g < 2; g++) {
        const len = (0.3 + 0.3 * rng.next()) * (a1 - a0), bLo = b0 + RAFT.grainEdge + rng.next() * (RAFT.plankW - 2 * RAFT.grainEdge - RAFT.grainW), aLo = a0 + rng.next() * (a1 - a0 - len);
        grain.push({ a0: aLo, a1: aLo + len, b0: bLo, b1: bLo + RAFT.grainW });
      }
      planks.push({ a0, a1, b0, b1, tone, grain });
    }
    const beams = [sheet.a0 + RAFT.beamInset, (sheet.a0 + sheet.a1) / 2, sheet.a1 - RAFT.beamInset].map((c): Rect => ({ a0: c - RAFT.beamW / 2, a1: c + RAFT.beamW / 2, b0: lo - RAFT.beamOverhang, b1: hi + RAFT.beamOverhang }));
    planMemo = { sheet, planks, beams };
  }
  return clonePlan(planMemo);
}

/** The rest plan's envelope in text space: the sheet's a-range plus the ragged ends, the block of planks plus the beam overhang. */
export function raftEnvelope(): Rect {
  const { sheet, planks } = buildRaft();
  return { a0: sheet.a0 - RAFT.ragged, a1: sheet.a1 + RAFT.ragged, b0: planks.at(-1)!.b0 - RAFT.beamOverhang, b1: planks[0]!.b1 + RAFT.beamOverhang };
}

const centreOf = (site: WritingSite): Vec3 => { const { x, y } = PLATFORM_SITES[site]; return v3(x, y, WATER_Z); };

/** The text plane at rest: `groundDiagonal` with the sheet's centre on the site at z BOARD_TOP. */
const restPlane = (site: WritingSite): TextPlane => {
  const { sheet } = buildRaft(), c = PLATFORM_SITES[site], { u, v } = groundDiagonal(v3(0, 0, 0)), ca = (sheet.a0 + sheet.a1) / 2, cb = (sheet.b0 + sheet.b1) / 2;
  return groundDiagonal(v3(c.x - u.x * ca - v.x * cb, c.y - u.y * ca - v.y * cb, BOARD_TOP));
};

/** The text plane of the raft's top faces, posed like the mesh. */
export function raftPlane(site: WritingSite, pose: RaftPose = REST_POSE): TextPlane {
  const p = restPlane(site), [origin] = rigid([p.origin], centreOf(site), pose.pitch, pose.roll, pose.dz) as [Vec3];
  const [u, v] = rigid([p.u, p.v], v3(0, 0, 0), pose.pitch, pose.roll, 0) as [Vec3, Vec3]; // the directions turn about the origin: no centre offset to round
  return { origin, u, v };
}

const area = (pts: readonly Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};

/** Tones of a prism: the top and bottom faces, and the side parts above and below the split z (the waterline). */
interface PrismTones { top: number; bottom: number; upper: number; lower: number; split: number }

/** The 10 faces of the prism r × [z0, z1] in the world, each wound so its normal points away from the prism's centre: top, bottom, then each side's upper part (split → z1) and its lower part (z0 → split). */
const prism = (plane: TextPlane, r: Rect, z0: number, z1: number, tones: PrismTones): MeshFace[] => {
  const at = (a: number, b: number, z: number): Vec3 => { const q = toWorld(plane, a, b); return v3(q.x, q.y, z); };
  const { split } = tones, faces: [Vec3[], number][] = [
    [[at(r.a0, r.b0, z1), at(r.a0, r.b1, z1), at(r.a1, r.b1, z1), at(r.a1, r.b0, z1)], tones.top],
    [[at(r.a0, r.b0, z0), at(r.a1, r.b0, z0), at(r.a1, r.b1, z0), at(r.a0, r.b1, z0)], tones.bottom],
  ];
  const sides = (za: number, zb: number, tone: number): [Vec3[], number][] => [
    [[at(r.a0, r.b0, za), at(r.a0, r.b0, zb), at(r.a1, r.b0, zb), at(r.a1, r.b0, za)], tone],
    [[at(r.a1, r.b0, za), at(r.a1, r.b0, zb), at(r.a1, r.b1, zb), at(r.a1, r.b1, za)], tone],
    [[at(r.a1, r.b1, za), at(r.a1, r.b1, zb), at(r.a0, r.b1, zb), at(r.a0, r.b1, za)], tone],
    [[at(r.a0, r.b1, za), at(r.a0, r.b1, zb), at(r.a0, r.b0, zb), at(r.a0, r.b0, za)], tone],
  ];
  const up = sides(split, z1, tones.upper), low = sides(z0, split, tones.lower);
  for (let k = 0; k < 4; k++) faces.push(up[k]!, low[k]!);
  const c = at((r.a0 + r.a1) / 2, (r.b0 + r.b1) / 2, (z0 + z1) / 2);
  return faces.map(([pts, toneOffset]) => {
    const n = polygonNormal(pts), m = pts.reduce((s, q) => v3(s.x + q.x / 4, s.y + q.y / 4, s.z + q.z / 4), v3(0, 0, 0));
    return { pts: n.x * (m.x - c.x) + n.y * (m.y - c.y) + n.z * (m.z - c.z) < 0 ? pts.reverse() : pts, toneOffset };
  });
};

let decalMemo: Vec2[][][] | undefined;
/** The glyph triangles of WRITING cut to each plank's rectangle (text space), in plank order; slivers below 1e-9 are dropped and each glyph's pieces are merged into convex polygons. Cached: it does not depend on the site. */
const decalsPerPlank = (): Vec2[][][] =>
  (decalMemo ??= buildRaft().planks.map((p) => {
    const out: Vec2[][] = [];
    for (const g of LAYOUT) out.push(...mergeConvex(g.quads.map((t) => clipPolygon(t, { x0: p.a0, x1: p.a1, y0: p.b0, y1: p.b1 }, lerp2)).filter((q) => q.length >= 3 && area(q) >= 1e-9)));
    return out;
  }));

const restFaces = new Map<WritingSite, MeshFace[]>();
/** The unposed faces of the raft at a site, built once. Private: `raftAt` never hands them out. */
const restFacesAt = (site: WritingSite): MeshFace[] => {
  let faces = restFaces.get(site);
  if (faces) return faces;
  const plan = buildRaft(), plane = restPlane(site), at = (a: number, b: number, z: number): Vec3 => { const q = toWorld(plane, a, b); return v3(q.x, q.y, z); };
  faces = [];
  for (const b of plan.beams) faces.push(...prism(plane, b, BEAM_Z, DECK_Z, { top: -2, bottom: -5, upper: -2, lower: -5, split: WATER_Z }));
  const s = plan.sheet;
  // The back sheet spans the plank block in b when it is longer than the sheet: the oracle's backing needs a visible face behind the margin row beyond the far plank edge, and the view ray crosses z −0.9 about 1 u further away.
  const sb0 = Math.min(s.b0, plan.planks.at(-1)!.b0), sb1 = Math.max(s.b1, plan.planks[0]!.b1);
  faces.push({ pts: [at(s.a0, sb0, DECK_Z), at(s.a0, sb1, DECK_Z), at(s.a1, sb1, DECK_Z), at(s.a1, sb0, DECK_Z)], toneOffset: -5 });
  const decals = decalsPerPlank();
  plan.planks.forEach((p, k) => {
    faces.push(...prism(plane, p, DECK_Z, BOARD_TOP, { top: p.tone, bottom: p.tone, upper: p.tone, lower: p.tone - 2, split: RAFT.wetZ }));
    const top = (r: Rect, toneOffset: number) => faces.push({ pts: [at(r.a0, r.b0, BOARD_TOP), at(r.a0, r.b1, BOARD_TOP), at(r.a1, r.b1, BOARD_TOP), at(r.a1, r.b0, BOARD_TOP)], toneOffset }); // wound like the top face
    for (const g of p.grain) top(g, p.tone - 1);
    const bc = (p.b0 + p.b1) / 2, h = RAFT.nail / 2;
    for (const b of plan.beams) for (const sg of [-1, 1]) {
      const ac = (b.a0 + b.a1) / 2 + sg * RAFT.nailDa, bn = bc + sg * RAFT.nailDb;
      top({ a0: ac - h, a1: ac + h, b0: bn - h, b1: bn + h }, p.tone - 2);
    }
    for (const piece of decals[k]!) {
      const pts = piece.map((q) => at(q.x, q.y, BOARD_TOP));
      faces.push({ pts: polygonNormal(pts).z < 0 ? pts.reverse() : pts, mat: "navy", toneOffset: p.tone });
    }
  });
  restFaces.set(site, faces);
  return faces;
};

/**
 * The raft at a site, posed, straight on the water (no foam or shadow ring around it): one timber mesh of 3 beams (10 faces each, split at the waterline: −2 above, −5 below), the sheet (−5) and, back to front, each plank's 10 prism faces (wet part 2 darker), its 2 grain faces (tone − 1), its 6 nails (tone − 2) and its navy decals (the plank's tone).
 * The unposed faces are built once per site; every call maps them through one `rigid` about (site, z −1) into fresh faces. A decal is wound to face +z at rest, like the top it lies on.
 */
export function raftAt(site: WritingSite, pose: RaftPose = REST_POSE): Solid & { kind: "mesh" } {
  const rest = restFacesAt(site), posed = rigid(rest.flatMap((f) => f.pts), centreOf(site), pose.pitch, pose.roll, pose.dz); // one rigid call: the rotations are built once
  let i = 0;
  return { kind: "mesh", mat: "timber", faces: rest.map((f) => ({ ...f, pts: posed.slice(i, (i += f.pts.length)) })) };
}
