import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guard for #136: no inline copy of the props the kit now owns. Its geometry guard (scene hashes recorded on 3a15116)
// was deleted at #152 as it asked: the kit marks (`interlocks`) enter the JSON and campus drops the trees on its tables.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const src = (f: string): string => readFileSync(join(ROOT, "src/scenes", f), "utf8");

describe("props dedupe (#136)", () => {
  it("no inline cyan lamp, local lamp or hand-built helipad/terrace remains", () => {
    for (const f of ["factory.ts", "hinterland.ts", "shipyard.ts", "shipyard-east.ts", "station.ts"]) {
      expect(src(f), f).not.toMatch(/function lamp\b/);
      expect(src(f), f).not.toMatch(/r: 1\.2, color: "cyan"/);
    }
    expect(src("tech.ts")).not.toMatch(/r: 2\.5, h: 0\.3/); // the helipad
    expect(src("tech.ts")).not.toMatch(/kind: "cone", at: v3\(tx/); // the terrace cones
  });
});
