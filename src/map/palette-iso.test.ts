import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ISO_COLORS, ISO_TONES, TONE_LADDER, allIsoColors, stepTone, toneColor, type AccentColor, type Material } from "./palette-iso";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken, extendLadder } from "./palette-base";

const lum = (c: number): number => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

type WaterMat = "shallow" | "water" | "waterDeep" | "abyss";
type WaterPalette = Record<WaterMat | "glint", Record<"top" | "up" | "lit" | "down", number>>;

// The base thresholds were calibrated on the palette before the darkening of #12;
// they are scaled by the factor so the test follows the relation and not the absolute brightness.
const CREST_SUBTLE = 30, GLINT_WARM = 120, GLINT_LIGHT = 30;
// Floor of the blue fraction b / (r + g + b) of the crest (the water's up tone). It is a ratio,
// so it is not scaled by the darkening factor. A neutral gray gives 1/3 and the coral of
// glint.top gives ≈0.19, so 0.4 demands that blue clearly dominate. The tightest material
// today is shallow.up, at ≈0.415.
const CREST_BLUE = 0.4;

function waterAndGlint(tones: WaterPalette, factor: number): void {
  const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
  const warmth = (c: number) => rgb(c)[0] - rgb(c)[2];
  const blueShare = (c: number) => rgb(c)[2] / (rgb(c)[0] + rgb(c)[1] + rgb(c)[2]);
  const mats = ["shallow", "water", "waterDeep", "abyss"] as const;
  for (let i = 1; i < mats.length; i++) expect(lum(tones[mats[i]!].top)).toBeLessThan(lum(tones[mats[i - 1]!].top));
  for (const m of mats) {
    expect(warmth(tones[m].up)).toBeGreaterThan(warmth(tones[m].top)); // barely warmer
    expect(blueShare(tones[m].up)).toBeGreaterThan(CREST_BLUE); // but blue: the crest is not a glint
    expect(lum(tones[m].up) - lum(tones[m].top)).toBeLessThan(CREST_SUBTLE * factor); // and subtle
    expect(warmth(tones.glint.top)).toBeGreaterThan(warmth(tones[m].top) + GLINT_WARM * factor); // the glint is coral
    expect(lum(tones.glint.top)).toBeGreaterThan(lum(tones[m].up) + GLINT_LIGHT * factor);
    expect(blueShare(tones[m].lit)).toBeGreaterThan(blueShare(tones[m].top));
    expect(lum(tones[m].lit)).toBeLessThan(lum(tones[m].down));
    expect(lum(tones[m].down)).toBeLessThan(lum(tones[m].top));
  }
}

