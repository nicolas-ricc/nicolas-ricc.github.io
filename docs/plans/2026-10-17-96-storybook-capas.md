# Storybook 5 (#96): conmutadores de capa y bloom — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** en `/lab/storybook.html`, `g`, `h` y `a` ocultan o muestran el suelo, las sombras y los acentos (con el bloom), y esos tres estados sobreviven al cambio de exhibit; `6`, `?bloom=` y `?speed=` siguen funcionando como hoy.

**Architecture:** `src/world/stage.ts` suma `Stage.setLayer(layer, visible)`, que solo cambia `visible` de contenedores que ya existen (`gBleed`, `waterSlot`, `gGround`; `shadowSlot`, `coreSlot`; `accentSlot` y `bloomSlot`) y recuerda la visibilidad de los acentos para que un `bloomSlot` armado más tarde nazca igual. `src/lab/storybook.ts` guarda un `Record<StageLayer, boolean>` en `boot()`, lo conmuta con las teclas y lo reaplica en `show()` junto al modo de bloom. El sitio y `page.ts` no llaman a `setLayer`.

**Tech Stack:** TypeScript estricto, Vite, PixiJS v8 (solo en la página y en `stage.ts`), Vitest (Pixi real sin WebGL; los filtros se stubean como ya hace `stage.test.ts`).

**Spec:** issue #96 (manda donde difiera); `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §5 (`setLayer`) y §6 (teclas, bloom, `?speed=`).

## Global Constraints

- `setLayer` solo cambia `visible` de contenedores existentes; no redibuja, no crea ni destruye nada. "El sitio no lo llama: nada cambia fuera del lab."
- Reusar `bloomFromSearch` y `nextBloomMode` de `src/lab/page.ts` (ya importados por `storybook.ts`).
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo.
- Todo color sale de `src/map/palette-iso.ts`; `Math.random` prohibido. Sin dependencias nuevas. Commits `feat(#96): …`.
- `lab/world.html` y el sitio se ven igual que antes. `npm test` y `npm run typecheck` en verde.

## Estado de partida (lo que ya está en `main`, de #92)

`storybook.ts` ya tiene `6` (con `nextBloomMode`), `?bloom=` (con `bloomFromSearch` pasado como `force` a `attachBloom`), `?speed=` y reaplica el modo de bloom vigente en `show()` con `stage.setBloom(mode)`. `attachBloom` recibe un proxy `live` que apunta siempre al stage vigente: mide una sola vez (sobre el stage que haya cuando corre la tarea diferida) y no vuelve a medir al cambiar de exhibit. Este issue no toca ese camino; solo lo verifica en el navegador.

## Decisiones técnicas (declaradas)

1. **Tipo exportado.** `export type StageLayer = "ground" | "shadow" | "accents"` en `stage.ts`; la firma del issue (`setLayer(layer: "ground" | "shadow" | "accents", visible)`) queda igual, con nombre.
2. **Agua animada dentro de "suelo".** Las Graphics del agua animada viven en `waterSlot` (`stage.ts`), así que ocultar `waterSlot` oculta agua estática y animada, como pide el issue ("sangrado, agua y suelo").
3. **Sombras de sólidos animados.** Las Graphics de sombra de los barcos viven dentro de `shadowSlot`/`coreSlot`: `h` las oculta también, sin código extra.
4. **Bloom y acentos.** `setLayer("accents", v)` pone `v` en `accentSlot` y, si existe, en `bloomSlot` (esté o no colgado del container). `buildBloomSlot` lee la visibilidad recordada al crear el slot. No se toca `applyAlphas`: alpha y visible son independientes.
5. **Estado de las teclas.** `const layers: Record<StageLayer, boolean> = { ground: true, shadow: true, accents: true }` en `boot()`; `g`/`h`/`a` (minúsculas, como `j`/`k`; con Alt/Ctrl/Meta no hacen nada, como ya pasa con las flechas) invierten la entrada y llaman a `stage.setLayer`. `show()` reaplica las tres después de `buildStage` y antes de `setBloom(mode)`, así un bloom ya armado nace oculto si los acentos están apagados.
6. **Medición con acentos ocultos.** Si el usuario apaga los acentos antes de que corra `attachBloom`, la medición se hace con el bloom oculto (más barato). Se acepta: es una página de laboratorio y `?bloom=` existe para fijar el modo. No se agrega lógica.
7. **Ayuda en el html.** El `aria-label` de `#lab-host` en `lab/storybook.html` suma `g`, `h` y `a`. README y el estado de la spec quedan para #97 (cierre de la historia).
8. **Captura.** La captura de un exhibit sin suelo ni sombras se commitea en `docs/superpowers/specs/assets/96-storybook/` y el PR la enlaza con `?raw=true`, como en #92/#94.

