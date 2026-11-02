import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { world } from "./world";

const byColor = (accents: Accent[]) => {
  const out: Record<string, number> = {};
  for (const a of accents) out[a.color] = (out[a.color] ?? 0) + 1;
  return out;
};

/** Portfolio is not touched in story #11: same colors, same count. The fair is left out on purpose (it is the exception with neons). */
describe("Portfolio accents", () => {
  const w = world(7);
  // #279: the parked consist adds 12 cyanBleed (saloon) and 2 amber (LED signs)
  it("shipyard", () => expect(byColor(w.shipyard!.accents)).toEqual({ amber: 10, amberBleed: 1, cyan: 9, cyanBleed: 15, cyanMid: 8, magenta: 3 }));
  it("factory", () => expect(byColor(w.factory!.accents)).toEqual({ amber: 3, cyan: 8, magenta: 6 }));
  it("hinterland", () => expect(byColor(w.hinterland!.accents)).toEqual({ cyan: 21, cyanMid: 1 }));
});
