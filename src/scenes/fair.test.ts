import { describe, expect, it } from "vitest";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { bounds, isFlat, type Bounds, type Solid } from "../iso/solids";
import { worldZoneAt } from "../map/geo";
import { createRng, SEED } from "../map/seed";
import { COASTER_PROFILE, DROP, FAIR_MATS, LIFT_SEGMENTS, PIER, WHEEL, coasterPath, dropSolids, fair, trainSolids, wheelSolid } from "./fair";
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
    expect(s.accents.length).toBeLessThanOrEqual(120);
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
      if (!pier && !onPier && !pavilionCone) expect(bayWater(cx, cy)).toBe(false);
      if (!slender(x)) expect(b.max.z).toBeLessThanOrEqual(18.5);
    }
  });

  it("boardwalk with street lamps, pier with pavilion and garland, ≥ 8 gabled booths, carousel, arcades with facade, bumper cars, umbrellas, gate", () => {
    const s = scene();
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "deck" && x.d === 18 && x.h === 0.6).length).toBeGreaterThanOrEqual(6);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "deck" && x.at.z === -1 && x.w === 46)).toBe(true);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "whitewash" && x.r === 5 && x.sides === 8)).toBe(true);
    expect(s.solids.filter((x) => x.kind === "prism" && x.roof === "gable" && x.w === 4 && x.d === 3).length).toBeGreaterThanOrEqual(8);
    expect(s.solids.some((x) => x.kind === "cone" && x.mat === "whitewash" && x.r === 7)).toBe(true); // carousel
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "whitewash" && x.w === 24 && x.facade)).toBe(true); // arcade
    expect(s.solids.filter((x) => x.kind === "cone" && x.r === 1.6).length).toBeGreaterThanOrEqual(10); // umbrellas
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "stone" && x.h === 6)).toHaveLength(2); // gate
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
