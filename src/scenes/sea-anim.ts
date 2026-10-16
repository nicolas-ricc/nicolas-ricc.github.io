import type { Accent } from "../iso/accent";
import { polyline, v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { SeaScene } from "./sea";
import { chase, flip, pulse } from "./neon";
import { ship as buildShip, wake, type ShipKind } from "./ships";

/**
 * Blog animado, sin Pixi: tres barcos que salen de la bahía, rodean la punta
 * por el este, cruzan la fosa y se desvanecen en el sangrado, sus estelas y
 * luces, el haz ámbar del faro (luz cálida, no neón) y las dos boyas, más
 * los neones de la punta: la galería corre al revés del haz, la costa ondula
 * y el cartel del farero alterna. El agua en sí (repartida por profundidad
 * en `terrain.ts`) no es asunto de acá: la anima `water-animator.ts`. Spec §7.
 */
// Nace en (326, -24), no más al oeste ni al sur: en la bahía el barco tiene max.y < 24 y quedaría detrás (isBehind por y) de los
// galpones del muelle de alistamiento (x 304..324, y ≥ 24) y de su selva (x 332..340, y ≥ 26) si se superpusiera con ellos en pantalla.
//
// Desvío de la Task 6 respecto del trazado original de la brief: el carguero mide 60 u de eslora, y su
// caja de alineación (la que usa el test de profundidad) es mucho más ancha en pantalla que su silueta
// real cuando la proa apunta en diagonal (35°..55°). Un trazado que sale de la bahía en diagonal directa
// hacia el este de la punta cruza en pantalla, en algún tramo, la boya BUOYS[0] (420,80) o el arrecife
// (conos de roca cerca de 405,111) aunque el barco esté a decenas de unidades de distancia en el mundo:
// son falsos positivos del bounding-box del test, no una superposición real, y no hay forma de
// evitarlos cambiando iso/depth.ts (fuera del alcance de esta tarea). La salida se aplanó (tramo
// (350,10)→(500,20), casi puro este) para que el barco, casi horizontal en ese tramo, tenga una caja
// angosta en y y no la levante por encima de la boya ni del arrecife; recién gira hacia el sur en
// x ≥ 500, lejos de ambos. El resto del trazado (fosa y pecio) también se corrió al este por la misma
// razón. Ver el informe de la Task 6 para el detalle (además se corrió `cluster(332,340,26,94,6)` a
// `cluster(332,340,50,94,6)` en shipyard.ts: un árbol de esa selva quedaba en el mismo tipo de conflicto
// con la salida de la bahía, y ROUTE[0] y el heading inicial están fijados por el test, sin margen).
export const ROUTE: Vec2[] = [{ x: 326, y: -24 }, { x: 350, y: 10 }, { x: 500, y: 20 }, { x: 510, y: 118 }, { x: 520, y: 172 }, { x: 545, y: 224 }, { x: 610, y: 260 }];
export const SHIPS: readonly { kind: ShipKind; speed: number; phase: number }[] = [{ kind: "cargo", speed: 1.2, phase: 0 }, { kind: "tug", speed: 2, phase: 0.4 }, { kind: "barge", speed: 0.8, phase: 0.75 }];
export const FADE_U = 30, TURN_U = 20;
export const BEAM_PERIOD_MS = 8000, BEAM_LEN = 24, BEAM_INNER = 12, BEAM_HALF = (7 * Math.PI) / 180;
export const BUOY_PERIOD_MS = 2000;
export const NEON_STEP_MS = 200, COAST_PERIOD_MS = 3000, KEEPER_SIGN_MS = 4000;
const GALLERY_R_DOT = 0.45, GALLERY_LIT = 2;

// Lancha de la feria: hace la lanzadera entre la punta del muelle de la feria (`fair.ts`, bahía
// norte) y la orilla de la bahía frente al muelle de graneles. Los tres puntos están en agua
// (bayWater), y el punto norte amarra en el muelle de la feria (ver el ajuste de la Task 17 abajo).
//
// Ruling del controller (Task 8, fix): una recta entre los dos muelles no sirve porque la costa oeste
// de la bahía llega hasta x ≈ 277 cerca de y −204 (una saliente entre los dos muelles). Se agregó un
// punto intermedio que la rodea por el este. El punto sur se corrió 6 u más al este que el propuesto
// ((235, −84) → (241, −84)): entre el intermedio y el sur, cerca de (257, −126), la recta original
// volvía a tocar la misma costa (una segunda entrada, más al sur) y quedaba a menos de 6 u de tierra.
// Con el ajuste, `depthAt` mínimo a lo largo de toda la polilínea es exactamente 6 (en ese mismo punto).
//
// Ajuste de la Task 17 (regla de la Task 8): con la feria construida, la lancha queda detrás del
// pabellón del muelle (`fair.ts`, cono `copper`, entonces en (243, −277)) en pantalla —`isBehind(ferry,
// pabellón)` da `true`— cerca del punto norte, entre el 5 % y el 15 % del primer tramo. Alcanzaba
// con correr el punto norte 2 u al este para despejarlo, pero la regla pide pasos de 6 u: se corrió
// ((248, −288) → (254, −288)); no hay más superposición en ese tramo y `depthAt` en el punto sigue
// muy por encima de 6 (≈ 37).
//
// Con la feria corrida 36 u al sur (2026-09-16) el pabellón quedó en (268, −241) y el punto norte
// conserva el mismo desplazamiento (+11, −11) respecto de él: (279, −252). Verificado con la misma
// regla: `depthAt` mínimo a lo largo de la polilínea sigue siendo 6 y ningún sólido estático queda
// delante de la lancha en pantalla.
export const FERRY_ROUTE: readonly Vec2[] = [{ x: 279, y: -252 }, { x: 290, y: -212 }, { x: 241, y: -84 }];
export const FERRY_SPEED = 3, FERRY_PAUSE_MS = 4000;

const route = polyline(ROUTE);
export const routeLength = (): number => route.length;

const lerpAngle = (a: number, b: number, t: number): number => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

/** Punto y rumbo a `dist` unidades del inicio; el rumbo se interpola en los TURN_U alrededor de cada vértice. */
export function routeAt(dist: number): { x: number; y: number; heading: number } {
  const p = route.at(dist), seg = route.segs, i = p.seg, s = seg[i]!;
  const local = Math.hypot(p.x - s.a.x, p.y - s.a.y); // lo andado dentro del tramo: `at` no devuelve la acumulada
  let heading = s.heading;
  if (local < TURN_U / 2 && i > 0) heading = lerpAngle(seg[i - 1]!.heading, s.heading, 0.5 + local / TURN_U);
  else if (s.len - local < TURN_U / 2 && i < seg.length - 1) heading = lerpAngle(s.heading, seg[i + 1]!.heading, (TURN_U / 2 - (s.len - local)) / TURN_U);
  return { x: p.x, y: p.y, heading };
}

export interface ShipFrame { solids: Solid[]; lights: Accent[]; wake: Solid[]; alpha: number }
export interface SeaChanges { ships: boolean; beam: boolean; buoys: boolean; ferry: boolean; neon: boolean }
export interface SeaAnim {
  ship(k: number): ShipFrame;
  dist(k: number): number;
  alphaAt(dist: number): number;
  beam(): Accent[];
  buoys(): Accent[];
  ferry(): ShipFrame;
  neon(): Accent[];
  tick(dtMs: number): SeaChanges;
}

export function createSeaAnim(scene: SeaScene, opts: { reducedMotion: boolean }): SeaAnim {
  let clock = 0, buoyStep = 0, neonStep = 0;
  const L = routeLength();
  const dists = SHIPS.map((s) => s.phase * L);
  const alphaAt = (d: number): number => Math.max(0, Math.min(1, d / FADE_U, (L - d) / FADE_U));

  // La lancha camina FERRY_ROUTE sin suavizado de giro en los vértices (a diferencia de los barcos,
  // dobla en el momento): el rumbo es el del tramo actual, invertido cuando vuelve. `polyline.at` ya
  // recorta la distancia a las dos puntas, que es justo donde la lancha para.
  const ferryLine = polyline(FERRY_ROUTE);
  const ferryLen = ferryLine.length;
  const ferryPointAt = ferryLine.at;
  let ferryDist = 0, ferryDir = 1, ferryPause = FERRY_PAUSE_MS;
  const ferryFrame = (): ShipFrame => {
    const pt = ferryPointAt(ferryDist), p = { x: pt.x, y: pt.y }, heading = ferryDir > 0 ? pt.heading : pt.heading + Math.PI;
    const built = buildShip("ferry", p, heading);
    return { solids: built.solids, lights: built.lights, wake: [{ kind: "ground", mat: "foam", tris: wake("ferry", p, heading) }], alpha: 1 };
  };

  const shipFrame = (k: number): ShipFrame => {
    const p = routeAt(dists[k]!), alpha = alphaAt(dists[k]!);
    const built = buildShip(SHIPS[k]!.kind, p, p.heading);
    const wakeTris = wake(SHIPS[k]!.kind, p, p.heading);
    return { solids: built.solids, lights: built.lights, wake: [{ kind: "ground", mat: "foam", tris: wakeTris }], alpha };
  };

  const beamAngle = (): number => (opts.reducedMotion ? 0 : ((clock % BEAM_PERIOD_MS) / BEAM_PERIOD_MS) * Math.PI * 2);
  const wedge = (len: number, color: Accent["color"], alpha: number): Accent => {
    const a = beamAngle(), o: Vec3 = scene.lantern;
    return { kind: "poly", pts: [o, v3(o.x + len * Math.cos(a - BEAM_HALF), o.y + len * Math.sin(a - BEAM_HALF), o.z), v3(o.x + len * Math.cos(a + BEAM_HALF), o.y + len * Math.sin(a + BEAM_HALF), o.z)], color, alpha };
  };

  const buoyOn = (k: number): boolean => Math.floor((clock + k * (BUOY_PERIOD_MS / 2)) / (BUOY_PERIOD_MS / 2)) % 2 === 0;

  /** Galería, costa y cartel. Paso 0 (y reduced motion) = estado fijo encendido; la galería corre al revés del haz. */
  const neon = (): Accent[] => {
    const { gallery, coast, keeperSign } = scene.neon, at = neonStep * NEON_STEP_MS;
    const on = chase(gallery.length, -neonStep, GALLERY_LIT);
    return [
      ...gallery.filter((_, k) => on[k]).map((p): Accent => ({ kind: "dot", at: p, r: GALLERY_R_DOT, color: "magenta" })),
      ...coast.map((p, k): Accent => ({ kind: "dot", at: p, r: 0.3 + 0.3 * (neonStep === 0 ? 1 : pulse(at, COAST_PERIOD_MS, k / coast.length)), color: "cyan" })),
      { ...keeperSign, color: flip(Math.floor(at / KEEPER_SIGN_MS), "cyan", "magenta") },
    ];
  };

  return {
    ship: shipFrame,
    dist: (k) => dists[k]!,
    alphaAt,
    beam: () => [wedge(BEAM_LEN, "amberBleed", 0.5), wedge(BEAM_INNER, "amber", 0.6)],
    buoys: () => scene.buoys.flatMap((b, k) => (buoyOn(k) ? [{ kind: "dot" as const, at: v3(b.x, b.y, b.z + 0.3), r: 0.8, color: "magentaMid" as const }] : [])),
    ferry: ferryFrame,
    neon,
    tick(dtMs) {
      const none: SeaChanges = { ships: false, beam: false, buoys: false, ferry: false, neon: false };
      if (opts.reducedMotion || dtMs <= 0) return none;
      clock += dtMs;
      const c: SeaChanges = { ships: true, beam: true, buoys: false, ferry: false, neon: false };
      for (let k = 0; k < SHIPS.length; k++) { dists[k] = dists[k]! + (SHIPS[k]!.speed * dtMs) / 1000; if (dists[k]! >= L) dists[k] = dists[k]! - L; }
      const bs = Math.floor(clock / (BUOY_PERIOD_MS / 2));
      if (bs !== buoyStep) { buoyStep = bs; c.buoys = true; }
      if (ferryPause > 0) ferryPause -= dtMs;
      else {
        ferryDist += (ferryDir * FERRY_SPEED * dtMs) / 1000; c.ferry = true;
        if (ferryDist >= ferryLen) { ferryDist = ferryLen; ferryDir = -1; ferryPause = FERRY_PAUSE_MS; }
        else if (ferryDist <= 0) { ferryDist = 0; ferryDir = 1; ferryPause = FERRY_PAUSE_MS; }
      }
      const ns = Math.floor(clock / NEON_STEP_MS);
      if (ns !== neonStep) { neonStep = ns; c.neon = true; }
      return c;
    },
  };
}
