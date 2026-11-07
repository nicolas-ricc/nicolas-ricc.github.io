import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { SHADOW_CORE_H, shadowPolygon } from "../iso/light";
import { bounds, type Solid, type Tri, tessellate } from "../iso/solids";
import type { Animator } from "../scenes/animator";
import type { WorldScene } from "../scenes/world";
import type { ZonedAnimator } from "../world/assemble";
import { cropAccents, cropAnimators, cropScene, cropShared, overlaps, pieceScene, readout, solidsBox } from "./crop";
import { EXHIBITS } from "./exhibits";

const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
const prism = (x: number, y: number, w = 2): Solid => ({ kind: "prism", at: v3(x, y, 0), w, d: w, h: 3, mat: "concrete" });
const tri = (x: number, y: number): Tri => ({ pts: [v3(x, y, 0), v3(x + 1, y, 0), v3(x, y + 1, 0)] });

describe("overlaps", () => {
  it("a box that touches the edge overlaps; a separate one does not", () => {
    expect(overlaps({ min: v3(10, 3, 0), max: v3(12, 4, 9) }, box)).toBe(true);
    expect(overlaps({ min: v3(10.1, 3, 0), max: v3(12, 4, 9) }, box)).toBe(false);
    expect(overlaps({ min: v3(3, -5, 0), max: v3(4, -0.1, 0) }, box)).toBe(false);
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
    expect(cropShared(water, box)).toBe(out.terrain.water[0]);
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
    expect(a!.claims).toEqual([cropShared(water, box)]);
    expect(a!.claims![0]).toBe(cropShared(water, box));
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
