# Neones de la ciudad de oficinas (Resume) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los edificios altos del distrito moderno de la ciudad de oficinas tengan un cartel de neón cian/magenta en la fachada sur que cambia de color o parpadea, y que los faroles del malecón lleven luces cian que corren.

**Architecture:** La escena `city.ts` expone la geometría nueva en `CityScene.neon: { signs: Accent[]; malecon: Vec3[] }` (los carteles los genera `districtBlock` en `district.ts`, los faroles `malecon()`). El animador puro `city-anim.ts` gana la capa `neon()` y el cambio `neon`; `city-animator.ts` la publica como `city.neon`. No se agregan animadores: la capa vive en el animador de la ciudad, etiquetado `cv` en `assemble.ts`, y hereda el velo.

**Tech Stack:** TypeScript strict, Vitest, pixi.js 8 (solo en `src/world/` y `src/lab/`, no se toca).

**Spec:** issue #14 (cuerpo completo: "Qué hacer", "Contexto común" y "Criterios de aceptación comunes"), dentro de la historia #11 (brief del triage y plan del planner en los comentarios de #11). Molde: `docs/superpowers/plans/2026-10-14-neones-distrito-tecnologico.md` (#13, ya en la rama base).

## Global Constraints

- `src/iso/` y `src/scenes/` no importan `pixi.js` (`src/iso/pixi-free.test.ts`).
- No se agregan colores ni se tocan valores del atlas; ningún literal hex fuera de `src/map/palette-iso.ts` / `palette-base.ts` / `seed.ts` (`src/map/palette-guard.test.ts`).
- Colores de los neones nuevos: solo `cyan*` y `magenta*`. `tower`, `accents`, `solids` y `ground` de `CityScene` no cambian de forma; los ámbar de la ciudad se quedan.
- Frame 0 = todo encendido y quieto. Con `reducedMotion: true`, `tick` no reporta nada y `neon()` devuelve ese estado fijo (carteles en su color inicial, todas las luces del malecón).
- Toda la aleatoriedad sale del `rng` recibido: color inicial de cada cartel con `districtRng.chance(0.5)` (la escena), eventos de cartel con el `rng` del animador. `Math.random` prohibido.
- No agregar animadores (`src/world/assemble.test.ts` cuenta 2 en `cv`); agregar la capa al existente.
- Reusar `chase` de `src/scenes/neon.ts` (existe en la rama base; no se modifica).
- Constantes: `NEON_STEP_MS = 150`, intervalo entre eventos de cartel `rng.int(3000, 7000)` ms (`SIGN_GAP_MS`), paso del malecón `250` ms (`MALECON_STEP_MS`), `chase(n, step, 2)`, punto `cyanMid` de `r = 0.35`.
- Cartel: `poly` de 4 puntos en el plano `y = cara sur + 0.4`, alto 1.6 u centrado a media altura del edificio (`PLINTH_H + h / 2`), ancho = ancho del edificio − 2 u (1 u de margen a cada lado), solo para edificios de altura `h ≥ 12`. `alpha: 1`.
- Comentarios y textos de tests en español, como el resto del repo. `npm test` y `npm run typecheck` verdes al final de cada task.

## Supuestos técnicos (declarados)

- **"Edificio"** en `districtBlock` = torre de vidrio (`glassTower`) y clásico de piedra (`classic`); su `h` es la altura sobre el zócalo. Los campus (6..8 u) y la obra (`site`) no llevan cartel. En las torres de vidrio el cartel va en la cara sur del cuerpo base (`by + bd`, ancho `bw`): con `share` 0.6/0.7 el cuerpo base siempre supera la media altura más 0.8.
- **Posición de las luces del malecón:** el farol pone su bombillo ámbar en `(x + 0.3, y + 0.3, z + 5)`; la luz cian va en `(x + 0.3, y + 0.3, z + 5 + 0.4)`, encima del bombillo. "Misma x, y, z del farol + 0.4" se lee como la posición del bombillo con 0.4 más de altura.
- **Flujo del `districtRng`:** la tirada del color se hace al final de cada edificio que califica, después de todas sus tiradas de geometría. Igual desplaza el flujo para las manzanas siguientes (el distrito se reacomoda); los tests del distrito son de propiedades y siguen en verde (verificado con una tirada de prueba).
- **Frame 0 del chase:** igual que el anillo de #13, mientras el paso del malecón es 0 (`clock < 250`) todas las luces están encendidas; desde el paso 1 corre `chase(n, step, 2)`.
- **Parpadeo:** el cartel elegido se apaga y vuelve a encenderse cuando el reloj alcanza `apagado + NEON_STEP_MS`. Un evento sobre un cartel que ya está apagado lo deja como está (no puede pasar con `SIGN_GAP_MS` ≥ 3000 > 150, pero el código no lo asume).
- La firma queda `createCityAnim(scene.tower, scene.neon, rng, opts)` (opción explícita del issue).

