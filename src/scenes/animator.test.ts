import { describe, expect, it, vi } from "vitest";
import { layerLookup, type AnimLayer } from "./animator";

const capa: AnimLayer = { kind: "accent", accents: [] };

describe("layerLookup", () => {
  it("resuelve un id de la tabla llamando a su función en cada pedido", () => {
    const f = vi.fn(() => capa);
    const layer = layerLookup("pruebaAnimator", { "prueba.a": f });
    expect(layer("prueba.a")).toBe(capa);
    expect(layer("prueba.a")).toBe(capa);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("con un id desconocido lanza un Error que nombra el animador y el id", () => {
    const layer = layerLookup("pruebaAnimator", { "prueba.a": () => capa });
    expect(() => layer("prueba.b")).toThrow(new Error("Capa desconocida en pruebaAnimator: prueba.b"));
  });

  it("no confunde las claves heredadas de Object.prototype con capas", () => {
    const layer = layerLookup("pruebaAnimator", {});
    for (const id of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(() => layer(id)).toThrow(`Capa desconocida en pruebaAnimator: ${id}`);
    }
  });

  it("ve las capas agregadas a la tabla después de crear el lookup", () => {
    const layers: Record<string, () => AnimLayer> = {};
    const layer = layerLookup("pruebaAnimator", layers);
    layers["prueba.tarde"] = () => capa;
    expect(layer("prueba.tarde")).toBe(capa);
  });
});
