import { describe, expect, it } from "vitest";
import { hides, screenHull } from "../iso/depth";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import type { Piece, Slot, Window } from "../kit/types";
import { createRng } from "../map/seed";
import { blocks } from "../scenes/city-grid";
import { city, type CityScene, type PlacedPiece } from "../scenes/city";
import { zoneRng } from "../scenes/world";
import { SEED } from "../world/assemble";
import { lightBox, lights, MAX_ANIMABLE, MAX_NEONS, WINDOW_ALPHA } from "./lights";
import { CATALOGUE, type Barrio } from "./zoning";

const BARRIOS = Object.keys(CATALOGUE) as Barrio[];
const prism = (x: number, y: number, z: number, w: number, d: number, h: number): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat: "plaster" });
const quad = (x0: number, x1: number, y: number, z0: number, z1: number): Vec3[] => [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, z1), v3(x0, y, z1)];
const emptyPiece = (): Piece => ({ solids: [], ground: [], accents: [], windows: [], slots: [], walls: [] });
const BLOCK = blocks().find((b) => b.kind !== "plaza")!;

/** Una pieza sintética colocada en `barrio`, con su lote en `z = 0.3` y frente abierto al sur. */
function placedAt(barrio: Barrio, piece: Piece, solidOffset: number, open: ("n" | "s" | "e" | "w")[] = ["s"]): PlacedPiece {
  return { placed: { block: BLOCK, barrio, recipe: "classic", lot: { x: 0, y: 0, w: 24, d: 18, z: 0.3, open, maxH: 18 }, tone: 0 }, piece, solidOffset };
}

/** Oráculo: `true` si algún sólido distinto de `except` tapa la caja. Sin barrido; `bs` es la caché propia del test. */
const hidden = (box: Bounds, bs: Bounds[], hs: Vec2[][], except = -1): boolean => bs.some((b, i) => i !== except && hides(box, b, { back: screenHull(box), front: hs[i]! }));

const SEEDS: readonly [string, () => CityScene, boolean][] = [
  ["semilla del mundo", () => city(zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1), zoneRng(SEED, "cv", 3)), true],
  ["otra semilla", () => city(createRng(7), createRng(8), createRng(9)), false],
];

