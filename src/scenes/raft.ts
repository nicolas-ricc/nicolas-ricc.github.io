import { clipPolygon, lerp2 } from "../iso/clip";
import { polygonNormal, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { rigid } from "../iso/rigid";
import type { MeshFace, Solid } from "../iso/solids";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";
import { groundDiagonal, toWorld, type TextPlane } from "../kit/lettering";
import { marqueeLayout } from "../kit/marquee";
import { createRng, SEED } from "../map/seed";

/**
 * Cap height of WRITING in Chainsaw Carnage, set by the level-3 OCR at the phone scale 0.83: at 10.8 it read `WRITHG`; 11.3..11.8 read `WRITING` at both sites.
 * The raft raises it to 20 so the ink reads over the plank joints.
 */
export const WRITING_CAP = 20;
/** The raft floats: its top face sits at this z, the same height all over. */
export const BOARD_TOP = -0.4;
/** Raft beyond the ink of the word on every side, in text units. */
export const BOARD_PAD = 1.6;

/** The two places the Writing raft can float: `wide` (open sea between the two buoys) and `tall`. */
export type WritingSite = "wide" | "tall";
export const PLATFORM_SITES: Record<WritingSite, Vec3> = { wide: v3(570, 105, 0), tall: v3(440, 400, 0) };

/** The raft's pose over the water: a lift and a tilt, applied as one rigid motion about the site at z −1. */
export interface RaftPose { dz: number; pitch: number; roll: number }
export const REST_POSE: Readonly<RaftPose> = Object.freeze({ dz: 0, pitch: 0, roll: 0 });

/** The glyph layout of WRITING at `WRITING_CAP`, in text space. */
export const LAYOUT = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING);

/** The raft's constants, in text units: plank width and joint, plank and beam thickness, ragged ends, beam section, inset and overhang. */
export const RAFT = Object.freeze({ plankW: 2.4, joint: 0.15, plankH: 0.5, ragged: 0.3, beamW: 1.4, beamH: 0.5, beamInset: 1.5, beamOverhang: 1.2 });

export interface Rect { a0: number; a1: number; b0: number; b1: number }
export interface RaftPlan { sheet: Rect; planks: (Rect & { tone: number })[]; beams: Rect[] }

const WATER_Z = -1;
const DECK_Z = BOARD_TOP - RAFT.plankH; // the sheet and the top of the beams
const BEAM_Z = DECK_Z - RAFT.beamH;
const PITCH = RAFT.plankW + RAFT.joint;

let planMemo: RaftPlan | undefined;
const clonePlan = (p: RaftPlan): RaftPlan => ({ sheet: { ...p.sheet }, planks: p.planks.map((k) => ({ ...k })), beams: p.beams.map((b) => ({ ...b })) });

