# Cuña del haz con copia de la linterna y helpers del haz con mensaje (#149) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que `wedge` en `src/scenes/sea-anim.ts` devuelva una copia de `scene.lantern` como vértice, y que los dos helpers del haz en `src/scenes/sea-anim.test.ts` que hacen `throw new Error()` sin mensaje digan qué esperaban.

**Architecture:** un solo cambio en producción: `const o: Vec3 = scene.lantern` sigue igual, y `pts[0]` pasa a ser `v3(o.x, o.y, o.z)` en lugar de `o`. En los tests, un test nuevo fija que el vértice de cada cuña es igual a la linterna pero no es el mismo objeto, y que mutarlo no mueve la linterna. Los dos `throw new Error()` reciben el mensaje `"se esperaba una cuña poly"`.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc --noEmit` (`npm run typecheck`).

**Spec:** issue #149 (follow-up de #66).

## Global Constraints

- "Copying the point (`v3(o.x, o.y, o.z)`) would decouple them": la copia se hace con `v3`, ya importado en `sea-anim.ts`.
- "Giving both a message (for example "se esperaba una cuña poly")": el helper `angle` de "el haz da una vuelta cada 8 s…" y el helper `axis` de "las dos cuñas comparten rotación…" (#66) usan ese mensaje.
- Sin cambios de comportamiento visible: posición, largo, alfa y color de las cuñas quedan iguales.
- El test de #66 "wedge recibe el ángulo y no lo calcula" busca el cuerpo de `wedge` con `/const wedge = [\s\S]*?\n  };\n/`: la forma de la función (declaración y cierre `  };`) se conserva.
- Comentarios y nombres de test en castellano, como el resto del archivo.
- `npm test` y `npm run typecheck` en verde.

## Review Focus

1. Las dos cuñas de un mismo frame: cada una tiene su propia copia, ninguna es `scene.lantern`. El test nuevo recorre las dos.
2. Mutar el vértice devuelto no mueve la linterna ni el vértice del frame siguiente. El test nuevo lo cubre.
3. Geometría intacta: los tests existentes del haz (vuelta cada 8 s, rotación compartida, largos `BEAM_LEN`/`BEAM_INNER`) siguen en verde sin tocar sus aserciones.
4. No queda ningún `throw new Error()` sin mensaje en `sea-anim.test.ts`. Lo comprueba el eval `.scratch/evals-149.sh`.
5. Typecheck: sin `any` ni `as` nuevos.

---

### Task 1: copia de la linterna y mensajes de los helpers

**Files:**
- Modify: `src/scenes/sea-anim.ts:158-161` (`wedge`)
- Test: `src/scenes/sea-anim.test.ts` (helper `angle` en la línea 257, helper `axis` en la 352, test nuevo en un `describe("haz: vértice propio (#149)")` aparte, al final del archivo)
- Eval (no se commitea): `.scratch/evals-149.sh`, creado en el stage 3; `.scratch/` va a `.git/info/exclude`.

**Interfaces:**
- Consumes: `setup()` del test (`{ w, a }`, con `w.sea!.lantern: Vec3`), `a.beam(): Accent[]`, `a.tick(ms)`.
- Produces: nada nuevo.

- [ ] **Step 1: test rojo.** `it("cada cuña lleva su propia copia de la linterna (#149)")`:
  - `const { w, a } = setup(); const lantern = w.sea!.lantern; const before = { ...lantern };`
  - `const beam = a.beam(); expect(beam).toHaveLength(2);` (si `beam()` devolviera `[]`, el bucle no correría y el test pasaría en vacío).
  - para cada cuña de `beam`: si no es `poly`, `throw new Error("se esperaba una cuña poly")`; `expect(x.pts[0]).toEqual(lantern)` y `expect(x.pts[0]).not.toBe(lantern)`.
  - los vértices de las dos cuñas no son el mismo objeto: `expect(apex0).not.toBe(apex1)`.
  - mutar `pts[0].x += 5` en la primera cuña; `expect(lantern).toEqual(before)`; tras `a.tick(100)`, el vértice de `a.beam()[0]` es `toEqual(before)`.
- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts` → falla en `not.toBe`.
- [ ] **Step 3:** en `wedge`, `pts[0]` = `v3(o.x, o.y, o.z)`.
- [ ] **Step 4:** en los helpers `angle` y `axis`, `throw new Error("se esperaba una cuña poly")`.
- [ ] **Step 4b: eval.** `.scratch/evals-149.sh` falla si `grep -c 'throw new Error()' src/scenes/sea-anim.test.ts` no es 0, o si `grep -c 'throw new Error("se esperaba una cuña poly")'` es menor que 3 (los dos helpers y el test nuevo), o si `wedge` todavía arma `pts: [o,`.
- [ ] **Step 5:** `npx vitest run src/scenes/sea-anim.test.ts`, `bash .scratch/evals-149.sh`, `npm test`, `npm run typecheck` → todo en verde.
- [ ] **Step 6: commit** `fix(#149): cuña del haz con copia de la linterna y helpers con mensaje`.

