# Animación: capa `city.windows` y neón de calle que titila — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animar ≤ 40 ventanas de Resume (capa nueva `city.windows`) y un neón de calle del barrio de bares que titila (dentro de `city.neon`), sacando ambos de los acentos estáticos.

**Architecture:** `lights.ts` elige además qué neón titila (`CityLights.flicker`). `city.ts` deja fuera de `scene.accents` las ventanas `animable` y el neón `flicker`. `createCityAnim` recibe la escena (`tower`, `neon`, `lights`), gana estado de ventanas y del titileo, y expone `windows()`; `cityAnimator` publica `city.windows`. Sin animadores nuevos: `assemble.ts` no cambia.

**Tech Stack:** TypeScript estricto, Vitest, Pixi v8 (solo en `stage.ts`, no se toca).

**Spec:** issue #46 (manda sobre la spec si difieren) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §7 "Animación".

## Global Constraints

- Toda aleatoriedad sale del `Rng` recibido (`src/map/seed.ts`); `Math.random` prohibido.
- Ningún literal hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`.
- Sin Pixi en tests; tests Vitest al lado del módulo; nombres de tests y comentarios en castellano.
- Sin dependencias nuevas. `assemble.test.ts` sigue contando siete animadores.
- Tiradas nuevas del rng de la animación van después de las existentes en el constructor: ventanas, luego titileo.
- El `flicker` se tira en `lights.ts` después de todas las tiradas existentes (colores de neones), para no cambiar ventanas ni neones.
- Frame 0 = estado inicial de `lights` y todo encendido; con `reducedMotion` `tick` devuelve `NONE`.
- Commits `feat(#46): …` / `test(#46): …` / `docs(#46): …`.

## Review Focus

1. Escena sin ventanas animables (`n = 0`): `windows()` devuelve `[]`, `tick` nunca reporta `windows` ni rompe al elegir con `rng.int(0, -1)`.
2. Escena sin neones de calle (`flicker = null`): `neon()` igual que hoy, sin titileo y sin tiradas que se desfasen.
3. Ticks grandes (`dt = 5000`, como el test de determinismo del animador): a lo sumo un evento por tick, nada de bucles largos ni estado inconsistente.
4. Titileo que coincide con otro cambio del neón (cartel o malecón): el titileo sigue durando un paso y vuelve a alpha original (frente 1, halo 0.6).
5. El neón que titila puede ser ámbar: los tests viejos que exigían colores cian/magenta en `city.neon` tienen que filtrar los acentos del neón de calle en lugar de romperse.

Los cinco quedan cubiertos por tests en las tareas 3 y 4 (1, 2 y 3 en la tarea 3 con escenas sintéticas; 4 y 5 en la tarea 4).

---

## Archivos

- Modificar `src/city/lights.ts`: `CityLights.flicker`.
- Modificar `src/scenes/city.ts`: reparto estático/animado de acentos.
- Modificar `src/scenes/city-anim.ts`: nueva firma, `windows()`, titileo.
- Modificar `src/scenes/city-animator.ts`: pasa `scene`, id `city.windows`.
- Tests: `src/city/lights.test.ts`, `src/scenes/city.test.ts`, `src/scenes/city-anim.test.ts`, `src/scenes/city-animator.test.ts`, `src/world/assemble.test.ts`.
- `README.md` sección "Mundo isométrico".

### Task 1: `lights.ts` elige el neón que titila

**Files:** Modify `src/city/lights.ts`; Test `src/city/lights.test.ts`.

**Interfaces:** Produces `CityLights.flicker: number | null` (índice en `neons`).

- [ ] **Step 1: test** dentro del `describe` por semilla de `lights.test.ts`:

```ts
it("flicker es un índice válido de neons (o null sin neones) y el neón está en bares", () => {
  if (l.neons.length === 0) { expect(l.flicker).toBeNull(); return; }
  expect(Number.isInteger(l.flicker)).toBe(true);
  expect(l.flicker!).toBeGreaterThanOrEqual(0);
  expect(l.flicker!).toBeLessThan(l.neons.length);
  expect(s.placed[l.neons[l.flicker!]!.owner]!.placed.barrio).toBe("bares");
});
```

y en "escenas sintéticas": una escena sin piezas de bares da `flicker === null`.

- [ ] **Step 2:** `npx vitest run src/city/lights.test.ts` → falla (`flicker` undefined).
- [ ] **Step 3:** en `CityLights` sumar `flicker: number | null`; al final de `lights()`, después de mapear `neons`:

```ts
const flicker = neons.length > 0 ? rng.int(0, neons.length - 1) : null;
return { windows, neons, flicker, bathed: bathed(scene.placed), counts };
```

- [ ] **Step 4:** test en verde. **Step 5:** commit `feat(#46): lights elige el neón que titila`.

### Task 2: `city.ts` saca de los acentos estáticos lo animado

**Files:** Modify `src/scenes/city.ts`; Test `src/scenes/city.test.ts`, `src/city/lights.test.ts` (test "van a scene.accents").

**Interfaces:** Consumes `CityLights.flicker`, `LitWindow.animable`.

- [ ] **Step 1: test** en `city.test.ts`:

```ts
it("scene.accents no trae ventanas animables ni el neón que titila; sí las demás encendidas y neones", () => {
  const s = city(createRng(7), createRng(8), createRng(9)), l = s.lights;
  const polys = new Set(s.accents.flatMap((a) => (a.kind === "poly" ? [a.pts] : [])));
  for (const w of l.windows.filter((w) => w.animable)) expect(polys.has(w.window.pts)).toBe(false);
  for (const w of l.windows.filter((w) => w.on && !w.animable)) expect(polys.has(w.window.pts)).toBe(true);
  l.neons.forEach((n, i) => { for (const a of n.accents) expect(s.accents.includes(a)).toBe(i !== l.flicker); });
});
```

Y en `lights.test.ts` el test "las ventanas encendidas, los neones y el bañado van a scene.accents" pasa a filtrar `!x.animable` y `i !== l.flicker`.

- [ ] **Step 2:** falla. **Step 3:** en `city()`:

```ts
for (const w of lit.windows) if (w.on && !w.animable) accents.push({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA });
lit.neons.forEach((n, i) => { if (i !== lit.flicker) accents.push(...n.accents); });
```

y actualizar el comentario de `CityScene.accents` (las animables y el neón que titila los anima city-anim).

- [ ] **Step 4:** verde (también `city.test.ts` entero: el mínimo de 100 ventanas en acentos debe seguir). **Step 5:** commit.

### Task 3: firma nueva y capa `city.windows`

**Files:** Modify `src/scenes/city-anim.ts`, `src/scenes/city-animator.ts`; Test `city-anim.test.ts`, `city-animator.test.ts`, `src/world/assemble.test.ts`.

**Interfaces:**
- `createCityAnim(scene: Pick<CityScene, "tower" | "neon" | "lights">, rng: Rng, opts: { reducedMotion: boolean }): CityAnim`
- `CityAnim.windows(): Accent[]`; `CityAnimChanges.windows: boolean`
- `export const WINDOW_GAP_MS: [number, number] = [300, 900]`
- id `city.windows` (capa `accent`).

- [ ] **Step 1: tests** en `city-anim.test.ts` (`setup` pasa `scene`):
  - frame 0: `windows()` igual a `lights.windows.filter(animable && on)` mapeadas a `{ kind: "poly", pts, color, alpha: WINDOW_ALPHA }`.
  - 60 s con ticks de 100 ms: ≥ 40 ticks con `c.windows`; en todo tick `|encendidas − objetivo| ≤ max(1, round(0.05·n))`; todo `pts` devuelto está entre los `pts` de las animables.
  - escena sintética con `lights.windows = []`: `windows()` vacío y nunca `c.windows` en 10 s.
  - `reducedMotion`: `windows()` = frame 0 y `tick` = `NONE` (con `windows: false`).
  - mismo rng → mismas capas tras los mismos ticks (incluye `dt` 5000).
  - el test de reduced-motion existente compara contra el `NONE` con `windows: false` y `neon: false`.
  - `city-animator.test.ts`: ids exactos `["city.antenna", "city.lit", "city.neon", "city.papers", "city.windows"]`.
  - `assemble.test.ts`: el animador `cv` que tiene `city.neon` incluye `city.windows`.
- [ ] **Step 2:** fallan. **Step 3:** implementar en el constructor, después de `maleconStep`:

```ts
// ventanas: después de papeles y carteles para no reordenar sus tiradas
const wins = scene.lights.windows.filter((w) => w.animable).map((w) => ({ w, on: w.on }));
const target = wins.filter((x) => x.on).length, tol = Math.max(1, Math.round(0.05 * wins.length));
let windowTimer = rng.int(WINDOW_GAP_MS[0], WINDOW_GAP_MS[1]);
```

En `tick`, después del malecón:

```ts
windowTimer -= dtMs;
if (windowTimer <= 0 && wins.length > 0) {
  let x = wins[rng.int(0, wins.length - 1)]!;
  const lit = wins.filter((y) => y.on).length;
  if (Math.abs(lit + (x.on ? -1 : 1) - target) > tol) { const other = wins.filter((y) => y.on !== x.on); x = other[rng.int(0, other.length - 1)]!; }
  x.on = !x.on;
  windowTimer = rng.int(WINDOW_GAP_MS[0], WINDOW_GAP_MS[1]);
  c.windows = true;
}
```

`windows: () => wins.filter((x) => x.on).map(({ w }) => ({ kind: "poly", pts: w.window.pts, color: w.color, alpha: WINDOW_ALPHA }))`. `NONE` y `c` ganan `windows: false`. `cityAnimator` llama `createCityAnim(scene, rng, opts)` y suma `"city.windows"`.
- [ ] **Step 4:** verde. **Step 5:** commit.

### Task 4: neón de calle que titila en `city.neon`

**Files:** Modify `src/scenes/city-anim.ts`; Test `city-anim.test.ts`, `city-animator.test.ts`.

**Interfaces:** Consumes `CityLights.flicker`; `export const FLICKER_GAP_MS: [number, number] = [1000, 3000]`, `FLICKER_ALPHA = 0.3`.

- [ ] **Step 1: tests**:
  - frame 0: `neon()` contiene todos los acentos de `lights.neons[flicker]` tal cual (frente alpha 1, halo 0.6, charco).
  - 60 s con `dt = 10`: ≥ 10 titileos; en cada uno el frente y el halo están a 0.3, el charco no cambia, dura entre `NEON_STEP_MS` y `NEON_STEP_MS + dt`, y al volver el frente está a alpha 1 y el halo a 0.6. El tick que empieza o termina el titileo reporta `c.neon`.
  - ningún otro neón de calle está en `neon()`.
  - escena sintética con `flicker: null`: `neon()` igual que sin neón (carteles + malecón).
  - `reducedMotion`: el neón nunca titila.
  - los tests viejos de color cian/magenta y de `signsOf` filtran los acentos del neón de calle (`new Set(n.accents)`).
- [ ] **Step 2:** fallan. **Step 3:** en el constructor, después de las ventanas:

```ts
const street = scene.lights.flicker === null ? null : scene.lights.neons[scene.lights.flicker]!;
let flickerTimer = street ? rng.int(FLICKER_GAP_MS[0], FLICKER_GAP_MS[1]) : 0;
let flickerUntil = -1;
```

En `neon()` agregar `street` al final: si `flickerUntil > clock` los dos primeros acentos (halo y frente, en ese orden según `neon()` de `kit/props`) a `alpha: FLICKER_ALPHA`, el charco igual. En `tick`, después de las ventanas:

```ts
if (street) {
  if (flickerUntil >= 0 && clock >= flickerUntil) { flickerUntil = -1; c.neon = true; }
  flickerTimer -= dtMs;
  if (flickerTimer <= 0) { flickerUntil = clock + NEON_STEP_MS; flickerTimer = rng.int(FLICKER_GAP_MS[0], FLICKER_GAP_MS[1]); c.neon = true; }
}
```

(FLICKER_GAP_MS ≥ 1000 > NEON_STEP_MS: un titileo nunca pisa al siguiente.)
- [ ] **Step 4:** verde. **Step 5:** commit.

### Task 5: README y verificación visual

- [ ] Una línea en "Mundo isométrico" de `README.md`: la capa `city.windows` (≤ 40 ventanas del centro y el residencial que se prenden y apagan manteniendo el porcentaje ±5) y el neón de un bar que titila dentro de `city.neon`.
- [ ] `npm test` y `npm run typecheck` verdes.
- [ ] `npm run dev -- --host --port 5173`; `lab/resume.html?speed=0.3` con agent-browser: ventanas que cambian y neón que titila (captura para el PR).
- [ ] Commit `docs(#46): …`.
