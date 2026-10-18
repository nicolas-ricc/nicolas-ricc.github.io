# Storybook 6 (#97): cierre, capturas, README y estado de la spec — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar la historia #91: el README documenta `/lab/storybook.html`, la spec pasa a "implementado" con sus desvíos anotados y el PR lleva cinco capturas (cuatro exhibits y `lab/world.html`).

**Architecture:** el código del storybook no cambia. Son dos cambios de documentación vigilados por tests de texto en `src/lab/docs.test.ts` (el mismo patrón que ya protege la documentación de la flota), más un juego de capturas tomadas con agent-browser y commiteadas en `docs/superpowers/specs/assets/97-storybook/`, como hicieron #92..#96.

**Tech Stack:** Markdown, Vitest (`node:fs` + `readFileSync`, sin Pixi), agent-browser 0.26 con la extensión PixiJS DevTools (ver `CLAUDE.md`), Vite dev server.

**Spec:** issue #97 (manda donde difiera); `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` §8 (verificación visual) y §9 paso 5.

## Global Constraints

- README: una línea en la sección del laboratorio, con qué muestra, el hash y las teclas `←`/`→`, `g`, `h`, `a`, `6`, `?bloom=`, `?speed=`.
- La spec pasa a estado implementado "con una nota de desvíos si los hubo".
- Capturas con agent-browser a 1600×900 2x: cuatro exhibits (uno animado por zona y una pieza) y una de `lab/world.html` confirmando que se ve igual que antes.
- `npm test` y `npm run typecheck` en verde. Nada de dependencias nuevas. Comentarios y nombres de tests en castellano. Commits `docs(#97): …` / `test(#97): …`.
- No se toca código de `src/` fuera de `src/lab/docs.test.ts`.

## Decisiones técnicas (declaradas)

1. **Los textos se vigilan con tests.** `docs.test.ts` ya lee el README y exige frases de la flota. Se le suma un `describe` del storybook: el README nombra `/lab/storybook.html`, el hash, cada tecla y los dos parámetros, y lista la spec entre las specs; la spec no dice "sin implementar", dice "implementado" y tiene una sección `## 10. Desvíos` (la spec termina hoy en §9).
2. **URL del lab.** El README usa `/lab/storybook.html`, como el resto de sus enlaces al lab. `vite.config.ts` tiene `base: "/"`, así que `/map/lab/...` (lo que dice `CLAUDE.md`) cae en el sitio. Ese desajuste es #99; no se toca acá.
3. **Teclas en el README.** El issue pide `←`/`→`; el código también acepta `↑`/`↓` y `j`/`k` (`storybook.ts`, `NEXT`/`PREV`). La línea dice "flechas o `j`/`k`" y el test exige `←`, `→`, `j` y `k`.
4. **Ubicación de la línea.** Párrafo propio, justo después del párrafo del laboratorio del README (sigue siendo la sección del lab): así el test no hereda `6` ni `?bloom=` de la frase de `world.html`. La spec del storybook se suma a la lista de specs del párrafo del laboratorio.
5. **Desvíos de la spec.** Se toman de las "Decisiones técnicas" de los planes `docs/plans/2026-10-17-9{2..6}-*.md`, ya mergeados. Se anotan solo los que cambian algo que la spec afirma: el recorte del terreno por triángulo, el memo de los reclamos, `Box` en `frame.ts`, `group`/`GROUPS`, `pad` y la forma del pad, la caja de las chimeneas, los casos que no se aíslan (grúa pórtico, grúa torre del desvío, torre en la plaza), la dársena como fondeadero, `shipAt` en vez de `ship`, `zoneFrame` delegando en `boxFrame`, el encuadre de las piezas con `solidsBox`, y la medición con los acentos ocultos.
6. **Exhibits capturados.** Uno animado por zona: `#chimeneas` (Portfolio, humo), `#torre` (Resume, luces de la torre) y `#faro` (Blog, haz del faro). Son tres de los cuatro que #93 exige animados. La pieza es `#grua-torre`. Más `lab/world.html`. Se captura con `?bloom=off`, para no depender de la medición diferida en headless.
7. **"Se ve igual que antes".** Este issue no toca código de runtime, así que `lab/world.html` no puede cambiar. Igual se verifica con evidencia: se comparan los `totals` de `rendering.capture()` (PixiJS DevTools) en esta rama y en `origin/main` (un worktree aparte, otro puerto), y las dos capturas se miran a ojo. En el PR va solo la de esta rama.
8. **Dónde viven las capturas.** `docs/superpowers/specs/assets/97-storybook/{chimeneas,torre,faro,grua-torre,world}.png`. El PR las enlaza por el SHA del commit con `?raw=true`, como #93: el SHA sobrevive al squash y a que se borre la rama.

