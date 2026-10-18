import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { project, Z_SCALE } from "../iso/project";
import { bounds, type Solid } from "../iso/solids";
import { BLEED, WORLD } from "../map/geo";
import { BEAM_PERIOD_MS } from "../scenes/sea-anim";
import { assembleWorld } from "../world/assemble";
import { type Box, FRAME_H, HALO_BASE } from "../world/frame";
import { cropAnimators, cropScene } from "./crop";
import { EXHIBITS, GROUPS, type GroupId, pickExhibit, stepExhibit } from "./exhibits";

const regions = EXHIBITS.flatMap((e) => (e.kind === "region" ? [e] : []));

// el índice de la spec §3, en orden; las piezas (#94) no cuentan
const CATALOG: Record<GroupId, string[]> = {
  fabrica: ["planta", "chimeneas", "subestacion", "playa-camiones", "playa-vias", "cinta"],
  astillero: ["gradas", "darsena", "grua-portico", "calle-faroles", "naves"],
  hinterland: ["central-termica", "tanques", "silos", "alta-tension", "playa-contenedores"],
  feria: ["noria", "montana-rusa", "torre-caida", "carrusel", "arcade", "autitos-chocadores", "muelle"],
  ciudad: ["plaza", "torre", "puente", "malecon", "manzana-derrumbada", "manzana-distrito", "obra"],
  tecnologico: ["mastil", "arena", "auditorio", "torres"],
  mar: ["faro", "casa-farero", "boyas", "pecio"],
};
const ANIMATED = ["chimeneas", "noria", "torre", "faro"];
const SLACK = 8; // más alto que esto sobre la estructura y queda chica en el cuadro

const { scene, animators } = assembleWorld(undefined, { reducedMotion: false });
const within = (s: Solid, b: Box): boolean => { const r = bounds(s); return r.min.x >= b.x0 && r.max.x <= b.x1 && r.min.y >= b.y0 && r.max.y <= b.y1; };
const top = (solids: readonly Solid[]): number => Math.max(0, ...solids.map((s) => bounds(s).max.z));

const TURN_STEPS = 32;
const HALO_K = Math.max(...HALO_BASE.map((h) => h.k)); // el disco más grande que dibuja `drawAccents` alrededor de un punto

/** Altura que piden los acentos de la estructura (medida en pantalla contra el vértice norte de `boxFrame`), estáticos y animados a lo largo de una vuelta del haz; mundo nuevo para no depender del orden del catálogo. */
function accentReach(box: Box): number {
  const north = (box.x0 + box.y0) / 2;
  const own = (a: Accent): boolean => { const p = a.kind === "dot" ? a.at : a.pts[0]!; return p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1; };
  const reach = (accents: readonly Accent[]): number => Math.max(0, ...accents.filter(own).flatMap((a) =>
    a.kind === "dot" ? [(north - project(a.at).y + a.r * HALO_K) / Z_SCALE] : a.pts.map((p) => (north - project(p).y) / Z_SCALE)));
  const sweep = assembleWorld(undefined, { reducedMotion: false });
  const anims = cropAnimators(sweep.animators, box);
  let max = reach(cropScene(sweep.scene, box).accents);
  for (let k = 0; k < TURN_STEPS; k++) {
    for (const a of anims) for (const id of a.ids) { const l = a.layer(id); if (l.kind === "accent") max = Math.max(max, reach(l.accents)); }
    for (const a of anims) a.tick(BEAM_PERIOD_MS / TURN_STEPS);
  }
  return max;
}

/** Alturas de lo que la caja recorta: estático adentro, estático + capas animadas adentro, el vecino cortado más alto y lo que piden los acentos. */
function measure(box: Box): { inside: number; withAnim: number; neighbour: number; accents: number } {
  const cs = cropScene(scene, box);
  const fixed = [...cs.ground, ...cs.solids];
  const anim = cropAnimators(animators, box).flatMap((a) => a.ids.flatMap((id) => { const l = a.layer(id); return l.kind === "solid" ? l.solids : []; }));
  const inside = top(fixed.filter((s) => within(s, box)));
  return {
    inside,
    withAnim: Math.max(inside, top(anim.filter((s) => within(s, box)))),
    neighbour: top(fixed.filter((s) => s.kind !== "ground" && !within(s, box))),
    accents: accentReach(box),
  };
}

