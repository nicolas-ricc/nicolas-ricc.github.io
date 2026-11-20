import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { translate } from "../iso/translate";
import type { Solid } from "../iso/solids";
import { CHAINSAW_BAR, CHAINSAW_FACE, CHAINSAW_X } from "../kit/marquee";
import { SIGN_FONT, staticContrast } from "../kit/legibility";
import { groundDiagonal } from "../kit/lettering";
import { pointInPolygon } from "../map/geo";
import { raftAt } from "./raft";
import { waterCellMat } from "./terrain";
import * as platform from "./sign-platform";
import { dot, type Vec3 } from "../iso/geometry";
import { raftPlane } from "./raft";
import {
  ANGLE_STEP, BLOG_SIGNS, BOARD_TOP, CYCLE_POSES, HEAVE, HEAVE_STEP, PITCH, PLATFORM_DECK, PLATFORM_SITES, POSE_CYCLE_MS, REST_POSE, ROLL, WRITING_CAP,
  heaveAt, pitchAt, poseAt, rollAt, seaPlatform, seaPlatformAt, signAt, type RaftPose, type WritingSite,
} from "./sign-platform";

const at = (site: WritingSite, p: RaftPose = REST_POSE) => { const out: Solid[] = []; seaPlatformAt(out, site, p); return out; };
const meshOf = (out: readonly Solid[]): Solid & { kind: "mesh" } => { const b = out[0]!; if (b.kind !== "mesh") throw new Error("raft"); return b; };

describe("Writing raft sites (#442, #454)", () => {
  it("PLATFORM_SITES stay wide (570, 105, 0) and tall (440, 400, 0)", () => {
    expect(PLATFORM_SITES).toEqual({ wide: { x: 570, y: 105, z: 0 }, tall: { x: 440, y: 400, z: 0 } });
  });

  it("seaPlatform is the wide raft moved by −PLATFORM_SITES.wide, and it leaves the accents alone", () => {
    const out: Solid[] = [], accents: Accent[] = [], c = PLATFORM_SITES.wide;
    seaPlatform(out, accents);
    expect(out).toEqual([translate(raftAt("wide"), -c.x, -c.y)]);
    expect(accents).toEqual([]);
  });

  it("PAINT_LIFT is gone", () => {
    expect("PAINT_LIFT" in platform).toBe(false);
  });
});

