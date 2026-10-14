# Neones de la punta y el faro (Blog) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el faro tenga una galería de ocho luces magenta que corre en sentido contrario al haz, que la costa al este de la punta tenga una hilera de luces cian que pulsan como una onda, y que la casa del farero tenga un cartel cian/magenta que alterna cada 4 s.

**Architecture:** La escena `sea.ts` expone la geometría estática nueva en `SeaScene.neon` (`gallery`, `coast`, `keeperSign`). El animador puro `sea-anim.ts` gana la capa `neon()` y el cambio `neon` en `SeaChanges`; `sea-animator.ts` la publica como `sea.neon`. No se agregan animadores: la capa vive en el animador del mar, etiquetado `blog` en `assemble.ts`, y hereda el velo.

**Tech Stack:** TypeScript strict, Vitest, pixi.js 8 (solo en `src/world/` y `src/lab/`, no se toca).

**Spec:** issue #15 (cuerpo completo, "Qué hacer" y "Criterios de aceptación comunes"), dentro de la historia #11 (brief del triage y plan del planner en los comentarios de #11). Helper `src/scenes/neon.ts` ya existe en la rama base (lo dejó #13).

## Global Constraints

- `src/iso/` y `src/scenes/` no importan `pixi.js` (`src/iso/pixi-free.test.ts`).
- No se agregan colores ni se tocan valores del atlas; ningún literal hex fuera de `src/map/palette-iso.ts` / `palette-base.ts` / `seed.ts` (`src/map/palette-guard.test.ts`).
- Colores de los neones nuevos: solo `cyan*` y `magenta*`. Los acentos estáticos existentes del mar (`s.accents`: ventana `magentaBleed` y luz del pecio `magentaMid`) no cambian.
- Frame 0 = todo encendido y quieto, igual al estado de reduced motion. Con `reducedMotion: true`, `tick` no reporta nada y las capas devuelven ese estado fijo.
- El mar no recibe `rng`: todo deriva de `clock`. `Math.random` prohibido.
- No agregar animadores (`src/world/assemble.test.ts` cuenta 1 en `blog` más el agua); agregar la capa al animador del mar.
- Constantes del issue: galería 8 luces `magenta`, `r = 0.45`, paso `200` ms, `chase(8, step, 2)` girando al revés del haz; costa `cyan`, `r = 0.3 + 0.3·pulse(clock, 3000, k / n)` cuantizado al paso de 200 ms; cartel `flip(Math.floor(clock / 4000), "cyan", "magenta")`.
- Comentarios y textos de tests en español, como el resto del repo. `npm test` y `npm run typecheck` verdes al final de cada task.

## Decisiones técnicas (declaradas)

- **Radio de la galería.** "Radio del fuste" = radio del último tambor, el que está a la altura de la galería: `DRUM_R0 − (DRUMS − 1)·DRUM_STEP = 2.2`. Radio de las luces `2.2 + 0.5 = 2.7`, el mismo de los ocho postes de la baranda: las luces quedan sobre la baranda. Altura `lantern.z − 2`. Ángulos `k/8·2π`, como los postes.
- **Costa en zona Blog.** `worldZoneAt` devuelve `portfolio` para la punta y para todo lo que está a menos de `SHORE_W = 12` u de ella, así que ningún punto "sobre tierra" de la punta puede ser `blog`. El issue resuelve el choque: "si algún punto cayera en Portfolio, correrlo al este: el test lo exige". Las luces de costa quedan como balizas a `z = 1.2` sobre el agua, en un arco a ~12.8 u del borde de la punta, rodeando la punta por el este desde el NE hasta el SE. Ocho puntos fijos, verificados con `worldZoneAt` (todos `blog`, terreno `sea`) y separados 5.6..6.3 u:
  `(397.5, 99.5) (403, 101.5) (408, 104) (411.5, 108.5) (413, 114.5) (413, 120.5) (412, 126.5) (408.5, 131.5)`.
- **Sentido del chase.** El haz gira con ángulo creciente (`beamAngle` crece con `clock`) y `chase(n, step, lit)` enciende `(k − step) mod n < lit`, que con `k` creciente = ángulo creciente avanza en el mismo sentido que el haz. Se usa `chase(8, −step, 2)` (el módulo de `chase` ya es no negativo).
- **Frame 0.** Mientras `neonStep === 0` (o con reduced motion): galería `chase(8, 0, 2)` (luces 0 y 1), costa con `pulse = 1` (`r = 0.6` en todas), cartel `cyan`. Desde el paso 1 corren chase, onda y flip. Así frame 0 = estado de reduced motion, como en `tech-anim.ts`.
- **Cartel del farero.** La casa es un prisma `8 × 6 × 4` con techo a dos aguas (cumbrera a lo largo de x, `w ≥ d`). El cartel es un `poly` vertical en la cara sur (`y = KEEPER.y + 6.02`, mismo plano que la ventana), centrado en x (`KEEPER.x + 3 .. KEEPER.x + 5`), del alero (`z + 4`) a `z + 5`: apoyado en el techo, del lado sur. Sin caja de fondo (el `sign()` de tech pone un prisma oscuro; acá el issue pide solo el `poly`, y un sólido nuevo cambiaría el conteo y el orden de profundidad de la punta). Color base `cyan`, `alpha: 1`.

