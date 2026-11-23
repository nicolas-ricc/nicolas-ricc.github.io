import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { fingerprint } from "../iso/fingerprint";
import { v3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { awning, dockCrane } from "../kit/props";
import { ESTUARY_Y0, QUAY_X } from "../map/geo";
import { createRng } from "../map/seed";
import { AVENUE, BRIDGE, COLLAPSED, EAST_RING, PROMENADE, ROWS, STREET, TOWER, TOWER_H, WEST_QUAY, estuaryEast } from "../scenes/city-grid";
import { plazaTone, tiles } from "../scenes/city-pieces";
import { BRIDGE_LANDING, PLAZA_CENTER, inParcel, PLAZA_MAYOR, TOWER_ISLAND } from "../scenes/city-plan";
import type { FixedLight } from "./lights";
import { bridge, collapsed, greenery, promenade, plazaAndTower, towerWindows, westQuay } from "./fixed";

const EPS = 1e-6;
/** Strict box overlap: two solids that only touch (one resting on the other) don't count. */
const overlaps = (a: Bounds, b: Bounds) =>
  a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS && a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS && a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS;
const overlapping = (solids: Solid[]) => {
  const bs = solids.map(bounds), out: [Solid, Solid][] = [];
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (overlaps(bs[i]!, bs[j]!)) out.push([solids[i]!, solids[j]!]);
  return out;
};
const prisms = (solids: Solid[]) => solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism");
const dots = (accents: Accent[]) => accents.filter((a): a is Accent & { kind: "dot" } => a.kind === "dot");

describe("bridge", () => {
  const built = () => { const solids: Solid[] = [], lights: FixedLight[] = []; bridge(solids, lights); return { solids, accents: lights.flatMap((l) => l.accents) }; };
  const top = BRIDGE.z + BRIDGE.deckH;

  it("deck, ramps and abutment as today; without the plaza piles", () => {
    const { solids } = built();
    const deck = solids.find((s) => s.kind === "prism" && s.mat === "asphalt" && s.w > 60);
    expect(deck).toMatchObject({ at: { x: WEST_QUAY.x0, y: BRIDGE.y0, z: BRIDGE.z }, w: EAST_RING.x1 - WEST_QUAY.x0, d: BRIDGE.y1 - BRIDGE.y0, h: BRIDGE.deckH });
    const ramps = solids.filter((s) => s.kind === "ramp" && s.mat === "asphalt");
    expect(ramps.map((r) => r.kind === "ramp" && r.dir).sort()).toEqual(["e", "w"]);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "plaza" && s.at.x === WEST_QUAY.x0 && s.at.z === 0.6)).toBe(true);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "plaza" && s.at.z === -1)).toBe(false);
  });

  it("at least four stone piers with a cutwater, from the bottom to the deck", () => {
    const piers = built().solids.filter((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.mat === "stone");
    expect(piers.length).toBeGreaterThanOrEqual(4);
    for (const p of piers) {
      expect(p.footprint).toHaveLength(6);
      expect(p.z).toBe(-1);
      expect(p.z + p.h).toBeCloseTo(BRIDGE.z, 9);
    }
  });

  it("18 arch slabs under the deck; in each span the lower edge rises toward the keystone", () => {
    const slabs = built().solids
      .filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && s.at.z < BRIDGE.z)
      .sort((a, b) => a.at.x - b.at.x);
    expect(slabs).toHaveLength(18);
    for (const s of slabs) {
      const b = bounds(s);
      expect(b.min.z).toBeGreaterThanOrEqual(-1);
      expect(Math.abs(b.max.z - BRIDGE.z)).toBeLessThan(1e-6);
    }
    for (let i = 0; i < 3; i++) {
      const zs = slabs.slice(i * 6, i * 6 + 6).map((s) => s.at.z);
      expect(Math.min(zs[2]!, zs[3]!)).toBeGreaterThan(Math.max(zs[0]!, zs[5]!));
    }
  });

  it("stone balustrade: at least 50 posts on the deck and two handrails; no officeDark railings", () => {
    const { solids } = built();
    const posts = solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.w === 0.3 && s.d === 0.3 && s.h === 0.9 && s.at.z === top);
    expect(posts.length).toBeGreaterThanOrEqual(50);
    const rails = solids.filter((s) => s.kind === "prism" && s.mat === "stone" && s.d === 0.2 && s.h === 0.2 && s.w > 60);
    expect(rails).toHaveLength(2);
    expect(solids.some((s) => s.kind === "prism" && s.mat === "officeDark")).toBe(false);
  });

  it("four obelisks at the corners, each with a pyramidal top and an amber dot on top; no street lamps", () => {
    const { solids, accents } = built();
    const obelisks = solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "stone" && s.w === 1.2 && s.d === 1.2 && s.h === 4);
    expect(obelisks).toHaveLength(4);
    const dots = accents.filter((a) => a.kind === "dot" && a.color === "amber");
    expect(dots).toHaveLength(4);
    for (const o of obelisks) {
      const cx = o.at.x + 0.6, cy = o.at.y + 0.6;
      expect(solids.some((s) => s.kind === "cone" && s.mat === "stone" && s.sides === 4 && s.r === 0.6 && s.h === 1 && s.at.x === cx && s.at.y === cy && s.at.z === o.at.z + 4)).toBe(true);
      expect(dots.some((a) => a.kind === "dot" && a.at.x === cx && a.at.y === cy && a.at.z > o.at.z + 5)).toBe(true);
    }
    expect(solids.some((s) => s.kind === "prism" && s.mat === "steel" && s.h === 5)).toBe(false);
  });

  it("each obelisk point owns exactly its obelisk prism and its cone (#171)", () => {
    const solids: Solid[] = [], lights: FixedLight[] = [];
    bridge(solids, lights);
    expect(lights).toHaveLength(4);
    for (const l of lights) {
      const [from, to] = l.own, [o, cap] = [solids[from]!, solids[from + 1]!];
      expect(to - from).toBe(2);
      expect(o).toMatchObject({ kind: "prism", mat: "stone", w: 1.2, d: 1.2, h: 4 });
      expect(cap).toMatchObject({ kind: "cone", mat: "stone" });
      if (o.kind === "prism") { expect(l.at.x).toBeCloseTo(o.at.x + 0.6, 6); expect(l.at.y).toBeCloseTo(o.at.y + 0.6, 6); }
    }
  });

  it("two cars of the size of props.car", () => {
    expect(built().solids.filter((s) => s.kind === "prism" && (s.mat === "steel" || s.mat === "rust") && s.h === 1.2)).toHaveLength(2);
  });

  it("no piece leaves the footprint of the bridge with its ramps", () => {
    const { solids, accents } = built();
    const inside = (x: number, y: number) => x >= BRIDGE.x0 - STREET - 1e-6 && x <= BRIDGE.x1 + STREET + 1e-6 && y >= BRIDGE.y0 - 1 - 1e-6 && y <= BRIDGE.y1 + 1 + 1e-6;
    for (const s of solids) { const b = bounds(s); expect(inside(b.min.x, b.min.y) && inside(b.max.x, b.max.y)).toBe(true); }
    for (const a of accents) if (a.kind === "dot") expect(inside(a.at.x, a.at.y)).toBe(true);
  });
});