describe("isometric palette", () => {
  it("each material has the nine tones, with strictly increasing luminance", () => {
    for (const mat of Object.keys(ISO_TONES) as Material[]) {
      expect(Object.keys(ISO_TONES[mat]).sort()).toEqual([...TONE_LADDER].sort());
      for (let i = 1; i < TONE_LADDER.length; i++) {
        expect(lum(ISO_TONES[mat][TONE_LADDER[i]!])).toBeGreaterThan(lum(ISO_TONES[mat][TONE_LADDER[i - 1]!]));
      }
    }
  });

  it("the shadow is bluer than red (warm light, cool shadow)", () => {
    for (const mat of Object.keys(ISO_TONES) as Material[]) {
      const s = ISO_TONES[mat].shade, top = ISO_TONES[mat].top;
      const blueShare = (c: number) => (c & 255) / (((c >> 16) & 255) + (c & 255) + 1);
      expect(blueShare(s)).toBeGreaterThanOrEqual(blueShare(top));
    }
  });

  it("stepTone climbs and descends the nine-step ladder and is clamped", () => {
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

  it("toneColor and allIsoColors agree", () => {
    expect(toneColor("slab", "top")).toBe(ISO_TONES.slab.top);
    const all = allIsoColors();
    expect(all.has(ISO_TONES.rust.shade)).toBe(true);
    expect(all.has(ISO_COLORS.shadow)).toBe(true);
    expect(all.has(ISO_COLORS.cyan)).toBe(true);
  });

  it("every material has the nine-step ladder", () => {
    const nine = ["deep", "dim", "down", "glow", "lit", "pale", "shade", "top", "up"];
    for (const m of Object.keys(ISO_TONES) as Material[]) {
      expect(Object.keys(ISO_TONES[m]).sort(), m).toEqual(nine);
    }
  });

  it("city and coast exclusive materials", () => {
    for (const m of ["office", "officeDark", "glass", "asphalt", "paving", "plaza", "curtain", "stone", "copper", "whitewash", "foam", "abyss", "hullBlue", "plaster", "terracotta", "marble", "awning"] as const) {
      expect(Object.keys(ISO_TONES[m]).sort()).toEqual([...TONE_LADDER].sort());
    }
  });

  it("detailed factory materials: red beaconing, yellow brick and yellow railing", () => {
    const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
    // on the base: the hue belongs to the material and does not depend on DARKEN; ISO_TONES follows it through the ±1 test
    const [sr, sg, sb] = rgb(BASE_TONES.signal.top);
    expect(sr).toBeGreaterThan(sg + 60);
    expect(sr).toBeGreaterThan(sb + 60);
    for (const m of ["stockbrick", "safety"] as const) {
      const [r, g, b] = rgb(BASE_TONES[m].top);
      expect(r).toBeGreaterThan(b + 40);
      expect(g).toBeGreaterThan(b + 40);
    }
  });

  it("water: four depths that darken, cool trough and a light crest that is still water; the sun goes in glint", () => {
    waterAndGlint(ISO_TONES, DARKEN);
    expect(Object.keys(ISO_TONES.hullBlue).sort()).toEqual([...TONE_LADDER].sort());
  });

  it("water and glint hold up under another darkening: the thresholds follow the factor", () => {
    const factor = 0.6;
    const toneSet = (m: WaterMat | "glint") => ({
      top: darken(BASE_TONES[m].top, factor), up: darken(BASE_TONES[m].up, factor),
      lit: darken(BASE_TONES[m].lit, factor), down: darken(BASE_TONES[m].down, factor),
    });
    const tones: WaterPalette = {
      shallow: toneSet("shallow"), water: toneSet("water"), waterDeep: toneSet("waterDeep"), abyss: toneSet("abyss"), glint: toneSet("glint"),
    };
    waterAndGlint(tones, factor);
  });

  it("water and glint fail if the relation is inverted", () => {
    const tones: WaterPalette = { ...ISO_TONES, glint: { ...ISO_TONES.glint, top: ISO_TONES.shallow.up } };
    expect(() => waterAndGlint(tones, DARKEN)).toThrow(/expected/);
  });

  it("accent triads per zone: cyan, amber and magenta, all in the atlas", () => {
    expect(ACCENT_COLORS).toEqual(["cyan", "cyanMid", "cyanBleed", "amber", "amberMid", "amberBleed", "magenta", "magentaMid", "magentaBleed", "windowWarm", "windowCool"]);
    const all = allIsoColors();
    for (const c of ACCENT_COLORS) expect(all.has(ISO_COLORS[c])).toBe(true);
    // the core is lighter than the mid and the mid lighter than the bleed
    for (const base of ["cyan", "amber", "magenta"] as const) {
      expect(lum(ISO_COLORS[base])).toBeGreaterThan(lum(ISO_COLORS[`${base}Mid`]));
      expect(lum(ISO_COLORS[`${base}Mid`])).toBeGreaterThan(lum(ISO_COLORS[`${base}Bleed`]));
    }
  });

  it("ink, the text of the lab pages, is in the palette and is not an accent", () => {
    expect(ISO_COLORS.ink).toBe(0xd8d4e8);
    expect(allIsoColors().has(ISO_COLORS.ink)).toBe(true);
    expect(ACCENT_COLORS).not.toContain("ink");
    // @ts-expect-error ink is not an accent color
    const accent: AccentColor = "ink";
    expect(accent).toBe("ink");
  });
});

const channelsClose = (a: number, b: number) => {
  for (const s of [16, 8, 0]) expect(Math.abs(((a >> s) & 255) - ((b >> s) & 255))).toBeLessThanOrEqual(1);
};

describe("late dusk", () => {
  it("the nine tones, sky and shadow equal the extended base × DARKEN per channel (±1)", () => {
    expect(Object.keys(ISO_TONES)).toEqual(Object.keys(BASE_TONES));
    for (const mat of Object.keys(BASE_TONES) as Material[]) {
      const ladder = extendLadder(BASE_TONES[mat]);
      for (const tone of TONE_LADDER) channelsClose(ISO_TONES[mat][tone], darken(ladder[tone], DARKEN));
    }
    channelsClose(ISO_COLORS.shadow, darken(BASE_SHADOW, DARKEN));
    channelsClose(ISO_COLORS.sky, darken(BASE_SKY, DARKEN));
  });

  it("the eleven accents are not darkened", () => {
    expect(ACCENT_COLORS.map((c) => ISO_COLORS[c])).toEqual([0x7cf5ff, 0x27b3c9, 0x134a52, 0xffc457, 0xd08a1e, 0x5a3d14, 0xff5ee0, 0xc42a9d, 0x54173f, 0xffd9a0, 0xa8d8ff]);
  });
});

describe("tile (#249)", () => {
  it("tile is warm: terracotta tile", () => {
    const t = BASE_TONES.tile.top, r = (t >> 16) & 255, g = (t >> 8) & 255, b = t & 255;
    expect(r).toBeGreaterThan(b + 60);
    expect(r).toBeGreaterThan(g + 40);
    expect(ISO_TONES.tile.top).toBe(darken(t, DARKEN));
  });
});
