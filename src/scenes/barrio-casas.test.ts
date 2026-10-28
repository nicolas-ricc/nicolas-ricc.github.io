import { describe, expect, it } from "vitest";
import { bounds, type Solid } from "../iso/solids";
import { createRng, SEED } from "../map/seed";
import type { HomeWindow } from "./barrio";
import { blockAt, faces, newCtx } from "./barrio-fixtures";
import { casas } from "./barrio-casas";
import { suburbBlocks, type SprawlBlock } from "./sprawl-grid";
import { tech } from "./tech";
import { FACE_CAPS, blockRect, facesIn, insideInflated } from "./tech-budget";
import { blockParity, zoneKinds } from "./tech-zoning";
import { zoneRng } from "./world";

type Prism = Solid & { kind: "prism" };
const isPrism = (s: Solid): s is Prism => s.kind === "prism";

/** Las piezas de una manzana de casas, clasificadas por forma y material. */
function parts(solids: readonly Solid[]) {
  const gables = solids.filter((s): s is Prism => isPrism(s) && s.roof === "gable");
  return {
    gables,
    houses: gables.filter((s) => s.w >= 4 && s.d >= 4),
    ala: gables.filter((s) => s.w === 3 && s.d === 3),
    chims: solids.filter((s): s is Prism => isPrism(s) && s.mat === "brick" && s.w === 0.6 && s.d === 0.6),
    garage: solids.filter((s): s is Prism => isPrism(s) && s.mat === "whitewash" && s.roof !== "gable" && s.w === 3 && s.d === 3.5),
    roof: solids.filter((s): s is Solid & { kind: "ramp" } => s.kind === "ramp" && s.mat === "tile"),
    drive: solids.filter((s): s is Solid & { kind: "strip" } => s.kind === "strip" && s.mat === "paving"),
    walls: solids.filter((s): s is Prism => isPrism(s) && s.mat === "brick" && s.h === 1.2 && s.d === 0.3).sort((a, b) => a.at.x - b.at.x),
    trees: solids.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.mat === "leaf"),
    lamps: solids.filter((s): s is Prism => isPrism(s) && s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5),
  };
}

const EPS = 1e-9;
const apart = (a: Solid, b: Solid): boolean => {
  const p = bounds(a), q = bounds(b);
  return p.max.x <= q.min.x + EPS || q.max.x <= p.min.x + EPS || p.max.y <= q.min.y + EPS || q.max.y <= p.min.y + EPS || p.max.z <= q.min.z + EPS || q.max.z <= p.min.z + EPS;
};
const crossXY = (a: Solid, b: Solid): boolean => { const p = bounds(a), q = bounds(b); return p.max.x > q.min.x + EPS && q.max.x > p.min.x + EPS && p.max.y > q.min.y + EPS && q.max.y > p.min.y + EPS; };
const holds = (house: Prism, c: Prism): boolean => c.at.x >= house.at.x && c.at.x + c.w <= house.at.x + house.w && c.at.y >= house.at.y && c.at.y + c.d <= house.at.y + house.d;

/** Pares de casas, ala, cochera, techo, chimeneas y muro que se pisan (la chimenea con su casa vale). */
function overlaps(solids: readonly Solid[]): string[] {
  const p = parts(solids), all: Solid[] = [...p.gables, ...p.garage, ...p.roof, ...p.chims, ...p.walls], bad: string[] = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i]!, b = all[j]!;
    const chimOnHouse = (c: Solid, h: Solid) => p.chims.includes(c as Prism) && p.gables.includes(h as Prism) && holds(h as Prism, c as Prism);
    if (chimOnHouse(a, b) || chimOnHouse(b, a)) continue;
    if (!apart(a, b)) bad.push(`${JSON.stringify(bounds(a))} × ${JSON.stringify(bounds(b))}`);
  }
  return bad;
}

// el mundo real: rng de la zona y el tipo de cada manzana según el pre-pase
const scene = tech(zoneRng(SEED, "cv", 2));
const everything = [...scene.solids, ...scene.ground];
const blocks = suburbBlocks(), kinds = zoneKinds(zoneRng(SEED, "cv", 2), blocks);
const casasBlocks = blocks.filter((_, i) => kinds[i] === "casas");
const own = (b: SprawlBlock) => everything.filter((s) => insideInflated(s, blockRect(b)));
const homesIn = (b: SprawlBlock): HomeWindow[] => { const r = blockRect(b); return scene.homes.filter((w) => w.pts.every((q) => q.x >= r.x0 && q.x <= r.x1 && q.y >= r.y0 && q.y <= r.y1)); };
const each = (f: (b: SprawlBlock, p: ReturnType<typeof parts>) => void) => { for (const b of casasBlocks) f(b, parts(own(b))); };

