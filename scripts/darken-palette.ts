import { pathToFileURL } from "node:url";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken, extendLadder } from "../src/map/palette-base";

const NINE = ["deep", "shade", "dim", "lit", "down", "top", "up", "pale", "glow"] as const;
const hex = (c: number) => `0x${darken(c, DARKEN).toString(16).padStart(6, "0")}`;

/** Literales del atlas oscurecido, listos para pegar en src/map/palette-iso.ts. */
export function paletteLiterals(): { tones: string[]; shadow: string; sky: string; css: string } {
  const tones = Object.entries(BASE_TONES).map(([mat, t]) => {
    const n = extendLadder(t);
    return `  ${`${mat}:`.padEnd(11)}{ ${NINE.map((k) => `${k}: ${hex(n[k])}`).join(", ")} },`;
  });
  return {
    tones,
    shadow: `  shadow: ${hex(BASE_SHADOW)},`,
    sky: `  sky: ${hex(BASE_SKY)},`,
    css: `#${darken(BASE_SKY, DARKEN).toString(16).padStart(6, "0")}`,
  };
}

// npm run palette: imprime, no escribe archivos.
if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const out = paletteLiterals();
  console.log(["// ISO_TONES", ...out.tones, "", "// ISO_COLORS", out.shadow, out.sky, "", `// CSS: ${out.css}`].join("\n"));
}
