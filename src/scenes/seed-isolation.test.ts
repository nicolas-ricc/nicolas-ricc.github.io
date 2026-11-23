import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SEED } from "../map/seed";
import { world } from "./world";

/** Moving Resume's west from tech to the city (#479) must not touch the other zones' scenes: their rngs are their own. */
describe("seed isolation (#479)", () => {
  it("Portfolio and Writing solids snapshot unchanged", () => {
    const w = world(SEED);
    const digest = (s: { ground: unknown[]; solids: unknown[]; accents: unknown[] } | null) => {
      if (!s) return null;
      return { ground: s.ground.length, solids: s.solids.length, accents: s.accents.length, sha256: createHash("sha256").update(JSON.stringify([s.ground, s.solids, s.accents])).digest("hex") };
    };
    expect({ shipyard: digest(w.shipyard), factory: digest(w.factory), fair: digest(w.fair), hinterland: digest(w.hinterland), sea: digest(w.sea) }).toMatchSnapshot();
  });
});