## Review Focus

1. **Frame 0 de la costa.** `pulse(0, 3000, k / n)` no vale 1 para `k > 0`; sin la regla de paso 0, frame 0 no sería el estado de reduced motion. Test: `neon()` antes de cualquier `tick` es igual con `reducedMotion` true y false.
2. **Sentido de giro de la galería.** Un `chase(8, step, 2)` "natural" gira con el haz. Test: tras `tick(200)` las luces encendidas son `{7, 0}` (avanzó hacia índices menores).
3. **Costa fuera de Portfolio.** Un punto corrido mal cae en la orilla de la punta. Test: cada punto da `worldZoneAt === "blog"`, más separación 5..7 u entre consecutivos y todos al este del faro.
4. **Acentos estáticos intactos.** Agregar el cartel a `accents` en lugar de a `neon` lo duplicaría y rompería el test existente de `s.accents`. Ese test se conserva sin cambios.
5. **Velo y zona.** La capa nueva cae en el animador `zone: "blog"`; `focusAlphas("cv").blog.accents === ACCENT_DIM`. Test en `assemble.test.ts`.

---

## Mapa de archivos

| Archivo | Estado | Responsabilidad |
| --- | --- | --- |
| `src/scenes/sea.ts` | Modificar | `SeaScene.neon`, constantes `GALLERY_R`, `COAST`, `COAST_Z`, funciones de geometría |
| `src/scenes/sea.test.ts` | Modificar | Tests de geometría de galería, costa y cartel |
| `src/scenes/sea-anim.ts` | Modificar | `neon()`, `SeaChanges.neon`, constantes `NEON_STEP_MS`, `COAST_PERIOD_MS`, `KEEPER_SIGN_MS` |
| `src/scenes/sea-anim.test.ts` | Modificar | Tests de la capa `neon` y del `SeaChanges` con `neon` |
| `src/scenes/sea-animator.ts` | Modificar | id `sea.neon` |
| `src/scenes/sea-animator.test.ts` | Modificar | ids, reduced motion, cambio y determinismo |
| `src/world/assemble.test.ts` | Modificar | `sea.neon` en el animador `blog` y velo |
| `docs/superpowers/specs/assets/2026-10-14-cyberpunk/15-*.png` | Crear | Captura del lab con Blog enfocado |

---

### Task 1: Geometría de los neones en `sea.ts`

**Files:**
- Modify: `src/scenes/sea.ts`
- Test: `src/scenes/sea.test.ts`

**Interfaces:**
- Produces: `SeaScene.neon: { gallery: Vec3[]; coast: Vec3[]; keeperSign: Accent }`; exports `GALLERY_R = 2.7`, `COAST: readonly Vec2[]`, `COAST_Z = 1.2`.

- [ ] **Step 1: Write the failing test** (en `sea.test.ts`, nuevo `it` dentro de `describe("sea")`; importar `COAST`, `COAST_Z`, `GALLERY_R` de `./sea`)

```ts
  it("neones: galería de ocho luces alrededor del fuste, balizas de costa en Blog y cartel cian del farero", () => {
    const s = scene();
    const { gallery, coast, keeperSign } = s.neon;
    expect(gallery).toHaveLength(8);
    for (const p of gallery) {
      expect(p.z).toBeCloseTo(s.lantern.z - 2, 6);
      expect(Math.abs(Math.hypot(p.x - LIGHTHOUSE.x, p.y - LIGHTHOUSE.y) - GALLERY_R)).toBeLessThan(1e-6);
    }
    expect(GALLERY_R).toBeCloseTo(2.2 + 0.5, 6); // último tambor + 0.5
    expect(coast.length).toBeGreaterThanOrEqual(6); expect(coast.length).toBeLessThanOrEqual(10);
    expect(coast).toEqual(COAST.map((p) => ({ x: p.x, y: p.y, z: COAST_Z })));
    expect(COAST_Z).toBe(1.2);
    coast.forEach((p, k) => {
      expect(worldZoneAt(p.x, p.y)).toBe("blog");
      expect(p.x).toBeGreaterThan(LIGHTHOUSE.x);
      if (k > 0) { const d = Math.hypot(p.x - coast[k - 1]!.x, p.y - coast[k - 1]!.y); expect(d).toBeGreaterThan(5); expect(d).toBeLessThan(7); }
    });
    const z = headlandZ(KEEPER.x + 4);
    expect(keeperSign.kind).toBe("poly");
    if (keeperSign.kind !== "poly") return;
    expect(keeperSign.color).toBe("cyan");
    const xs = keeperSign.pts.map((p) => p.x), ys = keeperSign.pts.map((p) => p.y), zs = keeperSign.pts.map((p) => p.z);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2, 6);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1, 6);
    expect(Math.min(...zs)).toBeCloseTo(z + 4, 6); // apoyado en el alero
    for (const y of ys) expect(y).toBeCloseTo(KEEPER.y + 6.02, 6); // cara sur
    expect(s.accents).toHaveLength(2); // los acentos estáticos no cambian
  });
```

