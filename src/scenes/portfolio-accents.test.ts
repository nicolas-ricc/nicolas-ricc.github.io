import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { createRng } from "../map/seed";
import { excavatorBox } from "./excavator";
import { shipyardAnimator } from "./shipyard-animator";
import { STATION } from "./station";
import { world } from "./world";

const STATIC_COLORS = new Set(["cyan", "cyanMid", "cyanBleed", "windowCool", "amber", "amberBleed", "magenta"]);
const WARM = new Set(["amber", "amberBleed", "magenta"]);
const STACK_MOUTH_Z = 20;

/** Point of an accent: a dot's position or a polygon's first vertex (as `accentZone` does). */
const where = (a: Accent) => (a.kind === "dot" ? a.at : a.pts[0]!);

/** Rule 1: Portfolio's static palette, and the warm colors only at the station, the chimney mouths or on the excavator. */
function ruleViolations(accents: Accent[]): string[] {
  const ex = excavatorBox();
  return accents.flatMap((a) => {
    const p = where(a), at = `${a.color} at ${p.x},${p.y},${p.z}`;
    if (!STATIC_COLORS.has(a.color)) return [`color ${at}`];
    if (!WARM.has(a.color)) return [];
    const station = p.x >= STATION.x0 && p.x <= STATION.x1 && p.y >= STATION.y0 && p.y <= STATION.y1;
    const excavator = p.x >= ex.x0 && p.x <= ex.x1 && p.y >= ex.y0 && p.y <= ex.y1;
    return station || p.z >= STACK_MOUTH_Z || excavator ? [] : [`place ${at}`];
  });
}

/** Portfolio accents by rules, not counts (#324). The fair is left out on purpose (it is the exception with neons). */
describe("Portfolio accents", () => {
  const w = world(7);
  const portfolio = [...w.shipyard!.accents, ...w.factory!.accents, ...w.hinterland!.accents];

  it("rule 1: static colors of shipyard, factory and hinterland", () => expect(ruleViolations(portfolio)).toEqual([]));

  it("rule 1 catches intruders", () => {
    const intruders: Accent[] = [{ kind: "dot", at: v3(150, -50, 1), r: 1, color: "amber" }, { kind: "dot", at: v3(150, 50, 5), r: 1, color: "spark" }];
    expect(ruleViolations(intruders)).toHaveLength(2);
  });

  it("rule 2: at least 30 cyan dots across the three scenes", () => expect(portfolio.filter((a) => a.kind === "dot" && a.color === "cyan").length).toBeGreaterThanOrEqual(30));

  // #321: spark is only for the animated welding layer, never a static light
  it("rule 3: no static accent of the world is spark", () => expect(w.accents.filter((a) => a.color === "spark")).toEqual([]));

  it("rule 4: windowCool only as poly, at least 6 in the shipyard", () => {
    const cool = portfolio.filter((a) => a.color === "windowCool");
    expect(cool.every((a) => a.kind === "poly")).toBe(true);
    expect(w.shipyard!.accents.filter((a) => a.color === "windowCool").length).toBeGreaterThanOrEqual(6);
  });

  it("rule 5: the shipyard.sparks layer only emits spark", () => {
    const anim = shipyardAnimator(world(7).shipyard!, createRng(3), { reducedMotion: false });
    let seen = 0;
    for (let t = 0; t < 20000; t += 100) {
      anim.tick(100);
      const l = anim.layer("sparks");
      if (l.kind !== "accent") throw new Error("sparks is an accent layer");
      if (l.accents.length > 0) seen++;
      for (const a of l.accents) expect(a.color).toBe("spark");
    }
    expect(seen).toBeGreaterThan(0);
  });
});