## Review Focus

1. **Frame 0 = reduced motion.** `neon()` antes de cualquier `tick` es igual a `scene.neon.signs` más un punto por farol; con `reducedMotion: true` es igual tras `tick(1000)`. Test en `city-anim.test.ts`.
2. **El cambio de color persiste y el parpadeo vuelve.** Tras un evento de color, el conteo de magenta difiere ±1 del inicial y se mantiene; tras un apagón, el cartel vuelve con su color en el paso siguiente. Test en `city-anim.test.ts` recorriendo ticks de 50 ms.
3. **Determinismo con ticks de distinto tamaño.** Dos animadores iguales con la misma secuencia de `tick` dan capas `toEqual`. Test en `city-animator.test.ts`.
4. **Carteles bien pegados a su edificio.** Cada cartel tiene un prisma `curtain` o `stone` con fachada cuya cara sur está 0.4 u detrás y cuyo rango z contiene el cartel. Test en `district.test.ts`.
5. **Velo.** `city.neon` cae en un animador `zone: "cv"`; `focusAlphas("blog").cv.accents === ACCENT_DIM`. Test en `assemble.test.ts`.

---

## Mapa de archivos

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `src/scenes/district.ts` | modificar | `districtBlock(..., signs, ...)` agrega un cartel por edificio ≥ 12 u |
| `src/scenes/district.test.ts` | modificar | geometría de carteles |
| `src/scenes/city.ts` | modificar | `CityScene.neon`, `malecon()` devuelve las posiciones |
| `src/scenes/city.test.ts` | modificar | `neon.signs ≥ 6`, coplanaridad, posiciones del malecón |
| `src/scenes/city-anim.ts` | modificar | capa `neon()`, cambio `neon`, constantes |
| `src/scenes/city-anim.test.ts` | modificar | animación de neones; reduced motion |
| `src/scenes/city-animator.ts` | modificar | id `city.neon` |
| `src/scenes/city-animator.test.ts` | modificar | ids exactos, cambio tras avanzar, determinismo |
| `src/world/assemble.test.ts` | modificar | `city.neon` en un animador `cv`, velo |
| `docs/superpowers/specs/assets/2026-10-14-cyberpunk/` | agregar | captura del lab con Resume enfocado |

---

### Task 1: geometría de neones en la escena

**Files:**
- Modify: `src/scenes/district.ts` (`glassTower`, `classic`, `districtBlock`)
- Modify: `src/scenes/city.ts` (`CityScene`, `malecon`, `city`)
- Test: `src/scenes/district.test.ts`, `src/scenes/city.test.ts`

**Interfaces:**
- Produces: `CityScene.neon: { signs: Accent[]; malecon: Vec3[] }`; `districtBlock(solids, ground, accents, signs, rng, b, maxH)`; `export const SIGN_MIN_H = 12` en `district.ts`.

- [ ] **Step 1: tests que fallan**

En `district.test.ts`, `build()` pasa un `signs: Accent[]` como cuarto argumento y lo devuelve. Agregar:

