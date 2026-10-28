import { describe, expect, it } from "vitest";
import { bounds, isFlat, type Solid } from "../iso/solids";
import { Z_SCALE } from "../iso/project";
import { SEED } from "../map/seed";
import { suburbBlocks } from "./sprawl-grid";
import { tech } from "./tech";
import { FACE_CAPS, blockRect, facesIn, insideInflated } from "./tech-budget";
import { zoneKinds } from "./tech-zoning";
import { zoneRng } from "./world";

type Prism = Solid & { kind: "prism" };

// el mundo real: manzanas de monoblocks según el pre-pase
const scene = tech(zoneRng(SEED, "cv", 2));
const blocks = suburbBlocks(), kinds = zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const monos = blocks.filter((_, i) => kinds[i] === "monoblock");
const everything = [...scene.solids, ...scene.ground];
const of = (b: (typeof monos)[number]) => {
  const r = blockRect(b), solids = scene.solids.filter((s) => insideInflated(s, r)), ground = scene.ground.filter((s) => insideInflated(s, r));
  const prisms = solids.filter((s): s is Prism => s.kind === "prism");
  const bodies = prisms.filter((p) => p.w === 20 && p.d === 5 && p.h >= 3);
  const plinths = prisms.filter((p) => p.mat === "paving" && p.w === 20.6 && p.d === 5.6 && p.h === 0.3);
  const tanks = prisms.filter((p) => p.mat === "concrete" && p.w === 2 && p.d === 2);
  const antennas = prisms.filter((p) => p.mat === "steel" && p.w === 0.2 && p.d === 0.2);
  const trees = solids.filter((s) => s.kind === "cone" && s.mat === "leaf");
  const homes = scene.homes.filter((w) => w.pts.every((p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1));
  const lamps = scene.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.at.x >= r.x0 && a.at.x <= r.x1 && a.at.y >= r.y0 && a.at.y <= r.y1);
  return { r, solids, ground, bodies, plinths, tanks, antennas, trees, homes, lamps };
};
const onRoof = (t: Prism, body: Prism) => Math.abs(t.at.z - (body.at.z + body.h)) < 1e-9 && t.at.x >= body.at.x && t.at.x + t.w <= body.at.x + body.w && t.at.y >= body.at.y && t.at.y + t.d <= body.at.y + body.d;
const overlap = (a: Solid, b: Solid) => {
  const p = bounds(a), q = bounds(b), e = 1e-9;
  const xy = p.min.x < q.max.x - e && q.min.x < p.max.x - e && p.min.y < q.max.y - e && q.min.y < p.max.y - e;
  return xy && p.min.z < q.max.z - e && q.min.z < p.max.z - e;
};

/** ¿El rayo desde (x, y, z) hacia la cámara (Z_SCALE, Z_SCALE, 1) atraviesa el cuerpo p? El contacto no cuenta. */
const tapado = (q: { x: number; y: number; z: number }, p: Prism) => {
  const d = [Z_SCALE, Z_SCALE, 1], o = [q.x, q.y, q.z], lo = [p.at.x, p.at.y, p.at.z], hi = [p.at.x + p.w, p.at.y + p.d, p.at.z + p.h];
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < 3; i++) { const a = (lo[i]! - o[i]!) / d[i]!, c = (hi[i]! - o[i]!) / d[i]!; t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c)); }
  return t1 > 1e-9 && t0 < t1 - 1e-9;
};

