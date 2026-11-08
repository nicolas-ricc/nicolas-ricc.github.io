import { describe, expect, it } from "vitest";
import { hides } from "../../iso/depth";
import { bounds, type Solid } from "../../iso/solids";
import { lightBox } from "../../city/lights";
import { v3 } from "../../iso/geometry";
import { createRng } from "../../map/seed";
import { LAB_LOTS, RECIPES, recipe } from "../index";
import { shiftTone } from "../piece";
import { STYLES } from "../styles";
import { frontFrame, plateWindows } from "./reconversion";
import type { Lot, Side } from "../types";

const LOTS: Lot[] = [
  { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 },
  { x: 0, y: 0, w: 24, d: 18, z: 0, open: ["s", "e"], maxH: 24 },
];
const FREIGHT_LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 10, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-9;
const NAMES = ["loftHall", "vaultLoft", "brewery", "sheetLoft", "derelictHall", "coveredMarket", "freightShed", "openDock"];
const plates = (s: Solid) => ("plates" in s && s.plates) || [];
const height = (s: Solid): number => { const b = bounds(s); return b.max.z - b.min.z; };
const WALL: Record<Side, number> = { n: 0, e: 1, s: 2, w: 3 };
/** The solid's box reaches the lot edge on `side`. */
const touches = (s: Solid, lot: Lot, side: Side): boolean => {
  const b = bounds(s);
  switch (side) {
    case "s": return b.max.y >= lot.y + lot.d - EPS;
    case "n": return b.min.y <= lot.y + EPS;
    case "e": return b.max.x >= lot.x + lot.w - EPS;
    case "w": return b.min.x <= lot.x + EPS;
  }
};
const isPillar = (s: Solid): boolean => s.kind === "prism" && s.mat === "steel" && Math.abs(s.w - 0.4) < 1e-6 && Math.abs(s.d - 0.4) < 1e-6;

describe("reconversion family: registry, styles and own lots", () => {
  it("registers the eight recipes in order", () => {
    expect(RECIPES.filter((r) => r.family === "reconversion").map((r) => r.name)).toEqual(NAMES);
  });

  it("the warehouses, freight and harbor styles of the issue", () => {
    expect(STYLES.warehouses).toEqual({ id: "warehouses", mat: "brick", trim: "steel", roof: "sheetGreen", tone: 0, floorH: 3.5, window: "windowWarm" });
    expect(STYLES.freight).toEqual({ id: "freight", mat: "sheetGreen", trim: "steel", roof: "sheetTeal", tone: 0, floorH: 3, window: "windowCool" });
    expect(STYLES.harbor).toEqual({ id: "harbor", mat: "brick", trim: "copper", roof: "sheetTeal", tone: 0, floorH: 3, window: "windowWarm" });
  });

  it("own 21×10 lots for the freight shed and the open dock", () => {
    expect(LAB_LOTS.freightShed).toEqual({ w: 21, d: 10 });
    expect(LAB_LOTS.openDock).toEqual({ w: 21, d: 10 });
  });
});

describe("loftHall", () => {
  it("publishes at least 4 windows on floor 2 from the teeth, none hidden by another solid of the piece, and a green terrace on the roof", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("loftHall")(lot, createRng(seed), STYLES.warehouses);
      const top = p.windows.filter((w) => w.floor === 2);
      expect(top.length).toBeGreaterThanOrEqual(4);
      for (const w of top) {
        const owner = p.solids[w.building]!;
        expect(owner.kind).toBe("ramp");
        expect(plates(owner).some((q) => q.mat === "glass")).toBe(true);
        const box = lightBox(w.pts);
        p.solids.forEach((s, i) => { if (i !== w.building) expect(hides(box, bounds(s))).toBe(false); });
      }
      const body = p.solids.find((s) => s.kind === "prism" && !!s.facade);
      if (!body || body.kind !== "prism") throw new Error("no body");
      expect(body.mat).toBe("brick");
      expect(body.facade).toMatchObject({ floors: 2, cols: Math.round(lot.w / 3.5), base: "glass" });
      const roof = body.at.z + body.h;
      expect(p.solids.some((s) => s.kind === "prism" && s.mat === "leafDark" && Math.abs(s.at.z - roof) < 1e-6)).toBe(true);
      expect(p.solids.some((s) => s.kind === "cone" && s.mat === "leaf" && s.at.z > roof)).toBe(true);
    }
  });
});

