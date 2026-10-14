import { describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("pixi.js")>();
  // los filtros reales compilan shaders WebGL: en node solo importa que existan y con qué opciones
  class StubFilter { constructor(readonly options?: unknown) {} }
  return { ...real, AlphaFilter: StubFilter, BlurFilter: StubFilter };
});

import type { Container, Graphics } from "pixi.js";
import { assembleWorld } from "./assemble";
import { HALO_BASE, HALO_FALLBACK } from "./frame";
import { BLOOM_FILTER, buildStage, nextHalo } from "./stage";
import { WORLD_ZONES } from "./veil";

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
