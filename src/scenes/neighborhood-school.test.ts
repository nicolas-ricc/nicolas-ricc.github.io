import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { bounds, type Plate, type Solid } from "../iso/solids";
import { createRng, SEED } from "../map/seed";
import { blockAt, newCtx } from "./neighborhood-fixtures";
import { school } from "./neighborhood-school";
import { tech } from "./tech";
import { FACE_CAPS, blockRect, facesIn, insideInflated } from "./tech-budget";
import { SCHOOL } from "./tech-zoning";
import { zoneRng } from "./world";

type Prism = Solid & { kind: "prism" };
const isPrism = (s: Solid): s is Prism => s.kind === "prism";
const EPS = 1e-9;
const apart = (a: Solid, b: Solid): boolean => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x + EPS || q.max.x <= p.min.x + EPS || p.max.y <= q.min.y + EPS || q.max.y <= p.min.y + EPS || p.max.z <= q.min.z + EPS || q.max.z <= p.min.z + EPS;
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

// the real world: the SCHOOL block as tech() builds it with the zone rng
const scene = tech(zoneRng(SEED, "cv", 2));
const b = blockAt(SCHOOL.x, SCHOOL.y), x = b.x, y = b.y, rect = blockRect(b);
const everything = [...scene.solids, ...scene.ground];
const own = everything.filter((s) => insideInflated(s, rect));
const prisms = own.filter(isPrism);
const find = (f: (s: Prism) => boolean): Prism[] => prisms.filter(f);
const block = find((s) => s.mat === "whitewash" && s.w === 6 && s.d === 16)[0];
const towers = find((s) => s.mat === "brick" && s.w === 3 && s.d === 3).sort((p, q) => p.at.y - q.at.y);
const hall = find((s) => s.mat === "whitewash" && s.w === 3 && s.d === 2)[0];
const roof = find((s) => s.mat === "copper" && s.w === 9 && s.d === 6)[0];
const columns = find((s) => s.mat === "concrete" && s.w === 0.4 && s.d === 0.4);
const mast = find((s) => s.mat === "whitewash" && s.w === 0.2 && s.d === 0.2)[0];
const flag = find((s) => s.mat === "whitewash" && s.w === 1.2 && s.d === 0.15)[0];
const trees = own.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.mat === "leaf");
const lampPost = find((s) => s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5);
const plates = (s: Prism | undefined, wall: number, f: (p: Plate) => boolean = () => true): Plate[] => (s?.plates ?? []).filter((p) => p.wall === wall && f(p));
const inRect = (a: Accent): boolean => { const p = a.kind === "dot" ? a.at : a.pts[0]!; return p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1; };

