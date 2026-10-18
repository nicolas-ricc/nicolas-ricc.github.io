# city-anim con tiempo de pared (#23): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el parpadeo del piso encendido y los eventos de los carteles de neón dependan del tiempo acumulado y no de cómo se trocea en ticks.

**Architecture:** en `createCityAnim` (`src/scenes/city-anim.ts`), `blinkTimer` y `signTimer` dejan de reiniciarse con `= nextGap()`: al vencer suman el nuevo intervalo al resto negativo y se itera con `while` mientras sigan ≤ 0, así un tick largo dispara varios eventos. Cada temporizador saca sus tiradas de un `Rng` propio, derivado del `rng` recibido al construir: si compartieran el `rng` con los papeles (cuyo reciclado también depende del tick), el intervalo sorteado después de cada evento cambiaría según el troceo. `CityAnim` expone `fired()` con los dos contadores de disparos que pide el criterio de aceptación.

**Tech Stack:** TypeScript, Vitest. `city-anim.ts` es lógica pura, sin Pixi.

**Spec:** issue #23 y su Agent Brief (comentario de triage). Fuera de alcance: los otros animadores (`tech-anim`, `shipyard`, `factory`) y el reciclado de los papeles, aunque repitan el patrón.

## Global Constraints

- Criterio 1: un test comprueba que `tick(7000)` y siete `tick(1000)` con la misma semilla dejan los mismos contadores de disparos para pisos y neones.
- Criterio 2: los tests existentes de la animación de la ciudad siguen en verde (`src/scenes/city-anim.test.ts`, `src/scenes/city-animator.test.ts`). Si un valor esperado cambia por la nueva semántica, se documenta en el test.
- Criterio 3: `npm test` y `npm run typecheck` en verde.
- No cambian `BLINK_GAP_MS`, `SIGN_GAP_MS`, `NEON_STEP_MS` ni ninguna otra constante. Tests y comentarios en castellano, como el resto del archivo. Commits `test(#23): …` / `fix(#23): …`.

## Decisiones técnicas (declaradas)

1. **Un `Rng` por temporizador.** Se crean con `createRng(rng.int(0, 0xffffffff))` en el mismo punto donde hoy se sortea el primer intervalo de cada uno: `blinkRng` en lugar de la primera llamada a `nextGap()`, y `signRng` en lugar del primer `rng.int(SIGN_GAP_MS…)`. El `rng` compartido queda para los papeles. Medido en un prototipo, sobre 200 semillas: con el `while` solo y el `rng` compartido, `tick(60000)` frente a 60×`tick(1000)` difería en 175. Con flujos propios, 0 diferencias a 60000/1000, 60000/33 y 600000/7. Cambian las tiradas concretas de la semilla 3, pero ningún test existente fija valores sorteados: todos comprueban invariantes (rangos, conteos mínimos, igualdad entre dos instancias con la misma semilla).
2. **El cartel elegido y la moneda de color/apagón también salen de `signRng`.** Si no, el intervalo siguiente dependería del orden respecto de los papeles.
3. **Parpadeo.** El tick que vuelve a encender ya no repone el temporizador: la pausa cuenta desde el instante del disparo (tiempo de pared), no desde el tick que reenciende. El tick resta siempre `dtMs`, y el `while` puede volver a apagar en el mismo tick que reencendió si el tick es mayor que lo que quedaba de pausa (solo con ticks ≥ 4000 ms). Visualmente sigue siendo "un tick apagado"; con ticks normales nunca hay dos seguidos.
4. **`fired()`.** `CityAnim` gana `fired(): { lit: number; neon: number }`: disparos del parpadeo y eventos de carteles desde la construcción. Es la forma observable de los "contadores de disparos" del criterio 1 sin espiar el `rng`. `cityAnimator` no la usa, y el contrato `Animator` no cambia.
5. **Apagón dentro de un tick largo.** Se mantiene `offUntil = clock + NEON_STEP_MS`, con `clock` al final del tick: el apagón empieza a verse en el frame que lo muestra. Si en un mismo tick sale dos veces el mismo cartel apagado, el segundo apagón se descarta como hoy (`offUntil < 0`). El contador cuenta el evento igual, y las tiradas del `rng` son las mismas.
6. **Sin carteles.** `while (signTimer <= 0 && signs.length > 0)`: con cero carteles el temporizador corre sin sortear, como hoy, y no hay bucle infinito.
7. **dt fraccionario.** Con dt no enteros (16.67 ms), la suma en coma flotante puede correr un disparo de tick en un borde exacto. Los tests usan dt enteros. No se compensa.