```ts
it("carteles de neón: uno por edificio ≥ 12 u, cian o magenta, plano en y, 0.4 u delante de la cara sur", () => {
  const { solids, signs } = build();
  expect(signs.length).toBeGreaterThan(0);
  for (const s of signs) {
    expect(s.kind).toBe("poly");
    if (s.kind !== "poly") continue;
    expect(s.pts).toHaveLength(4);
    expect(new Set(s.pts.map((p) => p.y)).size).toBe(1);
    expect(["cyan", "magenta"]).toContain(s.color);
    const y = s.pts[0]!.y, zs = s.pts.map((p) => p.z), xs = s.pts.map((p) => p.x);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1.6, 6);
    const wall = solids.find((w) => w.kind === "prism" && !!w.facade && (w.mat === "curtain" || w.mat === "stone") && w.at.z === PLINTH_H
      && Math.abs(w.at.y + w.d + 0.4 - y) < 1e-6 && Math.abs(w.at.x + 1 - Math.min(...xs)) < 1e-6 && Math.abs(w.at.x + w.w - 1 - Math.max(...xs)) < 1e-6);
    expect(wall).toBeDefined();
  }
});
```

En `city.test.ts`:

```ts
it("neon: ≥ 6 carteles coplanares en y y una luz sobre cada farol del malecón", () => {
  const c = city(createRng(7), createRng(8));
  expect(c.neon.signs.length).toBeGreaterThanOrEqual(6);
  for (const s of c.neon.signs) {
    if (s.kind !== "poly") throw new Error("cartel no poly");
    expect(s.pts).toHaveLength(4);
    expect(new Set(s.pts.map((p) => p.y)).size).toBe(1);
  }
  const bulbs = c.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.at.x === MALECON.x1 - 3 + 0.3);
  expect(c.neon.malecon).toHaveLength(8);
  for (const p of c.neon.malecon) expect(bulbs.some((b) => b.kind === "dot" && b.at.y === p.y && b.at.z + 0.4 === p.z)).toBe(true);
});
```

(Importar `MALECON` de `./city-grid` si no está importado; si `createRng(7), createRng(8)` da menos de 6 carteles, probar también con la semilla del mundo: `zoneRng(SEED, "cv"), zoneRng(SEED, "cv", 1)` como en `world.ts`. El issue exige ≥ 6 con la geometría real.)

- [ ] **Step 2:** `npx vitest run src/scenes/district.test.ts src/scenes/city.test.ts` → FAIL (`neon` no existe, `signs` vacío).

- [ ] **Step 3: implementación**

`district.ts`:

```ts
export const SIGN_MIN_H = 12;

/** Cartel de neón en la cara sur, a media altura: 1.6 u de alto, 1 u de margen a cada lado, 0.4 u delante de la pared. */
function facadeSign(signs: Accent[], rng: Rng, x: number, southY: number, w: number, h: number): void {
  if (h < SIGN_MIN_H) return;
  const y = southY + 0.4, z0 = PLINTH_H + h / 2 - 0.8, z1 = z0 + 1.6;
  signs.push({ kind: "poly", pts: [v3(x + 1, y, z0), v3(x + w - 1, y, z0), v3(x + w - 1, y, z1), v3(x + 1, y, z1)], color: rng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
}
```

`glassTower` y `classic` reciben `signs` y llaman `facadeSign(signs, rng, bx, by + bd, bw, h)` como última línea. `districtBlock` gana `signs: Accent[]` como cuarto parámetro y lo pasa.

`city.ts`: `CityScene` gana `neon: { signs: Accent[]; malecon: Vec3[] }` (comentario corto: neones que anima city-anim). `malecon(solids, accents): Vec3[]` devuelve `ys.map((y) => v3(x1 - 3 + 0.3, y + 0.3, z + 5 + 0.4))` con la misma lista de `y` de los faroles. `city()` crea `signs`, lo pasa a `districtBlock` y devuelve `neon: { signs, malecon: maleconLights }`.

- [ ] **Step 4:** `npx vitest run src/scenes && npm run typecheck` → PASS.

- [ ] **Step 5: commit** `feat(#14): carteles de neón del distrito y luces del malecón en la escena de la ciudad`.

---

### Task 2: capa `neon()` en `city-anim.ts`

**Files:**
- Modify: `src/scenes/city-anim.ts`, `src/scenes/city-animator.ts` (solo la llamada a `createCityAnim`, para que compile)
- Test: `src/scenes/city-anim.test.ts`

**Interfaces:**
- Consumes: `CityScene["neon"]` (Task 1), `chase` de `./neon`.
- Produces: `createCityAnim(tower, neon, rng, opts)`; `CityAnim.neon(): Accent[]`; `CityAnimChanges.neon: boolean`; `export const NEON_STEP_MS = 150, SIGN_GAP_MS: [number, number] = [3000, 7000], MALECON_STEP_MS = 250, MALECON_R = 0.35`.

