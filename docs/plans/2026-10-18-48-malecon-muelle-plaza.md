# Piezas fijas II: malecón, muelle oeste y plaza (#48) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `malecon`, `westQuay` y `plazaAndTower` de `src/city/fixed.ts` sobre el kit: galería de arcos, pérgola con guirnalda y kiosco en el malecón; galpones abovedados, grúa, bolardos y terrazas de bares en el muelle oeste; fuente y dos kioscos en la plaza. Mismas huellas que hoy; la torre y `neon.malecon` no cambian.

**Architecture:** Todo vive en `src/city/fixed.ts`, armado con props de `src/kit/props.ts` (`kiosk`, `fountain`, `dockCrane`, `bollard`, `table`, `chair`, `awning`, `garland`) y sólidos del motor (`vault`, `facade` con `base: "arcade"`). `westQuay` pasa a recibir `accents` (las guirnaldas de las terrazas) y `src/scenes/city.ts` le pasa la lista. La única pieza del kit que cambia es `fountain`: su charco pasa a alpha 0.35, para lo cual `puddle` recibe un alpha opcional.

**Tech Stack:** TypeScript estricto, Vitest, sin Pixi en tests.

**Spec:** issue #48 (manda) y `docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md` §8.

## Global Constraints

- `src/iso/` no importa Pixi; todo color sale de `src/map/palette-iso.ts` (sin literales hex fuera de `palette-iso.ts`, `palette-base.ts`, `seed.ts`).
- `Math.random` prohibido. Nada de lo nuevo consume rng: `plazaAndTower` consume el `rng` igual que hoy (solo `tiles`), así el resto de la ciudad no se desalinea.
- Comentarios y nombres de tests en castellano; tests Vitest al lado del módulo; sin dependencias nuevas.
- `src/scenes/city-grid.ts` no cambia (`WEST_QUAY` 192..198, `MALECON` 334..344 × 158..326 z 0.6, `PLAZA` 102..156 × 218..236, `TOWER`, `AVENUE.y0` 206, `CITY_EDGE`).
- `src/city/lights.ts` no se toca (neones de calle del barrio de bares).
- `fixed.ts` no arma props a mano (test "las props salen del kit": nada de `r: 0.4, h: 0.8`, `3, 1.5, 1.2`, `0.3, 0.3, 4, "steel"`, `PUDDLE_RADII`).
- Regla de profundidad (`sortByDepth` por AABB): ningún sólido nuevo se solapa en caja con otro sólido de la misma pieza fija (un sólido apoyado encima, que toca en z, no cuenta).
- `npm test` y `npm run typecheck` en verde al final de cada tarea.

## Decisiones técnicas (supuestos declarados)

