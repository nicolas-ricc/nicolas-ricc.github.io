// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyLabel, markCurrent, placeLabel } from "./labels";
import type { ZoneId } from "./map/zones";

describe("applyLabel (#393)", () => {
  it("applyLabel in sign mode sizes the link over the sign and marks it on-sign", () => {
    const a = document.createElement("a");
    applyLabel(a, { mode: "sign", x: 10, y: 20.04, w: 73, h: 14.26 });
    expect(a.classList.contains("on-sign")).toBe(true);
    expect(a.classList.contains("on-edge")).toBe(false);
    expect(a.style.transform).toBe("translate(10.0px, 20.0px)");
    // the CSSOM serializes 73.0px as 73px: compare the rounded number and the unit
    expect(a.style.width).toMatch(/^73(\.0)?px$/);
    expect(a.style.height).toBe("14.3px");
  });

  it("applyLabel in edge mode centers the label and drops the sign size", () => {
    const a = document.createElement("a");
    applyLabel(a, { mode: "sign", x: 10, y: 20, w: 73, h: 14 });
    applyLabel(a, { mode: "edge", x: 340, y: 411 });
    expect(a.classList.contains("on-edge")).toBe(true);
    expect(a.classList.contains("on-sign")).toBe(false);
    expect(a.style.transform).toBe("translate(340.0px, 411.0px) translate(-50%, -50%)");
    expect(a.style.width).toBe("");
    expect(a.style.height).toBe("");
  });
});

describe("placeLabel (#393)", () => {
  /** A link whose box follows its mode, as the CSS does: the inline sign size, or a 90×28 plate on the edge. */
  function link(): HTMLAnchorElement {
    const a = document.createElement("a");
    const size = (sign: number, plate: number, dim: "width" | "height"): number =>
      a.classList.contains("on-sign") ? parseFloat(a.style[dim]) || sign : plate;
    Object.defineProperty(a, "offsetWidth", { get: () => size(0, 90, "width") });
    Object.defineProperty(a, "offsetHeight", { get: () => size(0, 28, "height") });
    return a;
  }
  const V = { x: 0, y: 0, scale: 1 }, HOST = { w: 546, h: 657 };

  // the pad came from the sign box of the previous frame on the pass that flips to edge
  it("a link flipping from sign to edge is clamped with its plate size, not the old sign box", () => {
    const a = link();
    placeLabel(a, { minX: 100, minY: 100, maxX: 240, maxY: 130 }, V, HOST, 8);
    expect(a.classList.contains("on-sign")).toBe(true);
    placeLabel(a, { minX: 540, minY: 300, maxX: 640, maxY: 320 }, V, HOST, 8);
    expect(a.classList.contains("on-edge")).toBe(true);
    // centered at host.w − (plate / 2 + margin) = 546 − 53
    expect(a.style.transform).toBe("translate(493.0px, 310.0px) translate(-50%, -50%)");
  });
});

describe("markCurrent (#393)", () => {
  it("markCurrent puts aria-current=page on the active zone's link only", () => {
    const m = new Map<ZoneId, HTMLElement>((["portfolio", "cv", "blog"] as const).map((id) => [id, document.createElement("a")]));
    markCurrent(m, "cv");
    expect(m.get("cv")!.getAttribute("aria-current")).toBe("page");
    expect(m.get("portfolio")!.getAttribute("aria-current")).toBeNull();
    expect(m.get("blog")!.getAttribute("aria-current")).toBeNull();
    markCurrent(m, null);
    for (const a of m.values()) expect(a.getAttribute("aria-current")).toBeNull();
  });
});
