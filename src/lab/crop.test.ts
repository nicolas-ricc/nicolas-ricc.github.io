import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { SHADOW_CORE_H, shadowPolygon } from "../iso/light";
import { bounds, type Solid, type Tri, tessellate } from "../iso/solids";
import type { Animator } from "../scenes/animator";
import type { WorldScene } from "../scenes/world";
import { platformAnimator } from "../scenes/platform-animator";
import { seaPlatformAt } from "../scenes/sign-platform";
import { tag, type ZonedAnimator } from "../world/assemble";
import { contextAnimators, contextScene, cropAccents, cropAnimators, cropSolids, cropScene, cropShared, cropSolid, isLongPrism, overlaps, pieceScene, readout, solidsBox } from "./crop";
import { EXHIBITS, type ContextExhibit } from "./exhibits";

const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
const prism = (x: number, y: number, w = 2): Solid => ({ kind: "prism", at: v3(x, y, 0), w, d: w, h: 3, mat: "concrete" });
const tri = (x: number, y: number): Tri => ({ pts: [v3(x, y, 0), v3(x + 1, y, 0), v3(x, y + 1, 0)] });

describe("overlaps", () => {
  it("touching the edge does not overlap; crossing it does; a separate one does not (#399)", () => {
    expect(overlaps({ min: v3(10, 3, 0), max: v3(12, 4, 9) }, box)).toBe(false);
    expect(overlaps({ min: v3(3, 10, 0), max: v3(4, 12, 9) }, box)).toBe(false);
    expect(overlaps({ min: v3(9.9, 3, 0), max: v3(12, 4, 9) }, box)).toBe(true);
    expect(overlaps({ min: v3(10.1, 3, 0), max: v3(12, 4, 9) }, box)).toBe(false);
    expect(overlaps({ min: v3(3, -5, 0), max: v3(4, -0.1, 0) }, box)).toBe(false);
  });
});

const EPS = 1e-9;
const insideBox = (p: { x: number; y: number }): boolean => p.x >= box.x0 - EPS && p.x <= box.x1 + EPS && p.y >= box.y0 - EPS && p.y <= box.y1 + EPS;
const triArea = ({ pts: [a, b, c] }: Tri): number => Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
type Strip = Solid & { kind: "strip" };
type Ground = Solid & { kind: "ground" };
type Prism = Solid & { kind: "prism" };

describe("cropSolid: strips cut to the box (#399)", () => {
  const strip = (path: { x: number; y: number }[]): Strip => ({ kind: "strip", path, width: 0.3, z: 0.02, mat: "paving", tone: 1 });
  const crop = (s: Solid): Solid[] => cropSolid(s, box);

  it("a strip that crosses the box comes out cut to it, with the same width, z, mat and tone", () => {
    const out = crop(strip([{ x: -5, y: 5 }, { x: 15, y: 5 }])) as Strip[];
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "strip", width: 0.3, z: 0.02, mat: "paving", tone: 1 });
    expect(out[0]!.path).toHaveLength(2);
    expect(out[0]!.path[0]!.x).toBeCloseTo(0, 12); expect(out[0]!.path[0]!.y).toBeCloseTo(5, 12);
    expect(out[0]!.path[1]!.x).toBeCloseTo(10, 12); expect(out[0]!.path[1]!.y).toBeCloseTo(5, 12);
  });
  it("a strip that goes in and out twice gives two strips", () => {
    const out = crop(strip([{ x: -5, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 20 }, { x: 8, y: 20 }, { x: 8, y: 5 }, { x: 15, y: 5 }])) as Strip[];
    expect(out).toHaveLength(2);
    const round = (s: Strip) => s.path.map((p) => [Math.round(p.x * 1e9) / 1e9, Math.round(p.y * 1e9) / 1e9]);
    expect(round(out[0]!)).toEqual([[0, 2], [5, 2], [5, 10]]);
    expect(round(out[1]!)).toEqual([[8, 10], [8, 5], [10, 5]]);
    for (const s of out) expect(s).toMatchObject({ width: 0.3, z: 0.02, mat: "paving", tone: 1 });
  });
  it("a strip whole inside passes by identity; one that only touches the edge, or is outside, is dropped", () => {
    const s = strip([{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }]);
    const [only, ...rest] = cropSolid(s, box);
    expect(only).toBe(s);
    expect(rest).toEqual([]);
    expect(cropSolid(strip([{ x: 10, y: 5 }, { x: 20, y: 5 }]), box)).toEqual([]);
    expect(cropSolid(strip([{ x: 20, y: 1 }, { x: 30, y: 1 }]), box)).toEqual([]);
  });
});