1. **Galpones y bolardos.** El issue pone los galpones en `x 192.5..197.5` y los bolardos en `x = 193` de `y 160` a `y 204`: cinco de esos ocho bolardos (166, 172, 178, 184, 190) quedarían dentro de un galpón. Se corren 0.5 los dos: galpones en `x 193..198` (pegados al borde del agua, `vault` `at.x = 193`, `w 5`) y bolardos en `x = 192.5` (`192.1..192.9`, en la franja libre de 1 entre la calle y los galpones). Bolardos en `y 160, 166, …, 202` saltando el `196` (escalera `194..200`): siete. Los dos bolardos sueltos de hoy (`x0 + 3`, `y 192` y `201`) se reemplazan por esta fila.
2. **Pérgola.** En `x MALECON.x0 + 2 .. x0 + 6` (336..340) el poste sudeste quedaría flotando sobre la escalera (`ramp` en `x 338..344`, `y 227..233`, que baja hacia el este). Se corre la pérgola 2 al oeste: `x x0 .. x0 + 4` (334..338), siempre sobre el paseo; `y 221..233`, 12 de largo, como pide el issue. Postes `deck` 0.4×0.4×3 en las cuatro esquinas a `z = MALECON.z`; vigas `deck` 0.3×12×0.3 a `z = MALECON.z + 3` (3.6) sobre los postes oeste y este; guirnalda a lo largo de la viga este a `z = 3.6`.
3. **Kioscos de la plaza.** En `(PLAZA.x + 3, PLAZA.y + 2.5)` y `(PLAZA.x + PLAZA.w − 5, PLAZA.y + 2.5)` los kioscos (2×2) se solapan con los bancos norte (`(PLAZA.x + 4, PLAZA.y + 3)` 2×0.6 y `(PLAZA.x + PLAZA.w − 6, PLAZA.y + 3)`), que el issue deja en su lugar. Los kioscos van a las esquinas norte justo por dentro del cordón (1.2): `(PLAZA.x + 1.4, PLAZA.y + 1.4)` y `(PLAZA.x + PLAZA.w − 3.4, PLAZA.y + 1.4)`, a `z 0.05`.
4. **Charco de la fuente.** `puddle(x, y, bleed, z = 0.12, alpha = PUDDLE_ALPHA)`; `fountain` pasa `FOUNTAIN_ALPHA = 0.35`. `fountain` no tiene otros usos (la torre usa `puddle` directo).
5. **Terrazas.** Por cada manzana de bares de la columna 162 (`y0 ∈ {164, 188}`), tres mesas en `y = y0 + 3, y0 + 9, y0 + 15` (`x 188.5..189.5`), dos sillas por mesa (`x 187.5` y `x 190`, `y = mesa + 0.25`), un toldo por mesa `awning(v3(186, y − 1, 2.2), 3, "e")` (`x 186..186.8`, `y − 1 .. y + 2`). Postes `steel` 0.3×0.3×3 en `x = 191` cada 6 de `y 164` a `y 200` (siete; los de 182 y 188 en las esquinas de las manzanas, así la guirnalda cruza la calle entre ellas) y una guirnalda de `(191.15, 164.15, 3)` a `(191.15, 200.15, 3)`. Todo queda en `x 186..191.3` e `y < 206`.
6. **Grúa.** `dockCrane(v3(195, 202, 0.6), "e")`: mástil sobre el muelle (tope del muro, 0.6), pluma hacia el agua (al este).
7. **Galería de arcos.** `facade: { floors: 1, cols: Math.round(d / 6), base: "arcade", bands: false }` en los dos tramos largos del muro (norte `d 69` → 12 arcos; sur `d 93` → 16). El tramo de 6 junto a la escalera queda sin fachada.
8. **Tests existentes de `city.test.ts` que hay que precisar** (sin cambiar su intención):
   - "hay un zócalo por manzana… los edificios con fachada caen en su manzana": los muros del malecón (`prism` `paving` con `at.z === −1`) ahora tienen fachada y no son edificios → se excluyen del recorrido.
   - "todo cae en la zona Resume… `steel`/`rust` solo mobiliario y autos": los galpones son `vault` `rust` → se agrega `vault` a los tipos permitidos.
   - "faroles solo en avenida, puente, plaza y malecón": las guirnaldas de las terrazas son `dot` ámbar r 0.25 fuera de esas zonas → el filtro de faroles pasa a `r === 0.6` (la medida de `props.lamp`).

## Review Focus

- Solapes de caja con lo que ya existe (bancos, faroles, escalera, estribo, grúa vs. bolardos): cada tarea suma un test de "ningún sólido nuevo se solapa con otro" sobre la pieza armada.
- Los neones de calle del barrio de bares (`lights.ts`) y las ventanas encendidas se ocluyen contra todos los sólidos: toldos y postes en la calle del muelle pueden esconder alguno. Task 3 corre `src/city/lights.test.ts` y `src/scenes/city.test.ts` completos.
- La plaza: nada nuevo pasa de 5 de alto (test "la torre mide 30… nada más supera 21" sigue, y Task 4 fija el máximo de lo nuevo).
- `neon.malecon` (8 bombillos en las posiciones de hoy) no cambia: Task 2 lo fija en `fixed.test.ts`.
- El orden de pintado real (galpón vs. muro, pérgola vs. paseo, toldo vs. pared) solo se ve en la captura de `lab/resume.html` (guion de la etapa 3).

