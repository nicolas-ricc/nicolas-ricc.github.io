import { describe, expect, it } from "vitest";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { DOCK } from "../map/geo";
import { createRng } from "../map/seed";
import { STACKS } from "./factory";
import { shipyard, type Scene } from "./shipyard";
import { SERVICE, YARD } from "./shipyard-fill";
import { world } from "./world";

const w = world(7);
const site = w.shipyard!;
const scenes: [string, Scene][] = [["world(7)", site], ["seed 8", shipyard(createRng(8))]];
const prisms = (ss: Solid[]) => ss.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism");
const raised = (ss: Solid[]) => ss.filter((x) => !isFlat(x));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const cross = (a: Bounds, b: Bounds) =>
  a.min.x < b.max.x - 1e-9 && b.min.x < a.max.x - 1e-9 && a.min.y < b.max.y - 1e-9 && b.min.y < a.max.y - 1e-9 && a.min.z < b.max.z - 1e-9 && b.min.z < a.max.z - 1e-9;

/** Strict 3D AABB overlap between raised solids of different pieces, and between a piece and the old solids. */
function overlapsOf(s: Scene, pieces: Solid[][]): string[] {
  const all = new Set([...s.fill.yard, ...s.fill.dock, ...s.fill.service].flat());
  const old = raised(s.solids).filter((x) => !all.has(x)).map(bounds);
  const bs = pieces.map((p) => raised(p).map(bounds));
  const out: string[] = [];
  bs.forEach((p, i) => {
    for (const b of p) {
      for (const o of old) if (cross(b, o)) out.push(`piece ${i} ↔ old ${JSON.stringify(o)}`);
      for (let j = i + 1; j < bs.length; j++) for (const c of bs[j]!) if (cross(b, c)) out.push(`piece ${i} ↔ piece ${j}`);
    }
  });
  return out;
}

describe.each(scenes)("material yard fill (%s)", (_, s) => {
  const [gantry, ...groups] = s.fill.yard;

  it("yard: up to 5 stock groups inside the yard, none above 3", () => {
    expect(groups.length).toBeLessThanOrEqual(5);
    for (const g of groups) for (const x of g) {
      const b = bounds(x), where = JSON.stringify(b);
      expect(b.min.x, where).toBeGreaterThanOrEqual(YARD.x0); expect(b.max.x, where).toBeLessThanOrEqual(YARD.x1);
      expect(b.min.y, where).toBeGreaterThanOrEqual(YARD.y0); expect(b.max.y, where).toBeLessThanOrEqual(YARD.y1);
      expect(b.max.z, where).toBeLessThanOrEqual(3);
    }
  });

  it("yard gantry: two rails, two steel legs 1×1×9 on the rails, a 1×24×1 beam at z 9 and a rust trolley at z 8", () => {
    const rails = gantry!.filter((x): x is Solid & { kind: "strip" } => x.kind === "strip" && x.mat === "rail");
    expect(rails.map((r) => r.path.map((p) => [p.x, p.y]))).toEqual([[[104, -59.5], [192, -59.5]], [[104, -35.5], [192, -35.5]]]);
    for (const r of rails) expect(s.ground).toContain(r);
    const legs = prisms(gantry!).filter((x) => x.mat === "steel" && x.w === 1 && x.d === 1 && x.h === 9);
    expect(legs.map((x) => [x.at.x, x.at.y, x.at.z])).toEqual([[150, -59.5, 0], [150, -36.5, 0]]);
    for (const [leg, y] of [[legs[0]!, -59.5], [legs[1]!, -35.5]] as const) { const b = bounds(leg); expect(b.min.y <= y && y <= b.max.y).toBe(true); }
    expect(prisms(gantry!).filter((x) => x.mat === "steel" && x.w === 1 && x.d === 24 && x.h === 1).map((x) => [x.at.x, x.at.y, x.at.z])).toEqual([[150, -59.5, 9]]);
    const trolley = prisms(gantry!).filter((x) => x.mat === "rust" && x.w === 2 && x.d === 2 && x.h === 1);
    expect(trolley).toHaveLength(1);
    const tb = bounds(trolley[0]!);
    expect(trolley[0]!.at.z).toBe(8);
    expect(tb.min.y).toBeGreaterThanOrEqual(-58.5); expect(tb.max.y).toBeLessThanOrEqual(-36.5);
    for (const l of legs) expect(cross(tb, bounds(l))).toBe(false);
  });

  it("yard pieces do not overlap each other or the old solids", () => expect(overlapsOf(s, s.fill.yard)).toEqual([]));
});

