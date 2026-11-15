import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { sortByDepth } from "../iso/depth";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { PlateBox, PlatePoly } from "../iso/plate";
import { project } from "../iso/project";
import { bounds, tessellate, tessellateAll, type Bounds, type Solid } from "../iso/solids";
import { diagonalWall, fillText, measureText, strokeText, xHeightPx } from "../kit/lettering";
import { graffitiWall, INNER } from "./sign-graffiti";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; graffitiWall(out, accents); return { out, accents }; };

const H = Math.SQRT1_2, L = measureText("Portfolio", 8.55).width + 5, K = 8.55 / 7;
const d = v3(H, -H, 0), n = v3(H, H, 0);
const along = (p: { x: number; y: number }) => p.x * d.x + p.y * d.y; // s, along the wall
const front = (p: { x: number; y: number }) => p.x * n.x + p.y * n.y; // n·p, toward the camera
/** Point on the front face (edge 0) at `a` from the left end and height `z`. */
const face = (a: number, z: number): Vec3 => v3(-d.x * L / 2 + n.x * 0.6 + d.x * a, -d.y * L / 2 + n.y * 0.6 + d.y * a, z);

type Poly = Solid & { kind: "poly" };
const wallOf = (out: Solid[]) => out.find((s): s is Poly => s.kind === "poly" && s.mat === "concrete")!;
const capOf = (out: Solid[]) => out.find((s): s is Poly => s.kind === "poly" && s.mat === "stone")!;
const platesOf = (out: Solid[]) => wallOf(out).plates ?? [];
const polys = (out: Solid[], mat: string) => platesOf(out).filter((p): p is PlatePoly => p.shape === "poly" && p.mat === mat);
const boxes = (out: Solid[], shape: string, mat: string) => platesOf(out).filter((p): p is PlateBox => p.shape === shape && p.mat === mat);
const toPlate = (q: Vec2[], dx = 0, dy = 0) => q.map((c) => ({ x: (2.5 + c.x + dx) / L, y: 1.5 + c.y + dy }));
const cross = (a: Vec2, b: Vec2, c: Vec2, e: Vec2) => (b.x - a.x) * (e.y - c.y) - (b.y - a.y) * (e.x - c.x);
const plateWorld = (p: PlatePoly) => p.pts.map((q) => face(q.x * L, q.y));
const meanX = (pts: Vec3[]) => pts.reduce((s, p) => s + project(p).x, 0) / pts.length;