## Assumptions

- El test nuevo va en un `describe` propio de #149 y no dentro del de #66. Alternativa descartada: meterlo en el bloque de #66. Ese bloque no tiene `beforeEach` (cada test llama a `setup()`), así que las dos opciones dan lo mismo; el bloque aparte deja claro de qué issue viene.
- La comprobación del mensaje de los helpers es un eval por grep en `.scratch/` y no un test de Vitest que lea su propio archivo. Alternativa descartada: un test autorreferente. Mismo criterio que `.scratch/evals-122.sh` en `docs/plans/2026-11-02-122-helpers-agua-test.md`.
- El commit lleva el trailer `Co-Authored-By` que pide el pipeline del agente; no es una convención del repositorio.

## Grilling

- Rondas: 1 (los cambios que salieron fueron aserciones extra y la definición del eval, no un corte nuevo; no hizo falta segunda ronda). Griller: model fable.
- Preguntas: 14. Fuentes: ISSUE 3 (Q8, Q11, Q6 parcial), CODE 10 (Q1, Q2, Q3, Q4, Q5, Q6, Q9, Q10, Q12, Q13), DOC 0, NO SOURCE 3 (Q7, Q13, Q14 → supuestos técnicos).
- Respuestas con fuente:
  - Q1: `src/scenes/sea-anim.ts:179-182`: `beam()` siempre devuelve dos cuñas. Se agrega `toHaveLength(2)` antes del bucle.
  - Q2: `src/scenes/sea.ts:65-68,171-177`: `lantern` es un `v3` fijo, armado una vez en `lighthouse()`; `sea-anim.ts` no lo escribe en ningún lado (la única referencia es la línea 159).
  - Q3: `src/scenes/sea-anim.ts:179-182`: `beam()` arma cuñas nuevas en cada llamada, sin caché.
  - Q4: `src/scenes/sea-anim.ts:160`: `pts` tiene 3 vértices y `o` está solo en el índice 0; el test de #66 (`sea-anim.test.ts:353`) fija `toHaveLength(3)`.
  - Q5: `src/iso/geometry.ts:2-4`: `Vec3` es `{ x, y, z }` y `v3` devuelve exactamente eso; `sea.ts:65` construye la linterna con `v3`.
  - Q6: `src/iso/accent.ts:19` (`accentItem` proyecta a un arreglo nuevo) y `src/iso/translate.ts:32` (`map` a puntos nuevos); el único consumidor de `beam()` es `src/scenes/sea-animator.ts:9`. Ninguno muta `pts`. ISSUE: "Downstream code only reads accents today, so this is harmless."
  - Q8: el issue tiene exactamente dos ítems (1: copia de la linterna; 2: mensaje en los dos helpers), los dos cubiertos.
  - Q9: `sea-anim.test.ts:339-343`: solo fija que el cuerpo no contenga `beamAngle`; un `v3(` no lo afecta.
  - Q10: se agrega `not.toBe` entre los vértices de las dos cuñas.
  - Q11: ISSUE: "Giving both a message (for example "se esperaba una cuña poly")"; el eval del paso 4b exige ese texto.
  - Q12: `src/iso/accent.ts:8`: `pts: Vec3[]`, y `Vec3` tiene campos mutables (`geometry.ts:2`).
- Supuestos: los tres de `## Assumptions`.
- Issues abiertos: ninguno.