## Review Focus

1. Apagar acentos con bloom `off` y después pulsar `6` hasta `on`: el `bloomSlot` recién armado nace oculto (test en Task 1).
2. Apagar acentos con bloom `on`, pasar a `fallback` y volver a `on`: el slot reinsertado sigue oculto (test en Task 1).
3. Volver a mostrar una capa la deja exactamente como estaba (`visible === true` en los mismos contenedores, nada más cambia) (test en Task 1).
4. Un stage nuevo (cambio de exhibit) hereda los tres conmutadores y el modo de bloom (agent-browser, Task 2).
5. `setLayer` no toca velos ni sólidos: con las tres capas ocultas siguen visibles `gSolid`, `solidSlot` y `veilSlot` (test en Task 1).

---

### Task 1: `Stage.setLayer` en `src/world/stage.ts`

**Files:**
- Modify: `src/world/stage.ts`
- Test: `src/world/stage.test.ts`

**Interfaces:**
- Produces:
  - `export type StageLayer = "ground" | "shadow" | "accents";`
  - en `interface Stage`: `setLayer(layer: StageLayer, visible: boolean): void;`

Orden de `container.children` sin bloom (ya fijado por `buildStage`): `0 gBleed, 1 waterSlot, 2 gGround, 3 shadowSlot, 4 coreSlot, 5 gSolid, 6 solidSlot, 7 veilSlot, 8 accentSlot`. Con bloom `on`, el `bloomSlot` entra en el índice 8 y `accentSlot` pasa al 9.

- [ ] **Step 1: tests que fallan** (los escribe la etapa de evals; verificar que estén). Agregar a `stage.test.ts` un `describe("setLayer", …)`:

```ts
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
```

- [ ] **Step 2: correrlos y ver que fallan**

Run: `npx vitest run src/world/stage.test.ts`
Expected: FAIL (`s.setLayer is not a function`) y error de tipos en `npm run typecheck`.

- [ ] **Step 3: implementación mínima** en `stage.ts`:

```ts
export type StageLayer = "ground" | "shadow" | "accents";

export interface Stage {
  // …lo que ya está…
  /** Solo para el laboratorio: cambia `visible` de los contenedores de una capa; el sitio no lo llama. */
  setLayer(layer: StageLayer, visible: boolean): void;
}
```

Dentro de `buildStage`, junto a `bloomSlot`: `let accentsVisible = true;`. En `buildBloomSlot`, después de crear el slot: `slot.visible = accentsVisible;`. En el objeto devuelto:

```ts
    setLayer(layer, visible) {
      if (layer === "ground") gBleed.visible = waterSlot.visible = gGround.visible = visible;
      else if (layer === "shadow") shadowSlot.visible = coreSlot.visible = visible;
      else {
        accentsVisible = accentSlot.visible = visible;
        if (bloomSlot) bloomSlot.visible = visible;
      }
    },
```

Actualizar el docstring de `buildStage` con una línea: "`setLayer` (solo el lab) oculta capas cambiando `visible`; un `bloomSlot` armado después nace con la visibilidad de los acentos."

- [ ] **Step 4: correr y ver que pasan**

Run: `npx vitest run src/world/stage.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add src/world/stage.ts src/world/stage.test.ts
git commit -m "feat(#96): Stage.setLayer para ocultar suelo, sombras y acentos"
```

---

### Task 2: teclas `g`/`h`/`a` en el storybook

**Files:**
- Modify: `src/lab/storybook.ts`
- Modify: `lab/storybook.html` (solo el `aria-label` de `#lab-host`)
- Verificación: `.scratch/evals-96.md` (agent-browser; no se commitea)

**Interfaces:**
- Consumes: `type StageLayer` y `Stage.setLayer(layer: StageLayer, visible: boolean): void` de `src/world/stage.ts` (Task 1).