describe("cropSolid: long prisms cut to the box (#399)", () => {
  const p = (w: number, d: number, extra: Partial<Prism> = {}): Prism => ({ kind: "prism", at: v3(-60, 4, 0), w, d, h: 1.2, mat: "steel", ...extra });

  it("isLongPrism: flat roof, no facade or plates, long side ≥ 30 and ≥ 3× the short one", () => {
    expect(isLongPrism(p(156, 0.6))).toBe(true);
    expect(isLongPrism(p(156, 0.6, { roof: "flat" }))).toBe(true);
    expect(isLongPrism(p(0.6, 40))).toBe(true);
    expect(isLongPrism(p(29, 0.6))).toBe(false);
    expect(isLongPrism(p(40, 14))).toBe(false);
    expect(isLongPrism(p(156, 0.6, { roof: "gable" }))).toBe(false);
    expect(isLongPrism(p(156, 0.6, { facade: { floors: 1, cols: 4 } }))).toBe(false);
    expect(isLongPrism(p(156, 0.6, { plates: [{ wall: 0, shape: "rect", u0: 0, u1: 1, z0: 0, z1: 1, mat: "rust" }] }))).toBe(false);
    expect(isLongPrism({ kind: "cylinder", at: v3(0, 0, 0), r: 40, h: 1, mat: "steel" })).toBe(false);
  });
  it("a 156 × 0.6 prism that crosses the box comes out with at.x and w fitted to it; z, h, mat, tone kept", () => {
    const [out] = cropSolid(p(156, 0.6, { tone: -1 }), box) as Prism[];
    expect(out).toMatchObject({ kind: "prism", at: { x: 0, y: 4, z: 0 }, w: 10, d: 0.6, h: 1.2, mat: "steel", tone: -1 });
  });
  it("cut in y as well when it crosses a corner", () => {
    const [out] = cropSolid({ kind: "prism", at: v3(8, -30, 0), w: 4, d: 35, h: 1, mat: "concrete" }, box) as Prism[];
    expect(out).toMatchObject({ at: { x: 8, y: 0, z: 0 }, w: 2, d: 5 });
  });
  it("a truck (6 × 2.4), a gable prism and a prism with plates that cross the box come in whole", () => {
    const truck: Prism = { kind: "prism", at: v3(7, 3, 0), w: 6, d: 2.4, h: 2.8, mat: "steel" };
    const gable = p(40, 2, { roof: "gable", at: v3(-10, 3, 0) });
    const plated = p(40, 2, { at: v3(-10, 3, 0), plates: [{ wall: 0, shape: "rect", u0: 0, u1: 1, z0: 0, z1: 1, mat: "rust" }] });
    for (const s of [truck, gable, plated]) { const out = cropSolid(s, box); expect(out).toHaveLength(1); expect(out[0]).toBe(s); }
  });
  it("a long prism whole inside passes by identity", () => {
    const s: Prism = { kind: "prism", at: v3(0, 0, 0), w: 0.3, d: 10, h: 1, mat: "steel" };
    const big = { x0: -50, y0: -50, x1: 50, y1: 50 };
    expect(cropSolid(s, big)[0]).toBe(s);
  });
});