it("the site's yard places at least 3 stock groups", () => expect(site.fill.yard.length - 1).toBeGreaterThanOrEqual(3));

describe.each(scenes)("dry dock works (%s)", (_, s) => {
  const [north, south, ...rest] = s.fill.dock;

  it("dock scaffolding: two rows of steel 0.4 posts every 8 from z −6 to 0.5 and deck planks at z 0", () => {
    for (const [row, y] of [[north!, 8.5], [south!, 27]] as const) {
      const posts = prisms(row).filter((x) => x.mat === "steel" && x.w === 0.4 && x.d === 0.4);
      expect(posts.map((x) => [x.at.x, x.at.y, x.at.z, x.h])).toEqual([128, 136, 144, 152, 160, 168, 176].map((x) => [x, y, -6, 6.5]));
      const planks = prisms(row).filter((x) => x.mat === "deck" && x.w === 8 && x.d === 0.6 && x.h === 0.2);
      expect(planks).toHaveLength(6);
      for (const p of planks) expect(p.at.z).toBe(0);
      expect(row).toHaveLength(13);
    }
  });

  it("two small tower cranes with the mast in x 115.4..116.6", () => {
    const masts = prisms(rest.flat()).filter((x) => x.mat === "steel" && x.w === 1.2 && x.d === 1.2 && x.h === 14);
    expect(masts).toHaveLength(2);
    for (const m of masts) { const b = bounds(m); expect(near(b.min.x, 115.4) && near(b.max.x, 116.6)).toBe(true); }
    expect(masts.map((m) => bounds(m).min.y + 0.6).sort((a, b) => a - b).map((y) => Math.round(y * 1e6) / 1e6)).toEqual([5, 31]);
    for (const y of [5, 31]) expect(s.accents.some((a) => a.kind === "dot" && a.color === "cyan" && near(a.at.x, 128) && near(a.at.y, y))).toBe(true);
  });

  it("site containers on the slab north of the dock", () => {
    const boxes = rest.filter((p) => p.length === 1 && p[0]!.kind === "prism" && p[0]!.w === 6 && p[0]!.d === 2.4 && p[0]!.h === 2.6);
    expect(boxes.map((p) => { const x = p[0] as Solid & { kind: "prism" }; return [x.at.x, x.at.y, x.at.z]; })).toEqual([[124, 2.5, 0], [132, 2.5, 0]]);
  });

  it("nothing of the dock works stands in the pit except the scaffolding", () => {
    for (const x of rest.flat()) {
      const b = bounds(x);
      const inPit = b.min.x < DOCK.x + DOCK.w && b.max.x > DOCK.x && b.min.y < DOCK.y + DOCK.d && b.max.y > DOCK.y;
      expect(b.min.z >= 0 || !inPit, JSON.stringify(b)).toBe(true);
    }
  });

  it("dock pieces do not overlap each other or the old solids", () => expect(overlapsOf(s, s.fill.dock)).toEqual([]));
});