## Review Focus

1. Pestaña dormida, `tick(600000)`: termina, dispara muchos eventos (≈ 600000 / 6500 parpadeos) y queda igual que 600 `tick(1000)`. Test en Tasks 2 y 3.
2. Escena sin carteles (`signs: []`): un tick largo no se cuelga y `fired().neon` queda en 0. Test en la Task 3.
3. Reduced motion o `dtMs <= 0`: `fired()` queda en `{ lit: 0, neon: 0 }`. Test en la Task 1.
4. Después de un tick largo que apaga el piso, el siguiente tick corto lo reenciende: test en la Task 2.
5. Otros troceos irregulares (`[16, 33, 100, 250, 1000, 5000, 7000, 33]` frente a su suma en un tick) dejan los mismos contadores: test en la Task 3, que cubre los dos temporizadores.

---

### Task 1: contadores `fired()`

**Files:**
- Modify: `src/scenes/city-anim.ts` (interfaz `CityAnim`, estado de `createCityAnim`, `tick`)
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Consumes: `createCityAnim(tower, neon, rng, opts)` y el helper `setup()` del test.
- Produces: `CityAnim.fired(): { lit: number; neon: number }`, que usan las Tasks 2 y 3.

- [ ] **Step 1: tests que fallan**

Dentro del `describe("city-anim", …)` de `src/scenes/city-anim.test.ts`:

```ts
  it("fired cuenta los apagones del piso y los eventos de carteles", () => {
    const { anim } = setup();
    expect(anim.fired()).toEqual({ lit: 0, neon: 0 });
    let offs = 0;
    for (let t = 0; t < 60000; t += 33) { anim.tick(33); if (anim.lit().length === 0) offs++; }
    expect(anim.fired().lit).toBe(offs); // a 33 ms cada disparo es un tick apagado
    expect(anim.fired().neon).toBeGreaterThanOrEqual(60000 / 7000 - 1);
    expect(anim.fired().neon).toBeLessThanOrEqual(60000 / 3000);
  });

  it("fired no cuenta nada con reduced-motion ni con dt <= 0", () => {
    const quieto = setup(true).anim;
    quieto.tick(60000);
    expect(quieto.fired()).toEqual({ lit: 0, neon: 0 });
    const { anim } = setup();
    anim.tick(0); anim.tick(-5000);
    expect(anim.fired()).toEqual({ lit: 0, neon: 0 });
  });
```

- [ ] **Step 2: correr y ver que fallan**

Run: `npx vitest run src/scenes/city-anim.test.ts`
Expected: FAIL con `anim.fired is not a function`.

- [ ] **Step 3: implementación mínima**

En `city-anim.ts`:

```ts
export interface CityAnim { lit(): Accent[]; papers(): Accent[]; antenna(): Accent; neon(): Accent[]; tick(dtMs: number): CityAnimChanges; fired(): { lit: number; neon: number } }
```

Después de `let maleconStep = 0;`:

```ts
  let blinks = 0, signEvents = 0; // disparos desde la construcción, para fired()
```

En el objeto devuelto, antes de `tick`:

```ts
    fired: () => ({ lit: blinks, neon: signEvents }),
```

En `tick`, `blinks++` en la rama donde el piso se apaga (`off = true`) y `signEvents++` dentro del bloque del evento de cartel, junto a `c.neon = true`.

- [ ] **Step 4: correr y ver que pasan**