describe("cropSolid: terrain triangles cut to the box (#399)", () => {
  const mesh = (tris: Tri[]): Ground => ({ kind: "ground", mat: "concrete", tris });

  it("a triangle that crosses the box comes out as triangles inside it, with the same tone offset and the area of the intersection", () => {
    const [out] = cropSolid(mesh([{ pts: [v3(-2, 2, 0), v3(6, 2, 0), v3(2, 8, 0)], toneOffset: -1, baseTone: 2 }]), box) as [Ground];
    expect(out.tris.length).toBeGreaterThan(0);
    for (const t of out.tris) {
      for (const q of t.pts) expect(insideBox(q), JSON.stringify(q)).toBe(true);
      expect(t.toneOffset).toBe(-1);
      expect(t.baseTone).toBe(2);
    }
    expect(out.tris.reduce((a, t) => a + triArea(t), 0)).toBeCloseTo(21, 9);
  });
  it("a triangle whole inside, or with a vertex on the edge, passes by identity; a mesh of only those is the same object", () => {
    const whole = tri(2, 2), onEdge: Tri = { pts: [v3(9, 5, 0), v3(10, 5, 0), v3(9, 6, 0)] };
    const m = mesh([whole, onEdge]);
    expect(cropSolid(m, box)[0]).toBe(m);
    const [mixed] = cropSolid(mesh([whole, { pts: [v3(8, 8, 0), v3(14, 8, 0), v3(8, 14, 0)] }, onEdge]), box) as [Ground];
    expect(mixed.tris[0]).toBe(whole);
    expect(mixed.tris).toContain(onEdge);
  });
  it("an empty mesh passes by identity, as before", () => {
    const empty = mesh([]);
    expect(cropSolid(empty, box)).toEqual([empty]);
    expect(cropSolid(empty, box)[0]).toBe(empty);
  });
  it("a mesh whose only triangle touches the edge from outside is dropped", () => {
    expect(cropSolid(mesh([{ pts: [v3(10, 2, 0), v3(14, 2, 0), v3(10, 6, 0)] }]), box)).toEqual([]);
  });
  it("cropAnimators: a water triangle whole inside comes back by identity, every tick", () => {
    const inside = tri(3, 3);
    const water = mesh([inside, { pts: [v3(8, 8, 0), v3(14, 8, 0), v3(8, 14, 0)] }]);
    const a0: ZonedAnimator = { zone: null, ids: ["w"], layer: () => ({ kind: "water", water: [water] }), tick: () => new Set(["w"]) };
    const [a] = cropAnimators([a0], box);
    for (let i = 0; i < 2; i++) {
      const l = a!.layer("w");
      const tris = l.kind === "water" ? (l.water[0] as Ground).tris : [];
      expect(tris[0]).toBe(inside);
      for (const t of tris) for (const q of t.pts) expect(insideBox(q)).toBe(true);
      a!.tick(16);
    }
  });
});

describe("cropScene", () => {
  const water: Solid = { kind: "ground", mat: "water", tris: [tri(1, 1), tri(50, 50)] };
  const scene = {
    terrain: { ground: [{ kind: "ground", mat: "concrete", tris: [tri(2, 2), tri(40, 40)] }], bleed: [{ kind: "ground", mat: "concrete", tris: [tri(90, 90)] }], water: [water], foam: { kind: "ground", mat: "foam", tris: [tri(70, 70)] } },
    ground: [prism(1, 1), prism(30, 30)],
    solids: [prism(9, 9, 4), prism(20, 20)],
    accents: [],
    landmarks: { portfolio: v3(0, 0, 0), cv: v3(0, 0, 0), blog: v3(0, 0, 0) },
    shipyard: null, city: null, factory: null, sea: null, hinterland: null, tech: null, fair: null,
  } as unknown as WorldScene;
  const out = cropScene(scene, box);

  it("keeps whole a solid that crosses the edge and drops one outside", () => {
    expect(out.solids).toEqual([scene.solids[0]]);
    expect(out.ground).toEqual([scene.ground[0]]);
  });
  it("the terrain is filtered by triangle and an empty mesh disappears", () => {
    expect(out.terrain.ground).toHaveLength(1);
    expect((out.terrain.ground[0] as Solid & { kind: "ground" }).tris).toEqual([tri(2, 2)]);
    expect(out.terrain.bleed).toEqual([]);
    expect((out.terrain.water[0] as Solid & { kind: "ground" }).tris).toEqual([tri(1, 1)]);
  });
  it("the foam outside stays as ground with no triangles", () => {
    expect(out.terrain.foam).toMatchObject({ kind: "ground", mat: "foam", tris: [] });
  });
  it("the same solid and the same box return the same crop", () => {
    expect(cropShared(water, box)[0]).toBe(out.terrain.water[0]);
  });
});