describe("graffiti wall (#362): wall, cap and throw-up paint", () => {
  it("a concrete poly z 0 h 11.5, 4 points, long sides L parallel to (1, −1), edge 0 the front face", () => {
    const w = wallOf(build().out);
    expect(w).toMatchObject({ z: 0, h: 11.5 });
    const [D, C, B, A] = w.footprint;
    expect(w.footprint).toHaveLength(4);
    expect(Math.hypot(C!.x - D!.x, C!.y - D!.y)).toBeCloseTo(L, 9);
    expect(Math.hypot(B!.x - A!.x, B!.y - A!.y)).toBeCloseTo(L, 9);
    expect(Math.abs(cross(D!, C!, { x: 0, y: 0 }, { x: 1, y: -1 }))).toBeLessThan(1e-9);
    expect(Math.abs(cross(A!, B!, { x: 0, y: 0 }, { x: 1, y: -1 }))).toBeLessThan(1e-9);
    expect(front(D!)).toBeCloseTo(0.6, 9);
    expect(front(C!)).toBeCloseTo(0.6, 9);
    expect(along(C!) - along(D!)).toBeCloseTo(L, 9); // u grows toward +d
  });

  it("a stone cap at z 11.5, h 0.3, 0.3 longer and 0.3 thicker", () => {
    const c = capOf(build().out);
    expect(c).toMatchObject({ z: 11.5, h: 0.3 });
    const [D, C, B] = c.footprint;
    expect(c.footprint).toHaveLength(4);
    expect(Math.hypot(C!.x - D!.x, C!.y - D!.y)).toBeCloseTo(L + 0.3, 9);
    expect(Math.hypot(B!.x - C!.x, B!.y - C!.y)).toBeCloseTo(1.5, 9);
  });

  it("every plate is on wall 0 and tessellates onto a face of normal (1, 1, 0)/√2", () => {
    const w = wallOf(build().out), plates = w.plates ?? [];
    expect(plates.length).toBeGreaterThan(0);
    for (const p of plates) expect(p.wall).toBe(0);
    const faces = tessellate(w), bare = tessellate({ ...w, plates: undefined });
    const extra = faces.slice(bare.length);
    expect(extra).toHaveLength(plates.length);
    for (const f of extra) expect(Math.abs(f.normal.x * n.x + f.normal.y * n.y + f.normal.z * 0 - 1)).toBeLessThan(1e-6);
  });

  it("shadow (hull), outline (officeDark) and fill (safety) from fillText, 2.5 in and baseline 1.5", () => {
    const { out } = build();
    const fill = fillText("Portfolio", 8.55, 1.6), outline = fillText("Portfolio", 8.55, 2.1);
    const sets: [PlatePoly[], Vec2[][], number, number][] = [[polys(out, "hull"), fill, 0.6, -0.6], [polys(out, "officeDark"), outline, 0, 0], [polys(out, "safety"), fill, 0, 0]];
    for (const [plates, quads, dx, dy] of sets) {
      expect(plates).toHaveLength(quads.length);
      plates.forEach((p, k) => toPlate(quads[k]!, dx, dy).forEach((q, i) => { expect(p.pts[i]!.x).toBeCloseTo(q.x, 12); expect(p.pts[i]!.y).toBeCloseTo(q.y, 12); }));
    }
  });

  it("the P's first fill quad projects left of the final o's last one", () => {
    const fill = polys(build().out, "safety");
    expect(meanX(plateWorld(fill[0]!))).toBeLessThan(meanX(plateWorld(fill[fill.length - 1]!)));
  });

  it("the amber core: strokeText 1.0 on diagonalWall, 0.06 in front of the face, neon alpha 0.75", () => {
    const amber = build().accents.filter((a) => a.color === "amber");
    const quads = strokeText("Portfolio", diagonalWall(v3(0, 0, 1.5)), 8.55, 1.0);
    expect(amber).toHaveLength(quads.length);
    for (const a of amber) {
      expect(a.kind).toBe("poly");
      if (a.kind !== "poly") continue;
      expect(a.alpha).toBe(0.75);
      for (const p of a.pts) {
        expect(Math.abs(front(p) - 0.66)).toBeLessThan(1e-6);
        expect(along(p) + L / 2).toBeGreaterThanOrEqual(0); expect(along(p) - L / 2).toBeLessThanOrEqual(0);
        expect(p.z).toBeGreaterThanOrEqual(0); expect(p.z).toBeLessThanOrEqual(11.5);
      }
    }
    // the tube's first quad (P stem) starts at the margin: 2.5 from the left end, centered on the stem
    const first = amber[0]!;
    if (first.kind === "poly") expect(Math.min(...first.pts.map((p) => along(p) + L / 2))).toBeCloseTo(2.5 - 0.5, 9);
  });

  it("the amber core keeps its bloom: one amberBleed halo (alpha 0.6 · 0.75) per tube", () => {
    const halos = build().accents.filter((a) => a.color === "amberBleed" && a.kind === "poly" && a.alpha !== 0.12);
    expect(halos).toHaveLength(strokeText("Portfolio", diagonalWall(v3(0, 0, 1.5)), 8.55, 1.0).length);
    for (const a of halos) expect(a.kind === "poly" && a.alpha).toBeCloseTo(0.45, 9);
  });

  it("legibility: x-height ≥ 10 px and interior stroke ≥ 1.5 px at 1.17", () => {
    expect(xHeightPx(8.55, 1.17)).toBeGreaterThanOrEqual(10);
    expect(INNER).toBe(1.0);
    expect(INNER * 1.17 * 1.4).toBeGreaterThanOrEqual(1.5);
    expect(INNER * 1.17 * Math.SQRT2).toBeGreaterThanOrEqual(1.5);
  });

  it("deterministic", () => {
    expect(build()).toEqual(build());
  });
});

