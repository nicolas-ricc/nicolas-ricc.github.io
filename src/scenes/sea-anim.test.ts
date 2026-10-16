import { describe, expect, it } from "vitest";
import { depthAt } from "./depth-map";
import type { Accent } from "../iso/accent";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { convexHull, v3, type Vec2 } from "../iso/geometry";
import { project } from "../iso/project";
import { bounds, hullRings, isFlat } from "../iso/solids";
import { WORLD, inCoverQuad, worldZoneAt } from "../map/geo";
import { BEAM_PERIOD_MS, BERTH, BERTH_MS, BERTH_TURN_MS, CYCLE_MS, FADE_U, FERRY_PAUSE_MS, FERRY_ROUTE, FERRY_SPEED, KEEPER_SIGN_MS, LANE_BACK, LANE_OUT, LANE_SPEED, NEON_STEP_MS, OFF_MS, SHIPS, alphaAt, createSeaAnim, laneAt, laneLength } from "./sea-anim";
import { ship, shipAt } from "./ships";
import { bleedTerrainAt, terrainAt } from "./terrain";
import { world } from "./world";

const WATER = new Set(["water", "sea", "shore", "abyss"]);
const setup = (reducedMotion = false) => { const w = world(7); return { w, a: createSeaAnim(w.sea!, { reducedMotion }) }; };

describe("ruta", () => {
  it("LANE_OUT nace en BERTH (dentro del cover) y termina fuera del cover; agua, profundidad ≥ 6, Blog para x ≥ 380, cruza la fosa", () => {
    expect(LANE_OUT[0]).toEqual(BERTH);
    expect(BERTH).toEqual({ x: 362, y: -2 });
    expect(inCoverQuad(BERTH.x, BERTH.y)).toBe(true);
    const end = LANE_OUT[LANE_OUT.length - 1]!;
    expect(inCoverQuad(end.x, end.y)).toBe(false);
    const L = laneLength("out");
    expect(Math.abs(L - 783)).toBeLessThan(5); // ≈ 783.45; holgura para mover vértices hasta 2 u
    let crossedAbyss = false;
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("out", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      if (t === "abyss") crossedAbyss = true;
    }
    expect(crossedAbyss).toBe(true);
    expect(laneAt("out", 0).heading).toBeCloseTo(Math.atan2(22, 138), 6); // sale casi al este por la bocana
  });

  it("ningún punto del carril queda detrás de un sólido estático que se le superponga en pantalla", () => {
    const w = world(7);
    const statics = w.solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    for (let d = 0; d <= laneLength("out"); d += 4) {
      const p = laneAt("out", d);
      const parts = ship("cargo", shipAt("cargo", p, p.heading), p.heading).solids.map(bounds);
      const sb = { min: { x: Math.min(...parts.map((b) => b.min.x)), y: Math.min(...parts.map((b) => b.min.y)), z: -1 }, max: { x: Math.max(...parts.map((b) => b.max.x)), y: Math.max(...parts.map((b) => b.max.y)), z: 13 } };
      const scr = screenBounds(sb);
      for (const s of statics) if (overlaps(scr, s.sb)) expect(isBehind(sb, s.b)).toBe(false);
    }
  });

  it("el barco se dibuja centrado en el carril: el casco nace en shipAt(kind, laneAt(lane, d))", () => {
    const { a } = setup();
    for (const k of [0, 1, 2]) {
      const s = a.state(k);
      if (s.lane !== "out" && s.lane !== "back") throw new Error(`barco ${k} fuera de los carriles en el frame 0: ${s.lane}`);
      const p = laneAt(s.lane, s.dist), at = shipAt(SHIPS[k]!.kind, p, s.heading);
      const hull = a.ship(k).solids.find((s) => s.kind === "hull")!;
      expect(hull.kind === "hull" && hull.at.x).toBeCloseTo(at.x, 6);
      expect(hull.kind === "hull" && hull.at.y).toBeCloseTo(at.y, 6);
    }
  });
});

const inWorld = (x: number, y: number) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;

type Static = { b: ReturnType<typeof bounds>; sb: ReturnType<typeof screenBounds> };
const expectNotBehind = (statics: Static[], p: { x: number; y: number }, heading: number): void => {
  const parts = ship("cargo", shipAt("cargo", p, heading), heading).solids.map(bounds);
  const sb = { min: { x: Math.min(...parts.map((b) => b.min.x)), y: Math.min(...parts.map((b) => b.min.y)), z: -1 }, max: { x: Math.max(...parts.map((b) => b.max.x)), y: Math.max(...parts.map((b) => b.max.y)), z: 13 } };
  const scr = screenBounds(sb);
  for (const s of statics) if (overlaps(scr, s.sb)) expect(isBehind(sb, s.b)).toBe(false);
};

