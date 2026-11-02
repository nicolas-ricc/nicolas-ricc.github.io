import { describe, expect, it } from "vitest";
import { sortByDepth } from "../iso/depth";
import { bounds, type Plate, type Solid } from "../iso/solids";
import { fingerprint } from "../iso/fingerprint";
import { translate } from "../iso/translate";
import { BAY, BAYS, METAL_STACK_X, HALL, STAIR_TOWER, boilerHouse, gableEnd, inclineBelt, metalStacks, hallBody, stairTower } from "./boiler-house";
import { PLANT_SHIFT } from "./plant-frame";

type Kind<K extends Solid["kind"]> = Solid & { kind: K };
const build = (f: (out: Solid[]) => void): Solid[] => { const out: Solid[] = []; f(out); return out; };
const prisms = (ss: Solid[]) => ss.filter((s): s is Kind<"prism"> => s.kind === "prism");
const beams = (ss: Solid[]) => ss.filter((s): s is Kind<"beam"> => s.kind === "beam");
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const PIER_X = Array.from({ length: BAYS + 1 }, (_, k) => HALL.x + k * BAY);
const E = HALL.x + HALL.w; // gable end
const CUTS = [HALL.x, HALL.x + 2 * BAY, HALL.x + 4 * BAY, HALL.x + 6 * BAY, HALL.x + 8 * BAY, E - 0.5]; // north pitch
const S = HALL.y + HALL.d; // south wall: the plinth, the pilasters and the belt are measured from here
/** Fingerprint of the complete hall in its local frame (x 44..113, y −46..−1), taken before the move (#246). */
const LOCAL_FINGERPRINT = "9c16a99f";

describe("boiler hall: length derived from the number of spans", () => {
  it("9 spans of 7 u in the new spot: hall x 29..92, tower 93..98, metal chimneys at 36, 50, 64, 78", () => {
    expect(BAYS).toBe(9); expect(BAY).toBe(7);
    expect(HALL).toEqual({ x: 29, y: 44, w: BAYS * BAY, d: 30, h: 14 });
    expect(HALL.w).toBe(63);
    expect(STAIR_TOWER).toEqual({ x0: E + 1, y0: HALL.y + 12, x1: E + 6, y1: HALL.y + 20 });
    expect(STAIR_TOWER).toEqual({ x0: 93, y0: 56, x1: 98, y1: 64 });
    expect([...METAL_STACK_X]).toEqual([0, 1, 2, 3].map((k) => HALL.x + BAY * (1 + 2 * k)));
    expect([...METAL_STACK_X]).toEqual([36, 50, 64, 78]);
  });

  it("the world constants are the old ones moved by PLANT_SHIFT", () => {
    expect(HALL.x).toBe(44 + PLANT_SHIFT.x); expect(HALL.y).toBe(-46 + PLANT_SHIFT.y);
    expect(STAIR_TOWER).toEqual({ x0: 108 + PLANT_SHIFT.x, y0: -34 + PLANT_SHIFT.y, x1: 113 + PLANT_SHIFT.x, y1: -26 + PLANT_SHIFT.y });
    expect([...METAL_STACK_X]).toEqual([51, 65, 79, 93].map((x) => x + PLANT_SHIFT.x));
  });

  it("it is the old hall moved: same solids, in the same order, shifted by PLANT_SHIFT", () => {
    const all = build(boilerHouse);
    expect(all).toHaveLength(146);
    expect(fingerprint(all.map((s) => translate(s, -PLANT_SHIFT.x, -PLANT_SHIFT.y)))).toBe(LOCAL_FINGERPRINT);
    expect(all[0]).toMatchObject({ kind: "prism", at: { x: HALL.x, y: HALL.y, z: 0 }, w: HALL.w, d: HALL.d }); // readable anchor: the low wall
  });

  it("nothing of the hall goes past the east edge of the stair tower", () => {
    for (const s of build(boilerHouse)) expect(bounds(s).max.x, JSON.stringify(s).slice(0, 80)).toBeLessThanOrEqual(STAIR_TOWER.x1 + 1e-9);
  });
});

