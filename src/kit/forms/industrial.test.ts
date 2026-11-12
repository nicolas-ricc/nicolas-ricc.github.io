import { describe, expect, it } from "vitest";
import { v3 } from "../../iso/geometry";
import { shadeTone } from "../../iso/light";
import { bounds, type Bounds, type Solid } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { LAB_LOTS, RECIPES, recipe } from "../index";
import { STYLES } from "../styles";
import type { Lot } from "../types";
import { CONTAINER, CONTAINER_COLORS, STACK_HEIGHTS, containerColor, sawtooth, stackContainers, stackHeight } from "./industrial";

const LOTS: Lot[] = [
  { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 },
  { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 },
];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-9;
const ownLot = (name: string, extra: Partial<Lot> = {}): Lot => ({ ...LOTS[0]!, w: LAB_LOTS[name]!.w, d: LAB_LOTS[name]!.d, ...extra });
const topZ = (ss: Solid[]): number => Math.max(...ss.map((s) => bounds(s).max.z));
const plates = (s: Solid) => ("plates" in s && s.plates) || [];
/** Wall normals of a prism by plate index: 0 N, 1 E, 2 S, 3 W. */
const WALL_NORMAL = [v3(0, -1, 0), v3(1, 0, 0), v3(0, 1, 0), v3(-1, 0, 0)];

describe("industrial family: registry and style", () => {
  it("registers the eight recipes in order", () => {
    expect(RECIPES.filter((r) => r.family === "industrial").map((r) => r.name)).toEqual(["sawtoothHall", "sheetHall", "containerStack", "stockpile", "tankGroup", "quayCrane", "rtgGantry", "storeroom"]);
  });

  it("the industrial style of the issue", () => {
    expect(STYLES.industrial).toEqual({ id: "industrial", mat: "concrete", trim: "steel", roof: "sheetGreen", tone: 0, floorH: 4, window: "windowCool" });
  });

  it("own lots for the crane, the RTG and the storeroom", () => {
    expect(LAB_LOTS.quayCrane).toEqual({ w: 8, d: 8 });
    expect(LAB_LOTS.rtgGantry).toEqual({ w: 12, d: 18 });
    expect(LAB_LOTS.storeroom).toEqual({ w: 6, d: 5 });
  });
});

describe("sawtoothHall and sawtooth", () => {
  it("publishes windows and floor(w/4) teeth with their vertical face east and a glass plate at 30..90 % of the tooth", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("sawtoothHall")(lot, createRng(seed), STYLES.industrial);
      expect(p.windows.length).toBeGreaterThan(0);
      const body = p.solids.find((s) => s.kind === "prism" && !!s.facade);
      if (!body || body.kind !== "prism") throw new Error("no body");
      const teeth = p.solids.filter((s) => s.kind === "ramp");
      expect(teeth).toHaveLength(Math.floor(lot.w / 4));
      for (const t of teeth) {
        if (t.kind !== "ramp") continue;
        expect(t.dir).toBe("w");
        expect(t.w).toBeCloseTo(4, 9);
        expect(t.at.z).toBeCloseTo(body.at.z + body.h, 9);
        const g = plates(t).find((q) => q.mat === "glass");
        expect(g).toMatchObject({ wall: 1, shape: "rect" });
        expect(g!.z0).toBeCloseTo(t.at.z + 0.3 * t.h, 9);
        expect(g!.z1).toBeCloseTo(t.at.z + 0.9 * t.h, 9);
      }
    }
  });

  it("sawtooth pushes nothing on a rect narrower than one tooth", () => {
    const out: Solid[] = [];
    sawtooth(out, { x: 0, y: 0, w: 3, d: 10 }, 0, 6, 2, "sheetGreen", "glass");
    expect(out).toEqual([]);
    sawtooth(out, { x: 0, y: 0, w: 13, d: 10 }, 0, 6, 2, "sheetGreen", "glass");
    expect(out).toHaveLength(3);
  });
});

