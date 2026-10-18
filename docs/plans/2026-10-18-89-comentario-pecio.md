# Comentario del pecio en `sea.ts` (#89): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el docstring de `wreck()` en `src/scenes/sea.ts` describa dónde está de verdad el pecio: en la fosa, con la popa a ~16 u al este del talud, y por qué no se lo corrió al talud.

**Architecture:** cambio solo de comentario. Un test en `src/scenes/sea.test.ts` lee `sea.ts` con `readFileSync` (como ya hacen `city.test.ts:231` y `sea-anim.test.ts:353`), aísla el bloque `/** … */` que precede a `const WRECK_LEN` y exige el texto nuevo. Otro test fija los números que el comentario afirma (distancia de la popa al talud, todo el pecio en `abyss`), para que el comentario no vuelva a quedar desfasado si alguien mueve `WRECK`.

**Tech Stack:** TypeScript y Vitest.

**Spec:** issue #89 y su Agent Brief (comentario de triage). Decisión del brief: corregir el texto, no mover el pecio.

## Global Constraints

- Archivos que cambian: `src/scenes/sea.ts` (solo líneas de comentario del docstring de `wreck`) y `src/scenes/sea.test.ts` (tests nuevos al final).
- No cambia ningún valor de geometría (`WRECK`, `WRECK_BUOY`, `WRECK_LEN`, coordenadas locales) ni ninguna expectativa existente de los tests (criterio 2 del brief).
- Comentarios, tests y mensajes en castellano. Commits `test(#89): …` y `docs(#89): …`.

## Datos medidos (de `src/map/geo.ts:66` y `src/scenes/sea.ts:26`)

- `abyssX(y) = 392 + 0.25 * (y + 60) + 6 * sin(y / 17)`; `abyssX(262)` ≈ 474.25.
- `WRECK = { x: 490, y: 262, heading: π/6 }`; la popa es el origen local (x local 0), así que está 15.75 u al este del talud.
- El punto del casco más cercano al talud (barrido de x local 0…40, y local −4…4) queda a 14.1 u al este: todo el pecio cae en `abyss`.
- El comentario de las constantes (`sea.ts:19-22`) ya dice "su popa queda ~16 u al este del talud … 30 u al este de la vuelta". El docstring nuevo dice lo mismo.

## Decisiones técnicas (declaradas)

1. **Texto del docstring.** La primera oración pasa de "un costero de 40 u partido en dos y hundido de popa en el talud de la fosa" a "un costero de 40 u partido en dos y hundido en la fosa". Se agrega una oración con la posición real y el motivo. El resto del docstring (proa, casa de popa, coordenadas locales, z ≥ −1) queda igual.
2. **Cómo se verifica "ya no menciona el talud como posición de la popa".** El docstring no contiene `en el talud` ni `sobre el talud`, y sí contiene `16 u al este del talud`, `fosa` y `#87`. La palabra "talud" puede aparecer como referencia de distancia, que es lo que pide el brief.
3. **Cómo se verifica "no cambia geometría ni baseline".** Con `git diff origin/main -- src/scenes/sea.ts`: todas las líneas cambiadas empiezan con ` *` (son del docstring). El repo no versiona archivos de baseline (`git ls-files | grep -i baseline` sale vacío). Las "baselines" son las expectativas de los tests existentes, que no se tocan: solo se agregan tests. El script está en `.scratch/evals-89.md` y va en la descripción del PR.
4. **Test de guarda geométrica.** Fija `WRECK.x - abyssX(WRECK.y)` entre 15 y 17, y `terrainAt === "abyss"` en cada vértice de cada placa (`poly`) del pecio, que incluye las esquinas más cercanas al talud. Pasa desde el principio: no es un test rojo, sino una guarda para que el comentario siga siendo cierto.

## Review Focus

1. Un docstring que diga "hundido de popa" sin "en el talud" sigue sugiriendo que la popa toca algo. El test exige "hundido en la fosa".
2. El regex que aísla el docstring no debe agarrar el bloque anterior (`buoysAndWreck`). Se ancla en `/**` seguido de ` * Pecio (#83)` y termina en `*/\nconst WRECK_LEN`.
3. Que el docstring nuevo no contradiga el comentario de las constantes (`sea.ts:19-22`): ambos dicen ~16 u y 30 u.
4. Que no se cuele ningún cambio de código en `sea.ts`: lo cubre el diff de la decisión 3.
5. Que las placas del pecio queden en `abyss` y no en `sea`: lo cubre la guarda de la decisión 4, vértice por vértice.

---

### Task 1: Tests del docstring y guarda geométrica (evals)

**Files:**
- Modify: `src/scenes/sea.test.ts` (imports y `describe` nuevo al final)

