# tech-anim sin torres (#19): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un distrito tecnológico sin torres siga animando carteles, telecom y neones; solo el parpadeo de ventanas queda quieto.

**Architecture:** `createTechAnim` (`src/scenes/tech-anim.ts`) corta todo `tick` con `scene.towers.length === 0`. El guard pasa a la rama del parpadeo de ventanas, que es la única que sortea `rng.int(0, towers.length - 1)`. Al quitar el corte global queda expuesta otra rama que sortea sobre una lista que nace vacía sin torres: el cambio de color de las coronas (`rng.int(0, colors.length - 1)`, una corona por torre en `tech.ts`). Esa rama recibe su propio guard.

**Tech Stack:** TypeScript, Vitest. Sin Pixi: `tech-anim.ts` es lógica pura.

**Spec:** issue #19 y su Agent Brief (comentario de triage). Fuera de alcance: cambiar los períodos o la estética de las capas.

## Global Constraints

- Criterio 1: un test construye una escena tecnológica sin torres y comprueba que, tras varios ticks, los cambios de telecom y carteles se reportan y la capa de ventanas no.
- Criterio 2: los tests existentes del animador tecnológico siguen en verde (`src/scenes/tech-anim.test.ts`, `src/scenes/tech-animator.test.ts`).
- Criterio 3: `npm test` y `npm run typecheck` en verde.
- No cambian períodos, gaps ni alphas. Nombres de tests y comentarios en castellano, como el resto del archivo. Commits `test(#19): …` / `fix(#19): …`.
- Con torres, el orden de consumo del `rng` no cambia: los tests existentes usan semillas fijas (`tech(createRng(7))`, `createRng(3)`) y deben dar los mismos resultados.

## Decisiones técnicas (declaradas)

1. **Escena sin torres para el test.** `tech()` no tiene parámetro para producir cero torres, y con la semilla 7 siempre hay. El test parte de `tech(createRng(7))` y vacía `towers` y `neon.crowns` (en `tech.ts:82` cada torre empuja su corona, así que una escena sin torres real tampoco tiene coronas). Los carteles se dejan: `atrium` y `auditorium` también los ponen (`tech.ts:97`, `tech.ts:149`), y la telecom y el anillo del mástil no dependen de las torres.
2. **Guard del cambio de color de las coronas.** Sin coronas, `rng.int(0, -1)` devuelve 0, `colors[0]` pasa de `undefined` a `"magenta"` y el tick reporta `neon: true` sin que nada visible cambie (un redibujado de más cada 6..12 s). No rompe nada a la vista, pero lo destapa este cambio, así que se arregla acá: el temporizador sigue corriendo y la rama solo sortea si hay coronas.
3. **Dónde va el guard de ventanas.** `if (blinkTimer <= 0 && scene.towers.length > 0)`. El temporizador sigue descontando; con torres el comportamiento es idéntico al de antes.

## Review Focus

1. Escena sin torres pero con reduced motion o `dtMs <= 0`: el tick sigue sin reportar nada. Ya lo cubre el guard que queda (`opts.reducedMotion || dtMs <= 0`) y el test de reduced motion existente.
2. `windows()` sin torres devuelve `[]` y no revienta (los `!` sobre `walls[k]` y `lit[k]` nunca se evalúan): el test de la Task 1 lo pide.
3. Sin coronas, `neon()` devuelve solo las luces del anillo y el anillo sigue corriendo: el test de la Task 1 lo pide.
4. Sin coronas, `neon: true` solo aparece cuando cambia un paso de corona o de anillo, nunca por el sorteo de color: test de la Task 2.
5. Con torres, nada cambia: los tests existentes con semillas fijas siguen en verde (Tasks 1 y 2, paso de suite completa).

---

### Task 1: el guard protege solo el parpadeo de ventanas

**Files:**
- Modify: `src/scenes/tech-anim.ts` (método `tick`)
- Test: `src/scenes/tech-anim.test.ts`

**Interfaces:**
- Consumes: `createTechAnim(scene: TechScene, rng: Rng, opts: { reducedMotion: boolean }): TechAnim`, `tech(rng)`, `createRng(seed)`, constantes exportadas de `tech-anim.ts`.
- Produces: helper de test `sinTorres()` en `tech-anim.test.ts`, que la Task 2 reutiliza:
  ```ts
  const sinTorres = () => { const s = tech(createRng(7)); return { ...s, towers: [], neon: { ...s.neon, crowns: [] } }; };
  ```

- [ ] **Step 1: test que falla**