describe("Ameghino school (#252), over the world", () => {
  it("block plinth paving 24×18×0.3", () => {
    expect(own).toContainEqual({ kind: "prism", at: { x, y, z: 0 }, w: 24, d: 18, h: 0.3, mat: "paving" });
  });

  it("classroom block whitewash 6×16×5.6 at (x + 2, y + 1) above the plinth", () => {
    expect(block).toBeDefined();
    expect(block!.at).toEqual({ x: x + 2, y: y + 1, z: 0.3 });
    expect(block!.h).toBe(5.6);
  });

  it("copper skirting along the whole length and stone string course on the east and south faces", () => {
    for (const wall of [1, 2]) {
      expect(plates(block, wall, (p) => p.mat === "copper" && p.u0 === 0 && p.u1 === 1 && near(p.z0, 0.3) && near(p.z1, 1.3)), `wall ${wall}`).toHaveLength(1);
      expect(plates(block, wall, (p) => p.mat === "stone" && p.u0 === 0 && p.u1 === 1 && near(p.z0, 3.0) && near(p.z1, 3.3)), `wall ${wall}`).toHaveLength(1);
    }
  });

  it("16 tall paired glass windows on the east face, 8 per floor, and one pair per floor on the south", () => {
    const east = plates(block, 1, (p) => p.mat === "glass");
    expect(east).toHaveLength(16);
    for (const p of east) { expect(p.toneOffset).toBe(-1); expect((p.u1 - p.u0) * 16).toBeCloseTo(0.9); expect(p.z1 - p.z0).toBeCloseTo(1.6); }
    for (const z0 of [1.0, 3.8]) {
      const floor = east.filter((p) => near(p.z0, z0)).map((p) => ((p.u0 + p.u1) / 2) * 16).sort((a, c) => a - c);
      expect(floor).toHaveLength(8);
      [1.4, 2.6, 5.4, 6.6, 9.4, 10.6, 13.4, 14.6].forEach((c, i) => expect(floor[i]).toBeCloseTo(c));
    }
    const south = plates(block, 2, (p) => p.mat === "glass");
    expect(south).toHaveLength(4);
    for (const z0 of [1.0, 3.8]) {
      // the south face runs from east to west: local x = 8 − 6u
      const xs = south.filter((p) => near(p.z0, z0)).map((p) => [8 - 6 * p.u1, 8 - 6 * p.u0] as const).sort((a, c) => a[0] - c[0]);
      expect(xs).toHaveLength(2);
      expect(xs[0]![0]).toBeCloseTo(3.95); expect(xs[0]![1]).toBeCloseTo(4.85);
      expect(xs[1]![0]).toBeCloseTo(5.15); expect(xs[1]![1]).toBeCloseTo(6.05);
    }
  });

  it("5 stone pilasters of 0.4 between pairs and at the ends, from base to eave", () => {
    const pil = plates(block, 1, (p) => p.mat === "stone" && p.toneOffset === 1);
    expect(pil).toHaveLength(5);
    for (const p of pil) { expect((p.u1 - p.u0) * 16).toBeCloseTo(0.4); expect(p.z0).toBeCloseTo(0.3); expect(p.z1).toBeCloseTo(5.9); }
    const cs = pil.map((p) => (p.u0 + p.u1) / 2).sort((a, c) => a - c);
    [0.0125, 0.25, 0.5, 0.75, 0.9875].forEach((c, i) => expect(cs[i]).toBeCloseTo(c));
  });

  it("whitewash vestibule between the towers, flush with its east face, with the officeDark double door", () => {
    expect(hall).toBeDefined();
    expect(hall!.at).toEqual({ x: x + 8, y: y + 8, z: 0.3 });
    expect(hall!.at.x + hall!.w).toBe(x + 11);
    const door = plates(hall, 1, (p) => p.mat === "officeDark");
    expect(door).toHaveLength(1);
    expect(door[0]).toMatchObject({ shape: "rect", toneOffset: -2 });
    expect(hall!.at.y + door[0]!.u0 * hall!.d).toBeCloseTo(y + 8.2); expect(hall!.at.y + door[0]!.u1 * hall!.d).toBeCloseTo(y + 9.8);
    expect(door[0]!.z0).toBeCloseTo(0.3); expect(door[0]!.z1).toBeCloseTo(2.6);
    expect(plates(block, 1, (p) => p.mat === "officeDark")).toHaveLength(0); // behind the towers it would not be seen
  });

  it("two 3×3 brick towers of h ≥ 9 touching the east face, with a gap ≥ 1.5 that frames the door", () => {
    expect(towers).toHaveLength(2);
    for (const t of towers) { expect(t.at.x).toBe(x + 8); expect(t.h).toBeGreaterThanOrEqual(9); expect(t.at.z).toBe(0.3); }
    const [n, s] = towers as [Prism, Prism];
    expect(s.at.y - (n.at.y + n.d)).toBeGreaterThanOrEqual(1.5);
    expect(n.at.y + n.d).toBeLessThanOrEqual(y + 8.2); expect(s.at.y).toBeGreaterThanOrEqual(y + 9.8);
  });

  it("a stone finial on each tower and the disc safety crest on the north tower", () => {
    for (const t of towers) {
      const top = t.at.z + t.h;
      const cap = find((s) => s.mat === "stone" && near(s.at.z, top) && s.at.x <= t.at.x && s.at.x + s.w >= t.at.x + t.w && s.at.y <= t.at.y && s.at.y + s.d >= t.at.y + t.d);
      expect(cap, `tower ${t.at.y}`).toHaveLength(1);
    }
    const shield = plates(towers[0], 1, (p) => p.shape === "disc" && p.mat === "safety");
    expect(shield).toHaveLength(1);
    expect(shield[0]).toMatchObject({ u0: 0.3, u1: 0.7 }); expect(shield[0]!.z0).toBeCloseTo(7.2); expect(shield[0]!.z1).toBeCloseTo(8.4);
  });

  it("entrance lamp: amber dot r 0.5 above the door, in front of the gap between towers", () => {
    const dots = scene.accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot" && inRect(a) && a.r === 0.5 && a.color === "amber");
    expect(dots).toHaveLength(1);
    expect(dots[0]!.at.x).toBeCloseTo(x + 11.2); expect(dots[0]!.at.y).toBeCloseTo(y + 9); expect(dots[0]!.at.z).toBeCloseTo(3.2);
  });

  it("staircase box: two lit windows of the school-staircase group on the east face of the south tower", () => {
    const homes = scene.homes.filter((w) => w.pts.every((p) => p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1));
    expect(homes).toHaveLength(2);
    const s = towers[1]!;
    for (const w of homes) {
      expect(w).toMatchObject({ lit: true, group: "school-staircase" });
      expect(w.pts).toHaveLength(4);
      for (const p of w.pts) { expect(p.x).toBe(x + 11); expect(p.y).toBeGreaterThanOrEqual(s.at.y); expect(p.y).toBeLessThanOrEqual(s.at.y + s.d); }
      const ys = w.pts.map((p) => p.y);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1);
    }
    const zs = homes.map((w) => { const z = w.pts.map((p) => p.z); return [Math.min(...z), Math.max(...z)]; }).sort((a, c) => a[0]! - c[0]!);
    expect(zs[0]![0]).toBeCloseTo(4.5); expect(zs[0]![1]).toBeCloseTo(6.1);
    expect(zs[1]![0]).toBeCloseTo(7); expect(zs[1]![1]).toBeCloseTo(8.6);
  });

  it("plaza courtyard 11×16 east of the block", () => {
    expect(own).toContainEqual({ kind: "prism", at: { x: x + 11, y: y + 1, z: 0.3 }, w: 11, d: 16, h: 0.05, mat: "plaza" });
  });

  it("whitewash mast of h 7 with a flag attached to its east face and hullBlue stripe", () => {
    expect(mast).toBeDefined(); expect(mast!.h).toBe(7);
    expect(mast!.at.x).toBeCloseTo(x + 20); expect(mast!.at.y).toBeCloseTo(y + 14);
    expect(flag).toBeDefined();
    expect(flag!.at.x).toBeCloseTo(mast!.at.x + 0.2); expect(flag!.h).toBe(0.8); expect(flag!.at.z).toBeCloseTo(6);
    expect(flag!.at.y).toBeGreaterThanOrEqual(mast!.at.y); expect(flag!.at.y + flag!.d).toBeLessThanOrEqual(mast!.at.y + mast!.d + EPS);
    expect(flag!.plates?.some((p) => p.mat === "hullBlue" && p.shape === "rect" && near(p.z0, 6.27) && near(p.z1, 6.53))).toBe(true);
  });

  it("covered patio: copper roof 9×6 at z 3.5 on 4 concrete columns", () => {
    expect(roof).toBeDefined();
    expect(roof!.at).toEqual({ x: x + 12, y: y + 2, z: 3.5 }); expect(roof!.h).toBe(0.3);
    expect(columns).toHaveLength(4);
    for (const c of columns) {
      expect(c.at.z).toBeCloseTo(0.3); expect(c.at.z + c.h).toBeCloseTo(3.5);
      expect(c.at.x).toBeGreaterThanOrEqual(roof!.at.x); expect(c.at.x + c.w).toBeLessThanOrEqual(roof!.at.x + roof!.w + EPS);
      expect(c.at.y).toBeGreaterThanOrEqual(roof!.at.y); expect(c.at.y + c.d).toBeLessThanOrEqual(roof!.at.y + roof!.d + EPS);
    }
    expect(new Set(columns.map((c) => `${c.at.x},${c.at.y}`)).size).toBe(4);
  });

  it("sidewalk: two leaf trees r 1.4 h 4 and a street lamp", () => {
    expect(trees).toHaveLength(2);
    for (const t of trees) { expect(t.r).toBe(1.4); expect(t.h).toBe(4); expect(t.at.x).toBeCloseTo(x + 24.8); }
    expect(trees.map((t) => t.at.y - y).sort((a, c) => a - c)).toEqual([3, 15]);
    expect(lampPost).toHaveLength(1);
  });

  it("nothing overlaps: block ↔ towers, towers ↔ covered patio, mast ↔ covered patio, trees ↔ street lamp", () => {
    const covered = [roof!, ...columns];
    const pairs: [Solid, Solid][] = [
      ...towers.map((t): [Solid, Solid] => [block!, t]),
      ...towers.flatMap((t) => covered.map((c): [Solid, Solid] => [t, c])),
      ...[mast!, flag!].flatMap((m) => covered.map((c): [Solid, Solid] => [m, c])),
      ...trees.flatMap((t) => lampPost.map((l): [Solid, Solid] => [t, l])),
    ];
    for (const [p, q] of pairs) expect(apart(p, q), `${JSON.stringify(bounds(p))} × ${JSON.stringify(bounds(q))}`).toBe(true);
  });

  it("no pair of raised pieces overlaps (the paving and plaza floors do not count)", () => {
    const raised = own.filter((s) => !(isPrism(s) && (s.mat === "paving" || s.mat === "plaza") && s.h <= 0.3));
    for (let i = 0; i < raised.length; i++) for (let j = i + 1; j < raised.length; j++) expect(apart(raised[i]!, raised[j]!), `${JSON.stringify(bounds(raised[i]!))} × ${JSON.stringify(bounds(raised[j]!))}`).toBe(true);
  });

  it("within the face cap and nothing taller than 21.5", () => {
    expect(facesIn(everything, rect)).toBeLessThanOrEqual(FACE_CAPS.school);
    for (const s of own) expect(bounds(s).max.z).toBeLessThanOrEqual(21.5);
  });
});

describe("school: fixed geometry", () => {
  it("with another rng seed it gives exactly the same and does not consume the rng", () => {
    const a = newCtx(createRng(1)), c = newCtx(createRng(99));
    school(a, b); school(c, b);
    expect(JSON.stringify(a.solids)).toBe(JSON.stringify(c.solids));
    expect(JSON.stringify(a.accents)).toBe(JSON.stringify(c.accents));
    expect(JSON.stringify(a.homes)).toBe(JSON.stringify(c.homes));
    expect(a.rng.next()).toBe(createRng(1).next());
  });
});
