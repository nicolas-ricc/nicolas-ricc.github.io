import { describe, expect, it } from "vitest";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { COVER_MARGIN, WORLD, inCoverQuad } from "../map/geo";
import { createRng, SEED, type Rng } from "../map/seed";
import { EXHIBITS } from "../lab/exhibits";
import { CITY_EDGE } from "./city-grid";
import { PLINTH_H } from "./city-pieces";
import { axis, axisBand, onAxis, pointInPoly, type Parcel } from "./city-plan";
import { newCtx, blockAt } from "./neighborhood-fixtures";
import { houses } from "./neighborhood-houses";
import { monoblock } from "./neighborhood-monoblock";
import { plaza } from "./neighborhood-plaza";
import { parcelBlock, southParcels, techBlocks, urbanAt, type SprawlBlock } from "./sprawl-grid";
import { tech } from "./tech";
import { southStreets } from "./tech-streets";
import { ARENA, AUDITORIUM, CLUB, PLAZAS, SCHOOL, blockParity, inNeighborhood, isCell, zoneKinds, type Kind } from "./tech-zoning";
import { zoneRng } from "./world";
import { bleedTerrainAt, terrainAt } from "./terrain";

// Acceptance criteria of #478 (the coastal neighborhood on the city-plan grid south of the Avenida del Sur).

const scene = tech(zoneRng(SEED, "cv", 2));
const blocks = techBlocks(), kinds = zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const south = blocks.map((b, i) => ({ b, k: kinds[i]!, p: b.parcel })).filter((x): x is { b: SprawlBlock; k: Kind; p: Parcel } => x.p !== undefined);
const rectCorners = (r: { x: number; y: number; w: number; d: number }) => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]] as const;
const southUrban = (x: number, y: number) => urbanAt(x, Math.max(y, CITY_EDGE.south));
const within = (s: Solid, r: { x: number; y: number; w: number; d: number }, m: number) => { const q = bounds(s); return q.min.x >= r.x - m && q.max.x <= r.x + r.w + m && q.min.y >= r.y - m && q.max.y <= r.y + r.d + m; };
/** Every solid of the scene that is not street furniture (multiset subtraction of `southStreets()`). */
const furniture = southStreets();
const minus = (solids: readonly Solid[], drop: readonly Solid[]): Solid[] => {
  const left = new Map<string, number>();
  for (const s of drop) { const k = JSON.stringify(s); left.set(k, (left.get(k) ?? 0) + 1); }
  return solids.filter((s) => { const k = JSON.stringify(s), n = left.get(k) ?? 0; if (n > 0) { left.set(k, n - 1); return false; } return true; });
};
const pieces = minus([...scene.solids, ...scene.ground], [...furniture.solids, ...furniture.ground]);
const own = (p: Parcel, m = 2.5) => pieces.filter((s) => within(s, p.rect, m));
const fixedOf = (c: { col: number; row: number }) => { const xs = south.filter((x) => isCell(x.b, c)); expect(xs, JSON.stringify(c)).toHaveLength(1); return xs[0]!; };
const neighbors = (a: Parcel, b: Parcel) => (a.cell.row === b.cell.row && Math.abs(a.cell.col - b.cell.col) === 30) || (a.cell.col === b.cell.col && Math.abs(a.cell.row - b.cell.row) === 30);

describe("south parcels (#478)", () => {
  it("southParcels(): more than 40 parcels, all south of y 318 on urban land inside the cover", () => {
    const ps = southParcels();
    expect(ps.length).toBeGreaterThan(40);
    for (const p of ps) {
      expect(p.c.y).toBeGreaterThan(318);
      expect(southUrban(p.c.x, p.c.y)).toBe(true);
      for (const [x, y] of rectCorners(p.rect)) expect(southUrban(x, y), `${p.cell.col},${p.cell.row}`).toBe(true);
      expect(inCoverQuad(p.c.x, p.c.y, 16 / 9, COVER_MARGIN)).toBe(true);
    }
  });
  it("the row right south of the Avenida del Sur is built (the 318..324 strip is asphalt, not a hole)", () => {
    for (const col of [103, 133, 163]) expect(southParcels().some((p) => p.cell.col === col && p.cell.row === 321), `${col}`).toBe(true);
  });
  it("techBlocks(): one block per south parcel", () => {
    expect(blocks).toEqual(southParcels().map(parcelBlock));
    expect(blocks.every((b) => b.parcel !== undefined)).toBe(true);
  });
});

