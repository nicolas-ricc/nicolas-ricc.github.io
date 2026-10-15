// src/iso/solids.ts
import type { Material, Tone } from "../map/palette-iso";
import { facadeFaces, isWall, type Facade } from "./facade";
import { centroid, dot, normalize, polygonNormal, type Vec2, type Vec3, v3 } from "./geometry";
import { shadeTone } from "./light";
import { VIEW_DIR } from "./project";

export interface Tri { pts: [Vec3, Vec3, Vec3]; toneOffset?: number; baseTone?: number }

export type Solid = (
  | { kind: "prism"; at: Vec3; w: number; d: number; h: number; mat: Material; roof?: "flat" | "gable" | "step" | "hip"; facade?: Facade }
  | { kind: "poly"; footprint: Vec2[]; z: number; h: number; mat: Material; facade?: Facade }
  | { kind: "ramp"; at: Vec3; w: number; d: number; h: number; mat: Material; dir: RampDir }
  | { kind: "cylinder"; at: Vec3; r: number; h: number; mat: Material; sides?: number }
  | { kind: "cone"; at: Vec3; r: number; h: number; mat: Material; sides?: number }
  | { kind: "dome"; at: Vec3; r: number; h: number; mat: Material; sides?: number; rings?: number }
  | { kind: "vault"; at: Vec3; len: number; w: number; h: number; axis: "x" | "y"; mat: Material; segments?: number }
  | { kind: "hull"; at: Vec3; len: number; beam: number; h: number; mat: Material; topMat?: Material; heading?: number; sheer?: number }
  | { kind: "strip"; path: Vec2[]; width: number; z: number; mat: Material }
  | { kind: "ground"; tris: Tri[]; mat: Material }
  | { kind: "wheel"; at: Vec3; r: number; width: number; mat: Material; sides: number; angle: number; gondolas?: { mat: Material; w: number; d: number; h: number } }
) & { tone?: number /* entero, −2..+2 */ };

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

/** Doble del área con signo (shoelace). Positiva en el orden canónico de `rect()`: norte, este, sur, oeste. */
function signedArea2(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

/**
 * Prisma recto sobre una huella poligonal: techo, base y un cuadrilátero por lado.
 * Las paredes se orientan por el sentido de giro (sirve para huellas cóncavas):
 * la huella se lleva al orden canónico y la normal de `a→b` es `(dy, −dx)`.
 */
function extrude(footprint: Vec2[], z0: number, h: number, mat: Material): Face[] {
  const fp = signedArea2(footprint) < 0 ? [...footprint].reverse() : footprint;
  const mk = (pts: Vec3[], normal: Vec3): Face => ({ pts, normal, mat, tone: shadeTone(normal), toneOffset: 0 });
  const out = [mk(fp.map((p) => v3(p.x, p.y, z0 + h)), v3(0, 0, 1)), mk(fp.map((p) => v3(p.x, p.y, z0)), v3(0, 0, -1))];
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i]!, b = fp[(i + 1) % fp.length]!;
    out.push(mk([v3(a.x, a.y, z0), v3(b.x, b.y, z0), v3(b.x, b.y, z0 + h), v3(a.x, a.y, z0 + h)], normalize(v3(b.y - a.y, a.x - b.x, 0))));
  }
  return out;
}

const rect = (x: number, y: number, w: number, d: number): Vec2[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }];

