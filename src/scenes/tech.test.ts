import { describe, expect, it } from "vitest";
import { bounds, isFlat, tessellate, type Solid } from "../iso/solids";
import { WORLD, ZONE_SPLIT_Y, worldZoneAt } from "../map/geo";
import type { Material } from "../map/palette-iso";
import { createRng, SEED } from "../map/seed";
import { suburbBlocks, type SprawlBlock } from "./sprawl-grid";
import { ARENA, AUDITORIUM, MAX_TECH_H, TECH_MATS, TELECOM, tech } from "./tech";
import { techAnimator } from "./tech-animator";
import { ACCENT_CAP, BARRIO_REGION, COSTANERA_RECT, FACE_CAPS, REGION_FACES_BEFORE, TECH_FACES_BEFORE, blockRect, facesIn } from "./tech-budget";
import { inBarrio, zoneKinds, type Kind } from "./tech-zoning";
import { zoneRng } from "./world";
import { bleedTerrainAt, terrainAt } from "./terrain";

const scene = () => tech(createRng(7));
const groundAt = (x: number, y: number) => (x >= WORLD.x0 && x < WORLD.x1 && y >= WORLD.y0 && y < WORLD.y1 ? terrainAt(x, y) : bleedTerrainAt(x, y));
const inBlock = (x: Solid, b: { x: number; y: number }) => { const bb = bounds(x); return bb.min.x >= b.x - 0.5 && bb.max.x <= b.x + 24.5 && bb.min.y >= b.y - 0.5 && bb.max.y <= b.y + 18.5; };

