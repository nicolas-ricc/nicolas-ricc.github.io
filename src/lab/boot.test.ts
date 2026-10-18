import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBoot } from "./boot";

afterEach(() => { vi.restoreAllMocks(); });

describe("runBoot (#103)", () => {
  it("si la init del renderer rechaza, escribe el mensaje en el host y lo registra", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "" };
    const err = new Error("WebGL no disponible");
    await runBoot(host, "lab", () => Promise.reject(err));
    expect(host.textContent).toBe("No se pudo iniciar el renderer: WebGL no disponible");
    expect(error).toHaveBeenCalledWith("[lab] no se pudo iniciar el renderer", err);
  });
  it("un rechazo que no es Error se muestra tal cual", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "" };
    await runBoot(host, "storybook", () => Promise.reject("sin contexto"));
    expect(host.textContent).toBe("No se pudo iniciar el renderer: sin contexto");
  });
  it("el mensaje reemplaza lo que ya hubiera en el host (el canvas a medio armar)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "canvas" };
    await runBoot(host, "lab", async () => { throw new Error("shader"); });
    expect(host.textContent).toBe("No se pudo iniciar el renderer: shader");
  });
  it("un arranque que funciona no toca el host ni registra error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = { textContent: "" };
    await runBoot(host, "lab", async () => {});
    expect(host.textContent).toBe("");
    expect(error).not.toHaveBeenCalled();
  });
});

const ROOT = new URL("../../", import.meta.url).pathname;

describe("el mensaje de arranque se lee sobre el cielo (#103)", () => {
  for (const p of ["world", "blog", "resume", "portfolio", "storybook"]) {
    it(`lab/${p}.html fija el color de texto claro del storybook en html, body`, () => {
      const html = readFileSync(`${ROOT}lab/${p}.html`, "utf8");
      expect(html).toMatch(/html, body \{[^}]*color: #d8d4e8;[^}]*font: 14px\/1\.4 system-ui, sans-serif;/);
    });
  }
});

describe("las páginas arrancan con runBoot (#103)", () => {
  for (const [file, prefix] of [["page.ts", "lab"], ["storybook.ts", "storybook"]] as const) {
    it(`src/lab/${file} no deja el rechazo de boot() sin atender`, () => {
      const src = readFileSync(`${ROOT}src/lab/${file}`, "utf8");
      expect(src).not.toMatch(/void boot\(\)/);
      expect(src).toMatch(new RegExp(`void runBoot\\(host, "${prefix}", boot\\);`));
    });
  }
});
