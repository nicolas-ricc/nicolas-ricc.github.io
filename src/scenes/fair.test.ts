import { describe, expect, it } from "vitest";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { worldZoneAt } from "../map/geo";
import { createRng, SEED } from "../map/seed";
import type { Accent } from "../iso/accent";
import { BOOTH_ROW, BOOTH_TYPES, COASTER_PROFILE, DROP, FAIR_MATS, FLUME, FLUME_DROP_X0, FLUME_PATH, FLUME_X1, FOOD_COURT, GHOST, LIFT_SEGMENTS, MIRRORS, PIER, SLIDE, WHEEL, boothRow, boothSlots, boothTypes, coasterPath, dropSolids, fair, flume, foodCourt, ghostTrain, logSolids, mirrorHouse, slide, trainSolids, wheelSolid } from "./fair";
import { FAIR, bayShoreX, bayWater, fairAt } from "./sprawl-grid";
import { bleedTerrainAt } from "./terrain";
import { zoneRng } from "./world";

const scene = () => fair(createRng(7));
const slender = (s: Solid) => (s.kind === "cylinder" && s.r <= 3) || (s.kind === "prism" && ((s.w <= 3 && s.d <= 3) || s.h <= 1)) || (s.kind === "poly" && s.h <= 1);

describe("fair", () => {
  it("is deterministic, lands in Portfolio on the fair strip with its materials and within budget", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
    const s = scene();
    const raised = s.solids.filter((x) => !isFlat(x));
    expect(raised.length).toBeGreaterThan(250); expect(raised.length).toBeLessThanOrEqual(700);
    expect(s.accents.length).toBeLessThanOrEqual(200);
    for (const x of s.solids) {
      const b = bounds(x);
      expect(FAIR_MATS).toContain(x.mat);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("portfolio");
      expect(b.min.x).toBeGreaterThanOrEqual(FAIR.x0 - 0.5); expect(b.min.y).toBeGreaterThanOrEqual(FAIR.y0); expect(b.max.y).toBeLessThanOrEqual(FAIR.y1 + 0.5);
    }
    // the arcade signs are drawn only by the animated layer (Task 18): they must not slip into the static accents.
    expect(s.accents).not.toContain(s.arcadeSigns[0]);
    expect(s.accents).not.toContain(s.arcadeSigns[1]);
  });

  it("nothing rests on water except the pier, its piles and the pavilion; nothing non-slender exceeds 18", () => {
    for (const x of scene().solids) {
      const b = bounds(x), cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
      const pier = x.kind === "prism" && x.mat === "deck" && x.at.z === -1;
      const onPier = b.min.y >= PIER.y - 0.5 && b.max.y <= PIER.y + PIER.d + 1 && b.min.x > bayShoreX(PIER.y) - 16; // piles (south side) and garland over the pier
      const pavilionCone = x.kind === "cone" && x.mat === "copper" && x.r === 5.6; // the pavilion roof, at the tip of the pier
      const flumeDrop = x.mat === "deck" && b.min.z <= 0.2 && b.min.x >= FLUME_DROP_X0 - 0.01 && b.min.y >= -298 && b.max.y <= -294 + 1; // #327: the log flume drop, over the shore
      if (!pier && !onPier && !pavilionCone && !flumeDrop) expect(bayWater(cx, cy)).toBe(false);
      if (!slender(x)) expect(b.max.z).toBeLessThanOrEqual(18.5);
    }
  });

  it("boardwalk with street lamps, pier with pavilion and garland, carousel, arcades with facade, bumper cars, umbrellas, gate", () => {
    const s = scene();
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "deck" && x.d === 18 && x.h === 0.6).length).toBeGreaterThanOrEqual(6);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "deck" && x.at.z === -1 && x.w === 46)).toBe(true);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "whitewash" && x.r === 5 && x.sides === 8)).toBe(true);
    expect(s.solids.some((x) => x.kind === "cone" && x.mat === "whitewash" && x.r === 7)).toBe(true); // carousel
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "whitewash" && x.w === 24 && x.facade)).toBe(true); // arcade
    expect(s.solids.filter((x) => x.kind === "cone" && x.r === 1.6).length).toBeGreaterThanOrEqual(10); // umbrellas
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "stone" && x.h === 6 && x.w === 1.5)).toHaveLength(2); // gate
    expect(s.solids.filter((x) => x.kind === "hull").length).toBeGreaterThanOrEqual(3); // stranded boats
    expect(s.accents.filter((a) => a.kind === "dot").length).toBeGreaterThan(30);
    expect(new Set(s.accents.map((a) => a.color)).size).toBeGreaterThanOrEqual(3); // amber, cyan and magenta
  });

  it("Ferris wheel: on the beach, axis at 23, r 20, 20 gondolas; nothing static ends up in front of it on screen", () => {
    const s = scene();
    const w = wheelSolid(0);
    expect(w).toMatchObject({ kind: "wheel", r: WHEEL.r, sides: WHEEL.sides, at: { x: WHEEL.x, y: WHEEL.y, z: WHEEL.hub } });
    expect(bounds(w).max.z).toBeCloseTo(WHEEL.hub + WHEEL.r, 6);
    expect(WHEEL.x + WHEEL.r * Math.SQRT1_2 + 6).toBeLessThan(bayShoreX(WHEEL.y) - 16); // on the sand, west of the boardwalk
    expect(WHEEL.y).toBeGreaterThan(PIER.y + PIER.d); // on the beach south of the pier
    const wb = bounds(w);
    for (const x of s.solids) { const sb = bounds(x); if (overlaps(screenBounds(wb), screenBounds(sb))) expect(isBehind(wb, sb)).toBe(false); }
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "steel" && x.h === WHEEL.hub)).toHaveLength(2); // columns behind the plane
  });

  it("roller coaster: 24 segments with z between 4 and 14, climb at the start; the train and the gondola can be built at any distance/height", () => {
    const path = coasterPath();
    expect(path).toHaveLength(24);
    expect(COASTER_PROFILE.slice(0, 6)).toEqual([4, 6, 8, 10, 12, 14]);
    for (const p of path) { expect(p.z).toBeGreaterThanOrEqual(4); expect(p.z).toBeLessThanOrEqual(14); expect(fairAt(p.x, p.y)).toBe(true); }
    const s = scene();
    expect(s.solids.filter((x) => x.kind === "poly" && x.mat === "rail").length).toBe(48); // two rails per segment
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "rust" && x.w === 0.5).length).toBe(24); // columns
    for (const d of [0, 10, 50, 120, 183]) { const t = trainSolids(d); expect(t).toHaveLength(6); for (const x of t) expect(bounds(x).min.z).toBeGreaterThanOrEqual(3.9); }
    expect(dropSolids(1)).toHaveLength(9);
    expect(bounds(dropSolids(DROP.h - 3)[0]!).max.z).toBeLessThanOrEqual(DROP.h + 1);
  });

  it("all the fair's ground is sand", () => {
    for (const [x, y] of [[100, -294], [150, -214], [200, -264], [120, -174]] as const) expect(bleedTerrainAt(x, y)).toBe("fair");
  });
  it("neon: marquee of 8 above the gate sign, climb of LIFT_SEGMENTS + 1, column of 6 south of the tower", () => {
    const s = scene();
    expect(s.neon.marquee).toHaveLength(8);
    expect(s.neon.marquee.map((p) => p.x)).toEqual([86.5, 87.5, 88.5, 89.5, 90.5, 91.5, 92.5, 93.5]);
    for (const p of s.neon.marquee) { expect(p.y).toBeCloseTo(-178, 9); expect(p.z).toBe(7.6); }
    const path = coasterPath();
    expect(s.neon.lift).toHaveLength(LIFT_SEGMENTS + 1);
    s.neon.lift.forEach((p, k) => expect(p).toEqual({ x: path[k]!.x, y: path[k]!.y, z: path[k]!.z + 0.8 }));
    expect(s.neon.column).toHaveLength(6);
    expect(s.neon.column[0]!.z).toBeCloseTo(s.drop.at.z + 2, 9);
    expect(s.neon.column[5]!.z).toBeCloseTo(s.drop.h - 2, 9);
    const steps = s.neon.column.slice(1).map((p, k) => p.z - s.neon.column[k]!.z);
    for (const d of steps) expect(d).toBeCloseTo(steps[0]!, 9);
    for (const p of s.neon.column) { expect(p.x).toBe(DROP.x); expect(p.y).toBe(DROP.y + 0.8); }
  });
});