describe("graffiti wall (#362): wear, drips and signature", () => {
  it("4 horizontal joints, concrete toneOffset −1, 0.08 high, across the whole face", () => {
    const j = boxes(build().out, "rect", "concrete");
    expect(j).toHaveLength(4);
    j.forEach((p, i) => {
      expect(p).toMatchObject({ u0: 0, u1: 1, toneOffset: -1 });
      expect(p.z1 - p.z0).toBeCloseTo(0.08, 9);
      expect((p.z0 + p.z1) / 2).toBeCloseTo([2.9, 5.8, 8.7, 10.9][i]!, 9);
    });
  });

  it("4 stains: concrete discs toneOffset −1, 1.5–3 u", () => {
    const s = boxes(build().out, "disc", "concrete");
    expect(s).toHaveLength(4);
    for (const p of s) {
      expect(p.toneOffset).toBe(-1);
      for (const size of [(p.u1 - p.u0) * L, p.z1 - p.z0]) { expect(size).toBeGreaterThanOrEqual(1.5 - 1e-9); expect(size).toBeLessThanOrEqual(3 + 1e-9); }
    }
  });

  it("5 safety drips 0.25 wide hanging from the baseline under P, t, f, l and the final o", () => {
    const drips = boxes(build().out, "rect", "safety");
    expect(drips).toHaveLength(5);
    drips.forEach((p, i) => {
      expect((p.u1 - p.u0) * L).toBeCloseTo(0.25, 9);
      expect((p.u0 + p.u1) / 2 * L).toBeCloseTo(2.5 + [0, 13, 17, 24, 29.5][i]! * K, 9);
      expect(p.z1).toBeCloseTo(1.5, 9);
      expect(p.z1 - p.z0).toBeGreaterThanOrEqual(1); expect(p.z1 - p.z0).toBeLessThanOrEqual(2);
      expect(p.z0).toBeGreaterThanOrEqual(0);
    });
  });

  it("the signature: fillText(\"rust\", 2.2, 0.5) in signal, baseline 0.6, ends 1 u before the right end", () => {
    const sig = polys(build().out, "signal");
    expect(sig).toHaveLength(fillText("rust", 2.2, 0.5).length);
    const xs = sig.flatMap((p) => p.pts.map((q) => q.x * L)), ys = sig.flatMap((p) => p.pts.map((q) => q.y));
    expect(Math.max(...xs)).toBeCloseTo(L - 1, 9);
    expect(Math.min(...ys)).toBeCloseTo(0.6 - 0.25, 9);
  });

  it("plate order: wear, shadow, outline, fill, drips, signature", () => {
    const plates = platesOf(build().out);
    const idx = (f: (p: (typeof plates)[number]) => boolean) => plates.flatMap((p, i) => (f(p) ? [i] : []));
    const groups = [
      idx((p) => p.mat === "concrete"),
      idx((p) => p.mat === "hull"),
      idx((p) => p.mat === "officeDark"),
      idx((p) => p.mat === "safety" && p.shape === "poly"),
      idx((p) => p.mat === "safety" && p.shape === "rect"),
      idx((p) => p.mat === "signal"),
    ];
    for (const g of groups) expect(g.length).toBeGreaterThan(0);
    for (let k = 1; k < groups.length; k++) expect(Math.max(...groups[k - 1]!)).toBeLessThan(Math.min(...groups[k]!));
    expect(groups.reduce((s, g) => s + g.length, 0)).toBe(plates.length);
  });

  it("all paint stays on the face: u 0..1, z 0..11.5", () => {
    for (const p of platesOf(build().out)) {
      const pts = p.shape === "poly" ? p.pts : [{ x: p.u0, y: p.z0 }, { x: p.u1, y: p.z1 }];
      for (const q of pts) {
        expect(q.x).toBeGreaterThanOrEqual(-1e-12); expect(q.x).toBeLessThanOrEqual(1 + 1e-12);
        expect(q.y).toBeGreaterThanOrEqual(-1e-12); expect(q.y).toBeLessThanOrEqual(11.5 + 1e-12);
      }
    }
  });
});

/** Box of the solid's vertices in the wall frame: x along d, y along n. */
function frameBounds(s: Solid): Bounds {
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  for (const f of tessellateAll({ ...s, plates: undefined } as Solid)) for (const p of f.pts) {
    const q = v3(along(p), front(p), p.z);
    for (const k of ["x", "y", "z"] as const) { min[k] = Math.min(min[k], q[k]); max[k] = Math.max(max[k], q[k]); }
  }
  return { min, max };
}
const disjoint = (a: Bounds, b: Bounds) => (["x", "y", "z"] as const).some((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) <= 1e-6);
const corners = (b: Bounds) => [b.min.x, b.max.x].flatMap((x) => [b.min.y, b.max.y].flatMap((y) => [b.min.z, b.max.z].map((z) => v3(x, y, z))));
/** Screen y' of the word's baseline (z 1.5 on the face) at screen x'. */
const baselineY = (x: number) => project(face(x / Math.SQRT2 + L / 2, 1.5)).y;
/** Point-in-convex-polygon on screen, with a tolerance. */
function insideConvex(pt: Vec2, poly: Vec2[], eps: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y), c = ((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)) / len;
    if (Math.abs(c) <= eps) continue;
    if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

