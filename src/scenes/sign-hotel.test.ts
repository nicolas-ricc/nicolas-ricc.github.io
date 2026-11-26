import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { chamferedRect } from "../kit/forms/composite";
import type { FixedLight } from "../city/lights";
import { SIDEWALK } from "./city-grid";
import { HOTEL_LOT } from "./city-plan";
import { HOTEL_BLOCK, HOTEL_CENTER, HOTEL_FACADE, HOTEL_ROOF, blockFootprint, hotel, hotelStandIn } from "./sign-hotel";

const EPS = 1e-6, CHAMFER = 2.4, FH = (HOTEL_ROOF - 0.4) / 14;

const built = () => { const out: Solid[] = [], accents: Accent[] = [], lights: FixedLight[] = []; const lit = hotel(out, accents, lights); return { out, accents, lights, lit }; };
const H = built();
const stand = (() => { const out: Solid[] = [], accents: Accent[] = []; hotelStandIn(out, accents); return { out, accents }; })();
/** The building's own solids: everything but the sign's glass panel (Task 3 deletes it) and what stands above the roof as sign. */
const poly = (s: Solid): s is Solid & { kind: "poly" } => s.kind === "poly";
const same = (a: readonly Vec2[], b: readonly Vec2[]) => a.length === b.length && a.every((p, i) => Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y) < EPS);

