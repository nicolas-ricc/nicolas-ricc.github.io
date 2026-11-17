import { describe, expect, it } from "vitest";
import type { RenderItem } from "../src/iso/render-list";
import { ISO_COLORS } from "../src/map/palette-iso";
import { fitTransform } from "../src/world/frame";
import { envelopeOf, formatSweepRow, offSky, parseSweepArgs, pickFrame, SKY, toScreen } from "./wreck-sweep-measure";

const sky = (w: number, h: number, res: number): Uint8Array => {
  const px = new Uint8Array(w * res * h * res * 4);
  for (let i = 0; i < px.length; i += 4) px.set([...SKY, 255], i);
  return px;
};
const paint = (px: Uint8Array, wPx: number, i: number, j: number, rgba: number[]): void => px.set(rgba, (j * wPx + i) * 4);

describe("SKY", () => {
  it("is ISO_COLORS.sky as RGB", () => {
    expect(SKY).toEqual([(ISO_COLORS.sky >> 16) & 255, (ISO_COLORS.sky >> 8) & 255, ISO_COLORS.sky & 255]);
    expect(SKY).toEqual([0x10, 0x0e, 0x19]);
  });
});

describe("envelopeOf", () => {
  it("maps the item bounds to host px and sets the ceiling 2 px above the higher of the north vertex and the solid tops", () => {
    const items: RenderItem[] = [
      { layer: "ground", pts: [0, 0, 10, 0, 10, 10, 0, 10], color: 0 },
      { layer: "solid", pts: [4, 2, 6, 2, 6, 8], color: 0 },
    ];
    expect(envelopeOf(items, { x: 5, y: 7, scale: 2 }, { x0: 0, y0: 0, x1: 2, y1: 2 })).toEqual({ x0: 5, y0: 7, x1: 25, y1: 27, ceiling: 5 });
  });
  it("takes the solid tops when they rise above the north vertex", () => {
    const items: RenderItem[] = [{ layer: "solid", pts: [0, -4, 1, -4, 1, 0], color: 0 }];
    // north vertex of (0,0) is y 0; the solid top is y -4 → -8 + 7 - 2
    expect(envelopeOf(items, { x: 0, y: 7, scale: 2 }, { x0: 0, y0: 0, x1: 2, y1: 2 }).ceiling).toBe(-3);
  });
});

describe("offSky", () => {
  const host = { w: 4, h: 3 }, res = 2, wPx = 8;
  it("counts nothing on an all-sky host", () => {
    expect(offSky(sky(4, 3, 2), host, res, { x0: 0, y0: 0, x1: 4, y1: 3, ceiling: 0 })).toEqual({ count: 0, first: null });
  });
  it("counts a pixel outside the envelope and reports it in host CSS px", () => {
    const px = sky(4, 3, 2);
    paint(px, wPx, 6, 1, [17, 14, 25, 255]);
    expect(offSky(px, host, res, { x0: 0, y0: 0, x1: 2, y1: 3, ceiling: 0 })).toEqual({ count: 1, first: { x: 3, y: 0 } });
  });
  it("lets a pixel inside the envelope and below the ceiling through, and counts it above the ceiling", () => {
    const px = sky(4, 3, 2);
    paint(px, wPx, 6, 1, [17, 14, 25, 255]); // centre at (3.25, 0.75) CSS px
    expect(offSky(px, host, res, { x0: 0, y0: 0, x1: 4, y1: 3, ceiling: 0 }).count).toBe(0);
    expect(offSky(px, host, res, { x0: 0, y0: 0, x1: 4, y1: 3, ceiling: 1 }).count).toBe(1);
  });
  it("lets the antialiased fringe of a pixel that straddles the envelope edge through", () => {
    const px = sky(4, 3, 2);
    paint(px, wPx, 1, 2, [17, 14, 25, 255]); // footprint x [0.5, 1], centre 0.75
    expect(offSky(px, host, res, { x0: 0.9, y0: 0, x1: 4, y1: 3, ceiling: 0 }).count).toBe(0);
    expect(offSky(px, host, res, { x0: 1, y0: 0, x1: 4, y1: 3, ceiling: 0 }).count).toBe(1);
  });
  it("reports the first offender in row order", () => {
    const px = sky(4, 3, 2);
    paint(px, wPx, 1, 4, [0, 0, 0, 255]);
    paint(px, wPx, 7, 2, [0, 0, 0, 255]);
    expect(offSky(px, host, res, { x0: 9, y0: 9, x1: 9, y1: 9, ceiling: 0 })).toEqual({ count: 2, first: { x: 3, y: 1 } });
  });
  it("does not throw when the envelope is larger than the host", () => {
    expect(offSky(sky(4, 3, 2), host, res, { x0: -10, y0: -10, x1: 99, y1: 99, ceiling: -10 }).count).toBe(0);
  });
  it("throws on a buffer of the wrong length", () => {
    expect(() => offSky(new Uint8Array(10), host, res, { x0: 0, y0: 0, x1: 4, y1: 3, ceiling: 0 })).toThrow(/bytes/);
  });
});

