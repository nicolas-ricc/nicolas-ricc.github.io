# Paleta crepúsculo tardío (×0.7) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oscurecer el atlas isométrico a crepúsculo tardío (cinco tonos de cada material, `sky` y `shadow` × 0.7 por canal) con una tabla base y un script de regeneración, igualar el fondo de página al nuevo `sky`, fijar los acentos y los acentos de Portfolio con tests, y dejar la spec de la historia #11 con el baseline "antes".

**Architecture:** `src/map/palette-base.ts` guarda el atlas anterior y la función pura `darken`; `scripts/darken-palette.ts` imprime los literales oscurecidos; `src/map/palette-iso.ts` sigue siendo literales pegados (el runtime no calcula colores). Tests nuevos comparan el atlas con `darken(BASE, DARKEN)`, el fondo de CSS/HTML con `sky`, y los acentos de Portfolio con un conteo literal.

**Tech Stack:** TypeScript strict, Vitest, `tsx` para scripts, Vite 8 + pixi.js 8 (sin cambios), `agent-browser` para medidas y capturas.

**Spec:** issue #12 (cuerpo completo) dentro de la historia #11 (Agent Brief en el primer comentario de #11). La spec de diseño de la historia se crea en la Task 6.

## Global Constraints

- Rama base `feature/11-cyberpunk-neon`; PR contra esa rama, no contra `main`.
- **Orden:** la Task 1 (baseline y capturas "antes") corre antes de tocar `palette-iso.ts`, `style.css` o `lab/*.html`.
- `DARKEN = 0.7`; cada canal RGB × 0.7 redondeado con `Math.round`.
- Los nueve acentos no cambian: `cyan 0x7cf5ff`, `cyanMid 0x27b3c9`, `cyanBleed 0x134a52`, `amber 0xffc457`, `amberMid 0xd08a1e`, `amberBleed 0x5a3d14`, `magenta 0xff5ee0`, `magentaMid 0xc42a9d`, `magentaBleed 0x54173f`.
- Nuevo `sky` = `0x100e19` (`#100e19`); nuevo `shadow` = `0x1d1229`.
- Ningún literal `0x[0-9a-f]{6}` fuera de `map/palette-iso.ts`, `map/seed.ts` y (nuevo) `map/palette-base.ts` dentro de `src/` (guard `src/map/palette-guard.test.ts`). `scripts/` no está cubierto por el guard.
- `src/iso/` y `src/scenes/` no importan `pixi.js`.
- Texto, comentarios y nombres de test en español, como el resto del repo.
- `npm test` y `npm run typecheck` verdes al final de cada task. `npm run typecheck` necesita `content/blog.generated.json` (ya generado por `setup.sh`; si falta, `npm run feed`).
- Medición: Chrome headless vía `agent-browser`, sin GPU, viewport 1600×900, DPR 2; se toma la **segunda** carga. Logs DEV: `[lab] primer dibujo: N ms, P polígonos estáticos`, `[lab] peor redibujo en 5 s: N ms`, y `[mapa] …` en el sitio (`/`).
- Los umbrales absolutos del test de agua/glint (`+30`, `<30`, `+120`) **siguen pasando** con la paleta × 0.7 (verificado al planificar: 419/419 en verde con la paleta oscurecida). El issue solo pide escalarlos a `+21/<21/+84` si fallan, así que no se tocan.

## Review Focus

1. **Redondeo de `darken`:** canales que dan `.5` exacto (por ejemplo `0x05 × 0.7 = 3.5`) deben redondear igual en el script y en el test; el test usa tolerancia ±1 por canal, y `darken` usa `Math.round` sobre cada canal por separado sin desbordar a canales vecinos (`0xff × 0.7 = 178.5 → 179`). Test en Task 2 con `0xffffff`, `0x000000` y `0x010203`.
2. **Literales pegados que no coinciden con el script:** un material editado a mano (o uno olvidado, como `glint` o `abyss`) tiene que hacer fallar un test. Task 3 compara todos los materiales de `BASE_TONES` y además exige que `Object.keys(ISO_TONES)` sea igual a `Object.keys(BASE_TONES)`; Task 2 cubre que la salida del script contiene cada línea pegada.
3. **Fondo de página desincronizado:** un `lab/*.html` nuevo o un `background:` en mayúsculas (`#100E19`) no debe colarse ni hacer fallar en falso. Task 4 recorre todos los `lab/*.html` con `readdirSync` y compara en minúsculas.
4. **Guard de Portfolio frágil por orden:** contar por color, no por posición, para que reordenar acentos dentro de una escena no rompa el test y sí lo rompa agregar o cambiar un color. Task 5.
5. **El script no debe escribir archivos:** solo stdout. Task 2 verifica que la función de formato es pura y el bloque principal solo hace `console.log`.