Run: `npx vitest run src/scenes/city-anim.test.ts`
Expected: PASS, los 12 tests.

- [ ] **Step 5: commit**

```bash
git add src/scenes/city-anim.ts src/scenes/city-anim.test.ts
git commit -m "feat(#23): contadores de disparos en city-anim"
```

### Task 2: el parpadeo arrastra el exceso, con su propio `Rng`

**Files:**
- Modify: `src/scenes/city-anim.ts` (import de `createRng`, `nextGap`, rama del parpadeo en `tick`)
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Consumes: `CityAnim.fired()` (Task 1), `createRng` de `../map/seed`, `BLINK_GAP_MS`.
- Produces: helper de test `troceado(dts: number[])`, que la Task 3 reutiliza:
  ```ts
  const troceado = (dts: number[]) => { const { anim } = setup(); for (const dt of dts) anim.tick(dt); return anim; };
  ```

- [ ] **Step 1: tests que fallan**

Después de `setup` en el test:

```ts
const troceado = (dts: number[]) => { const { anim } = setup(); for (const dt of dts) anim.tick(dt); return anim; };
const veces = (n: number, dt: number) => Array.from({ length: n }, () => dt);
```

Importar `BLINK_GAP_MS` desde `./city-anim`. Dentro del `describe`:

```ts
  it("parpadeo: tick(7000) y siete tick(1000) disparan lo mismo, y también 60 s en uno o en 60", () => {
    expect(troceado([7000]).fired().lit).toBe(troceado(veces(7, 1000)).fired().lit);
    expect(troceado([60000]).fired().lit).toBe(troceado(veces(60, 1000)).fired().lit);
    expect(troceado([60000]).fired().lit).toBe(troceado(veces(60000 / 25, 25)).fired().lit);
  });

  it("parpadeo: un tick de 10 min dispara muchos apagones, como 600 de 1 s", () => {
    const largo = troceado([600000]).fired().lit;
    expect(largo).toBeGreaterThanOrEqual(600000 / BLINK_GAP_MS[1] - 1);
    expect(largo).toBeLessThanOrEqual(600000 / BLINK_GAP_MS[0]);
    expect(largo).toBe(troceado(veces(600, 1000)).fired().lit);
  });

  it("parpadeo: tras un tick largo que apaga el piso, el siguiente tick corto lo enciende", () => {
    const { tower, anim } = setup();
    anim.tick(BLINK_GAP_MS[1]); // la primera pausa vence seguro dentro de este tick
    expect(anim.lit()).toEqual([]);
    anim.tick(33);
    expect(anim.lit()).toEqual(tower.litWindows);
  });
```

- [ ] **Step 2: correr y ver que fallan**

Run: `npx vitest run src/scenes/city-anim.test.ts -t parpadeo`
Expected: FAIL en las comparaciones de 60 s y 10 min: hoy un tick largo dispara como mucho un apagón.

- [ ] **Step 3: implementación**

Import: `import { createRng, type Rng } from "../map/seed";`

Reemplazar `nextGap`:

```ts
  // flujo propio: compartir `rng` con los papeles haría que la pausa sorteada dependa del troceo
  const blinkRng = createRng(rng.int(0, 0xffffffff));
  const nextGap = (): number => blinkRng.int(BLINK_GAP_MS[0], BLINK_GAP_MS[1]);
```

Rama del parpadeo en `tick`:

```ts
      // parpadeo: un tick apagado; la pausa siguiente cuenta desde el disparo, y un tick largo puede disparar varios
      if (off) { off = false; c.lit = true; }
      blinkTimer -= dtMs;
      while (blinkTimer <= 0) { blinkTimer += nextGap(); blinks++; off = true; c.lit = true; }
```

- [ ] **Step 4: correr y ver que pasan**

Run: `npx vitest run src/scenes/city-anim.test.ts src/scenes/city-animator.test.ts`
Expected: PASS, incluido "el piso se apaga de a un tick, nunca dos seguidos" sin tocarlo.

- [ ] **Step 5: commit**

