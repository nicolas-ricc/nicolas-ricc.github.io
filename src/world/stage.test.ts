import { describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("pixi.js")>();
  // los filtros reales compilan shaders WebGL: en node solo importa que existan y con qué opciones
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
  it("fallback usa el halo grande; off y on el de hoy", () => {
    expect(nextHalo("fallback")).toBe(HALO_FALLBACK);
    expect(nextHalo("off")).toBe(HALO_BASE);
    expect(nextHalo("on")).toBe(HALO_BASE);
  });
});

describe("modos de bloom del Stage", () => {
  it("buildStage arranca en off, sin bloomSlot ni filtros sobre los acentos", () => {
    const s = build();
    expect(s.bloom).toBe("off");
    expect(s.container.children).toHaveLength(9);
    expect(bloomSlotOf(s.container)).toBeUndefined();
    expect(accentSlotOf(s.container).filters ?? []).toHaveLength(0);
  });

  it("on agrega un bloomSlot con filtro justo debajo de accentSlot, con un espejo por Graphics de acentos", () => {
    const s = build();
    const accentSlot = accentSlotOf(s.container);
    s.setBloom("on");
    expect(s.bloom).toBe("on");
    const bloom = bloomSlotOf(s.container)!;
    expect(bloom).toBeDefined();
    expect(s.container.children.indexOf(bloom)).toBe(s.container.children.indexOf(accentSlot) - 1);
    expect(bloom.blendMode).toBe("add");
    expect(bloom.filters).toHaveLength(1);
    // la última pasada del blur compone con el blendMode del filtro, no con el del contenedor
    expect(BLOOM_FILTER.blendMode).toBe("add");
    expect(bloom.children).toHaveLength(accentSlot.children.length);
    bloom.children.forEach((m, i) => expect((m as Graphics).context).toBe((accentSlot.children[i] as Graphics).context));
    expect(accentSlot.filters ?? []).toHaveLength(0);
  });

  it("on → off → on reutiliza un único bloomSlot; on repetido es idempotente", () => {
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

  it("fallback quita el bloomSlot y redibuja los dot con el halo grande; off los devuelve al de hoy", () => {
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

  it("en fallback, los redibujos de los animadores siguen con el halo grande", () => {
    // solo Blog (mar con boyas y barcos): basta para tener capas de acentos animadas y mantiene el test rápido
    const blog = () => { const { scene, animators } = assembleWorld(["blog"], { reducedMotion: false }); return buildStage(scene, animators); };
    // los primeros hijos de accentSlot son los acentos estáticos, uno por zona; el resto, las capas animadas
    const animatedFills = (c: Container) => accentSlotOf(c).children.slice(WORLD_ZONES.length).reduce((n, g) => n + (g as Graphics).context.instructions.length, 0);
    const sFb = blog(), sOff = blog();
    sFb.setBloom("fallback");
    for (let i = 0; i < 10; i++) { sFb.tick(100); sOff.tick(100); }
    // mismos animadores deterministas, mismo reloj: solo cambia el halo
    expect(animatedFills(sFb.container)).toBeGreaterThan(animatedFills(sOff.container));
    sFb.setBloom("off");
    expect(animatedFills(sFb.container)).toBe(animatedFills(sOff.container));
  });

  it("los espejos copian el alpha de su original al cambiar el foco", () => {
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
  // índices sin bloom: 0 sangrado, 1 agua, 2 suelo, 3 banda, 4 núcleo, 5 sólidos, 6 sólidos animados, 7 velos, 8 acentos
  const LAYER_IDX = { ground: [0, 1, 2], shadow: [3, 4], accents: [8] } as const;
  const visibles = (c: Container) => c.children.map((k) => k.visible);

  it.each(Object.entries(LAYER_IDX))("%s oculta solo sus contenedores y vuelve a mostrarlos", (layer, idx) => {
    const s = build();
    s.setLayer(layer as keyof typeof LAYER_IDX, false);
    visibles(s.container).forEach((v, i) => expect(v).toBe(!(idx as readonly number[]).includes(i)));
    s.setLayer(layer as keyof typeof LAYER_IDX, true);
    expect(visibles(s.container).every(Boolean)).toBe(true);
  });

  it("con las tres capas ocultas siguen visibles los sólidos y los velos", () => {
    const s = build();
    for (const l of ["ground", "shadow", "accents"] as const) s.setLayer(l, false);
    expect(visibles(s.container)).toEqual([false, false, false, false, false, true, true, true, false]);
  });

  it("el bloomSlot sigue a los acentos si ya existe", () => {
    const s = build();
    s.setBloom("on");
    s.setLayer("accents", false);
    expect(bloomSlotOf(s.container)!.visible).toBe(false);
    s.setLayer("accents", true);
    expect(bloomSlotOf(s.container)!.visible).toBe(true);
  });

  it("un bloomSlot armado con los acentos ocultos nace oculto", () => {
    const s = build();
    s.setLayer("accents", false);
    s.setBloom("on");
    expect(bloomSlotOf(s.container)!.visible).toBe(false);
  });

  it("el bloomSlot fuera del container también sigue a los acentos (on → fallback → on)", () => {
    const s = build();
    s.setBloom("on");
    s.setBloom("fallback");
    s.setLayer("accents", false);
    s.setBloom("on");
    expect(bloomSlotOf(s.container)!.visible).toBe(false);
  });

  it("setLayer no cambia la cantidad de hijos ni el modo de bloom", () => {
    const s = build();
    for (const l of ["ground", "shadow", "accents"] as const) s.setLayer(l, false);
    expect(s.container.children).toHaveLength(9);
    expect(s.bloom).toBe("off");
  });
});

describe("destroy", () => {
  type Stub = { destroyed: boolean };

  it("destruye el bloomSlot creado por on aunque el modo actual sea off, y libera su filtro", () => {
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

  it("destruye el árbol con sus contextos y los filtros de sombra", () => {
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

  it("con el bloom en on el slot está en el árbol: se destruye una vez y libera su filtro", () => {
    const s = build();
    s.setBloom("on");
    const slot = bloomSlotOf(s.container)!, blur = (slot.filters as unknown as Stub[])[0]!;
    // el espejo no es dueño de su contexto: lo libera la Graphics original del árbol
    const mirror = slot.children[0] as Graphics, ctx = mirror.context;
    expect(() => s.destroy()).not.toThrow();
    expect(slot.destroyed).toBe(true);
    expect(blur.destroyed).toBe(true);
    expect(mirror.destroyed).toBe(true);
    expect(ctx.destroyed).toBe(true);
  });

  it("sin bloom armado nunca no lanza", () => {
    expect(() => build().destroy()).not.toThrow();
  });

  it("después de destroy, todo es no-op: destroy, setBloom, setLayer, setFocus y tick", () => {
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

describe("velo de las luces animadas", () => {
  const dot = (x: number, y: number): Accent => ({ kind: "dot", at: v3(x, y, 1), r: 1, color: "amber" });
  const port = dot(380, 118), blog = dot(500, 200);
  const toy = (layer: () => AnimLayer): ZonedAnimator => ({ zone: "blog", ids: ["luces"], layer, tick: () => new Set(["luces"]) });
  const stageWith = (a: ZonedAnimator) => buildStage(assembleWorld(["portfolio"], { reducedMotion: true }).scene, [a]);
  // Graphics animadas: las que siguen a las tres estáticas en accentSlot
  const animated = (s: ReturnType<typeof buildStage>) => accentSlotOf(s.container).children.slice(3) as Graphics[];
  const lit = (gs: Graphics[]) => gs.filter((g) => g.context.instructions.length > 0);

  it("una capa sin zona vela cada luz con la zona de su posición, aunque el animador sea de otra zona", () => {
    const s = stageWith(toy(() => ({ kind: "accent", accents: [port, blog] })));
    s.setFocus("portfolio"); s.tick(10_000);
    expect(lit(animated(s)).map((g) => g.alpha).sort()).toEqual([ACCENT_DIM, 1]);
    s.setFocus("blog"); s.tick(10_000);
    expect(lit(animated(s)).map((g) => g.alpha).sort()).toEqual([ACCENT_DIM, 1]);
  });
  it("una capa con zona vela todas sus luces con esa zona, en una sola Graphics", () => {
    const s = stageWith(toy(() => ({ kind: "accent", accents: [port, blog], zone: "blog", alpha: 0.5 })));
    expect(animated(s)).toHaveLength(1);
    s.setFocus("portfolio"); s.tick(10_000);
    expect(animated(s)[0]!.alpha).toBeCloseTo(0.5 * ACCENT_DIM);
  });
  it("si una zona de la capa se queda sin luces, su Graphics se vacía al redibujar", () => {
    let on = true;
    const s = stageWith(toy(() => ({ kind: "accent", accents: on ? [port, blog] : [blog] })));
    expect(lit(animated(s))).toHaveLength(2);
    on = false; s.tick(16);
    expect(lit(animated(s))).toHaveLength(1);
  });
  it("las luces estáticas mantienen su alpha por zona con cada foco", () => {
    const s = build();
    for (const f of WORLD_ZONES) {
      s.setFocus(f); s.tick(10_000);
      const statics = accentSlotOf(s.container).children.slice(0, 3);
      expect(statics.map((g) => g.alpha)).toEqual(WORLD_ZONES.map((z) => focusAlphas(f)[z].accents));
    }
  });
});