/** Silueta convexa en pantalla de un carguero centrado en `p`: anillo de cubierta proyectado a z −1 y z 13. */
const silhouette = (p: { x: number; y: number }, heading: number): Vec2[] => {
  const hull = ship("cargo", shipAt("cargo", p, heading), heading).solids.find((s) => s.kind === "hull")!;
  if (hull.kind !== "hull") throw new Error("sin casco");
  return convexHull(hullRings(hull).deck.flatMap((q) => [project(v3(q.x, q.y, -1)), project(v3(q.x, q.y, 13))]));
};
/** SAT entre dos polígonos convexos: se intersecan si ningún eje (normal de un lado) los separa. */
const intersects = (a: Vec2[], b: Vec2[]): boolean => {
  const axes = [a, b].flatMap((poly) => poly.map((p, i) => { const q = poly[(i + 1) % poly.length]!; return { x: p.y - q.y, y: q.x - p.x }; }));
  return axes.every((n) => {
    const pa = a.map((p) => p.x * n.x + p.y * n.y), pb = b.map((p) => p.x * n.x + p.y * n.y);
    return Math.max(...pa) >= Math.min(...pb) && Math.max(...pb) >= Math.min(...pa);
  });
};

describe("dos carriles", () => {
  it("LANE_BACK nace fuera del cover y termina en BERTH; agua, profundidad ≥ 6, Blog para x ≥ 380", () => {
    expect(LANE_BACK[0]).toEqual({ x: 430, y: 655 });
    expect(inCoverQuad(430, 655)).toBe(false);
    expect(LANE_BACK[LANE_BACK.length - 1]).toEqual(BERTH);
    const L = laneLength("back");
    expect(Math.abs(L - 943)).toBeLessThan(5); // ≈ 942.67; holgura para mover vértices hasta 2 u
    for (let d = 0; d <= L; d += 1) {
      const p = laneAt("back", d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
    }
  });

  it("ningún punto de LANE_BACK queda detrás de un sólido estático que se le superponga en pantalla", () => {
    const statics = world(7).solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    for (let d = 0; d <= laneLength("back"); d += 4) {
      const p = laneAt("back", d);
      expectNotBehind(statics, p, p.heading);
    }
  });

  it("separación: dos cargueros, uno en cada carril, no se tocan en pantalla salvo cerca del fondeadero (d_out + (L_back − d_back) < 200)", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    const backs = [] as { d: number; s: Vec2[] }[];
    for (let d = 0; d <= Lb; d += 4) { const p = laneAt("back", d); backs.push({ d, s: silhouette(p, p.heading) }); }
    for (let d = 0; d <= Lo; d += 4) {
      const p = laneAt("out", d), s = silhouette(p, p.heading);
      for (const b of backs) if (d + (Lb - b.d) >= 200) expect(intersects(s, b.s)).toBe(false);
    }
  });

  it("giro en el fondeadero: con el carguero centrado en BERTH, ningún rumbo entre el de llegada y el de salida lo deja detrás de un sólido estático", () => {
    const statics = world(7).solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    const arrive = laneAt("back", laneLength("back")).heading, leave = laneAt("out", 0).heading;
    let d = leave - arrive; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; // arco corto
    for (let t = 0; t <= 1; t += 0.02) {
      expectNotBehind(statics, BERTH, arrive + d * t);
    }
  });

  it("intersects (SAT) detecta superposición y separación", () => {
    const sq = (x: number, y: number): Vec2[] => [{ x, y }, { x: x + 2, y }, { x: x + 2, y: y + 2 }, { x, y: y + 2 }];
    expect(intersects(sq(0, 0), sq(1, 1))).toBe(true);
    expect(intersects(sq(0, 0), sq(3, 0))).toBe(false);
  });

  it("laneAt('back') interpola el rumbo en los vértices y en el extremo llega con el rumbo del último tramo", () => {
    const Lb = laneLength("back"), last = Math.atan2(-2 - -50, 362 - 400);
    expect(laneAt("back", Lb).heading).toBeCloseTo(last, 6);
    expect(laneAt("back", 0).heading).toBeCloseTo(Math.atan2(487 - 655, 471 - 430), 6);
  });

  it("cerca del fondeadero nunca coinciden dos barcos: LANE_SPEED · (T/3 − BERTH_MS) ≥ 200 u", () => {
    expect((LANE_SPEED * (CYCLE_MS / 3 - BERTH_MS)) / 1000).toBeGreaterThanOrEqual(200);
  });

  it("cobertura: en 2·T, siempre uno en out y uno en back, nunca dos en berth, cada barco recorre out → offscreen → back → berth en orden, y dos en el mismo carril distan ≥ 100 u", () => {
    const { a } = setup();
    const ORDER = ["out", "offscreen", "back", "berth"] as const;
    const prev = [0, 1, 2].map((k) => a.state(k).lane), seen: string[][] = [[], [], []];
    for (let t = 0; t < 2 * CYCLE_MS; t += 997) {
      a.tick(997);
      const ss = [0, 1, 2].map((k) => a.state(k));
      expect(ss.some((s) => s.lane === "out")).toBe(true);
      expect(ss.some((s) => s.lane === "back")).toBe(true);
      expect(ss.filter((s) => s.lane === "berth").length).toBeLessThanOrEqual(1);
      ss.forEach((s, k) => {
        if (s.lane !== prev[k]) { expect(s.lane).toBe(ORDER[(ORDER.indexOf(prev[k]!) + 1) % 4]); seen[k]!.push(s.lane); prev[k] = s.lane; }
      });
      for (const lane of ["out", "back"] as const) {
        const ds = ss.filter((s) => s.lane === lane).map((s) => s.dist);
        if (ds.length === 2) expect(Math.abs(ds[0]! - ds[1]!)).toBeGreaterThanOrEqual(100);
      }
    }
    for (const k of [0, 1, 2]) for (const lane of ORDER) expect(seen[k]).toContain(lane);
  });

  it("giro en el fondeadero: el centro no se mueve y el rumbo pasa del de llegada al de salida por el arco corto, entre los 8 s y los 16 s", () => {
    const { a } = setup();
    const Lo = laneLength("out"), Lb = laneLength("back");
    const arrive = laneAt("back", Lb).heading, leave = laneAt("out", 0).heading;
    a.tick(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + 1); // barco 0 recién fondeado
    const hullAt = () => { const h = a.ship(0).solids.find((s) => s.kind === "hull")!; if (h.kind !== "hull") throw new Error(); return h; };
    for (let t = 1; t < BERTH_MS; t += 250) {
      const s = a.state(0), h = hullAt(), want = shipAt("cargo", BERTH, s.heading);
      expect(s.lane).toBe("berth");
      expect(h.at.x).toBeCloseTo(want.x, 6); expect(h.at.y).toBeCloseTo(want.y, 6); // centro fijo en BERTH
      expect(a.ship(0).wake).toEqual([]); // fondeado: sin estela
      if (t < BERTH_TURN_MS.from) expect(s.heading).toBeCloseTo(arrive, 6);
      if (t > BERTH_TURN_MS.to) expect(s.heading).toBeCloseTo(leave, 6);
      const lo = Math.min(arrive, leave), hi = Math.max(arrive, leave); // arco corto: nunca sale de [salida, llegada]
      expect(s.heading).toBeGreaterThanOrEqual(lo - 1e-9); expect(s.heading).toBeLessThanOrEqual(hi + 1e-9);
      a.tick(250);
    }
    a.tick(1000); // zarpa
    expect(a.state(0).lane).toBe("out");
    expect(a.state(0).heading).toBeCloseTo(Math.atan2(22, 138), 6); // rumbo del primer tramo de LANE_OUT
  });
});

