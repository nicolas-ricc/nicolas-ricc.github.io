import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { hullsOverlap, isBehind, overlaps, screenBounds, screenHull } from "../iso/depth";
import type { Vec3 } from "../iso/geometry";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { DOCK } from "../map/geo";
import { createRng } from "../map/seed";
import { STACKS, factory } from "./factory";
import { shipyard } from "./shipyard";
import { CRANE_RAILS, FLOATING_DOCK, QUAY_CRANES, RIPRAP_KEEP_OUT, YARD, YARD_LANES_X, YARD_SLOTS_Y, containerYard, fittingOutSheds, floatingDock, quayCranes } from "./shipyard-east";
import { terrainAt } from "./terrain-classify";

type Prism = Solid & { kind: "prism" };
const prisms = (ss: Solid[]): Prism[] => ss.filter((s): s is Prism => s.kind === "prism");
const center = (b: Bounds) => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 });
/** Interiors intersect by more than 1e-9 on all three axes. */
const intersect = (a: Bounds, b: Bounds): boolean =>
  a.min.x < b.max.x - 1e-9 && b.min.x < a.max.x - 1e-9 && a.min.y < b.max.y - 1e-9 && b.min.y < a.max.y - 1e-9 && a.min.z < b.max.z - 1e-9 && b.min.z < a.max.z - 1e-9;
const planCut = (a: Bounds, b: Bounds): boolean => a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y;

const dock = () => { const out: Solid[] = [], accents: Accent[] = [], weld: Vec3[] = []; floatingDock(out, accents, weld); return { out, accents, weld }; };
const yard = (seed = 7) => { const out: Solid[] = [], accents: Accent[] = []; containerYard(out, accents, createRng(seed)); return { out, accents }; };
const cranes = () => { const out: Solid[] = [], accents: Accent[] = []; quayCranes(out, accents); return { out, accents }; };
const sheds = () => { const out: Solid[] = []; fittingOutSheds(out); return out; };
const isBox = (s: Solid) => s.kind === "prism" && s.mat.startsWith("box") && s.w === 2.4 && s.d === 6 && s.h === 2.6;

describe("floating dock", () => {
  it("pontoon and two walls span x 204..246", () => {
    const ps = prisms(dock().out);
    const pontoon = ps.filter((p) => p.mat === "steel" && p.h === 2.5 && p.at.z === -1.2);
    expect(pontoon).toHaveLength(1);
    expect(pontoon[0]).toMatchObject({ at: { x: FLOATING_DOCK.x0, y: FLOATING_DOCK.y0 }, w: 42, d: 14 });
    const walls = ps.filter((p) => p.mat === "steel" && p.w === 42 && p.d === 1.5 && p.h === 6);
    expect(walls.map((w) => w.at.y).sort((a, b) => a - b)).toEqual([74, 86.5]);
    for (const w of [...pontoon, ...walls]) { const b = bounds(w); expect(b.min.x).toBe(204); expect(b.max.x).toBe(246); }
    for (const w of walls) {
      for (const wall of [1, 2]) {
        const mats = (w.plates ?? []).filter((p) => p.wall === wall).map((p) => p.mat);
        expect(mats, `wall ${wall}`).toContain("safety");
        expect(mats, `wall ${wall}`).toContain("asphalt");
      }
    }
  });

  it("half-painted hull inside the walls", () => {
    const hulls = dock().out.filter((s): s is Solid & { kind: "hull" } => s.kind === "hull");
    expect(hulls).toHaveLength(1);
    expect(hulls[0]).toMatchObject({ mat: "rust", topMat: "hull", len: 30, beam: 7, h: 4, at: { x: 208, y: 81, z: 1.3 } });
    const b = bounds(hulls[0]!);
    expect(b.min.y).toBeGreaterThanOrEqual(75.5); expect(b.max.y).toBeLessThanOrEqual(86.5);
    expect(b.min.x).toBeGreaterThanOrEqual(204); expect(b.max.x).toBeLessThanOrEqual(246);
    expect(prisms(dock().out).some((p) => p.mat === "concrete" && p.w === 6 && p.d === 4 && p.h === 2.5)).toBe(true); // superstructure
  });

  it("two service towers with cyan lamps on top", () => {
    const d = dock();
    const towers = prisms(d.out).filter((p) => p.mat === "steel" && p.w === 3 && p.d === 3 && p.h === 8);
    expect(towers.map((t) => t.at.x).sort((a, b) => a - b)).toEqual([204, 243]);
    const lamps = d.accents.filter((a) => a.kind === "dot" && a.color === "cyan");
    expect(lamps).toHaveLength(2);
    for (const l of lamps) expect(l.kind === "dot" && l.at.z > 9.3).toBe(true);
  });

  it("gangway touches the quay at x 202", () => {
    const g = prisms(dock().out).filter((p) => p.mat === "steel" && p.h === 0.3);
    expect(g).toHaveLength(1);
    expect(bounds(g[0]!).min.x).toBe(202); expect(bounds(g[0]!).max.x).toBe(204);
  });

  it("four new weld spots on the hull sides, also in the shipyard scene", () => {
    const { weld } = dock();
    expect(weld).toHaveLength(4);
    for (const w of weld) expect(w.z).toBe(5.3);
    const all = shipyard(createRng(7)).weldSpots;
    for (const w of weld) expect(all).toContainEqual(w);
  });

  it("everything but the gangway floats, and nothing passes y 88.5", () => {
    for (const s of dock().out) {
      const b = bounds(s);
      expect(b.max.y).toBeLessThanOrEqual(88.5);
      if (s.kind === "prism" && s.h === 0.3) continue;
      const c = center(b);
      expect(terrainAt(c.x, c.y), JSON.stringify(c)).toBe("water");
    }
  });
});

