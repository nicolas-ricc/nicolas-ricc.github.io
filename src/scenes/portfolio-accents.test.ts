import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { world } from "./world";

const byColor = (accents: Accent[]) => {
  const out: Record<string, number> = {};
  for (const a of accents) out[a.color] = (out[a.color] ?? 0) + 1;
  return out;
};

/** Portfolio keeps its colors; counts re-measured in #319 (the seam fence adds 6 cyan). The fair is left out on purpose (it is the exception with neons). */
describe("Portfolio accents", () => {
  const w = world(7);
  // #279: the parked consist adds 12 cyanBleed (saloon) and 2 amber (LED signs); #319: the seam fence adds 6 cyan lamps to the shipyard;
  // #323: the east bank adds 6 cyan (two floating-dock towers, two container-yard lamps, two quay crane tips) and the gatehouse window (windowCool)
  it("shipyard", () => expect(byColor(w.shipyard!.accents)).toEqual({ amber: 10, amberBleed: 1, cyan: 21, cyanBleed: 15, cyanMid: 8, magenta: 3, windowCool: 1 }));
  it("factory", () => expect(byColor(w.factory!.accents)).toEqual({ amber: 3, cyan: 8, magenta: 6 }));
  // #321: spark is only for the animated welding layer, never a static light
  it("no static accent of the world is spark", () => expect(w.accents.filter((a) => a.color === "spark")).toEqual([]));
  it("hinterland", () => expect(byColor(w.hinterland!.accents)).toEqual({ cyan: 21, cyanMid: 1 }));
});
