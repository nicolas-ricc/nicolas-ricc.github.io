import { describe, expect, it } from "vitest";
import { BEAM_PERIOD_MS, CYCLE_MS, LANE_SPEED, OFF_MS, PORT_MS, SHIPS, createSeaAnim, laneLength } from "./sea-anim";
import { seaAnimator } from "./sea-animator";
import { accentZone } from "../world/veil";
import { world } from "./world";

describe("seaAnimator", () => {
  it("exposes the sea layers (ships, beam, buoys) and with reduced-motion returns no ids", () => {
    const w = world(7);
    const a = seaAnimator(w.sea!, { reducedMotion: false });
    expect(a.ids).toEqual(expect.arrayContaining(["sea.ship0", "sea.wake2", "sea.lights1", "sea.beam", "sea.buoys", "sea.ferry", "sea.ferryWake", "sea.ferryLights", "sea.neon"]));
    expect(a.layer("sea.ship0").kind).toBe("solid");
    expect(a.layer("sea.wake0")).toMatchObject({ kind: "water", alpha: 0 }); // phase 0: sets sail at the harbor mouth, faded
    expect(a.layer("sea.ship2")).toMatchObject({ kind: "solid", alpha: 1 }); // phase ⅔: halfway through the return
    const ids = a.tick(100);
    expect(ids.has("sea.ship0")).toBe(true); expect(ids.has("sea.beam")).toBe(true);
    const r = seaAnimator(w.sea!, { reducedMotion: true });
    expect(r.tick(1000).size).toBe(0);
  });
  it("sea.neon is a cyan/magenta accent layer that changes as the clock advances", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const l0 = a.layer("sea.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(a.tick(200).has("sea.neon")).toBe(true);
    expect(a.layer("sea.neon")).not.toEqual(l0);
    expect(seaAnimator(world(7).sea!, { reducedMotion: true }).tick(1000).has("sea.neon")).toBe(false);
  });
  it("when going offscreen the ship's layer is marked for redraw and ends up empty", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const toEnd = (laneLength("out") / LANE_SPEED) * 1000;
    a.tick(toEnd - 10);
    const ids = a.tick(1000);
    expect(ids.has("sea.ship0")).toBe(true); expect(ids.has("sea.wake0")).toBe(true); expect(ids.has("sea.lights0")).toBe(true);
    expect(a.layer("sea.ship0")).toEqual({ kind: "solid", solids: [], alpha: 0 });
  });
  it("the ships' layers carry the ship's heading to sort in its frame; the launch does not", () => {
    const sea = world(7).sea!, a = seaAnimator(sea, { reducedMotion: false }), ref = createSeaAnim(sea, { reducedMotion: false });
    let seen = 0;
    for (let k = 0; k < SHIPS.length; k++) {
      const l = a.layer(`sea.ship${k}`), st = ref.state(k);
      expect(l.kind).toBe("solid");
      if (l.kind === "solid" && st.lane !== "offscreen") { expect(l.heading).toBe(st.heading); seen++; }
    }
    expect(seen).toBeGreaterThan(0);
    const f = a.layer("sea.ferry");
    expect(f.kind).toBe("solid");
    if (f.kind === "solid") expect(f.heading).toBeUndefined();
  });
  it("same seed → same sequence", () => {
    const mk = () => seaAnimator(world(7).sea!, { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
  it("each ship's lights declare a single zone for the whole cycle: Portfolio the launch, Blog the rest", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const ids = ["sea.ferryLights", ...SHIPS.map((_, k) => `sea.lights${k}`)];
    const zones = new Map<string, Set<unknown>>(ids.map((id) => [id, new Set()]));
    const launch = new Set<string>(); // zones by position of the launch's lights
    let freighter = 0; // freighter samples on Portfolio land: proves the sweep crosses the coast
    for (let t = 0; t < 600; t++) {
      a.tick(500);
      for (const id of ids) {
        const l = a.layer(id);
        if (l.kind !== "accent") throw new Error(id);
        zones.get(id)!.add(l.zone);
        if (id === "sea.ferryLights") for (const x of l.accents) launch.add(accentZone(x));
        if (id === "sea.lights0") freighter += l.accents.filter((x) => accentZone(x) === "portfolio").length;
      }
    }
    expect([...zones.get("sea.ferryLights")!]).toEqual(["portfolio"]);
    SHIPS.forEach((_, k) => expect([...zones.get(`sea.lights${k}`)!]).toEqual(["blog"]));
    expect(freighter).toBeGreaterThan(0);
    // the launch's zone is a decision, not a measurement: this check warns if its route ever touches Blog
    expect([...launch]).toEqual(["portfolio"]);
  });
  it("with reduced-motion the ships' lights declare the same zone", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: true });
    expect(a.layer("sea.ferryLights")).toMatchObject({ kind: "accent", zone: "portfolio" });
    SHIPS.forEach((_, k) => expect(a.layer(`sea.lights${k}`)).toMatchObject({ kind: "accent", zone: "blog" }));
  });
  it("the sea's fixed lights (beam, neons, buoys) declare no zone: they are veiled by position", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    for (const id of ["sea.beam", "sea.neon", "sea.buoys"]) expect(a.layer(id)).not.toHaveProperty("zone");
  });
});