- [ ] **Step 2: Run** `npx vitest run src/scenes/sea.test.ts` — Expected: FAIL (`s.neon` undefined / exports missing).

- [ ] **Step 3: Implement** en `sea.ts`:

```ts
export interface SeaScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; lantern: Vec3; buoys: Vec3[]; neon: { gallery: Vec3[]; coast: Vec3[]; keeperSign: Accent } }

/** Galería de neón: sobre la baranda, último tambor + 0.5. */
export const GALLERY_R = DRUM_R0 - (DRUMS - 1) * DRUM_STEP + 0.5;
/**
 * Balizas de costa: arco a ~12.8 u de la punta, de NE a SE por el este. La punta y su orilla
 * (12 u) son Portfolio para `worldZoneAt`; a esta distancia ya es Blog (lo fija sea.test.ts).
 */
export const COAST: readonly Vec2[] = [{ x: 397.5, y: 99.5 }, { x: 403, y: 101.5 }, { x: 408, y: 104 }, { x: 411.5, y: 108.5 }, { x: 413, y: 114.5 }, { x: 413, y: 120.5 }, { x: 412, y: 126.5 }, { x: 408.5, y: 131.5 }];
export const COAST_Z = 1.2;
```

(`GALLERY_R` va después de las constantes `DRUMS`, `DRUM_R0`, `DRUM_STEP`.)

`keeperHouse` devuelve el cartel (además de empujar la ventana como hoy):

```ts
function keeperHouse(out: Solid[], accents: Accent[]): Accent {
  // ... igual que hoy ...
  const sx = KEEPER.x + 3; // cartel sobre el techo, en la cara sur: 2 × 1, apoyado en el alero
  return { kind: "poly", pts: [v3(sx, wy, z + 4), v3(sx + 2, wy, z + 4), v3(sx + 2, wy, z + 5), v3(sx, wy, z + 5)], color: "cyan", alpha: 1 };
}
```

En `sea()`:

```ts
  const lantern = lighthouse(solids);
  const keeperSign = keeperHouse(solids, accents);
  ...
  const gallery = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return v3(LIGHTHOUSE.x + GALLERY_R * Math.cos(a), LIGHTHOUSE.y + GALLERY_R * Math.sin(a), lantern.z - 2); });
  return { ground, solids, accents, lantern, buoys, neon: { gallery, coast: COAST.map((p) => v3(p.x, p.y, COAST_Z)), keeperSign } };
```

- [ ] **Step 4: Run** `npx vitest run src/scenes/sea.test.ts && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(#15): galería, balizas de costa y cartel del farero en la escena del mar"`

### Task 2: Capa `neon()` en `sea-anim.ts`

**Files:**
- Modify: `src/scenes/sea-anim.ts`
- Test: `src/scenes/sea-anim.test.ts`

**Interfaces:**
- Consumes: `SeaScene.neon` (Task 1); `chase`, `flip`, `pulse` de `./neon`.
- Produces: `SeaAnim.neon(): Accent[]`; `SeaChanges.neon: boolean`; exports `NEON_STEP_MS = 200`, `COAST_PERIOD_MS = 3000`, `KEEPER_SIGN_MS = 4000`.
- Orden de la capa: primero las luces encendidas de la galería (dots `magenta`, `r = 0.45`), luego las de costa (dots `cyan`), al final el cartel.

- [ ] **Step 1: Write the failing tests** (nuevo `describe("neones")` en `sea-anim.test.ts`; importar `NEON_STEP_MS` y `KEEPER_SIGN_MS`):

```ts
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
    a.tick(KEEPER_SIGN_MS);
    expect(sign(a.neon()).color).toBe("magenta");
    a.tick(KEEPER_SIGN_MS);
    expect(sign(a.neon()).color).toBe("cyan");
  });
});
```

Y en el test existente de reduced motion (línea ~113) el objeto esperado gana `neon: false`:
`expect(r.tick(500)).toEqual({ ships: false, beam: false, buoys: false, ferry: false, neon: false });`

