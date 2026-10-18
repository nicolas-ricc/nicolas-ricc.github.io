# Paleta de nueve tonos (#36) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasar la paleta isométrica de cinco a nueve tonos por material (`deep, shade, dim, lit, down, top, up, pale, glow`), sumar los materiales `plaster`, `terracotta`, `marble`, `awning` y los acentos `windowWarm`, `windowCool`.

**Architecture:** `palette-base.ts` sigue guardando cinco tonos base por material y gana dos funciones puras (`cityLadder`, `extendLadder`); `scripts/darken-palette.ts` extiende cada material a nueve y oscurece ×0.7; su salida se pega como literales en `ISO_TONES` (`palette-iso.ts`). `Tone`/`TONE_LADDER` pasan a nueve; `shadeTone` no cambia.

**Tech Stack:** TypeScript estricto, Vitest, tsx.

**Spec:** issue #36 + `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §4. Decisión humana en #36 (opción **A**): `pale` = media por canal de `up` y `glow` (reemplaza "media de `top` y `up`" de la spec y del issue).

## Global Constraints

- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo; sin Pixi en tests; nada de dependencias nuevas.
- Literales hex solo en `palette-iso.ts`, `palette-base.ts` y `seed.ts` (`palette-guard.test.ts`).
- No calcular colores en runtime: `ISO_TONES` son literales pegados de `npm run palette`.
- `src/iso/light.ts` (`shadeTone`), `water-anim.ts`, `sky`, `shadow`, el CSS de `index.html` y `lab/*.html` no cambian.
- Redondeo `Math.round` por canal; saturación a 255 en `cityLadder` y `glow`.
- Commits `feat(#36): …` / `test(#36): …` / `docs(#36): …`.

## Review Focus

1. Canales que saturan (`whitewash.up`, `glint.up`, `marble.up` × 1.12 > 255): `glow` debe quedar en 255 sin desbordar al canal vecino, y la luminancia seguir estrictamente creciente → test de saturación en Task 1 y test monótono de nueve en Task 2.
2. Materiales muy oscuros (`abyss`, `waterDeep`): tras redondear, `deep` debe seguir estrictamente por debajo de `shade` → cubierto por el test monótono para todos los materiales (Task 2).
3. Orden de claves: `Object.keys(ISO_TONES)` debe igualar `Object.keys(BASE_TONES)`; los nuevos materiales van al final de ambos → test existente "crepúsculo tardío" (Task 2).
4. Offsets existentes (`toneOffset` −2..+1, `water-anim` −2..1 desde `top`): desde `top` siguen cayendo en `lit..up`; desde `shade`/`lit` ahora llegan a `deep`/`dim` (consecuencia aceptada) → tests de `stepTone` en Task 2.
5. Lo pegado en `palette-iso.ts` debe coincidir con la salida del script → test existente "lo impreso es lo que está pegado" (Task 2).

---

### Task 1: `cityLadder` y `extendLadder`

**Files:**
- Modify: `src/map/palette-base.ts`
- Test: `src/map/palette-base.test.ts`

**Interfaces:**
- Produces:
  - `export type FiveTones = { top: number; lit: number; shade: number; up: number; down: number }`
  - `export type NineTones = FiveTones & { deep: number; dim: number; pale: number; glow: number }`
  - `export function cityLadder(top: number): FiveTones`
  - `export function extendLadder(t: FiveTones): NineTones`

- [ ] **Step 1: tests que fallan** en `palette-base.test.ts`:

```ts
const ch = (c: number, s: number) => (c >> s) & 255;
const near = (a: number, b: number) => { for (const s of [16, 8, 0]) expect(Math.abs(ch(a, s) - ch(b, s))).toBeLessThanOrEqual(1); };
const mul = (c: number, f: readonly [number, number, number]) =>
  (Math.min(255, Math.round(ch(c, 16) * f[0])) << 16) | (Math.min(255, Math.round(ch(c, 8) * f[1])) << 8) | Math.min(255, Math.round(ch(c, 0) * f[2]));
const mean = (a: number, b: number) => (Math.round((ch(a, 16) + ch(b, 16)) / 2) << 16) | (Math.round((ch(a, 8) + ch(b, 8)) / 2) << 8) | Math.round((ch(a, 0) + ch(b, 0)) / 2);

describe("escaleras", () => {
  it("cityLadder sigue la regla de ciudad y costa", () => {
    const t = cityLadder(0x8a8296);
    expect(t.top).toBe(0x8a8296);
    near(t.lit, mul(0x8a8296, [0.82, 0.74, 0.62]));
    near(t.shade, mul(0x8a8296, [0.40, 0.42, 0.60]));
    near(t.up, mul(0x8a8296, [1.16, 1.12, 1.02]));
    near(t.down, mul(0x8a8296, [0.86, 0.88, 0.94]));
  });

  it("cityLadder satura a 255", () => {
    expect(cityLadder(0xf0f0f0).up).toBe(0xffffff);
  });

  it("extendLadder agrega deep, dim, pale y glow (pale entre up y glow)", () => {
    const b = BASE_TONES.office, n = extendLadder(b);
    for (const k of ["top", "lit", "shade", "up", "down"] as const) expect(n[k]).toBe(b[k]);
    near(n.deep, mul(b.shade, [0.70, 0.72, 0.80]));
    near(n.dim, mean(b.shade, b.lit));
    near(n.glow, mul(b.up, [1.12, 1.08, 1.02]));
    near(n.pale, mean(b.up, n.glow));
  });

  it("glow satura a 255 sin desbordar", () => {
    const n = extendLadder(BASE_TONES.whitewash); // up 0xf8e8c3
    expect(ch(n.glow, 16)).toBe(255);
    expect(n.glow).toBeLessThanOrEqual(0xffffff);
  });

});
```

- [ ] **Step 2:** `npx vitest run src/map/palette-base.test.ts` → FAIL (`cityLadder` no existe).

- [ ] **Step 3: implementación** en `palette-base.ts`:

```ts
export type FiveTones = { top: number; lit: number; shade: number; up: number; down: number };
export type NineTones = FiveTones & { deep: number; dim: number; pale: number; glow: number };

type Rgb = readonly [number, number, number];
const scale = (c: number, [r, g, b]: Rgb): number => {
  const ch = (shift: number, f: number) => Math.min(255, Math.round(((c >> shift) & 255) * f));
  return (ch(16, r) << 16) | (ch(8, g) << 8) | ch(0, b);
};
const mean = (a: number, b: number): number => {
  const ch = (shift: number) => Math.round((((a >> shift) & 255) + ((b >> shift) & 255)) / 2);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Regla "ciudad y costa" (ver encabezado de palette-iso.ts) a partir del `top` base. */
export function cityLadder(top: number): FiveTones {
  return { top, lit: scale(top, [0.82, 0.74, 0.62]), shade: scale(top, [0.40, 0.42, 0.60]), up: scale(top, [1.16, 1.12, 1.02]), down: scale(top, [0.86, 0.88, 0.94]) };
}

/** Los cinco tonos más deep, dim, pale y glow: la escalera de nueve. */
export function extendLadder(t: FiveTones): NineTones {
  const glow = scale(t.up, [1.12, 1.08, 1.02]);
  return { ...t, deep: scale(t.shade, [0.70, 0.72, 0.80]), dim: mean(t.shade, t.lit), pale: mean(t.up, glow), glow };
}
```

- [ ] **Step 4:** `npm test` y `npm run typecheck` → verde (Task 1 no cambia ningún color).
- [ ] **Step 5:** commit `feat(#36): cityLadder y extendLadder`.

### Task 2: escalera de nueve en `palette-iso.ts` y en el script

**Files:**
- Modify: `src/map/palette-base.ts` (cuatro materiales), `src/map/palette-iso.ts`, `scripts/darken-palette.ts`, `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` (línea de `pale` en §4)
- Test: `src/map/palette-iso.test.ts`, `src/map/palette-base.test.ts`, `scripts/darken-palette.test.ts`

**Interfaces:**
- Consumes: `cityLadder`, `extendLadder`, `BASE_TONES` (Task 1).
- Produces: `BASE_TONES.plaster|terracotta|marble|awning` (al final del objeto); `type Tone = "deep" | "shade" | "dim" | "lit" | "down" | "top" | "up" | "pale" | "glow"`; `TONE_LADDER` de nueve; `ISO_TONES[mat]` con las nueve claves.