## Assumptions

- **Fondos fuera de `style.css` y `lab/*.html`:** no hay otros. `index.html`, `public/`, `scripts/prerender.ts` y `src/world/stage.ts` no declaran `background` ni `theme-color` (grep al grillar); el canvas toma `ISO_COLORS.sky` por referencia (`src/main.ts:37`, `src/lab/page.ts:25`). Alternativa descartada: un test que recorra todo HTML/CSS del repo.
- **Baseline persistido en el commit de la Task 1** además de `.scratch/baseline-12.md`. Alternativa descartada: commitear `.scratch/`.
- **Rollback del pegado:** `git checkout -- src/map/palette-iso.ts` y repegar desde `npm run palette`. Alternativa descartada: verificación por conteo con `grep -c` (frágil: cuenta líneas, no patrones).
- **Tolerancia ±1 por canal** en el test contra `darken` la fija el issue; el test de formato de la Task 2 compara texto exacto y atrapa errores de tipeo que el ±1 dejaría pasar.

---

### Task 1: Baseline "antes" (medidas y capturas, sin cambios de código)

**Files:**
- Create: `docs/superpowers/specs/assets/2026-10-14-cyberpunk/antes-mundo.png`, `antes-portfolio.png`, `antes-resume.png`, `antes-blog.png`
- Create: `.scratch/baseline-12.md` (no se commitea; `.scratch/` está en `.git/info/exclude`) con números y líneas crudas, para la Task 6.

**Interfaces:**
- Produces: números de baseline (primer dibujo lab y sitio, segunda carga; 5 lecturas de peor redibujo; gzip JS) y las líneas de consola crudas en `.scratch/baseline-12.md`, que consume la Task 6.

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev -- --host --port 5173` (en segundo plano, o en otra terminal). Esperar a que responda `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/lab/world.html` → `200`.

- [ ] **Step 2: Primer dibujo del lab (segunda carga)**

```bash
agent-browser set viewport 1600 900 2
agent-browser open http://localhost:5173/lab/world.html
agent-browser wait 3000
agent-browser open http://localhost:5173/lab/world.html
agent-browser wait 3000
agent-browser console
```
Anotar la línea `[lab] primer dibujo: …` de la segunda carga. Mover el puntero (`agent-browser mouse move X Y` en varias posiciones) durante ~25 s y anotar 5 líneas `[lab] peor redibujo en 5 s: …`.

- [ ] **Step 3: Primer dibujo del sitio (segunda carga)**

Igual con `http://localhost:5173/` y las líneas `[mapa] …`.

- [ ] **Step 4: Capturas "antes"**

Recargar el lab antes de cada captura (el foco del velo es acumulativo). Teclas: `0` mundo; `1`/`2`/`3` encuadran Portfolio/Resume/Blog; `5` rota el foco en el orden apagado → Portfolio → Resume → Blog.
```bash
mkdir -p docs/superpowers/specs/assets/2026-10-14-cyberpunk
A=docs/superpowers/specs/assets/2026-10-14-cyberpunk
agent-browser open http://localhost:5173/lab/world.html; agent-browser wait 2000; agent-browser press 0; agent-browser wait 800; agent-browser screenshot $A/antes-mundo.png
agent-browser open http://localhost:5173/lab/world.html; agent-browser wait 2000; agent-browser press 1; agent-browser press 5; agent-browser wait 1200; agent-browser screenshot $A/antes-portfolio.png
agent-browser open http://localhost:5173/lab/world.html; agent-browser wait 2000; agent-browser press 2; agent-browser press 5; agent-browser press 5; agent-browser wait 1200; agent-browser screenshot $A/antes-resume.png
agent-browser open http://localhost:5173/lab/world.html; agent-browser wait 2000; agent-browser press 3; agent-browser press 5; agent-browser press 5; agent-browser press 5; agent-browser wait 1200; agent-browser screenshot $A/antes-blog.png
```
Abrir cada PNG y verificar que la zona pedida está encuadrada y que las otras aparecen veladas.