No hay test unitario: `storybook.ts` es un script de página (DOM + `Application`), y el repo no testea las páginas del lab (`page.ts` solo testea sus funciones puras). La verificación es el script de agent-browser de la etapa de evals.

- [ ] **Step 1: estado y teclas.** En `storybook.ts`:
  - importar `type StageLayer` desde `../world/stage`;
  - a nivel de módulo, junto a `NEXT`/`PREV` o arriba de `boot()`: `const LAYER_KEY: Record<string, StageLayer> = { g: "ground", h: "shadow", a: "accents" };`
  - en `boot()`, junto a `let stage …`: `const layers: Record<StageLayer, boolean> = { ground: true, shadow: true, accents: true };`
  - en `show()`, después de `app.stage.addChild(stage.container)` y antes de `stage.setBloom(mode)`: `for (const l of Object.keys(layers) as StageLayer[]) stage.setLayer(l, layers[l]);`
  - en el `keydown` (después del `return` por modificadores):

```ts
    const layer = LAYER_KEY[ev.key];
    if (layer && stage && !ev.repeat) { layers[layer] = !layers[layer]; stage.setLayer(layer, layers[layer]); if (log) console.info(`[storybook] ${layer}: ${layers[layer] ? "visible" : "oculto"}`); }
```

  - `!ev.repeat`: mantener pulsada la tecla no hace parpadear la capa (supuesto A3).
  - actualizar el comentario de cabecera: "g, h y a ocultan o muestran suelo, sombras y acentos (con el bloom) y se recuerdan entre exhibits."

- [ ] **Step 2: html.** En `lab/storybook.html`, el `aria-label` de `#lab-host` pasa a: `Storybook de estructuras: un exhibit a la vez. Flechas o j/k cambian de exhibit. Teclas g, h y a ocultan o muestran suelo, sombras y acentos. Tecla 6 rota el bloom: off, on, fallback.`

- [ ] **Step 3: typecheck y suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: navegador.** Levantar `npm run dev -- --host --port 5173` y correr `.scratch/evals-96.md` (agent-browser con PixiJS DevTools, viewport 1600 900 2). Debe pasar entero; guardar la captura de un exhibit sin suelo ni sombras en `docs/superpowers/specs/assets/96-storybook/sin-suelo-ni-sombras.png` y una de `lab/world.html` para comparar contra `main`.

- [ ] **Step 5: commit**

```bash
git add src/lab/storybook.ts lab/storybook.html docs/superpowers/specs/assets/96-storybook/
git commit -m "feat(#96): teclas g, h y a en el storybook, recordadas entre exhibits"
```

---

## Assumptions

Decisiones técnicas tomadas en la revisión del plan, sin fuente escrita; van al PR.

- **A1. Visibilidad del bloomSlot.** `setBloom` (`stage.ts:146-154`) solo hace `addChildAt`/`removeFromParent` y nunca escribe `visible`; `buildBloomSlot` (`stage.ts:128-138`) arma el slot una sola vez. Con `slot.visible = accentsVisible` al crearlo y `setLayer` escribiendo en el slot aunque esté desmontado, ningún camino vuelve a ponerlo en `true`. Alternativa descartada: reaplicar la visibilidad dentro de `setBloom` en cada `on` (dos lugares que escriben lo mismo).
- **A2. Medición con acentos ocultos.** Si `attachBloom` corre con los acentos apagados, mide un bloom oculto. Se acepta sin lógica extra (página de lab; `?bloom=` fija el modo). Alternativa descartada: diferir la medición hasta que los acentos estén visibles.
- **A3. Autorrepetición.** `g`/`h`/`a` ignoran `ev.repeat` (el handler actual no lo filtra, `storybook.ts:89-93`). Alternativa descartada: conmutar en cada repetición (parpadeo).
- **A4. Minúsculas.** Solo `g`/`h`/`a` en minúscula, como `j`/`k` en `NEXT`/`PREV` (`storybook.ts:88`); Shift o Bloq Mayús no conmutan. Alternativa descartada: aceptar también mayúsculas o `ev.code`.
- **A5. Sin test unitario de las teclas.** El conmutador queda en `storybook.ts` (una línea por tecla); la verificación es agent-browser con capturas commiteadas. Alternativa descartada: un helper puro en `page.ts`, un módulo de la página del mundo que no tiene estas teclas.
- **A6. "Se ve igual que antes".** `lab/world.html` y el sitio se comparan contra `main` con `rendering.capture().totals` de PixiJS DevTools (mismos conteos) y captura a ojo. Alternativa descartada: diff de píxeles (el agua y los barcos animan; dos capturas nunca coinciden).