describe("cropAccents", () => {
  it("dot by its point, poly by any vertex inside", () => {
    const inDot: Accent = { kind: "dot", at: v3(5, 5, 20), r: 1, color: "cyan" };
    const outDot: Accent = { kind: "dot", at: v3(11, 5, 0), r: 1, color: "cyan" };
    const crossPoly: Accent = { kind: "poly", pts: [v3(9, 9, 0), v3(30, 9, 0), v3(30, 30, 0)], color: "amber" };
    const outPoly: Accent = { kind: "poly", pts: [v3(20, 20, 0), v3(30, 20, 0), v3(30, 30, 0)], color: "amber" };
    expect(cropAccents([inDot, outDot, crossPoly, outPoly], box)).toEqual([inDot, crossPoly]);
  });
});

describe("cropAnimators", () => {
  // a toy animator: a solid that moves 1 u in x per tick, plus fixed accents
  const toy = (x0: number, claims: Solid[] = []): ZonedAnimator => {
    let x = x0;
    return {
      zone: "portfolio",
      ids: ["toy.solid", "toy.acc"],
      claims,
      layer: (id) => id === "toy.solid"
        ? { kind: "solid", solids: [prism(x, 1), prism(40, 40)], alpha: 0.5 }
        : { kind: "accent", accents: [{ kind: "dot", at: v3(x, 1, 0), r: 1, color: "cyan" }] },
      tick: () => { x += 1; return new Set(["toy.solid"]); },
    };
  };

  it("the wrapped one keeps ids, zone and the tick result", () => {
    const [a] = cropAnimators([toy(1)], box);
    expect(a!.ids).toEqual(["toy.solid", "toy.acc"]);
    expect(a!.zone).toBe("portfolio");
    expect([...a!.tick(16)]).toEqual(["toy.solid"]);
  });
  it("the layers return only what falls inside, also after tick", () => {
    const [a] = cropAnimators([toy(1)], box);
    expect(a!.layer("toy.solid")).toMatchObject({ kind: "solid", alpha: 0.5, solids: [prism(1, 1)] });
    for (let i = 0; i < 12; i++) a!.tick(16);
    expect(a!.layer("toy.solid")).toMatchObject({ solids: [] });
    expect(a!.layer("toy.acc")).toMatchObject({ accents: [] });
  });
  it("filters claims with the same identity as cropScene", () => {
    const water: Solid = { kind: "ground", mat: "water", tris: [tri(1, 1), tri(50, 50)] };
    const far: Solid = { kind: "ground", mat: "water", tris: [tri(50, 50)] };
    const [a] = cropAnimators([toy(1, [water, far])], box);
    expect(a!.claims).toEqual(cropShared(water, box));
    expect(a!.claims![0]).toBe(cropShared(water, box)[0]);
  });
  it("a layer that reassigns the triangles of the same solid is cropped again on every call", () => {
    const glint: Solid & { kind: "ground" } = { kind: "ground", mat: "glint", tris: [tri(1, 1)] };
    const a0: ZonedAnimator = { zone: null, ids: ["g"], layer: () => ({ kind: "water", water: [glint] }), tick: () => new Set(["g"]) };
    const [a] = cropAnimators([a0], box);
    glint.tris = [tri(2, 2), tri(60, 60)];
    expect(a!.layer("g")).toMatchObject({ water: [{ tris: [tri(2, 2)] }] });
  });
  it("drops the animator with no initial content in the box", () => {
    expect(cropAnimators([toy(30)], box)).toEqual([]);
  });
});