describe("collapsed", () => {
  const built = () => { const solids: Solid[] = []; collapsed(solids, createRng(3)); return solids; };

  it("a sunken dome fragment, entirely in water, west of the ramp's lip and not touching the sunken blocks", () => {
    const solids = built();
    const domes = solids.filter((s): s is Solid & { kind: "dome" } => s.kind === "dome");
    expect(domes).toHaveLength(1);
    const d = domes[0]!;
    expect(d).toMatchObject({ mat: "officeDark", sides: 8, rings: 2, tone: -1 });
    expect(d.at.z).toBeLessThan(0);
    expect(d.h).toBeLessThan(d.r);
    expect(d.at.x + d.r).toBeLessThan(estuaryEast(d.at.y - d.r)); // the bank opens toward the south: the north edge is the tightest
    expect(d.at.x + d.r).toBeLessThanOrEqual(COLLAPSED.x - 6);   // low lip of the ramp
    const box = { x0: d.at.x - d.r, x1: d.at.x + d.r, y0: d.at.y - d.r, y1: d.at.y + d.r };
    const sunk = solids.filter((s) => s.kind === "prism" && s.mat === "officeDark" && s.at.z < 0);
    expect(sunk).toHaveLength(3);
    for (const s of sunk) {
      const b = bounds(s);
      expect(box.x0 < b.max.x && box.x1 > b.min.x && box.y0 < b.max.y && box.y1 > b.min.y).toBe(false);
    }
  });

  it("the dome consumes no rng: the rest of the collapse is as always", () => {
    expect(built().filter((s) => s.kind !== "dome")).toHaveLength(7); // ramp, platform, ruin, three sunken blocks, block in the street
    const a = createRng(3), b = createRng(3);
    collapsed([], a); b.int(2, 3); // the only draw: the height of the ruin
    expect(a.next()).toBe(b.next());
  });
});

