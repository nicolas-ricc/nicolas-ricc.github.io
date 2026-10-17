import type { Accent } from "../iso/accent";
import { polyline, v3, type Polyline, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { SeaScene } from "./sea";
import { chase, flip, pulse } from "./neon";
import { ship as buildShip, shipAt, wake, type ShipKind } from "./ships";

/**
 * Blog animado, sin Pixi: tres barcos con ciclo propio, sus estelas y luces, el haz
 * ámbar del faro (luz cálida, no neón) y las dos boyas, más los neones de la punta:
 * la galería corre al revés del haz, la costa ondula y el cartel del farero alterna.
 *
 * Dos carriles: la ida (`LANE_OUT`) zarpa del fondeadero `BERTH` de la dársena del astillero, sube
 * la bahía hasta la bocana, rodea la boya y el pecio por el este y sale del cover por abajo-izquierda;
 * la vuelta (`LANE_BACK`) entra desde abajo, llega a la bocana por el noreste, cruza la bahía al norte
 * de la salida y baja pegada al muelle hasta el mismo fondeadero. En `BERTH` el barco se queda
 * `BERTH_MS` y gira en el lugar entre los 8 y 16 s, del rumbo de llegada al de salida. Cada barco rota
 * `out → offscreen (OFF_MS) → back → offscreen (PORT_MS)`, sin giro en el lugar ni fondeadero, con la misma velocidad y el barco k en la fase k·T/3 del
 * período T = `CYCLE_MS` (≈ 1805 s). El agua en sí (repartida por profundidad en `terrain.ts`) no es
 * asunto de acá: la anima `water-animator.ts`. Spec §7; puerto de salida decidido en #83.
 */
// Carril de ida: el camino del CENTRO del casco (ver `shipAt` en ships.ts), así los tres tamaños
// de barco comparten el mismo fondeadero en vez de que cada uno arranque con la popa en otro lado.
//
// Fondea en BERTH (232, 50), en la dársena del astillero (#83): frente a las gradas, entre el muelle
// (`QUAY_X` 198..202) y la escollera de la orilla este (conos de roca desde x ≈ 271). El carguero gira en
// el lugar con radio 30.4 (media eslora y media manga), así que el centro tiene que quedar a más de 30 u
// del muelle y de la escollera: 232 deja 29.6 u al muelle (la proa no lo pisa en ningún rumbo del arco
// corto, que pasa por el este) y 39 u a la escollera.
//
// La única salida al mar es la bocana (`MOUTH_Y` en geo.ts): el río al sur de la dársena lo cierra el
// muelle de la ciudad. Sale hacia el nornoreste (tramo hasta (256, −8)), cruza la bahía casi al este
// por y ≈ −8..−16 para pasar al norte de los galpones del muelle de alistamiento (x 304..324, y ≥ 24),
// que de otro modo la taparían en pantalla, y toma la bocana en (362, −16). Desde ahí baja por x ≥ 500
// hasta y 180 para rodear la boya y el pecio por el este, lejos de la punta (Portfolio), en agua de Blog
// y cruzando la fosa. Recién al sur de y 180 vira al sur-suroeste, porque abajo-izquierda en pantalla
// es +y, levemente -x. Ese tramo es el validado en #63 y no se movió.
//
// Termina fuera del cover 16:9 (376, 640) para que el barco no se desvanezca a la vista: el
// desvanecido ocurre en el sangrado. Validado contra agua, `depthAt` ≥ 6, `worldZoneAt === "blog"`
// para x ≥ 380, oclusión por sólidos estáticos (hexágono proyectado de la caja del carguero contra el de
// cada sólido, ver sea-anim.test.ts) y `coverQuad(16/9)`: no mover vértices más de 2 u sin revalidar.
export const LANE_OUT: readonly Readonly<Vec2>[] = [{ x: 232, y: 50 }, { x: 256, y: -8 }, { x: 362, y: -16 }, { x: 500, y: 20 }, { x: 515, y: 120 }, { x: 520, y: 180 }, { x: 480, y: 290 }, { x: 420, y: 470 }, { x: 376, y: 640 }];
// Carril de vuelta, en el sentido de marcha (mar → fondeadero): el tramo de mar corre ~56 u al este del
// de ida y llega a la bocana por el noreste, por encima de la salida; cruza la bahía por y ≈ −50..−70,
// al norte del tramo de salida y sin cruzarlo (la ida va por el lado este de la dársena y la vuelta por
// el del muelle, así las dos polilíneas no se cortan), dobla al sur en (242, −60) —la proa del carguero
// con rumbo oeste queda a 30 u del centro, por eso no se dobla más cerca del muelle— y baja por x ≈ 212
// hasta el fondeadero. El extremo sur de la lancha (`FERRY_ROUTE`, (241, −84)) queda 24 u al norte del
// cruce. Validado igual que la ida y además con las siluetas de dos cargueros, uno por carril, que no
// se tocan en pantalla fuera de los 200 u (sumando distancias) más cercanos al fondeadero: no mover
// vértices más de 2 u sin revalidar.
export const LANE_BACK: readonly Readonly<Vec2>[] = [{ x: 430, y: 655 }, { x: 471, y: 487 }, { x: 533, y: 309 }, { x: 575, y: 199 }, { x: 571, y: 114 }, { x: 562, y: 13 }, { x: 552, y: -50 }, { x: 400, y: -50 }, { x: 300, y: -70 }, { x: 242, y: -60 }, { x: 212, y: -14 }, { x: 232, y: 50 }];
export const SHIPS: readonly { kind: ShipKind; phase: number }[] = [{ kind: "cargo", phase: 0 }, { kind: "tug", phase: 1 / 3 }, { kind: "barge", phase: 2 / 3 }];
// Velocidad única: con velocidades distintas un barco alcanzaría al de adelante en el mismo carril y se superpondrían.
export const LANE_SPEED = 1.2;
export const FADE_U = 30, TURN_U = 20;
export const OFF_MS = 15000, PORT_MS = 30000;
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

export type Lane = "out" | "back";
const lanes: Record<Lane, Polyline> = { out: polyline(LANE_OUT), back: polyline(LANE_BACK) };
export const laneLength = (lane: Lane): number => lanes[lane].length;

const lerpAngle = (a: number, b: number, t: number): number => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

/** Punto y rumbo a `dist` unidades del inicio del carril; el rumbo se interpola en los TURN_U alrededor de cada vértice. */
export function laneAt(lane: Lane, dist: number): { x: number; y: number; heading: number } {
  const route = lanes[lane], p = route.at(dist), seg = route.segs, i = p.seg, s = seg[i]!;
  const local = Math.hypot(p.x - s.a.x, p.y - s.a.y); // lo andado dentro del tramo: `at` no devuelve la acumulada
  let heading = s.heading;
  if (local < TURN_U / 2 && i > 0) heading = lerpAngle(seg[i - 1]!.heading, s.heading, 0.5 + local / TURN_U);
  else if (s.len - local < TURN_U / 2 && i < seg.length - 1) heading = lerpAngle(s.heading, seg[i + 1]!.heading, (TURN_U / 2 - (s.len - local)) / TURN_U);
  return { x: p.x, y: p.y, heading };
}

export type ShipLane = Lane | "offscreen";
export interface ShipState { lane: ShipLane; dist: number; heading: number }

const OUT_MS = (laneLength("out") / LANE_SPEED) * 1000, BACK_MS = (laneLength("back") / LANE_SPEED) * 1000;
export const CYCLE_MS = OUT_MS + OFF_MS + BACK_MS + PORT_MS;
const OUT_END_HEADING = laneAt("out", laneLength("out")).heading, BACK_END_HEADING = laneAt("back", laneLength("back")).heading;

/** Estado de un barco a `ms` del inicio de su ciclo (`0 ≤ ms < CYCLE_MS`): ida, fuera de cámara, vuelta, en puerto (fuera de cámara). */
export function shipStateAt(ms: number): ShipState {
  if (ms < OUT_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "out", dist, heading: laneAt("out", dist).heading }; }
  ms -= OUT_MS;
  if (ms < OFF_MS) return { lane: "offscreen", dist: laneLength("out"), heading: OUT_END_HEADING };
  ms -= OFF_MS;
  if (ms < BACK_MS) { const dist = (ms / 1000) * LANE_SPEED; return { lane: "back", dist, heading: laneAt("back", dist).heading }; }
  return { lane: "offscreen", dist: laneLength("back"), heading: BACK_END_HEADING };
}

