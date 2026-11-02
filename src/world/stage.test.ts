import { describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("pixi.js")>();
  // the real filters compile WebGL shaders: in node it only matters that they exist and with which options
  class StubFilter { destroyed = false; constructor(readonly options?: unknown) {} destroy() { this.destroyed = true; } }
  return { ...real, AlphaFilter: StubFilter, BlurFilter: StubFilter };
});

import type { Container, Graphics } from "pixi.js";
import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { AnimLayer } from "../scenes/animator";
import { assembleWorld, type ZonedAnimator } from "./assemble";
import { HALO_BASE, HALO_FALLBACK } from "./frame";
import { BLOOM_FILTER, buildStage, nextHalo } from "./stage";
import { ACCENT_DIM, WORLD_ZONES, focusAlphas } from "./veil";

const build = (reducedMotion = true) => { const { scene, animators } = assembleWorld(undefined, { reducedMotion }); return buildStage(scene, animators); };
const accentSlotOf = (c: Container) => c.children[c.children.length - 1] as Container;
const bloomSlotOf = (c: Container) => c.children.find((k) => (k.filters as readonly unknown[] | null)?.some((f) => (f as { options?: unknown }).options === BLOOM_FILTER)) as Container | undefined;
const fills = (c: Container) => accentSlotOf(c).children.reduce((n, g) => n + (g as Graphics).context.instructions.length, 0);

describe("nextHalo", () => {
  it("fallback uses the large halo; off and on use today's", () => {
    expect(nextHalo("fallback")).toBe(HALO_FALLBACK);
    expect(nextHalo("off")).toBe(HALO_BASE);
    expect(nextHalo("on")).toBe(HALO_BASE);
  });
});

describe("Stage bloom modes", () => {
  it("buildStage starts at off, with no bloomSlot or filters on the accents", () => {
    const s = build();
    expect(s.bloom).toBe("off");
    expect(s.container.children).toHaveLength(9);
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(accentSlotOf(s.container).filters ?? []).toHaveLength(0);
  });

  it("on adds a bloomSlot with a filter right below accentSlot, with one mirror per accent Graphics", () => {
    const s = build();
    const accentSlot = accentSlotOf(s.container);
    s.setBloom("on");
    expect(s.bloom).toBe("on");
    const bloom = bloomSlotOf(s.container)!;
    expect(bloom).toBeDefined();
    expect(s.container.children.indexOf(bloom)).toBe(s.container.children.indexOf(accentSlot) - 1);
    expect(bloom.blendMode).toBe("add");
    expect(bloom.filters).toHaveLength(1);
    // the last blur pass composes with the filter's blendMode, not the container's
    expect(BLOOM_FILTER.blendMode).toBe("add");
    expect(bloom.children).toHaveLength(accentSlot.children.length);
    bloom.children.forEach((m, i) => expect((m as Graphics).context).toBe((accentSlot.children[i] as Graphics).context));
    expect(accentSlot.filters ?? []).toHaveLength(0);
  });

  it("on → off → on reuses a single bloomSlot; a repeated on is idempotent", () => {
    const s = build();
    s.setBloom("on");
    const first = bloomSlotOf(s.container);
    s.setBloom("on");
    expect(s.container.children).toHaveLength(10);
    s.setBloom("off");
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(s.container.children).toHaveLength(9);
    s.setBloom("on");
    expect(bloomSlotOf(s.container)).toBe(first);
    expect(s.container.children).toHaveLength(10);
  });

  it("fallback removes the bloomSlot and redraws the dots with the large halo; off returns them to today's", () => {
    const s = build();
    const base = fills(s.container);
    s.setBloom("on");
    s.setBloom("fallback");
    expect(s.bloom).toBe("fallback");
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(fills(s.container)).toBeGreaterThan(base);
    s.setBloom("off");
    expect(fills(s.container)).toBe(base);
    s.setBloom("fallback");
    expect(fills(s.container)).toBeGreaterThan(base);
  });

  it("in fallback, the animators' redraws keep the large halo", () => {
    // only Blog (sea with buoys and ships): enough to have animated accent layers and keeps the test fast
    const blog = () => { const { scene, animators } = assembleWorld(["blog"], { reducedMotion: false }); return buildStage(scene, animators); };
    // the first children of accentSlot are the static accents, one per zone; the rest, the animated layers
    const animatedFills = (c: Container) => accentSlotOf(c).children.slice(WORLD_ZONES.length).reduce((n, g) => n + (g as Graphics).context.instructions.length, 0);
    const sFb = blog(), sOff = blog();
    sFb.setBloom("fallback");
    for (let i = 0; i < 10; i++) { sFb.tick(100); sOff.tick(100); }
    // same deterministic animators, same clock: only the halo changes
    expect(animatedFills(sFb.container)).toBeGreaterThan(animatedFills(sOff.container));
    sFb.setBloom("off");
    expect(animatedFills(sFb.container)).toBe(animatedFills(sOff.container));
  });

  it("the mirrors copy the alpha of their original when the focus changes", () => {
    const s = build();
    s.setBloom("on");
    s.setFocus("blog");
    for (let i = 0; i < 20; i++) s.tick(100);
    const accentSlot = accentSlotOf(s.container), bloom = bloomSlotOf(s.container)!;
    expect(accentSlot.children.some((g) => g.alpha < 1)).toBe(true);
    bloom.children.forEach((m, i) => expect(m.alpha).toBeCloseTo(accentSlot.children[i]!.alpha));
  });
});