- [ ] **Step 1: tests que fallan.** En `palette-iso.test.ts`:
  - "cada material tiene cinco tonos ordenados" → "cada material tiene los nueve tonos, con luminancia estrictamente creciente":
    ```ts
    for (const mat of Object.keys(ISO_TONES) as Material[]) {
      expect(Object.keys(ISO_TONES[mat]).sort()).toEqual([...TONE_LADDER].sort());
      for (let i = 1; i < TONE_LADDER.length; i++) expect(lum(ISO_TONES[mat][TONE_LADDER[i]!])).toBeGreaterThan(lum(ISO_TONES[mat][TONE_LADDER[i - 1]!]));
    }
    ```
  - `stepTone`: `expect(TONE_LADDER).toEqual(["deep", "shade", "dim", "lit", "down", "top", "up", "pale", "glow"])`; `stepTone("top", 1) === "up"`, `stepTone("top", -1) === "down"`, `stepTone("shade", -1) === "deep"`, `stepTone("up", 1) === "pale"`, `stepTone("glow", 1) === "glow"`, `stepTone("deep", -3) === "deep"`, `stepTone("lit", -1) === "dim"`, `stepTone("lit", 0) === "lit"`.
  - "materiales exclusivos de ciudad y costa": lista + `"plaster", "terracotta", "marble", "awning"`, claves esperadas = `[...TONE_LADDER].sort()`; ídem `hullBlue` en el test del agua.
  - En `palette-base.test.ts`, dentro de `describe("escaleras")` (±1 por canal, como pide el issue):
    ```ts
    it("los cuatro materiales de Resume nivel 2 salen de cityLadder", () => {
      const tops = { plaster: 0xb89a86, terracotta: 0x9a5a3c, marble: 0xcfc4b0, awning: 0x3a5a4a } as const;
      for (const [m, top] of Object.entries(tops) as [keyof typeof tops, number][]) {
        const want = cityLadder(top);
        for (const k of ["top", "lit", "shade", "up", "down"] as const) near(BASE_TONES[m][k], want[k]);
      }
    });
    ```
  - "crepúsculo tardío": `for (const tone of TONE_LADDER) channelsClose(ISO_TONES[mat][tone], darken(extendLadder(BASE_TONES[mat])[tone], DARKEN));`
  
  En `scripts/darken-palette.test.ts`: la primera línea esperada pasa a ser la de nueve claves del formato `  slab:      { deep: 0x…, shade: 0x…, dim: 0x…, lit: 0x…, down: 0x…, top: 0x…, up: 0x…, pale: 0x…, glow: 0x… },` (el valor exacto se copia de la salida de `npm run palette` tras el Step 3), y un test nuevo: cada línea trae las nueve claves en orden:
    ```ts
    for (const l of out.tones) expect(l).toMatch(/\{ deep: 0x[0-9a-f]{6}, shade: 0x[0-9a-f]{6}, dim: 0x[0-9a-f]{6}, lit: 0x[0-9a-f]{6}, down: 0x[0-9a-f]{6}, top: 0x[0-9a-f]{6}, up: 0x[0-9a-f]{6}, pale: 0x[0-9a-f]{6}, glow: 0x[0-9a-f]{6} \},$/);
    ```
- [ ] **Step 2:** `npx vitest run src/map scripts` → FAIL.
- [ ] **Step 3: implementación.**
  - `palette-base.ts`: al final de `BASE_TONES` (literales de `cityLadder`, ya calculados):