describe("monoblocks del Barrio Simón Bolívar (#250)", () => {
  it("hay manzanas de monoblocks en el mundo", () => expect(monos.length).toBe(18));

  it("cada manzana: 1 o 2 cuerpos 20×5 de h ∈ {12, 15, 18}, distintas si son dos, de revoque claro sobre zócalo", () => {
    for (const b of monos) {
      const { bodies, plinths } = of(b);
      expect(bodies.length, `${b.x},${b.y}`).toBeGreaterThanOrEqual(1); expect(bodies.length).toBeLessThanOrEqual(2);
      for (const p of bodies) { expect([12, 15, 18]).toContain(p.h); expect(["whitewash", "stone"]).toContain(p.mat); expect(p.at.z).toBeCloseTo(0.3); }
      if (bodies.length === 2) expect(bodies[0]!.h).not.toBe(bodies[1]!.h);
      expect(plinths).toHaveLength(bodies.length);
    }
  });

  it("en el barrio entero aparecen las tres alturas, los dos revoques y planta baja de ladrillo en algunas placas", () => {
    const bodies = monos.flatMap((b) => of(b).bodies);
    expect(new Set(bodies.map((p) => p.h))).toEqual(new Set([12, 15, 18]));
    expect(new Set(bodies.map((p) => p.mat))).toEqual(new Set(["whitewash", "stone"]));
    const brick = bodies.filter((p) => p.plates?.some((q) => q.mat === "brick"));
    expect(brick.length).toBeGreaterThan(0); expect(brick.length).toBeLessThan(bodies.length);
    for (const p of brick) expect(p.plates!.filter((q) => q.mat === "brick").map((q) => q.wall).sort()).toEqual([1, 2]);
  });

  it("fachada en grilla: banda de ventanas por piso al sur y al este, 7 pilastras al sur y 1 al este, 1 o 2 loggias con baranda por piso", () => {
    for (const b of monos) for (const p of of(b).bodies) {
      const floors = p.h / 3, plates = p.plates ?? [];
      for (const wall of [1, 2]) expect(plates.filter((q) => q.wall === wall && q.mat === "glass" && q.toneOffset === -1), `banda wall ${wall}`).toHaveLength(floors);
      const piers = plates.filter((q) => q.mat === p.mat && q.toneOffset === 1);
      expect(piers.filter((q) => q.wall === 2)).toHaveLength(7); expect(piers.filter((q) => q.wall === 1)).toHaveLength(1);
      for (const q of piers) { expect(q.z0).toBeCloseTo(0.3); expect(q.z1).toBeCloseTo(0.3 + p.h); }
      const loggias = plates.filter((q) => q.mat === "officeDark" && q.toneOffset === -2);
      expect(loggias.length).toBeGreaterThanOrEqual(1); expect(loggias.length).toBeLessThanOrEqual(2);
      for (const q of loggias) { expect(q.wall).toBe(2); expect(q.z1 - q.z0).toBeCloseTo(p.h); }
      expect(plates.filter((q) => q.mat === "whitewash" && q.wall === 2 && Math.abs(q.z1 - q.z0 - 0.2) < 1e-9)).toHaveLength(floors * loggias.length);
    }
  });

  it("ninguna placa glass ni pilastra cae en wall 0 ni wall 3", () => {
    for (const b of monos) for (const p of of(b).bodies) for (const q of p.plates ?? []) expect([1, 2]).toContain(q.wall);
  });

  it("torre de tanques: cada cuerpo con ≥ 2 tanques concrete 2×2 apoyados en su azotea y una antena steel sobre un tanque", () => {
    for (const b of monos) {
      const { bodies, tanks, antennas } = of(b);
      for (const p of bodies) {
        const mine = tanks.filter((t) => onRoof(t, p));
        expect(mine.length, `${b.x},${b.y}`).toBeGreaterThanOrEqual(2); expect(mine.length).toBeLessThanOrEqual(3);
        expect(antennas.filter((a) => mine.some((t) => Math.abs(a.at.z - (t.at.z + t.h)) < 1e-9 && a.at.x >= t.at.x && a.at.x + a.w <= t.at.x + t.w && a.at.y >= t.at.y && a.at.y + a.d <= t.at.y + t.d))).toHaveLength(1);
      }
    }
  });

  it("parque: césped, ≥ 4 árboles, 2 senderos de paving, 2 faroles; sin estacionamiento", () => {
    for (const b of monos) {
      const { solids, ground, trees, lamps } = of(b);
      expect(solids.some((s) => s.kind === "prism" && s.mat === "leafDark" && s.w === b.w && s.d === b.d)).toBe(true);
      expect(trees.length, `${b.x},${b.y}`).toBeGreaterThanOrEqual(4); expect(trees.length).toBeLessThanOrEqual(6);
      expect(ground.filter((s) => s.kind === "strip" && s.mat === "paving")).toHaveLength(2);
      expect(lamps).toHaveLength(2);
      expect(solids.some((s) => s.mat === "asphalt")).toBe(false);
    }
  });

  it("cuerpos, zócalos, tanques y árboles no se solapan", () => {
    for (const b of monos) {
      const { bodies, plinths, tanks, trees } = of(b), all: Solid[] = [...bodies, ...plinths, ...tanks, ...trees];
      all.forEach((x, i) => all.forEach((y, j) => { if (j > i) expect(overlap(x, y), `${b.x},${b.y} #${i}↔#${j}`).toBe(false); }));
    }
  });

  it("ventanas sobre el plano sur o este de un cuerpo, dentro de su pared", () => {
    for (const b of monos) {
      const { bodies, homes } = of(b);
      expect(homes.length).toBeGreaterThan(0);
      for (const w of homes) {
        const on = bodies.some((p) => (w.pts.every((q) => q.y === p.at.y + 5 && q.x >= p.at.x && q.x <= p.at.x + 20)) || (w.pts.every((q) => q.x === p.at.x + 20 && q.y >= p.at.y && q.y <= p.at.y + 5)));
        expect(on, `${b.x},${b.y} ${w.group}`).toBe(true);
        expect(w.pts.every((q) => q.z >= 0.3)).toBe(true);
      }
    }
  });

  it("en cada columna de loggia todas las ventanas comparten lit; hay columnas encendidas", () => {
    let columns = 0, litColumns = 0;
    for (const b of monos) {
      const tall = of(b).homes.filter((w) => { const zs = w.pts.map((q) => q.z); return Math.max(...zs) - Math.min(...zs) > 1.2; });
      const byColumn = new Map<string, boolean[]>();
      for (const w of tall) { const k = `${w.pts[0]!.y}|${Math.min(...w.pts.map((q) => q.x)).toFixed(3)}`; byColumn.set(k, [...(byColumn.get(k) ?? []), w.lit]); }
      expect(byColumn.size).toBeGreaterThanOrEqual(1); // la placa trasera más baja queda tapada entera
      for (const lits of byColumn.values()) { expect(new Set(lits).size).toBe(1); columns++; if (lits[0]) litColumns++; }
    }
    expect(litColumns).toBeGreaterThan(0); expect(litColumns).toBeLessThan(columns);
  });

  it("ninguna ventana del monoblock queda tapada por otra placa de su manzana", () => {
    for (const b of monos) {
      const { bodies, homes } = of(b);
      for (const w of homes) for (const q of w.pts) for (const p of bodies) expect(tapado(q, p), `${b.x},${b.y} ${w.group}`).toBe(false);
    }
  });

  it("en cada manzana al menos un árbol se ve: su ápice no lo tapa ningún cuerpo", () => {
    for (const b of monos) {
      const { bodies, trees } = of(b);
      const seen = trees.some((t) => { const c = t as Solid & { kind: "cone" }; const a = { x: c.at.x, y: c.at.y, z: c.at.z + c.h }; return bodies.every((p) => !tapado(a, p)); });
      expect(seen, `${b.x},${b.y}`).toBe(true);
    }
  });

  it("la fracción encendida de todas las ventanas de monoblocks está en [0.30, 0.45]", () => {
    const homes = monos.flatMap((b) => of(b).homes), lit = homes.filter((w) => w.lit).length / homes.length;
    expect(lit).toBeGreaterThanOrEqual(0.30); expect(lit).toBeLessThanOrEqual(0.45);
  });

  it("cada manzana dentro de FACE_CAPS.monoblock; nada no esbelto supera 21.5", () => {
    for (const b of monos) {
      expect(facesIn(everything, blockRect(b)), `${b.x},${b.y}`).toBeLessThanOrEqual(FACE_CAPS.monoblock);
      for (const s of of(b).solids) {
        const slender = s.kind === "prism" && s.w <= 3 && s.d <= 3;
        if (!slender && !isFlat(s)) expect(bounds(s).max.z).toBeLessThanOrEqual(21.5);
      }
    }
  });
});