---

### Task 1: charco de la fuente con alpha 0.35

**Files:**
- Modify: `src/kit/props.ts` (`puddle`, `fountain`)
- Test: `src/kit/props.test.ts`

**Interfaces:**
- Produces: `puddle(x: number, y: number, bleed: AccentColor, z = 0.12, alpha = PUDDLE_ALPHA): Accent[]`; `fountain(at)` devuelve charco con `alpha 0.35`.

- [ ] **Step 1: test que falla** — en el test "fuente: …" de `props.test.ts` agregar `expect(f.accents.every((a) => a.kind === "poly" && a.alpha === 0.35)).toBe(true);` y un test `puddle(0, 0, "amberBleed", 0.12, 0.5)` → todos con `alpha 0.5`.
- [ ] **Step 2:** `npx vitest run src/kit/props.test.ts` → FAIL.
- [ ] **Step 3:** implementar:

```ts
const PUDDLE_ALPHA = 0.25, FOUNTAIN_ALPHA = 0.35; // la fuente no se confunde con los dos charcos de la torre
export function puddle(x: number, y: number, bleed: AccentColor, z = 0.12, alpha = PUDDLE_ALPHA): Accent[] { /* … alpha */ }
// fountain: accents: puddle(at.x, at.y, "amberBleed", water, FOUNTAIN_ALPHA)
```

- [ ] **Step 4:** `npx vitest run src/kit/props.test.ts` → PASS; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#48): charco de la fuente con alpha 0.35`.

### Task 2: malecón con galería de arcos, pérgola y kiosco

**Files:**
- Modify: `src/city/fixed.ts` (`malecon`)
- Test: `src/city/fixed.test.ts` (nuevo `describe("malecon")`), `src/scenes/city.test.ts` (decisión 8, primer punto)

**Interfaces:**
- Consumes: `kiosk(at: Vec3): Solid[]`, `garland(path: Vec3[], step?): Accent[]` de `src/kit/props.ts`.
- Produces: `malecon(solids, accents): Vec3[]` con la misma firma y los mismos 8 puntos.

- [ ] **Step 1: tests que fallan** en `fixed.test.ts`:

```ts
describe("malecon", () => {
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; const bulbs = malecon(solids, accents); return { solids, accents, bulbs }; };
  const { x0, x1, y0, y1, z } = MALECON;
  it("los dos muros largos llevan galería de arcos", () => {
    const walls = built().solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.at.z === -1 && s.d > 30);
    expect(walls).toHaveLength(2);
    for (const w of walls) expect(w.facade).toMatchObject({ floors: 1, cols: Math.round(w.d / 6), base: "arcade", bands: false });
  });
  it("pérgola: cuatro postes deck sobre el paseo, dos vigas y una guirnalda a z ≈ 3.6", () => { /* 4 prism deck 0.4×0.4×3 at.z === z, fuera de la escalera (max.x ≤ x1 − 6); 2 prism deck d 12 at.z === z + 3; ≥ 6 dot amber r 0.25 con |z − 3.6| < 1e-6 dentro de x0..x1 × y0..y1 */ });
  it("un kiosco en (x0 + 2, 240)", () => { /* prism officeDark 2×2×2.4 en at (x0+2, 240, z) */ });
  it("devuelve los 8 bombillos de hoy", () => {
    expect(built().bulbs).toEqual([180, 210, 250, 272, 284, 296, 308, 320].map((y) => v3(x1 - 3 + 0.3, y + 0.3, z + 5.4)));
  });
  it("ningún sólido del malecón se solapa en caja con otro", () => { /* pares con solape estricto en x, y y z: ninguno */ });
});
```

  y en `city.test.ts`, en "hay un zócalo por manzana…", `if (b.kind === "prism" && b.mat === "paving" && b.at.z === -1) continue; // los muros del malecón llevan galería de arcos, no son edificios`.