describe.each(["wide", "tall"] as const)("Writing raft at the %s site: planks floating on the water, WRITING as a navy decal (#454)", (site) => {
  const SITE = PLATFORM_SITES[site], SIGN = BLOG_SIGNS[site];

  it("seaPlatformAt pushes exactly one solid: the timber mesh raftAt(site, REST_POSE)", () => {
    const out = at(site);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "mesh", mat: "timber" });
    expect(out).toEqual([raftAt(site, REST_POSE)]);
    const def: Solid[] = [];
    seaPlatformAt(def, site);
    expect(def).toEqual(out);
  });

  it("BLOG_SIGNS[site] is a ground sign: navy decal, bar, cap 20, Chainsaw Carnage measures, no colour, backed by the raft", () => {
    expect(SIGN).toMatchObject({ id: "plataforma", text: "WRITING", size: WRITING_CAP, width: SIGN_FONT.width, decal: "navy", ground: true, xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP, bar: CHAINSAW_BAR * WRITING_CAP });
    expect(WRITING_CAP).toBe(20);
    expect(SIGN.color).toBeUndefined();
    expect(SIGN.glyphs.map((g) => g.char).join("")).toBe("WRITING");
    expect(SIGN.backing).toEqual(at(site));
  });

  it("seaPlatformAt pushes a fresh mesh: mutating it leaves BLOG_SIGNS intact", () => {
    const before = JSON.stringify(SIGN.backing), m = meshOf(at(site));
    expect(m).not.toBe(SIGN.backing[0]);
    m.faces[0]!.pts[0]!.x += 100;
    m.faces.length = 0;
    expect(JSON.stringify(SIGN.backing)).toBe(before);
  });

  it("the letters' plane is groundDiagonal: u = (√½, −√½, 0), v = (−√½, −√½, 0) exactly", () => {
    const g = groundDiagonal({ x: 0, y: 0, z: 0 });
    for (const glyph of SIGN.glyphs) {
      expect(glyph.plane.u).toEqual(g.u);
      expect(glyph.plane.v).toEqual(g.v);
      expect(glyph.plane.origin.z).toBeCloseTo(BOARD_TOP, 12);
    }
  });

  it("static contrast of the navy decal on its plank is ≥ 7 : 1", () => {
    expect(staticContrast(SIGN)).toBeGreaterThanOrEqual(7);
  });

  it("every mesh vertex is at z ≤ BOARD_TOP", () => {
    for (const f of meshOf(at(site)).faces) for (const p of f.pts) expect(p.z).toBeLessThanOrEqual(BOARD_TOP + 1e-9);
  });

  it("PLATFORM_DECK, moved to the site, holds every vertex of the raft in plan", () => {
    const deck = PLATFORM_DECK.flatMap((q) => [q.x + SITE.x, q.y + SITE.y]);
    expect(PLATFORM_DECK).toHaveLength(4);
    // The foam and shadow rings are water decals past the raft's envelope: the deck holds the timber and the navy ink.
    for (const f of meshOf(at(site)).faces.filter((g) => !g.mat || g.mat === "navy")) for (const p of f.pts) {
      const c = { x: p.x + (SITE.x - p.x) * 1e-9, y: p.y + (SITE.y - p.y) * 1e-9 }; // nudged inward: vertices on the envelope's edge count
      expect(pointInPolygon(c.x, c.y, deck), `${p.x},${p.y}`).toBe(true);
    }
  });

  it("every 1-u cell under PLATFORM_DECK moved to the site is water (> 1500 cells)", () => {
    const deck = PLATFORM_DECK.map((q) => ({ x: q.x + SITE.x, y: q.y + SITE.y })), xs = deck.map((q) => q.x), ys = deck.map((q) => q.y), plan = deck.flatMap((q) => [q.x, q.y]);
    let n = 0;
    for (let x = Math.floor(Math.min(...xs)) + 0.5; x <= Math.max(...xs); x++) for (let y = Math.floor(Math.min(...ys)) + 0.5; y <= Math.max(...ys); y++) {
      if (!pointInPolygon(x, y, plan)) continue;
      n++;
      expect(waterCellMat(x, y), `${x},${y}`).not.toBeNull();
    }
    expect(n).toBeGreaterThan(1500);
  });

  it("deterministic: two builds are equal", () => {
    expect(at(site)).toEqual(at(site));
  });
});

describe("heaveAt: the board's heave, a quantized slow sine (#444)", () => {
  const steps = (dz: number) => dz / HEAVE_STEP;
  it("HEAVE is ±0.15 u over 6.7 s, quantized to 0.01 u", () => {
    expect(HEAVE).toEqual({ amp: 0.15, periodMs: 6700 });
    expect(HEAVE_STEP).toBe(0.01);
  });

  it("periodic, bounded by amp and always a multiple of HEAVE_STEP", () => {
    for (let t = 0; t <= 2 * HEAVE.periodMs; t += 37) {
      expect(Math.abs(heaveAt(t) - heaveAt(t + HEAVE.periodMs)), `${t}`).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(heaveAt(t)), `${t}`).toBeLessThanOrEqual(HEAVE.amp + 1e-12);
      expect(Math.abs(steps(heaveAt(t)) - Math.round(steps(heaveAt(t)))), `${t}`).toBeLessThanOrEqual(1e-9);
    }
  });

  it("starts at rest: heaveAt(0) === 0", () => {
    expect(heaveAt(0)).toBe(0);
  });

  it("takes at least 20 distinct values over a period sampled every 50 ms", () => {
    const seen = new Set<number>();
    for (let t = 0; t < HEAVE.periodMs; t += 50) seen.add(Math.round(steps(heaveAt(t))));
    expect(seen.size).toBeGreaterThanOrEqual(20);
  });

  it("a clock hours long keeps the cycle: heaveAt(1e9 · period + 1234) is heaveAt(1234)", () => {
    expect(Math.abs(heaveAt(1e9 * HEAVE.periodMs + 1234) - heaveAt(1234))).toBeLessThanOrEqual(1e-9);
  });
});