describe("casas de Ciudad Jardín (#251), sobre el mundo", () => {
  it("hay manzanas de casas para probar", () => expect(casasBlocks.length).toBeGreaterThanOrEqual(10));

  it("4 a 5 casas gable de teja, revoque o ladrillo, de uno o dos pisos", () => each((b, p) => {
    const at = `${b.x},${b.y}`;
    expect(p.houses.length, at).toBeGreaterThanOrEqual(4); expect(p.houses.length, at).toBeLessThanOrEqual(5);
    expect(p.gables.length, at).toBeGreaterThanOrEqual(4); expect(p.gables.length, at).toBeLessThanOrEqual(6);
    for (const g of p.gables) { expect(g.roofMat, at).toBe("tile"); expect(["whitewash", "brick"], at).toContain(g.mat); }
    for (const h of p.houses) {
      expect([3, 5.5], at).toContain(h.h);
      expect(h.w).toBeGreaterThanOrEqual(4); expect(h.w).toBeLessThanOrEqual(6); expect(h.d).toBeGreaterThanOrEqual(4); expect(h.d).toBeLessThanOrEqual(6);
    }
  }));

  it("la cumbrera sigue la paridad: w ≥ d ⇔ blockParity === 0", () => each((b, p) => {
    for (const h of p.houses) expect(h.w >= h.d, `${b.x},${b.y}`).toBe(blockParity(b) === 0);
  }));

  it("como mucho un ala, pegada al este de una casa, al ras de su fachada sur y del mismo material", () => each((b, p) => {
    expect(p.ala.length).toBeLessThanOrEqual(1);
    for (const a of p.ala) {
      expect(a.h).toBe(3);
      expect(p.houses.some((h) => Math.abs(h.at.x + h.w - a.at.x) < EPS && Math.abs(h.at.y + h.d - (a.at.y + 3)) < EPS && h.mat === a.mat), `${b.x},${b.y}`).toBe(true);
    }
  }));

  it("chimeneas de ladrillo apoyadas en el alero y dentro de su casa", () => each((b, p) => {
    expect(p.chims.length, `${b.x},${b.y}`).toBeGreaterThanOrEqual(2);
    for (const c of p.chims) {
      expect(c.h).toBe(1.6);
      expect(p.houses.some((h) => Math.abs(c.at.z - (h.at.z + h.h)) < EPS && holds(h, c)), `${b.x},${b.y}`).toBe(true);
    }
  }));

  it("una cochera con techo de teja y entrada de auto hasta el cordón sur", () => each((b, p) => {
    const at = `${b.x},${b.y}`;
    expect(p.garage, at).toHaveLength(1); expect(p.roof, at).toHaveLength(1); expect(p.drive, at).toHaveLength(1);
    const g = p.garage[0]!, r = p.roof[0]!, d = p.drive[0]!, db = bounds(d);
    expect(g.h).toBe(2.3);
    expect(r).toMatchObject({ dir: "s", w: 3.4, d: 3.9, h: 0.8 });
    expect(r.at.z).toBeCloseTo(g.at.z + 2.3, 9);
    expect(r.at.x).toBeLessThanOrEqual(g.at.x + EPS); expect(r.at.x + r.w).toBeGreaterThanOrEqual(g.at.x + g.w - EPS);
    expect(r.at.y).toBeLessThanOrEqual(g.at.y + EPS); expect(r.at.y + r.d).toBeGreaterThanOrEqual(g.at.y + g.d - EPS);
    expect(d.width).toBe(2.5);
    expect(db.max.y).toBeCloseTo(b.y + 18, 9); expect(db.min.y).toBeCloseTo(g.at.y + 3.5, 9);
    expect(db.min.x).toBeGreaterThanOrEqual(g.at.x - EPS); expect(db.max.x).toBeLessThanOrEqual(g.at.x + 3 + EPS);
  }));

  it("muro bajo de ladrillo con reja, en dos tramos con un hueco de 3 u en la entrada de auto", () => each((b, p) => {
    const at = `${b.x},${b.y}`;
    expect(p.walls, at).toHaveLength(2);
    for (const w of p.walls) {
      expect(w.at.y).toBeCloseTo(b.y + 17.5, 9);
      expect(w.plates?.some((q) => q.wall === 2 && q.mat === "officeDark" && q.toneOffset === -2), at).toBe(true);
    }
    const [w0, w1] = p.walls as [Prism, Prism], gap0 = w0.at.x + w0.w, gap1 = w1.at.x, db = bounds(p.drive[0]!);
    expect(gap1 - gap0, at).toBeCloseTo(3, 9);
    expect((gap0 + gap1) / 2, at).toBeCloseTo((db.min.x + db.max.x) / 2, 9);
  }));

  it("árboles de vereda en la calle sur y dos faroles, sin pisar la entrada ni los faroles", () => each((b, p) => {
    const at = `${b.x},${b.y}`;
    expect(p.trees.filter((t) => t.at.y >= b.y + 18).length, at).toBeGreaterThanOrEqual(3);
    expect(p.lamps, at).toHaveLength(2);
    for (const t of p.trees) for (const o of [...p.drive, ...p.lamps]) expect(crossXY(t, o), at).toBe(false);
  }));

  it("ventanas y puertas sobre la pared sur de una casa, con grupos únicos de la manzana", () => each((b, p) => {
    const at = `${b.x},${b.y}`, ws = homesIn(b);
    expect(ws.length, at).toBeGreaterThanOrEqual(p.houses.length * 2);
    for (const w of ws) {
      const y = w.pts[0]!.y;
      for (const q of w.pts) expect(q.y).toBe(y);
      expect(p.houses.some((h) => Math.abs(h.at.y + h.d - y) < EPS && w.pts.every((q) => q.x >= h.at.x - EPS && q.x <= h.at.x + h.w + EPS)), at).toBe(true);
      expect(w.group.startsWith(`${b.x},${b.y}:`), at).toBe(true);
    }
    expect(new Set(ws.map((w) => w.group)).size, at).toBe(ws.length);
  }));

  it("fracción encendida de ventanas y puertas de casas entre 0.15 y 0.40", () => {
    const ws = casasBlocks.flatMap(homesIn), share = ws.filter((w) => w.lit).length / ws.length;
    expect(share).toBeGreaterThanOrEqual(0.15); expect(share).toBeLessThanOrEqual(0.40);
  });

  it("casas, ala, cochera, techo, chimeneas y muro no se solapan (tocarse vale)", () => each((b) => {
    expect(overlaps(own(b)), `${b.x},${b.y}`).toEqual([]);
  }));

  it("dentro del tope de caras", () => each((b) => expect(facesIn(everything, blockRect(b)), `${b.x},${b.y}`).toBeLessThanOrEqual(FACE_CAPS.casas)));
});

