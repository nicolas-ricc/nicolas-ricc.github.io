import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { sortByDepth } from "../iso/depth";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { checkSign, checkSignFont, COVER_LAPTOP, COVER_PHONE, SIGN_FONT, SIGN_RULES } from "../kit/legibility";
import { MARQUEE_FACE, marqueeLayout } from "../kit/marquee";
import type { FixedLight } from "../city/lights";
import { SIDEWALK } from "./city-grid";
import { HOTEL_LOT } from "./city-plan";
import {
  HOTEL_CAP, HOTEL_SLAB, HOTEL_TRACKING, PANEL_GAP, PANEL_L, PANEL_T, RESUME_SIGN, SIGN_MARGIN, SIGN_PANEL, SIGN_SITE, SIGN_Z0,
  hotel, hotelSign, hotelStandIn, slabFootprint,
} from "./sign-hotel";

const EPS = 1e-6, R2 = Math.SQRT1_2;
const U = v3(R2, -R2, 0), N = v3(R2, R2, 0);
const C = HOTEL_SLAB.center;
const PANEL_Z1 = SIGN_Z0 + HOTEL_CAP + 2 * SIGN_MARGIN;
const along = (p: { x: number; y: number }) => (p.x - C.x) * U.x + (p.y - C.y) * U.y; // t along U from the slab's center
const across = (p: { x: number; y: number }) => (p.x - C.x) * N.x + (p.y - C.y) * N.y; // n along N from the slab's axis

