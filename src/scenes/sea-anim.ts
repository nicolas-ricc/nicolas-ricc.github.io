import type { Accent } from "../iso/accent";
import { polyline, v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { SeaScene } from "./sea";
import { chase, flip, pulse } from "./neon";
import { ship as buildShip, shipAt, wake, type ShipKind } from "./ships";

/**
 * Blog animado, sin Pixi: tres barcos que zarpan del fondeadero de la bocana,
 * rodean la boya y el pecio por el este, cruzan la fosa y salen del cover por
 * abajo-izquierda, sus estelas y luces, el haz ámbar del faro (luz cálida, no
 * neón) y las dos boyas, más los neones de la punta: la galería corre al revés
 * del haz, la costa ondula y el cartel del farero alterna. El agua en sí
 * (repartida por profundidad en `terrain.ts`) no es asunto de acá: la anima
 * `water-animator.ts`. Spec §7.
 */
// Carril de ida: el camino del CENTRO del casco (ver `shipAt` en ships.ts), así los tres tamaños
// de barco comparten el mismo fondeadero en vez de que cada uno arranque con la popa en otro lado.
//
// Fondea en BERTH (362, -2), en la bocana: 36 u al este y 22 al sur de la vieja popa (326, -24), para
// que el barco pueda girar sin pisar la selva (x 332..340, y ≥ 50) ni quedar detrás en pantalla de los
// galpones del muelle de alistamiento (x 304..324, y ≥ 24). No hay muelle: el barco aparece ahí.
//
// Sale casi al este (tramo hasta (500, 20)) porque la caja de alineación del test de profundidad
// (60 u de eslora, z -1..13) es mucho más ancha en pantalla que la silueta cuando la proa va en
// diagonal, y una salida diagonal da falsos positivos de `isBehind` con la boya (420, 80) y el
// arrecife (≈ 405, 111); casi horizontal, la caja es angosta en y. Después baja por x ≥ 500 hasta
// y 180 para rodear la boya y el pecio por el este, lejos de la punta (Portfolio), en agua de Blog
// y cruzando la fosa. Recién al sur de y 180 vira al sur-suroeste, porque abajo-izquierda en
// pantalla es +y, levemente -x.
//
// Termina fuera del cover 16:9 (376, 640) para que el barco no se desvanezca a la vista: el
// desvanecido ocurre en el sangrado. Validado contra agua, `depthAt` ≥ 6, `worldZoneAt === "blog"`
// para x ≥ 380, `isBehind` con la caja del carguero y `coverQuad(16/9)`: no mover vértices más de
// 2 u sin revalidar.
export const LANE_OUT: readonly Readonly<Vec2>[] = [{ x: 362, y: -2 }, { x: 500, y: 20 }, { x: 515, y: 120 }, { x: 520, y: 180 }, { x: 480, y: 290 }, { x: 420, y: 470 }, { x: 376, y: 640 }];
export const BERTH: Readonly<Vec2> = LANE_OUT[0]!;
export const SHIPS: readonly { kind: ShipKind; phase: number }[] = [{ kind: "cargo", phase: 0 }, { kind: "tug", phase: 1 / 3 }, { kind: "barge", phase: 2 / 3 }];
// Velocidad única: con velocidades distintas un barco alcanzaría al de adelante en el mismo carril y se superpondrían.
export const LANE_SPEED = 1.2;
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

const route = polyline(LANE_OUT);
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
    const kind = SHIPS[k]!.kind, at = shipAt(kind, p, p.heading);
    const built = buildShip(kind, at, p.heading);
    const wakeTris = wake(kind, at, p.heading);
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
      for (let k = 0; k < SHIPS.length; k++) { dists[k] = dists[k]! + (LANE_SPEED * dtMs) / 1000; if (dists[k]! >= L) dists[k] = dists[k]! - L; }
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