- [ ] **Step 1: tests que fallan** (en `city-anim.test.ts`; `setup` pasa `scene.neon`)

```ts
const lights = (a: Accent[]) => a.filter((x) => x.kind === "dot");
const signsOf = (a: Accent[]) => a.filter((x) => x.kind === "poly");

it("neon frame 0: carteles en su color inicial y todas las luces del malecón; solo cyan/magenta", () => {
  const { scene, anim } = setup();
  expect(signsOf(anim.neon())).toEqual(scene.neon.signs);
  expect(lights(anim.neon()).map((d) => d.kind === "dot" && d.at)).toEqual(scene.neon.malecon);
  for (const d of lights(anim.neon())) if (d.kind === "dot") { expect(d.color).toBe("cyanMid"); expect(d.r).toBe(0.35); }
  for (const x of anim.neon()) expect(x.color).toMatch(/^(cyan|magenta)/);
});
it("neon con reduced-motion: tick no reporta y la capa queda en el frame 0", () => {
  const { anim } = setup(true);
  const f0 = anim.neon();
  expect(anim.tick(1000).neon).toBe(false);
  expect(anim.neon()).toEqual(f0);
});
it("el malecón corre: desde el paso 1 hay exactamente 2 luces encendidas y cambian por paso", () => {
  const { anim } = setup();
  expect(anim.tick(MALECON_STEP_MS).neon).toBe(true);
  const a = lights(anim.neon());
  expect(a).toHaveLength(2);
  anim.tick(MALECON_STEP_MS);
  expect(lights(anim.neon())).not.toEqual(a);
});
it("carteles: hay eventos dentro de 7 s; los cambios de color persisten y los apagones duran un paso", () => {
  const { scene, anim } = setup();
  const n = scene.neon.signs.length, mag = (a: Accent[]) => signsOf(a).filter((s) => s.color === "magenta").length;
  let colorChanged = false, blinked = false;
  for (let t = 0; t < 20000; t += 50) {
    anim.tick(50);
    const s = signsOf(anim.neon());
    if (s.length < n) { blinked = true; expect(n - s.length).toBe(1); }
    if (s.length === n && mag(s) !== mag(scene.neon.signs)) colorChanged = true;
  }
  expect(colorChanged || blinked).toBe(true);
  expect(signsOf(anim.neon()).length).toBeGreaterThanOrEqual(n - 1);
});
```

Más un test de apagón que vuelve: avanzar en ticks de 50 ms hasta ver `signsOf(...).length === n - 1`; los siguientes ≤ 4 ticks de 50 ms (≤ 200 ms > `NEON_STEP_MS`) devuelven `n` carteles con el mismo color que tenía antes. Usar una semilla para la que haya un apagón dentro de 60 s (probar 3; si no, buscar en un loop de semillas dentro del test).

Actualizar los tests existentes para la firma nueva y el `NONE` con `neon: false`.

- [ ] **Step 2:** `npx vitest run src/scenes/city-anim.test.ts` → FAIL.

- [ ] **Step 3: implementación**

En `createCityAnim(tower, neon, rng, opts)`, después del estado existente (para no reordenar las tiradas de los papeles):

```ts
const signs = neon.signs.map((a) => ({ a, color: a.color, offUntil: -1 }));
let signTimer = rng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
let maleconStep = 0;
```

`neon()`: carteles con `offUntil <= clock` (es decir, encendidos) como `{ ...a, color }`, más las luces del malecón: si `maleconStep === 0` todas; si no, las que `chase(n, maleconStep, 2)` marca, como `{ kind: "dot", at, r: MALECON_R, color: "cyanMid" }`.

En `tick`, después de lo existente:

```ts
for (const s of signs) if (s.offUntil >= 0 && clock >= s.offUntil) { s.offUntil = -1; c.neon = true; } // vuelve el tubo
signTimer -= dtMs;
if (signTimer <= 0 && signs.length > 0) {
  const s = signs[rng.int(0, signs.length - 1)]!;
  if (rng.chance(0.5)) s.color = s.color === "cyan" ? "magenta" : "cyan";
  else if (s.offUntil < 0) s.offUntil = (Math.floor(clock / NEON_STEP_MS) + 1) * NEON_STEP_MS;
  signTimer = rng.int(SIGN_GAP_MS[0], SIGN_GAP_MS[1]);
  c.neon = true;
}
const ms = Math.floor(clock / MALECON_STEP_MS);
if (ms !== maleconStep) { maleconStep = ms; c.neon = true; }
```