describe("toScreen", () => {
  it("inverts the fit", () => {
    expect(toScreen({ x: 25, y: 27 }, { x: 5, y: 7, scale: 2 })).toEqual({ x: 10, y: 10 });
  });
});

describe("pickFrame", () => {
  const a = { name: "box", items: [{ layer: "ground", pts: [0, 0, 10, 0, 10, 10], color: 0 }] as RenderItem[] };
  const b = { name: "content", items: [{ layer: "ground", pts: [-3, -1, 40, 2, 7, 19], color: 0 }] as RenderItem[] };
  it("returns the candidate whose fitTransform is the page's fit", () => {
    expect(pickFrame([a, b], fitTransform(b.items, 900, 512), { w: 900, h: 512 })).toBe(b);
  });
  it("returns null when no candidate reproduces it", () => {
    expect(pickFrame([a, b], { x: 1, y: 2, scale: 3 }, { w: 900, h: 512 })).toBeNull();
  });
});

describe("parseSweepArgs", () => {
  it("defaults to the issue's sweep: 40 frames, three modes, two layouts", () => {
    expect(parseSweepArgs([])).toEqual({ origin: null, frames: 40, modes: ["off", "on", "fallback"], viewports: [[900, 1015], [412, 915]], hide: [] });
  });
  it("reads every flag", () => {
    expect(parseSweepArgs(["--modes", "on,off", "--frames", "5", "--origin", "http://localhost:5181", "--viewports", "900x1015", "--hide", "3"]))
      .toEqual({ origin: "http://localhost:5181", frames: 5, modes: ["on", "off"], viewports: [[900, 1015]], hide: [3] });
  });
  it("throws on an unknown mode, flag or a bad number", () => {
    expect(() => parseSweepArgs(["--modes", "bogus"])).toThrow();
    expect(() => parseSweepArgs(["--nope"])).toThrow();
    expect(() => parseSweepArgs(["--frames", "0"])).toThrow();
  });
  it("strips trailing slashes from --origin", () => {
    expect(parseSweepArgs(["--origin", "http://localhost:5181//"]).origin).toBe("http://localhost:5181");
  });
  it("rejects viewport dimensions below 1", () => {
    expect(() => parseSweepArgs(["--viewports", "0x915"])).toThrow();
    expect(() => parseSweepArgs(["--viewports", "900x0"])).toThrow();
  });
});

describe("formatSweepRow", () => {
  const base = { viewport: "900x1015", mode: "on", clock: "tick" as const, frame: "content", frames: 40 };
  it("prints a clean row", () => {
    expect(formatSweepRow({ ...base, count: 0, first: null })).toBe("900x1015 on tick content 40 frames: 0 off-sky px");
  });
  it("prints the first offender", () => {
    expect(formatSweepRow({ ...base, count: 12, first: { x: 420, y: 270 } })).toBe("900x1015 on tick content 40 frames: 12 off-sky px, first at (420, 270)");
  });
});