describe("stranded beach boats (#98)", () => {
  // The tests' scene, the site's and 40 more seeds (8..47, not repeating 7): each boat's heading comes from the rng and changes its footprint.
  const scenes = [fair(createRng(7)), fair(zoneRng(SEED, "portfolio", 3)), ...Array.from({ length: 40 }, (_, i) => fair(createRng(i + 8)))];
  const hulls = (s: ReturnType<typeof fair>) => s.solids.filter((x): x is Solid & { kind: "hull" } => x.kind === "hull");
  /** Footprints (boxes in x and y) touch if they overlap with a non-empty interior. */
  const touch = (a: Bounds, b: Bounds) => a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y;

  it("no hull overlaps a deck-material prism in footprint", () => {
    scenes.forEach((s, k) => {
      for (const h of hulls(s)) for (const d of s.solids) if (d.kind === "prism" && d.mat === "deck") expect(touch(bounds(h), bounds(d)), `scene ${k}, hull at (${h.at.x}, ${h.at.y})`).toBe(false);
    });
  });

  it("there are four, entirely on the fair's sand and clear of every other solid", () => {
    scenes.forEach((s, k) => {
      expect(hulls(s), `scene ${k}`).toHaveLength(4);
      const all = s.solids.map((o) => [o, bounds(o)] as const);
      for (const h of hulls(s)) {
        const b = bounds(h);
        for (let y = b.min.y; y < b.max.y + 0.5; y += 0.5) for (const x of [b.min.x, b.max.x]) { const py = Math.min(y, b.max.y); expect(fairAt(x, py)).toBe(true); expect(bayWater(x, py)).toBe(false); }
        for (const [o, ob] of all) if (o !== h) expect(touch(b, ob), `scene ${k}, hull at (${h.at.x}, ${h.at.y})`).toBe(false);
      }
    });
  });

  it("in the site's scene no boat ends up in front of the Ferris wheel on screen", () => {
    const wb = bounds(wheelSolid(0));
    for (const h of hulls(scenes[1]!)) { const hb = bounds(h); if (overlaps(screenBounds(wb), screenBounds(hb))) expect(isBehind(wb, hb)).toBe(false); }
  });

  it("each boat stays near its spot, in order; with seed 7 boats 2 and 4, which were already visible, do not move", () => {
    for (const s of scenes) hulls(s).forEach((h, k) => expect(Math.abs(h.at.y - (-284 + k * 28))).toBeLessThanOrEqual(14));
    const seven = hulls(scenes[0]!);
    expect(seven[1]!.at).toEqual({ x: bayShoreX(-256) - 9, y: -256, z: 0 });
    expect(seven[3]!.at).toEqual({ x: bayShoreX(-200) - 9, y: -200, z: 0 });
  });
});

