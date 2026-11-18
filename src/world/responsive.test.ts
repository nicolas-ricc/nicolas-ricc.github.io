import { describe, expect, it } from "vitest";
import { v3 } from "../iso/geometry";
import { project } from "../iso/project";
import { LANTERN_Z, LIGHTHOUSE } from "../scenes/sea";
import { signBox, writingSite, zoneSigns, type ScreenBox } from "./signs";
import { coverView, type View } from "./view";

/** The 14 hosts of spec 2026-11-18 §5.1, from desktop to phone. */
const SIZES: [number, number][] = [
  [1920, 955], [1600, 900], [1440, 900], [1366, 1024], [1280, 900], [1180, 820], [1024, 768],
  [1000, 1000], [900, 1000], [820, 1180], [768, 1024], [430, 932], [390, 750], [360, 740],
];
const toHost = (b: ScreenBox, v: View): ScreenBox =>
  ({ minX: b.minX * v.scale + v.x, minY: b.minY * v.scale + v.y, maxX: b.maxX * v.scale + v.x, maxY: b.maxY * v.scale + v.y });

describe("the cover shows the three signs and the lighthouse (#428)", () => {
  it.each(SIZES)("%i×%i: RESUME, PORTFOLIO, Writing at writingSite and the lantern fall inside the host", (w, h) => {
    const v = coverView(w, h), signs = zoneSigns(writingSite(w, h));
    for (const [id, s] of Object.entries(signs)) {
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
