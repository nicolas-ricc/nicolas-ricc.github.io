import { beforeAll, describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { BUMPER, fair } from "./fair";
import { hinterland, ROAD_Y, type HinterlandScene } from "./hinterland";
import { isLampPost, unpairedLampParts } from "./lamp-fixtures";
import { station } from "./station";

/**
 * #401: industrial lamps and non-functional dots out of the 11 storybook exhibits. The checks that rewrite an existing
 * scene test live in that scene's file (factory, seam fence, street, east yard, tower crane, tinker sign); these are the ones with no such home.
 */
type Dot = Accent & { kind: "dot" };
type Post = Solid & { kind: "prism" };
const dots = (a: readonly Accent[]): Dot[] => a.filter((x): x is Dot => x.kind === "dot");
const lampPosts = (s: readonly Solid[]): Post[] => s.filter(isLampPost);
const xy = (ps: readonly Post[]): number[][] => ps.map((p) => [p.at.x, p.at.y]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);

describe("lamps out (#401)", () => {
  it("station: no cyanMid, no amber, no cyan r 1.2 dot; no lamp post, no orphan", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    station(out, accents);
    const ds = dots(accents);
    expect(ds.filter((d) => d.color === "cyanMid")).toEqual([]);
    expect(ds.filter((d) => d.color === "amber")).toEqual([]);
    expect(ds.filter((d) => d.color === "cyan" && d.r === 1.2)).toEqual([]);
    expect(lampPosts(out)).toEqual([]);
    expect(unpairedLampParts(out, accents)).toEqual([]);
  });

  describe("hinterland", () => {
    let s: HinterlandScene;
    beforeAll(() => { s = hinterland(createRng(7)); });
    it("fairRoad lamps at x 4 and 60", () => expect(lampPosts(s.solids).filter((p) => p.at.y === ROAD_Y - 4 && p.at.x >= 0 && p.at.x <= 84).map((p) => p.at.x).sort((a, b) => a - b)).toEqual([4, 60]));
    it("westHalls lamps at (−190, 44), (−130, 86), (−70, 20)", () => expect(xy(lampPosts(s.solids).filter((p) => p.at.x < -60 && p.at.y >= -60 && p.at.y <= 90))).toEqual([[-190, 44], [-130, 86], [-70, 20]]));
    it("no orphan", () => expect(unpairedLampParts(s.solids, s.accents)).toEqual([]));
  });

  it("bumper cars: no dot over the floor", () => {
    const s = fair(createRng(7));
    expect(dots(s.accents).filter((d) => d.at.x >= BUMPER.x && d.at.x <= BUMPER.x + 14 && d.at.y >= BUMPER.y && d.at.y <= BUMPER.y + 10)).toEqual([]);
  });
});