## Review Focus

1. Un test que pasa con un README que solo nombra las teclas en otra frase: el test exige que todas aparezcan en el párrafo propio de `/lab/storybook.html`, que no es el de `world.html` (Task 1).
2. Una spec cuyo encabezado sigue diciendo "sin implementar" aunque haya una sección de desvíos: el test exige las dos cosas (Task 2).
3. Una captura tomada antes de que el exhibit termine de dibujar, o con el hash corregido a otro exhibit: el script espera y lee `location.hash` y el `aria-current` del índice antes de capturar (Task 3).
4. Una captura a 1x: el script fija `set viewport 1600 900 2` y verifica que el PNG mida 3200×1800 (Task 3).
5. Un desvío anotado que contradice el código de `main`: cada desvío cita el archivo o el plan de donde sale (Task 2).

## Assumptions

Decididas en la revisión del plan (etapa 2), sin fuente escrita que las fije:

- **Mismos totals en world.html.** #115 ya comparó `rendering.capture()` entre su rama y `main` y dio igual (82 graphics / 49 instrucciones). Si acá difieren, se repite la captura dos veces en cada servidor. Si la diferencia sigue y viene solo de capas animadas (sprites del humo, barcos), se anota en el PR y se decide por la comparación visual. Alternativa descartada: exigir igualdad estricta y bloquear.
- **Dos dev servers.** `vite.config.ts` en `origin/main` y en la rama es el mismo archivo (este issue no lo toca). El de main se levanta con `--port 5174 --strictPort`, para fallar en vez de saltar de puerto. Alternativa descartada: capturar main primero con un solo servidor y después cambiar de rama (deja el árbol a mitad de camino si algo falla).
- **2x real.** `agent-browser set viewport 1600 900 2` ya dio PNGs de 3200×1800 en #93..#96 (`assets/9x-storybook/*.png`). `file` lo confirma por captura; las capturas son del viewport, no de la página entera.
- **Links por SHA.** GitHub mantiene los commits de un PR mergeado por squash (refs `pull/N/head`). El link de #93 (`48a5030…/planta.png?raw=true`) responde 200 hoy.
- **Commits.** Los tests van en el commit `test(#97): evals` de la etapa 3, todos juntos y en rojo, como manda el pipeline. Los cambios de texto van en commits `docs(#97): …`. Entre la etapa 3 y la 4 la suite está en rojo a propósito. Alternativa descartada: un commit test+docs por tarea.
- **Teclas extra.** El README nombra `j`/`k`, además de `←`/`→`, porque la spec §6 los lista ("`→`/`↓`/`j` siguiente, `←`/`↑`/`k` anterior") y `storybook.ts` (`NEXT`/`PREV`) los implementa.

---

### Task 1: línea del storybook en el README

**Files:**
- Modify: `README.md` (párrafo del laboratorio, el que empieza con "`npm run dev` y abrir `/lab/world.html`")
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada que use otra tarea.

- [ ] **Step 1: test que falla** (lo escribe la etapa de evals; verificar que esté). Al final de `src/lab/docs.test.ts`:

