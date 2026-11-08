import { describe, expect, it } from "vitest";
import { ISO_TONES } from "./palette-iso";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, cityLadder, darken, extendLadder } from "./palette-base";

describe("darken", () => {
  it("multiplies each channel and rounds without overflowing into its neighbors", () => {
    expect(darken(0xffffff, 0.7)).toBe(0xb3b3b3); // 255 × 0.7 = 178.5 → 179
    expect(darken(0x000000, 0.7)).toBe(0x000000);
    expect(darken(0x010203, 0.7)).toBe(0x010102); // 0.7 → 1, 1.4 → 1, 2.1 → 2
    expect(darken(0x171423, 1)).toBe(0x171423);
  });

  it("the base is the low sunset atlas and the factor is 0.7", () => {
    expect(DARKEN).toBe(0.7);
    expect(BASE_SKY).toBe(0x171423);
    expect(BASE_SHADOW).toBe(0x2a1a3a);
    expect(BASE_TONES.slab).toEqual({ top: 0x9a7f62, lit: 0x81613e, shade: 0x3d3942, up: 0xb89268, down: 0x82705e });
    expect(BASE_TONES.glint.top).toBe(0xf58c5a);
  });

  it("station materials: tile, canopy and livery; ISO_TONES is the base darkened channel by channel", () => {
    expect(BASE_TONES.tile.top).toBe(0xb0603c); // the coastal neighborhood's tile (#240), which reached main first; the station shares it
    expect(BASE_TONES.canopy.top).toBe(0x3f6b4a);
    expect(BASE_TONES.livery.top).toBe(0x2457b8);
    for (const m of ["tile", "canopy", "livery"] as const) {
      for (const tone of ["top", "lit", "shade", "up", "down"] as const) expect(ISO_TONES[m][tone]).toBe(darken(BASE_TONES[m][tone], DARKEN));
    }
  });
});

const ch = (c: number, s: number) => (c >> s) & 255;
const near = (a: number, b: number) => { for (const s of [16, 8, 0]) expect(Math.abs(ch(a, s) - ch(b, s))).toBeLessThanOrEqual(1); };
const mul = (c: number, f: readonly [number, number, number]) =>
  (Math.min(255, Math.round(ch(c, 16) * f[0])) << 16) | (Math.min(255, Math.round(ch(c, 8) * f[1])) << 8) | Math.min(255, Math.round(ch(c, 0) * f[2]));
const mean = (a: number, b: number) => (Math.round((ch(a, 16) + ch(b, 16)) / 2) << 16) | (Math.round((ch(a, 8) + ch(b, 8)) / 2) << 8) | Math.round((ch(a, 0) + ch(b, 0)) / 2);

describe("ladders", () => {
  it("cityLadder follows the city and coast rule", () => {
    const t = cityLadder(0x8a8296);
    expect(t.top).toBe(0x8a8296);
    near(t.lit, mul(0x8a8296, [0.82, 0.74, 0.62]));
    near(t.shade, mul(0x8a8296, [0.40, 0.42, 0.60]));
    near(t.up, mul(0x8a8296, [1.16, 1.12, 1.02]));
    near(t.down, mul(0x8a8296, [0.86, 0.88, 0.94]));
  });

  it("cityLadder clamps to 255", () => {
    // red and green clamp to 255; blue (0xf0 × 1.02 = 244.8) does not
    expect(cityLadder(0xf0f0f0).up).toBe(0xfffff5);
  });

  it("extendLadder adds deep, dim, pale and glow (pale between up and glow)", () => {
    const b = BASE_TONES.office, n = extendLadder(b);
    for (const k of ["top", "lit", "shade", "up", "down"] as const) expect(n[k]).toBe(b[k]);
    near(n.deep, mul(b.shade, [0.70, 0.72, 0.80]));
    near(n.dim, mean(b.shade, b.lit));
    near(n.glow, mul(b.up, [1.12, 1.08, 1.02]));
    near(n.pale, mean(b.up, n.glow));
  });

  it("glow clamps to 255 without overflowing into the neighboring channel", () => {
    const n = extendLadder(BASE_TONES.whitewash); // up 0xf8e8c3: 248 × 1.12 > 255
    expect(n.glow).toBe(0xfffbc7);
  });

  it("the four Resume level 2 materials come from cityLadder", () => {
    const tops = { plaster: 0xb89a86, terracotta: 0x9a5a3c, marble: 0xcfc4b0, awning: 0x3a5a4a } as const;
    for (const [m, top] of Object.entries(tops) as [keyof typeof tops, number][]) {
      const want = cityLadder(top);
      for (const k of ["top", "lit", "shade", "up", "down"] as const) near(BASE_TONES[m][k], want[k]);
    }
  });
});

describe("corrugated sheet and containers (#321)", () => {
  const TOPS = { sheetGreen: 0x6a7a6e, sheetTeal: 0x4a6a76, boxRust: 0x8a4a32, boxBlue: 0x3e5c80, boxGreen: 0x4e6e4a, boxGrey: 0x707070, boxOrange: 0xb0703a } as const;

  it("the seven #56 materials come from cityLadder and ISO_TONES darkens their top", () => {
    for (const [m, top] of Object.entries(TOPS) as [keyof typeof TOPS, number][]) {
      const want = cityLadder(top);
      for (const k of ["top", "lit", "shade", "up", "down"] as const) near(BASE_TONES[m][k], want[k]);
      expect(ISO_TONES[m].top).toBe(darken(top, DARKEN));
    }
  });
});