```bash
git add src/scenes/city-anim.ts src/scenes/city-anim.test.ts
git commit -m "fix(#23): el parpadeo del piso arrastra el exceso del tick"
```

### Task 3: los carteles arrastran el exceso, con su propio `Rng`

**Files:**
- Modify: `src/scenes/city-anim.ts` (`signTimer` y su bloque en `tick`)
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Consumes: `CityAnim.fired()` (Task 1), helpers `troceado` y `veces` (Task 2), `SIGN_GAP_MS`.
- Produces: nada nuevo.

- [ ] **Step 1: tests que fallan**

Importar `SIGN_GAP_MS` desde `./city-anim`. Dentro del `describe`:

```ts
  it("tick(7000) y siete tick(1000) con la misma semilla dejan los mismos contadores de pisos y neones", () => {
    expect(troceado([7000]).fired()).toEqual(troceado(veces(7, 1000)).fired());
  });

  it("carteles: 60 s o 10 min de una vez disparan lo mismo que troceados", () => {
    expect(troceado([60000]).fired().neon).toBe(troceado(veces(60, 1000)).fired().neon);
    const largo = troceado([600000]).fired().neon;
    expect(largo).toBeGreaterThanOrEqual(600000 / SIGN_GAP_MS[1] - 1);
    expect(largo).toBeLessThanOrEqual(600000 / SIGN_GAP_MS[0]);
    expect(largo).toBe(troceado(veces(600, 1000)).fired().neon);
  });

  it("un troceo irregular deja los mismos contadores y colores que su suma en un tick", () => {
    const dts = [16, 33, 100, 250, 1000, 5000, 7000, 33];
    const a = troceado(dts), b = troceado([dts.reduce((s, x) => s + x, 0)]);
    expect(a.fired()).toEqual(b.fired());
    expect(signsOf(a.neon()).map((s) => s.color)).toEqual(signsOf(b.neon()).map((s) => s.color));
  });

  it("sin carteles un tick largo no se cuelga y no cuenta eventos", () => {
    const scene = city(createRng(7), createRng(8));
    const anim = createCityAnim(scene.tower, { ...scene.neon, signs: [] }, createRng(3), { reducedMotion: false });
    anim.tick(600000);
    expect(anim.fired().neon).toBe(0);
  });
```

La comparación de colores vale porque, con `signRng` propio, los mismos eventos sortean los mismos carteles y la misma moneda. Los apagones pueden diferir: un apagón visible depende del frame.

- [ ] **Step 2: correr y ver que fallan**

Run: `npx vitest run src/scenes/city-anim.test.ts`
Expected: FAIL en las comparaciones de 60 s, 10 min y troceo irregular.

- [ ] **Step 3: implementación**

Reemplazar la creación del temporizador:

```ts
  const signRng = createRng(rng.int(0, 0xffffffff)); // flujo propio, por lo mismo que blinkRng
  let signTimer = signRng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
```

Y el bloque en `tick`:

```ts
      signTimer -= dtMs;
      while (signTimer <= 0 && signs.length > 0) { // un tick largo puede traer varios eventos
        const s = signs[signRng.int(0, signs.length - 1)]!;
        if (signRng.chance(0.5)) s.color = s.color === "cyan" ? "magenta" : "cyan";
        else if (s.offUntil < 0) s.offUntil = clock + NEON_STEP_MS;
        signTimer += signRng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
        signEvents++;
        c.neon = true; // un cambio de color o un apagón siempre se ve (SIGN_GAP_MS ≥ 3000 > NEON_STEP_MS)
      }
```

Actualizar el comentario de cabecera del archivo: "un cartel cada 3..7 s" sigue valiendo, ahora medido en tiempo de pared.

- [ ] **Step 4: correr y ver que pasan**

Run: `npm test && npm run typecheck`
Expected: PASS, toda la suite y el typecheck.

- [ ] **Step 5: commit**

```bash
git add src/scenes/city-anim.ts src/scenes/city-anim.test.ts
git commit -m "fix(#23): los carteles de neón arrastran el exceso del tick"
```