- [ ] **Step 5: Peso gzip del bundle**

```bash
npm run build
for f in dist/assets/*.js; do gzip -c "$f" | wc -c; done | paste -sd+ | bc
```
Anotar el total en bytes y la lista de archivos.

- [ ] **Step 6: Commit de las capturas**

`.scratch/` es local; para que el baseline sobreviva a un cambio de máquina, el cuerpo del commit lleva los números y las líneas de consola crudas (`git commit -F` con un archivo que tenga título y cuerpo).
```bash
git add docs/superpowers/specs/assets/2026-10-14-cyberpunk/
git commit -F .scratch/commit-baseline-12.txt   # título: docs(#12): capturas y baseline antes del crepúsculo tardío
```

---

### Task 2: Tabla base, `darken` y script de regeneración

**Files:**
- Create: `src/map/palette-base.ts`
- Create: `src/map/palette-base.test.ts`
- Create: `scripts/darken-palette.ts`
- Create: `scripts/darken-palette.test.ts`
- Modify: `src/map/palette-guard.test.ts` (set `EXEMPT`)
- Modify: `package.json` (`"palette": "tsx scripts/darken-palette.ts"`)

**Interfaces:**
- Produces: `DARKEN: 0.7`, `BASE_TONES` (mismas claves y tonos que el `ISO_TONES` actual, valores actuales), `BASE_SHADOW = 0x2a1a3a`, `BASE_SKY = 0x171423`, `darken(color: number, factor: number): number` en `src/map/palette-base.ts`. `paletteLiterals(): { tones: string[]; shadow: string; sky: string; css: string }` en `scripts/darken-palette.ts`.

- [ ] **Step 1: Tests que fallan**

`src/map/palette-base.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken } from "./palette-base";

describe("darken", () => {
  it("multiplica cada canal y redondea sin desbordar a los vecinos", () => {
    expect(darken(0xffffff, 0.7)).toBe(0xb3b3b3); // 255 × 0.7 = 178.5 → 179
    expect(darken(0x000000, 0.7)).toBe(0x000000);
    expect(darken(0x010203, 0.7)).toBe(0x010102); // 0.7 → 1, 1.4 → 1, 2.1 → 2
    expect(darken(0x171423, 1)).toBe(0x171423);
  });

  it("la base es el atlas atardecer bajo y el factor es 0.7", () => {
    expect(DARKEN).toBe(0.7);
    expect(BASE_SKY).toBe(0x171423);
    expect(BASE_SHADOW).toBe(0x2a1a3a);
    expect(BASE_TONES.slab).toEqual({ top: 0x9a7f62, lit: 0x81613e, shade: 0x3d3942, up: 0xb89268, down: 0x82705e });
    expect(BASE_TONES.glint.top).toBe(0xf58c5a);
  });
});
```

`scripts/darken-palette.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_TONES } from "../src/map/palette-base";
import { paletteLiterals } from "./darken-palette";

describe("darken-palette", () => {
  const out = paletteLiterals();

  it("una línea por material, con el formato del atlas", () => {
    expect(out.tones).toHaveLength(Object.keys(BASE_TONES).length);
    expect(out.tones[0]).toBe("  slab:      { top: 0x6c5945, lit: 0x5a442b, shade: 0x2b282e, up: 0x816649, down: 0x5b4e42 },");
    expect(out.tones.find((l) => l.includes("officeDark"))).toMatch(/^ {2}officeDark:\{ top: 0x/);
  });

  it("sky, shadow y el hex CSS del sky", () => {
    expect(out.sky).toBe("  sky: 0x100e19,");
    expect(out.shadow).toBe("  shadow: 0x1d1229,");
    expect(out.css).toBe("#100e19");
  });

  it("lo impreso es lo que está pegado en palette-iso.ts", () => {
    const src = readFileSync(new URL("../src/map/palette-iso.ts", import.meta.url), "utf8");
    for (const line of [...out.tones, out.shadow, out.sky]) expect(src).toContain(line.trim().replace(/,$/, ""));
  });
});
```
El tercer test sigue en rojo hasta la Task 3 (los literales todavía no están pegados): es esperado.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run src/map/palette-base.test.ts scripts/darken-palette.test.ts`
Expected: FAIL, `Cannot find module './palette-base'` / `'./darken-palette'`.

- [ ] **Step 3: `src/map/palette-base.ts`**

```ts
/** Atlas antes del oscurecimiento a crepúsculo tardío. Solo lo leen scripts/darken-palette.ts y el test: el runtime usa los literales de palette-iso.ts. */
export const DARKEN = 0.7;