describe("setLayer", () => {
  // indices without bloom: 0 bleed, 1 water, 2 ground, 3 band, 4 core, 5 solids, 6 animated solids, 7 veils, 8 accents
  const LAYER_IDX = { ground: [0, 1, 2], shadow: [3, 4], accents: [8] } as const;
  const visibleFlags = (c: Container) => c.children.map((k) => k.visible);

  it.each(Object.entries(LAYER_IDX))("%s hides only its containers and shows them again", (layer, idx) => {
    const s = build();
    s.setLayer(layer as keyof typeof LAYER_IDX, false);
    visibleFlags(s.container).forEach((v, i) => expect(v).toBe(!(idx as readonly number[]).includes(i)));
    s.setLayer(layer as keyof typeof LAYER_IDX, true);
    expect(visibleFlags(s.container).every(Boolean)).toBe(true);
  });

  it("with the three layers hidden the solids and the veils stay visible", () => {
    const s = build();
    for (const l of ["ground", "shadow", "accents"] as const) s.setLayer(l, false);
    expect(visibleFlags(s.container)).toEqual([false, false, false, false, false, true, true, true, false]);
  });

  it("the bloomSlot follows the accents if it already exists", () => {
    const s = build();
    s.setBloom("on");
    s.setLayer("accents", false);
    expect(bloomSlotOf(s.container)!.visible).toBe(false);
    s.setLayer("accents", true);
    expect(bloomSlotOf(s.container)!.visible).toBe(true);
  });

  it("a bloomSlot built with the accents hidden is born hidden", () => {
    const s = build();
    s.setLayer("accents", false);
    s.setBloom("on");
    expect(bloomSlotOf(s.container)!.visible).toBe(false);
  });

  it("the bloomSlot outside the container also follows the accents (on → fallback → on)", () => {
    const s = build();
    s.setBloom("on");
    s.setBloom("fallback");
    s.setLayer("accents", false);
    s.setBloom("on");
    expect(bloomSlotOf(s.container)!.visible).toBe(false);
  });

  it("setLayer changes neither the number of children nor the bloom mode", () => {
    const s = build();
    for (const l of ["ground", "shadow", "accents"] as const) s.setLayer(l, false);
    expect(s.container.children).toHaveLength(9);
    expect(s.bloom).toBe("off");
  });
});