describe("barcos", () => {
  it("tres barcos a la misma velocidad, cada uno arranca en la fase k·T/3 de su ciclo; tras CYCLE_MS todos vuelven a su estado", () => {
    const { a } = setup();
    expect(LANE_SPEED).toBe(1.2);
    expect(SHIPS.map((s) => s.kind)).toEqual(["cargo", "tug", "barge"]);
    expect(SHIPS.map((s) => s.phase)).toEqual([0, 1 / 3, 2 / 3]);
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(CYCLE_MS).toBeCloseTo(((Lo + Lb) / LANE_SPEED) * 1000 + OFF_MS + BERTH_MS, 6);
    const s0 = [0, 1, 2].map((k) => a.state(k));
    expect(s0[0]).toMatchObject({ lane: "out", dist: 0 }); // zarpando
    expect(s0[1]!.lane).toBe("out"); expect(s0[1]!.dist).toBeGreaterThan(Lo / 2); // lejos en la ida
    expect(s0[2]!.lane).toBe("back"); expect(s0[2]!.dist).toBeGreaterThan(Lb / 4); expect(s0[2]!.dist).toBeLessThan((3 * Lb) / 4); // a mitad de la vuelta
    a.tick(CYCLE_MS);
    for (const k of [0, 1, 2]) { const s = a.state(k); expect(s.lane).toBe(s0[k]!.lane); expect(s.dist).toBeCloseTo(s0[k]!.dist, 6); }
  });

  it("alpha: 1 en el fondeadero, 0 en los extremos de mar, 1 a FADE_U de ellos; offscreen 0", () => {
    const Lo = laneLength("out"), Lb = laneLength("back");
    expect(alphaAt("out", 0)).toBe(1);
    expect(alphaAt("out", Lo)).toBe(0);
    expect(alphaAt("out", Lo - FADE_U)).toBe(1);
    expect(alphaAt("back", 0)).toBe(0);
    expect(alphaAt("back", FADE_U)).toBe(1);
    expect(alphaAt("back", Lb)).toBe(1);
    expect(alphaAt("berth", Lb)).toBe(1);
    expect(alphaAt("offscreen", Lo)).toBe(0);
  });

  it("offscreen: el frame no tiene sólidos, luces ni estela y su alpha es 0", () => {
    const { a } = setup();
    a.tick((laneLength("out") / LANE_SPEED) * 1000 + OFF_MS / 2); // barco 0 a mitad del offscreen
    expect(a.state(0)).toMatchObject({ lane: "offscreen", dist: laneLength("out") });
    expect(a.ship(0)).toEqual({ solids: [], lights: [], wake: [], alpha: 0 });
  });

  it("un dt grande cruza estados y consume el sobrante: del final de la ida, OFF_MS + 5 s después va 6 u por la vuelta", () => {
    const { a } = setup();
    a.tick((laneLength("out") / LANE_SPEED) * 1000);
    a.tick(OFF_MS + 5000);
    expect(a.state(0).lane).toBe("back");
    expect(a.state(0).dist).toBeCloseTo(5 * LANE_SPEED, 6);
  });

  it("reduced motion: tick no cambia el estado de ningún barco", () => {
    const { a } = setup(true);
    const s0 = [0, 1, 2].map((k) => a.state(k));
    a.tick(60000);
    expect([0, 1, 2].map((k) => a.state(k))).toEqual(s0);
  });
});

