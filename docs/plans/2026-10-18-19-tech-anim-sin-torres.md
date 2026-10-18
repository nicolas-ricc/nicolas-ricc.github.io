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
3. **Dónde va el guard de ventanas.** Dentro de la rama, después de reponer el temporizador: `if (blinkTimer <= 0) { blinkTimer = nextGap(); if (scene.towers.length > 0) { … } }`. Así `blinkTimer` no crece negativo sin límite, y con torres el orden de consumo del `rng` es el de antes (`nextGap()` ya era lo primero de la rama, `tech-anim.ts:52`). Es la misma forma que usa la Task 2 para el sorteo de color.

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
      if (blinkTimer <= 0) {
        blinkTimer = nextGap();
        if (scene.towers.length > 0) { // sin torres no hay a quién sortear; las demás capas siguen
          const k = rng.int(0, scene.towers.length - 1), floors = scene.towers[k]!.facade.floors;
          const old = lit[k];
          if (rng.chance(0.3)) lit[k] = null;
          else { let nv = rng.int(1, floors - 1); if (nv === old && floors > 2) nv = nv === floors - 1 ? nv - 1 : nv + 1; lit[k] = nv; } // siempre cambia el piso si hay más de una opción
          c.windows = true;
        }
      }
```

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

## Assumptions

1. **La Task 2 entra en este issue.** El issue pide que el guard proteja "únicamente la rama del parpadeo de ventanas" y que "las demás capas (telecom, carteles, anillo del mástil) siguen animando". Quitar el corte global destapa el sorteo de color sobre una lista vacía (`tech-anim.ts:62`), así que es parte del mismo cambio y no deuda previa. Alternativa descartada: abrir un issue aparte y mergear la Task 1 con un `neon: true` fantasma cada 6..12 s. Las dos tasks salen en el mismo PR.
2. **El guard de ventanas repone el temporizador antes de mirar las torres** (decisión 3). Alternativa descartada: `blinkTimer <= 0 && towers.length > 0`, que deja `blinkTimer` decreciendo sin límite.
3. **Escena sin torres armada a mano** (decisión 1). Alternativa descartada: un parámetro nuevo en `tech()` para forzar cero torres, que tocaría código de producción solo para el test.
4. **No se agrega guard en `tech-animator.ts` ni en el render.** `windows()` sin torres ya devolvía `[]` antes de este cambio (`tech-anim.ts:37`), así que el render no ve ningún estado nuevo, y las capas vacías ya se contemplan (`src/lab/crop.ts:75`).

## Grilling

- Rondas: 1 (el plan no cambió de forma sustancial: solo la posición del guard de la Task 1 dentro de la rama). Griller: `fable`.
- Preguntas: 16. Fuentes: CODE 13, ISSUE 2 (preguntas 8 y 16, junto con el código), DOC 1, NO SOURCE 2 (preguntas 10 y 16), que se resolvieron como supuestos técnicos.
- Respuestas:
  1. `tech-anim.ts:18`: `SIGN_STEP_MS = 150`, `TELECOM_STEP_MS = 100`. En `:59-60` los pasos se calculan con `Math.floor(clock / STEP)` y no leen `towers` ni el `rng`, así que un tick de 100 ms ya los cruza. No depende de la semilla.
  2. `tech-anim.ts:46-65`: el único acceso por índice a `towers`, `lit` o `walls` dentro de `tick` está en `:53-56`. `colors` se indexa en `:62`. Los accesores recorren `scene.towers` o `scene.neon.crowns` con `map` o `flatMap` (`:37`, `:42`), así que con listas vacías no indexan nada.
  3. `tech.ts:61-82`: `tower()` empuja en `solids`, `accents`, `signs`, `crowns` y `towers`. `tech-anim.ts` solo lee `towers`, `signs`, `telecom` y `neon` (`:28-44`). Los sólidos y acentos estáticos no los lee, así que dejarlos no crea referencias colgadas para el animador.
  4. `src/map/seed.ts:19`: `int: (min, max) => min + Math.floor(next() * (max - min + 1))`, que con `(0, -1)` da `0 + floor(next() * 0) = 0`.
  5. `tech.ts:82`: cada torre empuja exactamente una corona, y `tech.ts:188` arma `neon.crowns` solo con esas. Los tests existentes usan `tech(createRng(7))` sin modificar (`tech-anim.test.ts:6`), así que `colors.length === towers.length > 0`.
  6. `tech-anim.ts:63-64`: los dos pasos salen de `Math.floor(clock / NEON_STEP_MS)` y de `Math.floor(clock / RING_STEP_MS)`, con el mismo `clock`, que es la suma de los `dtMs` (`:49`). El test los modela igual.
  7. Con t = 1, `floor(1/150) = floor(0/150) = 0` y `floor(1/200) = 0`, así que se espera `false`. En el código, `neonStep` y `ringStep` arrancan en 0 (`:34`), así que tampoco se reporta. Coinciden.
  8. ISSUE: "El guard protege únicamente la rama del parpadeo de ventanas" y "las demás capas … siguen animando". La Task 2 es consecuencia directa del cambio; ver el supuesto 1.
  9. `tech-anim.ts:37`: `scene.towers.flatMap(...)`. Además `walls` y `lit` se derivan de `scene.towers` (`:28-29`), así que también quedan vacíos.
  10. NO SOURCE, resuelto como supuesto 2. El único lector de `blinkTimer` está en `:50-52`.
  11. `TECH_BLINK_GAP_MS = [4000, 9000]` (`:17`). Los pasos de carteles y telecom son de 150 y 100 ms (`:18`): una ventana de 10 s los cruza muchas veces.
  12. `tech-animator.ts:9-18`: arma las capas con `anim.windows()` y los demás accesores, y traduce los flags a ids, sin indexar. Ver el supuesto 4.
  13. `vitest.config.ts:4`: `environment: "node"`. Las importaciones de `tech.ts` (`:1-11`) son todas del proyecto, sin Pixi. Los tests existentes del mismo archivo ya usan `tech()`.
  14. `tech-anim.test.ts`, test "con reduced-motion no cambia nada": usa torres. Con reduced motion, `tick` sale en `:48` antes de cualquier rama, haya o no torres, y el cambio mantiene ese corte. No hace falta un test aparte.
  15. DOC: `.factory/config.toml` dice `test = "npm test"` y `lint = "npm run typecheck"`. `package.json:9,13` los define como `vitest run` y `tsc --noEmit`.
  16. Las dos tasks salen juntas en un PR (supuesto 1). Si la Task 2 no aterriza, la etapa de revisión lo marca como violación de la spec.
- Issues abiertos: ninguno.