// ---------------------------------------------------------------- #327: attractions, booth row, food court

const A = () => fair(createRng(7));
const seeds = () => [createRng(7), zoneRng(SEED, "portfolio", 3), createRng(8)];
const build = (f: (out: Solid[], accents: Accent[]) => void): { solids: Solid[]; accents: Accent[] } => { const solids: Solid[] = [], accents: Accent[] = []; f(solids, accents); return { solids, accents }; };
const touch2 = (a: Bounds, b: Bounds) => a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y;
const isUmbrella = (x: Solid) => (x.kind === "cone" && x.r === 1.6) || (x.kind === "prism" && x.w === 0.25 && x.d === 0.25 && x.h === 2);
/** The boardwalk planks, railings, lamps and benches: everything `boardwalk()` emits, recognized by the plank stretches' boxes. */
const boardwalkOf = (solids: Solid[]) => {
  const planks = solids.filter((x) => x.kind === "prism" && x.mat === "deck" && x.d === 18 && x.h === 0.6).map(bounds);
  return solids.filter((x) => { const b = bounds(x); return planks.some((p) => b.min.x >= p.min.x - 0.01 && b.max.x <= p.max.x + 0.01 && b.min.y >= p.min.y - 0.01 && b.max.y <= p.max.y + 0.01); });
};