describe("tech", () => {
  it("es determinístico, cae en Resume con materiales del distrito y dentro del presupuesto", () => {
    expect(JSON.stringify(scene())).toBe(JSON.stringify(scene()));
    const s = scene();
    const raised = s.solids.filter((x) => !isFlat(x));
    expect(raised.length).toBeGreaterThan(400); expect(raised.length).toBeLessThan(2500);
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

  it("todo edificio de oficinas tiene ventanas: cada prisma de h ≥ 3 y w,d ≥ 4 de curtain, office, officeDark o glass lleva fachada", () => {
    const s = scene();
    const buildings = s.solids.filter((x): x is Solid & { kind: "prism" } => x.kind === "prism" && x.h >= 3 && x.w >= 4 && x.d >= 4 && (["curtain", "office", "officeDark", "glass"] as Material[]).includes(x.mat));
    expect(buildings.length).toBeGreaterThan(80);
    for (const b of buildings) expect(b.facade).toBeDefined();
  });

  it("torres cerca del contenido, campus en el medio, barrio lejos; parques", () => {
    const s = scene();
    const near = suburbBlocks().filter((b) => b.dist < 60), far = suburbBlocks().filter((b) => b.dist >= 160);
    expect(near.length).toBeGreaterThan(5); expect(far.length).toBeGreaterThan(5);
    expect(s.towers.length).toBeGreaterThanOrEqual(near.length * 0.6);
    for (const t of s.towers) { expect(t.box.mat).toBe("curtain"); expect(t.box.h).toBeGreaterThanOrEqual(12); expect(t.box.h).toBeLessThanOrEqual(MAX_TECH_H); }
    // baliza de las torres más altas (h >= 18): con la semilla 7 ya aparece; si alguna vez no rondara, alcanza con que aparezca en alguna semilla.
    expect(s.accents.some((a) => a.kind === "dot" && a.color === "amberMid" && a.at.z > 18)).toBe(true);
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "officeDark" && x.h === 5 && x.w === 20 && x.d === 13)).toBe(false); // sin naves de laboratorio
    expect(s.solids.some((x) => x.kind === "prism" && x.mat === "curtain" && x.w === 9 && x.d === 13)).toBe(false); // sin atrios
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

// el mundo real: rng de la zona y el tipo de cada manzana según el pre-pase
const worldScene = tech(zoneRng(SEED, "cv", 2));
const worldBlocks = suburbBlocks(), worldKinds = zoneKinds(zoneRng(SEED, "cv", 2), worldBlocks);
const everything = [...worldScene.solids, ...worldScene.ground];
const within = (x: Solid, r: { x0: number; y0: number; x1: number; y1: number }) => { const b = bounds(x); return b.min.x >= r.x0 - 0.5 && b.max.x <= r.x1 + 0.5 && b.min.y >= r.y0 - 0.5 && b.max.y <= r.y1 + 0.5; };
const neighbours = (a: SprawlBlock, b: SprawlBlock) => (a.y === b.y && Math.abs(a.x - b.x) === 30) || (a.x === b.x && Math.abs(a.y - b.y) > 0 && Math.abs(a.y - b.y) <= 30);
const homesOf = (kind: Kind) => worldScene.homes.filter((w) => worldBlocks.some((b, i) => { const r = blockRect(b); return worldKinds[i] === kind && w.pts.every((p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1); }));

describe("barrio costero (#249)", () => {
  it("variedad: dos manzanas vecinas del barrio nunca tienen la misma firma", () => {
    const r2 = (v: number) => Math.round(v * 2) / 2;
    const signature = (b: SprawlBlock, kind: Kind) => {
      const raised = worldScene.solids.filter((x) => !isFlat(x) && within(x, blockRect(b)));
      const prints = raised.flatMap((x) => {
        if ((x.kind !== "prism" && x.kind !== "poly" && x.kind !== "ramp") || x.h < 1) return [];
        const bb = bounds(x);
        return [[r2(bb.min.x - b.x), r2(bb.min.y - b.y), r2(bb.max.x - bb.min.x), r2(bb.max.y - bb.min.y)].join(",")];
      }).sort();
      return `${kind}|${raised.length}|${prints.join(";")}`;
    };
    let pairs = 0;
    worldBlocks.forEach((a, i) => worldBlocks.forEach((b, j) => {
      if (j <= i || !neighbours(a, b) || !inBarrio(a) || !inBarrio(b)) return;
      pairs++;
      expect(signature(a, worldKinds[i]!), `${a.x},${a.y} ↔ ${b.x},${b.y}`).not.toBe(signature(b, worldKinds[j]!));
    }));
    expect(pairs).toBeGreaterThan(10);
  });

  it("luces: ventanas planas sobre una pared, grupos homogéneos, fracciones encendidas por tipo", () => {
    expect(worldScene.homes.length).toBeGreaterThan(0);
    const byGroup = new Map<string, boolean>();
    for (const w of worldScene.homes) {
      expect(w.pts).toHaveLength(4);
      expect(w.pts.every((p) => p.x === w.pts[0]!.x) || w.pts.every((p) => p.y === w.pts[0]!.y)).toBe(true);
      if (byGroup.has(w.group)) expect(w.lit, w.group).toBe(byGroup.get(w.group));
      byGroup.set(w.group, w.lit);
    }
    const share = (ws: { lit: boolean }[]) => ws.filter((w) => w.lit).length / ws.length;
    const mono = homesOf("monoblock"), casas = homesOf("casas");
    expect(mono.length).toBeGreaterThan(0); expect(casas.length).toBeGreaterThan(0);
    expect(share(mono)).toBeGreaterThanOrEqual(0.30); expect(share(mono)).toBeLessThanOrEqual(0.45);
    expect(share(casas)).toBeGreaterThanOrEqual(0.15); expect(share(casas)).toBeLessThanOrEqual(0.40);
    const fixed = [...homesOf("escuela"), ...homesOf("club")];
    expect(fixed.length).toBeGreaterThanOrEqual(2);
    for (const w of fixed) expect(w.lit).toBe(true);
  });

  it("los materiales del barrio están en TECH_MATS", () => {
    for (const m of ["tile", "brick", "whitewash", "signal", "safety", "hullBlue", "sand"] as Material[]) expect(TECH_MATS).toContain(m);
  });
});

describe("presupuesto de caras y acentos (#249)", () => {
  it("facesIn cuenta los sólidos que caen enteros en el rect inflado 0.5", () => {
    const box: Solid = { kind: "prism", at: { x: 1, y: 1, z: 0 }, w: 2, d: 2, h: 2, mat: "stone" };
    expect(facesIn([box], { x0: 0, y0: 0, x1: 3.5, y1: 3.5 })).toBe(tessellate(box).length);
    expect(facesIn([box], { x0: 0, y0: 0, x1: 2.4, y1: 10 })).toBe(0);
  });
  it("blockRect: la manzana más 2 de vereda", () => {
    expect(blockRect({ x: 132, y: 448, w: 24, d: 18 })).toEqual({ x0: 130, y0: 446, x1: 158, y1: 468 });
  });
  it("todo el distrito ≤ +10 %, la región del barrio ≤ +25 %", () => {
    expect(facesIn(everything, { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 })).toBeLessThanOrEqual(Math.floor(TECH_FACES_BEFORE * 1.1));
    expect(facesIn(everything, BARRIO_REGION)).toBeLessThanOrEqual(Math.floor(REGION_FACES_BEFORE * 1.25));
  });
  it("cada manzana nueva y la costanera dentro de su tope", () => {
    worldBlocks.forEach((b, i) => {
      const k = worldKinds[i]!;
      if (k === "monoblock" || k === "casas" || k === "plaza" || k === "escuela" || k === "club") expect(facesIn(everything, blockRect(b)), `${k} ${b.x},${b.y}`).toBeLessThanOrEqual(FACE_CAPS[k]);
    });
    expect(facesIn(everything, COSTANERA_RECT)).toBeLessThanOrEqual(FACE_CAPS.costanera);
  });
  it("acentos: estáticos más el frame 0 de todas las capas ≤ ACCENT_CAP", () => {
    const a = techAnimator(worldScene, createRng(SEED + 5), { reducedMotion: false });
    const layers = a.ids.reduce((n, id) => { const l = a.layer(id); return n + (l.kind === "accent" ? l.accents.length : 0); }, 0);
    expect(worldScene.accents.length + layers).toBeLessThanOrEqual(ACCENT_CAP);
  });
});
