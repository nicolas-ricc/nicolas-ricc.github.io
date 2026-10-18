import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ISO_COLORS, ISO_TONES, TONE_LADDER, allIsoColors, stepTone, toneColor, type Material } from "./palette-iso";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken, extendLadder } from "./palette-base";

const lum = (c: number): number => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

describe("paleta isométrica", () => {
  it("cada material tiene los nueve tonos, con luminancia estrictamente creciente", () => {
    for (const mat of Object.keys(ISO_TONES) as Material[]) {
      expect(Object.keys(ISO_TONES[mat]).sort()).toEqual([...TONE_LADDER].sort());
      for (let i = 1; i < TONE_LADDER.length; i++) {
        expect(lum(ISO_TONES[mat][TONE_LADDER[i]!])).toBeGreaterThan(lum(ISO_TONES[mat][TONE_LADDER[i - 1]!]));
      }
    }
  });

  it("la sombra es más azul que roja (luz cálida, sombra fría)", () => {
    for (const mat of Object.keys(ISO_TONES) as Material[]) {
      const s = ISO_TONES[mat].shade, top = ISO_TONES[mat].top;
      const blueShare = (c: number) => (c & 255) / (((c >> 16) & 255) + (c & 255) + 1);
      expect(blueShare(s)).toBeGreaterThanOrEqual(blueShare(top));
    }
  });

  it("stepTone sube y baja por la escalera de nueve y se clampea", () => {
    expect(TONE_LADDER).toEqual(["deep", "shade", "dim", "lit", "down", "top", "up", "pale", "glow"]);
    expect(stepTone("top", 1)).toBe("up");
    expect(stepTone("top", -1)).toBe("down");
    expect(stepTone("shade", -1)).toBe("deep");
    expect(stepTone("lit", -1)).toBe("dim");
    expect(stepTone("up", 1)).toBe("pale");
    expect(stepTone("glow", 1)).toBe("glow");
    expect(stepTone("deep", -3)).toBe("deep");
    expect(stepTone("lit", 0)).toBe("lit");
  });

  it("toneColor y allIsoColors coinciden", () => {
    expect(toneColor("slab", "top")).toBe(ISO_TONES.slab.top);
    const all = allIsoColors();
    expect(all.has(ISO_TONES.rust.shade)).toBe(true);
    expect(all.has(ISO_COLORS.shadow)).toBe(true);
    expect(all.has(ISO_COLORS.cyan)).toBe(true);
  });

  it("materiales exclusivos de ciudad y costa", () => {
    for (const m of ["office", "officeDark", "glass", "asphalt", "paving", "plaza", "curtain", "stone", "copper", "whitewash", "foam", "abyss", "plaster", "terracotta", "marble", "awning"] as const) {
      expect(Object.keys(ISO_TONES[m]).sort()).toEqual([...TONE_LADDER].sort());
    }
  });

  it("agua: cuatro profundidades que se oscurecen, seno frío y cresta clara que sigue siendo agua; el sol va en glint", () => {
    const rgb = (c: number) => [c >> 16, (c >> 8) & 255, c & 255] as const;
    const warmth = (c: number) => rgb(c)[0] - rgb(c)[2];
    const blueShare = (c: number) => rgb(c)[2] / (rgb(c)[0] + rgb(c)[1] + rgb(c)[2]);
    const mats = ["shallow", "water", "waterDeep", "abyss"] as const;
    for (let i = 1; i < mats.length; i++) expect(lum(ISO_TONES[mats[i]!].top)).toBeLessThan(lum(ISO_TONES[mats[i - 1]!].top));
    for (const m of mats) {
      expect(warmth(ISO_TONES[m].up)).toBeGreaterThan(warmth(ISO_TONES[m].top)); // apenas más cálida
      expect(blueShare(ISO_TONES[m].up)).toBeGreaterThan(0.4); // pero azul: la cresta no es un destello
      expect(lum(ISO_TONES[m].up) - lum(ISO_TONES[m].top)).toBeLessThan(30); // y sutil
      expect(warmth(ISO_TONES.glint.top)).toBeGreaterThan(warmth(ISO_TONES[m].top) + 120); // el destello sí es coral
      expect(lum(ISO_TONES.glint.top)).toBeGreaterThan(lum(ISO_TONES[m].up) + 30);
      expect(blueShare(ISO_TONES[m].lit)).toBeGreaterThan(blueShare(ISO_TONES[m].top));
      expect(lum(ISO_TONES[m].lit)).toBeLessThan(lum(ISO_TONES[m].down));
      expect(lum(ISO_TONES[m].down)).toBeLessThan(lum(ISO_TONES[m].top));
    }
    expect(Object.keys(ISO_TONES.hullBlue).sort()).toEqual([...TONE_LADDER].sort());
  });

  it("tríadas de acento por zona: cian, ámbar y magenta, todas en el atlas", () => {
    expect(ACCENT_COLORS).toEqual(["cyan", "cyanMid", "cyanBleed", "amber", "amberMid", "amberBleed", "magenta", "magentaMid", "magentaBleed", "windowWarm", "windowCool"]);
    const all = allIsoColors();
    for (const c of ACCENT_COLORS) expect(all.has(ISO_COLORS[c])).toBe(true);
    // el núcleo es más claro que el medio y el medio que el sangrado
    for (const base of ["cyan", "amber", "magenta"] as const) {
      expect(lum(ISO_COLORS[base])).toBeGreaterThan(lum(ISO_COLORS[`${base}Mid`]));
      expect(lum(ISO_COLORS[`${base}Mid`])).toBeGreaterThan(lum(ISO_COLORS[`${base}Bleed`]));
    }
  });
});

const channelsClose = (a: number, b: number) => {
  for (const s of [16, 8, 0]) expect(Math.abs(((a >> s) & 255) - ((b >> s) & 255))).toBeLessThanOrEqual(1);
};

describe("crepúsculo tardío", () => {
  it("los nueve tonos, sky y shadow valen la base extendida × DARKEN por canal (±1)", () => {
    expect(Object.keys(ISO_TONES)).toEqual(Object.keys(BASE_TONES));
    for (const mat of Object.keys(BASE_TONES) as Material[]) {
      const ladder = extendLadder(BASE_TONES[mat]);
      for (const tone of TONE_LADDER) channelsClose(ISO_TONES[mat][tone], darken(ladder[tone], DARKEN));
    }
    channelsClose(ISO_COLORS.shadow, darken(BASE_SHADOW, DARKEN));
    channelsClose(ISO_COLORS.sky, darken(BASE_SKY, DARKEN));
  });

  it("los once acentos no se oscurecen", () => {
    expect(ACCENT_COLORS.map((c) => ISO_COLORS[c])).toEqual([0x7cf5ff, 0x27b3c9, 0x134a52, 0xffc457, 0xd08a1e, 0x5a3d14, 0xff5ee0, 0xc42a9d, 0x54173f, 0xffd9a0, 0xa8d8ff]);
  });
});