describe("catálogo de exhibits", () => {
  it("ids únicos con el patrón del hash", () => {
    const ids = EXHIBITS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("los grupos del índice son contiguos, en el orden de GROUPS y con la zona de su grupo", () => {
    const order = GROUPS.map((g) => g.id);
    const seen = EXHIBITS.map((e) => e.group).filter((g, i, all) => i === 0 || all[i - 1] !== g);
    expect(seen).toEqual(order.filter((g) => seen.includes(g)));
    for (const e of EXHIBITS) expect(e.zone, e.id).toBe(GROUPS.find((g) => g.id === e.group)!.zone);
  });
  it("cada caja cae dentro del mundo más el sangrado y no está invertida", () => {
    for (const { id, box } of regions) {
      expect(box.x0, id).toBeLessThan(box.x1); expect(box.y0, id).toBeLessThan(box.y1);
      expect(box.x0, id).toBeGreaterThanOrEqual(WORLD.x0 - BLEED.x); expect(box.x1, id).toBeLessThanOrEqual(WORLD.x1 + BLEED.x);
      expect(box.y0, id).toBeGreaterThanOrEqual(WORLD.y0 - BLEED.y); expect(box.y1, id).toBeLessThanOrEqual(WORLD.y1 + BLEED.y);
    }
  });
  it("los cuatro exhibits de #92 recortan un animador que no es el agua", () => {
    for (const id of ANIMATED) {
      const e = regions.find((r) => r.id === id)!;
      expect(cropAnimators(animators, e.box).some((a) => a.zone !== null), id).toBe(true);
    }
  });

  describe.each(GROUPS.map((g) => g.id))("grupo %s", (group) => {
    const mine = regions.filter((e) => e.group === group);
    const measured = new Map(mine.map((e) => [e, measure(e.box)]));
    it("tiene las regiones de la spec, en orden", () => {
      expect(mine.map((e) => e.id)).toEqual(CATALOG[group]);
    });
    it("no-vacío: contra el mundo real cada región recorta al menos un sólido", () => {
      for (const e of mine) expect(cropScene(scene, e.box).solids.length, e.id).toBeGreaterThan(0);
    });
    it("encuadre: h cubre la estructura y sus acentos y no sobra más de SLACK", () => {
      for (const e of mine) {
        const h = e.h ?? FRAME_H, m = measured.get(e)!;
        expect(h, e.id).toBeGreaterThanOrEqual(Math.max(m.inside, m.accents));
        expect(h, e.id).toBeLessThanOrEqual(Math.max(m.withAnim, m.accents) + SLACK);
      }
    });
    it("vecinos: ningún sólido cortado por el borde sube más que h", () => {
      for (const e of mine) expect(measured.get(e)!.neighbour, e.id).toBeLessThanOrEqual(e.h ?? FRAME_H);
    });
  });
});

describe("selección por hash", () => {
  const [first, second] = EXHIBITS;
  it("acepta el hash con o sin #", () => {
    expect(pickExhibit(`#${second!.id}`)).toBe(second);
    expect(pickExhibit(second!.id)).toBe(second);
  });
  it("vacío, solo # o desconocido → el primero", () => {
    for (const h of ["", "#", "#nada", "#%E0%A4%A", `#${second!.id.toUpperCase()}`]) expect(pickExhibit(h)).toBe(first);
  });
  it("las flechas dan la vuelta en los extremos", () => {
    const last = EXHIBITS[EXHIBITS.length - 1]!;
    expect(stepExhibit(first!.id, 1)).toBe(second);
    expect(stepExhibit(first!.id, -1)).toBe(last);
    expect(stepExhibit(last.id, 1)).toBe(first);
  });
  it("con un id desconocido las flechas van al primero", () => {
    expect(stepExhibit("nada", 1)).toBe(first);
    expect(stepExhibit("nada", -1)).toBe(first);
  });
});

const pieces = EXHIBITS.flatMap((e) => (e.kind === "piece" ? [e] : []));

describe("exhibits de pieza", () => {
  it("las ocho piezas, cada una en su zona", () => {
    expect(Object.fromEntries(pieces.map((e) => [e.id, e.zone]))).toEqual({
      "grua-torre": "portfolio", farol: "portfolio",
      campus: "cv", selva: "cv",
      carguero: "blog", remolcador: "blog", convoy: "blog", lancha: "blog",
    });
  });
  it("cada pieza emite al menos un sólido", () => {
    for (const e of pieces) {
      const out: Solid[] = [], accents: Accent[] = [];
      e.build(out, accents);
      expect(out.length, e.id).toBeGreaterThan(0);
    }
  });
  it("armar dos veces la misma pieza da lo mismo", () => {
    for (const e of pieces) {
      const a: Solid[] = [], b: Solid[] = [], aa: Accent[] = [], ba: Accent[] = [];
      e.build(a, aa); e.build(b, ba);
      expect(b, e.id).toEqual(a);
      expect(ba, e.id).toEqual(aa);
    }
  });
});