describe("seaAnimator marks only what changed (#71)", () => {
  const shipIds = (k: number) => [`sea.ship${k}`, `sea.wake${k}`, `sea.lights${k}`];
  const OUT = (laneLength("out") / LANE_SPEED) * 1000;

  it("an offscreen ship does not mark its layers; the transition does", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    a.tick(OUT - 10);
    const enter = a.tick(1000); // ship 0: out → offscreen
    for (const id of shipIds(0)) expect(enter.has(id)).toBe(true);
    const still = a.tick(1000); // ship 0 stays offscreen; 1 and 2 move
    for (const id of shipIds(0)) expect(still.has(id)).toBe(false);
    for (const id of [...shipIds(1), ...shipIds(2)]) expect(still.has(id)).toBe(true);
    const leave = a.tick(OFF_MS); // offscreen → back
    for (const id of shipIds(0)) expect(leave.has(id)).toBe(true);
  });

  it("arriving in port and setting sail in the next cycle also mark", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const BACK = (laneLength("back") / LANE_SPEED) * 1000;
    a.tick(OUT + OFF_MS + BACK - 10);
    const port = a.tick(1000); // ship 0: back → offscreen (in port)
    for (const id of shipIds(0)) expect(port.has(id)).toBe(true);
    const still = a.tick(1000);
    for (const id of shipIds(0)) expect(still.has(id)).toBe(false);
    const out = a.tick(PORT_MS); // end of the cycle: sets sail again
    for (const id of shipIds(0)) expect(out.has(id)).toBe(true);
  });

  it("the first tick that advances marks all layers; with dtMs 0 it marks nothing", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    expect(a.tick(0).size).toBe(0);
    expect([...a.tick(1)].sort()).toEqual([...a.ids].sort());
  });

  it("unmarked layers stay the same: the cached frame matches the real one over a whole cycle", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const cache = new Map(a.ids.map((id) => [id, a.layer(id)]));
    const steps = [16, 33, 100, 1000, 5000, BEAM_PERIOD_MS, 15000];
    for (let t = 0, i = 0; t < CYCLE_MS + 60000; i++) {
      const dt = steps[i % steps.length]!; t += dt;
      for (const id of a.tick(dt)) cache.set(id, a.layer(id));
      for (const id of a.ids) expect(cache.get(id)).toEqual(a.layer(id));
    }
  });

  it("over a full cycle it marks fewer layers than before", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const dt = 1000 / 60, n = Math.ceil(CYCLE_MS / dt);
    let marked = 0, before = 0;
    for (let i = 0; i < n; i++) {
      const ids = a.tick(dt);
      marked += ids.size;
      // before #71: the 9 ship layers and the beam on every tick, plus the others by their own criterion
      before += SHIPS.length * 3 + 1 + [...ids].filter((id) => !/^sea\.(ship|wake|lights)\d$|^sea\.beam$/.test(id)).length;
    }
    expect(marked).toBeLessThan(before);
  });
});
