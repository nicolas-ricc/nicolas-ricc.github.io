import { describe, expect, it } from "vitest";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, cityLadder, darken, extendLadder } from "./palette-base";

describe("darken", () => {
  it("multiplica cada canal y redondea sin desbordar a los vecinos", () => {
    expect(darken(0xffffff, 0.7)).toBe(0xb3b3b3); // 255 × 0.7 = 178.5 → 179
    expect(darken(0x000000, 0.7)).toBe(0x000000);
    expect(darken(0x010203, 0.7)).toBe(0x010102); // 0.7 → 1, 1.4 → 1, 2.1 → 2
    expect(darken(0x171423, 1)).toBe(0x171423);
  });

  it("la base es el atlas atardecer bajo y el factor es 0.7", () => {
    expect(DARKEN).toBe(0.7);
    expect(BASE_SKY).toBe(0x171423);
    expect(BASE_SHADOW).toBe(0x2a1a3a);
    expect(BASE_TONES.slab).toEqual({ top: 0x9a7f62, lit: 0x81613e, shade: 0x3d3942, up: 0xb89268, down: 0x82705e });
    expect(BASE_TONES.glint.top).toBe(0xf58c5a);
  });
});

const ch = (c: number, s: number) => (c >> s) & 255;
const near = (a: number, b: number) => { for (const s of [16, 8, 0]) expect(Math.abs(ch(a, s) - ch(b, s))).toBeLessThanOrEqual(1); };
const mul = (c: number, f: readonly [number, number, number]) =>
  (Math.min(255, Math.round(ch(c, 16) * f[0])) << 16) | (Math.min(255, Math.round(ch(c, 8) * f[1])) << 8) | Math.min(255, Math.round(ch(c, 0) * f[2]));
const mean = (a: number, b: number) => (Math.round((ch(a, 16) + ch(b, 16)) / 2) << 16) | (Math.round((ch(a, 8) + ch(b, 8)) / 2) << 8) | Math.round((ch(a, 0) + ch(b, 0)) / 2);

describe("escaleras", () => {
  it("cityLadder sigue la regla de ciudad y costa", () => {
    const t = cityLadder(0x8a8296);
    expect(t.top).toBe(0x8a8296);
    near(t.lit, mul(0x8a8296, [0.82, 0.74, 0.62]));
    near(t.shade, mul(0x8a8296, [0.40, 0.42, 0.60]));
    near(t.up, mul(0x8a8296, [1.16, 1.12, 1.02]));
    near(t.down, mul(0x8a8296, [0.86, 0.88, 0.94]));
  });

  it("cityLadder satura a 255", () => {
    // rojo y verde saturan a 255; el azul (0xf0 × 1.02 = 244,8) no
    expect(cityLadder(0xf0f0f0).up).toBe(0xfffff5);
  });

  it("extendLadder agrega deep, dim, pale y glow (pale entre up y glow)", () => {
    const b = BASE_TONES.office, n = extendLadder(b);
    for (const k of ["top", "lit", "shade", "up", "down"] as const) expect(n[k]).toBe(b[k]);
    near(n.deep, mul(b.shade, [0.70, 0.72, 0.80]));
    near(n.dim, mean(b.shade, b.lit));
    near(n.glow, mul(b.up, [1.12, 1.08, 1.02]));
    near(n.pale, mean(b.up, n.glow));
  });

  it("glow satura a 255 sin desbordar al canal vecino", () => {
    const n = extendLadder(BASE_TONES.whitewash); // up 0xf8e8c3: 248 × 1.12 > 255
    expect(n.glow).toBe(0xfffbc7);
  });

  it("los cuatro materiales de Resume nivel 2 salen de cityLadder", () => {
    const tops = { plaster: 0xb89a86, terracotta: 0x9a5a3c, marble: 0xcfc4b0, awning: 0x3a5a4a } as const;
    for (const [m, top] of Object.entries(tops) as [keyof typeof tops, number][]) {
      const want = cityLadder(top);
      for (const k of ["top", "lit", "shade", "up", "down"] as const) near(BASE_TONES[m][k], want[k]);
    }
  });
});