describe("promenade", () => {
  const built = () => { const solids: Solid[] = [], lights: FixedLight[] = []; const bulbs = promenade(solids, lights); return { solids, accents: lights.flatMap((l) => l.accents), bulbs }; };
  const { x0, x1, y0, y1, z } = PROMENADE;

  it("the two long walls carry an arcade over the water", () => {
    const walls = prisms(built().solids).filter((s) => s.at.z === -1 && s.d > 30);
    expect(walls).toHaveLength(2);
    for (const w of walls) expect(w.facade).toEqual({ floors: 1, cols: Math.round(w.d / 6), base: "arcade", bands: false });
  });

  it("pergola: four deck posts on the walkway, outside the stairs, two beams of 12 and a garland at z ≈ 3.6", () => {
    const { solids, accents } = built();
    const posts = prisms(solids).filter((s) => s.mat === "deck" && s.w === 0.4 && s.d === 0.4 && s.h === 3);
    expect(posts).toHaveLength(4);
    for (const p of posts) {
      expect(p.at.z).toBe(z);
      expect(p.at.x).toBeGreaterThanOrEqual(x0);
      expect(p.at.x + p.w).toBeLessThanOrEqual(x1 - 6); // the stairs occupy x1 − 6 .. x1
    }
    const beams = prisms(solids).filter((s) => s.mat === "deck" && s.d === 12);
    expect(beams).toHaveLength(2);
    for (const b of beams) expect(b).toMatchObject({ w: 0.3, h: 0.3, at: { y: 221, z: z + 3 } });
    const lights = dots(accents).filter((a) => a.color === "amber" && a.r === 0.25 && Math.abs(a.at.z - 3.6) < EPS && a.at.x >= x0 && a.at.x <= x1 && a.at.y >= y0 && a.at.y <= y1);
    expect(lights.length).toBeGreaterThanOrEqual(6);
  });

  it("a kiosk at (x0 + 2, 240) on the walkway", () => {
    const k = prisms(built().solids).filter((s) => s.mat === "officeDark" && s.w === 2 && s.d === 2 && s.h === 2.4);
    expect(k).toHaveLength(1);
    expect(k[0]!.at).toEqual(v3(x0 + 2, 240, z));
  });

  it("returns today's 8 bulbs", () => {
    expect(built().bulbs).toEqual([180, 210, 250, 272, 284, 296, 308, 320].map((y) => v3(x1 - 3 + 0.3, y + 0.3, z + 5.4)));
  });

  it("no solid of the promenade overlaps another in box", () => {
    expect(overlapping(built().solids)).toEqual([]);
  });
});

describe("greenery (#319)", () => {
  it("no jungle cone north of the old first block row (164) west of the estuary: the seam belt is gone and the new strip is city (#320)", () => {
    const solids: Solid[] = [];
    greenery(solids, createRng(7));
    const cones = solids.filter((s) => s.kind === "cone" && (s.mat === "leaf" || s.mat === "leafDark"));
    expect(cones.length).toBeGreaterThan(0);
    expect(cones.filter((c) => c.kind === "cone" && c.at.y < ROWS[1]! && c.at.x < QUAY_X)).toEqual([]);
  });
});

