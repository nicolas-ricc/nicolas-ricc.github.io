import { describe, expect, it } from "vitest";
import { QUAY_X, WORLD } from "../map/geo";
import { CITY_BOUNDS, parcels } from "./city-plan";
import { GREEN_BELT, builtAt, southParcels } from "./sprawl-grid";
import { bleedTerrainAt, isWaterAt } from "./terrain-classify";
import { PAN_CONFIGS, panSamples } from "../world/pan-fixtures";

const inWorld = (x: number, y: number): boolean => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;

// #496: Resume's bleed is built ground as far as a pan can show it.
describe("Resume's bleed up to the pan reach (#496)", () => {
  it("Resume's bleed is urban up to the pan reach", () => {
    for (const cfg of PAN_CONFIGS) for (const p of panSamples(cfg, 9)) {
      if (p.y < GREEN_BELT.y1 || inWorld(p.x, p.y) || isWaterAt(p.x, p.y) || (p.y > WORLD.y1 && p.x >= QUAY_X)) continue; // south of the quay eastward is the estuary and the island's jungle tongue, not Resume's urban ground
      expect(bleedTerrainAt(p.x, p.y), `${cfg.frame} ${cfg.w}x${cfg.h} ${p.x},${p.y}`).toBe("urban");
    }
  });

  it("no city or south parcel stands on jungle", () => {
    for (const p of [...parcels(CITY_BOUNDS), ...southParcels()]) for (const v of p.poly) {
      if (inWorld(v.x, v.y)) continue;
      expect(bleedTerrainAt(v.x, v.y), `${p.cell.col},${p.cell.row} ${v.x},${v.y}`).not.toBe("jungle");
    }
  });

  it("the Portfolio side and the green belt keep their ground; the new ground is urban", () => {
    expect(builtAt(-200, 50)).toBe("industrial");
    expect(builtAt(-200, 130)).toBeNull();
    expect(builtAt(-20, 700)).toBe("urban"); // x − y = −720, past today's south reach (y ≤ 660)
    expect(builtAt(-300, 250)).toBe("urban");
  });
});
