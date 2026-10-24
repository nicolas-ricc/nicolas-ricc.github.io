// src/iso/solids.ts
import type { Material, Tone } from "../map/palette-iso";
import { facadeFaces, type Facade } from "./facade";
import { centroid, dot, polygonNormal, type Vec2, type Vec3, v3 } from "./geometry";
import { shadeTone } from "./light";
import { plateFaces, type Plate } from "./plate";
import { VIEW_DIR } from "./project";

export type { Plate } from "./plate";

export interface Tri { pts: [Vec3, Vec3, Vec3]; toneOffset?: number; baseTone?: number }

export type Solid =
  | { kind: "prism"; at: Vec3; w: number; d: number; h: number; mat: Material; roof?: "flat" | "gable" | "step"; facade?: Facade; plates?: Plate[] }
  | { kind: "poly"; footprint: Vec2[]; z: number; h: number; mat: Material; facade?: Facade; plates?: Plate[] }
  | { kind: "ramp"; at: Vec3; w: number; d: number; h: number; mat: Material; dir: RampDir; plates?: Plate[] }
  | { kind: "cylinder"; at: Vec3; r: number; h: number; mat: Material; sides?: number }
  | { kind: "cone"; at: Vec3; r: number; h: number; mat: Material; sides?: number }
  | { kind: "beam"; from: Vec3; to: Vec3; w: number; h: number; mat: Material }
  | { kind: "hull"; at: Vec3; len: number; beam: number; h: number; mat: Material; topMat?: Material; heading?: number; sheer?: number }
  | { kind: "strip"; path: Vec2[]; width: number; z: number; mat: Material }
  | { kind: "ground"; tris: Tri[]; mat: Material }
  | { kind: "wheel"; at: Vec3; r: number; width: number; mat: Material; sides: number; angle: number; gondolas?: { mat: Material; w: number; d: number; h: number }; hollow?: boolean; slots?: number; buckets?: { n: number; depth: number; teeth: number; mat: Material } };

/** Hacia dónde baja la rampa: "e" tiene el borde alto al oeste, "s" lo tiene al norte. */
export type RampDir = "e" | "w" | "n" | "s";

export interface Face { pts: Vec3[]; normal: Vec3; mat: Material; tone: Tone; toneOffset: number }

export const GABLE_RATIO = 0.35; // altura de cumbrera sobre alero, relativa a la altura de la caja
export const STEP_RATIO = 0.35;  // altura del segundo nivel del techo escalonado
export const STEP_INSET = 0.2;   // retranqueo del segundo nivel, relativo al lado

export function isFlat(s: Solid): boolean {
  return s.kind === "strip" || s.kind === "ground";
}

/** Cara con la normal orientada hacia afuera del centro `c` del sólido. */
function face(pts: Vec3[], mat: Material, c: Vec3, toneOffset = 0): Face {
  let normal = polygonNormal(pts);
  const fc = centroid(pts);
  if (dot(normal, { x: fc.x - c.x, y: fc.y - c.y, z: fc.z - c.z }) < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z };
  return { pts, normal, mat, tone: shadeTone(normal), toneOffset };
}

/** Prisma recto sobre una huella poligonal: techo, base y un cuadrilátero por lado. */
function extrude(footprint: Vec2[], z0: number, h: number, mat: Material): Face[] {
  const top = footprint.map((p) => v3(p.x, p.y, z0 + h));
  const bottom = footprint.map((p) => v3(p.x, p.y, z0));
  const c = centroid([...top, ...bottom]);
  const out = [face(top, mat, c), face(bottom, mat, c)];
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!, b = footprint[(i + 1) % footprint.length]!;
    out.push(face([v3(a.x, a.y, z0), v3(b.x, b.y, z0), v3(b.x, b.y, z0 + h), v3(a.x, a.y, z0 + h)], mat, c));
  }
  return out;
}

/**
 * Techo y base pasan; tras la pared de la arista `edgeOf(k)` (cara `k + 2`) van sus caras de fachada y sus placas.
 * Cuenta con el orden de `extrude` (techo, base, una pared por arista) o de `ramp` (base, plano, cuatro paredes).
 */
