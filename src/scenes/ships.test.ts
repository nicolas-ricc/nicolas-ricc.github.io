import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sortByDepth } from "../iso/depth";
import { bounds, isFlat, tessellateAll, type Solid } from "../iso/solids";
import { SHIP_MATS, SHIP_SPECS, ship, shipAt, wake, type ShipKind } from "./ships";

const KINDS: ShipKind[] = ["cargo", "tug", "barge", "ferry"];
const centerXY = (x: Solid): [number, number] => { const b = bounds(x); return [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2]; };

describe("ships", () => {
  it("each ship: hull with topMat and sheer, ≤ 40 solids, ≤ 8 lights, everything inside the hull box (margin 2) and above the deck", () => {
    for (const kind of KINDS) {
      const s = ship(kind, { x: 100, y: 100 }, 0), spec = SHIP_SPECS[kind];
      const hull = s.solids.find((x) => x.kind === "hull")!;
      expect(hull).toMatchObject({ len: spec.len, beam: spec.beam, h: spec.h, sheer: spec.sheer, topMat: spec.topMat, mat: "hull", at: { x: 100, y: 100, z: -1 } });
      expect(s.solids.length).toBeLessThanOrEqual(40); expect(s.lights.length).toBeLessThanOrEqual(8);
      const x0 = kind === "barge" ? 100 - 20 : 100; // the pusher goes behind the barge
      for (const x of s.solids) {
        const b = bounds(x);
        expect(b.min.x).toBeGreaterThanOrEqual(x0 - 2); expect(b.max.x).toBeLessThanOrEqual(100 + spec.len + 2);
        expect(b.min.y).toBeGreaterThanOrEqual(100 - spec.beam / 2 - 2); expect(b.max.y).toBeLessThanOrEqual(100 + spec.beam / 2 + 2);
        // the rubber (fenders, pudding) hangs from the side; in barge, the blocks that square off the hulls (top ≤ pusher deck) go down to the water
        const filler = kind === "barge" && b.max.z <= 0.66;
        if (x.kind !== "hull" && !filler && x.mat !== "asphalt") expect(b.min.z).toBeGreaterThanOrEqual(-1 + spec.h - 0.01);
        expect(SHIP_MATS).toContain(x.mat);
        expect(isFlat(x)).toBe(false);
      }
    }
  });
  it("shipAt: the center of the unit (barge + pusher included) falls on the requested point, for any heading", () => {
    for (const kind of KINDS) for (const h of [0, Math.PI / 2, 2.3, -0.7]) {
      const c = { x: 400, y: 100 }, at = shipAt(kind, c, h);
      // unit ends = stern and bow of each hull (in barge: pusher and barge), projected onto the ship's axis
      const along = ship(kind, at, h).solids.flatMap((s) => (s.kind === "hull" ? [0, s.len].map((dx) => (s.at.x + dx * Math.cos(h) - c.x) * Math.cos(h) + (s.at.y + dx * Math.sin(h) - c.y) * Math.sin(h)) : []));
      expect(Math.max(...along) + Math.min(...along)).toBeCloseTo(0, 6);
    }
    expect(shipAt("barge", { x: 0, y: 0 }, 0)).toEqual({ x: -10, y: 0 });
    expect(shipAt("cargo", { x: 0, y: 0 }, 0)).toEqual({ x: -30, y: 0 });
  });
  it("tug: hull of the ASD Tug 2810 (28.7 × 10.4 m → 19 × 7 u) with asphalt rubber among the materials", () => {
    expect(SHIP_SPECS.tug).toEqual({ len: 19, beam: 7, h: 2.2, sheer: 0.3, topMat: "hullBlue" });
    expect(SHIP_MATS).toContain("asphalt");
  });
  it("ASD 2810 tug: glass wheelhouse forward of the midpoint over a wider deckhouse, two side funnels behind, mast as the highest point (≤ z 13), two rafts on the roof", () => {
    const s = ship("tug", { x: 0, y: 0 }, 0);
    const polys = s.solids.filter((x) => x.kind === "poly");
    const wheel = polys.find((x) => x.facade?.base === "glass")!;
    const house = polys.find((x) => x.mat === "whitewash" && x.facade && x.facade.base !== "glass")!;
    const wb = bounds(wheel), hb = bounds(house);
    expect(wheel.mat).toBe("whitewash");
    expect(wb.min.x).toBeGreaterThan(SHIP_SPECS.tug.len / 2); // forward of the midpoint
    expect(wb.min.z).toBeCloseTo(hb.max.z, 6); // resting on the deckhouse
    expect(hb.max.y - hb.min.y).toBeGreaterThan(wb.max.y - wb.min.y); // wider deckhouse
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h === 2.7);
    expect(stacks).toHaveLength(2);
    expect(stacks.map((x) => Math.sign(bounds(x).min.y + bounds(x).max.y)).sort()).toEqual([-1, 1]); // one per side
    for (const c of stacks) expect(bounds(c).max.x).toBeLessThanOrEqual(wb.min.x); // behind the wheelhouse
    const top = Math.max(...s.solids.map((x) => bounds(x).max.z));
    expect(top).toBeLessThanOrEqual(13);
    expect(top).toBeGreaterThan(wb.max.z + 3); // the mast stands above the wheelhouse
    const rafts = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "whitewash");
    expect(rafts).toHaveLength(2);
    for (const r of rafts) expect(bounds(r).min.z).toBeGreaterThanOrEqual(wb.max.z);
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
  });
  it("ASD 2810 tug: winch and bitts forward, solid pudding at the stem, fenders on both sides, bow and stern corners; rotates with the heading", () => {
    const s = ship("tug", { x: 0, y: 0 }, 0), { len, beam } = SHIP_SPECS.tug;
    const rubber = s.solids.filter((x) => x.mat === "asphalt").map(bounds);
    expect(rubber.some((b) => b.min.y <= -beam / 2 && b.max.x - b.min.x >= 5)).toBe(true); // port rail
    expect(rubber.some((b) => b.max.y >= beam / 2 && b.max.x - b.min.x >= 5)).toBe(true); // starboard rail
    expect(rubber.filter((b) => b.max.x >= len - 1)).not.toHaveLength(0); // pudding at the stem
    expect(rubber.filter((b) => b.max.x <= 2)).toHaveLength(2); // stern corner cylinders
    const winch = s.solids.find((x) => x.kind === "cylinder" && x.mat === "steel" && x.r === 0.6)!;
    expect(bounds(winch).min.x).toBeGreaterThan(14); // forward of the deckhouse
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h <= 0.6).length).toBeGreaterThanOrEqual(3); // bitts
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue")).toHaveLength(2); // bow bulwark
    expect(s.solids.length).toBeLessThanOrEqual(40); expect(s.lights.length).toBeLessThanOrEqual(8);
    const south = ship("tug", { x: 100, y: 100 }, Math.PI / 2);
    expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(100 + len, 6); // the tip of the pudding is the stem
  });
  it("Tigre shared launch: wooden hull of 15 × 4 u, a single cabin with continuous windows of two thirds of the length, light canopy with eave, open stern and fenders; nothing above z 5", () => {
    expect(SHIP_SPECS.ferry).toEqual({ len: 15, beam: 4, h: 1.2, sheer: 0.3, topMat: "deck" });
    const ferry = ship("ferry", { x: 0, y: 0 }, 0), { len } = SHIP_SPECS.ferry;
    const cabins = ferry.solids.filter((x) => x.kind === "poly" && x.facade);
    expect(cabins).toHaveLength(1);
    const cabin = cabins[0]!, cb = bounds(cabin);
    expect(cabin.mat).toBe("deck"); // varnished wood, not a white superstructure
    expect(cabin.kind === "poly" && cabin.facade?.base).toBe("glass");
    expect(cb.max.x - cb.min.x).toBeGreaterThanOrEqual(len * 0.6);
    expect(cb.min.x).toBeGreaterThanOrEqual(3); // open stern behind the cabin
    const roof = ferry.solids.find((x) => x.kind === "poly" && x.mat === "whitewash" && Math.abs(bounds(x).min.z - cb.max.z) < 1e-6)!;
    const rb = bounds(roof);
    expect(rb.min.x).toBeLessThan(cb.min.x); expect(rb.max.x).toBeGreaterThan(cb.max.x); // eave
    expect(rb.min.y).toBeLessThan(cb.min.y); expect(rb.max.y).toBeGreaterThan(cb.max.y);
    expect(ferry.solids.filter((x) => x.mat === "asphalt")).toHaveLength(3); // fenders
    expect(ferry.solids.filter((x) => x.kind === "poly" && x.mat === "deck" && !x.facade)).toHaveLength(2); // stern railings
    expect(Math.max(...ferry.solids.map((x) => bounds(x).max.z))).toBeLessThanOrEqual(5);
    expect(ferry.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(ferry.lights.some((l) => l.color === "amber")).toBe(true);
    expect(ferry.lights.some((l) => l.kind === "poly" && l.color === "amberBleed")).toBe(true); // lit windows, warm and not neon
  });
  it("the wake is 17 triangles behind and beside the hull, with the bow wave lighter", () => {
    for (const kind of KINDS) {
      const w = wake(kind, { x: 0, y: 0 }, 0);
      expect(w).toHaveLength(17);
      expect(w.filter((t) => t.toneOffset === 1).length).toBeGreaterThanOrEqual(2);
      for (const t of w) for (const p of t.pts) { expect(p.z).toBeCloseTo(-0.95, 6); expect(p.x).toBeLessThanOrEqual(SHIP_SPECS[kind].len + 0.01); }
    }
  });
  it("barge: the V and the swirl start behind the pusher (stern at −20)", () => {
    const w = wake("barge", { x: 0, y: 0 }, 0);
    for (const t of w.slice(-3)) { expect(t.pts[0]!.x).toBeCloseTo(-20, 6); expect(t.pts[0]!.y).toBeCloseTo(0, 6); }
    expect(Math.min(...w.flatMap((t) => t.pts.map((p) => p.x)))).toBeCloseTo(-36, 6);
  });
});

