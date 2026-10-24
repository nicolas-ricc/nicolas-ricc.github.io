import { describe, expect, it } from "vitest";
import { tessellate } from "../iso/solids";
import { createRng } from "../map/seed";
import { EXCAVATOR, excavatorWheel } from "./excavator";
import { factory } from "./factory";
import { factoryAnimator } from "./factory-animator";

const animator = (reducedMotion: boolean) => factoryAnimator(factory(createRng(7)), createRng(3), { reducedMotion });
const wheelLayer = (a: ReturnType<typeof animator>) => { const l = a.layer("factory.wheel"); if (l.kind !== "solid") throw new Error("factory.wheel no es una capa de sólidos"); return l.solids; };
const angleOf = (a: ReturnType<typeof animator>) => { const w = wheelLayer(a)[0]!; if (w.kind !== "wheel") throw new Error("no es wheel"); return w.angle; };

describe("rueda de la excavadora", () => {
  it.each([0, Math.PI / 7, Math.PI / 3, 2])("tesela en ≤ 400 caras con ángulo %d", (a) => {
    const w = excavatorWheel(a);
    expect(w.kind).toBe("wheel");
    expect(tessellate(w).length).toBeLessThanOrEqual(400);
  });

  it("rust, hueca, 28 lados y ranuras, 14 cangilones de 2 dientes, eje en (−14, 60, 9.2)", () => {
    const w = excavatorWheel(0);
    if (w.kind !== "wheel") throw new Error("no es wheel");
    expect(w).toMatchObject({ mat: "rust", r: 5.5, width: 0.5, sides: 28, hollow: true, slots: 28, buckets: { n: 14, depth: 1.2, teeth: 2, mat: "rust" } });
    expect(w.at.x).toBeCloseTo(-14, 6); expect(w.at.y).toBeCloseTo(60, 6); expect(w.at.z).toBeCloseTo(9.2, 6);
    expect(EXCAVATOR.at).toEqual({ x: -30, y: 76 });
  });
});

describe("capa factory.wheel", () => {
  it("un solo sólido wheel y ≤ 400 caras", () => {
    const a = animator(false);
    expect(a.ids).toContain("factory.wheel");
    const s = wheelLayer(a);
    expect(s).toHaveLength(1);
    expect(s[0]!.kind).toBe("wheel");
    expect(s.flatMap(tessellate).length).toBeLessThanOrEqual(400);
  });

  it("gira ~0.5 rad/s: tras tick(2000) el ángulo está en 1 ± 0.06", () => {
    const a = animator(false);
    expect(angleOf(a)).toBe(0);
    expect(a.tick(2000).has("factory.wheel")).toBe(true);
    expect(Math.abs(angleOf(a) - 1)).toBeLessThanOrEqual(0.06);
  });

  it("con reducedMotion el ángulo es 0 y tick nunca marca factory.wheel", () => {
    const a = animator(true);
    for (const dt of [16, 100, 250, 2000, 60000]) { expect(a.tick(dt).has("factory.wheel")).toBe(false); expect(angleOf(a)).toBe(0); }
  });

  it("el humo sigue marcándose como hoy", () => {
    const a = animator(false);
    const smoke = a.ids.filter((id) => id.startsWith("factory.smoke"));
    expect(smoke.length).toBeGreaterThan(0);
    const changed = a.tick(33);
    for (const id of smoke) expect(changed.has(id)).toBe(true);
    for (const id of smoke) expect(animator(true).tick(33).has(id)).toBe(false);
  });

  it("tick(0) no marca nada", () => expect(animator(false).tick(0).size).toBe(0));

  it("tras 10 min el ángulo sigue en [0, 2π) y la capa en ≤ 400 caras", () => {
    const a = animator(false);
    for (let k = 0; k < 600; k++) a.tick(1000);
    const ang = angleOf(a);
    expect(ang).toBeGreaterThanOrEqual(0); expect(ang).toBeLessThan(2 * Math.PI);
    expect(wheelLayer(a).flatMap(tessellate).length).toBeLessThanOrEqual(400);
  });
});
