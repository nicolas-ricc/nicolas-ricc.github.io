import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { factory } from "./factory";
import { BUMPER, fair } from "./fair";
import { hinterland, ROAD_Y } from "./hinterland";
import { unpairedLampParts } from "./lamp-fixtures";
import { towerCrane } from "./pieces";
import { shipyard, STREET_EDGE } from "./shipyard";
import { containerYard } from "./shipyard-east";
import { PIECE_AT, SHIPYARD_HALLS, STAND_IN_HALL, TINKER_SITE, tinkerSign } from "./sign-tinker";
import { station } from "./station";

/** #401: industrial lamps and non-functional dots out of the 11 storybook exhibits. */
type Dot = Accent & { kind: "dot" };
type Post = Solid & { kind: "prism" };
const dots = (a: readonly Accent[]): Dot[] => a.filter((x): x is Dot => x.kind === "dot");
const lampPosts = (s: readonly Solid[]): Post[] => s.filter((x): x is Post => x.kind === "prism" && x.mat === "steel" && x.w === 0.6 && x.d === 0.6 && (x.h === 5 || x.h === 6));
const xy = (ps: readonly Post[]): number[][] => ps.map((p) => [p.at.x, p.at.y]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
const build = (f: (out: Solid[], accents: Accent[]) => void) => { const out: Solid[] = [], accents: Accent[] = []; f(out, accents); return { out, accents }; };
/** Slipway scaffolding (`shipyard.ts` `slipways`): steel 0.6 × 0.6 h 5 on the slipway deck (z 1.5), not a lamp. */
const isSlipScaffold = (s: Solid) => s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.h === 5 && s.at.z === 1.5;

describe("lamps out (#401)", () => {
  it("towerCrane with light null: same solids, no accent", () => {
    const c = { at: { x: 100, y: 50 }, mastH: 20, jibLen: 30, dir: "e" } as const;
    const lit = build((o, a) => towerCrane(o, a, { ...c, light: "cyan" })), dark = build((o, a) => towerCrane(o, a, { ...c, light: null }));
    expect(dark.accents).toEqual([]);
    expect(dark.out).toEqual(lit.out);
  });

  it("factory: lamps only at (53, 12) and (−30, 20), no crane light at (90, −12, 19.4), no orphan", () => {
    const s = factory(createRng(7));
    expect(xy(lampPosts(s.solids))).toEqual([[-30, 20], [53, 12]]);
    expect(dots(s.accents).filter((d) => d.color === "cyan" && d.r === 1 && Math.abs(d.at.x - 90) < 1e-9 && Math.abs(d.at.y + 12) < 1e-9 && Math.abs(d.at.z - 19.4) < 1e-9)).toEqual([]);
    expect(unpairedLampParts(s.solids, s.accents)).toEqual([]);
  });

  describe("shipyard", () => {
    const s = shipyard(createRng(7));
    const posts = lampPosts(s.solids);
    it("seam fence lamps at x −48, −24, 0 (y 88.2)", () => expect(posts.filter((p) => p.at.y === 88.2).map((p) => p.at.x).sort((a, b) => a - b)).toEqual([-48, -24, 0]));
    it("transfer street lamps at y 12 and 96", () => expect(posts.filter((p) => p.at.x === STREET_EDGE + 0.5).map((p) => p.at.y).sort((a, b) => a - b)).toEqual([12, 96]));
    it("no orphan post or bulb (slipway scaffolding excused)", () => expect(unpairedLampParts(s.solids.filter((x) => !isSlipScaffold(x)), s.accents)).toEqual([]));
  });

  it("east container yard: no lamp and no cyan dot", () => {
    const { out, accents } = build((o, a) => containerYard(o, a, createRng(7)));
    expect(lampPosts(out)).toEqual([]);
    expect(dots(accents).filter((d) => d.color === "cyan")).toEqual([]);
  });

  it("station: no cyanMid, no amber, no cyan r 1.2 dot; no lamp post, no orphan", () => {
    const { out, accents } = build(station);
    const ds = dots(accents);
    expect(ds.filter((d) => d.color === "cyanMid")).toEqual([]);
    expect(ds.filter((d) => d.color === "amber")).toEqual([]);
    expect(ds.filter((d) => d.color === "cyan" && d.r === 1.2)).toEqual([]);
    expect(lampPosts(out)).toEqual([]);
    expect(unpairedLampParts(out, accents)).toEqual([]);
  });

  describe("hinterland", () => {
    const s = hinterland(createRng(7));
    const posts = lampPosts(s.solids);
    it("fairRoad lamps at x 4 and 60", () => expect(posts.filter((p) => p.at.y === ROAD_Y - 4 && p.at.x >= 0 && p.at.x <= 84).map((p) => p.at.x).sort((a, b) => a - b)).toEqual([4, 60]));
    it("westHalls lamps at (−190, 44), (−130, 86), (−70, 20)", () => expect(xy(posts.filter((p) => p.at.x < -60 && p.at.y >= -60 && p.at.y <= 90))).toEqual([[-190, 44], [-130, 86], [-70, 20]]));
    it("no orphan", () => expect(unpairedLampParts(s.solids, s.accents)).toEqual([]));
  });

  it("bumper cars: no dot over the floor", () => {
    const s = fair(createRng(7));
    expect(dots(s.accents).filter((d) => d.at.x >= BUMPER.x && d.at.x <= BUMPER.x + 14 && d.at.y >= BUMPER.y && d.at.y <= BUMPER.y + 10)).toEqual([]);
  });

  it.each([["site", TINKER_SITE, SHIPYARD_HALLS], ["piece", PIECE_AT, [STAND_IN_HALL]]] as const)("tinker sign: no 0.6 × 0.6 steel post, no amber r 1.2 dot, no orphan (%s)", (_n, at, halls) => {
    const { out, accents } = build((o, a) => tinkerSign(o, a, at, halls));
    expect(out.filter((x) => x.kind === "prism" && x.mat === "steel" && x.w === 0.6 && x.d === 0.6)).toEqual([]);
    expect(dots(accents).filter((d) => d.color === "amber" && d.r === 1.2)).toEqual([]);
    expect(unpairedLampParts(out, accents)).toEqual([]);
  });
});