describe("frontFrame", () => {
  const lot: Lot = { x: 0, y: 0, w: 20, d: 10, z: 0, open: [], maxH: 24 };
  const at = (side: Side) => frontFrame({ ...lot, open: [side] });
  it("maps rect(0, 0, 2, 1) to the strip against the front edge on all four sides", () => {
    expect(at("s").rect(0, 0, 2, 1)).toEqual({ x: 0, y: 9, w: 2, d: 1 });
    expect(at("n").rect(0, 0, 2, 1)).toEqual({ x: 0, y: 0, w: 2, d: 1 });
    expect(at("e").rect(0, 0, 2, 1)).toEqual({ x: 19, y: 0, w: 1, d: 2 });
    expect(at("w").rect(0, 0, 2, 1)).toEqual({ x: 0, y: 0, w: 1, d: 2 });
  });

  it("falls back to the south and reports wall index, length and depth", () => {
    expect(frontFrame({ ...lot, open: [] })).toMatchObject({ side: "s", wall: 2, len: 20, depth: 10 });
    expect(at("e")).toMatchObject({ side: "e", wall: 1, len: 10, depth: 20 });
    expect(at("e").point(3, 2)).toEqual({ x: 18, y: 3 });
    expect(at("s").point(3, 2)).toEqual({ x: 3, y: 8 });
  });
});

describe("vaultLoft", () => {
  it("has a vault with the roof material, based on the body top, along the front's axis, and a deck sticking out 1 from the front wall", () => {
    for (const [open, axis] of [["s", "x"], ["n", "x"], ["e", "y"], ["w", "y"]] as const) for (const seed of SEEDS) {
      const lot: Lot = { ...LOTS[0]!, open: [open] };
      const p = recipe("vaultLoft")(lot, createRng(seed), STYLES.warehouses);
      const vault = p.solids.find((s) => s.kind === "vault");
      if (!vault || vault.kind !== "vault") throw new Error("no vault");
      expect(vault.mat).toBe("sheetGreen");
      expect(vault.axis).toBe(axis);
      expect(vault.len).toBeLessThanOrEqual(18);
      const body = p.solids.find((s) => s.kind === "prism" && plates(s).some((q) => q.mat === "glass"));
      if (!body || body.kind !== "prism") throw new Error("no body");
      expect(vault.at.z).toBeCloseTo(body.at.z + body.h, 9);
      const glass = plates(body).find((q) => q.mat === "glass")!;
      expect(glass.toneOffset).toBe(1);
      expect(glass.wall).toBe(WALL[open]);
      const deck = p.solids.find((s) => s.kind === "prism" && s.mat === "deck");
      if (!deck || deck.kind !== "prism") throw new Error("no deck");
      expect(deck.h).toBeCloseTo(0.3, 9);
      expect(deck.at.z).toBeCloseTo(lot.z + 2.5, 9);
      const db = bounds(deck), bb = bounds(body);
      const out = { s: db.max.y - bb.max.y, n: bb.min.y - db.min.y, e: db.max.x - bb.max.x, w: bb.min.x - db.min.x }[open];
      expect(out).toBeCloseTo(1, 9);
    }
  });

  it("has a vault and a glass plate on the open[0] wall", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("vaultLoft")(lot, createRng(seed), STYLES.warehouses);
      expect(p.solids.some((s) => s.kind === "vault")).toBe(true);
      const wall = WALL[lot.open[0]!];
      expect(p.solids.some((s) => s.kind === "prism" && plates(s).some((q) => q.mat === "glass" && q.wall === wall))).toBe(true);
    }
  });
});