**Interfaces:**
- Consumes: `abyssX` de `../map/geo`, `terrainAt` de `./terrain`, `WRECK` y `sea` de `./sea`, `bounds` de `../iso/solids`.
- Produces: `describe("pecio: comentario y posición (#89)")`, que la Task 2 hace pasar.

- [x] **Step 1: Escribir los tests**

Agregar `import { readFileSync } from "node:fs";` como primera línea, sumar `abyssX` al import de `../map/geo` (`scene`, `bounds`, `Solid`, `terrainAt` y `WRECK` ya están en `sea.test.ts:3-10`), y al final del archivo:

```ts
describe("pecio: comentario y posición (#89)", () => {
  const doc = readFileSync(new URL("./sea.ts", import.meta.url), "utf8").match(/\/\*\*\n \* Pecio \(#83\)[\s\S]*?\*\/\nconst WRECK_LEN/)?.[0] ?? "";
  it("el docstring pone el pecio en la fosa, a ~16 u del talud, y no la popa en el talud", () => {
    expect(doc).not.toBe("");
    expect(doc).toMatch(/hundido en la fosa/);
    expect(doc).not.toMatch(/(en|sobre) el talud/);
    expect(doc).toMatch(/16 u al este del talud/);
    expect(doc).toMatch(/#87/);
  });
  it("la popa queda ~16 u al este del talud y todo el casco cae en la fosa", () => {
    expect(WRECK.x - abyssX(WRECK.y)).toBeGreaterThan(15);
    expect(WRECK.x - abyssX(WRECK.y)).toBeLessThan(17);
    const near = (x: Solid) => { const b = bounds(x); return Math.hypot((b.min.x + b.max.x) / 2 - WRECK.x, (b.min.y + b.max.y) / 2 - WRECK.y) < 45; };
    const hull = scene().solids.filter((x) => x.kind === "poly" && near(x)); // las placas del pecio; la boya es un cilindro y queda fuera
    expect(hull.length).toBeGreaterThanOrEqual(6);
    for (const x of hull) if (x.kind === "poly") for (const p of x.footprint) expect(terrainAt(p.x, p.y)).toBe("abyss");
  });
});
```

- [x] **Step 2: Correr y ver el primero fallar y el segundo pasar**

Run: `npx vitest run src/scenes/sea.test.ts -t "#89"`
Expected: el test del docstring FALLA (`hundido en la fosa` no aparece); la guarda PASA.

- [x] **Step 3: Commit**

```bash
git add src/scenes/sea.test.ts
git commit -m "test(#89): evals"
```

### Task 2: Docstring nuevo de `wreck`

**Files:**
- Modify: `src/scenes/sea.ts:122-129` (solo el docstring)

**Interfaces:**
- Consumes: los tests de la Task 1.
- Produces: nada que otra tarea use.

- [x] **Step 1: Reemplazar las dos primeras líneas del docstring**

De:

```ts
 * Pecio (#83): un costero de 40 u partido en dos y hundido de popa en el talud de la fosa. El centro del
 * casco está bajo el agua; asoman la proa (una cuña oxidada con su cubierta y la bita) y la casa de popa
```

a:

```ts
 * Pecio (#83): un costero de 40 u partido en dos y hundido en la fosa. La popa (`WRECK`) queda
 * ~16 u al este del talud (`abyssX(262)` ≈ 474) y todo el casco cae en `abyss`. No se lo corre hasta
 * el talud: exigiría revalidar los carriles con el validador de #87, porque la vuelta pasa a 30 u. El centro del
 * casco está bajo el agua; asoman la proa (una cuña oxidada con su cubierta y la bita) y la casa de popa
```

El test busca `16 u al este del talud` en una sola línea: un corte de línea dentro de esa frase lo rompe.

- [x] **Step 2: Correr los tests del pecio**

Run: `npx vitest run src/scenes/sea.test.ts`
Expected: PASS, todos.

- [x] **Step 3: Suite completa, typecheck y diff solo de comentario**

Run: `npm test && npm run typecheck && git diff origin/main -- src/scenes/sea.ts | grep '^[-+][^-+]' | grep -v '^[-+] \*'`
Expected: tests y typecheck en verde; el último `grep` no imprime nada.

- [x] **Step 4: Commit**

```bash
git add src/scenes/sea.ts
git commit -m "docs(#89): el pecio yace en la fosa, a ~16 u del talud"
```

## Assumptions