export const BASE_TONES = {
  // copia literal, línea por línea, del ISO_TONES de palette-iso.ts antes de la Task 3
  // (mismas claves, mismo orden, sin los comentarios por material)
} as const;

export const BASE_SHADOW = 0x2a1a3a;
export const BASE_SKY = 0x171423;

/** Cada canal RGB × factor, redondeado. */
export function darken(color: number, factor: number): number {
  const ch = (shift: number) => Math.round(((color >> shift) & 255) * factor);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
```
El cuerpo de `BASE_TONES` es la copia exacta de las 30 líneas de materiales de `ISO_TONES` en `src/map/palette-iso.ts` (`slab` … `glint`). Copiar con `sed -n '/^export const ISO_TONES/,/^} as const;/p' src/map/palette-iso.ts`, quitar los comentarios `// …` del final de línea y de las líneas sueltas.

Agregar `"map/palette-base.ts"` a `EXEMPT` en `src/map/palette-guard.test.ts` y extender el comentario:
```ts
/** palette-iso.ts define los colores; palette-base.ts guarda el atlas previo al oscurecimiento; seed.ts usa 0x6d2b79f5, la constante de mulberry32. */
const EXEMPT = new Set(["map/palette-iso.ts", "map/palette-base.ts", "map/seed.ts"]);
```

- [ ] **Step 4: `scripts/darken-palette.ts`**

```ts
import { pathToFileURL } from "node:url";
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken } from "../src/map/palette-base";

const hex = (c: number) => `0x${darken(c, DARKEN).toString(16).padStart(6, "0")}`;

/** Literales del atlas oscurecido, listos para pegar en src/map/palette-iso.ts. */
export function paletteLiterals(): { tones: string[]; shadow: string; sky: string; css: string } {
  const tones = Object.entries(BASE_TONES).map(([mat, t]) =>
    `  ${`${mat}:`.padEnd(11)}{ top: ${hex(t.top)}, lit: ${hex(t.lit)}, shade: ${hex(t.shade)}, up: ${hex(t.up)}, down: ${hex(t.down)} },`);
  return {
    tones,
    shadow: `  shadow: ${hex(BASE_SHADOW)},`,
    sky: `  sky: ${hex(BASE_SKY)},`,
    css: `#${darken(BASE_SKY, DARKEN).toString(16).padStart(6, "0")}`,
  };
}

// npm run palette: imprime, no escribe archivos.
if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const out = paletteLiterals();
  console.log(["// ISO_TONES", ...out.tones, "", "// ISO_COLORS", out.shadow, out.sky, "", `// CSS: ${out.css}`].join("\n"));
}
```
`package.json` → `"palette": "tsx scripts/darken-palette.ts"` en `scripts`, después de `"prerender"`.

- [ ] **Step 5: Verificar**

Run: `npx vitest run src/map/palette-base.test.ts scripts/darken-palette.test.ts src/map/palette-guard.test.ts`
Expected: PASS salvo `lo impreso es lo que está pegado en palette-iso.ts` (rojo hasta la Task 3).
Run: `npm run palette | head -3` → `// ISO_TONES` y la línea de `slab` oscurecida.
Run: `npm run typecheck` → limpio.

- [ ] **Step 6: Commit**

