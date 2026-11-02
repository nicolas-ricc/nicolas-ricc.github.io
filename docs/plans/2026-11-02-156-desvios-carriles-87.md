# Puntero a los carriles de #87 en los desvíos de la referencia de barcos (#156): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la viñeta **Puerto de salida** de "Desvíos respecto del plan de #57" en `docs/superpowers/specs/2026-10-16-barcos-referencia.md` avise que #87 reemplazó el fondeadero de #83 y los cruces de la bahía por los carriles `LANE_OUT` / `LANE_BACK`, y apunte al inventario como estado vigente, sin reescribir el texto de #63/#83.

**Architecture:** cambio solo de documentación. Se agrega una oración en cursiva al final de la viñeta **Puerto de salida** (línea 529), la única que describe el fondeadero `(232, 50)` y las travesías. Un `it` nuevo en el `describe("barcos-referencia: cierre y medición (#65)")` de `src/scenes/ships-reference.test.ts`, que ya guarda esa subsección, fija el puntero y que el registro de #83 sigue en su lugar.

**Tech Stack:** Markdown y Vitest (`readFileSync` sobre el `.md`).

**Spec:** issue #156 (follow-up de #69). Precedente: `docs/plans/2026-10-18-69-nota-desvio-route.md`.

## Global Constraints

- Archivos que cambian: `docs/superpowers/specs/2026-10-16-barcos-referencia.md` (solo la viñeta **Puerto de salida**) y `src/scenes/ships-reference.test.ts`.
- El texto existente de la viñeta queda entero; solo se agrega al final (el issue: "without rewriting the history").
- Texto exacto que se agrega, en la misma línea, después de "…a 35 u.", separado por un espacio:

  ```
  *Desvío posterior (#87): sin fondeadero ni cruces de la bahía, dos carriles semirrectos (`LANE_OUT` / `LANE_BACK`) entre la bocana y la esquina inferior izquierda del cover; estado vigente en [`2026-10-17-barcos-inventario.md`](2026-10-17-barcos-inventario.md#inventario-después), lo anterior queda como registro.*
  ```

- Tests, comentarios y mensajes en castellano. Commits `test(#156): evals` y `docs(#156): …`.

## Decisiones técnicas (declaradas)

1. **Dentro de la viñeta, no viñeta nueva.** El issue pide "a one-line pointer … in that deviations section". La viñeta **Puerto de salida** es la que describe el estado viejo, así que el aviso queda pegado a lo que corrige. Una viñeta nueva al final quedaría lejos de la que contradice.
2. **Al final de la viñeta, no al principio.** Al revés de #69 (nota antepuesta), acá la viñeta es historia de desvíos ordenada en el tiempo (#63 → #83); #87 viene después y se lee al final. El "Lo anterior queda como registro" lo deja explícito.
3. **Enlace con ancla.** Los dos documentos están en `docs/superpowers/specs/`, así que el enlace es relativo. El ancla `#inventario-después` apunta al encabezado `### Inventario después` (`2026-10-17-barcos-inventario.md:132`), donde está la fila de `cargo`, `tug`, `barge` y la línea 146 que cita el issue. `CLAUDE.md` ya enlaza con ancla acentuada (`#método-del-time-lapse`).
4. **El resto del documento no se toca.** La línea 518 ("fondeadero en la bocana") describe capturas `antes-*` de #83 y es correcta como registro. La frase de entrada de la subsección ("el resto (rutas, …) quedó como estaba escrito") habla del plan de #57, no del estado actual.

## Review Focus