describe("graffiti wall (#362): floodlights, beams, drums and container", () => {
  const props = (out: Solid[]) => out.filter((s) => s !== wallOf(out) && s !== capOf(out));
  const drums = (out: Solid[]) => out.filter((s) => s.kind === "cylinder" && s.mat === "rust");
  const containerOf = (out: Solid[]) => out.filter((s) => s.kind === "prism" && s.mat === "rust");
  const posts = (out: Solid[]) => out.filter((s) => s.kind === "prism" && s.mat === "steel");

  it("3 floodlight dots at z 5, 4 u in front of the face, at u 0.2, 0.5 and 0.8", () => {
    const dots = build().accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");
    expect(dots).toHaveLength(3);
    dots.forEach((a, i) => {
      expect(a.at.z).toBeCloseTo(5, 9);
      expect(front(a.at)).toBeCloseTo(4.6, 9);
      expect(along(a.at)).toBeCloseTo(([0.2, 0.5, 0.8][i]! - 0.5) * L, 9);
    });
    expect(posts(build().out)).toHaveLength(3);
  });

  it("3 amberBleed beams alpha 0.12: two points by the bulb, two on the face at z 9, 8 u apart", () => {
    const { accents } = build();
    const dots = accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");
    const beams = accents.filter((a): a is Accent & { kind: "poly" } => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.12);
    expect(beams).toHaveLength(3);
    beams.forEach((b, i) => {
      const bulb = dots[i]!.at;
      expect(b.pts).toHaveLength(4);
      const near = b.pts.filter((p) => Math.hypot(p.x - bulb.x, p.y - bulb.y, p.z - bulb.z) <= 0.3 + 1e-9);
      const onFace = b.pts.filter((p) => Math.abs(front(p) - 0.6) < 1e-9 && Math.abs(p.z - 9) < 1e-9);
      expect(near).toHaveLength(2);
      expect(onFace).toHaveLength(2);
      expect(Math.abs(along(onFace[0]!) - along(onFace[1]!))).toBeCloseTo(8, 9);
      expect(insideConvex(project(bulb), b.pts.map(project), 0.3)).toBe(true);
    });
  });

  it("3 rust drums r 1.1 h 1.6, 6 sides, and a 6 × 2.4 × 2.4 container: low and in front of the face", () => {
    const { out } = build();
    const ds = drums(out), cs = containerOf(out);
    expect(ds).toHaveLength(3);
    for (const s of ds) expect(s).toMatchObject({ r: 1.1, h: 1.6, sides: 6, at: { z: 0 } });
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ w: 6, d: 2.4, h: 2.4 });
    for (const s of [...ds, ...cs]) {
      const b = bounds(s);
      expect(b.max.z).toBeLessThanOrEqual(2.5);
      expect(Math.min(...corners(b).map(front))).toBeGreaterThan(0.6);
    }
    for (const s of ds) if (s.kind === "cylinder") expect(along(s.at)).toBeLessThan(-L / 2 + 6); // left end
    const c = cs[0]!;
    if (c.kind === "prism") expect(along(c.at)).toBeGreaterThan(L / 2 - 6); // right end
  });

  it("drums and container stay below the baseline on screen; the container clears the signature", () => {
    const { out } = build();
    for (const s of [...drums(out), ...containerOf(out)]) {
      const top = bounds(s).max.z;
      for (const p of tessellateAll(s).flatMap((f) => f.pts).filter((q) => Math.abs(q.z - top) < 1e-9)) {
        const sp = project(p);
        if (Math.abs(sp.x) <= L / Math.SQRT2) expect(sp.y).toBeGreaterThan(baselineY(sp.x));
      }
    }
    const c = containerOf(out)[0]!, xs = corners(bounds(c)).map((p) => project(p).x);
    expect(Math.min(...xs)).toBeGreaterThan(Math.SQRT2 * (L / 2 - 1));
  });

  it("no two solids interpenetrate (disjoint boxes in world or wall frame), except the cap on the wall", () => {
    const { out } = build();
    const wall = wallOf(out), cap = capOf(out);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      if ((a === wall && b === cap) || (a === cap && b === wall)) continue;
      const ok = disjoint(bounds(a), bounds(b)) || disjoint(frameBounds(a), frameBounds(b));
      expect(ok, `${i} ${a.kind} × ${j} ${b.kind}`).toBe(true);
    }
  });

  it("painter order: the wall is drawn before every prop in front of it", () => {
    const { out } = build();
    const sorted = sortByDepth(out), at = sorted.indexOf(wallOf(out));
    for (const s of props(out)) expect(sorted.indexOf(s)).toBeGreaterThan(at);
  });
});
