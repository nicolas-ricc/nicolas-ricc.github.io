import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tsconfig.json (#138)", () => {
  const { compilerOptions } = JSON.parse(readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"));
  it("prende noUnusedLocals", () => expect(compilerOptions.noUnusedLocals).toBe(true));
  it("prende noUnusedParameters", () => expect(compilerOptions.noUnusedParameters).toBe(true));
});
