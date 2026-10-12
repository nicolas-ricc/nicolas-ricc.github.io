import { readFileSync } from "node:fs";
import type { ZoneId } from "../src/map/zones";
import { describe, expect, it } from "vitest";
import { ZONE_IDS, zoneById } from "../src/map/zones";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("index.html", () => {
  it("tiene un <a data-zone> por cada ZONE_IDS, en orden, con su href", () => {
    const matches = [...html.matchAll(/<a\s+href="([^"]+)"\s+data-zone="([^"]+)">/g)];
    expect(matches.map((m) => m[2])).toEqual(ZONE_IDS);
    for (const [, href, id] of matches) expect(href).toBe(`/${zoneById(id as ZoneId).path}/`);
  });
});