describe("boiler hall: body", () => {
  const body = build(hallBody);

  it("walls: two stacked prisms with a facade of BAYS and 2·BAYS columns, 3 × 4 mullions, flat lintel and rust courses", () => {
    const walls = prisms(body).filter((p) => p.mat === "brick" && p.at.x === HALL.x && p.at.y === HALL.y && p.w === HALL.w && p.d === HALL.d && p.h === 7);
    expect(walls.map((w) => w.at.z).sort((a, b) => a - b)).toEqual([0, 7]);
    for (const w of walls) {
      expect(w.facade).toMatchObject({ floors: 1, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat", courses: { mat: "rust", h: 0.4 } });
      expect(w.facade!.cols).toBe(w.at.z === 0 ? BAYS : 2 * BAYS);
    }
  });

  it("BAYS + 1 rust pilasters projecting from the south wall, with footing on the plinth, lattice upright and bracket", () => {
    const piers = prisms(body).filter((p) => p.mat === "rust" && p.w === 0.5 && p.d === 0.5);
    expect(piers).toHaveLength(BAYS + 1);
    for (const [k, p] of piers.entries()) {
      const b = bounds(p);
      expect(b.min.x + 0.25).toBeCloseTo(PIER_X[k]!, 6);
      expect(b.min.y).toBeCloseTo(S, 9); expect(b.max.y).toBeCloseTo(S + 0.5, 9);
      expect(b.min.z).toBeCloseTo(4.1, 6); expect(b.max.z).toBe(14);
    }
    const feet = prisms(body).filter((p) => p.mat === "concrete" && p.w === 0.9 && p.d === 0.9 && p.h === 0.6);
    expect(feet).toHaveLength(BAYS + 1);
    for (const [k, f] of feet.entries()) { expect(f.at.z).toBe(3.5); expect(f.at.y).toBeCloseTo(S, 9); expect(f.at.x + 0.45).toBeCloseTo(PIER_X[k]!, 6); }
    expect(prisms(body).filter((p) => p.mat === "rust" && p.w === 0.15 && p.d === 0.15 && near(p.at.y, S))).toHaveLength(BAYS + 1);
    const brackets = beams(body).filter((b) => b.mat === "rust" && b.w === 0.3);
    expect(brackets).toHaveLength(BAYS + 1);
    brackets.forEach((b, k) => expect(b.from.x).toBeCloseTo(PIER_X[k]!, 9));
    for (const b of brackets) { expect(b.from.y).toBeCloseTo(S + 0.15, 9); expect(bounds(b).min.y).toBeGreaterThanOrEqual(S - 1e-9); expect(b.to.y - b.from.y).toBeGreaterThanOrEqual(0.7 - 1e-9); /* diagonal, without entering the wall */ expect(b.to.z).toBeGreaterThan(b.from.z); expect(b.to.y).toBeGreaterThan(b.from.y); }
  });

  it("checkerboard brick lattice band under the eave, on the south and east walls of the tall prism", () => {
    const upper = prisms(body).find((p) => p.mat === "brick" && p.at.z === 7 && p.w === HALL.w)!;
    const plates: Plate[] = upper.plates ?? [];
    const on = (wall: number) => plates.filter((p) => p.wall === wall && p.mat === "brick" && p.toneOffset === -2 && p.z0 === 12.8 && p.z1 === 13.6);
    expect(on(2)).toHaveLength(HALL.w);
    expect(on(1)).toHaveLength(HALL.d);
    for (const p of on(2)) expect((p.u1 - p.u0) * HALL.w).toBeCloseTo(0.5, 6);
  });

  it("whitewash plinth attached to the south wall with grid windows and 2·BAYS alternating tubes", () => {
    const plinth = prisms(body).find((p) => p.mat === "whitewash" && p.h === 3.5)!;
    expect(plinth).toMatchObject({ at: { x: HALL.x, y: S, z: 0 }, w: HALL.w, d: 1.5 });
    expect(plinth.facade).toMatchObject({ floors: 1, cols: 2 * BAYS, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } });
    const tubes = body.filter((s): s is Kind<"cylinder"> => s.kind === "cylinder" && s.r === 0.3 && s.h === 0.8);
    expect(tubes).toHaveLength(2 * BAYS);
    tubes.forEach((t, i) => expect(t.at.x).toBeCloseTo(HALL.x + (i + 0.5) * (HALL.w / (2 * BAYS)), 6)); // every 3.5
    expect(tubes.map((t) => t.mat)).toEqual(Array.from({ length: 2 * BAYS }, (_, i) => (i % 2 === 0 ? "whitewash" : "rust")));
    for (const t of tubes) { expect(t.at.z).toBe(3.5); expect(t.at.y - t.r).toBeGreaterThanOrEqual(S + 0.9 - 1e-9); expect(t.at.y + t.r).toBeLessThanOrEqual(S + 1.5 + 1e-9); }
  });

  it("slate gable roof with E-W ridge at z 17, south eave, light trim and 4 caps", () => {
    const roof = body.filter((s): s is Kind<"ramp"> => s.kind === "ramp");
    for (const r of roof) { expect(r.mat).toBe("steel"); expect(r.at.z).toBe(14); expect(r.h).toBe(3); }
    const south = roof.filter((r) => r.dir === "s"), north = roof.filter((r) => r.dir === "n");
    expect(south).toHaveLength(1);
    expect(south[0]!.at).toEqual({ x: HALL.x, y: HALL.y + 15, z: 14 }); expect(south[0]!.w).toBe(HALL.w - 0.5); expect(south[0]!.at.y + south[0]!.d).toBeCloseTo(S + 0.6, 6);
    // north pitch in E-W sections, each with its metal chimney near the center (paint order)
    expect(north.map((r) => [r.at.x, r.at.x + r.w])).toEqual(CUTS.slice(0, -1).map((c, i) => [c, CUTS[i + 1]]));
    expect(CUTS).toEqual([29, 43, 57, 71, 85, 91.5]);
    for (const r of north) { expect(r.at.y).toBeCloseTo(HALL.y - 0.6, 6); expect(r.at.y + r.d).toBeCloseTo(HALL.y + 15, 6); }
    expect(prisms(body).filter((p) => p.mat === "whitewash" && near(p.at.y, S + 0.6) && near(p.d, 0.3) && near(p.h, 0.3)).map((p) => [p.at.x, p.w])).toEqual([[HALL.x, HALL.w - 0.5]]); // south trim
    const vents = prisms(body).filter((p) => p.mat === "steel" && p.w === 1.2 && p.d === 1.2 && p.h === 0.8);
    expect(vents).toHaveLength(4);
    for (const v of vents) { expect(v.at.z).toBe(17); expect(v.at.y).toBeCloseTo(HALL.y + 14.4, 6); }
    vents.forEach((v, k) => expect(v.at.x + 0.6).toBeCloseTo(CUTS[k + 1]!, 9)); // at the four interior cuts
  });
});

describe("boiler hall: gable end and metal chimneys", () => {
  it("gable end: whitewash frame and stepped 3-level gable with cap and lattice", () => {
    const g = build(gableEnd);
    const piers = prisms(g).filter((p) => p.mat === "whitewash" && p.w === 1 && p.d === 1);
    expect(piers.map((p) => p.at.y - HALL.y).sort((a, b) => a - b)).toEqual([0, 10, 20, 29]);
    for (const p of piers) expect(p.at.x).toBe(E);
    expect(prisms(g).some((p) => p.mat === "whitewash" && p.at.x === E && p.at.y === HALL.y && p.w === 1 && p.d === HALL.d && p.at.z === 13.7)).toBe(true); // cornice
    const bands = prisms(g).filter((p) => p.mat === "whitewash" && p.at.z === 7 && near(p.h, 0.3));
    expect(bands).toHaveLength(3);
    for (const b of bands) expect(b.at.x).toBe(E); // bands between pilasters
    const steps = prisms(g).filter((p) => p.mat === "brick" && p.at.x === E - 0.5 && p.w === 1);
    expect(steps.map((s) => [s.at.y - HALL.y, s.at.y + s.d - HALL.y, s.at.z])).toEqual([[2, 28, 14], [8, 22, 15.5], [13, 17, 17]]);
    for (const s of steps) {
      expect(near(s.h, 1.2)).toBe(true);
      expect(prisms(g).some((c) => c.mat === "whitewash" && c.at.x === E - 0.5 && c.at.y === s.at.y && c.d === s.d && near(c.at.z, s.at.z + 1.2) && near(c.h, 0.3))).toBe(true);
      expect((s.plates ?? []).filter((p) => p.wall === 1 && p.toneOffset === -2).length).toBeGreaterThan(0);
    }
    for (const s of g) expect(bounds(s).max.z).toBeLessThanOrEqual(20);
  });

  it("four rust metal chimneys in a row on the north pitch, with 4 guys each, no smoke", () => {
    const m = build(metalStacks);
    const stacks = m.filter((s): s is Kind<"cylinder"> => s.kind === "cylinder");
    expect(stacks.map((s) => s.at.x)).toEqual([...METAL_STACK_X]);
    for (const s of stacks) expect(s).toMatchObject({ mat: "rust", r: 0.5, h: 6, at: { y: HALL.y + 13, z: 16.6 } });
    const guys = beams(m);
    expect(guys).toHaveLength(16);
    for (const g of guys) { expect(g.w).toBe(0.15); expect(g.h).toBe(0.15); expect(g.mat).toBe("rust"); expect(g.to.z).toBeLessThan(g.from.z); }
    for (const g of guys) expect(bounds(g).max.y).toBeLessThanOrEqual(HALL.y + 15 + 1e-9); // do not cover the south pitch
  });

  it("each metal chimney is centered in one of the first 4 sections of the north pitch, with its guys inside", () => {
    const m = build(metalStacks);
    METAL_STACK_X.forEach((cx, k) => {
      expect(cx).toBeCloseTo((CUTS[k]! + CUTS[k + 1]!) / 2, 9);
      const own = m.filter((s) => { const sx = s.kind === "cylinder" ? s.at.x : s.kind === "beam" ? s.from.x : NaN; return Math.abs(sx - cx) < 1; });
      expect(own).toHaveLength(5);
      for (const s of own) { const b = bounds(s); expect(b.min.x).toBeGreaterThanOrEqual(CUTS[k]!); expect(b.max.x).toBeLessThanOrEqual(CUTS[k + 1]!); }
    });
  });

  it("the metal chimneys and their guys are painted after the north pitch they cover", () => {
    const order = sortByDepth(build(boilerHouse));
    const north = order.filter((s): s is Kind<"ramp"> => s.kind === "ramp" && s.dir === "n");
    const stacks = order.filter((s) => (s.kind === "cylinder" && s.mat === "rust" && s.r === 0.5) || (s.kind === "beam" && s.w === 0.15 && s.mat === "rust" && s.from.z === 21));
    expect(stacks).toHaveLength(20);
    for (const s of stacks) {
      const b = bounds(s);
      for (const r of north) if (b.min.x < r.at.x + r.w && b.max.x > r.at.x) expect(order.indexOf(s), JSON.stringify(s).slice(0, 80)).toBeGreaterThan(order.indexOf(r));
    }
  });
});

describe("boiler hall: stair tower and inclined belt", () => {
  it("steel stair tower: 4 posts split between 4 landings, zigzag flights and east and south railing", () => {
    const t = build(stairTower);
    for (const s of t) {
      expect(s.mat).toBe("steel");
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(STAIR_TOWER.x0 - 1e-9); expect(b.max.x).toBeLessThanOrEqual(STAIR_TOWER.x1 + 1e-9);
      expect(b.min.y).toBeGreaterThanOrEqual(STAIR_TOWER.y0 - 1e-9); expect(b.max.y).toBeLessThanOrEqual(STAIR_TOWER.y1 + 1e-9);
    }
    const landings = prisms(t).filter((p) => p.w === 5 && p.d === 8 && p.h === 0.25);
    expect(landings.map((l) => l.at.z)).toEqual([3.5, 7, 10.5, 14]);
    const posts = prisms(t).filter((p) => p.w === 0.4 && p.d === 0.4);
    expect(posts).toHaveLength(20);
    expect(Math.max(...posts.map((p) => p.at.z + p.h))).toBe(16);
    const flights = beams(t).filter((b) => b.w === 1);
    expect(flights).toHaveLength(4);
    expect([...new Set(flights.map((f) => f.from.x))].sort((a, b) => a - b)).toEqual([STAIR_TOWER.x0 + 1.5, STAIR_TOWER.x0 + 3.5]); // zigzag
    for (const f of flights) for (const p of [f.from, f.to]) expect([STAIR_TOWER.y0 + 1, STAIR_TOWER.y1 - 1]).toContain(p.y); // flights from y0 + 1 to y1 − 1
    const rails = beams(t).filter((b) => b.w === 0.15);
    expect(rails.filter((b) => b.from.x === STAIR_TOWER.x1 - 0.1 && b.to.x === STAIR_TOWER.x1 - 0.1)).toHaveLength(4); // east
    expect(rails.filter((b) => b.from.x === STAIR_TOWER.x0 + 0.4 && b.to.x === STAIR_TOWER.x1 - 0.4)).toHaveLength(4); // south
    expect(beams(t).filter((b) => b.w === 0.15)).toHaveLength(8); // east and south railing of each landing
  });

  it("rust inclined belt from the truck yard to a hopper hung by the eave, with 2 trestles", () => {
    const c = build(inclineBelt);
    for (const s of c) expect(s.mat).toBe("rust");
    const belt = beams(c);
    expect(belt).toHaveLength(1);
    expect(belt[0]).toMatchObject({ from: { x: HALL.x + 6, y: S + 12, z: 0.5 }, w: 1.6, h: 0.6 });
    expect(belt[0]!.to.x).toBeCloseTo(HALL.x + 15.7, 9); expect(belt[0]!.to.y).toBeCloseTo(S + 1, 9); expect(belt[0]!.to.z).toBe(12.5);
    const hopper = prisms(c).find((p) => p.w === 3 && p.d === 2 && p.h === 2.5)!;
    expect(hopper.at.x).toBeCloseTo(HALL.x + 14.2, 9); expect(hopper.at.y).toBeCloseTo(S, 9); expect(hopper.at.z).toBe(11);
    expect(prisms(c).filter((p) => p.w === 0.4 && p.d === 0.4 && p.at.z === 0)).toHaveLength(2);
  });
});

describe("complete boiler hall", () => {
  const all = build(boilerHouse);
  it("joins the five parts, each moved only once", () => {
    expect(all).toEqual([...build(hallBody), ...build(gableEnd), ...build(metalStacks), ...build(stairTower), ...build(inclineBelt)]);
  });
  it("every piece of the hall measures at least 0.15 u", () => {
    const dims = (s: Solid): number[] => {
      switch (s.kind) {
        case "prism": case "ramp": return [s.w, s.d, s.h];
        case "cylinder": return [2 * s.r, s.h];
        case "beam": return [s.w, s.h, Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y, s.to.z - s.from.z)];
        default: return [];
      }
    };
    for (const s of all) for (const d of dims(s)) expect(d, JSON.stringify(s).slice(0, 80)).toBeGreaterThanOrEqual(0.15 - 1e-9);
    for (const s of all) {
      if (s.kind !== "prism" || !s.plates) continue;
      for (const p of s.plates) {
        const len = p.wall % 2 === 0 ? s.w : s.d;
        expect((p.u1 - p.u0) * len).toBeGreaterThanOrEqual(0.15 - 1e-9);
        expect(p.z1 - p.z0).toBeGreaterThanOrEqual(0.15 - 1e-9);
      }
    }
  });
});