describe("brewery", () => {
  it("publishes exactly two neon slots on open[0] at 2.4..3.6, 3..5 copper tanks and a garland", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("brewery")(lot, createRng(seed), STYLES.warehouses);
      expect(p.slots).toHaveLength(2);
      expect(p.slots.map((s) => s.shop).sort()).toEqual([0, 1]);
      for (const s of p.slots) {
        expect(s.kind).toBe("neon");
        expect(s.side).toBe(lot.open[0]);
        for (const q of s.pts) {
          expect(q.z - lot.z).toBeGreaterThanOrEqual(2.4 - 1e-6);
          expect(q.z - lot.z).toBeLessThanOrEqual(3.6 + 1e-6);
        }
      }
      const tanks = p.solids.filter((s) => s.kind === "cylinder" && s.mat === "copper");
      expect(tanks.length).toBeGreaterThanOrEqual(3);
      expect(tanks.length).toBeLessThanOrEqual(5);
      expect(p.accents.filter((a) => a.kind === "dot" && a.color === "amber").length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("brewery details", () => {
  it("has tanks with copper caps, a glass window strip, two steel posts, and the body in the back half", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("brewery")(lot, createRng(seed), STYLES.warehouses);
      const tanks = p.solids.filter((s) => s.kind === "cylinder" && s.mat === "copper");
      for (const t of tanks) {
        if (t.kind !== "cylinder") continue;
        expect(t.r).toBeCloseTo(1.2, 9);
        expect(t.h).toBeCloseTo(4.5, 9);
        expect(p.solids.some((s) => s.kind === "cone" && s.mat === "copper" && s.at.x === t.at.x && s.at.y === t.at.y && Math.abs(s.at.z - (t.at.z + 4.5)) < 1e-6)).toBe(true);
      }
      const glass = p.solids.filter((s) => s.kind === "prism" && s.mat === "glass");
      expect(glass).toHaveLength(1);
      const g = glass[0]!;
      if (g.kind !== "prism") throw new Error("no glass");
      expect(Math.min(g.w, g.d)).toBeCloseTo(0.3, 9);
      expect(g.h).toBeCloseTo(4, 9);
      const posts = p.solids.filter((s) => s.kind === "prism" && s.mat === "steel" && Math.abs(s.h - 3) < 1e-6);
      expect(posts).toHaveLength(2);
      const body = p.solids.find((s) => s.kind === "prism" && s.facade);
      if (!body || body.kind !== "prism") throw new Error("no body");
      expect(body.facade).toMatchObject({ floors: 1, cols: 3 });
      expect(body.d).toBeCloseTo(lot.d / 2, 9);
      expect(body.at.y).toBeCloseTo(lot.y, 9);
    }
  });

  it("puts the slots on the east face of the glass strip with open e", () => {
    const lot: Lot = { ...LOTS[0]!, open: ["e"] };
    const p = recipe("brewery")(lot, createRng(3), STYLES.warehouses);
    const g = p.solids.find((s) => s.kind === "prism" && s.mat === "glass")!;
    const face = bounds(g).max.x;
    expect(p.slots).toHaveLength(2);
    for (const s of p.slots) {
      expect(s.side).toBe("e");
      for (const q of s.pts) expect(q.x).toBeCloseTo(face, 9);
    }
  });
});

describe("derelictHall", () => {
  it("leaves 1..2 teeth missing with exposed steel beams in their place", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("derelictHall")(lot, createRng(seed), STYLES.warehouses);
      const ramps = p.solids.filter((s) => s.kind === "ramp");
      const ridges = p.solids.filter((s) => s.kind === "beam" && s.mat === "steel" && Math.abs(s.from.y - s.to.y) > 1e-6);
      expect(ridges.length).toBeGreaterThanOrEqual(1);
      expect(ridges.length).toBeLessThanOrEqual(2);
      expect(ramps.length + ridges.length).toBeGreaterThanOrEqual(4);
      expect(ramps.length + ridges.length).toBeLessThanOrEqual(5);
      for (const r of ridges) if (r.kind === "beam") expect(ramps.some((t) => t.kind === "ramp" && Math.abs(t.at.x + 4 - r.from.x) < 1e-6)).toBe(false);
      expect(p.windows).toEqual([]);
    }
  });

  it("grows 4..6 jungle cones of radius at most 2 inside the lot, no facade, body one tone darker than the piece", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("derelictHall")(lot, createRng(seed), STYLES.warehouses);
      const cones = p.solids.filter((s) => s.kind === "cone");
      expect(cones.length).toBeGreaterThanOrEqual(4);
      expect(cones.length).toBeLessThanOrEqual(6);
      for (const c of cones) {
        if (c.kind !== "cone") continue;
        expect(c.r).toBeLessThanOrEqual(2);
        const b = bounds(c);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + EPS);
        expect(b.max.z - lot.z).toBeLessThanOrEqual(Math.min(lot.maxH, 18) + EPS);
      }
      expect(p.solids.some((s) => s.kind === "prism" && !!s.facade)).toBe(false);
      const body = p.solids.find((s) => s.kind === "prism");
      expect(body?.tone).toBe(shiftTone(0, createRng(seed).int(-1, 1)) - 1);
    }
  });
});

