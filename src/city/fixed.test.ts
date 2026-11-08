import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { fingerprint } from "../iso/fingerprint";
import { v3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { awning, dockCrane } from "../kit/props";
import { ESTUARY_Y0, QUAY_X } from "../map/geo";
import { createRng } from "../map/seed";
import { AVENUE, BLOCK_W, BRIDGE, COLLAPSED, EAST_RING, PROMENADE, PLAZA, ROWS, SIDEWALK, STREET, TOWER, WEST_QUAY, blocks, estuaryEast } from "../scenes/city-grid";
import { plazaTone, tiles } from "../scenes/city-pieces";
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
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; bridge(solids, accents); return { solids, accents }; };
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
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; const bulbs = promenade(solids, accents); return { solids, accents, bulbs }; };
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
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; westQuay(solids, accents); return { solids, accents }; };
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

  it("terraces: at least six tables and twelve chairs on the quay street, before the avenue, without entering the wall or a block", () => {
    const { solids } = built();
    const tables = prisms(solids).filter((s) => s.mat === "paving" && s.w === 1 && s.d === 1 && s.h === 0.7);
    const chairs = prisms(solids).filter((s) => s.mat === "paving" && s.w === 0.5 && s.d === 0.5 && s.h === 0.5);
    expect(tables.length).toBeGreaterThanOrEqual(6);
    expect(chairs.length).toBeGreaterThanOrEqual(12);
    const terrace = solids.filter((s) => bounds(s).max.x <= x0 + EPS && s.mat !== "awning"); // the awnings hang from the lot wall, over the block's sidewalk
    expect(terrace.length).toBeGreaterThanOrEqual(tables.length + chairs.length);
    for (const s of terrace) {
      const b = bounds(s);
      expect(b.min.x).toBeGreaterThanOrEqual(186 - EPS);
      expect(b.max.y).toBeLessThan(AVENUE.y0);
      expect(blocks().some((k) => b.min.x < k.x + k.w - EPS && b.max.x > k.x + EPS && b.min.y < k.y + k.d - EPS && b.max.y > k.y + EPS)).toBe(false);
    }
  });

  it("awnings against the lot wall (x 184.5, the 1.5 sidewalk inside the block), facing the street, and a garland between posts", () => {
    const { solids, accents } = built();
    const awnings = solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
    expect(awnings.length).toBeGreaterThanOrEqual(6);
    for (const a of awnings) expect(a.kind === "ramp" && a.dir === "e" && a.at.x === 162 + BLOCK_W - SIDEWALK).toBe(true);
    const posts = prisms(solids).filter((s) => s.mat === "steel" && s.w === 0.3 && s.d === 0.3 && s.h === 3);
    expect(posts.length).toBeGreaterThanOrEqual(2);
    const lights = dots(accents).filter((a) => a.color === "amber" && a.r === 0.25 && a.at.x >= 186 && a.at.x <= x0 && a.at.y < AVENUE.y0);
    expect(lights.length).toBeGreaterThanOrEqual(6);
  });

  it("a table facing a shop window that already has an awning doesn't add another on top", () => {
    const solids: Solid[] = [...awning(v3(184.5, 166, 2.3), 5, "e")], accents: Accent[] = [];
    westQuay(solids, accents);
    const awnings = solids.filter((s) => s.kind === "ramp" && s.mat === "awning");
    expect(awnings).toHaveLength(6); // the shop window's plus five of the six tables
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
  const built = () => { const solids: Solid[] = [], ground: Solid[] = [], accents: Accent[] = []; const tower = plazaAndTower(solids, ground, accents, createRng(7)); return { solids, ground, accents, tower }; };
  const fountainOf = (solids: Solid[]) => solids.filter((s): s is Solid & { kind: "cylinder" } => s.kind === "cylinder" && s.mat === "marble" && s.r === 3);
  const kiosksOf = (solids: Solid[]) => prisms(solids).filter((s) => s.mat === "officeDark" && s.w === 2 && s.d === 2 && s.h === 2.4);

  it("a marble fountain r 3 centered at (150, 227) with its puddle alpha 0.35", () => {
    const { solids, accents } = built();
    const f = fountainOf(solids);
    expect(f).toHaveLength(1);
    expect(f[0]!.at.x).toBe(150);
    expect(f[0]!.at.y).toBe(227);
    expect(accents.filter((a) => a.kind === "poly" && a.color === "amberBleed" && a.alpha === 0.35)).toHaveLength(3);
  });

  it("two kiosks inside the plaza, at the north corners", () => {
    const { solids } = built();
    const ks = kiosksOf(solids);
    expect(ks).toHaveLength(2);
    for (const k of ks) {
      const b = bounds(k);
      expect(b.min.x >= PLAZA.x && b.max.x <= PLAZA.x + PLAZA.w && b.min.y >= PLAZA.y && b.max.y <= PLAZA.y + PLAZA.d).toBe(true);
      expect(b.min.y).toBeLessThan(PLAZA.y + 3);
    }
    expect(Math.min(...ks.map((k) => k.at.x))).toBeLessThan(PLAZA.x + 6);
    expect(Math.max(...ks.map((k) => k.at.x))).toBeGreaterThan(PLAZA.x + PLAZA.w - 6);
  });

  it("the tower as before: 8 lit windows, antenna and the paper window on the east wall", () => {
    const { tower } = built();
    expect(tower.litWindows).toHaveLength(8);
    expect(tower.paperWindow.x).toBeCloseTo(TOWER.x + TOWER.w, 6);
    expect(tower.antenna.z).toBeGreaterThan(35);
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
    plazaAndTower([], [], [], a); tiles(b, PLAZA, 0.05, "plaza", plazaTone);
    expect(a.next()).toBe(b.next());
  });
});
