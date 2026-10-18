import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { createRng, type Rng } from "../map/seed";
import type { CityScene } from "./city";
import { chase } from "./neon";

/**
 * Las animaciones de la ciudad, sin Pixi y con estado propio: el piso
 * encendido parpadea (se apaga un tick cada 4..9 s), papeles salen volando de
 * una ventana hacia el NNE, la luz de la antena pulsa y los neones del distrito
 * cambian: un cartel cada 3..7 s (de tiempo de pared) cambia de color o se apaga un paso, y dos luces
 * corren por el malecón. Frame 0 = todo quieto y encendido; con reduced-motion
 * se queda ahí.
 */
export const BLINK_GAP_MS: [number, number] = [4000, 9000];
export const PAPER_SPEED = 4 / 1000; // u por ms
export const PAPER_RANGE = 30;
export const PAPER_AMP = 1.5;
export const PAPER_PERIOD_MS = 2000;
export const ANTENNA_STEP_MS = 100;
export const PAPER_R = 0.4, PAPER_R_END = 0.12; // el papel se afina en el último tercio, así no hay "pop" al reciclar
export const PAPER_FADE_FROM = 2 / 3; // fracción de PAPER_RANGE donde empieza a afinarse
export const PAPER_LIFT = 0.15; // z que gana por unidad recorrida (el viento lo levanta)
export const PAPER_SIDE = 1.5; // desvío lateral máximo, perpendicular a la deriva
export const PAPER_SIDE_RAMP = 5; // en cuántas unidades entra del todo el desvío
export const NEON_STEP_MS = 150; // lo que dura un apagón de cartel
export const SIGN_GAP_MS: [number, number] = [3000, 7000];
const SEED_MAX = 2 ** 32 - 1; // semilla de un Rng derivado (sin literal 0x…: el guard de paleta lo tomaría por color)
export const MALECON_STEP_MS = 250;
export const MALECON_R = 0.35;
const ANTENNA_BASE_R = 0.8, ANTENNA_PULSE_R = 0.3, ANTENNA_PERIOD = 1200; // r = 0.8 + 0.3·(1 + sin(t / 1200))
const NNE = { x: 0.45, y: -0.893 }; // unidad: nor-noreste (y crece al sur); en pantalla sube a la derecha
const PERP = { x: -NNE.y, y: NNE.x }; // perpendicular a la deriva: abre el abanico

export interface CityAnimChanges { lit: boolean; papers: boolean; antenna: boolean; neon: boolean }
export interface CityAnim { lit(): Accent[]; papers(): Accent[]; antenna(): Accent; neon(): Accent[]; tick(dtMs: number): CityAnimChanges; fired(): { lit: number; neon: number } }

const NONE: CityAnimChanges = { lit: false, papers: false, antenna: false, neon: false };

