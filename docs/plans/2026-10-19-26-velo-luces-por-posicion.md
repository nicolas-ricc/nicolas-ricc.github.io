# Velo de las luces animadas por posición (#26): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que cada luz animada fija (haz del faro, neones de la punta) se vele con la zona donde está parada, como las luces estáticas, y que las luces de cada barco se velen todas con la zona del barco.

**Architecture:** una función pura `accentsByZone(accents, zone?)` en `src/world/veil.ts` reparte acentos por zona: por posición (`accentZone`) o, si la capa declara una zona, todos en esa. Las capas de acentos del contrato `AnimLayer` ganan un `zone?: WorldZone` opcional que solo declaran las luces montadas en un barco (`sea.ferryLights` → Portfolio, `sea.lights{k}` → Blog). `buildStage` deja de usar la zona del animador para las luces: arma una Graphics por zona y por capa de acentos (una sola si la capa declara zona) y dibuja en cada una su parte del reparto.

**Tech Stack:** TypeScript, Vitest, PixiJS v8.

**Spec:** issue #26, segundo Agent Brief (comentario de triage, "Regla decidida").

## Global Constraints

- "Una luz se vela con la zona donde está parada, sea estática o animada."
- "Excepción: las luces que van montadas en un barco en movimiento se velan todas con la zona del barco [...] Blog para el carguero, el remolcador y el convoy, y Portfolio para la lancha."
- "Las capas no animadas no cambian de comportamiento." / "Los alfas de las luces estáticas no cambian."
- `focusAlphas(zone)`: "sin cambios". `worldZoneAt`: fuera de alcance, no se toca.
- Fuera de alcance: mover la frontera entre zonas, velar sólidos o agua animados por posición, optimizar el redibujo del mar (#71).
- `npm test` y `npm run typecheck` en verde. Textos, comentarios y nombres de test en castellano. Commits `feat(#26): …`, `test(#26): …`, `docs(#26): …`.

## Datos (medidos contra `main` `be29968`)

Barrido de 600 ticks de 500 ms sobre `assembleWorld(undefined, { reducedMotion: false })`, contando `accentZone` de cada acento de cada capa animada:

| Capa (zona del animador) | Portfolio | Resume | Blog |
|---|---|---|---|
| `sea.beam` (blog) | 1200 | 0 | 0 |
| `sea.neon` (blog) | 1800 | 0 | 4800 |
| `sea.ferryLights` (blog) | 3000 | 0 | 0 |
| `sea.lights0` (blog) | 28 | 0 | 2972 |
| `sea.lights1`, `sea.lights2`, `sea.buoys` (blog) | 0 | 0 | todas |
| capas de astillero, feria (portfolio) | todas | 0 | 0 |
| capas de ciudad, tech (cv) | 0 | todas | 0 |

Solo el mar tiene luces fuera de la zona de su animador. Para las demás capas el reparto por posición da el mismo resultado que hoy.

## Decisiones técnicas (declaradas)

1. **El escenario reparte, no el animador.** Es lo que el brief propone como alternativa ("que el escenario reparta las luces de una capa por zona como ya hace con las estáticas (`accentZone`)") y no cambia el contrato `Animator` más que con un campo opcional. Partir el animador del mar en dos dejaría la regla repartida en `assemble.ts` y no cubriría los neones de la punta, que caen en las dos zonas.
2. **La zona del barco la declara la capa.** `AnimLayer` de tipo `accent` gana `zone?: WorldZone`. Si está, toda la capa va a esa zona; si no, cada acento va a `accentZone(a)`. La declaran solo `sea.ferryLights` (`"portfolio"`) y `sea.lights{k}` (`"blog"`), con un valor constante, así que la zona de un barco no cambia en su ciclo.
3. **Una Graphics por zona y por capa.** Una capa sin zona declarada tiene tres Graphics (una por `WORLD_ZONES`), aunque alguna quede vacía; una con zona declarada, una. Se crean al armar el Stage, así que el espejo del bloom sigue saliendo de la lista `accents` sin cambios. Son 16 capas sin zona: ~32 Graphics más, vacías la mayoría, sin instrucciones de dibujo. Crear Graphics a demanda complicaría el bloom sin necesidad.
4. **`ZonedAnimator.zone` queda**: la usan el lab (`cropAnimators`, `exhibits.test.ts`) y `assemble.test.ts`. Deja de decidir el velo de las luces; su comentario se actualiza a "zona de origen del animador".
5. **Las luces estáticas pasan por la misma función.** El reparto `byZone` de `buildStage` se reemplaza por `accentsByZone(scene.accents)`: mismo resultado, una sola regla.
6. **No existe `CONTEXT.md`** aunque el brief lo cita. La regla queda en el comentario de `accentsByZone` y en el README; crear el glosario va a un follow-up.

## Review Focus

1. Una luz de neón de la punta que parpadea (ausente en un frame) no tiene que dejar su Graphics de zona con el dibujo viejo: cada redibujo limpia y dibuja las tres Graphics de la capa (tarea 3, test del escenario con una capa que se vacía).
2. Un barco que cruza la costa (el carguero toca Portfolio en 28 de ~3000 muestras) no se vela a medias: la tarea 2 barre el ciclo y verifica que hubo muestras en Portfolio y que la zona declarada no cambió.
3. El bloom: cada Graphics nueva necesita su espejo; el test existente "un espejo por Graphics de acentos" lo cubre con el mundo entero.
4. El alpha propio de la capa (barcos que se desvanecen, `alpha`) se sigue multiplicando por el de la zona en todas las Graphics de la capa (tarea 3).
5. Los alfas de las luces estáticas con foco en cada zona no cambian (tarea 3, test de estáticas).

---

### Task 1: `accentsByZone` en `veil.ts`

**Files:**
- Modify: `src/world/veil.ts` (al final, junto a `accentZone`)
- Test: `src/world/veil.test.ts`

**Interfaces:**
- Produces: `export function accentsByZone(accents: readonly Accent[], zone?: WorldZone): Record<WorldZone, Accent[]>`. Siempre devuelve las tres claves (`portfolio`, `cv`, `blog`), en arrays nuevos.

- [ ] **Step 1: test que falla.** En `veil.test.ts` importar `accentsByZone` y agregar:

```ts
describe("accentsByZone", () => {
  const dot = (x: number, y: number): Accent => ({ kind: "dot", at: v3(x, y, 1), r: 1, color: "amber" });
  const port = dot(380, 118), blog = dot(500, 200), cv = dot(-30, 300);
  it("sin zona, cada luz va a la zona de su posición (accentZone)", () => {
    expect(accentsByZone([port, blog, cv])).toEqual({ portfolio: [port], cv: [cv], blog: [blog] });
  });
  it("con zona, todas van a esa zona aunque estén en otra", () => {
    expect(accentsByZone([port, blog, cv], "blog")).toEqual({ portfolio: [], cv: [], blog: [port, blog, cv] });
  });
  it("sin luces devuelve las tres zonas vacías", () => {
    expect(accentsByZone([])).toEqual({ portfolio: [], cv: [], blog: [] });
  });
});
```

(`Accent` de `../iso/accent`; usar un `AccentColor` que exista en `src/map/palette-iso.ts`.)

- [ ] **Step 2:** `npx vitest run src/world/veil.test.ts` → FAIL (`accentsByZone` no existe).

- [ ] **Step 3: implementación.**

```ts
/**
 * Reparte luces por zona del velo: cada una con la zona donde está parada
 * (`accentZone`), salvo que la capa declare una zona (luces montadas en un
 * barco, que se velan enteras con la zona del barco).
 */
export function accentsByZone(accents: readonly Accent[], zone?: WorldZone): Record<WorldZone, Accent[]> {
  const out: Record<WorldZone, Accent[]> = { portfolio: [], cv: [], blog: [] };
  for (const a of accents) out[zone ?? accentZone(a)].push(a);
  return out;
}
```

- [ ] **Step 4:** `npx vitest run src/world/veil.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(#26): accentsByZone reparte luces por zona`.

### Task 2: zona declarada en las luces de los barcos

**Files:**
- Modify: `src/scenes/animator.ts` (tipo `AnimLayer`)
- Modify: `src/scenes/sea-animator.ts` (capas `sea.ferryLights` y `sea.lights${k}`)
- Test: `src/scenes/sea-animator.test.ts`

**Interfaces:**
- Produces: `AnimLayer` variante `{ kind: "accent"; accents: Accent[]; alpha?: number; zone?: WorldZone }` (`WorldZone` de `../map/geo`). Comentario: zona con que se velan todas las luces de la capa (luces montadas en un barco); sin ella, cada luz se vela con la zona de su posición.

- [ ] **Step 1: test que falla.** En `sea-animator.test.ts`:

```ts
it("las luces de cada barco declaran una sola zona en todo el ciclo: Portfolio la lancha, Blog los demás", () => {
  const a = seaAnimator(world(7).sea!, { reducedMotion: false });
  const ids = ["sea.ferryLights", ...SHIPS.map((_, k) => `sea.lights${k}`)];
  const zones = new Map<string, Set<unknown>>(ids.map((id) => [id, new Set()]));
  let carguero = 0; // muestras del carguero en tierra de Portfolio: prueba que el barrido cruza la costa
  for (let t = 0; t < 600; t++) {
    a.tick(500);
    for (const id of ids) {
      const l = a.layer(id);
      if (l.kind !== "accent") throw new Error(id);
      zones.get(id)!.add(l.zone);
      if (id === "sea.lights0") carguero += l.accents.filter((x) => accentZone(x) === "portfolio").length;
    }
  }
  expect([...zones.get("sea.ferryLights")!]).toEqual(["portfolio"]);
  SHIPS.forEach((_, k) => expect([...zones.get(`sea.lights${k}`)!]).toEqual(["blog"]));
  expect(carguero).toBeGreaterThan(0);
});
it("las luces fijas del mar (haz, neones, boyas) no declaran zona: se velan por posición", () => {
  const a = seaAnimator(world(7).sea!, { reducedMotion: false });
  for (const id of ["sea.beam", "sea.neon", "sea.buoys"]) expect(a.layer(id)).not.toHaveProperty("zone");
});
```

(`accentZone` de `../world/veil`.) El test del offscreen (`toEqual({ kind: "solid", solids: [], alpha: 0 })`) mira `sea.ship0`, no las luces: no cambia.

- [ ] **Step 2:** `npx vitest run src/scenes/sea-animator.test.ts` → FAIL (`zone` undefined).
- [ ] **Step 3: implementación.** En `animator.ts`, agregar `zone?: WorldZone` a la variante `accent` con el comentario de Interfaces. En `sea-animator.ts`:

```ts
"sea.ferryLights": () => { const f = anim.ferry(); return { kind: "accent", accents: f.lights, zone: "portfolio" }; },
// …
layers[`sea.lights${k}`] = () => { const f = anim.ship(k); return { kind: "accent", accents: f.lights, alpha: f.alpha, zone: "blog" }; };
```

Comentario corto junto a las dos: la lancha anda siempre por aguas de Portfolio; los barcos pasan casi todo su recorrido en Blog.

- [ ] **Step 4:** `npx vitest run src/scenes/` y `npm run typecheck` → PASS.
- [ ] **Step 5:** commit `feat(#26): las luces de los barcos declaran la zona del barco`.

### Task 3: el escenario vela las luces animadas por zona

**Files:**
- Modify: `src/world/stage.ts` (acentos estáticos y rama `accent` de las capas animadas, `AccentGraphics`, `applyAlphas`)
- Modify: `src/world/assemble.ts` (comentario de `ZonedAnimator`)
- Modify: `README.md` (línea de `stage.ts`: "capas, velos y luces por zona")
- Test: `src/world/stage.test.ts`, `src/world/assemble.test.ts`

**Interfaces:**
- Consumes: `accentsByZone` (tarea 1), `AnimLayer.zone` (tarea 2).
- `AccentGraphics.zone` pasa a `WorldZone` (no nullable): toda Graphics de acentos tiene zona.

- [ ] **Step 1: tests que fallan.**

En `assemble.test.ts` (criterio 1 del brief, con el mundo armado):

```ts
it("cada luz animada fija (haz, neones) queda asignada a worldZoneAt de su posición", () => {
  const { animators } = assembleWorld(undefined, { reducedMotion: false });
  const sea = animators.find((a) => a.ids.includes("sea.beam"))!;
  let port = 0;
  for (let t = 0; t < 40; t++) {
    sea.tick(250);
    for (const id of ["sea.beam", "sea.neon"]) {
      const l = sea.layer(id);
      if (l.kind !== "accent") throw new Error(id);
      const byZone = accentsByZone(l.accents, l.zone);
      for (const z of WORLD_ZONES) for (const a of byZone[z]) {
        const p = a.kind === "dot" ? a.at : a.pts[0]!;
        expect(z).toBe(worldZoneAt(p.x, p.y));
        if (z === "portfolio") port++;
      }
    }
  }
  expect(port).toBeGreaterThan(0); // el haz y la galería están en Portfolio
});
```

En `stage.test.ts`, con un mundo mínimo y un animador de juguete (armar el `WorldScene` con `assembleWorld(["portfolio"], …).scene` y pasar solo el animador de juguete):

```ts
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
    // la de Portfolio ahora se apaga y la de Blog se enciende
    const [gPort] = lit(animated(s)).filter((g) => g.alpha === ACCENT_DIM);
    expect(gPort).toBeDefined();
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
```

(Ajustar imports: `Accent`, `v3`, `AnimLayer`, `ZonedAnimator`, `ACCENT_DIM`, `focusAlphas`, `accentsByZone`, `worldZoneAt`. Verificar que `dot(380, 118)` es Portfolio y `dot(500, 200)` es Blog, como en `veil.test.ts`. El alpha exacto tras `tick(10_000)` es el objetivo porque `k = min(1, dt/LERP_MS) = 1`.)

- [ ] **Step 2:** `npx vitest run src/world/` → FAIL: el test de capa sin zona da `[ACCENT_DIM, ACCENT_DIM]` (todo con la zona del animador) y el de Graphics vacía ve una sola Graphics. El test del criterio 1 en `assemble.test.ts` ya puede pasar con tareas 1 y 2; es el ancla del criterio.

- [ ] **Step 3: implementación en `stage.ts`.**

Acentos estáticos: reemplazar el bucle `byZone` por `const byZone = accentsByZone(scene.accents);`.

Rama `accent` de las capas animadas:

```ts
} else {
  // una Graphics por zona: cada luz se vela con la zona donde está, salvo que la capa declare la suya (barcos)
  const declared = (a.layer(id) as AnimLayer & { kind: "accent" }).zone;
  const entries = (declared ? [declared] : WORLD_ZONES).map((zone): AccentGraphics => {
    const g = new Graphics();
    g.blendMode = "add";
    accentSlot.addChild(g);
    const e: AccentGraphics = { g, zone, base: 1, draw: () => draw() };
    accents.push(e);
    return e;
  });
  const draw = (): void => {
    const l = a.layer(id) as AnimLayer & { kind: "accent" };
    const byZone = accentsByZone(l.accents, l.zone);
    // el alpha propio de la capa (barcos que se desvanecen) se guarda; el alpha final lo pone el lerp
    for (const e of entries) { drawAccents(e.g, byZone[e.zone], halo); e.base = l.alpha ?? 1; }
  };
  redraw.set(id, draw);
}
```

`setBloom` llama `e.draw()` por cada entrada: con tres entradas por capa redibuja la capa tres veces al cambiar de halo; es un evento raro (cambio de modo), aceptable. Si se prefiere, cada `e.draw` puede dibujar solo su zona; mantener una sola forma.

`AccentGraphics.zone: WorldZone`; en `applyAlphas`, `e.g.alpha = e.base * current[e.zone].accents`.

`assemble.ts`: el comentario de `ZonedAnimator` pasa a "Un animador con su zona de origen (la del lab y los recortes); `null` es el agua. El velo de las luces no la usa: va por la posición de cada luz o por la zona que declare la capa."

`README.md`: `stage.ts` (capas, velos y luces por zona) → agregar que cada luz, estática o animada, se vela con la zona de su posición, salvo las luces de un barco, que siguen la zona del barco.

- [ ] **Step 4:** `npm test` y `npm run typecheck` → verde. Los tests de bloom existentes ("un espejo por Graphics de acentos") siguen valiendo con más Graphics.
- [ ] **Step 5:** commit `feat(#26): el escenario vela las luces animadas por posición`.

### Verificación en el navegador (criterio de capturas)

Script en `.scratch/evals-26.md` (no versionado): sitio en `http://localhost:5173/lab/world.html`, tecla `5` para rotar el foco a Portfolio y a Blog, `?bloom=off`, encuadre `1`/`3`, captura de la punta del faro; contar con `__PIXI_DEVTOOLS_WRAPPER__.stage` las Graphics de acentos animadas y sus alfas. Lo esperado: con foco en Portfolio la ventana del farero y el cartel/galería/haz quedan a alpha 1; con foco en Blog ambos a `ACCENT_DIM`.