describe("westQuay", () => {
  const built = () => { const solids: Solid[] = [], lights: FixedLight[] = []; westQuay(solids, lights); return { solids, accents: lights.flatMap((l) => l.accents) }; };
  const { x0, x1 } = WEST_QUAY;
  const inQuay = (b: Bounds) => b.min.x >= x0 - EPS && b.max.x <= x1 + EPS;

  it("wall in two stretches and stairs as today", () => {
    const { solids } = built();
    expect(prisms(solids).filter((s) => s.mat === "plaza" && s.at.x === x0 && s.at.z === -1 && s.w === x1 - x0 && s.h === 1.6)).toHaveLength(2);
    expect(solids.filter((s) => s.kind === "ramp" && s.mat === "plaza" && s.at.y === 194 && s.at.z === -1 && s.d === 6)).toHaveLength(1);
  });

  it("the wall starts at ESTUARY_Y0, not at the seam (#319)", () => {
    const wall = prisms(built().solids).filter((s) => s.mat === "plaza" && s.at.x === x0 && s.at.z === -1);
    expect(Math.min(...wall.map((s) => s.at.y))).toBe(ESTUARY_Y0);
  });

  it("two vault rust sheds on the quay, at y 164..176 and 178..190, within 192..198 and not overlapping", () => {
    const vaults = built().solids.filter((s): s is Solid & { kind: "vault" } => s.kind === "vault");
    expect(vaults).toHaveLength(2);
    for (const v of vaults) {
      expect(v).toMatchObject({ mat: "rust", axis: "y", len: 12, w: 5, h: 2.5, segments: 6 });
      expect(v.at.z).toBe(0.6);
      expect(inQuay(bounds(v))).toBe(true);
    }
    expect(vaults.map((v) => v.at.y).sort((a, b) => a - b)).toEqual([164, 178]);
    expect(overlaps(bounds(vaults[0]!), bounds(vaults[1]!))).toBe(false);
  });

  it("a dock crane on the wall and at least six bollards outside the sheds and stairs", () => {
    const { solids } = built();
    const masts = prisms(solids).filter((s) => s.mat === "steel" && s.w === 1 && s.d === 1 && s.h === 6);
    expect(masts).toHaveLength(1);
    expect(masts[0]!.at).toEqual(v3(195, 202, 0.6));
    const bollards = solids.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "rust" && s.r === 0.4);
    expect(bollards.length).toBeGreaterThanOrEqual(6);
    for (const b of bollards) {
      expect(b.at.z).toBe(0.6);
      expect(inQuay(bounds(b))).toBe(true);
      expect(b.at.y + b.r <= 194 || b.at.y - b.r >= 200).toBe(true);
    }
  });

  it("terraces: at least three tables and six chairs on the quay street (rows 177, 183, 189), before the avenue, without entering the wall", () => {
    const { solids } = built();
    const tables = prisms(solids).filter((s) => s.mat === "paving" && s.w === 1 && s.d === 1 && s.h === 0.7);
    const chairs = prisms(solids).filter((s) => s.mat === "paving" && s.w === 0.5 && s.d === 0.5 && s.h === 0.5);
    expect(tables.length).toBeGreaterThanOrEqual(3);
    expect(chairs.length).toBeGreaterThanOrEqual(6);
    const terrace = solids.filter((s) => bounds(s).max.x <= x0 + EPS && s.mat === "paving" && s.kind === "prism"); // tables and chairs (not the garland posts nor the awnings)
    expect(terrace.length).toBeGreaterThanOrEqual(tables.length + chairs.length);
    for (const s of terrace) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(185 - EPS);
      for (const [x, y] of [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.max.x, b.max.y], [b.min.x, b.max.y]] as const) expect(inParcel(x, y), `terrace corner ${x},${y} on a parcel`).toBe(false);
      expect(b.min.y).toBeGreaterThanOrEqual(174);   // facing the bars parcel of column 163 (y 174..195)
      expect(b.max.y).toBeLessThan(195);
    }
  });

  it("awnings against the parcel wall (x 182.5), facing the street, and a garland between posts", () => {
    const { solids, accents } = built();
    const awnings = solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
    expect(awnings.length).toBeGreaterThanOrEqual(3);
    for (const a of awnings) expect(a.kind === "ramp" && a.dir === "e" && a.at.x === 182.5).toBe(true);
    const posts = prisms(solids).filter((s) => s.mat === "steel" && s.w === 0.3 && s.d === 0.3 && s.h === 3);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    const lights = dots(accents).filter((a) => a.color === "amber" && a.r === 0.25 && a.at.x >= 185 && a.at.x <= x0 && a.at.y < AVENUE.y0);
    expect(lights.length).toBeGreaterThanOrEqual(6);
  });

  it("a table facing a shop window that already has an awning doesn't add another on top", () => {
    const solids: Solid[] = [...awning(v3(182.5, 175, 2.3), 5, "e")], lights: FixedLight[] = [];
    westQuay(solids, lights);
    const awnings = solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
    expect(awnings).toHaveLength(3); // the shop window's covers the first table (y 176..179): the other two keep their own
    expect(overlapping(awnings)).toEqual([]);
  });

  it("no solid of the quay overlaps another in box", () => {
    // mast and jib of the crane are a single prop: their internal overlap doesn't count, the rest does
    const crane = dockCrane(v3(195, 202, 0.6), "e").map((c) => JSON.stringify(c));
    const own = (s: Solid) => crane.includes(JSON.stringify(s));
    expect(overlapping(built().solids).filter(([a, b]) => !(own(a) && own(b)))).toEqual([]);
  });
});

