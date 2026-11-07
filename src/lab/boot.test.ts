import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ISO_COLORS } from "../map/palette-iso";
import { runBoot } from "./boot";

afterEach(() => { vi.restoreAllMocks(); });

describe("runBoot (#103)", () => {
  it("if the renderer init rejects, it writes the message to the host and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "" };
    const err = new Error("WebGL unavailable");
    await runBoot(host, "lab", () => Promise.reject(err));
    expect(host.textContent).toBe("Could not start the renderer: WebGL unavailable");
    expect(error).toHaveBeenCalledWith("[lab] could not start the renderer", err);
  });
  it("a rejection that is not an Error is shown as is", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "" };
    await runBoot(host, "storybook", () => Promise.reject("no context"));
    expect(host.textContent).toBe("Could not start the renderer: no context");
  });
  it("the message replaces whatever was already in the host (the half-built canvas)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "canvas" };
    await runBoot(host, "lab", async () => { throw new Error("shader"); });
    expect(host.textContent).toBe("Could not start the renderer: shader");
  });
  it("a boot that works does not touch the host or log an error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "" };
    await runBoot(host, "lab", async () => {});
    expect(host.textContent).toBe("");
    expect(error).not.toHaveBeenCalled();
  });
});

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ink = `#${ISO_COLORS.ink.toString(16).padStart(6, "0")}`;

describe("the boot message is readable over the sky (#103)", () => {
  for (const p of ["world", "blog", "resume", "portfolio", "storybook"]) {
    it(`lab/${p}.html sets the storybook's light text color on html, body`, () => {
      const html = readFileSync(`${ROOT}lab/${p}.html`, "utf8");
      expect(html).toMatch(new RegExp(`html, body \\{[^}]*color: ${ink};[^}]*font: 14px/1\\.4 system-ui, sans-serif;`));
    });
  }
});

describe("the pages boot with runBoot (#103)", () => {
  for (const [file, prefix] of [["page.ts", "lab"], ["storybook.ts", "storybook"]] as const) {
    it(`src/lab/${file} does not leave the boot() rejection unhandled`, () => {
      const src = readFileSync(`${ROOT}src/lab/${file}`, "utf8");
      expect(src).not.toMatch(/void boot\(\)/);
      expect(src).toMatch(new RegExp(`void runBoot\\(host, "${prefix}", boot\\);`));
    });
  }
});