describe("coveredMarket", () => {
  it("has no wall on open[0] (no solid 3 or taller touches that edge besides the pillars) and at least 6 stalls", () => {
    for (const lot of [...LOTS, { ...LOTS[0]!, open: ["e"] as Side[] }]) for (const seed of SEEDS) {
      const p = recipe("coveredMarket")(lot, createRng(seed), STYLES.warehouses);
      const side = lot.open[0]!;
      const edge = p.solids.filter((s) => touches(s, lot, side) && height(s) >= 3);
      expect(edge.length).toBeGreaterThanOrEqual(2);
      for (const s of edge) expect(isPillar(s)).toBe(true);
      const stalls = p.solids.filter((s) => s.kind === "prism" && Math.abs(s.h - 1.8) < 1e-6 && ["whitewash", "copper", "rust"].includes(s.mat));
      expect(stalls.length).toBeGreaterThanOrEqual(6);
      expect(stalls.length).toBeLessThanOrEqual(9);
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });
});

describe("coveredMarket details", () => {
  it("publishes floor-1 tooth windows from ramps, hidden by nothing, with awnings, garland, 6..9 stalls and everything inside the lot", () => {
    for (const lot of [...LOTS, { ...LOTS[0]!, open: ["e"] as Side[] }, { ...LOTS[0]!, open: [] as Side[] }]) for (const seed of SEEDS) {
      const p = recipe("coveredMarket")(lot, createRng(seed), STYLES.warehouses);
      expect(p.windows.length).toBeGreaterThanOrEqual(4);
      for (const w of p.windows) {
        expect(w.floor).toBe(1);
        expect(p.solids[w.building]!.kind).toBe("ramp");
        const box = lightBox(w.pts);
        p.solids.forEach((s, i) => { if (i !== w.building) expect(hides(box, bounds(s))).toBe(false); });
      }
      expect(p.solids.some((s) => s.kind === "ramp" && s.mat === "awning")).toBe(true);
      expect(p.accents.some((a) => a.kind === "dot")).toBe(true);
      const stalls = p.solids.filter((s) => s.kind === "prism" && Math.abs(s.h - 1.8) < 1e-6 && ["whitewash", "copper", "rust"].includes(s.mat));
      expect(stalls.length).toBeGreaterThanOrEqual(6);
      expect(stalls.length).toBeLessThanOrEqual(9);
    }
  });
});

describe("freightShed", () => {
  it("on a 21×10 lot: loading dock on the front, trucks perpendicular to it, everything inside the lot", () => {
    for (const seed of SEEDS) {
      const lot = FREIGHT_LOT, p = recipe("freightShed")(lot, createRng(seed), STYLES.freight);
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + EPS);
      }
      const dock = p.solids.find((s) => s.kind === "prism" && s.mat === "concrete" && Math.abs(s.h - 1.2) < 1e-6);
      if (!dock || dock.kind !== "prism") throw new Error("no dock");
      expect(dock.at.y + dock.d).toBeCloseTo(lot.y + lot.d, 9);
      expect(dock.d).toBeCloseTo(1.5, 9);
      const trucks = p.solids.filter((s) => s.kind === "prism" && Math.abs(s.h - 2.8) < 1e-6 && ["rust", "steel"].includes(s.mat));
      expect(trucks.length).toBeGreaterThanOrEqual(2);
      expect(trucks.length).toBeLessThanOrEqual(3);
      for (const t of trucks) if (t.kind === "prism") {
        expect(t.d).toBeCloseTo(6, 9); // long along y: perpendicular to a dock that runs along x
        expect(t.w).toBeCloseTo(2.4, 9);
        expect(t.at.y + t.d).toBeCloseTo(dock.at.y, 9); // tail against the dock
      }
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });
});

describe("openDock", () => {
  it("nothing taller than 3", () => {
    for (const lot of [FREIGHT_LOT, ...LOTS]) for (const seed of SEEDS) {
      const p = recipe("openDock")(lot, createRng(seed), STYLES.freight);
      for (const s of p.solids) expect(bounds(s).max.z).toBeLessThanOrEqual(lot.z + 3 + EPS);
    }
  });
});