const built = () => { const out: Solid[] = [], accents: Accent[] = [], lights: FixedLight[] = []; const lit = hotel(out, accents, lights); return { out, accents, lights, lit }; };
const H = built();
const stand = (() => { const out: Solid[] = [], accents: Accent[] = []; hotelStandIn(out, accents); return { out, accents }; })();
const isPanel = (s: Solid) => s.kind === "poly" && s.mat === "glass";
/** The slab: the poly whose footprint is `slabFootprint()` (displaced by `d`). */
const isSlab = (s: Solid, d: Vec2 = { x: 0, y: 0 }) => s.kind === "poly" && s.footprint.length === 4 && s.footprint.every((p, i) => Math.hypot(p.x - slabFootprint()[i]!.x - d.x, p.y - slabFootprint()[i]!.y - d.y) < EPS);
/** The base: solids that start at z 0 (the slab starts at 10). */
const isBase = (s: Solid) => bounds(s).min.z < EPS && bounds(s).max.z <= HOTEL_SLAB.z0 + 0.4 + EPS;
const ink = (cap: number) => { const l = marqueeLayout(cap, HOTEL_TRACKING); return l.at(-1)!.box.x1 - l[0]!.box.x0; };
const inPoly = (x: number, y: number, p: readonly Vec2[]) => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i]!, b = p[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
/** `slabFootprint()` grown by `d` on every side (it is a rectangle along U and N). */
const grown = (d: number): Vec2[] => {
  const h = HOTEL_SLAB.half + d, t = HOTEL_SLAB.thick / 2 + d;
  return [[-h, -t], [h, -t], [h, t], [-h, t]].map(([a, b]) => ({ x: C.x + U.x * a! + N.x * b!, y: C.y + U.y * a! + N.y * b! }));
};

describe("sign-hotel: constants (#474)", () => {
  it("HOTEL_SLAB, the cap, the tracking and the panel's constants are the issue's", () => {
    expect(HOTEL_SLAB).toEqual({ center: { x: 100, y: 259.5 }, half: 32, thick: 8, z0: 10, z1: 51 });
    expect(HOTEL_CAP).toBe(12);
    expect(HOTEL_TRACKING).toBe(0.07);
    expect(SIGN_MARGIN).toBe(2.4);
    expect(PANEL_GAP).toBe(0.06);
    expect(PANEL_T).toBe(0.6);
    expect(PANEL_L).toBe(64);
    expect(SIGN_Z0).toBe(31.5);
  });

  it("slabFootprint() is center ± half·U ± thick/2·N", () => {
    const f = slabFootprint();
    expect(f).toHaveLength(4);
    const ts = f.map(along).sort((a, b) => a - b), ns = f.map(across).sort((a, b) => a - b);
    for (const [v, w] of [[ts[0], -32], [ts[1], -32], [ts[2], 32], [ts[3], 32]] as const) expect(v).toBeCloseTo(w, 9);
    for (const [v, w] of [[ns[0], -4], [ns[1], -4], [ns[2], 4], [ns[3], 4]] as const) expect(v).toBeCloseTo(w, 9);
  });

  it("SIGN_SITE is the center of the baseline: center + 4.66·N at z 33.9", () => {
    expect(SIGN_SITE.x).toBeCloseTo(C.x + 4.66 * N.x, 9);
    expect(SIGN_SITE.y).toBeCloseTo(C.y + 4.66 * N.y, 9);
    expect(SIGN_SITE.z).toBeCloseTo(33.9, 9);
  });
});

describe("sign-hotel: RESUME_SIGN (#474)", () => {
  it("RESUME_SIGN: RESUME in marquee letters, id cartel-torre, cap 12, the face as stroke, backed by SIGN_PANEL", () => {
    expect(RESUME_SIGN).toMatchObject({ id: "cartel-torre", text: "RESUME", size: HOTEL_CAP, width: SIGN_FONT.width, color: "greenMid", xHeight: HOTEL_CAP, stroke: MARQUEE_FACE * HOTEL_CAP });
    expect(RESUME_SIGN.glyphs.map((g) => g.char).join("")).toBe("RESUME");
    expect(RESUME_SIGN.backing).toEqual([SIGN_PANEL]);
  });

  it("passes checkSignFont and checkSign at 1.17 and 0.83 against [panel, slab, base]", () => {
    expect(checkSignFont(RESUME_SIGN)).toEqual([]);
    const solids = H.out.filter((s) => isPanel(s) || isSlab(s) || isBase(s));
    expect(solids.some((s) => isSlab(s))).toBe(true);
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) expect(checkSign(RESUME_SIGN, scale, solids), `${scale}`).toEqual([]);
  });

  it("every glyph plane is a diagonalWall whose origin lies within 0.2 of the slab's southeast face plus the panel and the gap", () => {
    for (const g of RESUME_SIGN.glyphs) {
      expect(g.plane.u.x).toBeCloseTo(U.x, 9); expect(g.plane.u.y).toBeCloseTo(U.y, 9); expect(g.plane.u.z).toBeCloseTo(0, 9);
      expect(g.plane.v).toEqual(v3(0, 0, 1));
      expect(Math.abs(across(g.plane.origin) - (HOTEL_SLAB.thick / 2 + PANEL_T + PANEL_GAP))).toBeLessThanOrEqual(0.2);
    }
  });

  it("the word is centered on the slab, its baseline at z 33.9", () => {
    const g0 = RESUME_SIGN.glyphs[0]!, b = RESUME_SIGN.glyphs.map((g) => g.layout.box), W = b.at(-1)!.x1 - b[0]!.x0;
    const a = g0.plane.origin.z, l = along({ x: g0.plane.origin.x + U.x * b[0]!.x0, y: g0.plane.origin.y + U.y * b[0]!.x0 });
    expect(a).toBeCloseTo(33.9, 9);
    expect(l).toBeCloseTo(-W / 2, 9);
    expect(W).toBeCloseTo(ink(HOTEL_CAP), 9);
  });

  it("cap ≥ 12 and the ink plus the backing rule on each side fits in 64", () => {
    expect(HOTEL_CAP).toBeGreaterThanOrEqual(12);
    expect(ink(HOTEL_CAP) + 2 * SIGN_RULES.backingW * SIGN_FONT.width).toBeLessThanOrEqual(PANEL_L);
  });
});

