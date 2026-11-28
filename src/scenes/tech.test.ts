import { describe, expect, it } from "vitest";
import { bounds, isFlat, tessellate, type Solid } from "../iso/solids";
import { RAIL_Y } from "./shipyard";
import { WORLD, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import { isStrip } from "../city/zoning";
import { GREEN_BELT, techBlocks, type SprawlBlock } from "./sprawl-grid";
import { ARENA, AUDITORIUM, MAX_TECH_H, TECH_MATS, tech } from "./tech";
import { techAnimator } from "./tech-animator";
import { ACCENT_CAP, NEIGHBORHOOD_REGION, WATERFRONT_RECT, FACE_CAPS, REGION_FACES_BEFORE, TECH_FACES_BEFORE, blockRect, facesIn, insideInflated } from "./tech-budget";
import { inNeighborhood, isCell, zoneKinds, type Kind } from "./tech-zoning";
import { southStreets } from "./tech-streets";
import { zoneRng } from "./world";
import { bleedTerrainAt, terrainAt } from "./terrain";

const scene = () => tech(createRng(7));
const groundAt = (x: number, y: number) => (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1 ? terrainAt(x, y) : bleedTerrainAt(x, y));
const inBlock = (x: Solid, b: { x: number; y: number; w?: number; d?: number }) => { const bb = bounds(x); return bb.min.x >= b.x - 0.5 && bb.max.x <= b.x + (b.w ?? 24) + 0.5 && bb.min.y >= b.y - 0.5 && bb.max.y <= b.y + (b.d ?? 18) + 0.5; };
/** The parcel block of a fixed cell (arena, auditorium). */
const cellBlock = (c: { col: number; row: number }): SprawlBlock => techBlocks().find((b) => isCell(b, c))!;

describe("tech", () => {
  it("is deterministic, falls in Resume with district materials and within budget", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
    const s = scene();
    const raised = s.solids.filter((x) => !isFlat(x));
    // cap = measured × 1.10, rounded up to the next hundred. Measured 1120 raised solids with tech(createRng(7)) on agent/479 without the west
    // (#479; it was 1524 with the west and the south): 1120 × 1.10 = 1232 → 1300
    // measured 2026-11-27 (#496, the strip, on main 1188e7d): 1599 × 1.10 = 1758.9 → 1800
    expect(raised.length).toBeGreaterThan(400); expect(raised.length).toBeLessThan(1800);
    for (const x of s.solids) {
      const b = bounds(x);
      expect(b.min.y).toBeGreaterThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("cv");
      expect(TECH_MATS).toContain(x.mat);
    }
  });

  it("the green belt's jungle west of the content: at least 20 cones inside GREEN_BELT, none within r + 1.5 of the west line", () => {
    const belt = scene().solids.filter((x): x is Solid & { kind: "cone" } => x.kind === "cone" && (x.mat === "leaf" || x.mat === "leafDark") && x.at.x < WORLD.x0 && x.at.y >= GREEN_BELT.y0 && x.at.y < GREEN_BELT.y1);
    expect(belt.length).toBeGreaterThanOrEqual(20);
    for (const c of belt) for (const ry of RAIL_Y) expect(Math.abs(c.at.y - ry)).toBeGreaterThanOrEqual(c.r + 1.5);
  });

  it("nothing rests on water; nothing non-slender exceeds MAX_TECH_H + plinth", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (x.kind !== "cone") expect(["water", "river", "sea", "shore", "abyss"]).not.toContain(groundAt(b.min.x, b.min.y));
      const slender = (x.kind === "prism" && x.w <= 3 && x.d <= 3) || (x.kind === "cylinder" && x.r <= 3);
      if (!slender) expect(b.max.z).toBeLessThanOrEqual(MAX_TECH_H + 1.5);
    }
  });

  it("the blocks are the south parcels, far from the content; the signs are amber", () => {
    const s = scene();
    expect(techBlocks().filter((b) => b.dist >= 160).length).toBeGreaterThan(5);
    expect(s.signs.length).toBeGreaterThan(0); // the auditorium's
    for (const a of s.signs) expect(a.kind === "poly" && a.color).toBe("amber");
  });

  it("landmarks: arena with light towers, glass auditorium with copper roof; bank wall", () => {
    const s = scene();
    const arena = cellBlock(ARENA), auditorium = cellBlock(AUDITORIUM);
    expect(s.solids.some((x) => x.kind === "poly" && x.mat === "stone" && inBlock(x, arena))).toBe(true);
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 12 && x.mat === "steel" && inBlock(x, arena))).toHaveLength(4);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "curtain" && x.sides === 12 && inBlock(x, auditorium))).toBe(true);
    expect(s.solids.some((x) => x.kind === "cone" && x.mat === "copper" && inBlock(x, auditorium))).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "plaza" && x.at.z === -1 && x.d > 200)).toBe(true);
  });
});