describe("destroy", () => {
  type Stub = { destroyed: boolean };

  it("destroys the bloomSlot created by on even if the current mode is off, and frees its filter", () => {
    const s = build();
    s.setBloom("on");
    const slot = bloomSlotOf(s.container)!;
    const blur = (slot.filters as unknown as Stub[])[0]!;
    s.setBloom("off");
    s.destroy();
    expect(slot.destroyed).toBe(true);
    expect(slot.children).toHaveLength(0);
    expect(blur.destroyed).toBe(true);
  });

  it("destroys the tree with its contexts and the shadow filters", () => {
    const s = build();
    const accent = accentSlotOf(s.container).children[0] as Graphics, ctx = accent.context;
    const alphas = [s.container.children[3]!, s.container.children[4]!].flatMap((k) => k.filters as unknown as Stub[]);
    s.destroy();
    expect(s.container.destroyed).toBe(true);
    expect(accent.destroyed).toBe(true);
    expect(ctx.destroyed).toBe(true);
    expect(alphas).toHaveLength(2);
    alphas.forEach((f) => expect(f.destroyed).toBe(true));
  });

  it("with the bloom on the slot is in the tree: it is destroyed once and frees its filter", () => {
    const s = build();
    s.setBloom("on");
    const slot = bloomSlotOf(s.container)!, blur = (slot.filters as unknown as Stub[])[0]!;
    // the mirror does not own its context: the tree's original Graphics frees it
    const mirror = slot.children[0] as Graphics, ctx = mirror.context;
    expect(() => s.destroy()).not.toThrow();
    expect(slot.destroyed).toBe(true);
    expect(blur.destroyed).toBe(true);
    expect(mirror.destroyed).toBe(true);
    expect(ctx.destroyed).toBe(true);
  });

  it("with no bloom ever built it does not throw", () => {
    expect(() => build().destroy()).not.toThrow();
  });

  it("after destroy, everything is a no-op: destroy, setBloom, setLayer, setFocus and tick", () => {
    const s = build();
    s.setBloom("fallback");
    s.destroy();
    expect(() => {
      s.destroy();
      s.setBloom("on");
      s.setBloom("off");
      s.setLayer("accents", false);
      s.setFocus("blog");
      s.tick(100);
    }).not.toThrow();
    expect(s.bloom).toBe("fallback");
  });
});

describe("veil of the animated lights", () => {
  const dot = (x: number, y: number): Accent => ({ kind: "dot", at: v3(x, y, 1), r: 1, color: "amber" });
  const port = dot(380, 118), blog = dot(500, 200);
  const toy = (layer: () => AnimLayer): ZonedAnimator => ({ zone: "blog", ids: ["lights"], layer, tick: () => new Set(["lights"]) });
  const stageWith = (a: ZonedAnimator) => buildStage(assembleWorld(["portfolio"], { reducedMotion: true }).scene, [a]);
  // animated Graphics: the ones that follow the three static ones in accentSlot
  const animated = (s: ReturnType<typeof buildStage>) => accentSlotOf(s.container).children.slice(3) as Graphics[];
  const lit = (gs: Graphics[]) => gs.filter((g) => g.context.instructions.length > 0);

  it("a layer without a zone veils each light with the zone of its position, even if the animator belongs to another zone", () => {
    const s = stageWith(toy(() => ({ kind: "accent", accents: [port, blog] })));
    // one Graphics per zone, in the order of WORLD_ZONES: [portfolio, cv, blog]
    const [gPort, gCv, gBlog] = animated(s);
    expect(lit([gPort!, gCv!, gBlog!])).toEqual([gPort, gBlog]);
    s.setFocus("portfolio"); s.tick(10_000);
    expect([gPort!.alpha, gBlog!.alpha]).toEqual([1, ACCENT_DIM]);
    s.setFocus("blog"); s.tick(10_000);
    expect([gPort!.alpha, gBlog!.alpha]).toEqual([ACCENT_DIM, 1]);
  });
  it("a layer with a zone veils all its lights with that zone, in a single Graphics", () => {
    const s = stageWith(toy(() => ({ kind: "accent", accents: [port, blog], zone: "blog", alpha: 0.5 })));
    expect(animated(s)).toHaveLength(1);
    s.setFocus("portfolio"); s.tick(10_000);
    expect(animated(s)[0]!.alpha).toBeCloseTo(0.5 * ACCENT_DIM);
  });
  it("if a zone of the layer is left without lights, its Graphics empties on redraw", () => {
    let on = true;
    const s = stageWith(toy(() => ({ kind: "accent", accents: on ? [port, blog] : [blog] })));
    expect(lit(animated(s))).toHaveLength(2);
    on = false; s.tick(16);
    expect(lit(animated(s))).toHaveLength(1);
  });
  it("the static lights keep their per-zone alpha with each focus", () => {
    const s = build();
    for (const f of WORLD_ZONES) {
      s.setFocus(f); s.tick(10_000);
      const statics = accentSlotOf(s.container).children.slice(0, 3);
      expect(statics.map((g) => g.alpha)).toEqual(WORLD_ZONES.map((z) => focusAlphas(f)[z].accents));
    }
  });
});