```bash
git add src/map/palette-base.ts src/map/palette-base.test.ts src/map/palette-guard.test.ts scripts/darken-palette.ts scripts/darken-palette.test.ts package.json
git commit -m "feat(#12): tabla base del atlas, darken y npm run palette"
```

---

### Task 3: Pegar los literales oscurecidos en el atlas

**Files:**
- Modify: `src/map/palette-iso.ts` (valores de `ISO_TONES`, `ISO_COLORS.shadow`, `ISO_COLORS.sky`, encabezado)
- Modify: `src/map/palette-iso.test.ts` (dos tests nuevos)

**Interfaces:**
- Consumes: `BASE_TONES`, `BASE_SHADOW`, `BASE_SKY`, `DARKEN`, `darken` (Task 2); salida de `npm run palette`.
- Produces: `ISO_COLORS.sky === 0x100e19`, que consume la Task 4.

- [ ] **Step 1: Tests que fallan** — agregar a `src/map/palette-iso.test.ts`:

```ts
import { BASE_SHADOW, BASE_SKY, BASE_TONES, DARKEN, darken } from "./palette-base";

const channelsClose = (a: number, b: number) => {
  for (const s of [16, 8, 0]) expect(Math.abs(((a >> s) & 255) - ((b >> s) & 255))).toBeLessThanOrEqual(1);
};

describe("crepúsculo tardío", () => {
  it("cada tono, sky y shadow valen la base × DARKEN por canal (±1)", () => {
    expect(Object.keys(ISO_TONES)).toEqual(Object.keys(BASE_TONES));
    for (const mat of Object.keys(BASE_TONES) as Material[]) {
      for (const tone of TONE_LADDER) channelsClose(ISO_TONES[mat][tone], darken(BASE_TONES[mat][tone], DARKEN));
    }
    channelsClose(ISO_COLORS.shadow, darken(BASE_SHADOW, DARKEN));
    channelsClose(ISO_COLORS.sky, darken(BASE_SKY, DARKEN));
  });

  it("los nueve acentos no se oscurecen", () => {
    expect(ACCENT_COLORS.map((c) => ISO_COLORS[c])).toEqual([0x7cf5ff, 0x27b3c9, 0x134a52, 0xffc457, 0xd08a1e, 0x5a3d14, 0xff5ee0, 0xc42a9d, 0x54173f]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/map/palette-iso.test.ts`
Expected: FAIL en `cada tono, sky y shadow…` (los valores todavía son la base); el de acentos PASA ya (es un guard).

- [ ] **Step 3: Pegar**

Correr `npm run palette`. En `src/map/palette-iso.ts` reemplazar, material por material, los cinco valores de cada línea de `ISO_TONES` por los de la salida, **conservando** los comentarios de final de línea y las líneas de comentario sueltas (`// Resume: …`, `// Blog: …`). Reemplazar `shadow: 0x2a1a3a` → `shadow: 0x1d1229` y `sky: 0x171423` → `sky: 0x100e19`. Los nueve acentos no se tocan.

Agregar al final del comentario de encabezado (antes de `*/`):
```
 * Crepúsculo tardío: los tonos de arriba, `sky` y `shadow` son los de `palette-base.ts` × 0.7
 * por canal (`DARKEN`); los acentos no se oscurecen, así los neones destacan sobre la escena.
 * Para ajustar, editar la base y correr `npm run palette`, que imprime los literales a pegar acá.
```

- [ ] **Step 4: Verificar**

Run: `npx vitest run src/map/ scripts/darken-palette.test.ts`
Expected: PASS todo, incluido `lo impreso es lo que está pegado en palette-iso.ts` de la Task 2.
Si el pegado queda a medias (sesión cortada, test rojo sin causa clara), no reconciliar a ojo: `git checkout -- src/map/palette-iso.ts`, volver a correr `npm run palette` y pegar de nuevo. El test `lo impreso es lo que está pegado` es el diff autoritativo.
Run: `npm test && npm run typecheck` → verde (los umbrales de agua/glint siguen pasando; no se tocan).

- [ ] **Step 5: Commit**

```bash
git add src/map/palette-iso.ts src/map/palette-iso.test.ts
git commit -m "feat(#12): atlas crepúsculo tardío, tonos, sky y shadow × 0.7"
```