- [ ] **Step 2:** `npx vitest run src/city/fixed.test.ts` → FAIL.
- [ ] **Step 3:** en `malecon`: `facade` en los dos `prism` largos; pérgola (decisión 2) con `garland([v3(x0 + 3.8, 221, z + 3), v3(x0 + 3.8, 233, z + 3)])`; `solids.push(...kiosk(v3(x0 + 2, 240, z)))`. Bancos y faroles ya salen de `props`: quedan.
- [ ] **Step 4:** `npx vitest run src/city src/scenes` → PASS; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#48): malecón con galería de arcos, pérgola y kiosco`.

### Task 3: muelle oeste con galpones, grúa, bolardos y terrazas de bares

**Files:**
- Modify: `src/city/fixed.ts` (`westQuay`), `src/scenes/city.ts` (`westQuay(solids, accents)`)
- Test: `src/city/fixed.test.ts` (nuevo `describe("westQuay")`), `src/scenes/city.test.ts` (decisión 8, puntos 2 y 3)

**Interfaces:**
- Consumes: `dockCrane`, `bollard`, `table`, `chair`, `awning`, `garland`, `prism`.
- Produces: `westQuay(solids: Solid[], accents: Accent[]): void`.

- [ ] **Step 1: tests que fallan** en `fixed.test.ts`:

```ts
describe("westQuay", () => {
  const built = () => { const solids: Solid[] = [], accents: Accent[] = []; westQuay(solids, accents); return { solids, accents }; };
  it("muro y escalera como hoy", () => { /* 2 prism plaza at.z −1 en x0; ramp plaza en y 194 */ });
  it("dos galpones vault rust sobre el muelle, dentro de 192..198, que no se solapan", () => { /* 2 vault rust, axis y, len 12, w 5, h 2.5, segments 6, at.z 0.6, at = (193, 164) y (193, 178): y 164..176 y 178..190; bounds x ⊂ [192,198], cajas disjuntas */ });
  it("una grúa de muelle y al menos seis bolardos, ninguno dentro de un galpón ni en la escalera", () => { /* 2 prism steel de dockCrane (h 6 mástil); cylinder rust r 0.4 ≥ 6, sin solape con vaults ni con y 194..200 */ });
  it("terrazas: ≥ 6 mesas y ≥ 12 sillas en la calle del muelle, antes de la avenida y sin entrar al muro", () => { /* table: prism paving 1×1×0.7; chair: 0.5×0.5×0.5; bounds x ⊂ [186,192], max.y < AVENUE.y0; ningún sólido de las terrazas se solapa con una manzana de blocks() (la manzana 162 termina en x 186) */ });
  it("toldos pegados a la pared del lote y al menos una guirnalda", () => { /* ramp awning dir e at.x 186, ≥ 6; ≥ 6 dot amber r 0.25 en x 186..192 */ });
  it("ningún sólido del muelle se solapa en caja con otro", () => { /* como en malecon */ });
});
```

  En `city.test.ts`: `expect(["prism", "cylinder", "vault"]).toContain(s.kind); // mobiliario, autos y los galpones del muelle` y `const lamps = s.accents.filter((a) => a.kind === "dot" && a.color === "amber" && a.r === 0.6); // faroles (props.lamp), no las guirnaldas`.
- [ ] **Step 2:** `npx vitest run src/city/fixed.test.ts` → FAIL.
- [ ] **Step 3:** implementar `westQuay` según decisiones 1, 5 y 6; actualizar la llamada en `city.ts`.
- [ ] **Step 4:** `npm test` completo (oclusión de neones y ventanas en `lights.test.ts` y `city.test.ts`) → PASS; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#48): muelle oeste con galpones, grúa, bolardos y terrazas de bares`.

### Task 4: plaza con fuente y dos kioscos

