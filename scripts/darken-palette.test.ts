import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_TONES } from "../src/map/palette-base";
import { paletteLiterals } from "./darken-palette";

describe("darken-palette", () => {
  const out = paletteLiterals();

  it("una línea por material, con el formato del atlas", () => {
    expect(out.tones).toHaveLength(Object.keys(BASE_TONES).length);
    expect(out.tones[0]).toBe("  slab:      { deep: 0x1e1d25, shade: 0x2b282e, dim: 0x43362d, lit: 0x5a442b, down: 0x5b4e42, top: 0x6c5945, up: 0x816649, pale: 0x896a4a, glow: 0x906f4a },");
    expect(out.tones.find((l) => l.includes("officeDark"))).toMatch(/^ {2}officeDark:\{ deep: 0x/);
  });

  it("cada línea trae los nueve tonos en orden", () => {
    const nine = /\{ deep: 0x[0-9a-f]{6}, shade: 0x[0-9a-f]{6}, dim: 0x[0-9a-f]{6}, lit: 0x[0-9a-f]{6}, down: 0x[0-9a-f]{6}, top: 0x[0-9a-f]{6}, up: 0x[0-9a-f]{6}, pale: 0x[0-9a-f]{6}, glow: 0x[0-9a-f]{6} \},$/;
    for (const l of out.tones) expect(l).toMatch(nine);
  });

  it("sky, shadow y el hex CSS del sky", () => {
    expect(out.sky).toBe("  sky: 0x100e19,");
    expect(out.shadow).toBe("  shadow: 0x1d1229,");
    expect(out.css).toBe("#100e19");
  });

  it("lo impreso es lo que está pegado en palette-iso.ts", () => {
    const src = readFileSync(new URL("../src/map/palette-iso.ts", import.meta.url), "utf8");
    for (const line of [...out.tones, out.shadow, out.sky]) expect(src).toContain(line.trim().replace(/,$/, ""));
  });
});