(Importar `type Accent` de `../iso/accent` si el archivo no lo tiene.)

- [ ] **Step 2: Run** `npx vitest run src/scenes/sea-anim.test.ts` — Expected: FAIL (`a.neon` is not a function).

- [ ] **Step 3: Implement** en `sea-anim.ts`:

```ts
import { chase, flip, pulse } from "./neon";
...
export const NEON_STEP_MS = 200, COAST_PERIOD_MS = 3000, KEEPER_SIGN_MS = 4000;
const GALLERY_R_DOT = 0.45, GALLERY_LIT = 2;

export interface SeaChanges { ships: boolean; beam: boolean; buoys: boolean; ferry: boolean; neon: boolean }
// SeaAnim gana: neon(): Accent[];

// dentro de createSeaAnim:
  let neonStep = 0;
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
```

(Con reduced motion `tick` nunca avanza `neonStep`, así que queda en 0.) En `tick`: `none` y `c` ganan `neon: false`, y antes del `return c`:

```ts
      const ns = Math.floor(clock / NEON_STEP_MS);
      if (ns !== neonStep) { neonStep = ns; c.neon = true; }
```

Agregar `neon` al objeto devuelto. Actualizar el docstring del módulo para mencionar los neones de la punta.

- [ ] **Step 4: Run** `npx vitest run src/scenes/ && npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(#15): la galería corre al revés del haz, la costa ondula y el cartel alterna"`

### Task 3: `sea.neon` en el animador y en el mundo ensamblado

**Files:**
- Modify: `src/scenes/sea-animator.ts`
- Test: `src/scenes/sea-animator.test.ts`, `src/world/assemble.test.ts`

**Interfaces:**
- Consumes: `SeaAnim.neon()`, `SeaChanges.neon` (Task 2).
- Produces: id `sea.neon` (`kind: "accent"`).

- [ ] **Step 1: Write the failing tests.** En `sea-animator.test.ts` agregar `"sea.neon"` a la lista de `arrayContaining` y:

```ts
  it("sea.neon es una capa de acentos cian/magenta que cambia al avanzar el reloj", () => {
    const a = seaAnimator(world(7).sea!, { reducedMotion: false });
    const l0 = a.layer("sea.neon");
    expect(l0.kind).toBe("accent");
    if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
    expect(a.tick(200).has("sea.neon")).toBe(true);
    expect(a.layer("sea.neon")).not.toEqual(l0);
    expect(seaAnimator(world(7).sea!, { reducedMotion: true }).tick(1000).has("sea.neon")).toBe(false);
  });
  it("mismo seed → misma secuencia", () => {
    const mk = () => seaAnimator(world(7).sea!, { reducedMotion: false });
    const a = mk(), b = mk();
    for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
  });
```

En `assemble.test.ts`, junto al test de `tech.neon` y con el mismo estilo:

```ts
  it("la capa sea.neon vive en un animador de Blog y se atenúa con el velo", () => {
    const { animators } = assembleWorld(undefined, { reducedMotion: true });
    const a = animators.find((x) => x.ids.includes("sea.neon"));
    expect(a?.zone).toBe("blog");
    expect(focusAlphas("cv").blog.accents).toBe(ACCENT_DIM);
  });
```

- [ ] **Step 2: Run** `npx vitest run src/scenes/sea-animator.test.ts src/world/assemble.test.ts` — Expected: FAIL (`sea.neon` no existe).
- [ ] **Step 3: Implement** en `sea-animator.ts`: `"sea.neon": () => ({ kind: "accent", accents: anim.neon() }),` en `layers`, `if (c.neon) out.add("sea.neon");` en `tick`, y el docstring menciona los neones.
- [ ] **Step 4: Run** `npm test && npm run typecheck` — Expected: PASS (suite completa, incluye pixi-free y palette-guard).
- [ ] **Step 5: Commit** `git commit -m "feat(#15): el animador del mar publica sea.neon"`

### Task 4: Captura del lab con Blog enfocado

**Files:**
- Create: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/15-sea-neon-blog.png` (y un zoom del faro si ayuda, `15-sea-neon-blog-zoom.png`)

- [ ] **Step 1:** `npm run dev -- --host --port 5173` y abrir `http://localhost:5173/lab/world.html` con `agent-browser`; tecla `3` encuadra Blog. Verificar a ojo: anillo magenta en la galería del faro, hilera cian al este de la punta, cartel sobre la casa del farero.
- [ ] **Step 2:** Captura a pantalla completa guardada en la ruta de arriba; con `?speed=0.2` y una segunda captura unos segundos después, confirmar que el anillo y el cartel cambiaron.
- [ ] **Step 3: Commit** `git commit -m "docs(#15): captura del lab con Blog enfocado"`