/** The raft in text space, deterministic: the sheet (ink box + BOARD_PAD), the planks back to front (b decreasing) and the 3 beams. A fresh copy on every call. */
export function buildRaft(): RaftPlan {
  if (!planMemo) {
    const ink = { a0: Math.min(...LAYOUT.map((g) => g.box.x0)), a1: Math.max(...LAYOUT.map((g) => g.box.x1)), b0: Math.min(...LAYOUT.map((g) => g.box.y0)), b1: Math.max(...LAYOUT.map((g) => g.box.y1)) };
    const sheet: Rect = { a0: ink.a0 - BOARD_PAD, a1: ink.a1 + BOARD_PAD, b0: ink.b0 - BOARD_PAD, b1: ink.b1 + BOARD_PAD };
    const n = Math.ceil((sheet.b1 - sheet.b0 + RAFT.joint) / PITCH), mid = (sheet.b0 + sheet.b1) / 2, lo = mid - (n * PITCH - RAFT.joint) / 2, hi = lo + n * PITCH - RAFT.joint;
    const rng = createRng(SEED), planks: RaftPlan["planks"] = [];
    for (let k = 0; k < n; k++) {
      const b0 = lo + (n - 1 - k) * PITCH, a0 = sheet.a0 + (2 * rng.next() - 1) * RAFT.ragged, a1 = sheet.a1 + (2 * rng.next() - 1) * RAFT.ragged;
      planks.push({ a0, a1, b0, b1: b0 + RAFT.plankW, tone: rng.next() < 0.6 ? 0 : 1 });
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

/** The 6 faces of the prism r × [z0, z1] in the world, each wound so its normal points away from the prism's centre. */
const prism = (plane: TextPlane, r: Rect, z0: number, z1: number, toneOffset: number): MeshFace[] => {
  const at = (a: number, b: number, z: number): Vec3 => { const q = toWorld(plane, a, b); return v3(q.x, q.y, z); };
  const quads: Vec3[][] = [
    [at(r.a0, r.b0, z1), at(r.a0, r.b1, z1), at(r.a1, r.b1, z1), at(r.a1, r.b0, z1)],
    [at(r.a0, r.b0, z0), at(r.a1, r.b0, z0), at(r.a1, r.b1, z0), at(r.a0, r.b1, z0)],
    [at(r.a0, r.b0, z0), at(r.a0, r.b0, z1), at(r.a1, r.b0, z1), at(r.a1, r.b0, z0)],
    [at(r.a1, r.b0, z0), at(r.a1, r.b0, z1), at(r.a1, r.b1, z1), at(r.a1, r.b1, z0)],
    [at(r.a1, r.b1, z0), at(r.a1, r.b1, z1), at(r.a0, r.b1, z1), at(r.a0, r.b1, z0)],
    [at(r.a0, r.b1, z0), at(r.a0, r.b1, z1), at(r.a0, r.b0, z1), at(r.a0, r.b0, z0)],
  ];
  const c = at((r.a0 + r.a1) / 2, (r.b0 + r.b1) / 2, (z0 + z1) / 2);
  return quads.map((pts) => {
    const n = polygonNormal(pts), m = pts.reduce((s, q) => v3(s.x + q.x / 4, s.y + q.y / 4, s.z + q.z / 4), v3(0, 0, 0));
    return { pts: n.x * (m.x - c.x) + n.y * (m.y - c.y) + n.z * (m.z - c.z) < 0 ? pts.reverse() : pts, toneOffset };
  });
};

let decalMemo: Vec2[][][] | undefined;
/** The glyph triangles of WRITING cut to each plank's rectangle (text space), in plank order; slivers below 1e-9 are dropped. Cached: it does not depend on the site. */
const decalsPerPlank = (): Vec2[][][] =>
  (decalMemo ??= buildRaft().planks.map((p) => {
    const out: Vec2[][] = [];
    for (const g of LAYOUT) for (const t of g.quads) {
      const piece = clipPolygon(t, { x0: p.a0, x1: p.a1, y0: p.b0, y1: p.b1 }, lerp2);
      if (piece.length >= 3 && area(piece) >= 1e-9) out.push(piece);
    }
    return out;
  }));

/**
 * The raft at a site, posed: one timber mesh of 3 beams (−2), the sheet (−5) and, back to front, each plank's 6 faces and its navy decals (the plank's tone).
 * Built at rest at the site, then every face goes through one `rigid` about (site, z −1). A decal is wound to face +z at rest, like the top it lies on.
 */
export function raftAt(site: WritingSite, pose: RaftPose = REST_POSE): Solid & { kind: "mesh" } {
  const plan = buildRaft(), plane = restPlane(site), faces: MeshFace[] = [], at = (a: number, b: number, z: number): Vec3 => { const q = toWorld(plane, a, b); return v3(q.x, q.y, z); };
  for (const b of plan.beams) faces.push(...prism(plane, b, BEAM_Z, DECK_Z, -2));
  const s = plan.sheet;
  // The back sheet spans the plank block in b when it is longer than the sheet: the oracle's backing needs a visible face behind the margin row beyond the far plank edge, and the view ray crosses z −0.9 about 1 u further away.
  const sb0 = Math.min(s.b0, plan.planks.at(-1)!.b0), sb1 = Math.max(s.b1, plan.planks[0]!.b1);
  faces.push({ pts: [at(s.a0, sb0, DECK_Z), at(s.a0, sb1, DECK_Z), at(s.a1, sb1, DECK_Z), at(s.a1, sb0, DECK_Z)], toneOffset: -5 });
  const decals = decalsPerPlank();
  plan.planks.forEach((p, k) => {
    faces.push(...prism(plane, p, DECK_Z, BOARD_TOP, p.tone));
    for (const piece of decals[k]!) {
      const pts = piece.map((q) => at(q.x, q.y, BOARD_TOP));
      faces.push({ pts: polygonNormal(pts).z < 0 ? pts.reverse() : pts, mat: "navy", toneOffset: p.tone });
    }
  });
  const c = centreOf(site);
  return { kind: "mesh", mat: "timber", faces: faces.map((f) => ({ ...f, pts: rigid(f.pts, c, pose.pitch, pose.roll, pose.dz) })) };
}
