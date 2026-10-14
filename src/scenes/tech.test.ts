import { describe, expect, it } from "vitest";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng } from "../map/seed";
import { suburbBlocks } from "./sprawl-grid";
import { ARENA, AUDITORIUM, MAX_TECH_H, TECH_MATS, TELECOM, tech } from "./tech";
import { bleedTerrainAt, terrainAt } from "./terrain";

const scene = () => tech(createRng(7));
const groundAt = (x: number, y: number) => (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1 ? terrainAt(x, y) : bleedTerrainAt(x, y));
const inBlock = (x: Solid, b: { x: number; y: number }) => { const bb = bounds(x); return bb.min.x >= b.x - 0.5 && bb.max.x <= b.x + 24.5 && bb.min.y >= b.y - 0.5 && bb.max.y <= b.y + 18.5; };

describe("tech", () => {
  it("es determinístico, cae en Resume con materiales del distrito y dentro del presupuesto", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
    const s = scene();
    const raised = s.solids.filter((x) => !isFlat(x));
    expect(raised.length).toBeGreaterThan(400); expect(raised.length).toBeLessThan(1200);
    for (const x of s.solids) {
      const b = bounds(x);
      expect(b.min.y).toBeGreaterThanOrEqual(ZONE_SPLIT_Y);
      expect(worldZoneAt(b.min.x, b.min.y)).toBe("cv");
      expect(TECH_MATS).toContain(x.mat);
    }
  });

  it("nada apoya en agua; nada no esbelto supera MAX_TECH_H + zócalo", () => {
    for (const x of scene().solids) {
      const b = bounds(x);
      if (x.kind !== "cone") expect(["water", "river", "sea", "shore", "abyss"]).not.toContain(groundAt(b.min.x, b.min.y));
      const slender = (x.kind === "prism" && x.w <= 3 && x.d <= 3) || (x.kind === "cylinder" && x.r <= 3);
      if (!slender) expect(b.max.z).toBeLessThanOrEqual(MAX_TECH_H + 1.5);
    }
  });

  it("todo edificio tiene ventanas: cada prisma de altura ≥ 3 lleva fachada, salvo remates, cornisas y equipos", () => {
    const s = scene();
    const buildings = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.h >= 3 && x.w >= 4 && x.d >= 4 && x.mat !== "leafDark" && x.mat !== "paving" && x.mat !== "plaza");
    expect(buildings.length).toBeGreaterThan(80);
    for (const b of buildings) expect(b.facade).toBeDefined();
  });

  it("torres cerca del contenido, campus en el medio, laboratorios con paneles solares lejos; parques", () => {
    const s = scene();
    const near = suburbBlocks().filter((b) => b.dist < 60), far = suburbBlocks().filter((b) => b.dist >= 160);
    expect(near.length).toBeGreaterThan(5); expect(far.length).toBeGreaterThan(5);
    expect(s.towers.length).toBeGreaterThanOrEqual(near.length * 0.6);
    for (const t of s.towers) { expect(t.box.mat).toBe("curtain"); expect(t.box.h).toBeGreaterThanOrEqual(12); expect(t.box.h).toBeLessThanOrEqual(MAX_TECH_H); }
    // baliza de las torres más altas (h >= 18): con la semilla 7 ya aparece; si alguna vez no rondara, alcanza con que aparezca en alguna semilla.
    expect(s.accents.some((a) => a.kind === "dot" && a.color === "amberMid" && a.at.z > 18)).toBe(true);
    expect(s.solids.filter((x) => x.kind === "ramp" && x.mat === "glass").length).toBeGreaterThan(40); // paneles solares
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "officeDark" && x.h === 5 && x.w === 20).length).toBeGreaterThan(3); // naves de laboratorio
    expect(s.ground.filter((g) => g.kind === "ground" && g.mat === "leafDark").length).toBeGreaterThan(5); // parques y campus
    expect(s.signs.length).toBeGreaterThan(10);
    for (const a of s.signs) expect(a.kind === "poly" && a.color).toBe("amber");
  });

  it("hitos: torre de telecomunicaciones con tres platos, arena con torres de luz, auditorio de vidrio con cubierta de cobre; avenida y muro de ribera", () => {
    const s = scene();
    expect(s.solids.filter((x) => x.kind === "cylinder" && x.mat === "steel" && x.h === 0.4 && inBlock(x, TELECOM))).toHaveLength(3);
    expect(s.telecom.z).toBeGreaterThan(20);
    expect(s.solids.some((x) => x.kind === "poly" && x.mat === "stone" && inBlock(x, ARENA))).toBe(true);
    expect(s.solids.filter((x) => x.kind === "prism" && x.h === 12 && x.mat === "steel" && inBlock(x, ARENA))).toHaveLength(4);
    expect(s.solids.some((x) => x.kind === "cylinder" && x.mat === "curtain" && x.sides === 12 && inBlock(x, AUDITORIUM))).toBe(true);
    expect(s.solids.some((x) => x.kind === "cone" && x.mat === "copper" && inBlock(x, AUDITORIUM))).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "plaza" && x.at.z === -1 && x.d > 200)).toBe(true);
    expect(s.solids.filter((x) => x.kind === "prism" && x.mat === "leafDark" && x.h === 0.3 && x.w === 24).length).toBeGreaterThanOrEqual(5);
  });

  it("neones: una corona por torre en su cara sur bajo la cornisa, a la altura del cartel; tres luces en el mástil", () => {
    const s = scene();
    expect(s.neon.crowns).toHaveLength(s.towers.length);
    s.neon.crowns.forEach((c, k) => {
      expect(c).toMatchObject({ kind: "poly", color: k % 2 === 0 ? "cyan" : "magenta", alpha: 1 });
      if (c.kind !== "poly") return;
      const ys = new Set(c.pts.map((p) => p.y)), zs = c.pts.map((p) => p.z), xs = c.pts.map((p) => p.x);
      expect(ys.size).toBe(1);
      const y = c.pts[0]!.y, top = Math.max(...zs), x0 = Math.min(...xs), x1 = Math.max(...xs);
      expect(top - Math.min(...zs)).toBeCloseTo(0.6);
      // misma y que el cartel de azotea de su torre (centrado sobre la torre)
      expect(s.signs.some((a) => a.kind === "poly" && Math.abs(a.pts[0]!.y - y) < 1e-9 && Math.abs((a.pts[0]!.x + a.pts[1]!.x) / 2 - (x0 + x1) / 2) < 1e-9)).toBe(true);
      // pegada al borde superior del cuerpo de muro cortina sobre el que va el cartel, 0.4 adentro por lado
      const body = s.solids.find((x) => x.kind === "prism" && x.mat === "curtain" && Math.abs(x.at.z + x.h - top) < 1e-9 && Math.abs(x.at.y + x.d + 0.02 - y) < 1e-9 && Math.abs(x.at.x + 0.4 - x0) < 1e-9 && Math.abs(x.at.x + x.w - 0.4 - x1) < 1e-9);
      expect(body).toBeDefined();
    });
    expect(s.neon.mastRing).toEqual([3, 6, 9].map((dz) => ({ x: s.telecom.x, y: s.telecom.y + 0.6, z: s.telecom.z - dz })));
  });
});
