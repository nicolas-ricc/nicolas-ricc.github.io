import { beforeAll, describe, expect, it } from "vitest";
import { bounds } from "../iso/solids";
import { SEED } from "../map/seed";
import { PLAZA_CENTER, barrioAt, type Parcel } from "../scenes/city-plan";
import { PLINTH_H } from "../scenes/city-pieces";
import { city, type CityScene } from "../scenes/city";
import { TRAIN_CLEAR } from "../scenes/station";
import { zoneRng } from "../scenes/world";
import { BARRIO_HEIGHTS, TOWER_FREE_H, maxHFor, towerZone } from "./zoning";

// #495, spec 2026-11-26 §7: office city. Ranges are totals above the lot; the top is the cap.
const at = (d: number, y: number) => ({ x: PLAZA_CENTER.x - Math.sqrt(Math.max(0, d * d - (y - PLAZA_CENTER.y) ** 2)), y });
const parcel = (c: { x: number; y: number }, d: number, rectY = 230): Parcel => {
  const poly = [{ x: c.x - 12, y: rectY }, { x: c.x + 12, y: rectY }, { x: c.x + 12, y: rectY + 24 }, { x: c.x - 12, y: rectY + 24 }];
  return { poly, c, area: 576, d, barrio: "moderno", cell: { col: 9999, row: 9999 }, rect: { x: c.x - 12, y: rectY, w: 24, d: 24 } };
};

describe("caps and tower zone", () => {
  it("BARRIO_HEIGHTS is the issue's table", () => {
    expect(BARRIO_HEIGHTS).toEqual({ bajo: { lo: 6, hi: 8 }, clasico: { lo: 14, hi: 22 }, transicion: { lo: 24, hi: 34 }, moderno: { lo: 40, hi: 50 } });
  });

  it("maxHFor caps each barrio at the top of its range; moderno off the tower zone keeps TOWER_FREE_H", () => {
    const inZone = parcel({ x: -100, y: 250 }, 260), off = parcel({ x: -100, y: 330 }, 260, 320);
    expect(maxHFor("clasico", inZone)).toBe(22);
    expect(maxHFor("transicion", inZone)).toBe(34);
    expect(maxHFor("moderno", inZone)).toBe(50);
    expect(maxHFor("bajo", inZone)).toBe(8);
    expect(maxHFor("moderno", off)).toBe(TOWER_FREE_H);
  });

  it("towerZone: north of y 320 and from d 150", () => {
    expect(towerZone(parcel({ x: -100, y: 319.9 }, 150))).toBe(true);
    expect(towerZone(parcel({ x: -100, y: 320 }, 150))).toBe(false);
    expect(towerZone(parcel({ x: -100, y: 250 }, 149.9))).toBe(false);
    expect(towerZone(parcel({ x: -100, y: 250 }, 205))).toBe(true);
  });

  it("barrioAt by distance to PLAZA_CENTER: clasico < 80, transicion < 150, moderno north of y 320", () => {
    expect(barrioAt(at(79.9, 263))).toBe("clasico");
    expect(barrioAt(at(80, 263))).toBe("transicion");
    expect(barrioAt(at(149.9, 263))).toBe("transicion");
    expect(barrioAt(at(150, 263))).toBe("moderno");
    expect(barrioAt({ x: -200, y: 300 })).toBe("moderno");
    expect(barrioAt({ x: -200, y: 319 })).toBe("moderno");
    expect(barrioAt({ x: -200, y: 330 })).toBe("transicion");
    expect(barrioAt({ x: -200, y: 363 })).toBe("clasico"); // the 348..378 row stays clasico (#493)
  });
});