(El apagón termina en el siguiente borde de paso de 150 ms: la vuelta es un cambio cuantizado, como los demás.) `NONE` gana `neon: false`; el `c` inicial `neon: false`. Comentario de cabecera: sumar los neones a la lista de animaciones.

`city-animator.ts`: `createCityAnim(scene.tower, scene.neon, rng, opts)` (todavía sin el id nuevo).

- [ ] **Step 4:** `npx vitest run src/scenes && npm run typecheck` → PASS.

- [ ] **Step 5: commit** `feat(#14): los carteles cambian de color o parpadean y el malecón corre`.

---

### Task 3: id `city.neon`, velo y captura

**Files:**
- Modify: `src/scenes/city-animator.ts`
- Test: `src/scenes/city-animator.test.ts`, `src/world/assemble.test.ts`
- Add: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/city-neon-resume.png`

**Interfaces:**
- Consumes: `CityAnim.neon()`, `CityAnimChanges.neon` (Task 2).
- Produces: id `city.neon` en `cityAnimator(...).ids`.

- [ ] **Step 1: tests que fallan**

`city-animator.test.ts`: los ids exactos pasan a `["city.antenna", "city.lit", "city.neon", "city.papers"]`; y

```ts
it("city.neon es una capa de acentos cian/magenta que cambia al avanzar el reloj", () => {
  const a = cityAnimator(city(createRng(7), createRng(8)), createRng(3), { reducedMotion: false });
  const l0 = a.layer("city.neon");
  expect(l0.kind).toBe("accent");
  if (l0.kind === "accent") for (const x of l0.accents) expect(x.color).toMatch(/^(cyan|magenta)/);
  let seen = false;
  for (let i = 0; i < 20; i++) if (a.tick(100).has("city.neon")) seen = true;
  expect(seen).toBe(true);
  expect(a.layer("city.neon")).not.toEqual(l0);
});
it("mismo seed → misma secuencia", () => {
  const mk = () => cityAnimator(city(createRng(7), createRng(8)), createRng(3), { reducedMotion: false });
  const a = mk(), b = mk();
  for (const dt of [16, 33, 100, 250, 1000, 5000, 7000, 33]) { expect([...a.tick(dt)]).toEqual([...b.tick(dt)]); for (const id of a.ids) expect(a.layer(id)).toEqual(b.layer(id)); }
});
```

`assemble.test.ts`:

```ts
it("la capa city.neon vive en un animador de Resume y se atenúa con el velo", () => {
  const { animators } = assembleWorld(undefined, { reducedMotion: true });
  const a = animators.find((x) => x.ids.includes("city.neon"));
  expect(a?.zone).toBe("cv");
  expect(focusAlphas("blog").cv.accents).toBe(ACCENT_DIM);
  expect(focusAlphas("portfolio").cv.accents).toBe(ACCENT_DIM);
  expect(a!.tick(1000).size).toBe(0);
});
```

- [ ] **Step 2:** `npx vitest run src/scenes/city-animator.test.ts src/world/assemble.test.ts` → FAIL.

- [ ] **Step 3:** en `city-animator.ts`, `"city.neon": () => ({ kind: "accent", accents: anim.neon() })` y `if (c.neon) out.add("city.neon")`. Docstring: "las cuatro animaciones".

- [ ] **Step 4:** `npm test && npm run typecheck` → PASS.

- [ ] **Step 5: commit** `feat(#14): capa city.neon en el animador de la ciudad`.

- [ ] **Step 6 (orquestador, no implementador): captura.** `npm run dev -- --host --port 5173`, `agent-browser` a `http://localhost:5173/lab/world.html`, tecla `2` (Resume), captura a `docs/superpowers/specs/assets/2026-10-14-cyberpunk/city-neon-resume.png`. Commit `docs(#14): captura del lab con Resume enfocado`.
