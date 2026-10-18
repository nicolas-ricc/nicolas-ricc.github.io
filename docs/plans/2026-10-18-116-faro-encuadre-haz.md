# Encuadre del faro con el haz entero (#116): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el exhibit `faro` del storybook muestre la punta del haz en todas las fases de su rotación, con un `h` derivado de las constantes del haz, y que el test de encuadre del catálogo cuente los acentos.

**Architecture:** `sea.ts` exporta `LANTERN_Z`, la altura de la linterna (de donde nace el haz), y `lighthouse()` la usa. En `exhibits.ts` el `h` del faro sale de `LANTERN_Z`, `BEAM_LEN`, `DRUM_R0`, `M` y `Z_SCALE`. En `exhibits.test.ts` la medición de cada región suma la altura equivalente de sus acentos (estáticos y de capas animadas, a lo largo de una vuelta del haz) medida en pantalla contra el vértice norte de la caja, que es el que fija el borde superior del cuadro.

**Tech Stack:** TypeScript, Vitest, PixiJS v8 (solo para la captura).

**Spec:** issue #116 y su Agent Brief (comentario de triage).

## Global Constraints

- "La altura del encuadre incluye el alcance del haz. El valor se deriva de las constantes del haz (longitud de la cuña larga y altura de la linterna), no de un número suelto."
- "El test de encuadre del catálogo cuenta también los polígonos de acentos (incluidos los de capas animadas en su primer tick) y falla si alguno sale de la caja."
- "El test de encuadre falla si se vuelve al valor anterior de `h`" (`LIGHTHOUSE.z + 32` = 39).
- Fuera de alcance: "Cambiar la geometría del faro o del haz." `LANTERN_Z` es un nombre para un valor que ya existe; `scene.lantern` no se mueve ni un bit.
- `npm test` y `npm run typecheck` en verde. Textos y nombres de test en castellano. Commits `test(#116): …`, `fix(#116): …`, `docs(#116): …`.

## Datos

- `project(v) = { x: v.x − v.y, y: (v.x + v.y)/2 − v.z·Z_SCALE }`, `Z_SCALE = 1.4` (`src/iso/project.ts`).
- `boxFrame(box, h)` (`src/world/frame.ts`) proyecta cuatro puntos: el vértice norte `(x0, y0, h)` y los otros tres a z 0. `fitTransform` encaja su rectángulo en el canvas. El borde superior del cuadro es la `y` en pantalla del vértice norte: `(x0 + y0)/2 − h·Z_SCALE`.
- Linterna: `LIGHTHOUSE.z + DRUMS·DRUM_H + GALLERY_H + LANTERN_H/2 = 7 + 24 + 0.6 + 1.5 = 33.1` (lo fija `sea.test.ts:36`).
- Haz (`src/scenes/sea-anim.ts`): dos cuñas horizontales a la altura de la linterna, `BEAM_LEN = 24` y `BEAM_INNER = 12`, semiancho `BEAM_HALF = 7°`, una vuelta cada `BEAM_PERIOD_MS = 8000`. En el primer tick el ángulo es 0 (al este): ahí la punta no sube en pantalla, así que medir solo el primer tick no detecta el corte. Hay que barrer la vuelta.
- La punta sube más en pantalla cuando el haz apunta al norte de la pantalla (dirección `(−1, −1)/√2`, ángulo 225°): sube `BEAM_LEN/√2 ≈ 16.97` unidades de pantalla sobre la linterna. El vértice norte de la caja ya está `DRUM_R0 + M = 6.2` unidades más arriba que el centro del faro. Altura necesaria: `33.1 + (16.97 − 6.2)/1.4 ≈ 40.79`. Con el semiancho de 7° la medida real es 40.76; `h = 39` corta ≈ 2.5 unidades de pantalla.
- Prototipo de la medición sobre las 38 regiones (barrido de 32 pasos de 250 ms): solo `faro` (40.76 > 39) y `casa-farero` (30.9 > 13) se pasan. En `casa-farero` es la punta del haz del faro vecino que entra a la caja por el oeste: su origen (la linterna) está fuera.

## Decisiones técnicas (declaradas)