- **La guarda geométrica es un agregado técnico, no un criterio del brief.** Sostiene la afirmación que el criterio 1 pone en el docstring ("en la fosa, a ~16 u del talud"). Alternativa rechazada: no fijar los números y dejar que el comentario pueda volver a desfasarse.
- **La guarda mira los vértices de las placas, no el centro de cada pieza.** Con el centro, la esquina más cercana al talud (14,1 u) quedaba sin comprobar. Los cilindros (chimenea, bita) quedan dentro del contorno de las placas, y la boya `WRECK_BUOY` es un cilindro que el filtro `kind === "poly"` deja fuera. Alternativa rechazada: el centro de cada sólido, que además incluía la boya.
- **Test de regex sobre el fuente.** Sigue el patrón de `city.test.ts:231` y `sea-anim.test.ts:353`, que leen el `.ts` con `readFileSync(new URL(…, import.meta.url))`. Alternativa rechazada: verificarlo solo a mano, sin test.
- **El motivo del docstring cita el issue casi textual:** "exige revalidar los carriles con el validador de #87, porque la vuelta pasa a 30 u del pecio". Alternativa rechazada: "los carriles se validaron con el pecio a 30 u", que el issue no afirma.
- **El script de diff de `.scratch/evals-89.md` no se versiona.** `.scratch/` va en `.git/info/exclude`; el script se copia a la descripción del PR.

## Grilling

- Rondas: 1. Ningún cambio fue sustancial (las tareas y los cortes son los mismos), así que no hubo segunda ronda. Preguntas: 14.
- Fuentes de las respuestas: ISSUE 5 (1, 2, 3, 10, 13), CODE 8 (4, 5, 6, 7, 9, 11, 12, 13), DOC 0, NO SOURCE resueltas como supuesto técnico 4 (1, 5/6, 10, 14).
- Respuestas, en breve:
  1. Los criterios del brief son (1) "El docstring ya no menciona el talud como posición de la popa" (Task 2 y el primer test) y (2) "No cambia ningún valor de geometría ni ningún baseline" (decisión 3). La guarda no satisface ninguno de los dos: es un supuesto técnico.
  2. ISSUE, Desired behavior: "el pecio yace en la fosa, con la popa a unas 16 u al este del talud". El brief pide esa distancia de forma explícita.
  3. ISSUE, body: "exige revalidar los carriles con el validador de #87, porque la vuelta pasa a 30 u del pecio". CODE `sea.ts:19-22`: "30 u al este de la vuelta". Se corrigió el texto del docstring para citar eso y no afirmar una validación que el issue no menciona.
  4. CODE `geo.ts:66`: `export const abyssX = (y) => 392 + 0.25 * (y + 60) + 6 * Math.sin(y / 17)`; evaluada, `abyssX(262)` = 474.25. CODE `terrain-classify.ts:46`: `x >= abyssX(y) ? "abyss" : "sea"`, así que el borde es una línea, no una banda. Sondeado: x=474 da `sea` y x=475 da `abyss`.
  5. Sondeo durante el plan. La guarda pasó del centro de cada pieza a los vértices de las placas (Assumptions).
  6. Sondeado: dentro de 45 u hay 9 sólidos del pecio (placas de proa, cubierta, banda, caseta y mástil, más cilindros de chimenea y bita) y la boya `WRECK_BUOY`. Los barcos no están en `sea().solids` (se animan en `sea-anim.ts`). El filtro `poly` excluye la boya.
  7. CODE `sea.test.ts:3,7,8,10`: `bounds`, `Solid`, `WRECK` (exportado en `sea.ts:26`), `terrainAt` y `scene()` ya existen.
  8. El grep es una verificación del diff y no la única: el criterio 2 lo cubren también la suite existente sin tocar y el typecheck. Hoy `sea.ts` no tiene ninguna línea de código que empiece con ` *`.
  9. CODE `sea.ts:129-130`: `*/` seguido de `const WRECK_LEN = 40;`, sin `export`. El archivo no tiene `\r` (`grep -c` da 0). Si alguien lo renombra, el test falla por `doc === ""` con un mensaje claro: ese es el objetivo.
  10. CODE `city.test.ts:231` y `sea-anim.test.ts:353`: el patrón ya está en uso. El regex se aplica solo al docstring del pecio.
  11. CODE `city.test.ts:231`: usa `readFileSync(new URL("./city.ts", import.meta.url))`, el mismo patrón, y corre en Vitest. Los tests no entran en el build de Vite.
  12. El repo no tiene Prettier, ESLint ni editorconfig (`ls -a` sin coincidencias), y `sea.ts:22` ya usa `≈`.
  13. CODE `.github/workflows/deploy.yml:26-27`: CI corre `typecheck` y `npm test`. El pipeline mergea con los checks en verde, después de la Task 2.
  14. Supuesto técnico (ver Assumptions).
- Issues abiertos: ninguno.