En `src/scenes/tech-anim.test.ts`, después de `setup`:

```ts
const sinTorres = () => { const s = tech(createRng(7)); return { ...s, towers: [], neon: { ...s.neon, crowns: [] } }; };
```

y dentro del `describe`:

```ts
  it("sin torres las ventanas quedan quietas pero carteles, telecom y anillo del mástil siguen", () => {
    const scene = sinTorres(), anim = createTechAnim(scene, createRng(3), { reducedMotion: false });
    expect(scene.signs.length).toBeGreaterThan(0);
    const seen = { windows: false, signs: false, telecom: false, neon: false };
    for (let t = 0; t < TECH_BLINK_GAP_MS[1] + 1000; t += 100) {
      const c = anim.tick(100);
      for (const k of Object.keys(seen) as (keyof typeof seen)[]) if (c[k]) seen[k] = true;
    }
    expect(seen).toEqual({ windows: false, signs: true, telecom: true, neon: true });
    expect(anim.windows()).toEqual([]);
    expect(anim.neon().every((a) => a.kind === "dot")).toBe(true);
  });
```

- [ ] **Step 2: correrlo y verlo fallar**

Run: `npx vitest run src/scenes/tech-anim.test.ts`
Expected: FAIL en el test nuevo; `seen` sale todo en `false`.

- [ ] **Step 3: implementación mínima**

En `tick`, `src/scenes/tech-anim.ts`:

```ts
      if (opts.reducedMotion || dtMs <= 0) return c;
      clock += dtMs;
      blinkTimer -= dtMs;
      if (blinkTimer <= 0 && scene.towers.length > 0) { // sin torres no hay a quién sortear; el resto de las capas sigue
```

El cuerpo de la rama no cambia.

- [ ] **Step 4: correr y verlo pasar**

Run: `npx vitest run src/scenes/tech-anim.test.ts src/scenes/tech-animator.test.ts`
Expected: PASS, incluidos todos los tests previos.

- [ ] **Step 5: commit**

```bash
git add src/scenes/tech-anim.ts src/scenes/tech-anim.test.ts
git commit -m "fix(#19): el guard sin torres protege solo el parpadeo de ventanas"
```

### Task 2: sin coronas, el sorteo de color no reporta cambios

**Files:**
- Modify: `src/scenes/tech-anim.ts` (rama `flipTimer` de `tick`)
- Test: `src/scenes/tech-anim.test.ts`

**Interfaces:**
- Consumes: `sinTorres()` de la Task 1; `NEON_STEP_MS`, `RING_STEP_MS`, `CROWN_FLIP_GAP_MS` de `tech-anim.ts` (`RING_STEP_MS` hay que sumarlo al import del test).
- Produces: nada nuevo.

- [ ] **Step 1: test que falla**

```ts
  it("sin coronas, neon solo se reporta cuando cambia el paso de corona o de anillo, nunca por el cambio de color", () => {
    const anim = createTechAnim(sinTorres(), createRng(3), { reducedMotion: false });
    for (let t = 1; t <= CROWN_FLIP_GAP_MS[1] + 1000; t++) {
      const paso = Math.floor(t / NEON_STEP_MS) !== Math.floor((t - 1) / NEON_STEP_MS) || Math.floor(t / RING_STEP_MS) !== Math.floor((t - 1) / RING_STEP_MS);
      expect(anim.tick(1).neon).toBe(paso);
    }
  });
```

- [ ] **Step 2: correrlo y verlo fallar**

Run: `npx vitest run src/scenes/tech-anim.test.ts`
Expected: FAIL en el test nuevo: en el ms del sorteo (entre 6 y 12 s, fuera de un borde de paso) `neon` sale `true`.

- [ ] **Step 3: implementación mínima**

```ts
      if (flipTimer <= 0) { flipTimer = nextFlip(); if (colors.length > 0) { const k = rng.int(0, colors.length - 1); colors[k] = colors[k] === "cyan" ? "magenta" : "cyan"; c.neon = true; } }
```

- [ ] **Step 4: correr y verlo pasar**

Run: `npx vitest run src/scenes/tech-anim.test.ts src/scenes/tech-animator.test.ts`
Expected: PASS.

- [ ] **Step 5: suite completa y typecheck**

Run: `npm test && npm run typecheck`
Expected: todo en verde.

- [ ] **Step 6: commit**

```bash
git add src/scenes/tech-anim.ts src/scenes/tech-anim.test.ts
git commit -m "fix(#19): sin coronas el sorteo de color no reporta cambios"
```
