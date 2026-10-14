import { describe, expect, it } from "vitest";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken } from "./palette-base";

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