describe("sheetHall", () => {
  it("gable of corrugated sheet with ribs on the long walls (lit by the sun's side) and a 4-wide door on open[0]", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("sheetHall")(lot, createRng(seed), STYLES.industrial);
      const hall = p.solids.find((s) => s.kind === "prism" && s.roof === "gable");
      if (!hall || hall.kind !== "prism") throw new Error("no gable hall");
      expect(["sheetGreen", "sheetTeal"]).toContain(hall.mat);
      const long = hall.w >= hall.d ? [0, 2] : [3, 1];
      for (const wall of long) {
        const ribs = plates(hall).filter((q) => q.wall === wall && q.toneOffset !== -2);
        expect(ribs.length).toBeGreaterThanOrEqual(6);
        expect(ribs.some((q) => (q.toneOffset ?? 0) !== 0)).toBe(true);
        const lit = shadeTone(WALL_NORMAL[wall]!) === "lit";
        expect([...new Set(ribs.map((q) => q.toneOffset ?? 0))].sort()).toEqual(lit ? [0, 1] : [-1, 0]);
      }
      const side = ["n", "e", "s", "w"].indexOf(lot.open[0] ?? "s");
      const door = plates(hall).find((q) => q.toneOffset === -2);
      expect(door).toMatchObject({ wall: side, shape: "rect" });
      const len = side % 2 === 0 ? hall.w : hall.d;
      expect((door!.u1 - door!.u0) * len).toBeCloseTo(4, 9);
    }
  });

  it("the south wall is the lit one and the north wall is not", () => {
    expect(shadeTone(WALL_NORMAL[2]!)).toBe("lit");
    expect(shadeTone(WALL_NORMAL[0]!)).not.toBe("lit");
  });

  it("a lot narrower than 6 gets no ribs on its short walls but keeps the contract", () => {
    const lot: Lot = { x: 0, y: 0, w: 12, d: 5, z: 0, open: ["s"], maxH: 24 };
    const p = recipe("sheetHall")(lot, createRng(3), STYLES.industrial);
    const hall = p.solids.find((s) => s.kind === "prism" && s.roof === "gable")!;
    expect(plates(hall).filter((q) => q.wall === 1 || q.wall === 3)).toEqual([]);
  });
});

describe("containerStack and stackContainers", () => {
  it("container colors follow their weights over 2000 draws (±5 %)", () => {
    const rng = createRng(1), n = 2000, seen: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const m = containerColor(rng); seen[m] = (seen[m] ?? 0) + 1; }
    expect(CONTAINER_COLORS).toEqual([{ mat: "boxRust", weight: 30 }, { mat: "boxBlue", weight: 25 }, { mat: "boxGrey", weight: 20 }, { mat: "boxGreen", weight: 15 }, { mat: "boxOrange", weight: 10 }]);
    for (const { mat, weight } of CONTAINER_COLORS) expect(Math.abs((seen[mat] ?? 0) / n - weight / 100)).toBeLessThanOrEqual(0.05);
  });

  it("stack heights follow their weights over 2000 draws (±5 %) and never exceed 3 (budget cut of #328)", () => {
    const rng = createRng(2), n = 2000, seen: Record<number, number> = {};
    for (let i = 0; i < n; i++) { const h = stackHeight(rng); seen[h] = (seen[h] ?? 0) + 1; }
    expect(STACK_HEIGHTS).toEqual([{ n: 1, weight: 35 }, { n: 2, weight: 40 }, { n: 3, weight: 25 }]);
    expect(Object.keys(seen).map(Number).every((h) => h >= 1 && h <= 3)).toBe(true);
    for (const { n: h, weight } of STACK_HEIGHTS) expect(Math.abs((seen[h] ?? 0) / n - weight / 100)).toBeLessThanOrEqual(0.05);
  });

  it("stackContainers: n containers 6×2.4×2.6 stacked from at, each with a door on its end face", () => {
    expect(CONTAINER).toEqual({ len: 6, w: 2.4, h: 2.6 });
    for (const along of ["x", "y"] as const) {
      const s = stackContainers(v3(0, 0, 0.3), 3, along, createRng(5));
      expect(s).toHaveLength(3);
      s.forEach((c, k) => {
        if (c.kind !== "prism") throw new Error("not a prism");
        expect(c).toMatchObject(along === "x" ? { w: 6, d: 2.4, h: 2.6 } : { w: 2.4, d: 6, h: 2.6 });
        expect(c.at.z).toBeCloseTo(0.3 + k * 2.6, 9);
        expect(c.mat.startsWith("box")).toBe(true);
        expect(plates(c).filter((q) => q.toneOffset === -2 && q.wall === (along === "x" ? 1 : 2))).toHaveLength(1);
      });
    }
  });

  it("containerStack: stacks of 1..4 containers (≤ 3 with maxH 10), all of box materials", () => {
    for (const maxH of [24, 10]) for (const base of LOTS) for (const seed of SEEDS) {
      const p = recipe("containerStack")({ ...base, maxH }, createRng(seed), STYLES.industrial);
      const cols = new Map<string, number>();
      for (const s of p.solids) {
        if (s.kind !== "prism") continue;
        expect(s.mat.startsWith("box")).toBe(true);
        const key = `${s.at.x.toFixed(6)},${s.at.y.toFixed(6)}`;
        cols.set(key, (cols.get(key) ?? 0) + 1);
      }
      expect(cols.size).toBeGreaterThan(0);
      for (const n of cols.values()) expect(n).toBeLessThanOrEqual(maxH === 10 ? 3 : 4);
    }
  });
});

