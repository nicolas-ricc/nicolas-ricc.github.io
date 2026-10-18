import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// storybook.ts arranca la app al importarse: se lee el fuente, como en lab-excluded.test.ts
const src = readFileSync(new URL("./storybook.ts", import.meta.url), "utf8");

describe("ciclo de vida de los stages del storybook (#102)", () => {
  it("recicla cada stage con stage.destroy(), nunca destruyendo el contenedor a mano", () => {
    expect(src).not.toMatch(/container\.destroy\(/);
    expect(src).toContain("stage?.destroy()");
  });
});

describe("la entrada actual del índice (#117)", () => {
  it("se centra solo si no se ve entera", () => {
    expect(src).not.toContain('block: "nearest"');
    expect(src).toMatch(/if \(outOfView\(a\.getBoundingClientRect\(\), nav\.getBoundingClientRect\(\)\)\) a\.scrollIntoView\(\{ block: "center" \}\)/);
  });
});