---

### Task 4: Fondo de página igual al nuevo `sky`

**Files:**
- Create: `src/map/background.test.ts`
- Modify: `src/style.css:3`
- Modify: `lab/world.html:9`, `lab/portfolio.html:9`, `lab/resume.html:9`, `lab/blog.html:9`

**Interfaces:**
- Consumes: `ISO_COLORS.sky` (`0x100e19` tras la Task 3).

- [ ] **Step 1: Test que falla** — `src/map/background.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ISO_COLORS } from "./palette-iso";

const ROOT = new URL("../../", import.meta.url);
const sky = `#${ISO_COLORS.sky.toString(16).padStart(6, "0")}`;
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

describe("fondo de página = cielo del canvas", () => {
  it("--bg de style.css", () => {
    expect(read("src/style.css").match(/--bg:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase()).toBe(sky);
  });

  const labs = readdirSync(new URL("lab/", ROOT)).filter((f) => f.endsWith(".html"));
  it("encuentra las páginas del lab", () => expect(labs.length).toBeGreaterThanOrEqual(4));
  for (const page of labs) {
    it(`background de lab/${page}`, () => {
      expect(read(`lab/${page}`).match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase()).toBe(sky);
    });
  }
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/map/background.test.ts`
Expected: FAIL: `--bg` es `#0b1620` y los labs `#171423`; el esperado es `#100e19`.

- [ ] **Step 3: Cambiar los fondos**

`src/style.css`: `--bg: #0b1620;` → `--bg: #100e19;`.
Cada `lab/*.html`: `background: #171423; /* = ISO_COLORS.sky en src/map/palette-iso.ts */` → `background: #100e19; /* = ISO_COLORS.sky en src/map/palette-iso.ts */` (comentario intacto).
Buscar restos: `grep -rn "171423\|0b1620" index.html public scripts src lab` → solo debe quedar `src/map/palette-base.ts` (`BASE_SKY`) y el test de la Task 2. Si aparece otro fondo, actualizarlo.

- [ ] **Step 4: Verificar**

Run: `npx vitest run src/map/background.test.ts` → PASS. `npm test && npm run typecheck` → verde.

- [ ] **Step 5: Commit**

```bash
git add src/map/background.test.ts src/style.css lab/*.html
git commit -m "feat(#12): fondo de página igual al nuevo cielo"
```

---

### Task 5: Guard de acentos de Portfolio

**Files:**
- Create: `src/scenes/portfolio-accents.test.ts`

**Interfaces:**
- Consumes: `world(seed)` de `src/scenes/world.ts` (el seed del sitio es `SEED = 7`, `src/world/assemble.ts:13`; `world` reparte `zoneRng(seed, zone, part)` a cada escena).

- [ ] **Step 1: El test** (literales tomados sobre `feature/11-cyberpunk-neon` antes de cualquier cambio en escenas):

```ts
import { describe, expect, it } from "vitest";
import type { Accent } from "../iso/accent";
import { world } from "./world";

const byColor = (accents: Accent[]) => {
  const out: Record<string, number> = {};
  for (const a of accents) out[a.color] = (out[a.color] ?? 0) + 1;
  return out;
};

/** Portfolio no se toca en la historia #11: mismos colores, misma cantidad. La feria queda afuera a propósito (es la excepción con neones). */
describe("acentos de Portfolio", () => {
  const w = world(7);
  it("astillero", () => expect(byColor(w.shipyard!.accents)).toEqual({ cyan: 10 }));
  it("fábrica", () => expect(byColor(w.factory!.accents)).toEqual({ cyan: 8 }));
  it("hinterland", () => expect(byColor(w.hinterland!.accents)).toEqual({ cyan: 21, cyanMid: 1 }));
});
```

- [ ] **Step 2: Correr**

Run: `npx vitest run src/scenes/portfolio-accents.test.ts`
Expected: PASS (es un guard sobre el estado actual). Para comprobar que muerde: cambiar temporalmente `color: "cyan"` por `"magenta"` en `lamp()` de `src/scenes/factory.ts`, ver FAIL, y revertir.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/portfolio-accents.test.ts
git commit -m "test(#12): guard de acentos de Portfolio"
```

---

### Task 6: Spec de diseño de la historia con el baseline

**Files:**
- Create: `docs/superpowers/specs/2026-10-14-cyberpunk-crepusculo-neones-bloom-design.md`

**Interfaces:**
- Consumes: `.scratch/baseline-12.md` y las capturas de la Task 1; decisiones del Agent Brief de #11 y del plan del planner (comentario de #11 del 2026-10-14).

- [ ] **Step 1: Escribir la spec**

Encabezado como las vecinas:
```markdown
# Estética cyberpunk: crepúsculo tardío, neones y bloom diferido — diseño

**Fecha:** 2026-10-14
**Estado:** en curso
**Antecede:** `2026-09-15-reintegracion-mundo-iso-design.md`
**Alcance:** `src/map/palette-iso.ts` y `palette-base.ts`, `scripts/darken-palette.ts`, fondo de página (`src/style.css`, `lab/*.html`), escenas y animadores de ciudad, distrito tecnológico, mar y feria, `src/world/stage.ts` (bloom) y el arranque del sitio y del lab. Historia #11, hijos #12–#18.
```
Secciones:
1. `## 1. Problema` — un párrafo: crepúsculo más oscuro, neones celestes y rosas animados en Resume, Blog y la feria, bloom diferido con fallback por presupuesto.
2. `## 2. Decisiones` — tabla `| Tema | Decisión |` con: oscurecimiento × 0.7 sobre tonos + `sky` + `shadow`, acentos intactos (`npm run palette`, `palette-base.ts`); neones solo en ciudad, distrito tecnológico, punta/faro/costa y feria (la feria es Portfolio por geografía y es la excepción; astillero, fábrica e hinterland no se tocan, guard `portfolio-accents.test.ts`); animación con pulsos y letreros que cambian de color/estado, estáticos y encendidos con `prefers-reduced-motion`; bloom como composición propia con el `BlurFilter` de Pixi sobre una copia aditiva de la capa de acentos (`Graphics` que comparten `GraphicsContext`), activado tras el primer dibujo en una tarea diferida; fallback si el promedio de `stage.tick` + render en 60 frames supera 15 ms: se quita el filtro y los `dot` reciben un segundo halo translúcido más grande; el lab fuerza el estado con `?bloom=on|off|fallback`. Fila extra: fondo de página `#100e19` = `sky`.
3. `## 3. Medidas` con `### Antes (baseline, 2026-10-14)`: primer dibujo lab y sitio (segunda carga), las 5 lecturas de peor redibujo, gzip total del JS; máquina y método (Chrome headless vía `agent-browser`, sin GPU, DPR 2, 1600×900); las líneas de consola crudas en un bloque de código; las cuatro capturas enlazadas con `![mundo](assets/2026-10-14-cyberpunk/antes-mundo.png)` etc.
4. `## 4. Criterios de aceptación` — copiar los doce criterios del Agent Brief de #11 como checklist `- [ ]`, sin marcar.

- [ ] **Step 2: Verificar enlaces**

Run: `for f in mundo portfolio resume blog; do test -f docs/superpowers/specs/assets/2026-10-14-cyberpunk/antes-$f.png && echo ok $f; done` → cuatro `ok`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-14-cyberpunk-crepusculo-neones-bloom-design.md
git commit -m "docs(#12): spec cyberpunk con decisiones y baseline"
```

---

### Verificación final (después de la Task 6)

- `npm test` y `npm run typecheck` verdes.
- Abrir `/lab/world.html` (mismo viewport): el mundo se ve más oscuro, los acentos igual de vivos, y el fondo de la página tiene el mismo color que el cielo del canvas (el borde del canvas no se nota).
- `npm run palette` y comparar con lo pegado (lo cubre el test de la Task 2).

## Grilling

Una ronda (los cambios al plan fueron menores: un paso de verificación reemplazado, una nota de rollback, el baseline en el cuerpo del commit). 18 preguntas: ISSUE 8, CODE 10, DOC 0, NO SOURCE 0 (resueltas como supuestos técnicos arriba, sin ambigüedad de spec ni fuera de alcance). Ningún issue abierto.

| # | Respuesta |
| --- | --- |
| 1 | CODE: `src/map/palette-iso.ts:21-50`. Las 30 líneas usan `padEnd(11)` y el orden `top, lit, shade, up, down`; la línea 39 es `officeDark:{ top: 0x5e586c, …` sin espacio. Los comentarios van después de `},`, así que la línea generada sin `,` final es una subcadena. |
| 2 | ISSUE §6: "`src/style.css`: `--bg` pasa al nuevo `sky`. Los cuatro `lab/*.html` … Buscar con grep otros `#171423`/`171423` en `index.html`, `public/` y `scripts/`". CODE: no hay `background`/`theme-color` en `index.html`, `public/`, `scripts/prerender.ts` ni `src/world/stage.ts`. El canvas toma `ISO_COLORS.sky` (`src/main.ts:37`, `src/lab/page.ts:25`). |
| 3 | ISSUE §5: "si fallan por el reescalado, multiplicar esos umbrales por 0.7". La corrida fue un pegado temporal con `Math.round` por canal, revertido: 419/419. Si fallan en la Task 3, la instrucción del issue manda escalarlos. |
| 4 | CODE: `palette-iso.ts` tiene 30 líneas `mat: {`. El paso `grep -c` se eliminó; manda el test de la Task 2. |
| 5 | CODE: `palette-iso.ts:73-80` exporta `Material`, `ACCENT_COLORS` (en ese orden, fijado por `palette-iso.test.ts`) y `TONE_LADDER = ["shade","lit","down","top","up"]`. Son los cinco tonos y el orden no importa para el bucle. |
| 6 | CODE: `src/iso/accent.ts:7-8`. `color: AccentColor` es una clave string. `src/scenes/world.ts:19-33` declara `shipyard`/`factory`/`hinterland` como `… | null` con `accents: Accent[]`. Los conteos salen de `world(7)` medido al planificar. |
| 7 | ISSUE criterio: "Spec creada con decisiones, baseline (números y líneas crudas) y las cuatro capturas 'antes'"; §1: "El headless de siempre es Chrome vía CDP con `agent-browser`, sin GPU". El log sale de `src/lab/page.ts:32` sin importar el backend. |
| 8 | CODE: `vitest.config.ts` incluye `scripts/**/*.test.ts`; `tsconfig.json` incluye `scripts` y `types: ["node"]`. Hay precedente: `scripts/inject.test.ts`. |
| 9 | CODE: probado con `npx tsx`. `process.argv[1]` es la ruta del script y la guarda da `true`; bajo Vitest `argv[1]` es el binario de vitest, así que no imprime. |
| 10 | CODE: `src/map/palette-guard.test.ts:14` excluye `*.test.ts`. |
| 11 | CODE: cada `lab/*.html` tiene un solo `background:` (línea 9). |
| 12 | ISSUE §6 y criterio: "`--bg` de `style.css` y el `background` inline de `lab/*.html` igualan el nuevo `sky`". |
| 13 | ISSUE §7: "Crear `docs/superpowers/specs/2026-10-14-cyberpunk-…-design.md`". Comentario de nicolas-ricc en #11: "spec … creada por el primer hijo … y cerrada por el último". Los hijos se integran en serie sobre `feature/11-cyberpunk-neon`. |
| 14 | Supuesto técnico (Assumptions): `git checkout -- src/map/palette-iso.ts` y repegar. |
| 15 | ISSUE criterio: "vale `BASE × 0.7` por canal (±1)". El test exacto de la Task 2 atrapa los typos. Los dos tests miden cosas distintas: fidelidad al factor y fidelidad a la salida del script. |
| 16 | Supuesto técnico (Assumptions): el baseline va en el cuerpo del commit de la Task 1. |
| 17 | CODE: `git branch -r` lista `origin/feature/11-cyberpunk-neon`, y la rama `agent/12-paleta-crepusculo` salió de ahí (comentario Stage 0 en #12). |
| 18 | ISSUE §7: pide la spec en `docs/superpowers/specs/`. El repo no tiene `CONTEXT.md` ni `docs/adr/`; README.md: "Diseño en `docs/superpowers/specs/`". |
