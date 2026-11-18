import { describe, expect, it, vi } from "vitest";
import { project } from "../iso/project";
import type { ZoneId } from "../map/zones";
import { SIGN_ORDER, zoneAtScreen, zoneSigns } from "./signs";

// ADR 0003: a sign wins over the geography beneath it. Since #427 every sign stands over its own zone's ground, so the real geography
// cannot tell the two rules apart: here the geography answers one fixed zone everywhere, and each sign must still answer its own.
const ground = vi.hoisted(() => ({ zone: "cv" as ZoneId }));
vi.mock("../map/geo", async (orig) => ({ ...(await orig<typeof import("../map/geo")>()), worldZoneAt: () => ground.zone }));

describe("zoneAtScreen: the sign wins over the geography (#393, #427)", () => {
  it.each(["wide", "tall"] as const)("the center of each word answers its zone whatever the ground says, %s site", (site) => {
    for (const zone of SIGN_ORDER) {
      ground.zone = zone;
      for (const id of SIGN_ORDER) {
        const pts = zoneSigns(site)[id].glyphs.flatMap((g) => g.quads.flat()).map(project);
        const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
        expect(zoneAtScreen({ x: 0, y: 0, scale: 1 }, c.x, c.y, site), `${site} ${id} over ${zone} ground`).toBe(id);
      }
    }
  });
  it("away from the signs the geography answers", () => {
    ground.zone = "portfolio";
    expect(zoneAtScreen({ x: 0, y: 0, scale: 1 }, -5000, -5000, "wide")).toBe("portfolio");
  });
});
