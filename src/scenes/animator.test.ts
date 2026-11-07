import { describe, expect, it, vi } from "vitest";
import { layerLookup, type AnimLayer } from "./animator";

const anyLayer: AnimLayer = { kind: "accent", accents: [] };

describe("layerLookup", () => {
  it("resolves a table id by calling its function on every request", () => {
    const f = vi.fn(() => anyLayer);
    const layer = layerLookup("testAnimator", { "test.a": f });
    expect(layer("test.a")).toBe(anyLayer);
    expect(layer("test.a")).toBe(anyLayer);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("with an unknown id throws an Error that names the animator and the id", () => {
    const layer = layerLookup("testAnimator", { "test.a": () => anyLayer });
    expect(() => layer("test.b")).toThrow(new Error("Unknown layer in testAnimator: test.b"));
  });

  it("does not mistake keys inherited from Object.prototype for layers", () => {
    const layer = layerLookup("testAnimator", {});
    for (const id of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
      expect(() => layer(id)).toThrow(`Unknown layer in testAnimator: ${id}`);
    }
  });

  it("sees layers added to the table after the lookup is created", () => {
    const layers: Record<string, () => AnimLayer> = {};
    const layer = layerLookup("testAnimator", layers);
    layers["test.late"] = () => anyLayer;
    expect(layer("test.late")).toBe(anyLayer);
  });
});