describe("barge: three-deck pusher with Jumbo hopper barge", () => {
  const s = ship("barge", { x: 0, y: 0 }, 0), b = s.solids.map(bounds);
  const near = (a: number, c: number) => Math.abs(a - c) < 1e-6;
  it("60 × 8 u unit, nothing above z 13: 40 × 8 barge (h 1.2, no sheer) and 20 × 7 pusher at dx −20, no containers", () => {
    expect(SHIP_SPECS.barge).toEqual({ len: 40, beam: 8, h: 1.2, sheer: 0, topMat: "rust" });
    const hulls = s.solids.filter((x) => x.kind === "hull");
    expect(hulls).toHaveLength(2);
    expect(hulls[1]).toMatchObject({ at: { x: -20, y: 0, z: -1 }, len: 20, beam: 7, h: 1.6, sheer: 0 });
    expect(Math.min(...b.map((x) => x.min.x))).toBeCloseTo(-20, 6); expect(Math.max(...b.map((x) => x.max.x))).toBeCloseTo(40, 6);
    expect(Math.max(...b.map((x) => Math.max(-x.min.y, x.max.y)))).toBeLessThanOrEqual(4 + 1e-9);
    expect(Math.max(...b.map((x) => x.max.z))).toBeLessThanOrEqual(13);
    expect(s.solids.some((x, i) => x.kind === "poly" && b[i]!.min.x >= 0 && x.h >= 2)).toBe(false); // no containers on the barge
  });
  it("barge bow squared off up to the head (rake) and pusher bow squared off", () => {
    expect(b.some((x) => x.max.x > 40 - 1e-6 && near(x.max.z, 0.25) && x.max.y - x.min.y > 7.9)).toBe(true);
    expect(b.some((x) => near(x.max.x, 0) && x.min.x < -5 && near(x.max.z, 0.65) && x.max.y - x.min.y > 6.9)).toBe(true);
  });
  it("barge: perimeter coaming, four domed covers inside it and bitts at the four corners", () => {
    const coaming = s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && near(x.z, 0.25) && near(x.h, 0.9)).map(bounds);
    expect(coaming).toHaveLength(4);
    expect(Math.min(...coaming.map((x) => x.min.x))).toBeCloseTo(3, 6); expect(Math.max(...coaming.map((x) => x.max.x))).toBeCloseTo(34.2, 6);
    expect(Math.min(...coaming.map((x) => x.min.y))).toBeCloseTo(-3.6, 6); expect(Math.max(...coaming.map((x) => x.max.y))).toBeCloseTo(3.6, 6);
    const lids = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, 1.15)).map(bounds);
    const crests = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, 1.55)).map(bounds);
    expect(lids).toHaveLength(4); expect(crests).toHaveLength(4);
    for (const l of lids) { expect(l.min.x).toBeGreaterThanOrEqual(3); expect(l.max.x).toBeLessThanOrEqual(34.2); }
    for (const c of crests) {
      const l = lids.find((x) => x.min.x < c.min.x && x.max.x > c.max.x); // each crest over its base, narrower: dome
      expect(l).toBeDefined(); expect(c.min.y).toBeGreaterThan(l!.min.y); expect(c.max.y).toBeLessThan(l!.max.y);
    }
    expect(Math.max(...b.filter((x) => x.min.x >= 0).map((x) => x.max.z))).toBeCloseTo(1.85, 6);
    const bitts = b.filter((x, i) => s.solids[i]!.kind === "cylinder" && x.min.x >= 0);
    expect(bitts).toHaveLength(4);
    expect(new Set(bitts.map((x) => `${(x.min.x + x.max.x) / 2 > 20}${x.min.y + x.max.y > 0}`)).size).toBe(4);
  });
  it("pusher: two push knees forward above the barge, stepped three-level tower with glazed wheelhouse, two funnels aft of the tower, mast, boat and railings", () => {
    const bargeTop = Math.max(...b.filter((x) => x.min.x >= 0).map((x) => x.max.z));
    const knees = b.filter((x, i) => { const p = s.solids[i]!; return p.kind === "poly" && p.mat === "whitewash" && !p.facade && x.min.x >= -1.5 && x.max.x <= 1e-9; });
    expect(knees).toHaveLength(2);
    for (const kn of knees) expect(kn.max.z).toBeGreaterThan(bargeTop);
    const tower = s.solids.flatMap((x) => (x.kind === "poly" && x.mat === "whitewash" && x.facade ? [x] : [])).sort((p, q) => p.z - q.z);
    expect(tower).toHaveLength(3);
    const area = (x: Solid) => { const t = bounds(x); return (t.max.x - t.min.x) * (t.max.y - t.min.y); };
    for (let i = 1; i < 3; i++) { expect(tower[i]!.z).toBeCloseTo(tower[i - 1]!.z + tower[i - 1]!.h, 6); expect(area(tower[i]!)).toBeLessThan(area(tower[i - 1]!)); }
    expect(tower[2]!.facade?.base).toBe("glass");
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && x.mat === "whitewash").map(bounds);
    expect(stacks).toHaveLength(2);
    for (const st of stacks) expect(st.max.x).toBeLessThanOrEqual(bounds(tower[1]!).min.x + 1e-9);
    expect(stacks[0]!.min.y * stacks[1]!.min.y).toBeLessThan(0); // one per side
    expect(Math.max(...b.map((x) => x.max.z))).toBeCloseTo(8.2, 6); // mast over the wheelhouse
    const roof1 = tower[0]!.z + tower[0]!.h;
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && near(x.z, roof1))).toHaveLength(3); // boat and two railings
  });
  it("lights: masthead, port and starboard first; two amber searchlights and lit windows in the wheelhouse; ≤ 8", () => {
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.filter((l) => l.color === "amber")).toHaveLength(2);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
    expect(s.lights.length).toBeLessThanOrEqual(8);
  });
});