describe("pieceScene", () => {
  const lamp: Accent = { kind: "dot", at: v3(1, 1, 6), r: 1, color: "amber" };
  const scene = pieceScene((out, accents) => { out.push(prism(-1, -1), prism(6, 0)); accents.push(lamp); });

  it("no terrain, subscenes null and landmarks at the origin", () => {
    expect(scene.terrain.ground).toEqual([]);
    expect(scene.terrain.bleed).toEqual([]);
    expect(scene.terrain.water).toEqual([]);
    expect(scene.terrain.foam).toMatchObject({ kind: "ground", mat: "foam", tris: [] });
    for (const k of ["shipyard", "city", "factory", "sea", "hinterland", "tech", "fair"] as const) expect(scene[k]).toBeNull();
    for (const p of Object.values(scene.landmarks)) expect(p).toEqual(v3(0, 0, 0));
  });
  it("the solids and accents from build, and a 1 u paving pad that covers the piece and its shadow", () => {
    expect(scene.solids).toEqual([prism(-1, -1), prism(6, 0)]);
    expect(scene.accents).toEqual([lamp]);
    expect(scene.ground).toHaveLength(1);
    // flat mesh: painted in the ground layer, under shadows and solids
    expect(scene.ground[0]).toMatchObject({ kind: "ground", mat: "paving" });
    const { min, max } = bounds(scene.ground[0]!);
    // the piece reaches ±8: west, north and south as before, ±(8 + 3)
    expect(min.x).toBeCloseTo(-11);
    expect(min.y).toBeCloseTo(-11);
    expect(max.y).toBeCloseTo(11);
    // the shadow falls east: the pad reaches its tip plus the margin
    const tip = Math.max(...scene.solids.flatMap((s) => (shadowPolygon(s) ?? []).map((p) => p.x)));
    expect(tip).toBeGreaterThan(8);
    expect(max.x).toBeCloseTo(tip + 3);
    expect(max.z).toBe(0); // top face at the level of the land pieces
    expect(max.z - min.z).toBe(1);
  });
  it("a piece with no shadow keeps the centered square pad", () => {
    const flat: Solid = { kind: "ground", mat: "concrete", tris: [{ pts: [v3(-2, -2, 0), v3(4, -2, 0), v3(-2, 4, 0)] }] };
    const { min, max } = bounds(pieceScene((out) => { out.push(flat); }).ground[0]!);
    expect([min.x, min.y, max.x, max.y]).toEqual([-7, -7, 7, 7]);
  });
  it("an empty build gets a finite ±3 pad with its top face at z = 0", () => {
    const s = pieceScene(() => {});
    expect(s.solids).toEqual([]);
    const pts = s.ground[0]!.kind === "ground" ? s.ground[0]!.tris.flatMap((t) => t.pts) : [];
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) for (const c of [p.x, p.y, p.z]) expect(Number.isFinite(c)).toBe(true);
    const { min, max } = bounds(s.ground[0]!);
    expect([min.x, min.y, max.x, max.y]).toEqual([-3, -3, 3, 3]);
    expect([min.z, max.z]).toEqual([-1, 0]);
  });
  it("a build of faceless solids also gets the pad at z = 0", () => {
    const faceless: Solid = { kind: "ground", mat: "concrete", tris: [] };
    const s = pieceScene((out) => { out.push(faceless); });
    expect(s.solids).toEqual([faceless]);
    expect(s.ground).toHaveLength(1);
    const { min, max } = bounds(s.ground[0]!);
    expect([min.x, min.y, max.x, max.y]).toEqual([-3, -3, 3, 3]);
    expect([min.z, max.z]).toEqual([-1, 0]);
  });
  it("the shadow of each piece in the catalog falls on the pad", () => {
    const out = new Set<string>();
    for (const e of EXHIBITS) {
      if (e.kind !== "piece") continue;
      const s = pieceScene(e.build, e.pad);
      const { min, max } = bounds(s.ground[0]!);
      for (const so of s.solids) for (const p of [...shadowPolygon(so) ?? [], ...shadowPolygon(so, SHADOW_CORE_H) ?? []]) {
        if (p.x < min.x || p.x > max.x || p.y < min.y || p.y > max.y) out.add(e.id);
      }
    }
    expect([...out]).toEqual([]);
  });
  it("the pad contains an off-center piece", () => {
    const b = bounds(scene.ground[0]!);
    for (const s of scene.solids) {
      const sb = bounds(s);
      expect(b.min.x).toBeLessThan(sb.min.x); expect(b.max.x).toBeGreaterThan(sb.max.x);
      expect(b.min.y).toBeLessThan(sb.min.y); expect(b.max.y).toBeGreaterThan(sb.max.y);
    }
  });
  it("a ship at z −1 goes on water and the pad does not cover its hull", () => {
    const boat: Solid = { kind: "prism", at: v3(-2, -1, -1), w: 4, d: 2, h: 2, mat: "hull" };
    const s = pieceScene((out) => { out.push(boat); }, "water");
    expect(s.ground[0]).toMatchObject({ kind: "ground", mat: "water" });
    expect(bounds(s.ground[0]!).max.z).toBe(-1);
  });
});

describe("solidsBox", () => {
  it("box in x/y of all the solids and h the highest z", () => {
    const { box, h } = solidsBox([prism(-3, 1), prism(4, -2, 4)]);
    expect(box).toEqual({ x0: -3, y0: -2, x1: 8, y1: 3 });
    expect(h).toBe(3);
  });
});

