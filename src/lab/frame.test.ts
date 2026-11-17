import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { project } from "../iso/project";
import { buildRenderList, type RenderItem } from "../iso/render-list";
import type { Solid } from "../iso/solids";
import type { Animator } from "../scenes/animator";
import { BEAM_HALF, BEAM_LEN, BEAM_PERIOD_MS } from "../scenes/sea-anim";
import { assembleWorld } from "../world/assemble";
import { type Box, boxFrame } from "../world/frame";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS } from "./exhibits";
import { contentFrame, FRAME_SAMPLES } from "./frame";

type Pt = { x: number; y: number };
const EPS = 1e-9;

function rect(items: RenderItem[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) for (let i = 0; i < it.pts.length; i += 2) {
    minX = Math.min(minX, it.pts[i]!); maxX = Math.max(maxX, it.pts[i]!);
    minY = Math.min(minY, it.pts[i + 1]!); maxY = Math.max(maxY, it.pts[i + 1]!);
  }
  return { minX, minY, maxX, maxY };
}
const itemPts = (items: RenderItem[]): Pt[] => items.flatMap((it) => it.pts.flatMap((_, i) => (i % 2 ? [] : [{ x: it.pts[i]!, y: it.pts[i + 1]! }])));
function covers(items: RenderItem[], pts: Pt[]): void {
  const r = rect(items);
  for (const p of pts) {
    expect(p.x).toBeGreaterThanOrEqual(r.minX - EPS); expect(p.x).toBeLessThanOrEqual(r.maxX + EPS);
    expect(p.y).toBeGreaterThanOrEqual(r.minY - EPS); expect(p.y).toBeLessThanOrEqual(r.maxY + EPS);
  }
}

const toy = (solids: Solid[] = [], accents: Accent[] = []) => ({
  terrain: { ground: [], bleed: [], water: [], foam: { kind: "ground", mat: "foam", tris: [] } as Solid },
  ground: [], solids, accents,
});
const tall: Solid = { kind: "prism", at: v3(0, 0, 0), w: 2, d: 2, h: 10, mat: "concrete" };
const shadows = (items: RenderItem[]): RenderItem[] => items.filter((it) => it.layer === "shadow" || it.layer === "shadowCore");

describe("contentFrame (#400)", () => {
  it("covers the shadow of a tall solid", () => {
    covers(contentFrame(toy([tall]), []), itemPts(shadows(buildRenderList([tall]))));
  });
  it("clips that shadow with clip", () => {
    const clip: Box = { x0: -1, y0: -1, x1: 3, y1: 3 };
    const f = contentFrame(toy([tall]), [], { clip });
    covers(f, itemPts(shadows(buildRenderList([tall], undefined, clip))));
    expect(rect(f).maxX).toBeLessThan(rect(shadows(buildRenderList([tall]))).maxX);
  });
  it("covers the 4.5·r halo disc of a dot", () => {
    const at = v3(10, 10, 5), p = project(at);
    covers(contentFrame(toy([], [{ kind: "dot", at, r: 1, color: "amber" }]), []), [{ x: p.x - 4.5, y: p.y }, { x: p.x + 4.5, y: p.y }, { x: p.x, y: p.y - 4.5 }, { x: p.x, y: p.y + 4.5 }]);
  });
  it("covers the points of a poly", () => {
    const pts = [v3(0, 0, 0), v3(20, 0, 3), v3(0, 30, 8)];
    covers(contentFrame(toy([], [{ kind: "poly", pts, color: "cyan" }]), []), pts.map(project));
  });
  it("covers boxFrame(box, h), FRAME_H by default", () => {
    const box: Box = { x0: -10, y0: -10, x1: 10, y1: 10 };
    covers(contentFrame(toy(), [], { box, h: 7 }), itemPts(boxFrame(box, 7)));
    covers(contentFrame(toy(), [], { box }), itemPts(boxFrame(box)));
  });
  it("covers the 16 positions of a moving accent and ticks 16 × BEAM_PERIOD_MS / 16", () => {
    const dts: number[] = [];
    let k = 0;
    const at = (n: number): Vec3 => v3(10 * n, 0, 0);
    const anim: Animator = {
      ids: ["toy.light"],
      // odd samples: the layer is empty (a ship offscreen, a beam off)
      layer: () => ({ kind: "accent", accents: k % 2 ? [] : [{ kind: "dot", at: at(k), r: 0.5, color: "amber" }] }),
      tick: (dt) => { dts.push(dt); k++; return new Set(["toy.light"]); },
    };
    const f = contentFrame(toy(), [anim]);
    expect(FRAME_SAMPLES).toBe(16);
    expect(dts).toEqual(Array(16).fill(BEAM_PERIOD_MS / 16));
    covers(f, Array.from({ length: 8 }, (_, n) => project(at(2 * n))));
  });
  it("without animators it is the static content plus the box", () => {
    const box: Box = { x0: -5, y0: -5, x1: 5, y1: 5 };
    const f = contentFrame(toy([tall]), [], { box });
    covers(f, itemPts(buildRenderList([tall])));
    covers(f, itemPts(boxFrame(box)));
  });
  it("real world: faro covers the beam wedge over a whole turn", () => {
    const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
    const e = EXHIBITS.find((x) => x.id === "faro")!;
    if (e.kind !== "region") throw new Error("faro is a region");
    const f = contentFrame(cropScene(scene, e.box), cropAnimators(animators, e.box), { box: e.box, h: e.h, clip: e.box });
    const o = scene.sea!.lantern;
    for (let n = 0; n < 8; n++) {
      const a = (n * Math.PI) / 4;
      covers(f, [o, ...[a - BEAM_HALF, a + BEAM_HALF].map((b) => v3(o.x + BEAM_LEN * Math.cos(b), o.y + BEAM_LEN * Math.sin(b), o.z))].map(project));
    }
  });
});