describe("zoning of the south (#478)", () => {
  it("the fixed ones fall on their cell with any seed", () => {
    for (const rng of [createRng(1), createRng(7), zoneRng(SEED, "cv", 2)]) {
      const ks = zoneKinds(rng, blocks), at = (c: { col: number; row: number }) => ks[blocks.findIndex((b) => isCell(b, c))];
      expect(at(SCHOOL)).toBe("school"); expect(at(CLUB)).toBe("club"); expect(at(ARENA)).toBe("arena"); expect(at(AUDITORIUM)).toBe("auditorium");
      for (const p of PLAZAS) expect(at(p)).toBe("plaza");
    }
  });
  it("blockParity uses the cell and alternates between neighboring parcels", () => {
    for (const { b, p } of south) expect(blockParity(b)).toBe((((p.cell.col - 13) / 30 + (p.cell.row - 21) / 30) & 1));
    for (const a of south) for (const c of south) if (neighbors(a.p, c.p)) expect(blockParity(a.b)).not.toBe(blockParity(c.b));
  });
  it("consumes exactly one chance(0.12) per non-fixed block", () => {
    const real = zoneRng(SEED, "cv", 2), calls: string[] = [];
    const spy: Rng = { next: () => { calls.push("next"); return real.next(); }, int: (a, b) => { calls.push("int"); return real.int(a, b); }, chance: (p) => { calls.push(`chance:${p}`); return real.chance(p); }, pick: (arr) => { calls.push("pick"); return real.pick(arr); } };
    zoneKinds(spy, blocks);
    expect(calls).toEqual(Array(blocks.length - 6).fill("chance:0.12")); // 6 fixed cells
  });
  it("bajo parcels are low; residencial ones are houses, monoblock, plaza or low; every south parcel is in the neighborhood", () => {
    for (const { b, k, p } of south) {
      expect(inNeighborhood(b)).toBe(true);
      const fixed = [SCHOOL, CLUB, ARENA, AUDITORIUM, ...PLAZAS].some((c) => isCell(b, c));
      if (fixed) continue;
      if (p.barrio === "bajo") expect(k, `${p.cell.col},${p.cell.row}`).toBe("low");
      else expect(["houses", "monoblock", "plaza", "low"]).toContain(k);
      if (k === "monoblock") expect(p.area).toBeGreaterThanOrEqual(450);
    }
  });
  it("no monoblock has a monoblock neighbor", () => {
    for (const a of south) for (const c of south) if (a.k === "monoblock" && neighbors(a.p, c.p)) expect(c.k).not.toBe("monoblock");
  });
});