describe("sheetLoft", () => {
  it("is a sheet gable with ribs, 3 glass plates of 2.5 per long wall and windows from exactly those", () => {
    for (const lot of LOTS) for (const seed of SEEDS) {
      const p = recipe("sheetLoft")(lot, createRng(seed), STYLES.warehouses);
      const hall = p.solids[0]!;
      if (hall.kind !== "prism") throw new Error("no prism");
      expect(hall.roof).toBe("gable");
      expect(["sheetGreen", "sheetTeal"]).toContain(hall.mat);
      const walls = lot.w >= lot.d ? [0, 2] : [3, 1];
      const len = lot.w >= lot.d ? lot.w : lot.d;
      for (const wall of walls) {
        const on = plates(hall).filter((q) => q.wall === wall);
        expect(on.filter((q) => q.mat === hall.mat).length).toBeGreaterThanOrEqual(6);
        const glass = on.filter((q) => q.mat === "glass");
        expect(glass).toHaveLength(3);
        glass.forEach((q, k) => {
          expect((q.u1 - q.u0) * len).toBeCloseTo(2.5, 9);
          expect((q.u0 + q.u1) / 2).toBeCloseTo((k + 0.5) / 3, 9);
          expect(q.z0).toBeCloseTo(lot.z + 1, 9);
          expect(q.z1).toBeLessThanOrEqual(lot.z + 4.5 + EPS);
        });
      }
      const expected = plates(hall).filter((q) => q.mat === "glass" && (q.wall === 1 || q.wall === 2)).flatMap((q) => plateWindows(hall, q, 1, 0));
      expect(p.windows).toEqual(expected);
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });
});

describe("plateWindows", () => {
  const plate = { wall: 2, shape: "rect" as const, u0: 0.2, u1: 0.4, z0: 1, z1: 2, mat: "glass" as const };
  it("puts the window on the plate's wall edge, outward normal", () => {
    const [w] = plateWindows({ at: v3(0, 0, 0), w: 10, d: 4 }, plate, 2, 5);
    expect(w!.pts).toEqual([v3(8, 4, 1), v3(6, 4, 1), v3(6, 4, 2), v3(8, 4, 2)]);
    expect(w!.wall).toEqual(v3(0, 1, 0));
    expect(w!.floor).toBe(2);
    expect(w!.building).toBe(5);
  });

  it("splits into panes 0.2 apart that do not overlap", () => {
    const ws = plateWindows({ at: v3(0, 0, 0), w: 10, d: 4 }, plate, 1, 0, 2);
    expect(ws).toHaveLength(2);
    const span = (i: number) => [ws[i]!.pts[0]!.x, ws[i]!.pts[1]!.x];
    expect(span(0)[1]).toBeGreaterThan(span(1)[0]!); // x decreases along wall 2
    expect(span(0)[0]! - span(0)[1]! + (span(1)[0]! - span(1)[1]!)).toBeCloseTo(0.2 * 10 - 0.2, 9);
    expect(span(0)[1]! - span(1)[0]!).toBeCloseTo(0.2, 9);
  });
});

/** Plan box of a solid. */
const plan = (s: Solid) => { const b = bounds(s); return { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y }; };
const overlap = (a: Solid, b: Solid): boolean => {
  const p = plan(a), q = plan(b);
  return p.x0 < q.x1 - EPS && q.x0 < p.x1 - EPS && p.y0 < q.y1 - EPS && q.y0 < p.y1 - EPS;
};
const isTruckBox = (s: Solid): boolean => s.kind === "prism" && Math.abs(s.h - 2.8) < 1e-6 && ["rust", "steel"].includes(s.mat);
const isCab = (s: Solid): boolean => s.kind === "prism" && Math.abs(s.h - 2.2) < 1e-6 && s.mat === "steel";

describe("freightShed details", () => {
  it("cabin 2×2.4×2.2 steel behind each truck box, aligned; one gable shed with 2 glass plates of 1.5 per long wall", () => {
    for (const seed of SEEDS) {
      const p = recipe("freightShed")(FREIGHT_LOT, createRng(seed), STYLES.freight);
      const trucks = p.solids.filter(isTruckBox), cabs = p.solids.filter(isCab);
      expect(cabs).toHaveLength(trucks.length);
      for (const t of trucks) {
        if (t.kind !== "prism") throw new Error("no prism");
        const c = cabs.find((q) => q.kind === "prism" && Math.abs(q.at.x - t.at.x) < EPS);
        if (!c || c.kind !== "prism") throw new Error("no cab");
        expect(c.w).toBeCloseTo(2.4, 9);
        expect(c.d).toBeCloseTo(2, 9);
        expect(c.at.y + c.d).toBeCloseTo(t.at.y, 9);
      }
      const sheds = p.solids.filter((s) => s.kind === "prism" && s.roof === "gable");
      expect(sheds).toHaveLength(1);
      const shed = sheds[0]!;
      if (shed.kind !== "prism") throw new Error("no prism");
      for (const wall of shed.w >= shed.d ? [0, 2] : [3, 1]) {
        const glass = plates(shed).filter((q) => q.wall === wall && q.mat === "glass");
        expect(glass).toHaveLength(2);
        for (const q of glass) expect((q.u1 - q.u0) * Math.max(shed.w, shed.d)).toBeCloseTo(1.5, 9);
      }
      const pallets = p.solids.filter((s) => s.kind === "prism" && s.mat === "deck");
      expect(pallets.length).toBeGreaterThanOrEqual(2);
      expect(pallets.length).toBeLessThanOrEqual(4);
    }
  });

  it("dock, shed, trucks and pallets do not overlap in plan on larger lots and all four fronts", () => {
    const sizes = [{ w: 21, d: 15 }, { w: 24, d: 18 }];
    for (const size of sizes) for (const side of ["s", "e", "n", "w"] as const) for (const seed of SEEDS) {
      const lot: Lot = { x: 1.5, y: 1.5, ...size, z: 0, open: [side], maxH: 24 };
      const p = recipe("freightShed")(lot, createRng(seed), STYLES.freight);
      const body = p.solids.filter((s) => (s.kind === "prism" && s.roof === "gable") || isTruckBox(s) || isCab(s) || (s.kind === "prism" && s.mat === "concrete"));
      for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) expect(overlap(body[i]!, body[j]!)).toBe(false);
      const pallets = p.solids.filter((s) => s.kind === "prism" && s.mat === "deck");
      for (const a of pallets) for (const b of body) if (!(b.kind === "prism" && b.mat === "concrete")) expect(overlap(a, b)).toBe(false);
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + EPS);
        for (const q of plates(s)) { expect(q.u0).toBeGreaterThanOrEqual(0); expect(q.u1).toBeLessThanOrEqual(1); expect(q.u0).toBeLessThan(q.u1); }
      }
      expect(p.windows.length).toBeGreaterThan(0);
    }
  });
});