/** Groups of solids whose plan boxes lie within `gap` of each other. */
function groups(ss: Solid[], gap: number): Bounds[] {
  const boxes = ss.map(bounds), parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const near = (a: Bounds, b: Bounds) => a.min.x - gap < b.max.x && b.min.x - gap < a.max.x && a.min.y - gap < b.max.y && b.min.y - gap < a.max.y;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (near(boxes[i]!, boxes[j]!)) parent[find(i)] = find(j);
  const out = new Map<number, Bounds>();
  boxes.forEach((b, i) => {
    const r = find(i), g = out.get(r);
    out.set(r, g ? { min: v3(Math.min(g.min.x, b.min.x), Math.min(g.min.y, b.min.y), 0), max: v3(Math.max(g.max.x, b.max.x), Math.max(g.max.y, b.max.y), 0) } : b);
  });
  return [...out.values()];
}

describe("stockpile", () => {
  it("3..6 groups that do not touch", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("stockpile")(lot, createRng(seed), STYLES.industrial);
      const g = groups(p.solids, 0.5);
      expect(g.length).toBeGreaterThanOrEqual(3);
      expect(g.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("tankGroup", () => {
  it("1..3 steel or rust tanks r 3..5 in two halves around a ring r + 0.2 h 0.3 at mid height, a split ladder post, and a strip around them", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("tankGroup")(lot, createRng(seed), STYLES.industrial);
      const cyl = p.solids.filter((s) => s.kind === "cylinder");
      const rings = cyl.filter((s) => Math.abs(s.h - 0.3) < EPS);
      expect(rings.length).toBeGreaterThanOrEqual(1);
      expect(rings.length).toBeLessThanOrEqual(3);
      expect(cyl).toHaveLength(rings.length * 3);
      for (const ring of rings) {
        if (ring.kind !== "cylinder") continue;
        const r = ring.r - 0.2;
        const halves = cyl.filter((s) => s.kind === "cylinder" && s !== ring && s.at.x === ring.at.x && s.at.y === ring.at.y);
        expect(halves).toHaveLength(2);
        const [lower, upper] = halves.sort((a, b) => a.at.z - b.at.z);
        if (lower!.kind !== "cylinder" || upper!.kind !== "cylinder") throw new Error("not cylinders");
        expect(r).toBeGreaterThanOrEqual(3 - EPS);
        expect(r).toBeLessThanOrEqual(5 + EPS);
        expect(["steel", "rust"]).toContain(lower!.mat);
        expect(upper!.mat).toBe(lower!.mat);
        expect(lower!.r).toBeCloseTo(r, 9);
        expect(upper!.r).toBeCloseTo(r, 9);
        const H = 2 * (lower!.h + 0.15);
        expect(H).toBeGreaterThanOrEqual(4 - EPS);
        expect(H).toBeLessThanOrEqual(8 + EPS);
        expect(upper!.h).toBeCloseTo(lower!.h, 9);
        expect(lower!.at.z).toBeCloseTo(lot.z, 9);
        expect(ring.at.z).toBeCloseTo(lot.z + H / 2 - 0.15, 9);
        expect(upper!.at.z).toBeCloseTo(lot.z + H / 2 + 0.15, 9);
        // two 0.3 posts against the octagon's south flat, below and above the ring
        const posts = p.solids.filter((s): s is Extract<Solid, { kind: "prism" }> => s.kind === "prism" && s.w === 0.3 && s.d === 0.3 && Math.abs(s.at.x - (ring.at.x - 0.15)) < EPS);
        expect(posts).toHaveLength(2);
        for (const post of posts) expect(post.at.y).toBeCloseTo(ring.at.y + r * Math.cos(Math.PI / 8), 9);
        const [low, high] = posts.sort((a, b) => a.at.z - b.at.z);
        expect(low!.at.z).toBeCloseTo(lot.z, 9);
        expect(low!.h).toBeCloseTo(lower!.h, 9);
        expect(high!.at.z).toBeCloseTo(upper!.at.z, 9);
        expect(high!.h).toBeCloseTo(upper!.h, 9);
      }
      expect(p.solids.some((s) => s.kind === "strip")).toBe(true);
    }
  });
});

describe("quayCrane", () => {
  it("up to 18 with a single cyan light r 1; flattened to 10 under maxH 10", () => {
    for (const seed of SEEDS) {
      const lot = ownLot("quayCrane");
      const p = recipe("quayCrane")(lot, createRng(seed), STYLES.industrial);
      expect(topZ(p.solids)).toBeLessThanOrEqual(lot.z + 18 + EPS);
      expect(topZ(p.solids)).toBeGreaterThan(lot.z + 16);
      expect(p.accents).toHaveLength(1);
      expect(p.accents[0]).toMatchObject({ kind: "dot", color: "cyan", r: 1 });
      const low = recipe("quayCrane")({ ...lot, maxH: 10 }, createRng(seed), STYLES.industrial);
      expect(topZ(low.solids)).toBeLessThanOrEqual(lot.z + 10 + EPS);
    }
  });

  it("the cabin, mast, boom, stay and light housing interlock; legs and cross beams do not", () => {
    const p = recipe("quayCrane")(ownLot("quayCrane"), createRng(1), STYLES.industrial);
    const marked = p.solids.filter((s) => s.interlocks);
    expect(marked).toHaveLength(5);
    expect(marked.filter((s) => s.kind === "prism")).toHaveLength(3);
    expect(marked.filter((s) => s.kind === "beam")).toHaveLength(2);
    const unmarked = p.solids.filter((s) => !s.interlocks);
    expect(unmarked.filter((s) => s.kind === "prism")).toHaveLength(4);
    expect(unmarked.filter((s) => s.kind === "beam")).toHaveLength(2);
    expect(unmarked.filter((s) => s.kind === "strip")).toHaveLength(2);
  });

  it("the boom points to open[0], or west when open[0] is north", () => {
    const tipX = (open: Lot["open"]) => {
      const lot = ownLot("quayCrane", { open }), a = recipe("quayCrane")(lot, createRng(1), STYLES.industrial).accents[0]!;
      if (a.kind !== "dot") throw new Error("not a dot");
      return a.at.x - (lot.x + lot.w / 2);
    };
    expect(tipX(["e"])).toBeGreaterThan(1);
    expect(tipX(["w"])).toBeLessThan(-1);
    expect(tipX(["n"])).toBeLessThan(-1);
  });
});

describe("rtgGantry", () => {
  it("10 tall on four rust wheels r 0.6", () => {
    for (const seed of SEEDS) {
      const lot = ownLot("rtgGantry");
      const p = recipe("rtgGantry")(lot, createRng(seed), STYLES.industrial);
      expect(topZ(p.solids)).toBeCloseTo(lot.z + 10, 9);
      expect(p.solids.filter((s) => s.kind === "cylinder" && s.mat === "rust" && Math.abs(s.r - 0.6) < EPS)).toHaveLength(4);
    }
  });

  it("flattened to the cap under a low maxH", () => {
    const lot = ownLot("rtgGantry", { maxH: 8 });
    expect(topZ(recipe("rtgGantry")(lot, createRng(1), STYLES.industrial).solids)).toBeLessThanOrEqual(lot.z + 8 + EPS);
  });
});

describe("storeroom", () => {
  it("a 4×3×2.6 shed of sheetGreen or steel with a door", () => {
    for (const seed of SEEDS) {
      const p = recipe("storeroom")(ownLot("storeroom"), createRng(seed), STYLES.industrial);
      const shed = p.solids.find((s) => s.kind === "prism" && s.w === 4 && s.d === 3 && s.h === 2.6);
      expect(shed).toBeDefined();
      expect(["sheetGreen", "steel"]).toContain(shed!.mat);
      expect(plates(shed!).filter((q) => q.toneOffset === -2)).toHaveLength(1);
    }
  });
});