describe("ghost train (#327)", () => {
  it("stone 20×12 facade with portico, a 4-sided cone tower, copper marquee, doors and track", () => {
    const s = A();
    expect(GHOST).toEqual({ x: 98, y: -258, w: 20, d: 12 });
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "stone" && x.at.x === GHOST.x && x.at.y === GHOST.y && x.w === 20 && x.d === 12 && x.h === 6 && x.facade?.base === "portico")).toBe(true);
    expect(s.solids.some((x) => x.kind === "cone" && x.mat === "stone" && x.sides === 4 && x.r === 3)).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "copper" && x.w === 20 && x.d === 1.5 && x.h === 0.4)).toBe(true);
    const g = build(ghostTrain);
    expect(g.solids.filter((x) => x.kind === "poly" && x.mat === "rust").length).toBeGreaterThanOrEqual(4);
    expect(g.solids.filter((x) => x.kind === "strip" && x.mat === "rail").length).toBeGreaterThanOrEqual(2);
    const skull = s.accents.find((a) => a.kind === "poly" && a.color === "windowCool" && a.pts.length === 8 && a.pts.every((p) => p.y === -246.02));
    expect(skull).toBeDefined();
    expect(skull!.kind === "poly" && skull!.alpha).toBe(0.9);
  });
  it("neon.ghost: 8 points along the marquee at z 6.6", () => {
    const s = A();
    expect(s.neon.ghost).toHaveLength(8);
    for (const p of s.neon.ghost) { expect(p.z).toBe(6.6); expect(p.x).toBeGreaterThanOrEqual(GHOST.x); expect(p.x).toBeLessThanOrEqual(GHOST.x + GHOST.w); }
  });
});

describe("mirror house (#327)", () => {
  it("whitewash 16×12 with arcade facade, pediment with three glass mirrors and a garland", () => {
    const s = A();
    expect(MIRRORS).toEqual({ x: 124, y: -258, w: 16, d: 12 });
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "whitewash" && x.at.x === MIRRORS.x && x.at.y === MIRRORS.y && x.w === 16 && x.d === 12 && x.facade?.base === "arcade")).toBe(true);
    const ped = s.solids.find((x) => x.kind === "prism" && x.mat === "whitewash" && x.w === 16 && x.d === 1 && x.h === 1.5);
    expect(ped).toBeDefined();
    expect(ped!.kind === "prism" && ped!.plates?.filter((p) => p.mat === "glass").length).toBe(3);
    const m = build(mirrorHouse);
    expect(m.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.at.y === -245.9).length).toBeGreaterThanOrEqual(8);
  });
  it("neon.mirror: 6 points over the pediment at z 7.8", () => {
    const s = A();
    expect(s.neon.mirror).toHaveLength(6);
    for (const p of s.neon.mirror) { expect(p.z).toBe(7.8); expect(p.x).toBeGreaterThanOrEqual(MIRRORS.x); expect(p.x).toBeLessThanOrEqual(MIRRORS.x + MIRRORS.w); }
  });
});

describe("giant slide (#327)", () => {
  it("deck tower h 14, ≥ 24 deck treads descending from z 13 to 0.5 around it, railings and a tip light", () => {
    expect(SLIDE).toEqual({ x: 118, y: -292, r: 5, h: 14 });
    const { solids, accents } = build(slide);
    expect(solids.some((x) => x.kind === "prism" && x.mat === "deck" && x.w === 4 && x.d === 4 && x.h === 14)).toBe(true);
    expect(solids.some((x) => x.kind === "cone" && x.mat === "copper" && x.r === 3 && x.h === 2)).toBe(true);
    const treads = solids.flatMap((x) => {
      if (x.kind !== "poly" || x.mat !== "deck") return [];
      const cx = x.footprint.reduce((a, p) => a + p.x, 0) / x.footprint.length, cy = x.footprint.reduce((a, p) => a + p.y, 0) / x.footprint.length;
      return Math.abs(Math.hypot(cx - SLIDE.x, cy - SLIDE.y) - SLIDE.r) < 0.01 ? [x.z] : [];
    });
    expect(treads.length).toBeGreaterThanOrEqual(24);
    expect(treads[0]).toBeCloseTo(13, 9); expect(treads[treads.length - 1]).toBeCloseTo(0.5, 9);
    for (let k = 1; k < treads.length; k++) expect(treads[k]!).toBeLessThan(treads[k - 1]!);
    expect(solids.filter((x) => x.kind === "beam" && x.mat === "steel").length).toBeGreaterThanOrEqual(24);
    expect(accents.some((a) => a.kind === "dot" && a.color === "amber" && a.at.z > 16)).toBe(true);
    expect(A().solids.filter((x) => x.kind === "prism" && x.mat === "deck" && x.h === 14)).toHaveLength(1);
  });
});

