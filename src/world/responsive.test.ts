import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { LANTERN_Z, LIGHTHOUSE } from "../scenes/sea";
import { labelLayout, signBox, writingSite, zoneSigns, type ScreenBox } from "./signs";
import { coverView, type View } from "./view";

/** The 14 hosts of spec 2026-11-18 §5.1, from desktop to phone. */
const SIZES: [number, number][] = [
  [1920, 955], [1600, 900], [1440, 900], [1366, 1024], [1280, 900], [1180, 820], [1024, 768],
  [1000, 1000], [900, 1000], [820, 1180], [768, 1024], [430, 932], [390, 750], [360, 740],
];
const toHost = (b: ScreenBox, v: View): ScreenBox =>
  ({ minX: b.minX * v.scale + v.x, minY: b.minY * v.scale + v.y, maxX: b.maxX * v.scale + v.x, maxY: b.maxY * v.scale + v.y });

/** The three phones where RESUME, on the hotel facade since #474, does not fit beside PORTFOLIO (D10 of #471): the label goes to the host edge. */
const NARROW = new Set(["430×932", "390×750", "360×740"]);
const PAD = { hw: 50, hh: 20 };
const M = 8; // px of margin to the host edge

describe("the cover shows the three signs and the lighthouse (#428, #474)", () => {
  it.each(SIZES)("%i×%i: PORTFOLIO, Writing at writingSite and the lantern fall inside the host", (w, h) => {
    const v = coverView(w, h), signs = zoneSigns(writingSite(w, h));
    for (const [id, s] of Object.entries(signs)) {
      if (id === "cv") continue;
      const b = toHost(signBox(s), v);
      expect(b.minX, `${id} left`).toBeGreaterThanOrEqual(0);
      expect(b.maxX, `${id} right`).toBeLessThanOrEqual(w);
      expect(b.minY, `${id} top`).toBeGreaterThanOrEqual(0);
      expect(b.maxY, `${id} bottom`).toBeLessThanOrEqual(h);
    }
    const l = project(v3(LIGHTHOUSE.x, LIGHTHOUSE.y, LANTERN_Z));
    const lx = l.x * v.scale + v.x, ly = l.y * v.scale + v.y;
    expect(lx).toBeGreaterThanOrEqual(0); expect(lx).toBeLessThanOrEqual(w);
    expect(ly).toBeGreaterThanOrEqual(0); expect(ly).toBeLessThanOrEqual(h);
  });

  it.each(SIZES.filter(([w]) => w >= 640))("%i×%i: RESUME is whole, 8 px inside the host", (w, h) => {
    const b = toHost(signBox(zoneSigns(writingSite(w, h)).cv), coverView(w, h));
    expect(b.minX).toBeGreaterThanOrEqual(M); expect(b.maxX).toBeLessThanOrEqual(w - M);
    expect(b.minY).toBeGreaterThanOrEqual(M); expect(b.maxY).toBeLessThanOrEqual(h - M);
  });

  it.each(SIZES.filter(([w, h]) => NARROW.has(`${w}×${h}`)))("%i×%i: RESUME is at least a quarter visible and its label sits on the host edge", (w, h) => {
    const v = coverView(w, h), raw = signBox(zoneSigns(writingSite(w, h)).cv), b = toHost(raw, v);
    const visible = (Math.min(b.maxX, w) - Math.max(b.minX, 0)) / (b.maxX - b.minX);
    expect(visible).toBeGreaterThanOrEqual(0.25);
    expect(b.minY).toBeGreaterThanOrEqual(0); expect(b.maxY).toBeLessThanOrEqual(h);
    expect(labelLayout(raw, v, { w, h }, PAD).mode).toBe("edge");
  });

  it("the narrow hosts are the only ones below 640 px in the list", () => {
    expect(SIZES.filter(([w]) => w < 640).map(([w, h]) => `${w}×${h}`)).toEqual([...NARROW]);
  });

  it.each(SIZES)("%i×%i: Writing's word center is low and right, never in the middle", (w, h) => {
    const b = toHost(signBox(zoneSigns(writingSite(w, h)).blog), coverView(w, h));
    const cx = (b.minX + b.maxX) / 2 / w, cy = (b.minY + b.maxY) / 2 / h;
    expect(cx).toBeGreaterThanOrEqual(0.52);
    expect(cy).toBeGreaterThanOrEqual(0.68);
    if (w / h >= 16 / 9) {
      expect(cx).toBeGreaterThanOrEqual(0.7);
      expect(cx).toBeLessThanOrEqual(0.88);
    }
  });
});

describe("writingSite (#428)", () => {
  it.each([[1600, 900], [1920, 955], [2100, 900], [2700, 900]])("%i×%i (≥ 16:9) is wide", (w, h) => {
    expect(writingSite(w, h)).toBe("wide");
  });
  it.each([[900, 1000], [820, 1180], [390, 750]])("%i×%i (aspect < 1) is tall", (w, h) => {
    expect(writingSite(w, h)).toBe("tall");
  });
  it("at 900 px high, sweeping the width 700..1700 by 1 px, the site changes exactly once, tall to wide", () => {
    const seq: string[] = [];
    for (let w = 700; w <= 1700; w++) seq.push(writingSite(w, 900));
    const changes = seq.filter((s, i) => i > 0 && s !== seq[i - 1]).length;
    expect(changes).toBe(1);
    expect(seq[0]).toBe("tall");
    expect(seq.at(-1)).toBe("wide");
  });
  it("writingSite(0, 0) is tall and does not throw", () => {
    expect(writingSite(0, 0)).toBe("tall");
  });
});