describe("freighter (Damen Combi Freighter 3850)", () => {
  const s = ship("cargo", { x: 0, y: 0 }, 0);
  it("house and bridge aft: the pieces with a facade stay in the last third; bridge with wings to the beam; exhausts behind the bridge; nothing above z 13", () => {
    const faced = s.solids.filter((x) => x.kind === "poly" && x.facade);
    expect(faced.length).toBeGreaterThanOrEqual(4);
    for (const x of faced) expect(bounds(x).max.x).toBeLessThanOrEqual(60 / 3);
    const bridge = bounds(faced.find((x) => x.kind === "poly" && x.facade?.base === "glass")!);
    expect(bridge.min.y).toBeCloseTo(-5, 6); expect(bridge.max.y).toBeCloseTo(5, 6);
    const stacks = s.solids.filter((x) => x.kind === "cylinder" && bounds(x).max.x <= bridge.min.x);
    expect(stacks).toHaveLength(2);
    expect(Math.max(...s.solids.map((x) => bounds(x).max.z))).toBeLessThanOrEqual(13);
    expect(s.lights.slice(0, 3).map((l) => l.color)).toEqual(["magentaMid", "magenta", "cyanMid"]);
    expect(s.lights.some((l) => l.kind === "poly" && l.color === "magentaBleed")).toBe(true);
    const south = ship("cargo", { x: 100, y: 100 }, Math.PI / 2);
    expect(Math.max(...south.solids.map((x) => bounds(x).max.y))).toBeCloseTo(160, 6);
  });
  it("single hold: long rust coaming with three flat covers on top, between the house and the forecastle", () => {
    const coaming = s.solids.filter((x) => x.kind === "poly" && x.mat === "rust" && x.h === 1);
    expect(coaming).toHaveLength(1);
    const cb = bounds(coaming[0]!);
    expect(cb.max.x - cb.min.x).toBeGreaterThanOrEqual(30); expect(cb.min.x).toBeGreaterThanOrEqual(12); expect(cb.max.x).toBeLessThanOrEqual(50);
    const covers = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && Math.abs(x.z - cb.max.z) < 1e-6);
    expect(covers).toHaveLength(3);
    for (const c of covers) { const b = bounds(c); expect(b.min.x).toBeGreaterThanOrEqual(cb.min.x); expect(b.max.x).toBeLessThanOrEqual(cb.max.x); expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.5); }
  });
  it("two cranes to port: pedestal, cab, single-beam boom at 45° toward the bow and a thin stay from the cab to the tip", () => {
    const pedestals = s.solids.flatMap((x) => (x.kind === "cylinder" && x.r === 0.5 && x.h === 3 ? [x] : []));
    expect(pedestals).toHaveLength(2);
    const beams = s.solids.flatMap((x) => (x.kind === "beam" ? [x] : []));
    const jibs = beams.filter((b) => b.w * b.h >= 0.1), stays = beams.filter((b) => b.w * b.h < 0.1);
    expect(jibs).toHaveLength(2); expect(stays).toHaveLength(2);
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 1.5)).toHaveLength(0); // no steps
    for (const p of pedestals) {
      expect(p.at.y).toBeLessThan(-3.4); expect(p.at.z).toBeCloseTo(4, 6);
      const jib = jibs.find((b) => Math.abs(b.from.x - p.at.x) < 1)!, stay = stays.find((b) => Math.abs(b.from.x - p.at.x) < 1)!;
      const run = jib.to.x - jib.from.x, rise = jib.to.z - jib.from.z;
      expect(rise).toBeCloseTo(run, 6); // 45°
      expect(Math.hypot(run, rise)).toBeGreaterThan(5.5); expect(Math.hypot(run, rise)).toBeLessThan(7.5);
      expect(jib.from.y).toBeLessThan(0); expect(bounds(jib).max.y).toBeLessThan(0);
      expect(bounds(jib).min.z).toBeGreaterThanOrEqual(p.at.z + 4 - 1e-6); // above the cab roof
      expect(stay.to).toEqual(jib.to); // to the tip
      expect(stay.from.z).toBeGreaterThanOrEqual(p.at.z + 4); expect(stay.from.x).toBeLessThan(jib.from.x); // from the top of the cab, behind the heel
      expect(stay.w * stay.h).toBeLessThan((jib.w * jib.h) / 10); // much thinner
    }
  });
  it("budget: 37 solids, 4 fewer for the booms and 2 more for the stays than the previous 39", () => {
    expect(s.solids).toHaveLength(37);
  });
  it("order: at all 72 headings each boom and each stay are drawn after their pedestal, their cab and the hull", () => {
    for (let k = 0; k < 72; k++) {
      const h = (k * 5 * Math.PI) / 180, r = ship("cargo", { x: 0, y: 0 }, h).solids, o = sortByDepth(r, h);
      const at = (x: Solid) => o.indexOf(x);
      const hull = r.find((x) => x.kind === "hull")!;
      const peds = r.flatMap((x) => (x.kind === "cylinder" && x.r === 0.5 && x.h === 3 ? [x] : []));
      expect(peds).toHaveLength(2);
      for (const ped of peds) {
        const near = (x: number, y: number) => Math.hypot(x - ped.at.x, y - ped.at.y) < 1;
        const cab = r.find((x) => x.kind === "poly" && x.mat === "whitewash" && x.h === 1 && near(...centerXY(x)))!;
        const parts = r.flatMap((x) => (x.kind === "beam" && near(x.from.x, x.from.y) ? [x] : []));
        expect(cab).toBeDefined(); expect(parts).toHaveLength(2); // boom and stay
        for (const part of parts) {
          expect(at(part), `heading ${k * 5}°`).toBeGreaterThan(at(ped));
          expect(at(part), `heading ${k * 5}°`).toBeGreaterThan(at(cab));
          expect(at(part), `heading ${k * 5}°`).toBeGreaterThan(at(hull));
        }
      }
    }
  });
  it("bow: forecastle with mast, windlass and two bitts; anchor showing to starboard; bulwark on both sides from the house to the forecastle", () => {
    const forecastle = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && x.h === 1.6);
    expect(forecastle).toHaveLength(1); expect(bounds(forecastle[0]!).min.x).toBeGreaterThanOrEqual(48);
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r === 0.3)).toHaveLength(2); // bitts
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.r === 0.6)).toHaveLength(1); // windlass
    const anchor = s.solids.filter((x) => x.kind === "poly" && x.mat === "steel" && bounds(x).min.x >= 54);
    expect(anchor).toHaveLength(1); expect(bounds(anchor[0]!).max.y).toBeGreaterThan(1.79);
    const rails = s.solids.filter((x) => x.kind === "poly" && x.mat === "hullBlue" && x.h === 0.8).map((x) => bounds(x));
    expect(rails).toHaveLength(4);
    for (const side of [rails.filter((b) => b.max.y < 0), rails.filter((b) => b.min.y > 0)]) {
      expect(side).toHaveLength(2);
      expect(Math.min(...side.map((b) => b.min.x))).toBeLessThanOrEqual(12); expect(Math.max(...side.map((b) => b.max.x))).toBeGreaterThanOrEqual(50);
    }
    expect(s.lights.filter((l) => l.color === "magentaMid")).toHaveLength(2); // stern and bow masthead lights
  });
  it("at any heading, all the pieces stay in the length circle and below z 13; budget 40 / 8", () => {
    for (const h of [0, Math.PI / 2, 2.3, -0.7]) {
      const r = ship("cargo", { x: 0, y: 0 }, h), cx = 30 * Math.cos(h), cy = 30 * Math.sin(h);
      expect(r.solids.length).toBeLessThanOrEqual(40); expect(r.lights.length).toBeLessThanOrEqual(8);
      for (const x of r.solids) for (const f of tessellateAll(x)) for (const p of f.pts) {
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeLessThanOrEqual(Math.hypot(30, 5) + 0.01);
        expect(p.z).toBeLessThanOrEqual(13);
      }
    }
  });
});