```ts
describe("documentación del storybook (#97)", () => {
  // párrafo propio, para que las teclas no se hereden de la frase de world.html (que ya nombra `6` y ?bloom=)
  const story = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/storybook.html")) ?? "";
  it("README describe /lab/storybook.html y el hash en un párrafo propio", () => {
    expect(story).toMatch(/hash/);
    expect(story).not.toContain("/lab/world.html");
  });
  it("README nombra las teclas y los parámetros del storybook", () => {
    for (const k of ["←", "→", "`j`", "`k`", "`g`", "`h`", "`a`", "`6`", "?bloom=", "?speed="]) expect(story).toContain(k);
  });
  it("README lista la spec del storybook entre las specs del laboratorio", () => {
    const lab = readme.split(/\n\s*\n/).find((p) => p.includes("/lab/world.html")) ?? "";
    expect(lab).toContain("2026-10-17-storybook-estructuras-design.md");
  });
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: FAIL en los tres `it` del storybook (`story` vacío; la spec no está en la lista).

- [ ] **Step 3: editar el README.** Insertar un párrafo nuevo (separado por líneas en blanco) inmediatamente después del párrafo del laboratorio (el que termina en `` `2026-10-17-barcos-inventario.md`). ``) y antes del párrafo "El bloom de las luces no entra en el primer dibujo…":

```markdown
`/lab/storybook.html` es el storybook de estructuras: muestra un edificio o
estructura a la vez, recortado del mundo por su caja (o armado solo en el
origen, para las piezas reubicables como barcos y grúa torre), con su
animación y un panel de lectura (sólidos, caras, acentos, caja, materiales).
El hash de la URL elige el exhibit (`#faro`); flechas (`←`/`→`) o `j`/`k`
pasan al siguiente o al anterior; `g`, `h` y `a` ocultan o muestran suelo,
sombras y acentos; `6` rota el bloom, `?bloom=` lo fuerza y `?speed=` escala
el reloj de las animaciones.
```

  y en la lista de specs del mismo párrafo, después de `` `2026-10-17-barcos-inventario.md` `` sumar `` `2026-10-17-storybook-estructuras-design.md` `` (cerrando el paréntesis igual que hoy).

- [ ] **Step 4: correr y ver que pasa**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add README.md src/lab/docs.test.ts
git commit -m "docs(#97): el README documenta el storybook del lab"
```

### Task 2: estado de la spec y desvíos