describe("lancha de la feria", () => {
  it("la lancha va del muelle de la feria al de graneles y vuelve, parando 4 s en cada punta, siempre sobre agua y nunca detrás de un sólido estático", () => {
    const { a: anim } = setup(false);
    const fpts = FERRY_ROUTE, fa = fpts[0]!, fb = fpts[fpts.length - 1]!;
    const L = fpts.slice(1).reduce((acc, b, i) => acc + Math.hypot(b.x - fpts[i]!.x, b.y - fpts[i]!.y), 0);
    const f0 = anim.ferry();
    expect(f0.alpha).toBe(1);
    const hull0 = f0.solids.find((s) => s.kind === "hull")!;
    expect(hull0.kind === "hull" && hull0.at).toMatchObject({ x: fa.x, y: fa.y });
    anim.tick(FERRY_PAUSE_MS + 100); // arranca
    const seen: { x: number; y: number }[] = [];
    for (let t = 0; t < (2 * L) / FERRY_SPEED + 10; t += 1) { anim.tick(1000); const h = anim.ferry().solids.find((s) => s.kind === "hull")!; if (h.kind === "hull") seen.push({ x: h.at.x, y: h.at.y }); }
    expect(seen.some((p) => Math.hypot(p.x - fb.x, p.y - fb.y) < FERRY_SPEED)).toBe(true); // llegó al otro muelle
    expect(seen.some((p) => Math.hypot(p.x - fa.x, p.y - fa.y) < FERRY_SPEED)).toBe(true); // y volvió
    for (const p of seen) expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
    const statics = world(7).solids.filter((s) => !isFlat(s));
    for (let i = 0; i < fpts.length - 1; i++) {
      const a = fpts[i]!, b = fpts[i + 1]!;
      for (let t = 0; t <= 1; t += 0.05) {
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const box = bounds({ kind: "hull", at: v3(p.x, p.y, -1), len: 26, beam: 7, h: 3, mat: "hull" });
        for (const s of statics) { const sb = bounds(s); if (overlaps(screenBounds(box), screenBounds(sb))) expect(isBehind(box, sb)).toBe(false); }
      }
    }
  });
});