describe("pusher length (#68)", () => {
  it("sternOf derives the stern from PUSHER_LEN, with no literals of its own", () => {
    const src = readFileSync(new URL("./ships.ts", import.meta.url), "utf8");
    const barge = src.match(/^const sternOf = [\s\S]*?kind === "barge" \? ([^:]+):/m)?.[1];
    expect(barge?.trim()).toBe("-PUSHER_LEN");
  });
  it("the long cabin, the railings and the boat stay where they were, relative to the pusher's stern at −20", () => {
    const s = ship("barge", { x: 0, y: 0 }, 0);
    const pick = (mat: string, z: number, h: number) =>
      s.solids.filter((x) => x.kind === "poly" && x.mat === mat && Math.abs(x.z - z) < 1e-9 && Math.abs(x.h - h) < 1e-9).map(bounds);
    const pDeck = -1 + 1.6 + 0.05;
    const [house] = pick("whitewash", pDeck, 1.55).filter((b) => b.min.x < -10);
    expect(house!.min.x).toBe(-17.5); expect(house!.max.x).toBeCloseTo(-1.6, 9);
    const rails = pick("steel", pDeck + 1.55, 0.4);
    expect(rails).toHaveLength(2);
    for (const r of rails) { expect(r.min.x).toBe(-17.4); expect(r.max.x).toBeCloseTo(-8.4, 9); }
    const [boat] = pick("steel", pDeck + 1.55, 0.5);
    expect(boat!.min.x).toBe(-14); expect(boat!.max.x).toBeCloseTo(-9.8, 9);
  });
});