describe("log flume (#327)", () => {
  it("raised deck channel with water, lift, drop to the bay and splash", () => {
    expect(FLUME).toEqual({ x0: 160, y: -296, w: 3 });
    expect(FAIR_MATS).toContain("shallow");
    expect(FLUME_DROP_X0).toBeCloseTo(FLUME_X1 - 6, 9);
    const { solids, accents } = build(flume);
    expect(solids.some((x) => x.kind === "strip" && x.mat === "shallow" && x.z >= 6)).toBe(true);
    expect(solids.some((x) => x.kind === "ramp" && x.mat === "deck" && x.at.x === 160 && x.at.z === 2.5 && x.h === 3.5)).toBe(true);
    const drop = solids.find((x) => x.kind === "ramp" && x.mat === "deck" && x.w === 6 && x.at.z === 0.2 && x.h === 5.8);
    expect(drop).toBeDefined();
    expect(drop!.kind === "ramp" && drop!.at.x + drop!.w).toBeCloseTo(FLUME_X1, 9);
    for (let y = FLUME.y; y <= FLUME.y + FLUME.w; y += 0.5) { expect(fairAt(FLUME_X1, y)).toBe(true); expect(bayWater(FLUME_X1, y)).toBe(false); }
    expect(bayWater(FLUME_X1 + 1, FLUME.y + FLUME.w)).toBe(true); // ends within 1 of the water where the shore comes closest (the band's south edge)
    const splash = accents.filter((a) => a.kind === "dot" && a.color === "windowCool");
    expect(splash).toHaveLength(6);
    for (const d of splash) if (d.kind === "dot") expect(bayWater(d.at.x, d.at.y)).toBe(true);
    expect(solids.filter((x) => x.kind === "prism" && x.mat === "steel" && x.w === 0.4 && x.d === 0.4).length).toBeGreaterThanOrEqual(5);
  });
  it("logSolids: two deck hulls 2.4 × 1 on the path", () => {
    const logs = logSolids(0);
    expect(logs).toHaveLength(2);
    for (const l of logs) expect(l).toMatchObject({ kind: "hull", len: 2.4, beam: 1, h: 0.6, mat: "deck" });
    expect(logs[0]!.kind === "hull" && logs[0]!.at).toEqual(FLUME_PATH[0]);
    for (const d of [-5, 0, 7.5, 33, 80, 1e4]) { const ls = logSolids(d); expect(ls).toHaveLength(2); for (const l of ls) { const b = bounds(l); expect(b.min.x).toBeGreaterThanOrEqual(FLUME.x0 - 2); expect(b.max.x).toBeLessThanOrEqual(FLUME_X1 + 2); } }
  });
  it("the channel crosses the boardwalk overhead", () => {
    const fl = build(flume).solids.map(bounds), bw = boardwalkOf(A().solids).map(bounds);
    let crossings = 0;
    for (const f of fl) for (const b of bw) if (touch2(f, b)) { crossings++; expect(f.min.z).toBeGreaterThanOrEqual(2.4); expect(f.min.z).toBeGreaterThanOrEqual(b.max.z); }
    expect(crossings).toBeGreaterThan(0);
  });
  it("no umbrella stands under the channel (seeds 7, 8 and the site's)", () => {
    const box = { min: { x: FLUME.x0, y: FLUME.y, z: 0 }, max: { x: FLUME_X1, y: FLUME.y + FLUME.w, z: 0 } };
    for (const r of seeds()) { const s = fair(r); expect(s.solids.filter((x) => x.kind === "cone" && x.r === 1.6).length).toBeGreaterThanOrEqual(10); for (const x of s.solids.filter(isUmbrella)) expect(touch2(bounds(x), box)).toBe(false); }
  });
});

