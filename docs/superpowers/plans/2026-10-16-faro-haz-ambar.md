# Faro con haz cálido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El haz del faro de Blog pasa de la familia magenta a la familia ámbar, con un test que lo fija, sin tocar ningún otro neón de la escena.

**Architecture:** `beam()` en `src/scenes/sea-anim.ts` devuelve dos cuñas (`Accent` de tipo `poly`) armadas por `wedge(len, color, alpha)`. Solo cambian los dos colores que se le pasan a `wedge`; geometría, alphas, período y contrato del animador (`sea.beam`) quedan iguales. La paleta ya tiene `amber` / `amberMid` / `amberBleed` en `ACCENT_COLORS` (`src/map/palette-iso.ts`), así que no se agregan colores.

**Tech Stack:** TypeScript, Vitest (`npm test`), `tsc` (`npm run typecheck`), Vite (`npm run build`, `npm run dev`), PixiJS (lab), `agent-browser` para la captura.

**Spec:** issue #58 (hijo de #57; decisión 16 del plan de #57: `amberBleed` cuña larga alpha 0.5, `amber` cuña corta alpha 0.6, nada más cambia).

## Global Constraints

- Rama base `feature/57-barcos-reales-rutas`; el PR va contra esa rama.
- `beam()` pasa a `wedge(BEAM_LEN, "amberBleed", 0.5)` y `wedge(BEAM_INNER, "amber", 0.6)`. Si con `?bloom=on` la cuña corta satura de más, usar `amberMid` en lugar de `amber` y anotarlo en el PR.
- La galería de neón de la punta (magenta), las balizas de costa (cian), el cartel del farero (cian/magenta) y la ventana de la casa del farero (`src/scenes/sea.ts`) **no cambian**.
- No se agregan colores a la paleta.
- `npm test`, `npm run typecheck` y `npm run build` en verde.

## Review Focus

- Bloom activo (`?bloom=on`): el ámbar puro de la cuña corta podría quemarse a blanco; esperado: se ve ámbar, no blanco. Se verifica a ojo en la captura de la Task 2 (no automatizable).
- Reduced motion: el haz queda fijo al este; esperado: también ámbar. Lo cubre el test de la Task 1, que corre la aserción con y sin `reducedMotion`.
- Cualquier momento del giro: los colores no dependen del reloj; esperado: ámbar en todo el período. El test de la Task 1 lo comprueba en varios instantes.
- Neones vecinos: un cambio que "pase a ámbar todo lo del faro" rompería la galería; esperado: galería magenta y costa cian. Ya lo fijan los tests de "neones" (`/^(cyan|magenta)/`); la Task 1 los corre sin tocarlos.
- Otros tests que asuman el haz rosa: esperado: ninguno. La Task 1 incluye la búsqueda (`grep`) que lo confirma.

---

### Task 1: Haz ámbar con test que fija la familia de color

**Files:**
- Modify: `src/scenes/sea-anim.ts` (docstring de cabecera, líneas ~8-15; `beam` en el objeto devuelto, línea ~142)
- Test: `src/scenes/sea-anim.test.ts` (describe "mar, haz y boyas", línea ~102)

**Interfaces:**
- Consumes: `createSeaAnim(scene, { reducedMotion })`, `SeaAnim.beam(): Accent[]`, `SeaAnim.tick(dtMs)`; helper de test `setup(reducedMotion?)` ya definido en el archivo.
- Produces: `beam()` devuelve `[cuña larga color "amberBleed" alpha 0.5, cuña corta color "amber" alpha 0.6]`. Firma sin cambios.

- [ ] **Step 1: Write the failing test**

En `src/scenes/sea-anim.test.ts`, dentro de `describe("mar, haz y boyas", ...)`, después del primer `it`, agregar:

```ts
  it("el haz es luz cálida: las dos cuñas son de la familia ámbar, ninguna magenta, en todo el giro y con reduced-motion", () => {
    for (const reduced of [false, true]) {
      const { a } = setup(reduced);
      for (let t = 0; t < BEAM_PERIOD_MS; t += BEAM_PERIOD_MS / 4) {
        const b = a.beam();
        expect(b.map((x) => x.color)).toEqual(["amberBleed", "amber"]);
        for (const x of b) { expect(x.color).toMatch(/^amber/); expect(x.color).not.toMatch(/^magenta/); }
        a.tick(BEAM_PERIOD_MS / 4);
      }
    }
  });
```

(Si en la Task 2 se decide `amberMid` para la cuña corta, el `toEqual` pasa a `["amberBleed", "amberMid"]`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/sea-anim.test.ts -t "luz cálida"`
Expected: FAIL, recibe `["magentaBleed", "magenta"]`.

- [ ] **Step 3: Write minimal implementation**

En `src/scenes/sea-anim.ts`:

```ts
    beam: () => [wedge(BEAM_LEN, "amberBleed", 0.5), wedge(BEAM_INNER, "amber", 0.6)],
```

Y en el docstring de cabecera, donde dice `luces, el haz del faro y las dos boyas`, describir el color:

```ts
 * luces, el haz ámbar del faro (luz cálida, no neón) y las dos boyas, más
 * los neones de la punta: la galería corre al revés del haz, la costa ondula
 * y el cartel del farero alterna. ...
```

(reacomodar el resto del párrafo para que las líneas sigan con el ancho actual).

- [ ] **Step 4: Run tests to verify they pass, and check no other test assumes the pink beam**

Run: `npx vitest run src/scenes/sea-anim.test.ts src/scenes/sea-animator.test.ts`
Expected: PASS (incluidos los tests de "neones" sin cambios).

Run: `grep -rn "magenta" src --include=*.test.ts | grep -i "beam\|haz"`
Expected: sin resultados que asuman el haz magenta.

Run: `npm test && npm run typecheck`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/sea-anim.ts src/scenes/sea-anim.test.ts
git commit -m "feat(#58): haz del faro en la familia ámbar"
```

### Task 2: Verificación en el lab y captura del faro

**Files:**
- Create: `docs/superpowers/specs/assets/58-faro/faro-ambar.png` (y `faro-ambar-bloom.png`), capturas para el PR.
- Modify (solo si satura): `src/scenes/sea-anim.ts` (`"amber"` → `"amberMid"`) y la aserción `toEqual` del test de la Task 1.

**Interfaces:**
- Consumes: el `beam()` ámbar de la Task 1; lab `/lab/blog.html` (`?bloom=on|off`, tecla `3` encuadra Blog).
- Produces: capturas PNG enlazables desde el PR y la decisión `amber` vs `amberMid` anotada.

- [ ] **Step 1:** `npm run dev -- --host --port 5173` (en otra terminal, o en background con log a archivo), esperar a que responda `http://localhost:5173/lab/blog.html`.
- [ ] **Step 2:** Con `agent-browser`: abrir `http://localhost:5173/lab/blog.html?bloom=off`, esperar el render, pulsar `3`, capturar `faro-ambar.png`. Repetir con `?bloom=on` → `faro-ambar-bloom.png`.
- [ ] **Step 3:** Mirar las dos capturas: haz ámbar cálido, galería magenta, balizas cian. Si con bloom la cuña corta se ve blanca/quemada, cambiar a `amberMid` (código y test), volver a correr `npm test` y repetir la captura.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build` en verde.
- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/assets/58-faro/
git commit -m "docs(#58): captura del faro con haz ámbar"
```
