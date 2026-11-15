import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { seaPlatform } from "./sign-platform";

const build = () => { const out: Solid[] = [], accents: Accent[] = []; seaPlatform(out, accents); return { out, accents }; };

describe("sea platform placeholder (#360)", () => {
  it("a 14 × 12 × 0.4 deck at z 1.2 on six steel piles r 0.3, 6 sides, from z −1 to 1.2", () => {
    const { out } = build();
    expect(out).toContainEqual(expect.objectContaining({ kind: "prism", at: { x: -7, y: -6, z: 1.2 }, w: 14, d: 12, h: 0.4, mat: "deck" }));
    const piles = out.filter((s) => s.kind === "cylinder");
    expect(piles).toHaveLength(6);
    for (const p of piles) {
      expect(p).toMatchObject({ kind: "cylinder", r: 0.3, sides: 6, mat: "steel" });
      if (p.kind !== "cylinder") continue;
      expect(p.at.z).toBe(-1);
      expect(p.at.z + p.h).toBeCloseTo(1.2, 9);
    }
  });
  it("Blog in cyan neon at 0.75 alpha on the diagonal plane, baseline z 2.8; deterministic", () => {
    const { accents } = build();
    expect(accents.length).toBeGreaterThan(0);
    for (const a of accents) {
      expect(a.kind).toBe("poly");
      expect(["cyan", "cyanBleed"]).toContain(a.color);
      if (a.kind === "poly") expect(a.alpha).toBeCloseTo(a.color === "cyan" ? 0.75 : 0.45, 12);
    }
    const tubes = accents.filter((a) => a.color === "cyan");
    for (const a of tubes) if (a.kind === "poly") for (const p of a.pts) expect(Math.abs(p.x + p.y)).toBeLessThan(1e-9);
    const zs = tubes.flatMap((a) => (a.kind === "poly" ? a.pts.map((p) => p.z) : []));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(2.8 - (2 * 8.55) / 7 - 0.5 - 1e-9); // the g's descender, minus half the tube
    expect(Math.max(...zs)).toBeLessThanOrEqual(2.8 + 8.55 + 0.5 + 1e-9);
    expect(build()).toEqual(build());
  });
});