export function createCityAnim(tower: CityScene["tower"], neon: CityScene["neon"], rng: Rng, opts: { reducedMotion: boolean }): CityAnim {
  const w = tower.paperWindow;
  // flujo propio: compartir `rng` con los papeles haría que la pausa sorteada dependa del troceo
  const blinkRng = createRng(rng.int(0, SEED_MAX));
  const nextGap = (): number => blinkRng.int(BLINK_GAP_MS[0], BLINK_GAP_MS[1]);

  let clock = 0;
  let off = false;
  let blinkTimer = nextGap();
  let antennaStep = 0;
  interface Paper { dist: number; phase: number; side: number; speed: number }
  const respawn = (p: Paper): void => {
    p.dist = 0;
    p.phase = rng.next() * Math.PI * 2;
    p.side = (rng.next() * 2 - 1) * PAPER_SIDE;
    p.speed = 0.8 + rng.next() * 0.4;
  };
  // escalonados de arranque: el papel i nace ya a (i / n)·PAPER_RANGE de la
  // ventana, así el frame 0 (y reduced-motion) muestra un reguero y no un punto.
  const n = rng.int(5, 8);
  const papers: Paper[] = Array.from({ length: n }, (_, i) => {
    const p: Paper = { dist: 0, phase: 0, side: 0, speed: 1 };
    respawn(p);
    p.dist = (i / n) * PAPER_RANGE;
    return p;
  });
  // neones: van después del estado de los papeles para no reordenar sus tiradas
  const signs = neon.signs.map((a) => ({ a, color: a.color, offUntil: -1 }));
  const signRng = createRng(rng.int(0, SEED_MAX)); // flujo propio, por lo mismo que blinkRng
  let signTimer = signRng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
  let maleconStep = 0;
  let blinks = 0, signEvents = 0; // disparos desde la construcción, para fired()

  const paperAt = (p: Paper): Accent => {
    const lateral = p.side * Math.min(1, p.dist / PAPER_SIDE_RAMP);
    const wave = p.dist === 0 ? 0 : PAPER_AMP * Math.sin((clock / PAPER_PERIOD_MS) * Math.PI * 2 + p.phase);
    const fade = Math.max(0, p.dist / PAPER_RANGE - PAPER_FADE_FROM) / (1 - PAPER_FADE_FROM);
    return {
      kind: "dot",
      at: v3(w.x + NNE.x * p.dist + PERP.x * lateral, w.y + NNE.y * p.dist + PERP.y * lateral, w.z + wave + p.dist * PAPER_LIFT),
      r: PAPER_R + (PAPER_R_END - PAPER_R) * Math.min(1, fade),
      color: "amberMid",
    };
  };
  const antennaR = (): number => ANTENNA_BASE_R + ANTENNA_PULSE_R * (1 + Math.sin((antennaStep * ANTENNA_STEP_MS) / ANTENNA_PERIOD));

  return {
    lit: () => (off ? [] : [...tower.litWindows]), // copia: el consumidor no puede tocar la escena
    papers: () => papers.map(paperAt),
    antenna: () => ({ kind: "dot", at: tower.antenna, r: antennaR(), color: "amberMid" }),
    neon: () => {
      const on = signs.filter((s) => s.offUntil <= clock).map((s) => ({ ...s.a, color: s.color }));
      const lit = maleconStep === 0 ? null : chase(neon.malecon.length, maleconStep, 2);
      const lights = neon.malecon.filter((_, k) => !lit || lit[k]).map((at): Accent => ({ kind: "dot", at, r: MALECON_R, color: "cyanMid" }));
      return [...on, ...lights];
    },
    fired: () => ({ lit: blinks, neon: signEvents }),
    tick(dtMs) {
      if (opts.reducedMotion || dtMs <= 0) return NONE;
      clock += dtMs;
      const c: CityAnimChanges = { lit: false, papers: true, antenna: false, neon: false };

      // parpadeo: un tick apagado; la pausa siguiente cuenta desde el disparo, y un tick largo puede disparar varios
      if (off) { off = false; c.lit = true; }
      blinkTimer -= dtMs;
      while (blinkTimer <= 0) { blinkTimer += nextGap(); blinks++; off = true; c.lit = true; }

      for (const p of papers) {
        p.dist += PAPER_SPEED * p.speed * dtMs;
        if (p.dist >= PAPER_RANGE) respawn(p);
      }

      const step = Math.floor(clock / ANTENNA_STEP_MS);
      if (step !== antennaStep) { antennaStep = step; c.antenna = true; }

      for (const s of signs) if (s.offUntil >= 0 && clock >= s.offUntil) { s.offUntil = -1; c.neon = true; } // vuelve el tubo
      signTimer -= dtMs;
      while (signTimer <= 0 && signs.length > 0) { // un tick largo puede traer varios eventos
        const s = signs[signRng.int(0, signs.length - 1)]!;
        if (signRng.chance(0.5)) s.color = s.color === "cyan" ? "magenta" : "cyan";
        else if (s.offUntil < 0) s.offUntil = clock + NEON_STEP_MS;
        signTimer += signRng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
        signEvents++;
        c.neon = true; // un cambio de color o un apagón siempre se ve (SIGN_GAP_MS ≥ 3000 > NEON_STEP_MS)
      }
      const mStep = Math.floor(clock / MALECON_STEP_MS);
      if (mStep !== maleconStep) { maleconStep = mStep; c.neon = true; }
      return c;
    },
  };
}