function regular(cx: number, cy: number, r: number, sides: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides; // caras planas al norte/sur/este/oeste
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Techo a cuatro aguas: paredes hasta el alero y cumbrera por el eje largo, acortada min(w, d)/2 en cada punta. */
function hip(at: Vec3, w: number, d: number, h: number, mat: Material): Face[] {
  const { x, y, z } = at;
  const eave = z + h, ridge = eave + h * GABLE_RATIO, i = Math.min(w, d) / 2;
  const c = v3(x + w / 2, y + d / 2, z + h / 2);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  const nw = v3(x, y, eave), ne = v3(x + w, y, eave), se = v3(x + w, y + d, eave), sw = v3(x, y + d, eave);
  const box = extrude(rect(x, y, w, d), z, h, mat).slice(1); // base y paredes, sin el techo plano
  if (w >= d) {
    const r0 = v3(x + i, y + d / 2, ridge), r1 = v3(x + w - i, y + d / 2, ridge);
    const top = w === d ? [r0] : [r1, r0]; // con w === d la cumbrera es un punto y los faldones largos quedan triángulos
    return [...box, f([nw, ne, ...top]), f([sw, se, ...top]), f([nw, sw, r0]), f([ne, se, r1])];
  }
  const r0 = v3(x + w / 2, y + i, ridge), r1 = v3(x + w / 2, y + d - i, ridge);
  return [...box, f([nw, sw, r1, r0]), f([ne, se, r1, r0]), f([nw, ne, r0]), f([sw, se, r1])];
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

/** Cúpula: anillos a ángulo polar creciente (radio r·cos φ, altura h·sin φ), cuadriláteros entre anillos y triángulos al ápice. */
function dome(at: Vec3, r: number, h: number, sides: number, rings: number, mat: Material): Face[] {
  const ring = (k: number): Vec3[] => {
    const phi = (k / rings) * (Math.PI / 2), z = at.z + h * Math.sin(phi);
    return regular(at.x, at.y, r * Math.cos(phi), sides).map((p) => v3(p.x, p.y, z));
  };
  const apex = v3(at.x, at.y, at.z + h);
  const c = v3(at.x, at.y, at.z + h / 3); // con el centro a nivel de la base, la base no se podría orientar
  const out = [face(ring(0), mat, c)];
  for (let k = 0; k < rings; k++) {
    const lo = ring(k), hi = k < rings - 1 ? ring(k + 1) : null;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      out.push(face(hi ? [lo[i]!, lo[j]!, hi[j]!, hi[i]!] : [lo[i]!, lo[j]!, apex], mat, c));
    }
  }
  return out;
}

/** Bóveda de cañón: medio óvalo (semiancho w/2, alto h) en franjas a lo largo del eje, dos hastiales y la base. `at` es la esquina NO. */
function vault(s: Solid & { kind: "vault" }): Face[] {
  const { at, len, w, h, mat } = s, n = s.segments ?? 6;
  // u a lo largo del eje, v a lo ancho; el último punto del arco cierra exacto (sin(π) no es 0)
  const P = (u: number, j: number): Vec3 => {
    const t = (j / n) * Math.PI, v = j === n ? w : (w / 2) * (1 - Math.cos(t)), z = j === n ? at.z : at.z + h * Math.sin(t);
    return s.axis === "x" ? v3(at.x + u, at.y + v, z) : v3(at.x + v, at.y + u, z);
  };
  // con el centro a nivel de la base, la base no se podría orientar
  const mid = s.axis === "x" ? v3(at.x + len / 2, at.y + w / 2, at.z + h / 3) : v3(at.x + w / 2, at.y + len / 2, at.z + h / 3);
  const arc = (u: number) => Array.from({ length: n + 1 }, (_, j) => P(u, j));
  const out = [face([P(0, 0), P(len, 0), P(len, n), P(0, n)], mat, mid), face(arc(0), mat, mid), face(arc(len), mat, mid)];
  for (let j = 0; j < n; j++) out.push(face([P(0, j), P(len, j), P(len, j + 1), P(0, j + 1)], mat, mid));
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

/** Rueda de frente a la cámara: llanta en sectores, rayos, cubo (todos en el plano, tono `top`) y góndolas como prismas colgados de la llanta. */
function wheel(s: Solid & { kind: "wheel" }): Face[] {
  // Los planos de la rueda no siguen la regla habitual de sombreado por normal: una pared que
  // mirase a la cámara se pintaría "shade" (la cara más oscura), pero el anillo debe leerse en
  // el color base del material, así que se fuerza el tono "top" sin desplazamiento.
  const flat = (pts: Vec3[]): Face => ({ pts, normal: WHEEL_NORMAL, mat: s.mat, tone: "top", toneOffset: 0 });
  const out: Face[] = [];
  const hub = s.r * 0.12, inner = s.r - s.width, half = s.width / 6;
  for (let k = 0; k < s.sides; k++) {
    const a0 = s.angle + (2 * Math.PI * k) / s.sides, a1 = s.angle + (2 * Math.PI * (k + 1)) / s.sides;
    out.push(flat([wheelPoint(s.at, a0, inner), wheelPoint(s.at, a1, inner), wheelPoint(s.at, a1, s.r), wheelPoint(s.at, a0, s.r)]));
    const px = -Math.sin(a0) * half, pz = Math.cos(a0) * half; // perpendicular al rayo dentro del plano
    const off = (p: Vec3, sgn: number): Vec3 => v3(p.x + WHEEL_U.x * px * sgn, p.y + WHEEL_U.y * px * sgn, p.z + pz * sgn);
    const i0 = wheelPoint(s.at, a0, hub), i1 = wheelPoint(s.at, a0, inner);
    out.push(flat([off(i0, -1), off(i1, -1), off(i1, 1), off(i0, 1)]));
  }
  out.push(flat(Array.from({ length: 8 }, (_, k) => wheelPoint(s.at, s.angle + (2 * Math.PI * k) / 8, hub))));
  if (s.gondolas) {
    const g = s.gondolas;
    for (let k = 0; k < s.sides; k++) {
      const p = wheelPoint(s.at, s.angle + (2 * Math.PI * (k + 0.5)) / s.sides, s.r - s.width / 2);
      out.push(...extrude(rect(p.x - g.w / 2, p.y - g.d / 2, g.w, g.d), p.z - g.h, g.h, g.mat));
    }
  }
  return out;
}

function facesOf(s: Solid): Face[] {
  switch (s.kind) {
    case "prism": {
      if (s.roof === "gable") return gable(s.at, s.w, s.d, s.h, s.mat);
      if (s.roof === "hip") return hip(s.at, s.w, s.d, s.h, s.mat);
      const raw = extrude(rect(s.at.x, s.at.y, s.w, s.d), s.at.z, s.h, s.mat);
      const box = s.facade ? raw.flatMap((f) => (isWall(f) ? [f, ...facadeFaces(f, s.facade!)] : [f])) : raw;
      if (s.roof !== "step") return box;
      const ix = s.w * STEP_INSET, iy = s.d * STEP_INSET;
      return [...box, ...extrude(rect(s.at.x + ix, s.at.y + iy, s.w - 2 * ix, s.d - 2 * iy), s.at.z + s.h, s.h * STEP_RATIO, s.mat)];
    }
    case "poly": { const raw = extrude(s.footprint, s.z, s.h, s.mat); return s.facade ? raw.flatMap((f) => (isWall(f) ? [f, ...facadeFaces(f, s.facade!)] : [f])) : raw; }
    case "ramp": return ramp(s.at, s.w, s.d, s.h, s.dir, s.mat);
    case "cylinder": return extrude(regular(s.at.x, s.at.y, s.r, s.sides ?? 8), s.at.z, s.h, s.mat);
    case "cone": return cone(s.at, s.r, s.h, s.sides ?? 6, s.mat);
    case "dome": return dome(s.at, s.r, s.h, s.sides ?? 12, s.rings ?? 3, s.mat);
    case "vault": return vault(s);
    case "hull": return hull(s);
    case "strip": return strip(s.path, s.width, s.z, s.mat);
    case "ground": return ground(s.tris, s.mat);
    case "wheel": return wheel(s);
  }
}

/** Caras del sólido; `tone` desplaza el toneOffset de todas. */
export function tessellateAll(s: Solid): Face[] {
  const faces = facesOf(s), t = s.tone ?? 0;
  return t === 0 ? faces : faces.map((f) => ({ ...f, toneOffset: f.toneOffset + t }));
}

/** Solo lo que mira a la cámara. Suelo y franjas se emiten enteros. */
export function tessellate(s: Solid): Face[] {
  const all = tessellateAll(s);
  return isFlat(s) ? all : all.filter((f) => dot(f.normal, VIEW_DIR) > 0);
}

export interface Bounds { min: Vec3; max: Vec3 }

/** Caja de alineación de eje que contiene todos los vértices del sólido. */
export function bounds(s: Solid): Bounds {
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}
