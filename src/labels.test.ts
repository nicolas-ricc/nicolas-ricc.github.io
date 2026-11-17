// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyLabel, markCurrent } from "./labels";
import type { ZoneId } from "./map/zones";

describe("applyLabel (#393)", () => {
  it("applyLabel in sign mode sizes the link over the sign and marks it on-sign", () => {
    const a = document.createElement("a");
    applyLabel(a, { mode: "sign", x: 10, y: 20.04, w: 73, h: 14.26 });
    expect(a.classList.contains("on-sign")).toBe(true);
    expect(a.classList.contains("on-edge")).toBe(false);
    expect(a.style.transform).toBe("translate(10.0px, 20.0px)");
    expect(a.style.width).toBe("73.0px");
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