**Files:**
- Modify: `src/city/fixed.ts` (`plazaAndTower`)
- Test: `src/city/fixed.test.ts` (nuevo `describe("plazaAndTower")`)

**Interfaces:**
- Consumes: `fountain(at): Lit`, `kiosk(at): Solid[]`, `place`.
- Produces: `plazaAndTower(...)` con la misma firma y el mismo `TowerLights`.

- [ ] **Step 1: tests que fallan**:

```ts
describe("plazaAndTower", () => {
  const built = () => { const solids: Solid[] = [], ground: Solid[] = [], accents: Accent[] = []; const tower = plazaAndTower(solids, ground, accents, createRng(7)); return { solids, ground, accents, tower }; };
  it("una fuente marble r 3 centrada en (150, 227) con charco alpha 0.35", () => { /* cylinder marble r 3 at (150, 227); 3 poly amberBleed alpha 0.35 */ });
  it("dos kioscos dentro de la plaza, en las esquinas norte", () => { /* 2 prism officeDark 2×2×2.4 con bounds ⊂ PLAZA y min.y < PLAZA.y + 3 */ });
  it("la torre como antes: 8 ventanas encendidas y la ventana del papel en la pared este", () => { /* tower.litWindows 8, paperWindow.x ≈ TOWER.x + TOWER.w */ });
  it("lo nuevo no pasa de 5 y no se solapa con bancos, faroles ni cordón", () => { /* fuente + kioscos: max.z ≤ 5; sin solape de caja con los demás sólidos */ });
  it("los dos charcos de la torre siguen con alpha 0.25 y el rng se consume como hoy", () => { /* 6 poly alpha 0.25; rng.next() tras plazaAndTower igual que tras tiles() solo */ });
});
```

- [ ] **Step 2:** `npx vitest run src/city/fixed.test.ts` → FAIL.
- [ ] **Step 3:** `place(solids, accents, fountain(v3(150, 227, 0.05)))`; `kiosk(v3(PLAZA.x + 1.4, PLAZA.y + 1.4, 0.05))` y `kiosk(v3(PLAZA.x + PLAZA.w - 3.4, PLAZA.y + 1.4, 0.05))`. Todo lo demás igual.
- [ ] **Step 4:** `npm test` → PASS; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(#48): plaza con fuente y dos kioscos`.

### Cierre (etapa 4 del pipeline, no tarea de implementer)

- Captura de `lab/resume.html` a 1600×900 con el muelle y el malecón, guardada para el PR (guion `.scratch/evals-48.md`).

## Assumptions

- Las tres reubicaciones (decisiones 1, 2 y 3) siguen la regla de profundidad del issue ("ningún sólido ajeno a una receta entra en el hueco…") y sus tests, que no fijan esas coordenadas (`dos vault dentro de 192..198`, `≥ 6 bolardos`, `dos kioscos dentro de PLAZA`). Alternativa descartada: las coordenadas literales, con sólidos metidos unos dentro de otros. Van al PR como desvíos.
- Las tres precisiones de `city.test.ts` (decisión 8) se hacen en la misma tarea que el código que las vuelve necesarias; la evidencia de que hacen falta es que el test original falla con el código nuevo. Alternativa descartada: dejar el test original y cambiar el diseño (sin galpones `vault`, sin guirnaldas).
- La guirnalda vive dentro de la caja de la viga: `lights.ts` solo ocluye ventanas y neones de calle (`src/city/lights.ts:65-101`), no los demás acentos, que se pintan arriba de todo.
- Cada tarea es un commit propio; la 4 no depende de la 3 (otra función). Si una tarea queda a medias se descarta su diff con `git checkout`.

## Grilling

- Rondas: 1 (los cambios al plan fueron precisiones de tests, no pasos nuevos ni otra costura).
- Preguntas: 17. Fuentes: ISSUE 6, CODE 14, DOC 1 (varias respuestas citan más de una); NO SOURCE 3 → supuestos técnicos (arriba).
- Issues abiertos: ninguno.
