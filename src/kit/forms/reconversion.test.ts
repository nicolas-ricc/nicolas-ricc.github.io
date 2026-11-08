import { describe, expect, it } from "vitest";
import { hides } from "../../iso/depth";
import { bounds, type Solid } from "../../iso/solids";
import { lightBox } from "../../city/lights";
import { createRng } from "../../map/seed";
import { LAB_LOTS, RECIPES, recipe } from "../index";
import { STYLES } from "../styles";
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

describe("vaultLoft", () => {
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