for (const [name, make, isWorld] of SEEDS) {
  describe(`luces de Resume (${name})`, () => {
    const s = make(), l = s.lights;
    const bs = s.solids.map(bounds), hs = bs.map(screenHull);
    const ownSolid = (w: { window: Window; owner: number }) => s.placed[w.owner]!.solidOffset + w.window.building;

    it("ninguna ventana encendida queda tapada por un sólido (oráculo por fuerza bruta)", () => {
      const on = l.windows.filter((w) => w.on);
      expect(on.length).toBeGreaterThan(100);
      for (const w of on) expect(hidden(lightBox(w.window.pts), bs, hs, ownSolid(w))).toBe(false);
    });

    it("ningún neón queda tapado por un sólido (oráculo por fuerza bruta)", () => {
      for (const n of l.neons) expect(hidden(lightBox(n.slot.pts), bs, hs)).toBe(false);
    });

    it("porcentaje encendido ±8 y proporción cálida ±10 por barrio con ≥ 30 candidatas", () => {
      for (const b of BARRIOS) {
        const ws = l.windows.filter((w) => s.placed[w.owner]!.placed.barrio === b);
        if (ws.length < 30) continue;
        const on = ws.filter((w) => w.on), warm = on.filter((w) => w.color === "windowWarm");
        expect(Math.abs(on.length / ws.length - CATALOGUE[b].lights.on)).toBeLessThanOrEqual(0.08);
        if (on.length > 0) expect(Math.abs(warm.length / on.length - CATALOGUE[b].lights.warm)).toBeLessThanOrEqual(0.1);
      }
    });

    it("counts coincide con las ventanas por barrio", () => {
      for (const b of BARRIOS) {
        const ws = l.windows.filter((w) => s.placed[w.owner]!.placed.barrio === b);
        expect(l.counts[b]).toEqual({ candidates: ws.length, on: ws.filter((w) => w.on).length, warm: ws.filter((w) => w.on && w.color === "windowWarm").length });
      }
    });

    it("las ventanas son de su pieza, cálidas o frías, y la torre de la plaza no entra", () => {
      for (const w of l.windows) {
        expect(s.placed[w.owner]!.piece.windows).toContain(w.window);
        expect(["windowWarm", "windowCool"]).toContain(w.color);
      }
      const towerWindows = new Set(s.tower.litWindows.map((a) => (a.kind === "poly" ? JSON.stringify(a.pts) : "")));
      expect(l.windows.some((w) => towerWindows.has(JSON.stringify(w.window.pts)))).toBe(false);
    });

    it(`hay a lo sumo ${MAX_ANIMABLE} animables y todas del centro o el residencial`, () => {
      const anim = l.windows.filter((w) => w.animable);
      expect(anim.length).toBeLessThanOrEqual(MAX_ANIMABLE);
      expect(anim.length).toBeGreaterThan(0);
      for (const w of anim) expect(["centro", "residencial"]).toContain(s.placed[w.owner]!.placed.barrio);
    });

    it("neones: solo en bares, ≤ 24, frente abierto, uno por local, z 2.4..3.6 sobre el lote, colores con sus halos y charco", () => {
      expect(l.neons.length).toBeLessThanOrEqual(MAX_NEONS);
      if (isWorld) expect(l.neons.length).toBeGreaterThanOrEqual(3);
      const seen = new Set<string>();
      for (const n of l.neons) {
        const p = s.placed[n.owner]!;
        expect(p.placed.barrio).toBe("bares");
        expect(n.slot.kind).toBe("neon");
        expect(p.piece.slots).toContain(n.slot);
        expect(p.placed.lot.open).toContain(n.slot.side);
        const key = `${n.owner}:${n.slot.local}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        for (const q of n.slot.pts) {
          expect(q.z - p.placed.lot.z).toBeGreaterThanOrEqual(2.4 - 1e-6);
          expect(q.z - p.placed.lot.z).toBeLessThanOrEqual(3.6 + 1e-6);
        }
        expect(["amber", "magenta", "cyan"]).toContain(n.color);
        expect(n.accents.some((a) => a.kind === "poly" && a.color === n.color && a.alpha === 1 && a.pts === n.slot.pts)).toBe(true);
        expect(n.accents.every((a) => a.color === n.color || a.color === `${n.color}Bleed`)).toBe(true);
        expect(n.accents.filter((a) => a.kind === "poly" && a.alpha === 0.25 && a.color === `${n.color}Bleed`)).toHaveLength(3); // el charco
      }
    });

    it("bañado: solo bandas de planta baja de paredes de piezas del cívico, amberBleed alpha 0.5", () => {
      const civicWalls = s.placed.filter((p) => p.placed.barrio === "civico").flatMap((p) => p.piece.walls);
      expect(l.bathed.length).toBe(civicWalls.length);
      expect(l.bathed.length).toBeGreaterThan(0);
      l.bathed.forEach((a, i) => {
        const w = civicWalls[i]!;
        expect(a).toMatchObject({ kind: "poly", color: "amberBleed", alpha: 0.5 });
        if (a.kind !== "poly") return;
        expect(a.pts).toHaveLength(4);
        const base = [w.pts[0]!, w.pts[1]!, { ...w.pts[1]!, z: w.pts[1]!.z + w.floorH }, { ...w.pts[0]!, z: w.pts[0]!.z + w.floorH }];
        a.pts.forEach((q, k) => {
          expect(q.x).toBeCloseTo(base[k]!.x + w.normal.x * 0.05, 6);
          expect(q.y).toBeCloseTo(base[k]!.y + w.normal.y * 0.05, 6);
          expect(q.z).toBeCloseTo(base[k]!.z, 6);
        });
      });
    });

    it("flicker es un índice válido de neons (o null sin neones) y el neón elegido está en bares", () => {
      if (l.neons.length === 0) { expect(l.flicker).toBeNull(); return; }
      expect(Number.isInteger(l.flicker)).toBe(true);
      expect(l.flicker!).toBeGreaterThanOrEqual(0);
      expect(l.flicker!).toBeLessThan(l.neons.length);
      expect(s.placed[l.neons[l.flicker!]!.owner]!.placed.barrio).toBe("bares");
    });

    it("las ventanas encendidas estáticas, los neones salvo el que titila y el bañado van a scene.accents", () => {
      for (const w of l.windows.filter((x) => x.on && !x.animable)) expect(s.accents).toContainEqual({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA });
      l.neons.forEach((n, i) => { if (i !== l.flicker) for (const a of n.accents) expect(s.accents).toContain(a); });
      for (const a of l.bathed) expect(s.accents).toContain(a);
      const off = new Set(l.windows.filter((x) => !x.on).map((x) => x.window.pts));
      expect(s.accents.some((a) => a.kind === "poly" && off.has(a.pts))).toBe(false);
    });
  });
}

describe("lights (escenas sintéticas)", () => {
  const scene = city(createRng(7), createRng(8), createRng(9));

  it("es determinista: mismo rng, mismo JSON", () => {
    const view = { solids: scene.solids, placed: scene.placed };
    expect(JSON.stringify(lights(view, createRng(5)))).toBe(JSON.stringify(lights(view, createRng(5))));
    expect(JSON.stringify(lights(view, createRng(5)))).not.toBe(JSON.stringify(lights(view, createRng(6))));
  });

  it("lightBox: la caja de los puntos engordada 0.05", () => {
    const b = lightBox(quad(1, 3, 5, 2, 4));
    expect(b.min.x).toBeCloseTo(0.95); expect(b.max.x).toBeCloseTo(3.05);
    expect(b.min.y).toBeCloseTo(4.95); expect(b.max.y).toBeCloseTo(5.05);
    expect(b.min.z).toBeCloseTo(1.95); expect(b.max.z).toBeCloseTo(4.05);
  });

  it("un sólido de otra pieza delante tapa la ventana, aunque empiece muy a la izquierda en pantalla", () => {
    // pieza A: edificio con una ventana en su cara sur (y = 10); pieza B: muro largo al sur que arranca muy al oeste
    const a = emptyPiece(), b = emptyPiece();
    a.solids.push(prism(0, 0, 0, 10, 10, 10));
    a.windows.push({ pts: quad(4, 6, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    b.solids.push(prism(-60, 12, 0, 80, 2, 12));
    const solids = [...a.solids, ...b.solids];
    const l = lights({ solids, placed: [placedAt("centro", a, 0), placedAt("centro", b, 1)] }, createRng(1));
    expect(l.windows).toHaveLength(0);
    expect(l.counts.centro).toEqual({ candidates: 0, on: 0, warm: 0 });
  });

  it("una cornisa de la misma pieza también tapa: solo se exime el edificio propio", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0, 10, 10, 10), prism(-1, 9, 4.5, 12, 4, 0.5)); // balcón corrido delante de la ventana
    a.windows.push({ pts: quad(4, 6, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    const l = lights({ solids: a.solids, placed: [placedAt("centro", a, 0)] }, createRng(1));
    expect(l.windows).toHaveLength(0);
  });

  it("sin nada delante, la ventana es candidata; un barrio sin piezas queda en cero", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0, 10, 10, 10));
    a.windows.push({ pts: quad(4, 6, 10, 2, 4), floor: 0, wall: v3(0, 1, 0), building: 0 });
    const l = lights({ solids: a.solids, placed: [placedAt("residencial", a, 0)] }, createRng(1));
    expect(l.windows).toHaveLength(1);
    expect(l.counts.residencial.candidates).toBe(1);
    expect(l.flicker).toBeNull(); // sin bares no hay neón que titile
    for (const b of BARRIOS) if (b !== "residencial") expect(l.counts[b]).toEqual({ candidates: 0, on: 0, warm: 0 });
  });

  const neonSlot = (x: number, local: number, z0 = 2.7): Slot => ({ pts: quad(x, x + 2, 18, z0, z0 + 1.2), wall: v3(0, 1, 0), side: "s", kind: "neon", local });

  it("neones: a lo sumo 24 aunque haya 30 slots abiertos, y uno por local", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 120, 18, 6));
    for (let k = 0; k < 30; k++) a.slots.push(neonSlot(k * 4, k));
    a.slots.push(neonSlot(1, 0)); // segundo slot del local 0: no suma
    const l = lights({ solids: a.solids, placed: [placedAt("bares", a, 0)] }, createRng(3));
    expect(l.neons).toHaveLength(MAX_NEONS);
    expect(new Set(l.neons.map((n) => n.slot.local)).size).toBe(MAX_NEONS);
  });

  it("neones: se descartan los slots fuera de 2.4..3.6 sobre el lote, los de lados cerrados, los de otro barrio y los carteles", () => {
    const bares = emptyPiece(), centro = emptyPiece();
    bares.solids.push(prism(0, 0, 0.3, 40, 18, 6));
    bares.slots.push(neonSlot(0, 0, 4.5), { ...neonSlot(4, 1), side: "n" }, { ...neonSlot(8, 2), kind: "sign" }, neonSlot(12, 3));
    centro.solids.push(prism(100, 0, 0.3, 20, 18, 6));
    centro.slots.push(neonSlot(104, 0));
    const l = lights({ solids: [...bares.solids, ...centro.solids], placed: [placedAt("bares", bares, 0), placedAt("centro", centro, 1)] }, createRng(3));
    expect(l.neons.map((n) => n.slot.local)).toEqual([3]);
  });

  it("neones: si el frente de un local de esquina queda tapado, el neón va a su otro lado abierto", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 24, 18, 6), prism(0, 20, 0, 24, 2, 12)); // muro al sur que tapa el frente sur
    a.slots.push(neonSlot(10, 0), { pts: [v3(24, 8, 2.7), v3(24, 10, 2.7), v3(24, 10, 3.9), v3(24, 8, 3.9)], wall: v3(1, 0, 0), side: "e", kind: "neon", local: 0 });
    const l = lights({ solids: a.solids, placed: [placedAt("bares", a, 0, ["s", "e"])] }, createRng(3));
    expect(l.neons.map((n) => n.slot.side)).toEqual(["e"]);
  });

  it("neones: el charco cae 1 hacia afuera de la pared, a la z del lote", () => {
    const a = emptyPiece();
    a.solids.push(prism(0, 0, 0.3, 24, 18, 6));
    a.slots.push(neonSlot(10, 0));
    const [n] = lights({ solids: a.solids, placed: [placedAt("bares", a, 0)] }, createRng(3)).neons;
    const puddle = n!.accents.filter((x) => x.kind === "poly" && x.alpha === 0.25);
    expect(puddle).toHaveLength(3);
    for (const p of puddle) {
      if (p.kind !== "poly") continue;
      const cx = p.pts.reduce((t, q) => t + q.x, 0) / p.pts.length, cy = p.pts.reduce((t, q) => t + q.y, 0) / p.pts.length;
      expect(cx).toBeCloseTo(11, 6); expect(cy).toBeCloseTo(19, 6);
      for (const q of p.pts) expect(q.z).toBeCloseTo(0.3, 6);
    }
  });

  it("neones: colores con pesos amber 50, magenta 30, cyan 20", () => {
    const tally = { amber: 0, magenta: 0, cyan: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const a = emptyPiece();
      a.solids.push(prism(0, 0, 0.3, 120, 18, 6));
      for (let k = 0; k < 24; k++) a.slots.push(neonSlot(k * 4, k));
      for (const n of lights({ solids: a.solids, placed: [placedAt("bares", a, 0)] }, createRng(seed)).neons) tally[n.color]++;
    }
    const total = tally.amber + tally.magenta + tally.cyan;
    expect(Math.abs(tally.amber / total - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(tally.magenta / total - 0.3)).toBeLessThan(0.05);
    expect(Math.abs(tally.cyan / total - 0.2)).toBeLessThan(0.05);
  });
});
