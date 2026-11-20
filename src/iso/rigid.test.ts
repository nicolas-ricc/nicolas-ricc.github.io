import { describe, expect, it } from "vitest";
import { dot, v3, type Vec3 } from "./geometry";
import { RAFT_N, RAFT_U, rigid, rotateAbout } from "./rigid";

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => v3(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const C = v3(5, -3, -1);

describe("rigid", () => {
  it("RAFT_U and RAFT_N are unit and perpendicular", () => {
    expect(Math.hypot(RAFT_U.x, RAFT_U.y, RAFT_U.z)).toBeCloseTo(1, 12);
    expect(Math.hypot(RAFT_N.x, RAFT_N.y, RAFT_N.z)).toBeCloseTo(1, 12);
    expect(dot(RAFT_U, RAFT_N)).toBeCloseTo(0, 12);
    expect(RAFT_U).toEqual(v3(Math.SQRT1_2, -Math.SQRT1_2, 0));
    expect(RAFT_N).toEqual(v3(Math.SQRT1_2, Math.SQRT1_2, 0));
  });

  it("rotateAbout(z, π/2) maps (1, 0, 0) to (0, 1, 0)", () => {
    const p = rotateAbout(v3(0, 0, 1), Math.PI / 2)(v3(1, 0, 0));
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(1, 12);
    expect(p.z).toBeCloseTo(0, 12);
  });

  it("zero angles and dz return equal copies", () => {
    const pts = [v3(1, 2, 3), v3(-4, 0.5, -1)];
    const out = rigid(pts, C, 0, 0, 0);
    expect(out).toEqual(pts);
    out.forEach((p, i) => expect(p).not.toBe(pts[i]));
  });

  it("preserves distances between points and to the centre", () => {
    const pts = [v3(1, 2, 3), v3(-4, 0.5, -1), v3(12, -7, 0), v3(5, -3, 2), v3(0, 0, 0)];
    const out = rigid(pts, C, 0.03, 0.02, 0);
    for (let i = 0; i < pts.length; i++) {
      expect(dist(out[i]!, C)).toBeCloseTo(dist(pts[i]!, C), 9);
      for (let j = i + 1; j < pts.length; j++) expect(dist(out[i]!, out[j]!)).toBeCloseTo(dist(pts[i]!, pts[j]!), 9);
    }
  });

  it("pitch raises the +u end and moves nothing along n", () => {
    const p = add(C, RAFT_U, 10), q = add(C, RAFT_U, -10);
    const [p1, q1] = rigid([p, q], C, 0.03, 0, 0);
    expect(p1!.z - p.z).toBeCloseTo(10 * Math.sin(0.03), 9);
    expect(q1!.z - q.z).toBeCloseTo(-10 * Math.sin(0.03), 9);
    expect(dot(sub(p1!, C), RAFT_N)).toBeCloseTo(0, 9);
    expect(dot(sub(q1!, C), RAFT_N)).toBeCloseTo(0, 9);
  });

  it("roll raises the +n end and moves nothing along u", () => {
    const p = add(C, RAFT_N, 10);
    const [p1] = rigid([p], C, 0, 0.02, 0);
    expect(p1!.z - p.z).toBeCloseTo(10 * Math.sin(0.02), 9);
    expect(dot(sub(p1!, C), RAFT_U)).toBeCloseTo(0, 9);
  });

  it("dz adds to z", () => {
    const pts = [v3(1, 2, 3), v3(-4, 0.5, -1)];
    rigid(pts, C, 0, 0, 0.1).forEach((p, i) => {
      expect(p.x).toBeCloseTo(pts[i]!.x, 12);
      expect(p.y).toBeCloseTo(pts[i]!.y, 12);
      expect(p.z).toBeCloseTo(pts[i]!.z + 0.1, 12);
    });
  });
});
