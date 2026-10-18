import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, ISO_COLORS, ISO_TONES, TONE_LADDER, allIsoColors, stepTone, toneColor, type AccentColor, type Material } from "./palette-iso";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken, extendLadder } from "./palette-base";

const lum = (c: number): number => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

type WaterMat = "shallow" | "water" | "waterDeep" | "abyss";
type AguaPaleta = Record<WaterMat | "glint", Record<"top" | "up" | "lit" | "down", number>>;

// Los umbrales base se calibraron sobre la paleta previa al oscurecimiento de #12;
// se escalan por el factor para que el test siga la relación y no el brillo absoluto.
const CRESTA_SUTIL = 30, DESTELLO_CALIDO = 120, DESTELLO_CLARO = 30;

function aguaYDestello(tones: AguaPaleta, factor: number): void {
  const rgb = (c: number) => [c >> 16, (c >> 8) & 255, c & 255] as const;
  const warmth = (c: number) => rgb(c)[0] - rgb(c)[2];
  const blueShare = (c: number) => rgb(c)[2] / (rgb(c)[0] + rgb(c)[1] + rgb(c)[2]);
  const mats = ["shallow", "water", "waterDeep", "abyss"] as const;
  for (let i = 1; i < mats.length; i++) expect(lum(tones[mats[i]!].top)).toBeLessThan(lum(tones[mats[i - 1]!].top));
  for (const m of mats) {
    expect(warmth(tones[m].up)).toBeGreaterThan(warmth(tones[m].top)); // apenas más cálida
    expect(blueShare(tones[m].up)).toBeGreaterThan(0.4); // pero azul: la cresta no es un destello
    expect(lum(tones[m].up) - lum(tones[m].top)).toBeLessThan(CRESTA_SUTIL * factor); // y sutil
    expect(warmth(tones.glint.top)).toBeGreaterThan(warmth(tones[m].top) + DESTELLO_CALIDO * factor); // el destello sí es coral
    expect(lum(tones.glint.top)).toBeGreaterThan(lum(tones[m].up) + DESTELLO_CLARO * factor);
    expect(blueShare(tones[m].lit)).toBeGreaterThan(blueShare(tones[m].top));
    expect(lum(tones[m].lit)).toBeLessThan(lum(tones[m].down));
    expect(lum(tones[m].down)).toBeLessThan(lum(tones[m].top));
  }
}

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
    aguaYDestello(ISO_TONES, DARKEN);
    expect(Object.keys(ISO_TONES.hullBlue).sort()).toEqual([...TONE_LADDER].sort());
  });

  it("agua y destello aguantan otro oscurecimiento: los umbrales siguen al factor", () => {
    const factor = 0.6;
    const tonos = (m: WaterMat | "glint") => ({
      top: darken(BASE_TONES[m].top, factor), up: darken(BASE_TONES[m].up, factor),
      lit: darken(BASE_TONES[m].lit, factor), down: darken(BASE_TONES[m].down, factor),
    });
    const tones: AguaPaleta = {
      shallow: tonos("shallow"), water: tonos("water"), waterDeep: tonos("waterDeep"), abyss: tonos("abyss"), glint: tonos("glint"),
    };
    aguaYDestello(tones, factor);
  });

  it("agua y destello fallan si se invierte la relación", () => {
    const tones: AguaPaleta = { ...ISO_TONES, glint: { ...ISO_TONES.glint, top: ISO_TONES.shallow.up } };
    expect(() => aguaYDestello(tones, DARKEN)).toThrow(/expected/);
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

  it("ink, el texto de las páginas del lab, está en la paleta y no es un acento", () => {
    expect(ISO_COLORS.ink).toBe(0xd8d4e8);
    expect(allIsoColors().has(ISO_COLORS.ink)).toBe(true);
    expect(ACCENT_COLORS).not.toContain("ink");
    // @ts-expect-error ink no es un color de acento
    const accent: AccentColor = "ink";
    expect(accent).toBe("ink");
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