1. **Medida en pantalla, solo hacia arriba.** "Sale de la caja" se lee como "sale del cuadro": la cuña de 24 u siempre sale de la caja x/y del faro (±6.2 u), y lo que corta el canvas es el borde superior del cuadro proyectado. El test compara la `y` en pantalla de cada vértice de acento (y la parte de arriba de cada punto, `y − r`) con la del vértice norte de `boxFrame`, expresado como altura equivalente: `((x0 + y0)/2 − project(p).y + r)/Z_SCALE ≤ h`.
2. **Ancho no se vigila.** El ancho visible depende de la proporción del host (`#lab-host` es el viewport menos 30 rem). A 1600×900 entra con holgura (≈ 87 u de pantalla visibles contra 68 del haz). Ensanchar la caja para un host angosto cambiaría el encuadre de todo el exhibit; queda fuera.
3. **Qué acentos cuentan.** Los que pertenecen a la estructura: un punto si su centro cae en la caja, un polígono si su primer vértice cae en la caja (el haz nace en `pts[0]`, la linterna). Es la misma idea que `within` para sólidos. La punta del haz que entra a `casa-farero` es un acento vecino cortado, como los sólidos vecinos; arreglarlo es otro cambio de encuadre y va a un follow-up.
4. **Barrido de una vuelta del haz, sobre un mundo aparte.** Se arma un segundo `assembleWorld` para no mover los animadores que miden los demás tests. Se mira la capa de acentos en el primer tick y después de cada uno de 32 pasos de `BEAM_PERIOD_MS/32` (11.25°, incluye 225°). El barrido aplica a todas las regiones, no solo al faro.
5. **Fórmula del `h`.** `LANTERN_Z + (BEAM_LEN·√½ − DRUM_R0 − M)/Z_SCALE`. Usa la cuña larga sin el semiancho: cota superior simple (0.03 u de más) que sigue a `BEAM_LEN` si cambia.
6. **Captura.** Se agrega `docs/superpowers/specs/assets/97-storybook/faro-haz.png` con el haz apuntando al norte (la fase peor), tomada con `?bloom=off` como las de cierre de #97. `faro.png` queda como evidencia del corte que cita el issue.

## Review Focus

1. Volver a `h: LIGHTHOUSE.z + 32` hace fallar el test de encuadre del grupo `mar` (tarea 2, paso 2).
2. Con `prefers-reduced-motion` el haz queda fijo al este: entra con cualquier `h` ≥ estructura; el barrido no depende de eso porque usa `reducedMotion: false`.
3. Otras regiones con acentos animados (`noria`, `torre`, `chimeneas`, `carrusel`) no deben empezar a fallar: el test corre sobre las 38 (tarea 2, paso 4).
4. El `h` nuevo no debe superar `withAnim + SLACK`: la cota superior también cuenta los acentos (tarea 2).
5. `LANTERN_Z` tiene que coincidir con `scene.lantern.z` (tarea 1).

---

### Task 1: `LANTERN_Z` en `sea.ts`

**Files:**
- Modify: `src/scenes/sea.ts:29-60`
- Test: `src/scenes/sea.test.ts`

**Interfaces:**
- Produces: `export const LANTERN_Z: number` en `src/scenes/sea.ts` (= 33.1).

- [ ] **Step 1: test que falla.** En `sea.test.ts`, importar `LANTERN_Z` y en el test "faro: seis tambores…" agregar, junto a la línea de `s.lantern.z`:

```ts
    expect(s.lantern.z).toBe(LANTERN_Z); // de acá nace el haz: el encuadre del storybook la usa (#116)
```

- [ ] **Step 2:** `npx vitest run src/scenes/sea.test.ts` → falla (`LANTERN_Z` no existe; `npm run typecheck` también).

- [ ] **Step 3: implementación.** Debajo de la línea de `DRUMS, DRUM_H, …` en `sea.ts`:

```ts
/** Centro de la linterna, de donde nace el haz (sea-anim.ts). */
export const LANTERN_Z = LIGHTHOUSE.z + DRUMS * DRUM_H + GALLERY_H + LANTERN_H / 2;
```

Y en `lighthouse()` `const lantern = v3(x, y, LANTERN_Z);` en lugar de `v3(x, y, z + LANTERN_H / 2)`.

- [ ] **Step 4:** `npx vitest run src/scenes/sea.test.ts` y `npm run typecheck` en verde.

- [ ] **Step 5:** `git commit -m "refactor(#116): LANTERN_Z names the lantern height"`

### Task 2: el encuadre cuenta acentos y el faro deja entrar el haz

**Files:**
- Modify: `src/lab/exhibits.test.ts:24-40, 76-82`
- Modify: `src/lab/exhibits.ts:1-20, 147-149`

**Interfaces:**
- Consumes: `LANTERN_Z` (tarea 1), `BEAM_LEN`, `BEAM_PERIOD_MS` de `src/scenes/sea-anim.ts`, `project`, `Z_SCALE` de `src/iso/project.ts`.