describe("openDock details", () => {
  it("2..3 containers, one forklift 2×3×2, 3 fence runs none on the front edge, no overlaps in plan", () => {
    for (const side of ["s", "e", "n", "w"] as const) for (const lot0 of [FREIGHT_LOT, ...LOTS]) for (const seed of SEEDS) {
      const lot: Lot = { ...lot0, open: [side] };
      if ((side === "e" || side === "w" ? lot.d : lot.w) < 13) continue; // two containers need 13 along the front
      const p = recipe("openDock")(lot, createRng(seed), STYLES.freight);
      const boxes = p.solids.filter((s) => s.kind === "prism" && s.mat.startsWith("box"));
      expect(boxes.length).toBeGreaterThanOrEqual(2);
      expect(boxes.length).toBeLessThanOrEqual(3);
      const forks = p.solids.filter((s) => s.kind === "prism" && s.mat === "rust");
      expect(forks).toHaveLength(1);
      const fk = forks[0]!;
      if (fk.kind !== "prism") throw new Error("no prism");
      expect([fk.w, fk.d].sort()).toEqual([2, 3]);
      expect(fk.h).toBeCloseTo(2, 9);
      const fence = p.solids.filter((s) => s.kind === "prism" && s.mat === "officeDark" && Math.abs(s.h - 1.2) < 1e-6);
      expect(fence).toHaveLength(3);
      for (const f of fence) { // a run ON the front edge would be thin across it and span the lot along it; the side runs only end there
        const b = bounds(f), across = side === "n" || side === "s" ? b.max.y - b.min.y : b.max.x - b.min.x;
        if (touches(f, lot, side)) expect(across).toBeGreaterThan(0.3 + EPS);
      }
      const shed = p.solids.filter((s) => s.kind === "prism" && s.h > 2.5 && (s.mat === "sheetGreen" || s.mat === "steel"));
      expect(shed).toHaveLength(1);
      const things = [...boxes, ...shed, fk];
      for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) expect(overlap(things[i]!, things[j]!), `${side} ${lot.w}x${lot.d} s${seed} ${JSON.stringify([plan(things[i]!), plan(things[j]!)])}`).toBe(false);
      for (const s of p.solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(lot.x - EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(lot.y - EPS);
        expect(b.max.x).toBeLessThanOrEqual(lot.x + lot.w + EPS);
        expect(b.max.y).toBeLessThanOrEqual(lot.y + lot.d + EPS);
      }
    }
  });
});
