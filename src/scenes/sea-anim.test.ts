import { describe, expect, it } from "vitest";
import { depthAt } from "./depth-map";
import type { Accent } from "../iso/accent";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import { bounds, isFlat } from "../iso/solids";
import { WORLD, inCoverQuad, worldZoneAt } from "../map/geo";
import { BEAM_PERIOD_MS, BERTH, FADE_U, FERRY_PAUSE_MS, FERRY_ROUTE, FERRY_SPEED, KEEPER_SIGN_MS, LANE_OUT, LANE_SPEED, NEON_STEP_MS, SHIPS, createSeaAnim, routeAt, routeLength } from "./sea-anim";
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
    const L = routeLength();
    expect(L).toBeCloseTo(783, 0);
    const inWorld = (x: number, y: number) => x >= WORLD.x0 && x <= WORLD.x1 && y >= WORLD.y0 && y <= WORLD.y1;
    let crossedAbyss = false;
    for (let d = 0; d <= L; d += 1) {
      const p = routeAt(d);
      const t = inWorld(p.x, p.y) ? terrainAt(p.x, p.y) : bleedTerrainAt(p.x, p.y);
      expect(WATER.has(t)).toBe(true);
      expect(depthAt(p.x, p.y)).toBeGreaterThanOrEqual(6);
      if (p.x >= 380) expect(worldZoneAt(p.x, p.y)).toBe("blog");
      if (t === "abyss") crossedAbyss = true;
    }
    expect(crossedAbyss).toBe(true);
    expect(routeAt(0).heading).toBeCloseTo(Math.atan2(22, 138), 6); // sale casi al este por la bocana
  });

  it("ningún punto del carril queda detrás de un sólido estático que se le superponga en pantalla", () => {
    const w = world(7);
    const statics = w.solids.map((s) => ({ b: bounds(s), sb: screenBounds(bounds(s)) }));
    for (let d = 0; d <= routeLength(); d += 4) {
      const p = routeAt(d);
      const parts = ship("cargo", shipAt("cargo", p, p.heading), p.heading).solids.map(bounds);
      const sb = { min: { x: Math.min(...parts.map((b) => b.min.x)), y: Math.min(...parts.map((b) => b.min.y)), z: -1 }, max: { x: Math.max(...parts.map((b) => b.max.x)), y: Math.max(...parts.map((b) => b.max.y)), z: 13 } };
      const scr = screenBounds(sb);
      for (const s of statics) if (overlaps(scr, s.sb)) expect(isBehind(sb, s.b)).toBe(false);
    }
  });

  it("el barco se dibuja centrado en el carril: el casco nace en shipAt(kind, routeAt(d))", () => {
    const { a } = setup();
    for (const k of [0, 1, 2]) {
      const p = routeAt(a.dist(k)), at = shipAt(SHIPS[k]!.kind, p, p.heading);
      const hull = a.ship(k).solids.find((s) => s.kind === "hull")!;
      expect(hull.kind === "hull" && hull.at.x).toBeCloseTo(at.x, 6);
      expect(hull.kind === "hull" && hull.at.y).toBeCloseTo(at.y, 6);
    }
  });
});

describe("barcos", () => {
  it("tres barcos a la misma velocidad con fases 0, ⅓, ⅔; alpha en [0, 1]; el barco 0 vuelve al inicio tras L/LANE_SPEED segundos", () => {
    const { a } = setup();
    expect(LANE_SPEED).toBe(1.2);
    expect(SHIPS.map((s) => s.kind)).toEqual(["cargo", "tug", "barge"]);
    expect(SHIPS.map((s) => s.phase)).toEqual([0, 1 / 3, 2 / 3]);
    for (const s of SHIPS) expect(Object.keys(s).sort()).toEqual(["kind", "phase"]);
    const L = routeLength();
    expect([0, 1, 2].map((k) => a.dist(k))).toEqual(SHIPS.map((s) => s.phase * L));
    const cycleMs = (L / LANE_SPEED) * 1000, n = Math.round(cycleMs / 100), dt = cycleMs / n;
    let seenMid = false;
    for (let i = 0; i < n; i++) {
      a.tick(dt);
      for (const k of [0, 1, 2]) { const s = a.ship(k); expect(s.alpha).toBeGreaterThanOrEqual(0); expect(s.alpha).toBeLessThanOrEqual(1); expect(s.wake.length).toBe(1); }
      if (a.ship(0).alpha === 1) seenMid = true;
      const ds = [0, 1, 2].map((k) => a.dist(k)); // velocidad única: la separación en el carril no cambia
      expect(((ds[1]! - ds[0]! + L) % L) / L).toBeCloseTo(1 / 3, 6);
    }
    expect(seenMid).toBe(true);
    const d0 = a.dist(0);
    expect(Math.min(d0, L - d0)).toBeLessThan(1e-6);
    expect(Math.abs(a.dist(1) - L / 3)).toBeLessThan(1e-6); // un ciclo entero: todos vuelven a su fase
  });
  it("alpha exactamente 0 al final de la ruta y 1 fuera de las bandas de bruma", () => {
    const { a } = setup();
    expect(a.alphaAt(0)).toBe(0);
    expect(a.alphaAt(routeLength())).toBe(0);
    expect(a.alphaAt(FADE_U)).toBe(1);
    expect(a.alphaAt(routeLength() / 2)).toBe(1);
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