function withPlates(raw: Face[], footprint: Vec2[], s: { facade?: Facade; plates?: Plate[] }, edgeOf: (k: number) => number = (k) => k): Face[] {
  if (!s.facade && !s.plates?.length) return raw;
  const n = footprint.length;
  return raw.flatMap((f, k) => {
    if (k < 2) return [f];
    const i = edgeOf(k - 2);
    return [f, ...(s.facade ? facadeFaces(f, s.facade) : []), ...plateFaces(f, footprint[i]!, footprint[(i + 1) % n]!, (s.plates ?? []).filter((p) => p.wall === i))];
  });
}

/**
 * Paredes de la rampa (caras 2..5: oeste, este, norte, sur) → arista de `rect` que las cubre. Las placas van sobre el plano
 * vertical de la arista, sin recortar al perfil inclinado; la del lado de altura 0 hereda una normal nula y `tessellate` la descarta.
 */
const RAMP_WALL_EDGE = [3, 1, 0, 2];

const rect = (x: number, y: number, w: number, d: number): Vec2[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }];

function regular(cx: number, cy: number, r: number, sides: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides; // caras planas al norte/sur/este/oeste
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function gable(at: Vec3, w: number, d: number, h: number, mat: Material): Face[] {
  const { x, y, z } = at;
  const eave = z + h, ridge = eave + h * GABLE_RATIO;
  const c = v3(x + w / 2, y + d / 2, z + h / 2);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  if (w >= d) {
    const ym = y + d / 2;
    return [
      f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z), v3(x, y + d, z)]),                          // base
      f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y, eave), v3(x, y, eave)]),                             // pared norte
      f([v3(x, y + d, z), v3(x + w, y + d, z), v3(x + w, y + d, eave), v3(x, y + d, eave)]),             // pared sur
      f([v3(x, y, z), v3(x, y, eave), v3(x, ym, ridge), v3(x, y + d, eave), v3(x, y + d, z)]),           // hastial oeste
      f([v3(x + w, y, z), v3(x + w, y, eave), v3(x + w, ym, ridge), v3(x + w, y + d, eave), v3(x + w, y + d, z)]), // hastial este
      f([v3(x, y, eave), v3(x + w, y, eave), v3(x + w, ym, ridge), v3(x, ym, ridge)]),                   // vertiente norte
      f([v3(x, y + d, eave), v3(x + w, y + d, eave), v3(x + w, ym, ridge), v3(x, ym, ridge)]),           // vertiente sur
    ];
  }
  const xm = x + w / 2;
  return [
    f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z), v3(x, y + d, z)]),
    f([v3(x, y, z), v3(x, y + d, z), v3(x, y + d, eave), v3(x, y, eave)]),                               // pared oeste
    f([v3(x + w, y, z), v3(x + w, y + d, z), v3(x + w, y + d, eave), v3(x + w, y, eave)]),               // pared este
    f([v3(x, y, z), v3(x, y, eave), v3(xm, y, ridge), v3(x + w, y, eave), v3(x + w, y, z)]),             // hastial norte
    f([v3(x, y + d, z), v3(x, y + d, eave), v3(xm, y + d, ridge), v3(x + w, y + d, eave), v3(x + w, y + d, z)]), // hastial sur
    f([v3(x, y, eave), v3(x, y + d, eave), v3(xm, y + d, ridge), v3(xm, y, ridge)]),                     // vertiente oeste
    f([v3(x + w, y, eave), v3(x + w, y + d, eave), v3(xm, y + d, ridge), v3(xm, y, ridge)]),             // vertiente este
  ];
}