describe("poseAt: heave, pitch and roll, three quantized sines (#456)", () => {
  const fields = (p: RaftPose) => [p.dz, p.pitch, p.roll];

  it("PITCH, ROLL, ANGLE_STEP and POSE_CYCLE_MS are pinned", () => {
    expect(PITCH).toEqual({ amp: (1.5 * Math.PI) / 180, periodMs: 9100 });
    expect(ROLL).toEqual({ amp: (1.0 * Math.PI) / 180, periodMs: 7300 });
    expect(Object.isFrozen(PITCH)).toBe(true);
    expect(Object.isFrozen(ROLL)).toBe(true);
    expect(ANGLE_STEP).toBe((0.1 * Math.PI) / 180);
    expect(POSE_CYCLE_MS).toBe(44_508_100);
    expect(HEAVE).toEqual({ amp: 0.15, periodMs: 6700 });
  });

  it("poseAt(0) is REST_POSE", () => {
    expect(poseAt(0)).toEqual(REST_POSE);
  });

  it("poseAt is { dz: heaveAt, pitch: pitchAt, roll: rollAt }", () => {
    for (let t = 0; t < 20_000; t += 113) expect(poseAt(t)).toEqual({ dz: heaveAt(t), pitch: pitchAt(t), roll: rollAt(t) });
  });

  it("periodic in POSE_CYCLE_MS: 20 instants, the three fields within 1e-9", () => {
    for (let k = 0; k < 20; k++) {
      const t = k * 2_345_671, a = fields(poseAt(t)), b = fields(poseAt(t + POSE_CYCLE_MS));
      a.forEach((v, i) => expect(Math.abs(v - b[i]!), `${t} ${i}`).toBeLessThanOrEqual(1e-9));
    }
  });

  it("pitch and roll are bounded by their amp and multiples of ANGLE_STEP", () => {
    for (let t = 0; t <= 20_000; t += 37) {
      const { pitch, roll } = poseAt(t);
      expect(Math.abs(pitch), `${t}`).toBeLessThanOrEqual(PITCH.amp + 1e-12);
      expect(Math.abs(roll), `${t}`).toBeLessThanOrEqual(ROLL.amp + 1e-12);
      for (const x of [pitch, roll]) expect(Math.abs(x / ANGLE_STEP - Math.round(x / ANGLE_STEP)), `${t}`).toBeLessThanOrEqual(1e-12);
    }
  });

  it("pitch and roll each take at least 20 distinct values over their period sampled every 50 ms", () => {
    const distinct = (f: (t: number) => number, period: number) => { const s = new Set<number>(); for (let t = 0; t < period; t += 50) s.add(Math.round(f(t) / ANGLE_STEP)); return s.size; };
    expect(distinct(pitchAt, PITCH.periodMs)).toBeGreaterThanOrEqual(20);
    expect(distinct(rollAt, ROLL.periodMs)).toBeGreaterThanOrEqual(20);
  });

  it("the three fields do not share a phase: some t has dz 0 and pitch ≠ 0, some t has pitch 0 and roll ≠ 0", () => {
    let a = false, b = false;
    for (let t = 0; t <= 10_000; t += 50) {
      const p = poseAt(t);
      if (p.dz === 0 && p.pitch !== 0) a = true;
      if (p.pitch === 0 && p.roll !== 0) b = true;
    }
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it("a clock hours long keeps the cycle: pitchAt and rollAt at 1e6 periods + 1234 ms", () => {
    expect(Math.abs(pitchAt(1e6 * PITCH.periodMs + 1234) - pitchAt(1234))).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(rollAt(1e6 * ROLL.periodMs + 1234) - rollAt(1234))).toBeLessThanOrEqual(1e-12);
  });

  it("CYCLE_POSES: rest, the 8 corners of the cube, then poseAt(k · 7919) for k 1..8", () => {
    expect(CYCLE_POSES).toHaveLength(17);
    expect(Object.isFrozen(CYCLE_POSES)).toBe(true);
    for (const p of CYCLE_POSES) expect(Object.isFrozen(p)).toBe(true);
    expect(CYCLE_POSES[0]).toEqual(REST_POSE);
    const corners = new Set(CYCLE_POSES.slice(1, 9).map((p) => JSON.stringify(fields(p))));
    const want = new Set<string>();
    for (const dz of [-1, 1]) for (const pitch of [-1, 1]) for (const roll of [-1, 1]) want.add(JSON.stringify([dz * HEAVE.amp, pitch * PITCH.amp, roll * ROLL.amp]));
    expect(corners).toEqual(want);
    expect(CYCLE_POSES.slice(9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((k) => poseAt(k * 7919)));
  });
});

describe.each(["wide", "tall"] as const)("Writing raft at the %s site over CYCLE_POSES: one rigid body (#444, #456)", (site) => {
  const rest = meshOf(at(site));
  const flat = (m: Solid & { kind: "mesh" }) => m.faces.flatMap((f) => f.pts);
  const restPts = flat(rest), n = restPts.length;
  const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const unit = (v: Vec3) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };

  it("signAt(site, REST_POSE) is BLOG_SIGNS[site]", () => {
    expect(signAt(site, REST_POSE)).toEqual(BLOG_SIGNS[site]);
    expect(signAt(site)).toEqual(BLOG_SIGNS[site]);
  });

  it.each(CYCLE_POSES.map((p, i) => [i, p] as const))("pose %i/17: raftAt keeps the distances between its vertices (50 pairs, ±1e-9)", (_i, p) => {
    const m = raftAt(site, p), pts = flat(m);
    expect(m.faces).toHaveLength(rest.faces.length);
    expect(pts).toHaveLength(n);
    for (let k = 1; k <= 50; k++) {
      const i = (k * 7919) % n, j = (k * 104729 + 1) % n;
      expect(Math.abs(dist(pts[i]!, pts[j]!) - dist(restPts[i]!, restPts[j]!)), `${i},${j}`).toBeLessThanOrEqual(1e-9);
    }
  });

  it.each(CYCLE_POSES.map((p, i) => [i, p] as const))("pose %i/17: every decal vertex lies on the posed text plane, whose u′ and v′ are unit and perpendicular", (_i, p) => {
    const plane = raftPlane(site, p), normal = unit(cross(plane.u, plane.v));
    expect(Math.abs(Math.hypot(plane.u.x, plane.u.y, plane.u.z) - 1)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(Math.hypot(plane.v.x, plane.v.y, plane.v.z) - 1)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(dot(plane.u, plane.v))).toBeLessThanOrEqual(1e-12);
    let decals = 0;
    for (const f of raftAt(site, p).faces) if (f.mat === "navy") for (const q of f.pts) {
      decals++;
      expect(Math.abs(dot({ x: q.x - plane.origin.x, y: q.y - plane.origin.y, z: q.z - plane.origin.z }, normal))).toBeLessThanOrEqual(1e-9);
    }
    expect(decals).toBeGreaterThan(0);
  });

  it.each(CYCLE_POSES.map((p, i) => [i, p] as const))("pose %i/17: signAt(site, pose) is backed by raftAt(site, pose)", (_i, p) => {
    expect(signAt(site, p).backing).toEqual([raftAt(site, p)]);
    expect(at(site, p)).toEqual([raftAt(site, p)]);
  });
});