describe("sign-hotel: the panel (#474)", () => {
  it("one glass panel 64 × 16.8 from z 31.5 to 48.3, from n 4 to 4.6, its four vertices inside the slab footprint grown 0.7", () => {
    const panels = H.out.filter(isPanel);
    expect(panels).toHaveLength(1);
    const p = panels[0]! as Solid & { kind: "poly" };
    expect(p).toEqual(SIGN_PANEL);
    expect(p).not.toBe(SIGN_PANEL); // a fresh copy: a consumer that mutates the scene does not reach the backing
    expect(p.z).toBeCloseTo(SIGN_Z0, 9);
    expect(p.z + p.h).toBeCloseTo(PANEL_Z1, 9);
    expect(PANEL_Z1).toBeCloseTo(48.3, 9);
    const t = p.footprint.map(along), n = p.footprint.map(across);
    expect(Math.min(...t)).toBeCloseTo(-PANEL_L / 2, 9); expect(Math.max(...t)).toBeCloseTo(PANEL_L / 2, 9);
    expect(Math.min(...n)).toBeCloseTo(4, 9); expect(Math.max(...n)).toBeCloseTo(4.6, 9);
    for (const q of p.footprint) expect(inPoly(q.x, q.y, grown(0.7)), JSON.stringify(q)).toBe(true);
  });

  it("the letters: the fill quads of RESUME_SIGN as greenMid alpha-1 polys, one warm bulb per marquee bulb on the letter plane", () => {
    const green = H.accents.filter((a): a is Extract<Accent, { kind: "poly" }> => a.kind === "poly" && a.color === "greenMid");
    expect(green.map((a) => a.pts)).toEqual(RESUME_SIGN.glyphs.flatMap((g) => g.quads));
    for (const a of green) expect(a.alpha).toBe(1);
    const bulbs = H.accents.filter((a): a is Extract<Accent, { kind: "dot" }> => a.kind === "dot" && a.color === "windowWarm" && a.r === 0.35);
    expect(bulbs).toHaveLength(marqueeLayout(HOTEL_CAP, HOTEL_TRACKING).reduce((k, g) => k + g.bulbs.length, 0));
    for (const d of bulbs) expect(across(d.at)).toBeCloseTo(4.66, 6);
  });

  it("sortByDepth paints the panel after the slab", () => {
    const order = sortByDepth(H.out);
    expect(order.findIndex(isPanel)).toBeGreaterThan(order.findIndex((s) => isSlab(s)));
  });

  it("hotelSign at a displacement builds the panel, letters and bulbs moved by it", () => {
    const out: Solid[] = [], accents: Accent[] = [];
    hotelSign(out, accents, v3(-C.x, -C.y, 0));
    expect(out).toHaveLength(1);
    const p = out[0]! as Solid & { kind: "poly" };
    expect(p.footprint.map((q) => ({ x: q.x + C.x, y: q.y + C.y }))).toEqual(SIGN_PANEL.footprint.map((q) => ({ x: expect.closeTo(q.x, 9), y: expect.closeTo(q.y, 9) })));
    const mine = H.accents.filter((a) => (a.kind === "poly" && a.color === "greenMid") || (a.kind === "dot" && a.color === "windowWarm" && a.r === 0.35));
    expect(accents).toHaveLength(mine.length);
  });
});