1. Que el texto de #83 (`(232, 50)`, `(362, −16)`, `y −50..−70`) siga entero: el test lo exige.
2. Que el puntero vaya en la viñeta de **Puerto de salida** y después del texto de #83, no en otra viñeta: el test parte la subsección en viñetas y compara posiciones.
3. Que el enlace apunte a un archivo que existe y a un encabezado que existe: el test resuelve la ruta y busca `### Inventario después`.
4. Que el `it` existente de desvíos (#60–#63) siga verde: no se tocan otras viñetas.
5. Que la viñeta siga siendo una sola línea (el documento no corta líneas): el test toma la viñeta hasta el salto de línea.

---

### Task 1: Puntero a #87 en **Puerto de salida**

**Files:**
- Modify: `src/scenes/ships-reference.test.ts` (nuevo `it` dentro de `describe("barcos-referencia: cierre y medición (#65)")`, después del `it("tiene una subsección de desvíos respecto del plan de #57")`)
- Modify: `docs/superpowers/specs/2026-10-16-barcos-referencia.md:529`

**Interfaces:**
- Consumes: `close()` y `DOC` (`URL`, `ships-reference.test.ts:10`) y los imports `existsSync`/`readFileSync` (`:1`), ya presentes en el archivo de test.
- Produces: nada.

- [ ] **Step 1: Escribir el test que falla**

```ts
  it("la viñeta del puerto de salida apunta a los carriles de #87 sin borrar el registro de #83 (#156)", () => {
    const sec = close();
    const from = sec.search(/^### Desvíos/m);
    expect(from).toBeGreaterThanOrEqual(0);
    const desvios = sec.slice(from);
    const item = desvios.split("\n").find((l) => l.startsWith("- **Puerto de salida")) ?? "";
    for (const old of ["(232, 50)", "(362, −16)", "y −50..−70"]) expect(item).toContain(old);
    const at = item.indexOf("*Desvío posterior (#87):");
    expect(at).toBeGreaterThan(item.indexOf("(232, 50)"));
    const note = item.slice(at);
    for (const s of ["`LANE_OUT`", "`LANE_BACK`", "sin fondeadero"]) expect(note).toContain(s);
    const link = note.match(/\]\((2026-10-17-barcos-inventario\.md)#([^)]+)\)/);
    expect(link?.[2]).toBe("inventario-después");
    const inv = new URL(link![1]!, DOC);
    expect(existsSync(inv)).toBe(true);
    expect(readFileSync(inv, "utf8")).toMatch(/^### Inventario después\s*$/m);
  });
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/scenes/ships-reference.test.ts`
Expected: FAIL solo el `it` nuevo (`expected -1 to be greater than …`). Los signos menos de los literales son U+2212, como en la línea 529.

- [ ] **Step 3: Agregar el puntero**

Al final de la línea 529 de `docs/superpowers/specs/2026-10-16-barcos-referencia.md`, después de "…con la escollera de la dársena a 35 u.", un espacio y el texto exacto de "Global Constraints".

- [ ] **Step 4: Correr la suite**

Run: `npm test && npm run typecheck`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-16-barcos-referencia.md
git commit -m "docs(#156): puntero a los carriles de #87 en los desvíos de la referencia de barcos"
```

(El test se commitea antes, en rojo, como `test(#156): evals`.)

## Assumptions

- **Ancla con la regla de slug de GitHub** (minúsculas, espacios a guiones, acentos conservados). `### Inventario después` aparece una sola vez en el inventario, así que no lleva sufijo `-1`. El test verifica archivo y encabezado, no el slug: descartado un slugger propio en el test para una sola ancla.
- **Commit del test en rojo** (`test(#156): evals`) antes del de docs, como en #69 (`b23faeb`); el PR se integra con squash, así que `main` nunca queda en rojo.
- **Nota en cursiva, al final de la viñeta.** El issue pide no reescribir la historia; la cursiva sigue el precedente de #69. Descartado anteponerla: la viñeta es una cronología #63 → #83 y #87 va después.
- **Puntero corto.** El issue sugiere "a one-line pointer". La nota es una sola oración en la misma línea física de la viñeta (el documento no corta líneas: hay líneas de más de 400 caracteres y no hay formateador de Markdown en el repo). Su contenido copia la fila de `cargo`, `tug`, `barge` del inventario (`2026-10-17-barcos-inventario.md:136`: "Dos carriles semirrectos entre la bocana y la esquina inferior izquierda del cover … sin fondeadero").

## Grilling

Una ronda (los cambios no alteraron la tarea ni la costura: nota más corta, guarda `from >= 0`, interfaces corregidas). 15 preguntas del griller (modelo `fable`).

- Con fuente: ISSUE 3 ("a one-line pointer to #87 (and to the inventory doc)", "without rewriting the history", "the outbound and return legs crossing the bay", que están en la propia línea 529). CODE 8 (`ships-reference.test.ts:1` imports, `:10` `DOC` es `URL`, `:95-96` `close()` corta en el siguiente `## `, `:113-119` el `it` de desvíos solo exige `^- \*\*.*#6x`; línea 529 con U+2212 verificado con `od`; inventario `:132` encabezado único y `:136` texto de los carriles; línea 518 dice literalmente "`antes-cover.png` y `antes-recorrido.png` (fondeadero en la bocana, …)" bajo "Medición de #83"; sin prettier/markdownlint en `package.json` ni en la raíz). DOC 2 (`docs/plans/2026-10-18-69-nota-desvio-route.md`: nota en cursiva y `test(#69): evals`; encabezado `superpowers:subagent-driven-development` exigido por la plantilla del skill `writing-plans`).
- Sin fuente, supuesto técnico: 2 (regla de slug del ancla; commit rojo intermedio). Ambigüedades de spec: 0. Fuera de alcance: 0. Issues abiertos: ninguno.