// the real world: the zone rng and the kind of each block according to the pre-pass
const worldScene = tech(zoneRng(SEED, "cv", 2));
// #496: tech() zones the core only; the strip (stripBlock) is not part of this pre-pass model
const worldBlocks = techBlocks().filter((b) => !isStrip(b.parcel!)), worldKinds = zoneKinds(zoneRng(SEED, "cv", 2), worldBlocks);
const everything = [...worldScene.solids, ...worldScene.ground];
/** `everything` without the south street furniture (multiset by JSON): lamps and trees on a sidewalk fall inside the neighboring blockRect. */
const furniture = southStreets();
const withoutFurniture = ((): Solid[] => {
  const left = new Map<string, number>();
  for (const s of [...furniture.solids, ...furniture.ground]) { const k = JSON.stringify(s); left.set(k, (left.get(k) ?? 0) + 1); }
  return everything.filter((s) => { const k = JSON.stringify(s), n = left.get(k) ?? 0; if (n > 0) { left.set(k, n - 1); return false; } return true; });
})();
// neighbors by cell: the south parcels sit on a 30-unit lattice
const neighbors = (a: SprawlBlock, b: SprawlBlock) => { const p = a.parcel, q = b.parcel; return !!p && !!q && ((p.cell.row === q.cell.row && Math.abs(p.cell.col - q.cell.col) === 30) || (p.cell.col === q.cell.col && Math.abs(p.cell.row - q.cell.row) === 30)); };
const homesOf = (kind: Kind) => worldScene.homes.filter((w) => worldBlocks.some((b, i) => { const r = blockRect(b); return worldKinds[i] === kind && w.pts.every((p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1); }));

describe("coastal neighborhood (#249)", () => {
  it("variety: two neighboring blocks of the neighborhood never have the same signature", () => {
    const r2 = (v: number) => Math.round(v * 2) / 2;
    const signature = (b: SprawlBlock, kind: Kind) => {
      const raised = worldScene.solids.filter((x) => !isFlat(x) && insideInflated(x, blockRect(b)));
      const prints = raised.flatMap((x) => {
        if ((x.kind !== "prism" && x.kind !== "poly" && x.kind !== "ramp") || x.h < 1) return [];
        const bb = bounds(x);
        return [[r2(bb.min.x - b.x), r2(bb.min.y - b.y), r2(bb.max.x - bb.min.x), r2(bb.max.y - bb.min.y)].join(",")];
      }).sort();
      return `${kind}|${raised.length}|${prints.join(";")}`;
    };
    let pairs = 0;
    worldBlocks.forEach((a, i) => worldBlocks.forEach((b, j) => {
      if (j <= i || !neighbors(a, b) || !inNeighborhood(a) || !inNeighborhood(b)) return;
      pairs++;
      expect(signature(a, worldKinds[i]!), `${a.x},${a.y} ↔ ${b.x},${b.y}`).not.toBe(signature(b, worldKinds[j]!));
    }));
    expect(pairs).toBeGreaterThan(10);
  });

  it("lights: flat windows on a wall, homogeneous groups, lit fractions per kind", () => {
    expect(worldScene.homes.length).toBeGreaterThan(0);
    const byGroup = new Map<string, boolean>();
    for (const w of worldScene.homes) {
      expect(w.pts).toHaveLength(4);
      expect(w.pts.every((p) => p.x === w.pts[0]!.x) || w.pts.every((p) => p.y === w.pts[0]!.y)).toBe(true);
      if (byGroup.has(w.group)) expect(w.lit, w.group).toBe(byGroup.get(w.group));
      byGroup.set(w.group, w.lit);
    }
    const share = (ws: { lit: boolean }[]) => ws.filter((w) => w.lit).length / ws.length;
    const mono = homesOf("monoblock"), houseHomes = homesOf("houses");
    expect(mono.length).toBeGreaterThan(0); expect(houseHomes.length).toBeGreaterThan(0);
    expect(share(mono)).toBeGreaterThanOrEqual(0.30); expect(share(mono)).toBeLessThanOrEqual(0.45);
    expect(share(houseHomes)).toBeGreaterThanOrEqual(0.15); expect(share(houseHomes)).toBeLessThanOrEqual(0.40);
    const fixed = [...homesOf("school"), ...homesOf("club")];
    expect(fixed.length).toBeGreaterThanOrEqual(2);
    for (const w of fixed) expect(w.lit).toBe(true);
  });

  it("the neighborhood materials are in TECH_MATS", () => {
    for (const m of ["tile", "brick", "whitewash", "signal", "safety", "hullBlue", "sand"] as Material[]) expect(TECH_MATS).toContain(m);
  });
});

describe("face and accent budget (#249)", () => {
  it("facesIn counts the solids that fall entirely in the rect inflated by 0.5", () => {
    const box: Solid = { kind: "prism", at: { x: 1, y: 1, z: 0 }, w: 2, d: 2, h: 2, mat: "stone" };
    expect(facesIn([box], { x0: 0, y0: 0, x1: 3.5, y1: 3.5 })).toBe(tessellate(box).length);
    expect(facesIn([box], { x0: 0, y0: 0, x1: 2.4, y1: 10 })).toBe(0);
  });
  it("blockRect: the block plus 2 of sidewalk", () => {
    expect(blockRect({ x: 132, y: 448, w: 24, d: 18 })).toEqual({ x0: 130, y0: 446, x1: 158, y1: 468 });
  });
  it("the whole district ≤ +10 %, the neighborhood region ≤ +25 %", () => {
    expect(facesIn(everything, { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 })).toBeLessThanOrEqual(Math.floor(TECH_FACES_BEFORE * 1.1));
    expect(facesIn(everything, NEIGHBORHOOD_REGION)).toBeLessThanOrEqual(Math.floor(REGION_FACES_BEFORE * 1.25));
  });
  it("each new block and the waterfront within its cap", () => {
    worldBlocks.forEach((b, i) => {
      const k = worldKinds[i]!;
      if (k === "monoblock" || k === "houses" || k === "plaza" || k === "school" || k === "club" || k === "low") expect(facesIn(withoutFurniture, blockRect(b)), `${k} ${b.x},${b.y}`).toBeLessThanOrEqual(FACE_CAPS[k]);
    });
    expect(facesIn(everything, WATERFRONT_RECT)).toBeLessThanOrEqual(FACE_CAPS.waterfront);
  });
  it("accents: static ones plus frame 0 of all layers ≤ ACCENT_CAP", () => {
    const a = techAnimator(worldScene, createRng(SEED + 5), { reducedMotion: false });
    const layers = a.ids.reduce((n, id) => { const l = a.layer(id); return n + (l.kind === "accent" ? l.accents.length : 0); }, 0);
    expect(worldScene.accents.length + layers).toBeLessThanOrEqual(ACCENT_CAP);
  });
});

describe("tech without the west (#479)", () => {
  const s = tech(zoneRng(SEED, "cv", 2));
  const beltCone = (x: Solid) => x.kind === "cone" && x.at.x < WORLD.x0 && x.at.y >= GREEN_BELT.y0 && x.at.y < GREEN_BELT.y1;

  it("tech builds nothing north of y 318 but the green belt's jungle", () => {
    for (const x of [...s.solids, ...s.ground]) if (bounds(x).max.y < 318) expect(beltCone(x), `${x.kind} ${x.mat} ${JSON.stringify(bounds(x))}`).toBe(true);
  });

  it("no west towers or campus: no curtain-wall solid north of y 318", () => {
    expect(s.solids.some((x) => x.mat === "curtain" && bounds(x).min.y < 318)).toBe(false);
  });

  it("TechScene has no mastRing, telecom or towers", () => {
    expect(s).not.toHaveProperty("telecom");
    expect(s).not.toHaveProperty("towers");
    expect(s).not.toHaveProperty("neon");
  });
});