describe("readout", () => {
  const hull: Solid = { kind: "hull", at: v3(5, 5, -1), len: 6, beam: 2, h: 2, mat: "hullBlue", topMat: "steel" };
  const pad: Solid = { kind: "ground", mat: "paving", tris: [tri(0, 0)] };
  const scene = {
    ...pieceScene(() => {}),
    terrain: { ground: [prism(100, 100)], bleed: [], water: [], foam: { kind: "ground", mat: "foam", tris: [] } },
    ground: [pad],
    solids: [prism(1, 1), hull],
    accents: [{ kind: "dot", at: v3(1, 1, 3), r: 1, color: "cyan" }, { kind: "poly", pts: [v3(0, 0, 0)], color: "amber" }],
  } as WorldScene;
  const wheel: Solid = { kind: "wheel", at: v3(3, 3, 4), r: 2, width: 0.5, mat: "steel", sides: 8, angle: 0, gondolas: { mat: "rust", w: 0.6, d: 0.4, h: 0.5 } };
  const anim: Animator = {
    ids: ["s", "a", "w"],
    layer: (id) => id === "s"
      ? { kind: "solid", solids: [{ kind: "prism", at: v3(-2, 0, 0), w: 1, d: 1, h: 8, mat: "brick" }, wheel] }
      : id === "a"
        ? { kind: "accent", accents: [{ kind: "dot", at: v3(0, 0, 9), r: 1, color: "cyan" }, { kind: "dot", at: v3(0, 0, 9), r: 1, color: "magenta" }] }
        : { kind: "water", water: [prism(50, 50)] },
    tick: () => new Set(),
  };
  const r = readout(scene, [anim]);
  const only = (s: Solid) => readout({ ...scene, ground: [], solids: [s], accents: [] } as WorldScene, []).materials;
  const all = [pad, prism(1, 1), hull, ...(anim.layer("s") as { solids: Solid[] }).solids];

  it("counts scene solids and animated solid layers, not the ground, terrain or water", () => {
    expect(r.solids).toBe(4);
  });
  it("counts the scene ground apart", () => {
    expect(r.ground).toBe(1);
    const two = readout({ ...scene, ground: [pad, pad] } as WorldScene, [anim]);
    expect([two.solids, two.ground]).toEqual([4, 2]);
  });
  it("the faces are those of tessellate over the same solids", () => {
    expect(r.faces).toBe(all.reduce((n, s) => n + tessellate(s).length, 0));
  });
  it("counts static accents plus those of accent layers", () => {
    expect(r.accents).toBe(4);
  });
  it("the box spans the bounds of all the solids, with width, depth and height", () => {
    const bs = all.map(bounds);
    const min = v3(Math.min(...bs.map((b) => b.min.x)), Math.min(...bs.map((b) => b.min.y)), Math.min(...bs.map((b) => b.min.z)));
    const max = v3(Math.max(...bs.map((b) => b.max.x)), Math.max(...bs.map((b) => b.max.y)), Math.max(...bs.map((b) => b.max.z)));
    expect(r.box).toEqual({ min, max, w: max.x - min.x, d: max.y - min.y, h: max.z - min.z });
    expect(r.box?.min.x).toBe(-2);
    expect(r.box?.max.z).toBe(8);
  });
  it("materials of the drawn faces, sorted and without repeats: hull deck and gondolas included", () => {
    expect(r.materials).toEqual(["brick", "concrete", "deck", "hullBlue", "paving", "rust", "steel"]);
  });
  it("a hull with topMat lists deck; without topMat, it does not", () => {
    expect(only(hull)).toEqual(["deck", "hullBlue", "steel"]);
    expect(only({ kind: "hull", at: v3(5, 5, -1), len: 6, beam: 2, h: 2, mat: "hullBlue" })).toEqual(["hullBlue"]);
  });
  it("a Ferris wheel with gondolas lists their material; without gondolas, only the wheel's", () => {
    expect(only(wheel)).toEqual(["rust", "steel"]);
    expect(only({ kind: "wheel", at: v3(3, 3, 4), r: 2, width: 0.5, mat: "steel", sides: 8, angle: 0 })).toEqual(["steel"]);
  });
  it("a prism with a facade lists the window glass", () => {
    expect(only({ kind: "prism", at: v3(1, 1, 0), w: 2, d: 2, h: 3, mat: "concrete", facade: { floors: 2, cols: 2 } })).toEqual(["concrete", "glass"]);
  });
  it("accent colors sorted and without repeats", () => {
    expect(r.accentColors).toEqual(["amber", "cyan", "magenta"]);
  });
  it("a scene with no solids or animators gives a null box and empty lists", () => {
    const empty = { ...scene, ground: [], solids: [], accents: [] } as WorldScene;
    expect(readout(empty, [])).toEqual({ solids: 0, ground: 0, faces: 0, accents: 0, box: null, materials: [], accentColors: [] });
  });
});