describe("sign-hotel: the block (#494)", () => {
  it("HOTEL_BLOCK is the lot minus the sidewalk, the roof is z 60, the center is the block's", () => {
    expect(HOTEL_BLOCK).toEqual({ x0: HOTEL_LOT.x + SIDEWALK, y0: HOTEL_LOT.y + SIDEWALK, x1: HOTEL_LOT.x + HOTEL_LOT.w - SIDEWALK, y1: HOTEL_LOT.y + HOTEL_LOT.d - SIDEWALK });
    expect(HOTEL_ROOF).toBe(60);
    expect(HOTEL_CENTER).toEqual({ x: (HOTEL_BLOCK.x0 + HOTEL_BLOCK.x1) / 2, y: (HOTEL_BLOCK.y0 + HOTEL_BLOCK.y1) / 2 });
  });

  it("blockFootprint is the chamfered rect of the block, displaced by d", () => {
    const { x0, y0, x1, y1 } = HOTEL_BLOCK;
    expect(blockFootprint()).toEqual(chamferedRect(x0, y0, x1 - x0, y1 - y0, CHAMFER));
    expect(blockFootprint({ x: 3, y: -2 })).toEqual(blockFootprint().map((p) => ({ x: p.x + 3, y: p.y - 2 })));
  });

  it("one plaster poly on the footprint from z 0 to the roof minus the cornice, with the facade", () => {
    const blocks = H.out.filter((s) => poly(s) && s.mat === "plaster" && s.z === 0);
    expect(blocks).toHaveLength(1);
    const b = blocks[0]! as Solid & { kind: "poly" };
    expect(same(b.footprint, blockFootprint())).toBe(true);
    expect(b.h).toBeCloseTo(HOTEL_ROOF - 0.4, 9);
    expect(b.facade).toEqual(HOTEL_FACADE);
    expect(HOTEL_FACADE).toEqual({ floors: 14, cols: 12, base: "portico" });
  });

  it("the crown cornice is an office poly on the footprint grown 0.3, z 59.6 to 60", () => {
    const { x0, y0, x1, y1 } = HOTEL_BLOCK, g = 0.3;
    const crown = H.out.filter((s) => poly(s) && s.mat === "office");
    expect(crown).toHaveLength(1);
    const c = crown[0]! as Solid & { kind: "poly" };
    expect(same(c.footprint, chamferedRect(x0 - g, y0 - g, x1 - x0 + 2 * g, y1 - y0 + 2 * g, CHAMFER))).toBe(true);
    expect(c.z).toBeCloseTo(HOTEL_ROOF - 0.4, 9);
    expect(c.z + c.h).toBeCloseTo(HOTEL_ROOF, 9);
  });

  it("no solid tops out between 10.5 and 59 but the block, and nothing sits at z 10", () => {
    const mid = H.out.filter((s) => s.mat !== "glass" /* the old sign panel, Task 3 deletes it */).filter((s) => { const t = bounds(s).max.z; return t > 10.5 && t < 59; });
    expect(mid.filter((s) => !(poly(s) && s.mat === "plaster" && s.z === 0))).toEqual([]);
    expect(H.out.filter((s) => poly(s) && Math.abs(bounds(s).min.z - 10) < EPS)).toEqual([]);
  });

  it("portico 0.6 × 8 × 6 with a stone lintel and two lamps, centered on the +x face", () => {
    const dark = H.out.filter((s) => s.mat === "officeDark" && bounds(s).min.z === 0 && bounds(s).max.z === 6);
    expect(dark).toHaveLength(1);
    const b = bounds(dark[0]!), cy = (HOTEL_BLOCK.y0 + HOTEL_BLOCK.y1) / 2;
    expect(b.min.x).toBeCloseTo(HOTEL_BLOCK.x1, 9);
    expect(b.max.x - b.min.x).toBeCloseTo(0.6, 9);
    expect(b.max.y - b.min.y).toBeCloseTo(8, 9);
    expect((b.min.y + b.max.y) / 2).toBeCloseTo(cy, 9);
    const lintel = H.out.filter((s) => s.mat === "stone");
    expect(lintel).toHaveLength(1);
    expect(bounds(lintel[0]!).min.z).toBe(6);
    expect(H.lights).toHaveLength(2);
    for (const l of H.lights) expect(Math.abs(l.at.y - cy)).toBeGreaterThan(4);
  });

  it("the machine room is an officeDark prism on the roof, inside the block and west of the lattice legs (x ≤ 110)", () => {
    const m = H.out.filter((s) => s.kind === "prism" && s.mat === "officeDark" && bounds(s).min.z === HOTEL_ROOF);
    expect(m).toHaveLength(1);
    const b = bounds(m[0]!);
    expect(b.max.x).toBeLessThanOrEqual(110);
    expect(b.min.x).toBeGreaterThan(HOTEL_BLOCK.x0); expect(b.max.y).toBeLessThan(HOTEL_BLOCK.y1); expect(b.min.y).toBeGreaterThan(HOTEL_BLOCK.y0);
  });

  it("no 45° anywhere: every poly edge is axis-aligned or the 2.4 chamfer", () => {
    for (const s of H.out) {
      if (!poly(s) || s.mat === "glass") continue; // the old sign's panel is Task 3's
      s.footprint.forEach((p, i) => {
        const q = s.footprint[(i + 1) % s.footprint.length]!, dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
        expect(dx < EPS || dy < EPS || Math.abs(Math.hypot(dx, dy) - CHAMFER * Math.SQRT2) < EPS, `${s.mat} ${JSON.stringify(p)}`).toBe(true);
      });
    }
  });

  it("rooms: 312 amber polys on the +x wall (x 125.5) or the +y wall (y 313.5), none on floor 0", () => {
    expect(H.lit.rooms).toHaveLength(312);
    for (const r of H.lit.rooms) {
      expect(r.kind === "poly" && r.color === "amber").toBe(true);
      if (r.kind !== "poly") continue;
      expect(r.pts.every((p) => Math.abs(p.x - HOTEL_BLOCK.x1) < 1e-3) || r.pts.every((p) => Math.abs(p.y - HOTEL_BLOCK.y1) < 1e-3)).toBe(true);
      expect(Math.min(...r.pts.map((p) => p.z))).toBeGreaterThanOrEqual(FH - 1e-6);
    }
  });

  it("paperWindow: 0.6 in front of the +x wall, on floor 7, at the smallest y of that floor's windows", () => {
    const w = H.lit.paperWindow;
    expect(w.x).toBeCloseTo(HOTEL_BLOCK.x1 + 0.6, 9);
    expect(w.z).toBeGreaterThan(7 * FH); expect(w.z).toBeLessThan(8 * FH);
    const row = H.lit.rooms.filter((r) => r.kind === "poly" && r.pts.every((p) => Math.abs(p.x - HOTEL_BLOCK.x1) < 1e-3 && p.z > 7 * FH && p.z < 8 * FH));
    expect(row).toHaveLength(12);
    const minY = Math.min(...row.map((r) => (r.kind === "poly" ? r.pts.reduce((s, p) => s + p.y, 0) / r.pts.length : 0)));
    expect(w.y).toBeCloseTo(minY, 6);
  });

  it("hotelStandIn builds the same building solids as hotel (no sign), displaced by −HOTEL_CENTER, with no facade", () => {
    const d = { x: -HOTEL_CENTER.x, y: -HOTEL_CENTER.y };
    const shift = (s: Solid): Solid => {
      if (s.kind === "poly") { const { facade: _f, ...r } = s; return { ...r, footprint: s.footprint.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) }; }
      if (s.kind === "prism") return { ...s, at: { ...s.at, x: s.at.x + d.x, y: s.at.y + d.y } };
      throw new Error(`unexpected ${s.kind} in the building`);
    };
    const building = H.out.slice(0, stand.out.length); // `body` pushes before the sign: the building is the leading solids
    expect(building.some((s) => s.mat === "glass")).toBe(false);
    expect(stand.out).toHaveLength(building.length);
    const key = (s: Solid) => JSON.stringify(s, (_k, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)); // float noise of the displacement
    expect(stand.out.map(key)).toEqual(building.map((s) => key(shift(s))));
    for (const s of stand.out) expect("facade" in s && s.facade !== undefined, `${s.kind} ${s.mat}`).toBe(false);
    expect(stand.accents).toEqual([]);
  });

  it("train rule: every solid of the hotel keeps y_min − 1.4·z_max ≥ 134.5", () => {
    for (const s of H.out) { const b = bounds(s); expect(b.min.y - 1.4 * b.max.z, `${s.kind} ${s.mat} ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(134.5 - 1e-9); }
  });

  it("every solid lies in HOTEL_LOT ± 0.5", () => {
    for (const s of H.out) {
      const b = bounds(s);
      expect(b.min.x, `${s.kind} ${s.mat}`).toBeGreaterThanOrEqual(HOTEL_LOT.x - 0.5);
      expect(b.max.x, `${s.kind} ${s.mat}`).toBeLessThanOrEqual(HOTEL_LOT.x + HOTEL_LOT.w + 0.5);
      expect(b.min.y, `${s.kind} ${s.mat}`).toBeGreaterThanOrEqual(HOTEL_LOT.y - 0.5);
      expect(b.max.y, `${s.kind} ${s.mat}`).toBeLessThanOrEqual(HOTEL_LOT.y + HOTEL_LOT.d + 0.5);
    }
  });
});