function ramp(at: Vec3, w: number, d: number, h: number, dir: RampDir, mat: Material): Face[] {
  const { x, y, z } = at;
  const hi = z + h;
  // altura de cada esquina según hacia dónde baja
  const corner = (west: boolean, north: boolean): number => {
    switch (dir) {
      case "e": return west ? hi : z;
      case "w": return west ? z : hi;
      case "s": return north ? hi : z;
      case "n": return north ? z : hi;
    }
  };
  const nw = corner(true, true), ne = corner(false, true), se = corner(false, false), sw = corner(true, false);
  const c = v3(x + w / 2, y + d / 2, z + h / 4);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  return [
    f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z), v3(x, y + d, z)]),             // base
    f([v3(x, y, nw), v3(x + w, y, ne), v3(x + w, y + d, se), v3(x, y + d, sw)]),         // plano inclinado
    f([v3(x, y, z), v3(x, y + d, z), v3(x, y + d, sw), v3(x, y, nw)]),                   // pared oeste
    f([v3(x + w, y, z), v3(x + w, y + d, z), v3(x + w, y + d, se), v3(x + w, y, ne)]),   // pared este
    f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y, ne), v3(x, y, nw)]),                   // lado norte
    f([v3(x, y + d, z), v3(x + w, y + d, z), v3(x + w, y + d, se), v3(x, y + d, sw)]),   // lado sur
  ];
}

function cone(at: Vec3, r: number, h: number, sides: number, mat: Material): Face[] {
  const base = regular(at.x, at.y, r, sides);
  const apex = v3(at.x, at.y, at.z + h);
  const c = v3(at.x, at.y, at.z + h / 3);
  const out = [face(base.map((p) => v3(p.x, p.y, at.z)), mat, c)];
  for (let i = 0; i < sides; i++) {
    const a = base[i]!, b = base[(i + 1) % sides]!;
    out.push(face([v3(a.x, a.y, at.z), v3(b.x, b.y, at.z), apex], mat, c));
  }
  return out;
}

/**
 * Viga recta de `from` a `to`, sección `w` × `h`: el lado `w` queda horizontal y perpendicular al eje en planta, así que la
 * sección no se tuerce. Eje vertical: `w` sobre y. Largo cero: eje x, una placa degenerada que no rompe bounds ni orden.
 */
function beam(s: Solid & { kind: "beam" }): Face[] {
  const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, dz = s.to.z - s.from.z, len = Math.hypot(dx, dy, dz);
  const u = len === 0 ? v3(1, 0, 0) : v3(dx / len, dy / len, dz / len);
  const plan = Math.hypot(u.x, u.y);
  const side = plan < 1e-9 ? v3(0, 1, 0) : v3(-u.y / plan, u.x / plan, 0);
  const up = v3(u.y * side.z - u.z * side.y, u.z * side.x - u.x * side.z, u.x * side.y - u.y * side.x);
  const ring = (e: Vec3): Vec3[] => ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) =>
    v3(e.x + side.x * a * s.w / 2 + up.x * b * s.h / 2, e.y + side.y * a * s.w / 2 + up.y * b * s.h / 2, e.z + side.z * a * s.w / 2 + up.z * b * s.h / 2));
  const r0 = ring(s.from), r1 = ring(s.to);
  const c = v3((s.from.x + s.to.x) / 2, (s.from.y + s.to.y) / 2, (s.from.z + s.to.z) / 2);
  const out = [face(r0, s.mat, c), face(r1, s.mat, c)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; out.push(face([r0[i]!, r0[j]!, r1[j]!, r1[i]!], s.mat, c)); }
  return out;
}

export const HULL_WATERLINE = 0.2, HULL_SHEER = 0.25, KEEL_BEAM = 0.7;
/** Anillo de cubierta en fracciones de eslora/manga: popa redondeada, manga máxima al 57 %, proa en punta. Sentido horario visto desde arriba. */
export const DECK_RING: readonly Vec2[] = [
  { x: 0.04, y: -0.3 }, { x: 0, y: 0 }, { x: 0.04, y: 0.3 }, { x: 0.18, y: 0.5 }, { x: 0.57, y: 0.5 },
  { x: 0.86, y: 0.3 }, { x: 1, y: 0 }, { x: 0.86, y: -0.3 }, { x: 0.57, y: -0.5 }, { x: 0.18, y: -0.5 },
];
/** Arrufo: cuánto sube la cubierta sobre `h` en cada punto (proa cuadrática, popa lineal más corta). */
const sheerAt = (x: number): number => Math.max(0, (x - 0.55) / 0.45) ** 2 + 0.4 * Math.max(0, (0.18 - x) / 0.18);