```ts
  // Resume nivel 2: cityLadder(top) pegado como literal
  plaster:   { top: 0xb89a86, lit: 0x977253, shade: 0x4a4150, up: 0xd5ac89, down: 0x9e887e },
  terracotta:{ top: 0x9a5a3c, lit: 0x7e4325, shade: 0x3e2624, up: 0xb3653d, down: 0x844f38 },
  marble:    { top: 0xcfc4b0, lit: 0xaa916d, shade: 0x53526a, up: 0xf0dcb4, down: 0xb2aca5 },
  awning:    { top: 0x3a5a4a, lit: 0x30432e, shade: 0x17262c, up: 0x43654b, down: 0x324f46 },
```
  - `scripts/darken-palette.ts`: `const NINE = ["deep", "shade", "dim", "lit", "down", "top", "up", "pale", "glow"] as const;` y cada línea: `` `  ${`${mat}:`.padEnd(11)}{ ${NINE.map((k) => `${k}: ${hex(n[k])}`).join(", ")} },` `` con `n = extendLadder(t)`. (No importa `TONE_LADDER` de `palette-iso.ts` para que el script dependa solo de la base.)
  - `npm run palette` y reemplazar el cuerpo de `ISO_TONES` por la salida, conservando los comentarios de sección y de fin de línea existentes (agua, Resume, Blog, `glint`) y agregando `// Resume nivel 2: residencial, cubiertas, cívico, toldos` antes de `plaster`.
  - `Tone` y `TONE_LADDER` de nueve (orden de arriba). `stepTone`, `toneColor`, `allIsoColors` no cambian.
  - Encabezado de `palette-iso.ts`: "Nueve tonos por material…": la escalera `deep, shade, dim, lit, down, top, up, pale, glow`; los cinco de siempre con sus reglas; `deep = shade × (0.70, 0.72, 0.80)`, `dim` = media de `shade` y `lit`, `pale` = media de `up` y `glow`, `glow = up × (1.12, 1.08, 1.02)` saturado, aplicados sobre la base (`extendLadder`); `shadeTone` sigue devolviendo solo `shade lit down top up`.
  - Spec §4: fila `pale` → "media aritmética de `up` y `glow`" con nota de la decisión de #36.
- [ ] **Step 4:** `npm test` y `npm run typecheck` → verde.
- [ ] **Step 5:** commit `feat(#36): escalera de nueve tonos en el atlas y en npm run palette`.

### Task 3: acentos `windowWarm` y `windowCool`

**Files:**
- Modify: `src/map/palette-iso.ts`
- Test: `src/map/palette-iso.test.ts`

**Interfaces:**
- Produces: `ISO_COLORS.windowWarm = 0xffd9a0`, `ISO_COLORS.windowCool = 0xa8d8ff`; `AccentColor` los incluye; `ACCENT_COLORS` termina en `"windowWarm", "windowCool"` (once).

- [ ] **Step 1: tests que fallan:** la lista exacta de `ACCENT_COLORS` suma `"windowWarm", "windowCool"` al final; "los once acentos no se oscurecen" con valores `[…nueve de hoy, 0xffd9a0, 0xa8d8ff]`.
- [ ] **Step 2:** `npx vitest run src/map/palette-iso.test.ts` → FAIL.
- [ ] **Step 3:** agregar en `ISO_COLORS` después de `magentaBleed`, con comentario `// Resume nivel 2: luces por ventana (cálida y fría)`, y en `ACCENT_COLORS`. Encabezado: "los acentos no se oscurecen" ya cubre; no tocar `sky`/`shadow`.
- [ ] **Step 4:** `npm test` (incluye `portfolio-accents.test.ts` y `palette-guard.test.ts` sin cambios) y `npm run typecheck` → verde.
- [ ] **Step 5:** commit `feat(#36): acentos windowWarm y windowCool`.

### Verificación final

- `npm test`, `npm run typecheck`.
- `npm run dev -- --host --port 5173`, abrir `http://localhost:5173/map/lab/resume.html` y capturar: igual que en la base salvo matices en pórticos y losas (offsets −1/−2 desde `shade`/`lit`).

## Assumptions

- Los cuatro materiales nuevos entran a `BASE_TONES` en Task 2 (junto con el pegado del atlas) y no en Task 1, para que cada commit deje la suite en verde. Alternativa rechazada: agregarlos en Task 1 y tolerar dos tests en rojo hasta Task 2.
- La decisión A se registra editando la fila `pale` de spec §4, como pidió el humano en #36; no se crea ADR (el repo no tiene `docs/adr/`). Alternativa rechazada: ADR nuevo.
- `darken-palette.ts` define su propia lista de nueve claves en vez de importar `TONE_LADDER`, para que el script dependa solo de `palette-base.ts` como hoy. Alternativa rechazada: importar `TONE_LADDER` de `palette-iso.ts`.

## Grilling

- Rondas: 1. Preguntas: 16 (griller: fable).
- Fuentes: ISSUE 8, CODE 7, DOC 0, NO SOURCE 1 (supuesto técnico: Q4, mover materiales a Task 2).
- Supuestos: ver `## Assumptions`.
- Issues abiertos: ninguno. Q1 (consumidores de los tonos y materiales nuevos) queda fuera por texto del issue: "Es independiente del resto: no toca `src/iso/` ni las escenas"; los usan los hermanos de #35.