describe("container yard", () => {
  it("19 stacks of 1..4 box containers in lanes 289/294/299", () => {
    const groups = new Map<string, number>();
    for (const s of yard().out) if (isBox(s) && s.kind === "prism") groups.set(`${s.at.x},${s.at.y}`, (groups.get(`${s.at.x},${s.at.y}`) ?? 0) + 1);
    expect(groups.size).toBe(19);
    for (const [k, n] of groups) {
      const [x, y] = k.split(",").map(Number);
      expect(YARD_LANES_X).toContain(x); expect(YARD_SLOTS_Y).toContain(y);
      expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(4);
    }
  });

  it("concrete slab x 288..304, y 30..80", () => {
    const slab = prisms(yard().out).filter((p) => p.mat === "concrete" && p.h === 0.2);
    expect(slab).toHaveLength(1);
    expect(slab[0]).toMatchObject({ at: { x: YARD.x0, y: YARD.y0, z: 0 }, w: 16, d: 50 });
  });

  it("RTG with four legs reaching z 10.2", () => {
    const legs = prisms(yard().out).filter((p) => p.mat === "steel" && p.w === 1.2 && p.d === 1.2 && p.h === 7.8);
    expect(legs).toHaveLength(4);
    for (const l of legs) expect(bounds(l).max.z).toBeCloseTo(10.2, 9);
  });

  it("two straddle carriers on slots without a stack", () => {
    const { out } = yard();
    const frames = prisms(out).filter((p) => p.mat === "safety" && p.w === 3 && p.d === 7 && p.h === 0.6);
    expect(frames).toHaveLength(2);
    const boxes = out.filter(isBox).map(bounds);
    for (const f of frames) {
      const fb = bounds(f);
      expect(boxes.some((b) => planCut(b, { min: { ...fb.min, z: 0 }, max: fb.max })), JSON.stringify(fb)).toBe(false);
      expect(prisms(out).filter((p) => p.mat === "steel" && p.w === 0.4 && p.d === 0.4 && p.h === 5 && planCut(bounds(p), fb))).toHaveLength(4);
    }
  });

  it("gatehouse with a cool window", () => {
    const { out, accents } = yard();
    expect(prisms(out).filter((p) => p.mat === "concrete" && p.w === 3 && p.d === 3 && p.h === 2.8)).toHaveLength(1);
    const win = accents.filter((a) => a.kind === "poly" && a.color === "windowCool");
    expect(win).toHaveLength(1);
    expect(win[0]!.kind === "poly" && win[0]!.alpha).toBe(0.85);
    expect(accents.filter((a) => a.kind === "dot" && a.color === "cyan")).toHaveLength(2);
  });

  it("nothing overlaps (pairs of boxes, 1e-9), with seed 7 and seeds 1..40", () => {
    for (const seed of [7, ...Array.from({ length: 40 }, (_, i) => i + 1)]) {
      const bs = yard(seed).out.map(bounds);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) expect(intersect(bs[i]!, bs[j]!), `seed ${seed}: ${JSON.stringify(bs[i])} × ${JSON.stringify(bs[j])}`).toBe(false);
    }
  });

  it("everything inside x 288..304, y 30..84 and under z 10.6", () => {
    for (const s of yard().out) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(288); expect(b.max.x).toBeLessThanOrEqual(304);
      expect(b.min.y).toBeGreaterThanOrEqual(30); expect(b.max.y).toBeLessThanOrEqual(84);
      expect(b.max.z).toBeLessThanOrEqual(10.6 + 1e-9);
    }
  });
});