/** Anillos de cubierta y quilla en coordenadas de mundo (popa en `at`, proa a `len` según `heading`). */
export function hullRings(s: Solid & { kind: "hull" }): { deck: Vec3[]; keel: Vec3[] } {
  const c = Math.cos(s.heading ?? 0), sn = Math.sin(s.heading ?? 0), sheer = s.sheer ?? HULL_SHEER;
  const world = (fx: number, fy: number, z: number): Vec3 => { const x = fx * s.len, y = fy * s.beam; return v3(s.at.x + x * c - y * sn, s.at.y + x * sn + y * c, z); };
  const deck = DECK_RING.map((p) => world(p.x, p.y, s.at.z + s.h * (1 + sheer * sheerAt(p.x))));
  const keel = DECK_RING.map((p) => world(0.06 + 0.84 * p.x, p.y * KEEL_BEAM, s.at.z));
  return { deck, keel };
}

/** Casco lofteado entre quilla y cubierta: cada lado son dos cuadriláteros (obra viva en `mat`, obra muerta en `topMat`) partidos en triángulos. */
function hull(s: Solid & { kind: "hull" }): Face[] {
  const { deck, keel } = hullRings(s);
  const c = centroid([...deck, ...keel]);
  const top = s.topMat ?? s.mat, deckMat: Material = s.topMat ? "deck" : s.mat;
  const out = [face(deck, deckMat, c), face(keel, s.mat, c)];
  const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  const n = deck.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k0 = keel[i]!, k1 = keel[j]!, d0 = deck[i]!, d1 = deck[j]!, m0 = lerp(k0, d0, HULL_WATERLINE), m1 = lerp(k1, d1, HULL_WATERLINE);
    out.push(face([k0, k1, m1], s.mat, c), face([k0, m1, m0], s.mat, c));
    out.push(face([m0, m1, d1], top, c), face([m0, d1, d0], top, c));
  }
  return out;
}

function strip(path: Vec2[], width: number, z: number, mat: Material): Face[] {
  const out: Face[] = [];
  const hw = width / 2;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!, b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / len) * hw, ny = ((b.x - a.x) / len) * hw;
    const pts = [v3(a.x + nx, a.y + ny, z), v3(b.x + nx, b.y + ny, z), v3(b.x - nx, b.y - ny, z), v3(a.x - nx, a.y - ny, z)];
    out.push({ pts, normal: v3(0, 0, 1), mat, tone: "top", toneOffset: 0 });
  }
  return out;
}