/** Desvanecido de FADE_U en las dos puntas de cada carril; fuera de cámara, 0. */
export function alphaAt(lane: ShipLane, dist: number): number {
  if (lane === "offscreen") return 0;
  return Math.max(0, Math.min(1, dist / FADE_U, (laneLength(lane) - dist) / FADE_U));
}

export interface ShipFrame { solids: Solid[]; lights: Accent[]; wake: Solid[]; alpha: number; heading?: number }
export interface SeaChanges { ships: boolean; beam: boolean; buoys: boolean; ferry: boolean; neon: boolean }
export interface SeaAnim {
  ship(k: number): ShipFrame;
  state(k: number): ShipState;
  beam(): Accent[];
  buoys(): Accent[];
  ferry(): ShipFrame;
  neon(): Accent[];
  tick(dtMs: number): SeaChanges;
}

export function createSeaAnim(scene: SeaScene, opts: { reducedMotion: boolean }): SeaAnim {
  let clock = 0, buoyStep = 0, neonStep = 0;
  const cycle = SHIPS.map((s) => s.phase * CYCLE_MS);
  const states = cycle.map(shipStateAt);

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
    const s = states[k]!;
    if (s.lane === "offscreen") return { solids: [], lights: [], wake: [], alpha: 0 };
    const p = laneAt(s.lane, s.dist);
    const kind = SHIPS[k]!.kind, at = shipAt(kind, p, s.heading);
    const built = buildShip(kind, at, s.heading);
    const wakeTris = [{ kind: "ground" as const, mat: "foam" as const, tris: wake(kind, at, s.heading) }];
    return { solids: built.solids, lights: built.lights, wake: wakeTris, alpha: alphaAt(s.lane, s.dist), heading: s.heading };
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
    state: (k) => states[k]!,
    beam: () => [wedge(BEAM_LEN, "amberBleed", 0.5), wedge(BEAM_INNER, "amber", 0.6)],
    buoys: () => scene.buoys.flatMap((b, k) => (buoyOn(k) ? [{ kind: "dot" as const, at: v3(b.x, b.y, b.z + 0.3), r: 0.8, color: "magentaMid" as const }] : [])),
    ferry: ferryFrame,
    neon,
    tick(dtMs) {
      const none: SeaChanges = { ships: false, beam: false, buoys: false, ferry: false, neon: false };
      if (opts.reducedMotion || dtMs <= 0) return none;
      clock += dtMs;
      const c: SeaChanges = { ships: true, beam: true, buoys: false, ferry: false, neon: false };
      for (let k = 0; k < SHIPS.length; k++) { cycle[k] = (cycle[k]! + dtMs) % CYCLE_MS; states[k] = shipStateAt(cycle[k]!); }
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
