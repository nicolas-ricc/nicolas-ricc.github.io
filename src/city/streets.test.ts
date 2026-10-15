import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { AVENUE, BLOCK_W, BOULEVARD, EAST_COLS, EAST_RING, PLAZA, STREET, WEST_COLS, inCrater } from "../scenes/city-grid";
import { streets } from "./streets";

type Strip = Solid & { kind: "strip" };

const scene = (): Strip[] => {
  const ground: Solid[] = [];
  streets(ground, [], []);
  return ground.filter((g): g is Strip => g.kind === "strip");
};
const ofWidth = (w: number): Strip[] => scene().filter((s) => s.width === w);
const isVertical = (s: Strip): boolean => s.path[0]!.x === s.path[1]!.x;
const isHorizontal = (s: Strip): boolean => s.path[0]!.y === s.path[1]!.y;
const length = (s: Strip): number => Math.hypot(s.path[1]!.x - s.path[0]!.x, s.path[1]!.y - s.path[0]!.y);
const mid = (s: Strip): Vec2 => ({ x: (s.path[0]!.x + s.path[1]!.x) / 2, y: (s.path[0]!.y + s.path[1]!.y) / 2 });
/** Interior estricto de la plaza: un extremo justo sobre el borde no la pisa. */
const inPlazaStrict = (p: Vec2): boolean => p.x > PLAZA.x && p.x < PLAZA.x + PLAZA.w && p.y > PLAZA.y && p.y < PLAZA.y + PLAZA.d;

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);
const RING_X = EAST_RING.x0 + STREET / 2;
const CROSSINGS = [...WEST_LANE_X, RING_X, EAST_COLS[0] + BLOCK_W + STREET / 2];
const CARRIAGEWAYS = [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2];

describe("streets", () => {
  it("deja entre 80 y 150 strip, todos paving a ras del suelo", () => {
    const strips = scene();
    expect(strips.length).toBeGreaterThanOrEqual(80);
    expect(strips.length).toBeLessThanOrEqual(150);
    for (const s of strips) {
      expect(s.mat).toBe("paving");
      expect(s.z).toBeGreaterThan(0);
      expect(s.z).toBeLessThan(0.1);
    }
  });

  it("cada línea central es un strip de dos puntos, horizontal o vertical, de al menos 1", () => {
    const lines = ofWidth(0.3);
    expect(lines.length).toBeGreaterThan(0);
    for (const s of lines) {
      expect(s.path).toHaveLength(2);
      expect(isVertical(s) || isHorizontal(s)).toBe(true);
      expect(length(s)).toBeGreaterThanOrEqual(1);
    }
  });

  it("ninguna línea central cruza un cráter ni pisa la plaza", () => {
    for (const s of ofWidth(0.3)) {
      const m = mid(s);
      expect(inCrater(m.x, m.y)).toBe(false);
      expect(inPlazaStrict(m)).toBe(false);
      for (const p of s.path) expect(inPlazaStrict(p)).toBe(false);
    }
  });

  it("toda calle N-S del oeste tiene línea central", () => {
    const lines = ofWidth(0.3).filter(isVertical);
    for (const x of WEST_LANE_X) expect(lines.some((s) => s.path[0]!.x === x)).toBe(true);
  });

  it("los carriles discontinuos solo van en las dos calzadas de la avenida y en el anillo este", () => {
    const dashes = ofWidth(0.4);
    expect(dashes.length).toBeGreaterThan(0);
    for (const s of dashes) {
      expect(length(s)).toBeCloseTo(4, 6);
      const onAvenue = isHorizontal(s) && CARRIAGEWAYS.includes(s.path[0]!.y);
      const onRing = isVertical(s) && s.path[0]!.x === RING_X;
      expect(onAvenue || onRing).toBe(true);
    }
    for (const y of CARRIAGEWAYS) expect(dashes.some((s) => isHorizontal(s) && s.path[0]!.y === y)).toBe(true);
    expect(dashes.some((s) => isVertical(s) && s.path[0]!.x === RING_X)).toBe(true);
  });

  it("no quedan líneas continuas al borde del boulevard", () => {
    for (const s of scene()) for (const p of s.path) {
      expect(Math.abs(p.y - (BOULEVARD.y0 - 0.3))).toBeGreaterThan(1e-6);
      expect(Math.abs(p.y - (BOULEVARD.y1 + 0.3))).toBeGreaterThan(1e-6);
    }
  });

  it("cada cruce de la avenida tiene una cebra de 3 strips de 0.8, salvo bajo el puente", () => {
    const zebras = ofWidth(0.8);
    for (const cx of CROSSINGS) {
      const here = zebras.filter((s) => Math.abs(s.path[0]!.x - cx) <= 2);
      if (cx === RING_X) { expect(here).toHaveLength(0); continue; }
      expect(here.map((s) => s.path[0]!.x).sort((a, b) => a - b)).toEqual([cx - 1.6, cx, cx + 1.6]);
      for (const s of here) {
        expect(isVertical(s)).toBe(true);
        expect([s.path[0]!.y, s.path[1]!.y]).toEqual([AVENUE.y0, AVENUE.y1]);
      }
    }
    expect(zebras).toHaveLength((CROSSINGS.length - 1) * 3);
  });
});
