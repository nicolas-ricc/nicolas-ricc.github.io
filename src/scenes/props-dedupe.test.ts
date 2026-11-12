import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fingerprint } from "../iso/fingerprint";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { factory } from "./factory";
import { hinterland } from "./hinterland";
import { shipyard } from "./shipyard";
import { tech } from "./tech";

// Guard for #136: moving the cyan lamp, the helipad and the green terrace to the kit changes no geometry.
// Recorded on main (3a15116) before the move. When a later issue changes these scenes on purpose, delete this test.
const hash = (v: unknown): string => fingerprint(v as Solid[]);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const src = (f: string): string => readFileSync(join(ROOT, "src/scenes", f), "utf8");

const SCENES: Record<string, string> = {
  "factory/1": "8e4227bd", "factory/7": "9e668098", "factory/42": "abae3cd2",
  "hinterland/1": "63a5c7aa", "hinterland/7": "28fe3118", "hinterland/42": "d1536062",
  "shipyard/1": "758cc967", "shipyard/7": "15ab1774", "shipyard/42": "712c68bc",
  "tech/1": "cb5d6a9f", "tech/7": "8baaac62", "tech/42": "61208a88",
};

describe("props dedupe (#136)", () => {
  it("touched scenes build the same geometry and lights", () => {
    const got: Record<string, string> = {};
    for (const s of [1, 7, 42]) {
      got[`factory/${s}`] = hash(factory(createRng(s)));
      got[`hinterland/${s}`] = hash(hinterland(createRng(s)));
      got[`shipyard/${s}`] = hash(shipyard(createRng(s))); // includes station() and shipyardEast()
      got[`tech/${s}`] = hash(tech(createRng(s)));
    }
    expect(got).toEqual(SCENES);
  });

  it("no inline cyan lamp, local lamp or hand-built helipad/terrace remains", () => {
    for (const f of ["factory.ts", "hinterland.ts", "shipyard.ts", "shipyard-east.ts", "station.ts"]) {
      expect(src(f), f).not.toMatch(/function lamp\b/);
      expect(src(f), f).not.toMatch(/r: 1\.2, color: "cyan"/);
    }
    expect(src("tech.ts")).not.toMatch(/r: 2\.5, h: 0\.3/); // the helipad
    expect(src("tech.ts")).not.toMatch(/kind: "cone", at: v3\(tx/); // the terrace cones
  });
});
