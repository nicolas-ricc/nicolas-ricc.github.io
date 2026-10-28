import { WEST_RAIL_X0 } from "./hinterland";
import { STREET_EDGE } from "./shipyard";
import { CROSSING, SIGNALS, STOP_X, TRACKS_Y } from "./station";
import { trainLen } from "./train";

/**
 * Estación animada, sin Pixi: el EMU de cuatro coches entra por el oeste por la vía 3, frena y
 * para con el frente en `STOP_X`, espera, sale hacia el oeste y se pierde; después la vía queda
 * vacía un rato. El ciclo es `in → dwell → out → off`, de `CYCLE_MS` (≈ 101,7 s).
 *
 * Todo sale de fórmulas cerradas por tramos (nada se integra): el tiempo del ciclo alcanza para
 * saber dónde está el tren, de modo que el estado es una función pura de `ms` y no hay nada que
 * acumular ni sortear. Entrada: crucero de `LINE_SPEED` hasta `STOP_X − BRAKE_U` (500 u) y frenado
 * uniforme en 5 s (a = 4,8 u/s²) hasta parar justo en el tope. Salida: simétrica, la formación
 * acelera 60 u en 5 s y hace crucero otras 500 u hasta que la cola llega a `ENTRY_X` (el
 * mismo borde del que entró), ya invisible. El `alpha` sube en los primeros `FADE_U` u del frente
 * y baja en los últimos, así que el tren aparece y desaparece sin cortes dentro del sangrado.
 *
 * Paso a nivel y semáforos cuelgan del mismo estado. El paso a nivel parpadea mientras la
 * formación corta la ventana de `CROSSING` ampliada `CROSSING_NEAR_U` a cada lado, y en la espera
 * solo los últimos `PRE_DEPART_MS` (aviso de partida). Desvío del spec §7: ahí el paso a nivel
 * seguiría titilando toda la espera, pero con el tren parado 30 s sería ruido sin información;
 * queda a oscuras salvo los últimos 5 s. La entrada se pone roja apenas el frente pasa su poste;
 * la salida, verde desde 5 s antes de partir hasta que la cola deja la calle (`STREET_EDGE`).
 * Lo demás, rojo.
 */
export const ENTRY_X = WEST_RAIL_X0;
export const LINE_SPEED = 24;       // u/s en crucero
export const BRAKE_U = 60;          // distancia de frenado (y de arranque) antes de STOP_X
export const DWELL_MS = 30000, OFF_MS = 20000;
export const FADE_U = 30;
export const BLINK_MS = 500;
export const CROSSING_NEAR_U = 30;
export const PRE_DEPART_MS = 5000;
export const TRACK_Y = TRACKS_Y[2];
export const LEN = trainLen(4);

const CRUISE_U = STOP_X - BRAKE_U - ENTRY_X;                 // 500 u
const BRAKE_MS = 2 * BRAKE_U / LINE_SPEED * 1000;            // 5000 ms: v pasa de 24 a 0 en 60 u
const BRAKE_A = LINE_SPEED * LINE_SPEED / (2 * BRAKE_U) / 1e6; // 4,8 u/s² en u/ms²
const CRUISE_MS = CRUISE_U / LINE_SPEED * 1000;              // 20 833,3 ms
export const IN_MS = CRUISE_MS + BRAKE_MS;
export const OUT_MS = IN_MS;
export const CYCLE_MS = IN_MS + DWELL_MS + OUT_MS + OFF_MS;

export type Phase = "in" | "dwell" | "out" | "off";
export type Aspect = "red" | "green";
export interface TrainState { phase: Phase; x0: number; lead: "e" | "w"; alpha: number }

const START: Record<Phase, number> = { in: 0, dwell: IN_MS, out: IN_MS + DWELL_MS, off: IN_MS + DWELL_MS + OUT_MS };
/** Ms del ciclo en que arranca la fase. */
export const phaseStart = (phase: Phase): number => START[phase];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
// EPS: el ciclo se arma con sumas de floats; un frente a menos de 1e-6 u de ENTRY_X ya es "en el borde" (alpha 0 exacto; al final de `out` el error de float daba ~8e-10)
const EPS = 1e-6;
const fade = (front: number): number => (front - ENTRY_X <= EPS ? 0 : clamp01((front - ENTRY_X) / FADE_U));
const DWELL_X0 = STOP_X - LEN, END_X0 = ENTRY_X - LEN;

/** Distancia recorrida desde que el tren está parado en un frenado (o arranque) de `t` ms, 0..BRAKE_U. */
const brakeU = (t: number): number => LINE_SPEED * t / 1000 - BRAKE_A * t * t / 2;

/** Estado del tren a `ms` del ciclo (0 ≤ ms < CYCLE_MS). `x0` es el extremo oeste: en `in`/`dwell` el frente es `x0 + LEN`; en `out` el frente es `x0` y la cola `x0 + LEN`. */
export function trainStateAt(ms: number): TrainState {
  if (ms < IN_MS) {
    const front = ms < CRUISE_MS ? ENTRY_X + LINE_SPEED * ms / 1000 : STOP_X - BRAKE_U + brakeU(ms - CRUISE_MS);
    return { phase: "in", x0: front - LEN, lead: "e", alpha: fade(front) };
  }
  if (ms < START.out) return { phase: "dwell", x0: DWELL_X0, lead: "e", alpha: 1 };
  if (ms < START.off) {
    const t = ms - START.out;
    // arranque simétrico del frenado: 60 u acelerando y después crucero; la cola es x0 + LEN (el frente va al oeste)
    const run = t < BRAKE_MS ? BRAKE_U - brakeU(BRAKE_MS - t) : BRAKE_U + LINE_SPEED * (t - BRAKE_MS) / 1000;
    const x0 = DWELL_X0 - run;
    return { phase: "out", x0, lead: "w", alpha: fade(x0 + LEN) };
  }
  return { phase: "off", x0: END_X0, lead: "w", alpha: 0 };
}

/** ¿Parpadea el paso a nivel? `msInPhase` son los ms desde `phaseStart(s.phase)`. */
export function crossingActive(s: TrainState, msInPhase: number): boolean {
  if (s.phase === "off") return false;
  // parado, el tren siempre corta [70, 138]: solo manda el aviso de partida
  if (s.phase === "dwell") return msInPhase >= DWELL_MS - PRE_DEPART_MS - EPS;
  const a = CROSSING.x0 - CROSSING_NEAR_U, b = CROSSING.x1 + CROSSING_NEAR_U;
  return s.x0 <= b && s.x0 + LEN >= a;
}

/** Aspecto de los dos semáforos: entrada (poste en x 96) y salida (x 118, que se despeja en `STREET_EDGE`). */
export function signalAspects(s: TrainState, msInPhase: number): { in: Aspect; out: Aspect } {
  const east = s.x0 + LEN; // frente en `in`, cola en `out`
  const inGreen = s.phase === "in" && east < SIGNALS.in.x;
  const outGreen = (s.phase === "dwell" && msInPhase >= DWELL_MS - PRE_DEPART_MS - EPS) || (s.phase === "out" && east >= STREET_EDGE);
  return { in: inGreen ? "green" : "red", out: outGreen ? "green" : "red" };
}