describe("contextScene / contextAnimators (#376, #392)", () => {
  const scene = {
    terrain: { ground: [], bleed: [], water: [], foam: { kind: "ground", mat: "foam", tris: [] } },
    ground: [prism(1, 1), prism(30, 30)],
    solids: [prism(9, 9, 4), prism(20, 20)],
    accents: [{ kind: "dot", at: v3(5, 5, 1), r: 1, color: "amber" }, { kind: "dot", at: v3(50, 5, 1), r: 1, color: "amber" }],
    landmarks: { portfolio: v3(0, 0, 0), cv: v3(0, 0, 0), blog: v3(0, 0, 0) },
    shipyard: null, city: null, factory: null, sea: null, hinterland: null, tech: null, fair: null,
  } as unknown as WorldScene;
  const e: ContextExhibit = { id: "test-escena", title: "Test", zone: "blog", group: "sea", kind: "context", box, h: 6,
    sign: { id: "test", text: "l", size: 10.3, width: 1.35, color: "cyan", glyphs: [], backing: [] } };

  it("the crop of the world, nothing added", () => {
    expect(contextScene(scene, e)).toEqual(cropScene(scene, box));
  });
  it("does not mutate the world scene", () => {
    contextScene(scene, e);
    expect(scene.solids).toHaveLength(2);
    expect(scene.accents).toHaveLength(2);
  });
  const toy = (x: number, zone: ZonedAnimator["zone"]): ZonedAnimator => ({
    zone, ids: ["toy"], layer: () => ({ kind: "solid", solids: [prism(x, 1)] }), tick: () => new Set(),
  });
  it("the same as cropAnimators", () => {
    const got = contextAnimators([toy(1, "portfolio"), toy(40, "portfolio")], e);
    expect(got.map((a) => a.ids)).toEqual(cropAnimators([toy(1, "portfolio")], box).map((a) => a.ids));
    expect(got).toHaveLength(1);
  });
  const TALL_BOX = { x0: 406, y0: 366, x1: 474, y1: 434 };
  const toyAt = (b: typeof TALL_BOX): Animator => ({ ids: ["toy.lit"], layer: () => ({ kind: "solid", solids: [prism(b.x0 + 1, b.y0 + 1)] }), tick: () => new Set() });
  // #427: a Writing exhibit carries its site; the platform of that site joins the crop and the platform animator leaves it
  const tall: ContextExhibit = { ...e, id: "test-escena-angosta", box: TALL_BOX, writingSite: "tall" };
  it("with writingSite, the crop of the world plus the cropped raft of that site (solids only)", () => {
    const solids: Solid[] = [];
    seaPlatformAt(solids, "tall");
    const base = cropScene(scene, TALL_BOX), got = contextScene(scene, tall);
    expect(got.solids).toEqual([...base.solids, ...cropSolids(solids, TALL_BOX)]);
    expect(got.accents).toEqual(base.accents); // the raft has no accents (#454)
    expect(got.solids.length).toBeGreaterThan(base.solids.length);
    expect(scene.solids).toHaveLength(2);
  });
  it("with writingSite, the platform animator is dropped and the others stay", () => {
    const platform = platformAnimator({ site: "tall", reducedMotion: false }), lit: ZonedAnimator = { ...toyAt(TALL_BOX), zone: "blog" };
    const got = contextAnimators([tag(platform, "blog"), lit], tall);
    expect(got.some((a) => a.ids.includes("platform.solid"))).toBe(false);
    expect(got).toHaveLength(1);
    // without writingSite the platform animator is cropped like any other
    expect(contextAnimators([tag(platformAnimator({ site: "tall", reducedMotion: false }), "blog")], { ...tall, writingSite: undefined }).some((a) => a.ids.includes("platform.solid"))).toBe(true);
  });
});