describe("tech on the south parcels (#478)", () => {
  it("tech builds only parcels south of y 318: nothing of tech east of the city's west edge reaches north of 318", () => {
    for (const s of scene.solids) {
      const q = bounds(s);
      if (q.min.x >= CITY_EDGE.west) expect(q.min.y, JSON.stringify(q)).toBeGreaterThanOrEqual(318);
    }
    for (const { p } of south) expect(p.c.y).toBeGreaterThan(318);
  });

  it("the base of every built parcel follows its polygon (a low piece that brings its own ground stays at street level, as in the city)", () => {
    for (const { k, p } of south) {
      if (k === "low" && !pieces.some((s) => s.kind === "poly" && s.mat === "paving" && JSON.stringify(s.footprint) === JSON.stringify(p.poly))) { expect(own(p, 0.5).some((s) => isFlat(s)), `${p.cell.col},${p.cell.row}`).toBe(true); continue; }
      const base = pieces.find((s) => s.kind === "poly" && JSON.stringify(s.footprint) === JSON.stringify(p.poly));
      expect(base, `${k} ${p.cell.col},${p.cell.row}`).toBeDefined();
    }
  });

  it("school, club, plazas and monoblocks still exist", () => {
    const count = (k: Kind) => south.filter((x) => x.k === k).length;
    expect(count("school")).toBeGreaterThanOrEqual(1); expect(count("club")).toBeGreaterThanOrEqual(1);
    for (const c of PLAZAS) expect(fixedOf(c).k).toBe("plaza");
    expect(count("monoblock")).toBeGreaterThanOrEqual(3);
    expect(count("houses")).toBeGreaterThanOrEqual(5);
    expect(count("low")).toBeGreaterThanOrEqual(10);
  });

  it("auditorium and arena sit on parcels, not on an axis", () => {
    for (const c of [ARENA, AUDITORIUM]) {
      const { p } = fixedOf(c), mine = own(p, 0.5).filter((s) => !isFlat(s));
      expect(mine.length).toBeGreaterThan(3);
      // a neighbor's corner lamp (steel, h 5) may stand within 6
      for (const s of pieces.filter((s) => !isFlat(s) && !(s.kind === "prism" && s.mat === "steel" && s.h === 5) && within(s, p.rect, 6))) expect(within(s, p.rect, 0.5), JSON.stringify(bounds(s))).toBe(true);
      expect(onAxis(p.rect.x + p.rect.w / 2, p.rect.y + p.rect.d / 2)).toBe(false);
    }
    expect(pieces.some((s) => s.kind === "cylinder" && s.mat === "curtain" && within(s, fixedOf(AUDITORIUM).p.rect, 0.5))).toBe(true);
    expect(pieces.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 12 && within(s, fixedOf(ARENA).p.rect, 0.5))).toHaveLength(4);
  });

  it("bajo/residencial heights within spec: low ≤ 6 + plinth, house walls ≤ 4.2, monoblock bodies ≤ 13", () => {
    for (const { k, p } of south) {
      const mine = own(p, 0.5), at = `${k} ${p.cell.col},${p.cell.row}`;
      if (k === "low") for (const s of mine) expect(bounds(s).max.z, at).toBeLessThanOrEqual(6 + PLINTH_H + 1e-9);
      if (k === "houses") for (const s of mine) if (s.kind === "prism" && s.roof === "gable") expect(s.h, at).toBeLessThanOrEqual(4.2);
      if (k === "monoblock") for (const s of mine) if (s.kind === "prism" && s.d === 5 && s.h >= 3) expect(s.at.z + s.h, at).toBeLessThanOrEqual(13);
    }
  });

  it("variety: two neighboring residencial parcels never have the same signature", () => {
    const r2 = (v: number) => Math.round(v * 2) / 2;
    const signature = ({ k, p }: { k: Kind; p: Parcel }) => {
      const raised = own(p).filter((s) => !isFlat(s));
      const prints = raised.flatMap((s) => {
        if ((s.kind !== "prism" && s.kind !== "poly" && s.kind !== "ramp") || s.h < 1) return [];
        const q = bounds(s);
        return [[r2(q.min.x - p.rect.x), r2(q.min.y - p.rect.y), r2(q.max.x - q.min.x), r2(q.max.y - q.min.y)].join(",")];
      }).sort();
      return `${k}|${raised.length}|${prints.join(";")}`;
    };
    let pairs = 0;
    const res = south.filter((x) => x.p.barrio === "residencial");
    res.forEach((a, i) => res.forEach((c, j) => { if (j > i && neighbors(a.p, c.p)) { pairs++; expect(signature(a), `${a.p.cell.col},${a.p.cell.row} ↔ ${c.p.cell.col},${c.p.cell.row}`).not.toBe(signature(c)); } }));
    expect(pairs).toBeGreaterThan(10);
  });

  it("nothing of the south rests on water", () => {
    const groundAt = (x: number, y: number) => (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1 ? terrainAt(x, y) : bleedTerrainAt(x, y));
    for (const s of scene.solids) { const q = bounds(s); if (s.kind !== "cone" && q.min.y > 318) expect(["water", "river", "sea", "shore", "abyss"], JSON.stringify(q)).not.toContain(groundAt(q.min.x, q.min.y)); }
  });

  it("homes: flat windows on a wall, homogeneous groups, low windows grouped per parcel", () => {
    const lit = new Map<string, boolean>();
    for (const w of scene.homes) {
      expect(w.pts).toHaveLength(4);
      if (lit.has(w.group)) expect(w.lit, w.group).toBe(lit.get(w.group));
      lit.set(w.group, w.lit);
    }
    const lows = south.filter((x) => x.k === "low");
    expect(scene.homes.some((w) => w.group.endsWith(":low"))).toBe(true);
    for (const w of scene.homes.filter((h) => h.group.endsWith(":low"))) expect(lows.some(({ p }) => w.group === `${p.rect.x},${p.rect.y}:low`), w.group).toBe(true);
  });
});

