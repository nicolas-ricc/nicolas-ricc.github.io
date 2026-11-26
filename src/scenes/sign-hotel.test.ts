import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import type { Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { chamferedRect } from "../kit/forms/composite";
import type { FixedLight } from "../city/lights";
import { SIDEWALK } from "./city-grid";
import { HOTEL_LOT } from "./city-plan";
import { dot, v3 } from "../iso/geometry";
import { VIEW_DIR } from "../iso/project";
import { COVER_LAPTOP, COVER_PHONE, checkSign, checkSignFont, signMetrics } from "../kit/legibility";
import { MARQUEE_FACE } from "../kit/marquee";
import { HOTEL_BLOCK, HOTEL_CENTER, HOTEL_FACADE, HOTEL_ROOF, RESUME_SIGN, SIGN_BACKING, SIGN_SITE, blockFootprint, hotel, hotelSign, hotelStandIn } from "./sign-hotel";

const EPS = 1e-6, CHAMFER = 2.4, FH = (HOTEL_ROOF - 0.4) / 14;

const built = () => { const out: Solid[] = [], accents: Accent[] = [], lights: FixedLight[] = []; const lit = hotel(out, accents, lights); return { out, accents, lights, lit }; };
const H = built();
const stand = (() => { const out: Solid[] = [], accents: Accent[] = []; hotelStandIn(out, accents); return { out, accents }; })();
/** The building's own solids: everything but the sign's glass panel (Task 3 deletes it) and what stands above the roof as sign. */
const poly = (s: Solid): s is Solid & { kind: "poly" } => s.kind === "poly";
const same = (a: readonly Vec2[], b: readonly Vec2[]) => a.length === b.length && a.every((p, i) => Math.hypot(p.x - b[i]!.x, p.y - b[i]!.y) < EPS);

describe("sign-hotel: the block (#494)", () => {
  it("HOTEL_BLOCK is the lot minus the sidewalk, the roof is z 60, the center is the block's", () => {
    expect(HOTEL_BLOCK).toEqual({ x0: HOTEL_LOT.x + SIDEWALK, y0: HOTEL_LOT.y + SIDEWALK, x1: HOTEL_LOT.x + HOTEL_LOT.w - SIDEWALK, y1: HOTEL_LOT.y + HOTEL_LOT.d - SIDEWALK });
    expect(HOTEL_ROOF).toBe(60);
    expect(HOTEL_CENTER).toEqual({ x: (HOTEL_BLOCK.x0 + HOTEL_BLOCK.x1) / 2, y: (HOTEL_BLOCK.y0 + HOTEL_BLOCK.y1) / 2 });
  });

  it("blockFootprint is the chamfered rect of the block, displaced by d", () => {
    const { x0, y0, x1, y1 } = HOTEL_BLOCK;
    expect(blockFootprint()).toEqual(chamferedRect(x0, y0, x1 - x0, y1 - y0, CHAMFER));
    expect(blockFootprint({ x: 3, y: -2 })).toEqual(blockFootprint().map((p) => ({ x: p.x + 3, y: p.y - 2 })));
  });

  it("one plaster poly on the footprint from z 0 to the roof minus the cornice, with the facade", () => {
    const blocks = H.out.filter((s) => poly(s) && s.mat === "plaster" && s.z === 0);
    expect(blocks).toHaveLength(1);
    const b = blocks[0]! as Solid & { kind: "poly" };
    expect(same(b.footprint, blockFootprint())).toBe(true);
    expect(b.h).toBeCloseTo(HOTEL_ROOF - 0.4, 9);
    expect(b.facade).toEqual(HOTEL_FACADE);
    expect(HOTEL_FACADE).toEqual({ floors: 14, cols: 12, base: "portico" });
  });

  it("the crown cornice is an office poly on the footprint grown 0.3, z 59.6 to 60", () => {
    const { x0, y0, x1, y1 } = HOTEL_BLOCK, g = 0.3;
    const crown = H.out.filter((s) => poly(s) && s.mat === "office");
    expect(crown).toHaveLength(1);
    const c = crown[0]! as Solid & { kind: "poly" };
    expect(same(c.footprint, chamferedRect(x0 - g, y0 - g, x1 - x0 + 2 * g, y1 - y0 + 2 * g, CHAMFER))).toBe(true);
    expect(c.z).toBeCloseTo(HOTEL_ROOF - 0.4, 9);
    expect(c.z + c.h).toBeCloseTo(HOTEL_ROOF, 9);
  });

  it("no solid tops out between 10.5 and 59 but the block, and nothing sits at z 10", () => {
    const mid = H.out.filter((s) => s.mat !== "glass" /* the old sign panel, Task 3 deletes it */).filter((s) => { const t = bounds(s).max.z; return t > 10.5 && t < 59; });
    expect(mid.filter((s) => !(poly(s) && s.mat === "plaster" && s.z === 0))).toEqual([]);
    expect(H.out.filter((s) => poly(s) && Math.abs(bounds(s).min.z - 10) < EPS)).toEqual([]);
  });

  it("portico 0.6 × 8 × 6 with a stone lintel and two lamps, centered on the +x face", () => {
    const dark = H.out.filter((s) => s.mat === "officeDark" && bounds(s).min.z === 0 && bounds(s).max.z === 6);
    expect(dark).toHaveLength(1);
    const b = bounds(dark[0]!), cy = (HOTEL_BLOCK.y0 + HOTEL_BLOCK.y1) / 2;
    expect(b.min.x).toBeCloseTo(HOTEL_BLOCK.x1, 9);
    expect(b.max.x - b.min.x).toBeCloseTo(0.6, 9);
    expect(b.max.y - b.min.y).toBeCloseTo(8, 9);
    expect((b.min.y + b.max.y) / 2).toBeCloseTo(cy, 9);
    const lintel = H.out.filter((s) => s.mat === "stone");
    expect(lintel).toHaveLength(1);
    expect(bounds(lintel[0]!).min.z).toBe(6);
    expect(H.lights).toHaveLength(2);
    for (const l of H.lights) expect(Math.abs(l.at.y - cy)).toBeGreaterThan(4);
  });

  it("the machine room is an officeDark prism on the roof, inside the block and west of the lattice legs (x ≤ 110)", () => {
    const m = H.out.filter((s) => s.kind === "prism" && s.mat === "officeDark" && bounds(s).min.z === HOTEL_ROOF);
    expect(m).toHaveLength(1);
    const b = bounds(m[0]!);
    expect(b.max.x).toBeLessThanOrEqual(110);
    expect(b.min.x).toBeGreaterThan(HOTEL_BLOCK.x0); expect(b.max.y).toBeLessThan(HOTEL_BLOCK.y1); expect(b.min.y).toBeGreaterThan(HOTEL_BLOCK.y0);
  });

  it("no 45° anywhere: every poly edge is axis-aligned or the 2.4 chamfer", () => {
    for (const s of H.out) {
      if (!poly(s) || s.mat === "glass") continue; // the old sign's panel is Task 3's
      s.footprint.forEach((p, i) => {
        const q = s.footprint[(i + 1) % s.footprint.length]!, dx = Math.abs(q.x - p.x), dy = Math.abs(q.y - p.y);
        expect(dx < EPS || dy < EPS || Math.abs(Math.hypot(dx, dy) - CHAMFER * Math.SQRT2) < EPS, `${s.mat} ${JSON.stringify(p)}`).toBe(true);
      });
    }
  });

  it("rooms: 312 amber polys on the +x wall (x 125.5) or the +y wall (y 313.5), none on floor 0", () => {
    expect(H.lit.rooms).toHaveLength(312);
    for (const r of H.lit.rooms) {
      expect(r.kind === "poly" && r.color === "amber").toBe(true);
      if (r.kind !== "poly") continue;
      expect(r.pts.every((p) => Math.abs(p.x - HOTEL_BLOCK.x1) < 1e-3) || r.pts.every((p) => Math.abs(p.y - HOTEL_BLOCK.y1) < 1e-3)).toBe(true);
      expect(Math.min(...r.pts.map((p) => p.z))).toBeGreaterThanOrEqual(FH - 1e-6);
    }
  });

  it("paperWindow: 0.6 in front of the +x wall, on floor 7, at the smallest y of that floor's windows", () => {
    const w = H.lit.paperWindow;
    expect(w.x).toBeCloseTo(HOTEL_BLOCK.x1 + 0.6, 9);
    expect(w.z).toBeGreaterThan(7 * FH); expect(w.z).toBeLessThan(8 * FH);
    const row = H.lit.rooms.filter((r) => r.kind === "poly" && r.pts.every((p) => Math.abs(p.x - HOTEL_BLOCK.x1) < 1e-3 && p.z > 7 * FH && p.z < 8 * FH));
    expect(row).toHaveLength(12);
    const minY = Math.min(...row.map((r) => (r.kind === "poly" ? r.pts.reduce((s, p) => s + p.y, 0) / r.pts.length : 0)));
    expect(w.y).toBeCloseTo(minY, 6);
  });

  it("hotelStandIn builds the same building solids as hotel (no sign), displaced by −HOTEL_CENTER, with no facade", () => {
    const d = { x: -HOTEL_CENTER.x, y: -HOTEL_CENTER.y };
    const shift = (s: Solid): Solid => {
      if (s.kind === "poly") { const { facade: _f, ...r } = s; return { ...r, footprint: s.footprint.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) }; }
      if (s.kind === "prism") return { ...s, at: { ...s.at, x: s.at.x + d.x, y: s.at.y + d.y } };
      throw new Error(`unexpected ${s.kind} in the building`);
    };
    const building = H.out.slice(0, stand.out.length); // `body` pushes before the sign: the building is the leading solids
    expect(building.some((s) => s.mat === "glass")).toBe(false);
    expect(stand.out).toHaveLength(building.length);
    expect(H.out[stand.out.length]).toEqual(SIGN_BACKING); // the sign's first solid follows: a dropped trailing building solid shows
    const key = (s: Solid) => JSON.stringify(s, (_k, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)); // float noise of the displacement
    expect(stand.out.map(key)).toEqual(building.map((s) => key(shift(s))));
    for (const s of stand.out) expect("facade" in s && s.facade !== undefined, `${s.kind} ${s.mat}`).toBe(false);
    expect(stand.accents).toEqual([]);
  });

  it("train rule: every solid of the hotel keeps y_min − 1.4·z_max ≥ 134.5", () => {
    for (const s of H.out) { const b = bounds(s); expect(b.min.y - 1.4 * b.max.z, `${s.kind} ${s.mat} ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(134.5 - 1e-9); }
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
});

describe("sign-hotel: RESUME on the roof (#494)", () => {
  const sign = (at = v3(0, 0, 0)) => { const out: Solid[] = [], accents: Accent[] = []; hotelSign(out, accents, at); return { out, accents }; };
  const S = sign();
  const beams = S.out.filter((b): b is Solid & { kind: "beam" } => b.kind === "beam");
  const pts = RESUME_SIGN.glyphs.flatMap((g) => g.quads.flat());

  it("RESUME_SIGN: facade sign along −y with the plate as backing", () => {
    expect(RESUME_SIGN).toMatchObject({ id: "cartel-torre", text: "RESUME", size: 12, color: "greenMid", xHeight: 12, stroke: MARQUEE_FACE * 12, facade: true });
    expect(RESUME_SIGN.backing).toEqual([SIGN_BACKING]);
    for (const g of RESUME_SIGN.glyphs) {
      expect(g.plane.u.x).toBeCloseTo(0, 9); expect(g.plane.u.y).toBeCloseTo(-1.17, 9); expect(g.plane.v).toEqual(v3(0, 0, 1)); expect(g.plane.origin.x).toBe(123);
    }
    const ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
    expect(Math.min(...ys)).toBeCloseTo(242.03, 2); expect(Math.max(...ys)).toBeCloseTo(312.86, 2);
    expect(Math.min(...zs)).toBeCloseTo(61.6, 6); expect(Math.max(...zs)).toBeCloseTo(73.6, 6);
    expect(SIGN_SITE.x).toBe(123); expect(SIGN_SITE.y).toBeCloseTo(277.445, 2); expect(SIGN_SITE.z).toBe(61.6);
  });

  it("the oracle is green at both scales with aspect margin", () => {
    expect(checkSignFont(RESUME_SIGN)).toEqual([]);
    for (const s of [COVER_LAPTOP, COVER_PHONE]) {
      expect(checkSign(RESUME_SIGN, s, H.out), `${s}`).toEqual([]);
      expect(signMetrics(RESUME_SIGN, s).aspectError).toBeLessThanOrEqual(0.075);
    }
  });

  it("accents: greenBleed sides (no bloom) first, then the greenMid faces, then the warm bulbs at x 123.05", () => {
    const kinds = S.accents.map((a) => (a.kind === "poly" ? a.color : `${a.kind}:${a.color}`));
    const firstFace = kinds.indexOf("greenMid"), lastSide = kinds.lastIndexOf("greenBleed"), firstDot = kinds.indexOf("dot:windowWarm");
    expect(lastSide).toBeLessThan(firstFace);
    expect(kinds.lastIndexOf("greenMid")).toBeLessThan(firstDot);
    const faces = S.accents.filter((a) => a.kind === "poly" && a.color === "greenMid").map((a) => (a.kind === "poly" ? a.pts : []));
    expect(faces).toEqual(RESUME_SIGN.glyphs.flatMap((g) => g.quads));
    const sides = S.accents.filter((a) => a.kind === "poly" && a.color === "greenBleed");
    expect(sides.length).toBeGreaterThanOrEqual(RESUME_SIGN.glyphs.length);
    for (const a of sides) {
      if (a.kind !== "poly") continue;
      expect(a.bloom).toBe(false); expect(a.alpha).toBe(1);
      const xs = a.pts.map((p) => p.x).sort((p, q) => p - q);
      expect(xs[0]).toBeCloseTo(121.8, 9); expect(xs[1]).toBeCloseTo(121.8, 9); expect(xs[2]).toBeCloseTo(123, 9); expect(xs[3]).toBeCloseTo(123, 9);
      const [p, q, , r] = a.pts as [ReturnType<typeof v3>, ReturnType<typeof v3>, ReturnType<typeof v3>, ReturnType<typeof v3>];
      const e = v3(q.x - p.x, q.y - p.y, q.z - p.z), x = v3(r.x - p.x, r.y - p.y, r.z - p.z); // the quad's two edges: along the contour, along −x
      const n = v3(e.y * x.z - e.z * x.y, e.z * x.x - e.x * x.z, e.x * x.y - e.y * x.x);
      expect(Math.abs(dot(n, VIEW_DIR))).toBeGreaterThan(0);
    }
    const dots = S.accents.filter((a) => a.kind === "dot");
    expect(dots.length).toBeGreaterThan(0);
    for (const d of dots) if (d.kind === "dot") { expect(d.color).toBe("windowWarm"); expect(d.at.x).toBeCloseTo(123.05, 9); }
  });

  it("the plate comes first and no glass; the lattice is steel beams behind the letters up to z 75", () => {
    expect(S.out[0]).toEqual(SIGN_BACKING);
    expect(S.out.some((s) => s.mat === "glass")).toBe(false);
    const lattice = beams.filter((b) => b.w === 0.3 && b.h === 0.3 && bounds(b).max.x <= 121.3 + 1e-9);
    expect(lattice.every((b) => b.mat === "steel" && b.interlocks === true)).toBe(true);
    expect(Math.max(...lattice.map((b) => bounds(b).max.z))).toBeCloseTo(75, 9);
    const uprights = lattice.filter((b) => b.from.x === b.to.x && b.from.y === b.to.y);
    expect(new Set(uprights.map((b) => Math.round(b.from.y * 1000) / 1000))).toEqual(new Set(Array.from({ length: 13 }, (_, k) => 240.5 + 6 * k)));
    const chords = lattice.filter((b) => b.from.z === b.to.z && b.from.x === b.to.x && b.from.y !== b.to.y);
    expect(new Set(chords.map((b) => b.from.z))).toEqual(new Set([60.15, 74.85]));
    const diag = lattice.filter((b) => b.from.y !== b.to.y && b.from.z !== b.to.z && b.from.x === b.to.x);
    expect(diag).toHaveLength(12);
    const legs = lattice.filter((b) => b.from.x !== b.to.x);
    expect(legs).toHaveLength(7);
    for (const l of legs) { expect(l.from.z).toBeCloseTo(72, 9); expect(l.from.x).toBeCloseTo(121, 9); expect(l.to.z).toBeCloseTo(60, 9); expect(l.to.x).toBeCloseTo(114, 9); }
  });

  it("the walkway: a steel deck x 123.3..125.2, y 242..311, z 60..60.2, a rail at x 125.05 and posts every 6 u", () => {
    const deck = S.out.filter((s) => s.mat === "steel" && s.kind === "prism").map(bounds).filter((b) => Math.abs(b.min.x - 123.3) < 1e-9);
    expect(deck).toHaveLength(1);
    const d = deck[0]!;
    expect([d.max.x, d.min.y, d.max.y, d.min.z, d.max.z]).toEqual([125.2, 242, 311, 60, 60.2].map((n) => expect.closeTo(n, 9)));
    const rails = beams.filter((b) => b.from.x === 125.05 && b.to.x === 125.05 && b.from.z === 61.2 && b.to.z === 61.2);
    expect(rails.length).toBeGreaterThan(0);
    const posts = beams.filter((b) => b.from.x === 125.05 && b.from.y === b.to.y && b.from.z < b.to.z);
    expect(posts.length).toBeGreaterThanOrEqual(12);
  });

  it("nothing slanted at 45° in plan; the train rule holds for hotel and sign", () => {
    for (const b of beams) { const dx = Math.abs(b.to.x - b.from.x), dy = Math.abs(b.to.y - b.from.y); expect(dx < 1e-9 || dy < 1e-9, JSON.stringify(b)).toBe(true); }
    for (const s of [...H.out, ...S.out]) { const b = bounds(s); expect(b.min.y - 1.4 * b.max.z, `${s.kind} ${s.mat}`).toBeGreaterThanOrEqual(134.5 - 1e-9); }
  });

  it("hotelSign displaces everything by d and its plate is a fresh copy", () => {
    const d = v3(1, 2, 0.5), M = sign(d);
    expect(M.out).toHaveLength(S.out.length);
    expect(M.out[0]).not.toBe(SIGN_BACKING);
    S.out.forEach((s, i) => { const a = bounds(s), b = bounds(M.out[i]!); expect(b.min.x - a.min.x).toBeCloseTo(1, 9); expect(b.min.y - a.min.y).toBeCloseTo(2, 9); expect(b.min.z - a.min.z).toBeCloseTo(0.5, 9); });
    S.accents.forEach((a, i) => { const m = M.accents[i]!; if (a.kind === "dot" && m.kind === "dot") expect(m.at.y - a.at.y).toBeCloseTo(2, 9); });
  });
});