describe("booth row (#327)", () => {
  it("12..16 slots on the sand, every 6 from y −294, none under the channel", () => {
    expect(BOOTH_ROW).toEqual({ y0: -294, y1: -210, step: 6 });
    const slots = boothSlots();
    expect(slots.length).toBeGreaterThanOrEqual(12); expect(slots.length).toBeLessThanOrEqual(16);
    for (const p of slots) { expect((p.y - BOOTH_ROW.y0) % 6).toBe(0); expect(p.y + 5 <= FLUME.y || p.y - 1 >= FLUME.y + FLUME.w).toBe(true); }
  });
  it("boothTypes: only catalog types and no two neighbours repeat, for 50 seeds", () => {
    expect(BOOTH_TYPES).toEqual(["food", "foodTruck", "shooting", "cottonCandy", "fortune", "tickets", "rings"]);
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const t = boothTypes(createRng(i));
      expect(t).toHaveLength(boothSlots().length);
      t.forEach((x, k) => { expect(BOOTH_TYPES).toContain(x); seen.add(x); if (k > 0) expect(x).not.toBe(t[k - 1]); });
    }
    expect(seen.size).toBe(7);
  });
  it("each booth type has its signature solid", () => {
    const types = boothSlots().map((_, k) => BOOTH_TYPES[k % BOOTH_TYPES.length]!);
    const solids: Solid[] = [], accents: Accent[] = [];
    boothRow(solids, accents, createRng(7), types);
    const has = (p: (x: Solid) => boolean) => expect(solids.some(p)).toBe(true);
    has((x) => x.kind === "prism" && x.roof === "gable" && x.w === 4 && x.d === 3 && x.h === 2.8); // food
    expect(solids.filter((x) => x.kind === "ramp" && (x.mat === "signal" || x.mat === "whitewash")).length).toBeGreaterThanOrEqual(2); // food awning
    expect(accents.filter((a) => a.kind === "poly" && a.color === "amber" && a.alpha === 0.9).length).toBeGreaterThanOrEqual(1); // foodTruck hatch
    has((x) => x.kind === "prism" && x.mat === "rust" && x.w === 4 && x.d === 3 && x.h === 2.6); // shooting
    expect(solids.filter((x) => x.kind === "prism" && x.w === 0.4 && x.d === 0.4 && x.h === 0.4).length).toBeGreaterThanOrEqual(4); // prizes
    has((x) => x.kind === "cylinder" && x.mat === "whitewash" && x.r === 1.5 && x.h === 2.5); // cottonCandy
    has((x) => x.kind === "cone" && x.mat === "signal" && x.r === 1.8);
    has((x) => x.kind === "cone" && x.mat === "copper" && x.r === 2 && x.h === 3.5); // fortune
    expect(accents.some((a) => a.kind === "dot" && a.color === "magenta")).toBe(true);
    has((x) => x.kind === "prism" && x.mat === "whitewash" && x.roof === "gable" && x.w === 2 && x.d === 2 && x.h === 2.8); // tickets
    has((x) => x.kind === "prism" && x.mat === "deck" && x.w === 4 && x.d === 3 && x.h === 0.8); // rings
    expect(solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.r === 0.15).length).toBeGreaterThanOrEqual(6);
    expect(solids.filter((x) => x.kind === "cylinder" && x.mat === "rust" && x.r === 0.5).length).toBeGreaterThanOrEqual(3);
  });
  it("every booth keeps an amber sign and a cyan or magenta dot; no booth touches another or the boardwalk", () => {
    for (const r of seeds()) {
      const solids: Solid[] = [], accents: Accent[] = [];
      boothRow(solids, accents, r);
      const n = boothSlots().length;
      expect(accents.filter((a) => a.kind === "poly" && a.color === "amber" && a.alpha === undefined)).toHaveLength(n);
      expect(accents.filter((a) => a.kind === "dot" && (a.color === "cyan" || a.color === "magenta")).length).toBeGreaterThanOrEqual(n);
      const bw = boardwalkOf(A().solids).map(bounds);
      for (const x of solids) { expect(FAIR_MATS).toContain(x.mat); for (const b of bw) expect(touch2(bounds(x), b)).toBe(false); }
    }
  });
});

