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
- Test: `src/scenes/sea-anim.test.ts` (helper `angle` en la línea 257, helper `axis` en la 352, test nuevo en el `describe("haz: un solo ángulo por frame (#66)")` o en uno nuevo `describe("haz: vértice propio (#149)")`)

**Interfaces:**
- Consumes: `setup()` del test (`{ w, a }`, con `w.sea!.lantern: Vec3`), `a.beam(): Accent[]`, `a.tick(ms)`.
- Produces: nada nuevo.

- [ ] **Step 1: test rojo.** `it("cada cuña lleva su propia copia de la linterna (#149)")`:
  - `const { w, a } = setup(); const lantern = w.sea!.lantern; const before = { ...lantern };`
  - para cada cuña de `a.beam()`: si no es `poly`, `throw new Error("se esperaba una cuña poly")`; `expect(x.pts[0]).toEqual(lantern)` y `expect(x.pts[0]).not.toBe(lantern)`.
  - mutar `pts[0].x += 5` en la primera cuña; `expect(lantern).toEqual(before)`; tras `a.tick(100)`, el vértice de `a.beam()[0]` es `toEqual(before)`.
- [ ] **Step 2:** `npx vitest run src/scenes/sea-anim.test.ts` → falla en `not.toBe`.
- [ ] **Step 3:** en `wedge`, `pts[0]` = `v3(o.x, o.y, o.z)`.
- [ ] **Step 4:** en los helpers `angle` y `axis`, `throw new Error("se esperaba una cuña poly")`.
- [ ] **Step 5:** `npx vitest run src/scenes/sea-anim.test.ts`, `bash .scratch/evals-149.sh`, `npm test`, `npm run typecheck` → todo en verde.
- [ ] **Step 6: commit** `fix(#149): cuña del haz con copia de la linterna y helpers con mensaje`.
