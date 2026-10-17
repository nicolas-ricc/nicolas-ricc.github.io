import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid, Tri } from "../iso/solids";
import type { WorldScene } from "../scenes/world";
import type { ZonedAnimator } from "../world/assemble";
import { cropAccents, cropAnimators, cropScene, cropShared, overlaps } from "./crop";

const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
const prism = (x: number, y: number, w = 2): Solid => ({ kind: "prism", at: v3(x, y, 0), w, d: w, h: 3, mat: "concrete" });
const tri = (x: number, y: number): Tri => ({ pts: [v3(x, y, 0), v3(x + 1, y, 0), v3(x, y + 1, 0)] });

describe("overlaps", () => {
  it("una caja que toca el borde solapa; una separada no", () => {
    expect(overlaps({ min: v3(10, 3, 0), max: v3(12, 4, 9) }, box)).toBe(true);
    expect(overlaps({ min: v3(10.1, 3, 0), max: v3(12, 4, 9) }, box)).toBe(false);
    expect(overlaps({ min: v3(3, -5, 0), max: v3(4, -0.1, 0) }, box)).toBe(false);
  });
});

describe("cropScene", () => {
  const water: Solid = { kind: "ground", mat: "water", tris: [tri(1, 1), tri(50, 50)] };
  const scene = {
    terrain: { ground: [{ kind: "ground", mat: "concrete", tris: [tri(2, 2), tri(40, 40)] }], bleed: [{ kind: "ground", mat: "concrete", tris: [tri(90, 90)] }], water: [water], foam: { kind: "ground", mat: "foam", tris: [tri(70, 70)] } },
    ground: [prism(1, 1), prism(30, 30)],
    solids: [prism(9, 9, 4), prism(20, 20)],
    accents: [],
    landmarks: { portfolio: v3(0, 0, 0), cv: v3(0, 0, 0), blog: v3(0, 0, 0) },
    shipyard: null, city: null, factory: null, sea: null, hinterland: null, tech: null, fair: null,
  } as unknown as WorldScene;
  const out = cropScene(scene, box);

  it("conserva entero un sólido que cruza el borde y descarta uno de afuera", () => {
    expect(out.solids).toEqual([scene.solids[0]]);
    expect(out.ground).toEqual([scene.ground[0]]);
  });
  it("el terreno se filtra por triángulo y una malla vacía desaparece", () => {
    expect(out.terrain.ground).toHaveLength(1);
    expect((out.terrain.ground[0] as Solid & { kind: "ground" }).tris).toEqual([tri(2, 2)]);
    expect(out.terrain.bleed).toEqual([]);
    expect((out.terrain.water[0] as Solid & { kind: "ground" }).tris).toEqual([tri(1, 1)]);
  });
  it("la espuma de afuera queda como suelo sin triángulos", () => {
    expect(out.terrain.foam).toMatchObject({ kind: "ground", mat: "foam", tris: [] });
  });
  it("el mismo sólido y la misma caja devuelven el mismo recorte", () => {
    expect(cropShared(water, box)).toBe(out.terrain.water[0]);
  });
});

describe("cropAccents", () => {
  it("dot por su punto, poly por cualquier vértice adentro", () => {
    const inDot: Accent = { kind: "dot", at: v3(5, 5, 20), r: 1, color: "cyan" };
    const outDot: Accent = { kind: "dot", at: v3(11, 5, 0), r: 1, color: "cyan" };
    const crossPoly: Accent = { kind: "poly", pts: [v3(9, 9, 0), v3(30, 9, 0), v3(30, 30, 0)], color: "amber" };
    const outPoly: Accent = { kind: "poly", pts: [v3(20, 20, 0), v3(30, 20, 0), v3(30, 30, 0)], color: "amber" };
    expect(cropAccents([inDot, outDot, crossPoly, outPoly], box)).toEqual([inDot, crossPoly]);
  });
});

describe("cropAnimators", () => {
  // un animador de juguete: un sólido que se mueve en x 1 u por tick, más acentos fijos
  const toy = (x0: number, claims: Solid[] = []): ZonedAnimator => {
    let x = x0;
    return {
      zone: "portfolio",
      ids: ["toy.solid", "toy.acc"],
      claims,
      layer: (id) => id === "toy.solid"
        ? { kind: "solid", solids: [prism(x, 1), prism(40, 40)], alpha: 0.5 }
        : { kind: "accent", accents: [{ kind: "dot", at: v3(x, 1, 0), r: 1, color: "cyan" }] },
      tick: () => { x += 1; return new Set(["toy.solid"]); },
    };
  };

  it("el envuelto conserva ids, zona y el resultado de tick", () => {
    const [a] = cropAnimators([toy(1)], box);
    expect(a!.ids).toEqual(["toy.solid", "toy.acc"]);
    expect(a!.zone).toBe("portfolio");
    expect([...a!.tick(16)]).toEqual(["toy.solid"]);
  });
  it("las capas devuelven solo lo que cae adentro, también después de tick", () => {
    const [a] = cropAnimators([toy(1)], box);
    expect(a!.layer("toy.solid")).toMatchObject({ kind: "solid", alpha: 0.5, solids: [prism(1, 1)] });
    for (let i = 0; i < 12; i++) a!.tick(16);
    expect(a!.layer("toy.solid")).toMatchObject({ solids: [] });
    expect(a!.layer("toy.acc")).toMatchObject({ accents: [] });
  });
  it("filtra claims con la misma identidad que cropScene", () => {
    const water: Solid = { kind: "ground", mat: "water", tris: [tri(1, 1), tri(50, 50)] };
    const far: Solid = { kind: "ground", mat: "water", tris: [tri(50, 50)] };
    const [a] = cropAnimators([toy(1, [water, far])], box);
    expect(a!.claims).toEqual([cropShared(water, box)]);
    expect(a!.claims![0]).toBe(cropShared(water, box));
  });
  it("una capa que reasigna los triángulos del mismo sólido se recorta de nuevo en cada llamada", () => {
    const glint: Solid & { kind: "ground" } = { kind: "ground", mat: "glint", tris: [tri(1, 1)] };
    const a0: ZonedAnimator = { zone: null, ids: ["g"], layer: () => ({ kind: "water", water: [glint] }), tick: () => new Set(["g"]) };
    const [a] = cropAnimators([a0], box);
    glint.tris = [tri(2, 2), tri(60, 60)];
    expect(a!.layer("g")).toMatchObject({ water: [{ tris: [tri(2, 2)] }] });
  });
  it("descarta el animador sin contenido inicial en la caja", () => {
    expect(cropAnimators([toy(30)], box)).toEqual([]);
  });
});