describe("plazaAndTower", () => {
  const built = () => { const solids: Solid[] = [], ground: Solid[] = [], lights: FixedLight[] = []; const tower = plazaAndTower(solids, ground, lights, createRng(7)); return { solids, ground, accents: lights.flatMap((l) => l.accents), tower }; };
  const fountainOf = (solids: Solid[]) => solids.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "marble" && s.r === 3);
  const kiosksOf = (solids: Solid[]) => prisms(solids).filter((s) => s.mat === "officeDark" && s.w === 2 && s.d === 2 && s.h === 2.4);

  it("a marble fountain r 3 centered at PLAZA_CENTER with its puddle alpha 0.35", () => {
    const { solids, accents } = built();
    const f = fountainOf(solids);
    expect(f).toHaveLength(1);
    expect(f[0]!.at.x).toBe(PLAZA_CENTER.x);
    expect(f[0]!.at.y).toBe(PLAZA_CENTER.y);
    expect(accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.35)).toHaveLength(3);
  });

  it("two kiosks at the north corners, just south of the landing, inside the plaza and clear of the island and the landing", () => {
    const ks = kiosksOf(built().solids);
    expect(ks).toHaveLength(2);
    const P = PLAZA_MAYOR, ly1 = BRIDGE_LANDING.y + BRIDGE_LANDING.d;
    for (const k of ks) {
      const b = bounds(k);
      expect(b.min.x >= P.x && b.max.x <= P.x + P.w && b.max.y <= P.y + P.d).toBe(true);
      expect(b.min.y).toBeGreaterThanOrEqual(ly1);
      expect(b.min.y).toBeLessThan(ly1 + 3);
      expect(b.min.x < TOWER_ISLAND.x + TOWER_ISLAND.w - EPS && b.max.x > TOWER_ISLAND.x + EPS && b.min.y < TOWER_ISLAND.y + TOWER_ISLAND.d - EPS && b.max.y > TOWER_ISLAND.y + EPS).toBe(false);
    }
    expect(Math.min(...ks.map((k) => k.at.x))).toBeLessThan(P.x + 12);
    expect(Math.max(...ks.map((k) => k.at.x))).toBeGreaterThan(P.x + P.w - 6);
  });

  it("no furniture of the plaza enters TOWER_ISLAND or BRIDGE_LANDING", () => {
    const { solids } = built(), tower = solids.find((s) => s.kind === "prism" && s.h === TOWER_H)!;
    for (const s of solids) {
      if (s === tower || s.mat === "leaf" || s.mat === "office" || (s.mat === "officeDark" && bounds(s).min.z >= TOWER_H)) continue; // the tower, its vines, cornice and machine room
      const b = bounds(s);
      for (const r of [TOWER_ISLAND, BRIDGE_LANDING]) expect(b.min.x < r.x + r.w - EPS && b.max.x > r.x + EPS && b.min.y < r.y + r.d - EPS && b.max.y > r.y + EPS, `${s.kind} ${s.mat}`).toBe(false);
    }
  });

  it("the tiles partition the plaza: with the island and the landing they add up to 54 × 85, pairwise without overlap", () => {
    const { ground } = built();
    const plaza = ground.filter((g) => g.kind === "ground" && g.mat === "plaza"), landing = ground.filter((g) => g.kind === "ground" && g.mat === "paving");
    expect(plaza).toHaveLength(3);
    expect(landing).toHaveLength(1);
    const area = (g: Solid) => g.kind === "ground" ? g.tris.reduce((a, t) => a + Math.abs((t.pts[1].x - t.pts[0].x) * (t.pts[2].y - t.pts[0].y) - (t.pts[2].x - t.pts[0].x) * (t.pts[1].y - t.pts[0].y)) / 2, 0) : 0;
    const I = TOWER_ISLAND, P = PLAZA_MAYOR, inside = (I.x + I.w - P.x) * I.d;
    expect([...plaza, ...landing].reduce((a, g) => a + area(g), 0) + inside + P.w).toBeCloseTo(P.w * P.d, 6); // + the 1 u strip north of the landing (all curb)
    const boxes = [...plaza, ...landing].map((g) => g.kind === "ground" ? { x0: Math.min(...g.tris.flatMap((t) => t.pts.map((p) => p.x))), x1: Math.max(...g.tris.flatMap((t) => t.pts.map((p) => p.x))), y0: Math.min(...g.tris.flatMap((t) => t.pts.map((p) => p.y))), y1: Math.max(...g.tris.flatMap((t) => t.pts.map((p) => p.y))) } : null).filter((b) => b !== null);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      expect(a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS).toBe(false);
    }
  });

  it("the tower: 8 lit windows, the paper window on the east wall and no antenna", () => {
    const { tower, solids } = built();
    expect(tower.litWindows).toHaveLength(8);
    expect(tower.paperWindow.x).toBeCloseTo(TOWER.x + TOWER.w, 6);
    expect(tower).not.toHaveProperty("antenna");
    expect(solids.some((s) => s.kind === "cylinder" && s.mat === "steel" && bounds(s).min.z >= TOWER_H)).toBe(false); // no steel cylinder on the roof (#391)
  });

  const towerOf = (solids: Solid[]) => prisms(solids).find((s) => s.mat === "officeDark" && s.facade)!;

  it("towerWindows: tone −1, 0 and 1 give the same windows", () => {
    const t = towerOf(built().solids), flat = towerWindows(t, t.facade!);
    for (const tone of [-1, 0, 1]) {
      const got = towerWindows({ ...t, tone }, t.facade!);
      expect(got.litWindows).toHaveLength(8);
      expect(got).toEqual(flat);
    }
  });

  // fingerprint and paper window recorded on 5f893d9, before #52: a mismatch means the windows moved, so find what changed
  it("towerWindows with tone 0 is what plazaAndTower publishes, unchanged since the #52 baseline", () => {
    const { solids, tower } = built(), t = towerOf(solids), got = towerWindows(t, t.facade!);
    expect(got).toEqual({ litWindows: tower.litWindows, paperWindow: tower.paperWindow });
    expect(fingerprint(got.litWindows as unknown as Solid[])).toBe("9f80b655");
    expect(got.paperWindow).toEqual({ x: 137, y: 232.25, z: 20.625 });
  });

  it("the new items don't exceed 5 nor overlap benches, street lamps, curb or tower", () => {
    const { solids } = built();
    const kioskBodies = new Set<Solid>(kiosksOf(solids));
    const fresh = solids.filter((s) => s.mat === "marble" || s.mat === "terracotta" || kioskBodies.has(s));
    expect(fresh.length).toBe(2 + 4);
    const rest = solids.filter((s) => !fresh.includes(s)).map(bounds);
    for (const s of fresh) {
      const b = bounds(s);
      expect(b.max.z).toBeLessThanOrEqual(5);
      expect(rest.some((r) => overlaps(b, r))).toBe(false);
    }
  });

  it("the tower's two puddles keep alpha 0.25 and the rng is consumed as today", () => {
    expect(built().accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.25)).toHaveLength(6);
    const a = createRng(7), b = createRng(7);
    plazaAndTower([], [], [], a);
    const P = PLAZA_MAYOR, I = TOWER_ISLAND, L = BRIDGE_LANDING, ly1 = L.y + L.d;
    for (const r of [{ x: P.x, y: ly1, w: P.w, d: I.y - ly1 }, { x: I.x + I.w, y: I.y, w: P.x + P.w - I.x - I.w, d: I.d }, { x: P.x, y: I.y + I.d, w: P.w, d: P.y + P.d - I.y - I.d }]) tiles(b, r, 0.05, "plaza", plazaTone);
    tiles(b, L, 0.05, "paving", plazaTone);
    expect(a.next()).toBe(b.next());
  });
});