describe("south avenues (#478)", () => {
  const all = [...scene.ground, ...scene.solids];
  const strips = (pred: (s: Solid & { kind: "strip" }) => boolean) => all.filter((s): s is Solid & { kind: "strip" } => s.kind === "strip" && pred(s));
  const onBand = (id: string, x: number, y: number) => pointInPoly(x, y, axisBand(axis(id)));
  const lamps = all.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5);

  it("the Avenida del Barrio, the Diagonal Sur, the costanera and the bulevar continue inside the barrio", () => {
    for (const id of ["barrio", "diagonalSur"]) {
      const dashes = strips((s) => s.mat === "paving" && s.width === 0.4 && s.path.every((q) => q.y > 330 && onBand(id, q.x, q.y)));
      expect(dashes.length, `${id} lanes`).toBeGreaterThan(5);
    }
    const planter = all.filter((s) => s.kind === "prism" && s.mat === "leafDark" && s.w === 4 && s.h === 0.3 && s.at.y > 330 && onBand("bulevar", s.at.x + 2, s.at.y + 1));
    expect(planter.length, "bulevar planter").toBeGreaterThanOrEqual(2);
    expect(all.some((s) => s.kind === "cone" && s.at.y > 330 && Math.abs(s.at.x - 10) < 2), "bulevar trees").toBe(true);
    for (const id of ["barrio", "diagonalSur", "bulevar"]) expect(lamps.some((l) => l.at.y > 330 && onBand(id, l.at.x + 0.3, l.at.y + 0.3)), `${id} lamps`).toBe(true);
    // the costanera south of 324 is the waterfront: its promenade inside the band and its lamps
    expect(strips((s) => s.path.every((q) => q.x >= 184 && q.x <= 192) && Math.max(...s.path.map((q) => q.y)) > 600).length, "costanera promenade").toBeGreaterThan(0);
    expect(all.filter((s) => s.kind === "prism" && s.mat === "steel" && s.h === 6.5 && s.at.y > 330).length, "costanera lamps").toBeGreaterThan(10);
  });

  it("crossing plaza (10, 342.1) with tiles and one lamp; crosswalks and traffic lights at Avenida del Barrio × Bulevar", () => {
    expect(furniture.ground.concat(furniture.solids).some((s) => s.kind === "poly" && s.mat === "plaza" && pointInPoly(10, 342.1, s.footprint))).toBe(true);
    expect(lamps.some((l) => Math.hypot(l.at.x + 0.3 - 10, l.at.y + 0.3 - 342.1) < 1)).toBe(true);
    const zebra = furniture.ground.filter((s): s is Solid & { kind: "strip" } => s.kind === "strip" && s.width === 0.8 && s.path.every((q) => Math.hypot(q.x - 10, q.y - 378) < 25));
    expect(zebra.length).toBeGreaterThanOrEqual(6);
  });

  it("south street furniture stays off the lots and on urban ground", () => {
    const lots = southParcels().map((p) => ({ x: p.rect.x + 1.5, y: p.rect.y + 1.5, w: p.rect.w - 3, d: p.rect.d - 3 }));
    for (const s of [...furniture.solids, ...furniture.ground]) {
      const q = bounds(s), cx = (q.min.x + q.max.x) / 2, cy = (q.min.y + q.max.y) / 2;
      expect(q.min.y, JSON.stringify(q)).toBeGreaterThan(318);
      expect(southUrban(cx, cy), JSON.stringify(q)).toBe(true);
      if (s.kind !== "strip" && !(s.kind === "poly" && s.mat === "plaza")) for (const r of lots) expect(cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d, JSON.stringify(q)).toBe(false);
    }
  });

  it("southStreets() is pure", () => expect(JSON.stringify(southStreets())).toBe(JSON.stringify(furniture)));
});