describe("pusher beam and freeboard (#153)", () => {
  it("the hull, the bow block and pDeck take PUSHER_BEAM and PUSHER_H, with no literals of their own", () => {
    const src = readFileSync(new URL("./ships.ts", import.meta.url), "utf8");
    const body = src.slice(src.indexOf("function barge("), src.indexOf("function ferry("));
    const lines = body.split("\n"), hulls = lines.filter((l) => l.includes('"hullBlue"')), deck = lines.filter((l) => l.includes("const pDeck"));
    expect(hulls.length).toBeGreaterThan(0); expect(deck).toHaveLength(1);
    for (const l of [...hulls, ...deck]) expect(l).not.toMatch(/(?<![\w.])(7|3\.5|1\.6|1\.55)(?![\w.])/);
    expect(hulls.some((l) => l.includes("PUSHER_BEAM, PUSHER_H"))).toBe(true);
    expect(deck[0]).toContain("PUSHER_H");
  });
  it("the bow block and the pusher's deck stay where they were, bit for bit", () => {
    const s = ship("barge", { x: 0, y: 0 }, 0), pDeck = -1 + 1.6 + 0.05;
    const bow = s.solids.flatMap((x) => (x.kind === "poly" && x.mat === "hullBlue" ? [x] : []));
    expect(bow).toHaveLength(1);
    const p = bow[0]!, b = bounds(p);
    expect(p.z).toBe(-0.9); expect(p.h).toBe(1.55);
    expect(b.min.x).toBe(-5.5); expect(b.max.x).toBe(0); expect(b.min.y).toBe(-3.5); expect(b.max.y).toBe(3.5);
    const white = s.solids.flatMap((x) => (x.kind === "poly" && x.mat === "whitewash" ? [x] : []));
    const knees = white.filter((x) => { const t = bounds(x); return !x.facade && t.min.x >= -1.5 && t.max.x <= 1e-9; });
    const house = white.filter((x) => bounds(x).min.x < -10 && x.h === 1.55);
    expect(knees).toHaveLength(2); expect(house).toHaveLength(1);
    for (const x of [...knees, ...house]) expect(x.z).toBe(pDeck);
  });
});