describe("sign-hotel: the building (#474)", () => {
  it("the slab: a poly on slabFootprint() from z 10 to 51 in office, with a facade of 12 floors × 16 columns", () => {
    const slabs = H.out.filter((s) => isSlab(s));
    expect(slabs).toHaveLength(1);
    const s = slabs[0]! as Solid & { kind: "poly" };
    expect(s.z).toBe(HOTEL_SLAB.z0);
    expect(s.z + s.h).toBe(HOTEL_SLAB.z1);
    expect(s.mat).toBe("office");
    expect(s.facade).toMatchObject({ floors: 12, cols: 16 });
  });

  it("the base fills HOTEL_LOT minus the sidewalk, z 0..10, in plaster, three floors", () => {
    const base = H.out.filter(isBase);
    expect(base.length).toBeGreaterThan(0);
    const body = base.find((s) => s.kind === "poly" && s.mat === "plaster" && s.h === HOTEL_SLAB.z0)! as Solid & { kind: "poly" };
    expect(body).toBeDefined();
    expect(body.z).toBe(0);
    expect(body.facade).toMatchObject({ floors: 3 });
    const b = bounds(body);
    expect(b.min.x).toBeCloseTo(HOTEL_LOT.x + SIDEWALK, 9); expect(b.max.x).toBeCloseTo(HOTEL_LOT.x + HOTEL_LOT.w - SIDEWALK, 9);
    expect(b.min.y).toBeCloseTo(HOTEL_LOT.y + SIDEWALK, 9); expect(b.max.y).toBeCloseTo(HOTEL_LOT.y + HOTEL_LOT.d - SIDEWALK, 9);
    expect(body.footprint.length).toBe(8); // four chamfered corners
  });

  it("no helipad: no cylinder and no whitewash anywhere, nothing above z 51 but the flush machine room", () => {
    expect(H.out.filter((s) => s.kind === "cylinder" || s.mat === "whitewash")).toEqual([]);
    const above = H.out.filter((s) => bounds(s).max.z > HOTEL_SLAB.z1 + EPS);
    for (const s of above) {
      const b = bounds(s);
      expect(b.max.z, `${s.kind} ${s.mat}`).toBeLessThanOrEqual(HOTEL_SLAB.z1 + 1.5 + EPS);
      for (const [x, y] of [[b.min.x, b.min.y], [b.max.x, b.max.y], [b.min.x, b.max.y], [b.max.x, b.min.y]] as const) expect(inPoly(x, y, slabFootprint()), `${s.kind} ${s.mat}`).toBe(true);
    }
    expect(above).toHaveLength(1);
  });

  it("every solid lies in HOTEL_LOT ± 0.5", () => {
    for (const s of H.out) {
      const b = bounds(s);
      expect(b.min.x, `${s.kind} ${s.mat}`).toBeGreaterThanOrEqual(HOTEL_LOT.x - 0.5);
      expect(b.max.x, `${s.kind} ${s.mat}`).toBeLessThanOrEqual(HOTEL_LOT.x + HOTEL_LOT.w + 0.5);
      expect(b.min.y, `${s.kind} ${s.mat}`).toBeGreaterThanOrEqual(HOTEL_LOT.y - 0.5);
      expect(b.max.y, `${s.kind} ${s.mat}`).toBeLessThanOrEqual(HOTEL_LOT.y + HOTEL_LOT.d + 0.5);
    }
  });

  it("hotel and hotelStandIn have the same count of slab and base solids; the stand-in has no facade and its slab is centered at the origin", () => {
    const d = { x: -C.x, y: -C.y };
    const standSlab = stand.out.filter((s) => isSlab(s, d)), standBase = stand.out.filter((s) => isBase(s));
    expect(standSlab).toHaveLength(1);
    expect(standBase.length).toBe(H.out.filter(isBase).length);
    for (const s of stand.out) expect("facade" in s && s.facade !== undefined, `${s.kind} ${s.mat}`).toBe(false);
  });
});

describe("sign-hotel: rooms and the paper window (#474)", () => {
  const z = (a: Accent) => (a.kind === "poly" ? a.pts.map((p) => p.z) : [a.at.z]);
  it("rooms: amber polys on the southeast face (n 4), none overlapping the panel band in z", () => {
    expect(H.lit.rooms.length).toBeGreaterThan(0);
    for (const r of H.lit.rooms) {
      expect(r.kind).toBe("poly");
      if (r.kind !== "poly") continue;
      expect(r.color).toBe("amber");
      for (const p of r.pts) expect(across(p)).toBeCloseTo(HOTEL_SLAB.thick / 2, 6);
      const lo = Math.min(...z(r)), hi = Math.max(...z(r));
      expect(hi < SIGN_Z0 - 0.5 || lo > PANEL_Z1 + 0.5, `${lo}..${hi}`).toBe(true);
    }
  });

  it("the rooms are the 16 windows of floors 0..5", () => {
    expect(H.lit.rooms).toHaveLength(96);
  });

  it("paperWindow: the easternmost window of floor 4, 0.6 in front of the face", () => {
    const fh = (HOTEL_SLAB.z1 - HOTEL_SLAB.z0) / 12, w: Vec3 = H.lit.paperWindow;
    expect(across(w)).toBeCloseTo(HOTEL_SLAB.thick / 2 + 0.6, 6);
    expect(w.z).toBeGreaterThan(HOTEL_SLAB.z0 + 4 * fh);
    expect(w.z).toBeLessThan(HOTEL_SLAB.z0 + 5 * fh);
    const east = H.lit.rooms.filter((r) => r.kind === "poly" && r.pts.every((p) => p.z > HOTEL_SLAB.z0 + 4 * fh && p.z < HOTEL_SLAB.z0 + 5 * fh));
    expect(east).toHaveLength(16);
    const maxT = Math.max(...east.map((r) => (r.kind === "poly" ? r.pts.reduce((s, p) => s + along(p), 0) / r.pts.length : 0)));
    expect(along(w)).toBeCloseTo(maxT, 6);
  });

  it("two lamps flank the east portal: hotel publishes fixed lights", () => {
    expect(H.lights.length).toBeGreaterThan(0);
  });
});