describe("food court (#327)", () => {
  it("five trucks, 8 tables, 16 chairs and a garland, all inside FOOD_COURT", () => {
    expect(FOOD_COURT).toEqual({ x0: 100, x1: 160, y0: -176, y1: -170 });
    const { solids, accents } = build(foodCourt);
    const hatches = accents.filter((a) => a.kind === "poly" && a.color === "amber" && a.alpha === 0.9);
    expect(hatches).toHaveLength(5);
    for (const h of hatches) if (h.kind === "poly") for (const p of h.pts) { expect(p.y).toBeGreaterThanOrEqual(-176); expect(p.y).toBeLessThanOrEqual(-170); }
    expect(solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.w === 1 && x.d === 1 && x.h === 0.7)).toHaveLength(8);
    expect(solids.filter((x) => x.kind === "prism" && x.mat === "paving" && x.w === 0.5 && x.d === 0.5 && x.h === 0.5)).toHaveLength(16);
    expect(solids.filter((x) => x.kind === "prism" && x.mat === "steel" && x.w === 0.3 && x.d === 0.3 && x.h === 3)).toHaveLength(3);
    expect(accents.filter((a) => a.kind === "dot" && a.color === "amber").length).toBeGreaterThan(20);
    for (const x of solids) { const b = bounds(x); expect(b.min.x).toBeGreaterThanOrEqual(FOOD_COURT.x0 - 0.7); expect(b.max.x).toBeLessThanOrEqual(FOOD_COURT.x1 + 0.7); expect(b.min.y).toBeGreaterThanOrEqual(FOOD_COURT.y0 - 0.7); expect(b.max.y).toBeLessThanOrEqual(FOOD_COURT.y1 + 0.7); expect(FAIR_MATS).toContain(x.mat); }
  });
});

describe("footprints of the new pieces (#327)", () => {
  const pieces = (): [string, Solid[]][] => [
    ["ghost", build(ghostTrain).solids], ["mirrors", build(mirrorHouse).solids], ["slide", build(slide).solids],
    ["flume", build(flume).solids], ["booths", build((o, a) => boothRow(o, a, createRng(7))).solids], ["food", build(foodCourt).solids],
  ];
  it("legacyOnly builds the fair without the new pieces", () => {
    const old = fair(createRng(7), { legacyOnly: true });
    expect(old.solids.some((x) => x.kind === "prism" && x.mat === "deck" && x.h === 14)).toBe(false);
    expect(old.solids.some((x) => x.kind === "strip" && x.mat === "shallow")).toBe(false);
    expect(old.solids.some((x) => x.kind === "prism" && x.mat === "copper" && x.w === 20)).toBe(false);
  });
  it("no new footprint overlaps an old one (the channel crosses the boardwalk overhead), nor another new one", () => {
    const old = fair(createRng(7), { legacyOnly: true }).solids.filter((x) => !isUmbrella(x) && x.kind !== "hull");
    const bw = new Set(boardwalkOf(old));
    const ps = pieces();
    for (const [name, solids] of ps) for (const n of solids) {
      const nb = bounds(n);
      for (const o of old) {
        const ob = bounds(o);
        if (!touch2(nb, ob)) continue;
        if (name === "flume" && bw.has(o)) { expect(nb.min.z, `${name} over the boardwalk`).toBeGreaterThanOrEqual(Math.max(2.4, ob.max.z)); continue; }
        expect(true, `${name} ${n.kind} ${n.mat} at (${nb.min.x}, ${nb.min.y}) touches old ${o.kind} ${o.mat} at (${ob.min.x}, ${ob.min.y})`).toBe(false);
      }
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) for (const a of ps[i]![1]) for (const b of ps[j]![1]) expect(touch2(bounds(a), bounds(b)), `${ps[i]![0]} vs ${ps[j]![0]}`).toBe(false);
  });
  it("budget with everything: raised > 250 and ≤ 700, accents ≤ 200", () => {
    const s = A();
    const raised = s.solids.filter((x) => !isFlat(x)).length;
    expect(raised).toBeGreaterThan(250); expect(raised).toBeLessThanOrEqual(700);
    expect(s.accents.length).toBeLessThanOrEqual(200);
  });
});