describe("mar, haz y boyas", () => {
  it("el haz da una vuelta cada 8 s y con reduced-motion apunta al este", () => {
    const { a } = setup();
    const angle = (acc: ReturnType<typeof a.beam>) => { const p = acc[0]!; if (p.kind !== "poly") throw new Error(); const apex = p.pts[0]!, tip = p.pts[1]!; return Math.atan2(tip.y - apex.y, tip.x - apex.x); };
    const a0 = angle(a.beam());
    a.tick(BEAM_PERIOD_MS / 4);
    expect(angle(a.beam()) - a0).toBeCloseTo(Math.PI / 2, 1);
    a.tick((BEAM_PERIOD_MS * 3) / 4);
    expect(Math.abs(angle(a.beam()) - a0) % (Math.PI * 2)).toBeCloseTo(0, 1);
    expect(a.beam()).toHaveLength(2);
    const r = setup(true).a;
    expect(Math.abs(angle(r.beam()))).toBeLessThan(0.2);
    expect(r.tick(500)).toEqual({ ships: false, beam: false, buoys: false, ferry: false, neon: false });
  });
  it("el haz es luz cálida: las dos cuñas son de la familia ámbar, ninguna magenta, en todo el giro y con reduced-motion", () => {
    for (const reduced of [false, true]) {
      const { a } = setup(reduced);
      for (let t = 0; t < BEAM_PERIOD_MS; t += BEAM_PERIOD_MS / 4) {
        const b = a.beam();
        expect(b.map((x) => x.color)).toEqual(["amberBleed", "amber"]);
        for (const x of b) { expect(x.color).toMatch(/^amber/); expect(x.color).not.toMatch(/^magenta/); }
        a.tick(BEAM_PERIOD_MS / 4);
      }
    }
  });
  it("las boyas parpadean desfasadas: nunca las dos apagadas, cada una encendida la mitad del período", () => {
    const { a } = setup();
    let on0 = 0, on1 = 0;
    for (let t = 0; t < 2000; t += 50) {
      const b = a.buoys();
      expect(b.length).toBeGreaterThanOrEqual(1);
      on0 += b.some((d) => d.kind === "dot" && d.at.x === 420) ? 1 : 0;
      on1 += b.some((d) => d.kind === "dot" && d.at.x === 430) ? 1 : 0;
      a.tick(50);
    }
    expect(on0).toBe(20); expect(on1).toBe(20);
  });
});

describe("neones", () => {
  const dots = (xs: Accent[], color: string) => xs.filter((x): x is Extract<Accent, { kind: "dot" }> => x.kind === "dot" && x.color === color);
  const sign = (xs: Accent[]) => xs.find((x) => x.kind === "poly")!;

  it("frame 0 = estado de reduced motion: dos luces de galería, costa a pleno, cartel cian; solo cian/magenta", () => {
    const { w, a } = setup(), r = setup(true).a;
    const n0 = a.neon();
    expect(n0).toEqual(r.neon());
    expect(dots(n0, "magenta").map((d) => d.at)).toEqual([w.sea!.neon.gallery[0], w.sea!.neon.gallery[1]]);
    for (const d of dots(n0, "magenta")) expect(d.r).toBe(0.45);
    expect(dots(n0, "cyan").map((d) => d.r)).toEqual(w.sea!.neon.coast.map(() => 0.6));
    expect(sign(n0).color).toBe("cyan");
    for (const x of n0) expect(x.color).toMatch(/^(cyan|magenta)/);
  });

  it("la galería corre al revés del haz, un lugar por paso de 200 ms", () => {
    const { w, a } = setup();
    expect(a.tick(NEON_STEP_MS).neon).toBe(true);
    expect(dots(a.neon(), "magenta").map((d) => d.at)).toEqual([w.sea!.neon.gallery[0], w.sea!.neon.gallery[7]]);
    expect(a.tick(NEON_STEP_MS / 2).neon).toBe(false); // dentro del mismo paso: nada que redibujar
  });

  it("la costa es una onda que viaja y el cartel alterna cian/magenta cada 4 s", () => {
    const { a } = setup();
    a.tick(NEON_STEP_MS);
    const rs = dots(a.neon(), "cyan").map((d) => d.r);
    for (const r of rs) { expect(r).toBeGreaterThanOrEqual(0.3); expect(r).toBeLessThanOrEqual(0.6); }
    expect(new Set(rs).size).toBeGreaterThan(1);
    const peak = (xs: number[]) => xs.indexOf(Math.max(...xs));
    a.tick(4 * NEON_STEP_MS);
    expect(peak(dots(a.neon(), "cyan").map((d) => d.r))).not.toBe(peak(rs)); // la cresta se corrió: la onda viaja
    a.tick(KEEPER_SIGN_MS);
    expect(sign(a.neon()).color).toBe("magenta");
    a.tick(KEEPER_SIGN_MS);
    expect(sign(a.neon()).color).toBe("cyan");
  });
});
