import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { world } from "./world";

const byColor = (accents: Accent[]) => {
  const out: Record<string, number> = {};
  for (const a of accents) out[a.color] = (out[a.color] ?? 0) + 1;
  return out;
};

/** Portfolio no se toca en la historia #11: mismos colores, misma cantidad. La feria queda afuera a propósito (es la excepción con neones). */
describe("acentos de Portfolio", () => {
  const w = world(7);
  it("astillero", () => expect(byColor(w.shipyard!.accents)).toEqual({ amber: 8, amberBleed: 1, cyan: 9, cyanBleed: 3, cyanMid: 8, magenta: 3 }));
  it("fábrica", () => expect(byColor(w.factory!.accents)).toEqual({ amber: 3, cyan: 8, magenta: 6 }));
  it("hinterland", () => expect(byColor(w.hinterland!.accents)).toEqual({ cyan: 21, cyanMid: 1 }));
});
