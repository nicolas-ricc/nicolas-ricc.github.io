import { describe, expect, it } from "vitest";
import { ISO_COLORS, ISO_TONES, allIsoColors } from "../map/palette-iso";
import { v3 } from "./geometry";
import { project } from "./project";
import { buildRenderList, type Layer } from "./render-list";
import type { Solid } from "./solids";

const prism: Solid = { kind: "prism", at: v3(0, 0, 0), w: 2, d: 2, h: 2, mat: "concrete" };
const slab: Solid = { kind: "ground", mat: "slab", tris: [{ pts: [v3(0, 0, 0), v3(10, 0, 0), v3(0, 10, 0)] }, { pts: [v3(10, 0, 0), v3(10, 10, 0), v3(0, 10, 0)], toneOffset: -1 }] };

describe("buildRenderList", () => {
  it("layers in order ground < shadow < shadowCore < solid", () => {
    const items = buildRenderList([prism, slab]);
    const layers = items.map((i) => i.layer);
    const last = (l: Layer) => layers.lastIndexOf(l), first = (l: Layer) => layers.indexOf(l);
    expect(last("ground")).toBeLessThan(first("shadow"));
    expect(last("shadowCore")).toBeLessThan(first("solid"));
    expect(first("shadow")).toBeLessThan(first("shadowCore"));
  });

  it("each raised solid emits a full shadow and a core; the core is smaller", () => {
    const tall: Solid = { kind: "prism", at: v3(0, 0, 0), w: 2, d: 2, h: 20, mat: "concrete" };
    const items = buildRenderList([tall, slab]);
    expect(items.filter((i) => i.layer === "shadow")).toHaveLength(1);
    expect(items.filter((i) => i.layer === "shadowCore")).toHaveLength(1);
    const area = (pts: number[]) => { let a = 0; for (let i = 0; i < pts.length; i += 2) { const j = (i + 2) % pts.length; a += pts[i]! * pts[j + 1]! - pts[j]! * pts[i + 1]!; } return Math.abs(a) / 2; };
    expect(area(items.find((i) => i.layer === "shadowCore")!.pts)).toBeLessThan(area(items.find((i) => i.layer === "shadow")!.pts));
    expect(items.find((i) => i.layer === "shadowCore")!.color).toBe(ISO_COLORS.shadow);
  });

  it("a prism produces one shadow and three faces with the material's three tones", () => {
    const items = buildRenderList([prism]);
    expect(items.filter((i) => i.layer === "shadow")).toHaveLength(1);
    expect(items.find((i) => i.layer === "shadow")!.color).toBe(ISO_COLORS.shadow);
    const colors = items.filter((i) => i.layer === "solid").map((i) => i.color).sort();
    expect(colors).toEqual([ISO_TONES.concrete.top, ISO_TONES.concrete.lit, ISO_TONES.concrete.shade].sort());
  });

  it("the ground's tone offset lowers one step", () => {
    const items = buildRenderList([slab]).filter((i) => i.layer === "ground");
    expect(items.map((i) => i.color)).toEqual([ISO_TONES.slab.top, ISO_TONES.slab.down]);
  });

  it("points are projected to screen, flat", () => {
    const top = buildRenderList([prism]).find((i) => i.layer === "solid" && i.color === ISO_TONES.concrete.top)!;
    expect(top.pts).toHaveLength(8);
    expect(top.pts).toContain(-2.8); // project(0,0,2).y
  });

  it("every color comes from the atlas", () => {
    const all = allIsoColors();
    for (const i of buildRenderList([prism, slab, { kind: "cone", at: v3(5, 5, 0), r: 2, h: 4, mat: "leaf" }])) expect(all.has(i.color)).toBe(true);
  });

  it("solids come out in painter order", () => {
    const far: Solid = { ...prism, at: v3(0, 0, 0) }, near: Solid = { ...prism, at: v3(6, 6, 0) };
    const items = buildRenderList([near, far]).filter((i) => i.layer === "solid");
    const nearY = Math.max(...items.slice(3).flatMap((i) => i.pts.filter((_, k) => k % 2 === 1)));
    const farY = Math.max(...items.slice(0, 3).flatMap((i) => i.pts.filter((_, k) => k % 2 === 1)));
    expect(farY).toBeLessThan(nearY);
  });
});

/** Every (x, y) of `pts` inside the projected rhombus of the rectangle (convex, tolerance 1e-9). */
function inRhombus(pts: number[], r: { x0: number; y0: number; x1: number; y1: number }): boolean {
  const q = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].map(([x, y]) => project(v3(x!, y!, 0)));
  for (let i = 0; i < pts.length; i += 2) {
    const px = pts[i]!, py = pts[i + 1]!;
    let pos = false, neg = false;
    for (let k = 0; k < 4; k++) {
      const a = q[k]!, b = q[(k + 1) % 4]!;
      const c = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
      if (c > 1e-9) pos = true;
      if (c < -1e-9) neg = true;
    }
    if (pos && neg) return false;
  }
  return true;
}

describe("buildRenderList with clip (#399)", () => {
  const clip = { x0: 0, y0: 0, x1: 10, y1: 10 };
  const tall: Solid = { kind: "prism", at: v3(8, 4, 0), w: 1, d: 1, h: 10, mat: "concrete" };
  const shadows = (items: ReturnType<typeof buildRenderList>) => items.filter((i) => i.layer === "shadow" || i.layer === "shadowCore");

  it("without clip the shadow of a tall prism near the east edge leaves the box (the control)", () => {
    const s = shadows(buildRenderList([tall]));
    expect(s).toHaveLength(2);
    expect(s.every((i) => inRhombus(i.pts, clip))).toBe(false);
  });
  it("with clip both shadow bands fall inside the projected rhombus of the box", () => {
    const s = shadows(buildRenderList([tall], undefined, clip));
    expect(s).toHaveLength(2);
    for (const i of s) expect(inRhombus(i.pts, clip), JSON.stringify(i.pts)).toBe(true);
  });
  it("a shadow entirely outside the box emits no shadow item", () => {
    const far: Solid = { ...tall, at: v3(40, 40, 0) } as Solid;
    expect(shadows(buildRenderList([far], undefined, clip))).toEqual([]);
  });
  it("the solid faces are not clipped", () => {
    const solids = (items: ReturnType<typeof buildRenderList>) => items.filter((i) => i.layer === "solid");
    expect(solids(buildRenderList([tall], undefined, clip))).toEqual(solids(buildRenderList([tall])));
  });
});
