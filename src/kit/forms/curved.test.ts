import { describe, expect, it } from "vitest";
import { bounds } from "../../iso/solids";
import { createRng } from "../../map/seed";
import { RECIPES, recipe } from "../index";
import { RECIPE_MAX_H } from "../piece";
import { STYLES } from "../styles";
import type { Lot } from "../types";

const LOT: Lot = { x: 1.5, y: 1.5, w: 21, d: 15, z: 0, open: ["s"], maxH: 24 };
const SMALL: Lot = { x: 0, y: 0, w: 16, d: 12, z: 0, open: ["s"], maxH: 24 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const EPS = 1e-6;

describe("kit: familia curved", () => {
  it("registra las cuatro recetas en orden", () => {
    expect(RECIPES.filter((r) => r.family === "curved").map((r) => r.name)).toEqual(["cylinderTower", "rotunda", "vaultedHall", "gallery"]);
  });

  it("entra en el lote mínimo 16×12 respetando el contrato", () => {
    for (const def of RECIPES.filter((r) => r.family === "curved")) for (const seed of SEEDS) {
      for (const s of def.recipe(SMALL, createRng(seed), STYLES.civico).solids) {
        const b = bounds(s);
        expect(b.min.x).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.min.y).toBeGreaterThanOrEqual(-0.8 - EPS);
        expect(b.max.x).toBeLessThanOrEqual(16.8 + EPS);
        expect(b.max.y).toBeLessThanOrEqual(12.8 + EPS);
        expect(b.max.z).toBeLessThanOrEqual(RECIPE_MAX_H + EPS);
      }
    }
  });

  it("cylinderTower: un cylinder de 16 lados con fachada de vidriera, losa de remate y helipuerto", () => {
    for (const seed of SEEDS) {
      const p = recipe("cylinderTower")(LOT, createRng(seed), STYLES.centro);
      const body = p.solids.flatMap((s) => (s.kind === "cylinder" && s.facade ? [s] : []));
      expect(body).toHaveLength(1);
      const c = body[0]!;
      expect(c.sides).toBe(16);
      expect(c.facade).toMatchObject({ cols: 1, base: "glass" });
      expect(p.solids.some((s) => s.kind === "cylinder" && s.r === c.r + 0.4 && s.at.z === c.at.z + c.h && s.mat === STYLES.centro.trim)).toBe(true);
      expect(p.windows.length).toBeGreaterThan(0);
      expect(p.accents.some((a) => a.kind === "dot" && a.color === "amberMid")).toBe(true); // helipuerto
    }
  });

  it("rotunda: dome de 12 lados sobre el cilindro con arcada y linterna arriba", () => {
    for (const seed of SEEDS) {
      const p = recipe("rotunda")(LOT, createRng(seed), STYLES.civico);
      const cyl = p.solids.flatMap((s) => (s.kind === "cylinder" && s.facade ? [s] : []))[0];
      const dome = p.solids.flatMap((s) => (s.kind === "dome" ? [s] : []))[0];
      expect(cyl).toMatchObject({ sides: 12, r: 6, facade: { base: "arcade" } });
      expect(dome).toMatchObject({ r: 6, h: 3.5, sides: 12, rings: 3, mat: STYLES.civico.roof });
      expect(dome!.at.z).toBe(cyl!.at.z + cyl!.h);
      expect(p.solids.some((s) => s.kind === "cylinder" && s.r === 1 && s.h === 1.2 && s.at.z === dome!.at.z + dome!.h)).toBe(true);
    }
  });

  it("vaultedHall: vault a lo largo de x sobre el techo de la nave con arcada, y dos laterales bajos de 3", () => {
    for (const lot of [LOT, SMALL]) for (const seed of SEEDS) {
      const p = recipe("vaultedHall")(lot, createRng(seed), STYLES.civico);
      const nave = p.solids.flatMap((s) => (s.kind === "prism" && s.d === 9 && s.facade ? [s] : []))[0];
      const vault = p.solids.flatMap((s) => (s.kind === "vault" ? [s] : []))[0];
      expect(nave?.facade).toMatchObject({ base: "arcade" });
      expect(vault!.at.z).toBe(nave!.at.z + nave!.h);
      expect(vault).toMatchObject({ axis: "x", len: lot.w - 2, w: 9, h: 3, segments: 6, mat: STYLES.civico.roof, at: { x: nave!.at.x, y: nave!.at.y } });
      expect(p.solids.filter((s) => s.kind === "prism" && s.h === 3)).toHaveLength(2);
    }
  });

  it("gallery: planta baja con arcada de 3 en el frente, dos pisos con ventanas encima y techo hip de roof, tono propio", () => {
    for (const seed of SEEDS) {
      const p = recipe("gallery")(LOT, createRng(seed), STYLES.civico);
      const [ground, upper] = p.solids.flatMap((s) => (s.kind === "prism" && s.facade ? [s] : []));
      expect(ground).toMatchObject({ h: 3, facade: { base: "arcade" }, tone: 1 });
      expect(upper?.facade).toMatchObject({ floors: 2 });
      expect(upper!.facade!.cols).toBeGreaterThanOrEqual(4);
      expect(upper!.facade!.cols).toBeLessThanOrEqual(5);
      expect(upper!.at.z).toBe(ground!.at.z + 3);
      expect(p.walls.some((w) => w.normal.y > 0.99 && w.building === p.solids.indexOf(ground!))).toBe(true); // frente sur con arcada
      expect(p.solids.some((s) => s.kind === "prism" && s.roof === "hip" && s.mat === STYLES.civico.roof && s.at.z === upper!.at.z + upper!.h)).toBe(true);
      expect(p.windows.length).toBeGreaterThan(0);
      expect(p.windows.every((w) => w.building === p.solids.indexOf(upper!))).toBe(true);
    }
  });
});