describe("built city", () => {
  let s: CityScene;
  beforeAll(() => { s = city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)); }, 60000);
  const onParcels = () => s.placed.filter((q) => q.placed.parcel);
  const pieceTop = (q: CityScene["placed"][number]) => Math.max(...q.piece.solids.map((x) => bounds(x).max.z)) - q.placed.lot.z;
  const BARRIOS = ["clasico", "transicion", "moderno", "bajo"] as const;
  const isBarrio = (n: string): n is (typeof BARRIOS)[number] => (BARRIOS as readonly string[]).includes(n);

  it("every non-fixed barrio parcel carries the band { min(lo, maxH), maxH }; the rest carry none", () => {
    let banded = 0;
    for (const q of onParcels()) {
      const n = q.placed.neighborhood, lot = q.placed.lot, slab = n === "moderno" && !towerZone(q.placed.parcel!);
      const fixed = ["civicPalace", "theatre", "library", "constructionSite", "telecom"].includes(q.placed.recipe) || (q.placed.parcel!.cell.col === 13 && q.placed.parcel!.cell.row === 291);
      if (isBarrio(n) && !fixed && !slab) {
        expect(lot.band, `${q.placed.parcel!.cell.col},${q.placed.parcel!.cell.row}`).toEqual({ lo: Math.min(BARRIO_HEIGHTS[n].lo, lot.maxH), hi: lot.maxH });
        banded++;
      } else expect(lot.band, `${q.placed.parcel!.cell.col},${q.placed.parcel!.cell.row} ${n}`).toBeUndefined();
    }
    expect(banded).toBeGreaterThan(50);
  }, 60000);

  it("built heights land in the band: every piece under band.hi, and 90 % of the non-empty ones at band.lo or above", () => {
    const withBand = onParcels().filter((q) => q.placed.lot.band && q.piece.solids.length > 0);
    for (const q of withBand) expect(pieceTop(q), `${q.placed.parcel!.cell.col},${q.placed.parcel!.cell.row} ${q.placed.recipe}`).toBeLessThanOrEqual(q.placed.lot.band!.hi + 1e-6);
    const low = withBand.filter((q) => pieceTop(q) < q.placed.lot.band!.lo - 0.5);
    expect(low.length, low.map((q) => `${q.placed.parcel!.cell.col},${q.placed.parcel!.cell.row} ${q.placed.recipe} ${pieceTop(q).toFixed(1)}`).join("; ")).toBeLessThanOrEqual(Math.floor(withBand.length * 0.1));
  }, 60000);

  it("each barrio reaches its range: moderno to 40 or more, transicion to 24, clasico to 14", () => {
    for (const [n, lo] of [["moderno", 40], ["transicion", 24], ["clasico", 14]] as const) {
      const tops = onParcels().filter((q) => q.placed.neighborhood === n && q.placed.lot.band && q.piece.solids.length).map(pieceTop);
      expect(Math.max(...tops), n).toBeGreaterThanOrEqual(lo);
    }
  }, 60000);

  it("moderno draws towers only (no campus)", () => {
    expect(onParcels().filter((q) => q.placed.neighborhood === "moderno" && q.placed.recipe === "campus")).toEqual([]);
  }, 60000);

  it("no west-bank parcel solid rises above 50 + PLINTH_H", () => {
    for (const q of onParcels()) for (const x of q.piece.solids) expect(bounds(x).max.z, `${q.placed.parcel!.cell.col},${q.placed.parcel!.cell.row} ${q.placed.recipe}`).toBeLessThanOrEqual(50 + PLINTH_H + 1e-6);
  }, 60000);

  it("train rule over every parcel solid south of the track: y_min − 1.4·z_max ≥ 134.5", () => {
    for (const q of onParcels()) for (const x of q.piece.solids) {
      const b = bounds(x);
      if (b.min.y > TRAIN_CLEAR.y1) expect(b.min.y - 1.4 * b.max.z, `${q.placed.parcel!.cell.col},${q.placed.parcel!.cell.row} ${q.placed.recipe}`).toBeGreaterThanOrEqual(134.5 - 1e-9);
    }
  }, 60000);
});