describe.each(scenes)("service strip (%s)", (_, s) => {
  it("service strip: inside x 112..196, y 76.5..79.5, never in x 147..156, none above 3", () => {
    expect(SERVICE).toEqual({ x0: 112, y0: 76.5, x1: 196, y1: 79.5, skip: [147, 156] });
    expect(s.fill.service.length).toBeLessThanOrEqual(12);
    for (const x of s.fill.service.flat()) {
      const b = bounds(x), where = JSON.stringify(b);
      expect(b.min.x, where).toBeGreaterThanOrEqual(112); expect(b.max.x, where).toBeLessThanOrEqual(196);
      expect(b.min.y, where).toBeGreaterThanOrEqual(76.5); expect(b.max.y, where).toBeLessThanOrEqual(79.5);
      expect(b.max.x <= 147 || b.min.x >= 156, where).toBe(true);
      expect(b.max.z, where).toBeLessThanOrEqual(3);
    }
  });

  it("the fill does not overlap itself or the old solids", () => expect(overlapsOf(s, [...s.fill.yard, ...s.fill.dock, ...s.fill.service])).toEqual([]));
});

it("the site's service strip places all 12 pieces: 2 storerooms, 2 forklifts, 3 pallet stacks, 3 toilets, 2 tool containers", () => {
  const ps = site.fill.service;
  expect(ps).toHaveLength(12);
  const one = (p: Solid[]) => (p.length === 1 && p[0]!.kind === "prism" ? p[0]! : null);
  const count = (f: (x: Solid & { kind: "prism" }) => boolean) => ps.filter((p) => { const x = one(p); return x !== null && x.kind === "prism" && f(x); }).length;
  expect(count((x) => x.w === 4 && x.d === 3 && x.h === 2.6)).toBe(2);
  expect(count((x) => x.mat === "rust" && x.w === 2 && x.d === 3 && x.h === 2)).toBe(2);
  expect(count((x) => x.mat === "boxBlue" && x.w === 1 && x.d === 1 && x.h === 2.2)).toBe(3);
  expect(count((x) => x.w === 6 && x.d === 2.4 && x.h === 2.6)).toBe(2);
  const pallets = ps.filter((p) => p.length >= 1 && p.every((x) => x.kind === "prism" && x.mat === "deck" && x.w === 1.2 && x.d === 1 && x.h === 0.5));
  expect(pallets).toHaveLength(3);
  for (const p of pallets) expect(p.length).toBeGreaterThanOrEqual(1), expect(p.length).toBeLessThanOrEqual(4);
});

describe("the fill does not cover the landmarks on screen", () => {
  const fa = w.factory!;
  const stacks = fa.solids.filter((x) => x.kind === "cylinder" && STACKS.some((k) => x.at.x === k.x && x.at.y === k.y && x.r === k.r));
  const gantry = prisms(site.solids).filter((x) => x.mat === "steel" && x.at.x === 150 && (x.h === 24 || x.at.z === 24));
  const trolleys = site.trolleyRange.map((y) => bounds({ ...site.trolley, at: { ...site.trolley.at, y } }));
  const dockShip = site.solids.filter((x) => (x.kind === "hull" && x.at.z === -DOCK.depth) || (x.kind === "prism" && x.at.z === -DOCK.depth + 5 && x.w === 8 && x.d === 5));
  const covers = (protectedOnes: Bounds[], news: Solid[]) => {
    const out: string[] = [];
    for (const p of protectedOnes) for (const n of raised(news)) {
      const nb = bounds(n);
      if (overlaps(screenBounds(p), screenBounds(nb)) && isBehind(p, nb)) out.push(`${JSON.stringify(p)} behind ${JSON.stringify(nb)}`);
    }
    return out;
  };

  it("finds what it protects", () => {
    expect(stacks).toHaveLength(3);
    expect(gantry).toHaveLength(3);
    expect(dockShip).toHaveLength(2);
  });
  it("yard and service do not cover the gantry, the dry dock ship or the chimneys", () => {
    expect(covers([...gantry.map(bounds), ...trolleys, ...dockShip.map(bounds), ...stacks.map(bounds)], [...site.fill.yard, ...site.fill.service].flat())).toEqual([]);
  });
  it("the dock works do not cover the gantry or the chimneys", () => {
    expect(covers([...gantry.map(bounds), ...trolleys, ...stacks.map(bounds)], site.fill.dock.flat())).toEqual([]);
  });
});