## Grilling

- Rondas: 1 (el plan no cambió de forma sustancial: un filtro `!ev.repeat` y supuestos declarados). Griller: `fable`.
- Preguntas: 16. Respuestas: CODE 9, ISSUE 3, DOC 1 (spec), sin fuente 6 → supuestos técnicos A1–A6 (A1 también tiene CODE). Ambigüedades de spec: 0. Fuera de alcance: 0.

| # | Respuesta |
|---|-----------|
| 1 | CODE: `src/world/stage.ts:146-154` — `setBloom` solo monta/desmonta; nadie escribe `bloomSlot.visible`. Step 3 lo escribe al crear (`accentsVisible`) y en `setLayer`, montado o no. → A1 |
| 2 | ISSUE: "`stage.test.ts`: `setLayer` cambia `visible` …" → Task 1; "Teclas `g`/`h`/`a`/`6` y `?bloom=`/`?speed=` funcionan; captura de un exhibit sin suelo ni sombras en el PR" → Task 2 Step 4 + decisión 8; "`lab/world.html` y el sitio se ven igual que antes" → Task 2 Step 4 + A6; "`npm test` y `npm run typecheck` en verde" → Task 1 Step 4 y Task 2 Step 3. `6`/`?bloom=`/`?speed=` ya existen (`storybook.ts:86-96`); se verifican en el navegador. |
| 3 | CODE: `stage.ts:55` agrega los nueve hijos en ese orden, incondicionalmente (`waterSlot` se crea en `:50`); `stage.test.ts` ya aserta `toHaveLength(9)` y que `accentSlot` es el último. `build()` arma el mundo entero (`assembleWorld(undefined, …)`), no una región. |
| 4 | CODE: `stage.ts:105` — `shadowSlot.addChild(gs); coreSlot.addChild(gc); solidSlot.addChild(g)`. |
| 5 | CODE: `stage.ts:101` (`waterSlot.addChild(g)` para capas `water`); `tick` (`:155-163`) y `applyAlphas` (`:124-127`) solo escriben `alpha`, nunca `visible`. |
| 6 | CODE: `storybook.ts:85` — `live.setBloom` delega en `stage.setBloom`; el slot que arma `buildBloomSlot` nace con `accentsVisible` (A1), sin depender del orden de `show()`. |
| 7 | Sin fuente → A2. |
| 8 | CODE: `stage.test.ts` define `build()` y `bloomSlotOf(c)` (busca entre los hijos del container). El test "on → fallback → on" vuelve a montar el slot antes de asertar, así que `bloomSlotOf` lo encuentra. Los tests los escribe la etapa 3 del pipeline. |
| 9 | CODE: `storybook.ts:89-93` no filtra `ev.repeat` → A3. |
| 10 | CODE: `storybook.ts:79-80` — `fromHash()` (y por ende `show()`) corre antes de registrar el `keydown` (`:89`), así que `stage` siempre existe en el handler; `log` está en `storybook.ts:20`. |
| 11 | Sin fuente → A5. |
| 12 | Sin fuente → A6; las capturas se commitean en `docs/superpowers/specs/assets/96-storybook/`. |
| 13 | DOC: spec §6 (`2026-10-17-storybook-estructuras-design.md:150-151`) — "`g` suelo, `h` sombras, `a` acentos (conmutan y se recuerdan entre exhibits)". El handler actual no usa `h` ni `a` (`storybook.ts:88-93`). |
| 14 | No hay `CONTEXT.md` ni `docs/adr/` en el repo. ISSUE: "El sitio no lo llama: nada cambia fuera del lab." `src/main.ts:45` es el único consumidor del sitio y no se toca. |
| 15 | Cada task es un commit propio; si Task 2 falla, la etapa de implementación lo reintenta o lo documenta en el PR. `setLayer` sin consumidor no rompe nada (no lo llama nadie). Capturas: agent-browser en esta máquina (CLAUDE.md). |
| 16 | Sin fuente → A4. |