**Files:**
- Modify: `docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md` (línea `**Estado:**` y una sección nueva `## 10. Desvíos` al final)
- Test: `src/lab/docs.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: nada que use otra tarea.

- [ ] **Step 1: test que falla** (etapa de evals). Al final de `src/lab/docs.test.ts`:

```ts
describe("estado de la spec del storybook (#97)", () => {
  const spec = readFileSync(`${ROOT}docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md`, "utf8");
  it("la spec dice implementado y no sin implementar", () => {
    const estado = spec.split("\n").find((l) => l.startsWith("**Estado:**")) ?? "";
    expect(estado).toMatch(/implementad/);
    expect(estado).not.toMatch(/sin implementar/);
  });
  it("la spec anota sus desvíos", () => {
    expect(spec).toMatch(/^## 10\. Desvíos$/m);
  });
});
```

- [ ] **Step 2: correr y ver que falla**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: FAIL en los dos `it` de la spec.

- [ ] **Step 3: editar la spec.**
  - `**Estado:** diseño aprobado, sin implementar` → `**Estado:** implementado (#92..#97, historia #91); desvíos en §10`.
  - Al final, una sección `## 10. Desvíos` con una viñeta por desvío. Cada viñeta dice qué afirmaba la spec, qué se hizo y de dónde sale (issue o plan):
    - §3 `Box` vive en `src/world/frame.ts`, no en `exhibits.ts`, porque lo consume `boxFrame` y `src/world/` no importa de `src/lab/` (#92).
    - §3 el exhibit lleva además `group` (siete grupos de `GROUPS`, uno por fila de la tabla), porque `WorldZone` tiene solo tres valores y el índice agrupa en siete (#93).
    - §3 las piezas llevan `pad?: Material` (los barcos, `water`) y los barcos se arman con `shipAt(kind, {x:0,y:0}, 0)`, no con `ship(…)` (#94).
    - §3 casos que no se aíslan: la grúa pórtico queda también dentro de "gradas", la grúa torre del desvío dentro de "playa de camiones" y de "cinta", la torre de oficinas en el centro de la plaza. Las estructuras largas (malecón, línea de alta tensión, boyas) van enteras aunque encuadren finas. La "dársena" es el fondeadero del astillero (`BERTH`), no el dique seco `DOCK`. La caja de las chimeneas se estira al norte `PUFF_RANGE` para que el humo no se corte (#92, #93).
    - §4 el terreno (`kind: "ground"`) se recorta por triángulo, no por la caja del sólido entero: las seis mallas cubren el mundo y se conservarían enteras. Un triángulo nunca se corta (#92).
    - §4 `terrain.*` y `claims` pasan por un memo por `(box, sólido)`, porque el runtime excluye el agua reclamada por identidad. Las capas animadas no se memoizan (#92).
    - §4 `pieceScene(build, pad = "paving")`: el pad es una malla `ground` (tapa más caras este y sur), no un prisma, para que se pinte antes que las sombras. Su lado sale de la caja de la pieza con un margen de 3 u, y la tapa queda en `Math.floor(min z)` (#94).
    - §6 `zoneFrame` delega en `boxFrame`. Las piezas se encuadran con `solidsBox` de sus sólidos, pad incluido (#92, #94).
    - §6 si los acentos se apagan antes de la medición diferida del bloom, se mide con el bloom oculto. Se acepta (#96).
    - §8 la página se sirve en `/lab/storybook.html`, no en `/map/lab/…`: `base: "/"` en `vite.config.ts`. Ver #99.
    - §8 capturas de cierre en `assets/97-storybook/` (`chimeneas`, `torre`, `faro`, `grua-torre`, `world`).

- [ ] **Step 4: correr y ver que pasa**

Run: `npx vitest run src/lab/docs.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add docs/superpowers/specs/2026-10-17-storybook-estructuras-design.md src/lab/docs.test.ts
git commit -m "docs(#97): la spec del storybook pasa a implementada con sus desvíos"
```

### Task 3: capturas de cierre

**Files:**
- Create: `docs/superpowers/specs/assets/97-storybook/{chimeneas,torre,faro,grua-torre,world}.png`
- Script de verificación (no se commitea): `.scratch/evals-97.md`

**Interfaces:**
- Consumes: el dev server (`npm run dev -- --host --port 5173`) y agent-browser con la extensión (ver `CLAUDE.md`).
- Produces: las cinco rutas de PNG, que el PR enlaza.

- [ ] **Step 1:** levantar el dev server de esta rama en 5173. Levantar el de `origin/main` en 5174, desde `git worktree add /tmp/main97 origin/main` con `node_modules` enlazado.
- [ ] **Step 2:** seguir `.scratch/evals-97.md`. Para cada exhibit: abrir `http://localhost:5173/lab/storybook.html?bloom=off#<id>`, esperar 4 s, verificar que `location.hash === "#<id>"` y que `a[aria-current="page"]` tiene `data-id="<id>"`, y capturar a `docs/superpowers/specs/assets/97-storybook/<id>.png`.
- [ ] **Step 3:** para `lab/world.html?bloom=off`, en 5173 y en 5174: leer los `totals` de `rendering.capture()` y capturar. Los totals deben coincidir. La de 5173 va a `world.png`; la de main, a `.scratch/`.
- [ ] **Step 4:** verificar que cada PNG mide 3200×1800 (`file *.png`) y mirarlo a ojo con Read: hay una estructura sola y centrada, y `world.png` coincide con la de main.
- [ ] **Step 5:** commit

```bash
git add docs/superpowers/specs/assets/97-storybook
git commit -m "docs(#97): capturas de cierre del storybook"
```

## Grilling

- Rondas: 1. La revisión corrigió el test del README y fijó el número de sección, sin agregar ni quitar tareas: no hizo falta una segunda.
- Preguntas: 18. Por fuente: CODE 9 (1, 2, 3, 4, 7, 8, 10, 12, 16), ISSUE 2 (9, 11), DOC 1 (CLAUDE.md, para 17), NO SOURCE 6, todas supuestos técnicos (5, 6, 13, 14, 15, 18).
- Correcciones: el test del README busca el párrafo propio del storybook. Antes heredaba `6` y `?bloom=` de la frase de `world.html` (pregunta 2). La sección de desvíos es `## 10. Desvíos` y el test la exige con ese número; la spec termina en §9 (pregunta 4).
- Supuestos: los de `## Assumptions`.
- Issues abiertos: ninguno. El desajuste `/map/` contra `/` (pregunta 12) ya es #99.
