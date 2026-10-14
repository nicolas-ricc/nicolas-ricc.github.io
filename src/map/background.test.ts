import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ISO_COLORS } from "./palette-iso";

const ROOT = new URL("../../", import.meta.url);
const sky = `#${ISO_COLORS.sky.toString(16).padStart(6, "0")}`;
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

describe("fondo de página = cielo del canvas", () => {
  it("--bg de style.css", () => {
    expect(read("src/style.css").match(/--bg:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase()).toBe(sky);
  });

  const labs = readdirSync(new URL("lab/", ROOT)).filter((f) => f.endsWith(".html"));
  it("encuentra las páginas del lab", () => expect(labs.length).toBeGreaterThanOrEqual(4));
  for (const page of labs) {
    it(`background de lab/${page}`, () => {
      expect(read(`lab/${page}`).match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase()).toBe(sky);
    });
  }
});