describe("quay cranes", () => {
  it("two gantries at x 284 with a cyan light at the west tip", () => {
    expect(QUAY_CRANES).toEqual([{ x: 284, y: 34 }, { x: 284, y: 62 }]);
    const tips = cranes().accents.filter((a) => a.kind === "dot" && a.color === "cyan");
    expect(tips).toHaveLength(2);
    for (const t of tips) expect(t.kind === "dot" && t.at.x).toBeLessThan(280);
  });

  it("rails from y 31 to 82 under the legs", () => {
    const rails = cranes().out.filter((s): s is Solid & { kind: "strip" } => s.kind === "strip" && s.mat === "rail" && s.width === 0.5);
    expect(rails.map((r) => r.path.map((p) => [p.x, p.y]))).toEqual(CRANE_RAILS.x.map((x) => [[x, CRANE_RAILS.y0], [x, CRANE_RAILS.y1]]));
    expect(CRANE_RAILS).toEqual({ x: [281, 287], y0: 31, y1: 82 });
  });

  it("no crane leg and no yard solid touches a riprap rock", () => {
    const s = shipyard(createRng(7));
    const rocks = s.solids.filter((x) => x.kind === "cone" && x.mat === "rock").map(bounds);
    const legs = prisms(cranes().out).filter((p) => p.w === 0.8 && p.d === 0.8 && p.h === 9.2);
    expect(legs).toHaveLength(8);
    for (const l of [...legs, ...yard().out]) for (const r of rocks) expect(planCut(bounds(l), r), JSON.stringify(r)).toBe(false);
    for (const k of RIPRAP_KEEP_OUT) for (const r of rocks) expect(r.min.x < k.x1 && k.x0 < r.max.x && r.min.y < k.y1 && k.y0 < r.max.y).toBe(false);
  });
});

describe("fitting-out sheds", () => {
  it("two sheetTeal gables with ribs on walls 1 and 2 and a door on the south", () => {
    const ps = prisms(sheds());
    expect(ps.map((p) => [p.at.x, p.at.y, p.w, p.d, p.h, p.mat, p.roof])).toEqual([[304, 24, 8, 56, 6, "sheetTeal", "gable"], [316, 24, 8, 56, 6, "sheetTeal", "gable"]]);
    for (const p of ps) {
      const plates = p.plates ?? [];
      for (const wall of [1, 2]) expect(plates.filter((q) => q.wall === wall && q.toneOffset !== undefined && q.toneOffset !== -2).length, `wall ${wall}`).toBeGreaterThan(0);
      expect(plates.filter((q) => q.wall === 2 && q.shape === "rect" && q.toneOffset === -2)).toHaveLength(1);
    }
  });
});

describe("occlusion of the landmarks (#323)", () => {
  it("nothing new hides the gantry crane, the dry dock or the factory chimneys", () => {
    const fresh: Solid[] = [];
    floatingDock(fresh, [], []); containerYard(fresh, [], createRng(7)); quayCranes(fresh, []); fittingOutSheds(fresh);
    const news = fresh.filter((s) => !isFlat(s)).map(bounds);
    const sy = shipyard(createRng(7)).solids.filter((s) => !isFlat(s));
    const gantry = sy.filter((s) => { const b = bounds(s); return b.min.x >= 150 && b.max.x <= 153 && b.max.z >= 24; });
    const dry = sy.filter((s) => { const b = bounds(s); return b.min.x >= DOCK.x - 2 && b.max.x <= 198 && b.min.y >= DOCK.y - 2 && b.max.y <= DOCK.y + DOCK.d + 2 && b.min.z < 0; });
    const chimneys = factory(createRng(7)).solids.filter((s) => s.kind === "cylinder" && STACKS.some((k) => Math.hypot(s.at.x - k.x, s.at.y - k.y) < 1e-6 && s.r <= k.r + 1));
    expect(gantry.length).toBeGreaterThanOrEqual(3); expect(dry.length).toBeGreaterThanOrEqual(6); expect(chimneys.length).toBeGreaterThanOrEqual(3);
    for (const p of [...gantry, ...dry, ...chimneys].map(bounds)) for (const n of news) {
      if (overlaps(screenBounds(p), screenBounds(n)) && hullsOverlap(screenHull(p), screenHull(n))) expect(isBehind(p, n), `${JSON.stringify(p)} behind ${JSON.stringify(n)}`).toBe(false);
    }
  });
});