describe("casas de Ciudad Jardín (#251), semillas sueltas", () => {
  const b0 = blockAt(132, 520), b1 = blockAt(102, 520);
  it("las dos manzanas de prueba tienen paridad distinta", () => expect(blockParity(b0)).not.toBe(blockParity(b1)));
  for (const b of [b0, b1]) for (const seed of [1, 7, 11]) {
    it(`(${b.x},${b.y}) semilla ${seed}: sin solapes y dentro del tope`, () => {
      const ctx = newCtx(createRng(seed));
      casas(ctx, b);
      expect(overlaps(ctx.solids)).toEqual([]);
      expect(faces(ctx)).toBeLessThanOrEqual(FACE_CAPS.casas);
    });
  }
  it("la planta 5×5 existe en paridad 0 y nunca en paridad 1", () => {
    const squares = (b: SprawlBlock) => Array.from({ length: 20 }, (_, s) => { const ctx = newCtx(createRng(s + 1)); casas(ctx, b); return parts(ctx.solids).houses.filter((h) => h.w === h.d).length; }).reduce((x, y) => x + y, 0);
    const [even, odd] = blockParity(b0) === 0 ? [b0, b1] : [b1, b0];
    expect(squares(even)).toBeGreaterThan(0); expect(squares(odd)).toBe(0);
  });
  it("el ala aparece en algunas corridas y no en otras", () => {
    const withAla = Array.from({ length: 20 }, (_, s) => { const ctx = newCtx(createRng(s + 1)); casas(ctx, b0); return parts(ctx.solids).ala.length; });
    expect(withAla.some((n) => n === 1)).toBe(true); expect(withAla.some((n) => n === 0)).toBe(true);
  });
});