function ground(tris: Tri[], mat: Material): Face[] {
  return tris.map((t) => {
    let normal = polygonNormal(t.pts);
    if (normal.z < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    return { pts: t.pts, normal, mat, tone: shadeTone(normal), toneOffset: t.toneOffset ?? 0 };
  });
}

const SQ = Math.SQRT1_2;
/** El plano de la rueda: `u` es horizontal en pantalla (mundo (1, −1)); la normal mira a la cámara. */
export const WHEEL_U: Vec3 = { x: SQ, y: -SQ, z: 0 };
export const WHEEL_NORMAL: Vec3 = { x: SQ, y: SQ, z: 0 };
export const wheelPoint = (at: Vec3, a: number, rho: number): Vec3 => v3(at.x + WHEEL_U.x * rho * Math.cos(a), at.y + WHEEL_U.y * rho * Math.cos(a), at.z + rho * Math.sin(a));

/** Rueda de frente a la cámara: llanta en sectores, rayos, cubo (todos en el plano, tono `top`) y góndolas como prismas colgados de la llanta.
 *  `hollow`: llanta doble (exterior + interior a `r − 2.2·width .. r − 1.2·width`), sin rayos ni cubo; `slots`: barras radiales de ancho `width/3` que unen las dos llantas (solo con `hollow`).
 *  `buckets`: `n` cangilones trapezoidales que sobresalen `depth` de la llanta exterior, con una malla interior (60 %, `toneOffset −2`) y `teeth` dientes triangulares de lado `depth/3`, equiespaciados en el borde de mayor ángulo
 *  (el borde mide ≈ `depth`: con más de 3 dientes las bases se enciman). */
function wheel(s: Solid & { kind: "wheel" }): Face[] {
  // Los planos de la rueda no siguen la regla habitual de sombreado por normal: una pared que
  // mirase a la cámara se pintaría "shade" (la cara más oscura), pero el anillo debe leerse en
  // el color base del material, así que se fuerza el tono "top" sin desplazamiento.
  const flat = (pts: Vec3[], mat: Material = s.mat, toneOffset = 0): Face => ({ pts, normal: WHEEL_NORMAL, mat, tone: "top", toneOffset });
  const out: Face[] = [];
  const hub = s.r * 0.12, inner = s.r - s.width, half = s.width / 6;
  const bar = (a: number, r0: number, r1: number): Face => {
    const px = -Math.sin(a) * half, pz = Math.cos(a) * half; // perpendicular al rayo dentro del plano
    const off = (p: Vec3, sgn: number): Vec3 => v3(p.x + WHEEL_U.x * px * sgn, p.y + WHEEL_U.y * px * sgn, p.z + pz * sgn);
    const i0 = wheelPoint(s.at, a, r0), i1 = wheelPoint(s.at, a, r1);
    return flat([off(i0, -1), off(i1, -1), off(i1, 1), off(i0, 1)]);
  };
  const sector = (a0: number, a1: number, r0: number, r1: number): Face => flat([wheelPoint(s.at, a0, r0), wheelPoint(s.at, a1, r0), wheelPoint(s.at, a1, r1), wheelPoint(s.at, a0, r1)]);
  for (let k = 0; k < s.sides; k++) {
    const a0 = s.angle + (2 * Math.PI * k) / s.sides, a1 = s.angle + (2 * Math.PI * (k + 1)) / s.sides;
    out.push(sector(a0, a1, inner, s.r));
    out.push(s.hollow ? sector(a0, a1, s.r - 2.2 * s.width, s.r - 1.2 * s.width) : bar(a0, hub, inner));
  }
  if (!s.hollow) out.push(flat(Array.from({ length: 8 }, (_, k) => wheelPoint(s.at, s.angle + (2 * Math.PI * k) / 8, hub))));
  else {
    const slots = s.slots ?? 0; // ranuras: de la mitad de la llanta interior a la mitad de la exterior
    for (let k = 0; k < slots; k++) out.push(bar(s.angle + (2 * Math.PI * k) / slots, s.r - 1.7 * s.width, s.r - 0.5 * s.width));
  }
  if (s.buckets) {
    const { n, depth, teeth, mat } = s.buckets;
    const h0 = (0.45 * Math.PI) / n, h1 = (0.3 * Math.PI) / n, side = depth / 3;
    // coordenadas (u, z) relativas al centro de la rueda <-> mundo
    const uz = (p: Vec3): [number, number] => [(p.x - s.at.x) * WHEEL_U.x + (p.y - s.at.y) * WHEEL_U.y, p.z - s.at.z];
    const back = (u: number, z: number): Vec3 => v3(s.at.x + WHEEL_U.x * u, s.at.y + WHEEL_U.y * u, s.at.z + z);
    for (let k = 0; k < n; k++) {
      const c = s.angle + (2 * Math.PI * k) / n;
      const e0 = wheelPoint(s.at, c + h0, s.r), e1 = wheelPoint(s.at, c + h1, s.r + depth);
      const trap = [wheelPoint(s.at, c - h0, s.r), e0, e1, wheelPoint(s.at, c - h1, s.r + depth)];
      out.push(flat(trap, mat));
      const m = v3(trap.reduce((q, p) => q + p.x, 0) / 4, trap.reduce((q, p) => q + p.y, 0) / 4, trap.reduce((q, p) => q + p.z, 0) / 4);
      out.push(flat(trap.map((p) => v3(m.x + 0.6 * (p.x - m.x), m.y + 0.6 * (p.y - m.y), m.z + 0.6 * (p.z - m.z))), mat, -2));
      // dientes: triángulos equiláteros sobre el borde delantero E0 -> E1, con el vértice hacia fuera del trapecio
      const [e0u, e0z] = uz(e0), [e1u, e1z] = uz(e1), [mu, mz] = uz(m);
      const du = e1u - e0u, dz = e1z - e0z, len = Math.hypot(du, dz);
      const tu = du / len, tz = dz / len;
      let nu = tz, nz = -tu; // perpendicular al borde
      if (nu * (e0u + du / 2 - mu) + nz * (e0z + dz / 2 - mz) < 0) { nu = -nu; nz = -nz; }
      const hb = side / 2, ht = (side * Math.sqrt(3)) / 2;
      for (let j = 0; j < teeth; j++) {
        const f = (j + 0.5) / teeth, cu = e0u + du * f, cz = e0z + dz * f;
        const b0 = back(cu - tu * hb, cz - tz * hb), b1 = back(cu + tu * hb, cz + tz * hb), apex = back(cu + nu * ht, cz + nz * ht);
        out.push(flat([b0, b1, apex], mat));
      }
    }
  }
  if (s.gondolas) {
    const g = s.gondolas;
    for (let k = 0; k < s.sides; k++) {
      const p = wheelPoint(s.at, s.angle + (2 * Math.PI * (k + 0.5)) / s.sides, s.r - s.width / 2);
      out.push(...extrude(rect(p.x - g.w / 2, p.y - g.d / 2, g.w, g.d), p.z - g.h, g.h, g.mat));
    }
  }
  return out;
}

export function tessellateAll(s: Solid): Face[] {
  switch (s.kind) {
    case "prism": {
      if (s.roof === "gable") return gable(s.at, s.w, s.d, s.h, s.mat);
      const fp = rect(s.at.x, s.at.y, s.w, s.d);
      const box = withPlates(extrude(fp, s.at.z, s.h, s.mat), fp, s);
      if (s.roof !== "step") return box;
      const ix = s.w * STEP_INSET, iy = s.d * STEP_INSET;
      return [...box, ...extrude(rect(s.at.x + ix, s.at.y + iy, s.w - 2 * ix, s.d - 2 * iy), s.at.z + s.h, s.h * STEP_RATIO, s.mat)];
    }
    case "poly": return withPlates(extrude(s.footprint, s.z, s.h, s.mat), s.footprint, s);
    case "ramp": return withPlates(ramp(s.at, s.w, s.d, s.h, s.dir, s.mat), rect(s.at.x, s.at.y, s.w, s.d), { plates: s.plates }, (k) => RAMP_WALL_EDGE[k]!);
    case "cylinder": return extrude(regular(s.at.x, s.at.y, s.r, s.sides ?? 8), s.at.z, s.h, s.mat);
    case "cone": return cone(s.at, s.r, s.h, s.sides ?? 6, s.mat);
    case "beam": return beam(s);
    case "hull": return hull(s);
    case "strip": return strip(s.path, s.width, s.z, s.mat);
    case "ground": return ground(s.tris, s.mat);
    case "wheel": return wheel(s);
  }
}

/** Solo lo que mira a la cámara. Suelo y franjas se emiten enteros. */
export function tessellate(s: Solid): Face[] {
  const all = tessellateAll(s);
  return isFlat(s) ? all : all.filter((f) => dot(f.normal, VIEW_DIR) > 0);
}

export interface Bounds { min: Vec3; max: Vec3 }

/** Caja de alineación de eje que contiene todos los vértices del sólido. Las placas no cuentan. */
export function bounds(s: Solid): Bounds {
  if ("plates" in s && s.plates) s = { ...s, plates: undefined };
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}