- [ ] **Step 1: test que falla.** En `exhibits.test.ts`:

```ts
// un mundo aparte para barrer la vuelta del haz sin mover los animadores de `measure`
const sweep = assembleWorld(undefined, { reducedMotion: false });
const TURN_STEPS = 32;

/** Altura de caja que hace falta para que los acentos de la estructura no se salgan por arriba del cuadro: se mide en pantalla contra el vértice norte de `boxFrame`. Cuentan los acentos estáticos y los animados en el primer tick y a lo largo de una vuelta del haz. */
function accentReach(box: Box): number {
  const north = (box.x0 + box.y0) / 2;
  const own = (a: Accent): boolean => { const p = a.kind === "dot" ? a.at : a.pts[0]!; return p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1; };
  const reach = (accents: readonly Accent[]): number => Math.max(0, ...accents.filter(own).flatMap((a) =>
    a.kind === "dot" ? [(north - project(a.at).y + a.r) / Z_SCALE] : a.pts.map((p) => (north - project(p).y) / Z_SCALE)));
  const anims = cropAnimators(sweep.animators, box);
  let max = reach(cropScene(sweep.scene, box).accents);
  for (let k = 0; k <= TURN_STEPS; k++) {
    for (const a of anims) for (const id of a.ids) { const l = a.layer(id); if (l.kind === "accent") max = Math.max(max, reach(l.accents)); }
    for (const a of anims) a.tick(BEAM_PERIOD_MS / TURN_STEPS);
  }
  return max;
}
```

`measure` devuelve además `accents: accentReach(box)`. El test de encuadre pasa a:

```ts
    it("encuadre: h cubre la estructura y sus acentos y no sobra más de SLACK", () => {
      for (const e of mine) {
        const h = e.h ?? FRAME_H, m = measured.get(e)!;
        expect(h, e.id).toBeGreaterThanOrEqual(Math.max(m.inside, m.accents));
        expect(h, e.id).toBeLessThanOrEqual(Math.max(m.withAnim, m.accents) + SLACK);
      }
    });
```

- [ ] **Step 2:** `npx vitest run src/lab/exhibits.test.ts` → falla solo `grupo mar › encuadre` con `faro` (≈ 40.76 > 39).

- [ ] **Step 3: implementación.** En `exhibits.ts` importar `Z_SCALE` de `../iso/project`, `BEAM_LEN` de `../scenes/sea-anim` y `LANTERN_Z` de `../scenes/sea`, y la entrada `faro`:

```ts
  // el haz nace en la linterna y gira: apuntando al norte su punta sube BEAM_LEN/√2 en pantalla, y el vértice norte de la caja ya está DRUM_R0 + M más arriba que el faro
  { id: "faro", title: "Faro", zone: "blog", group: "mar", kind: "region",
    box: { …igual… },
    h: LANTERN_Z + (BEAM_LEN * Math.SQRT1_2 - DRUM_R0 - M) / Z_SCALE },
```

- [ ] **Step 4:** `npx vitest run src/lab/exhibits.test.ts` en verde (las 38 regiones); `npm test`, `npm run typecheck`.

- [ ] **Step 5:** commits separados: el test (`test(#116): frame test counts accents over a beam turn`) y el arreglo (`fix(#116): faro frame height covers the beam tip`).

### Task 3: captura del faro con el haz al norte

**Files:**
- Create: `docs/superpowers/specs/assets/97-storybook/faro-haz.png`
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (línea de capturas de cierre, §223)

- [ ] **Step 1:** `npm run dev -- --host --port 5173`; con agent-browser (viewport 1600×900×2) abrir `http://localhost:5173/lab/storybook.html?bloom=off#faro`.
- [ ] **Step 2:** detener el ticker de Pixi (`window.__PIXI_DEVTOOLS_WRAPPER__` da el renderer y el stage; la app se alcanza con el gancho de devtools) y avanzar el reloj con pasos fijos de 100 ms hasta 5000 ms (ángulo 225°), como en el método del time-lapse de CLAUDE.md. Verificar en pantalla que la punta queda dentro del canvas; repetir en 0, 2000, 4000 y 6000 ms.
- [ ] **Step 3:** guardar la captura de 5000 ms como `faro-haz.png` y sumar una frase a la spec: "`faro-haz.png`: el haz al norte con el encuadre de #116".
- [ ] **Step 4:** `git commit -m "docs(#116): faro capture with the beam pointing north"`