describe("pieces on any rect ≥ 20 × 20 (#478)", () => {
  const rects = [{ x: 103, y: 441, w: 24, d: 24 }, { x: 163, y: 441, w: 21, d: 24 }, { x: 103, y: 441, w: 20, d: 20 }];
  for (const [name, build] of [["houses", houses], ["monoblock", monoblock], ["plaza", plaza]] as const) for (const r of rects) for (const seed of [1, 7, 11]) {
    it(`${name} on ${r.w} × ${r.d}, seed ${seed}: everything inside rect ± 2.5`, () => {
      const ctx = newCtx(createRng(seed));
      build(ctx, { ...r, dist: 200 });
      for (const s of [...ctx.solids, ...ctx.ground]) expect(within(s, r, 2.5), JSON.stringify(bounds(s))).toBe(true);
    });
  }
  it("blockAt(col, row) finds the fixed parcels", () => {
    for (const c of [SCHOOL, CLUB, ARENA, ...PLAZAS]) { const b = blockAt(c.col, c.row); expect(b.parcel?.cell).toEqual(c); expect([b.w, b.d]).toEqual([24, 24]); }
  });
});

describe("exhibits of the south (#478)", () => {
  const box = (id: string) => { const e = EXHIBITS.find((x) => x.id === id)!; return e.kind === "region" ? e.box : null; };
  it("arena, auditorio, escuela, club and plaza-barrio frame their parcel", () => {
    for (const [id, c] of [["arena", ARENA], ["auditorio", AUDITORIUM], ["escuela", SCHOOL], ["club", CLUB], ["plaza-barrio", PLAZAS[0]]] as const) {
      const r = fixedOf(c).p.rect, b = box(id)!;
      expect(b.x0, id).toBeLessThanOrEqual(r.x); expect(b.y0, id).toBeLessThanOrEqual(r.y); expect(b.x1, id).toBeGreaterThanOrEqual(r.x + r.w); expect(b.y1, id).toBeGreaterThanOrEqual(r.y + r.d);
      expect(b.x1 - b.x0, id).toBeLessThan(r.w + 12); expect(b.y1 - b.y0, id).toBeLessThan(r.d + 12);
    }
  });
  it("monoblock and casas frame a parcel of their kind", () => {
    for (const [id, k] of [["monoblock", "monoblock"], ["casas", "houses"]] as const) {
      const b = box(id)!;
      expect(south.some((x) => x.k === k && x.p.rect.x >= b.x0 && x.p.rect.y >= b.y0 && x.p.rect.x + x.p.rect.w <= b.x1 && x.p.rect.y + x.p.rect.d <= b.y1), id).toBe(true);
    }
  });
});
