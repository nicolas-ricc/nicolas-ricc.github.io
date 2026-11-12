# Interpenetración de cajas en el contrato genérico del kit (#152) — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que `kit.test.ts` compruebe, para toda receta de `RECIPES`, que ningún par de sólidos interpenetra sus cajas. Un par se excusa solo si los dos sólidos llevan la marca `interlocks`. Además, corregir en la receta los solapes que no son intencionales.

**Arquitectura:** el tipo `Solid` (`src/iso/solids.ts`) gana un campo opcional `interlocks?: true`, como `tone`. El render lo ignora. Lo leen solo los tests del kit. `interlock(s)` (`src/kit/piece.ts`) devuelve una copia marcada. Lo usan solo los constructores de los casos que lista el brief. El chequeo es un helper del test, `interpenetrations(solids)`, al lado de `concaveIntruders`, y corre en el `runs` del contrato con los mismos 2 lotes, 4 estilos y 20 semillas. Las correcciones (campus, constructionSite, shopRow, tankGroup, derelictHall) cambian geometría. Las marcas cambian solo el JSON.

**Stack:** TypeScript estricto, Vitest. Sin dependencias nuevas.

**Spec:** el issue #152, Agent Brief del re-triage del 2026-11-12, con la "Decisión: tolerancia con una marca en el sólido".

## Restricciones globales

- Código, comentarios, nombres de tests y mensajes en inglés (`src/english.test.ts`). Este documento, en castellano.
- Tolerancia `1e-6` en los tres ejes: un par interpenetra si `min(a.max, b.max) − max(a.min, b.min) > 1e-6` en x, y y z, con `bounds()`. Las caras que se tocan no cuentan.
- Un par se excusa solo si **los dos** sólidos llevan `interlocks: true`.
- La marca solo la ponen los constructores de estos casos:
  - uniones del mismo material: cornisas, pilares o paredes en esquina, vigas y estructura de grúas;
  - postes que atraviesan losas (constructionSite);
  - árbol × árbol;
  - la vegetación de las ruinas (eatenRuin, derelictHall);
  - techo × techo de unidades vecinas.

  Techo × cuerpo y cornisa × cuerpo siguen fallando: un cuerpo (sólido con `facade`) nunca lleva la marca.
- Fuera de alcance: el criterio de `sortByDepth` y las escenas que no son del kit. No se marcan sólidos en `src/scenes/` (`towerCrane`, `jungle`, `prism`): el kit marca lo que recibe de ellos.
- Toda aleatoriedad sale del `Rng` recibido, en el mismo orden que hoy salvo donde una tarea lo diga.
- Commits `test(#152): …` / `fix(#152): …`, con `Co-Authored-By`.

## Decisiones técnicas declaradas

1. **Medida (2026-11-12, `main` en `3a15116`).** El chequeo sobre todo el registro da las 17 recetas del brief. Con las marcas de este plan aplicadas como prototipo, quedan solo cinco recetas:
   - campus: árbol × mesa (`table`, prisma `paving` de 0.7).
   - constructionSite:
     - el gancho (`rust`) y el cable (`steel`) de la grúa atraviesan las losas;
     - los contenedores pisan las columnas y el mástil.
   - shopRow: cornisa o techo × cuerpo vecino más alto.
   - tankGroup: anillo × cuerpo del tanque y anillo × poste de la escalera.
   - derelictHall: los cabios bajan 0.15 dentro del cuerpo y se meten 0.06 en el diente vecino.

   Todo lo demás lo cubren las marcas.
2. **El brief adivinó mal dos causas.** En campus, lo que pisa el árbol es la mesa, no el zócalo: el árbol arranca en `z + 0.05` y su caja choca con la mesa de 0.7. En tankGroup no hay una tapa en `h − 0.3`: es el anillo de media altura (`r + 0.2`, `h 0.3`, centrado en `h/2`), que en planta contiene al cuerpo. Se corrige la causa real.
3. **Solapes que el brief no lista.** Son tres:
   - el núcleo de constructionSite que atraviesa las losas;
   - las uniones de la grúa torre (mástil, pluma, contrapluma, contrapeso, cabina);
   - las uniones de la grúa de muelle (cabina, mástil, pluma, tirante, farol).

   Entran en "postes que atraviesan losas" y en "uniones del mismo material", y se marcan. Lo que no entra en ningún caso listado se corrige en la receta, porque el contrato tiene que dar verde:
   - el gancho y el cable de la grúa sobre las losas;
   - los contenedores;
   - los cabios de derelictHall contra el cuerpo y los dientes.
4. **Árboles × vigas en derelictHall se excusan.** Los dos ya llevan la marca por su propio caso (vegetación de la ruina, uniones de vigas): son las ramas que crecen entre los cabios del diente caído.
5. **`fingerprint` no cambia.** La marca es parte del JSON, así que mueve los hashes de las piezas marcadas aunque la geometría no cambie. Se re-graban una vez y se justifica en el comentario del test y en el PR:
   - `PIECES` de `world-baseline.test.ts`: `campus` y `grua-muelle`;
   - `MAIN` de `city.test.ts`.
6. **La marca se pone en el constructor.** Así la llevan todos los usos: `cornice`, `hipRoof`, `patioTree`, `streetTree`, `roofShrub`, los conos de `rooftopGarden`, `fence`. Lo que sale de `src/scenes/` (`towerCrane`, `jungle`) lo marca la receta al recibirlo.

## Review Focus

1. **Una marca que excusa de rebote:** dos sólidos marcados por casos distintos que se cruzan sin ser ninguno de los casos. Por ejemplo, el mástil de la grúa (marcado) atraviesa una losa (marcada): hoy pasa en el lote de la ciudad, y la tarea 3 lo saca moviendo el mástil. Lo cubren el invariante "ningún cuerpo con `facade` lleva la marca" de la tarea 6 y el test de la tarea 3 que fija el mástil fuera de las losas.
2. **shopRow con la fachada en `e`/`w`:** la fila corre en y y los vecinos están al norte y al sur. El contrato solo usa `open: ["s"]` y `["s", "e"]`. El test de la tarea 4 agrega `open: ["e"]`.
3. **El orden del rng de shopRow:** pre-calcular las alturas no debe correr el rng. El test de la tarea 4 fija el `fingerprint` de los cuerpos grabado en `main`.
4. **tankGroup en estilos no `industrial`:** el test de familia reescrito usa `STYLES.industrial` (`industrial.test.ts:181`), con los `LOTS` y `SEEDS` de la familia. El chequeo genérico cubre downtown, bars, residential y civic con `bounds()`, que incluye el octógono real del anillo y los semicuerpos.
5. **`maxH 10`:** el chequeo no corre en el test de cap 10, y el brief pide los lotes del contrato. No se agrega: es el follow-up #354.

---

### Task 1: la marca, el helper y los constructores comunes

**Archivos:**
- Modificar: `src/iso/solids.ts:31` (la intersección `& { tone?: number }`)
- Modificar: `src/kit/piece.ts` (helper `interlock`)
- Modificar: `src/kit/props.ts` (`streetTree`, `patioTree`, `roofShrub`, conos de `rooftopGarden`, `fence`)
- Modificar: `src/kit/roofs.ts` (`cornice`, `hipRoof`)
- Test: `src/kit/props.test.ts`, `src/kit/roofs.test.ts`, `src/kit/piece.test.ts`

**Interfaces:**
- Produce: `Solid` con `interlocks?: true`, documentado en el tipo: "kit test metadata: two solids whose boxes interpenetrate on purpose pass the kit's interpenetration check only if both carry it; rendering ignores it".
- Produce: `export const interlock = <S extends Solid>(s: S): S` en `src/kit/piece.ts`, que devuelve `{ ...s, interlocks: true }`.

- [ ] **Step 1: tests que fallan.**
  - `piece.test.ts`, `"interlock marks a copy and keeps the rest"`: `interlock(prism(0,0,0,1,1,1,"stone"))` tiene `interlocks: true` y el resto igual (`toMatchObject` contra el original), y el original no cambia.
  - `props.test.ts`: el test existente `"bollard, trees and terrace shrub"` espera ahora `interlocks: true` en `streetTree`, `patioTree` y `roofShrub`.
  - Test nuevo `"rooftopGarden: the cones interlock, the slab does not; fence segments interlock"`: todo cono de `rooftopGarden(...)` tiene `interlocks: true` y la losa `leafDark` no; los cuatro tramos de `fence(...)` la llevan; `container`, `table`, `bench` y `lamp(...).solids` no.
  - `roofs.test.ts`, `"cornice and hipRoof interlock; gable, step, pyramid and dome do not"`.
- [ ] **Step 2:** `npx vitest run src/kit/props.test.ts src/kit/roofs.test.ts src/kit/piece.test.ts`: FAIL.
- [ ] **Step 3:** implementar con `interlock(...)`.
- [ ] **Step 4:** los mismos tests: PASS. `npm run typecheck`: verde.
- [ ] **Step 5:** commit `fix(#152): interlocks mark on the solid and on the shared props`.

### Task 2: el chequeo en el contrato genérico (son los evals de la etapa 3)

**Archivos:**
- Modificar: `src/kit/kit.test.ts`
- Modificar: `src/kit/forms/landmarks.test.ts:40-50` (se borra `"no pair of solids of a recipe interpenetrates"`; queda subsumido)

**Interfaces:**
- Produce (solo en el test): `function interpenetrations(solids: Solid[]): [number, number][]`. Devuelve los pares `i < j` cuyas `bounds` se solapan más de `1e-6` en x, y y z y que no llevan los dos `interlocks`. Arriba, un comentario: `sortByDepth` ordena por caja, la marca va en los dos sólidos, y techo × cuerpo y cornisa × cuerpo no se marcan nunca.

- [ ] **Step 1: el oráculo.** `describe("kit: the interpenetration oracle")`, con dos prismas `a` y `b` que se solapan 1 en cada eje:
  - `"two marked solids that overlap pass"` → `[]`;
  - `"only one marked fails"` → `[[0, 1]]`;
  - `"neither marked fails"` → `[[0, 1]]`;
  - `"faces that touch do not count"`: `b` corrido para que toque la cara de `a` → `[]`;
  - `"a cornice or hip roof over a taller neighbour body still fails"`: `cornice({x:0,y:0,w:4,d:4,z:3}, "stone")` junto a un cuerpo `prism(4,0,0,4,4,6,"plaster",{facade:{floors:2,cols:2}})` → `[[0, 1]]`, y lo mismo con `hipRoof`.
- [ ] **Step 2: el contrato.** En el `describe(def.name)`, `it("no pair of solids interpenetrates unless both interlock (sortByDepth sorts by box)")` con `runs((p, lot) => expect(interpenetrations(p.solids), …).toEqual([]))`, y un mensaje con el nombre, el lote y los índices.
- [ ] **Step 3:** `npx vitest run src/kit/kit.test.ts`. Con la tarea 1 hecha, el oráculo pasa y fallan exactamente:
  - modern: campus, constructionSite, classic;
  - lowrise: shopRow, eatenRuin;
  - industrial: tankGroup, quayCrane;
  - reconversion: derelictHall, coveredMarket.

  Las demás (glassTower, las courtyard, rowHouses, loftHall, openDock) ya pasan por las marcas de la tarea 1. Sin la tarea 1, fallan las 17.
- [ ] **Step 4:** borrar el test duplicado de `landmarks.test.ts` y sacar los imports que queden sin uso.
- [ ] **Step 5:** commit `test(#152): evals`.

### Task 3: modern (classic, campus, constructionSite)

**Archivos:** `src/kit/forms/modern.ts`. Test: `src/kit/kit.test.ts` (`describe("kit: modern family")`).

- [ ] **Step 1: tests que fallan** en `kit: modern family`.
  - `"classic: the ground-floor pilasters interlock (corner pair), the body and cornice do not"`.
  - `"campus: no tree box touches a table box; trees interlock"`: semillas 1..20 × los dos `LOTS` × `STYLES.district`.
  - `"constructionSite: slabs, columns, core and the crane joints interlock; hook, cable and containers do not and stay clear of every slab and column"`:
    - mástil `h 22`, `w 1.2`, con `bounds.min.y >= sy + sd − 1e-9` (`sy + sd = lot.y + 13.5`);
    - el gancho (`rust`, `1.2×1.2×1`) y el cable no llevan la marca, y el mástil, la pluma y la cabina sí. Se buscan con predicados de forma, como `src/scenes/pieces.test.ts:6-30`, no por índice: si `towerCrane` cambia de orden, este test falla en lugar de marcar el gancho.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementar.**
  - classic: las dos pilastras de cada `k`, con `interlock`.
  - campus:
    - los conos, con `interlock`;
    - las mesas se calculan antes que los árboles. Un árbol cuya caja (`at ± r`, en planta) se solapa con la de una mesa se descarta, como hace `jungle` con las vías: el rng se consume igual (x, y, r, h) y el resto no se corre;
    - el orden de `p.solids` no cambia: árboles y después mesas.
  - constructionSite:
    - losas, columnas y núcleo, con `interlock`;
    - `towerCrane` va a un arreglo local. De él se marcan los cinco primeros (mástil, pluma, contrapluma, contrapeso, cabina) y se empujan cable y gancho sin marca. Va un comentario sobre ese orden de `towerCrane`;
    - `mast.y = sy + sd + 0.6`: el gancho y el cable cuelgan fuera de las losas en los dos lotes;
    - los contenedores en `y = sy + sd − 2.8` (debajo de la losa 1, que está en `z 2.7`, entre las líneas de columnas), con la misma x de hoy;
    - se actualiza el comentario del mástil.
- [ ] **Step 4:** `npx vitest run src/kit/kit.test.ts -t "modern|glassTower|classic|campus|constructionSite"`: PASS, y el chequeo genérico de las cuatro recetas en verde.
- [ ] **Step 5:** commit `fix(#152): modern overlaps — campus trees clear the tables, site crane and containers clear the slabs`.

### Task 4: lowrise (shopRow, eatenRuin)

**Archivos:** `src/kit/forms/lowrise.ts`. Test: `src/kit/forms/lowrise.test.ts`.

- [ ] **Step 1: tests que fallan.**
  - `"shopRow: a roof or cornice is flush on the side of a taller neighbour and overhangs 0.5 elsewhere"`:
    - lotes con `open: ["s"]`, `["e"]` y `["s","e"]`, semillas 1..20, los cuatro estilos;
    - para cada tienda, el techo (cornisa o `hip`) termina en el borde del cuerpo del lado de un vecino más alto y sobresale 0.5 de los otros lados.
  - `"shopRow: the bodies are the ones before #152 (rng order unchanged)"`: `fingerprint` of the bodies (solids with `facade`) for seeds 1..3 on `LOTS[0]` × `STYLES.downtown`, equal to the values recorded on `main` (`3a15116`) before touching the recipe. Comment: recorded on 3a15116.
  - `"eatenRuin: slabs, ruin block and jungle interlock"`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementar.**
  - shopRow:
    - un primer bucle saca del rng, en el mismo orden de hoy, `floors`, `tone` y `hip` de cada tienda;
    - un segundo bucle emite cuerpo, techo, toldo y slots;
    - el `Footprint` del techo se encoge 0.5 del lado del vecino más alto (`k − 1` del lado bajo del eje de la fachada, `k + 1` del alto), y así `cornice`/`hipRoof` quedan al ras;
    - con vecinos iguales o más bajos no cambia nada: techo × techo vecino ya está marcado.
  - eatenRuin: las losas sueltas y el bloque de la ruina, con `interlock`; `jungle` va a un arreglo local y sus conos entran marcados.
- [ ] **Step 4:** `npx vitest run src/kit/forms/lowrise.test.ts src/kit/kit.test.ts -t "shopRow|rowHouses|eatenRuin"`: PASS.
- [ ] **Step 5:** commit `fix(#152): lowrise overlaps — shop roofs flush toward a taller neighbour, ruin vegetation interlocks`.

### Task 5: industrial (tankGroup, quayCrane)

**Archivos:** `src/kit/forms/industrial.ts`. Test: `src/kit/forms/industrial.test.ts:178-205`.

- [ ] **Step 1: tests que fallan.** Se reescribe `tankGroup` como `"1..3 steel or rust tanks r 3..5 in two halves around a ring r + 0.2 h 0.3 at mid height, a split ladder post, and a strip around them"`:
  - cuerpo inferior en `lot.z` con `h = H/2 − 0.15`;
  - anillo `r + 0.2`, `h 0.3`, en `z + H/2 − 0.15`;
  - cuerpo superior en `z + H/2 + 0.15` con la misma `h`;
  - `H` en 4..8, el material de las tres partes igual (`steel` o `rust`);
  - dos postes `0.3×0.3` contra el lado plano sur, debajo y encima del anillo.

  Test nuevo `quayCrane`, `"the cabin, mast, boom, stay and light housing interlock; legs and cross beams do not"`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: implementar.**
  - tankGroup: se parte el cilindro y el poste alrededor del anillo. Los peldaños no cambian: en `y = wall + 0.35`, no tocan el anillo, cuyo lado plano sur está en `wall + 0.185`.
  - `quayCraneAt`: las cinco piezas de arriba, con `interlock`.
- [ ] **Step 4:** `npx vitest run src/kit/forms/industrial.test.ts src/kit/kit.test.ts -t "tankGroup|quayCrane"`: PASS.
- [ ] **Step 5:** commit `fix(#152): industrial overlaps — tanks split around the ring, quay crane joints interlock`.

### Task 6: reconversion (derelictHall, coveredMarket) y el invariante de cuerpos

**Archivos:** `src/kit/forms/reconversion.ts`. Test: `src/kit/forms/reconversion.test.ts`, `src/kit/kit.test.ts`.

- [ ] **Step 1: tests que fallan.**
  - `"derelictHall: rafters rest on the wall top and stay inside their gap; beams and jungle interlock"`: todo cabio tiene `bounds.min.z >= base − 1e-9` y su `x` dentro de `[x0 + 4k, ridge]`.
  - `"coveredMarket: the thin walls interlock at the corners, pillars and stalls do not"`.
  - En `kit.test.ts`, en el contrato, `it("no body with a facade or a published wall carries interlocks")`: para todo `w` de `p.walls` y todo sólido con `facade`, `interlocks` es `undefined`.
- [ ] **Step 2:** FAIL, el de cuerpos excepto si ya pasa: es una guarda, se deja igual.
- [ ] **Step 3: implementar.**
  - derelictHall:
    - las vigas (cumbrera y cabios) y los conos de `jungle`, con `interlock`;
    - cada cabio va de `v3(x0 + 4k + 0.15, yj, base + 0.15)` a `v3(ridge − 0.15, yj, top)`: el semiespesor (0.15) cubre lo que la caja se corre en x y en z.
  - coveredMarket: las cuatro paredes finas, con `interlock`.
- [ ] **Step 4:** `npx vitest run src/kit`: PASS completo, con el contrato genérico en verde para las 45 recetas.
- [ ] **Step 5:** commit `fix(#152): reconversion overlaps — derelict rafters on the wall top, market walls interlock`.

### Task 7: hashes, glosario y capturas

**Archivos:**
- `src/scenes/world-baseline.test.ts`
- `src/scenes/city.test.ts:343-352`
- `CONTEXT.md`
- `docs/superpowers/specs/assets/152-interlocks/*.png`

- [ ] **Step 1:** `npm test`. Se espera que falle solo en `PIECES` (`campus`, `grua-muelle`) y `MAIN`; el test de props de los árboles ya se actualizó en la tarea 1. Con el prototipo de marcas, la suite completa dio exactamente esos tres fallos. Si falla otra cosa, se para y se investiga.
- [ ] **Step 2: re-grabar.**
  - `PIECES` y `MAIN`, con un comentario `#152: …` como los de #143/#56: marcas `interlocks` en todas; campus pierde los árboles que pisaban mesas; las piezas sin suelo cambian por shopRow, tankGroup, constructionSite y derelictHall.
  - `grua-muelle` cambia solo por las marcas: la geometría es la misma, como muestran sus capturas.
- [ ] **Step 3: glosario.** Entrada **Interlock** en `CONTEXT.md`, después de Recipe: qué es, quién la pone (los casos), que excusa solo de a pares, y `Code:` (`src/iso/solids.ts` `Solid.interlocks`, `src/kit/piece.ts` `interlock`, `src/kit/kit.test.ts` `interpenetrations`).
- [ ] **Step 4: capturas antes/después.**
  - Antes: `origin/main` en un worktree en :5174. Después: esta rama en :5173.
  - Las dos con agent-browser headless con la extensión, de `lab/storybook.html#campus`, `#grua-muelle` y `lab/kit.html` (seed 1, estilo 1): la fila de modern (constructionSite), la de lowrise (shopRow), la de industrial (tankGroup) y la de reconversion (derelictHall).
  - Se guardan como `<nombre>-before.png` / `<nombre>-after.png`.
- [ ] **Step 5:** `npm test` y `npm run typecheck`: verdes.
- [ ] **Step 6:** commit `fix(#152): re-record piece hashes, glossary and before/after captures`.

## Assumptions

Decididas en el grilling. Van también a la descripción del PR.

1. **Grúas.** Las uniones de la grúa torre y de la grúa de muelle cuentan como "uniones del mismo material", como el brief lista para quayCrane y derelictHall. Se marcan solo las piezas de acero que se unen: el gancho (`rust`) y el cable no se marcan, y se corrigen moviendo el mástil. Rechazado: marcar toda la grúa.
2. **El núcleo de constructionSite** es un poste que atraviesa las losas. Rechazado: partirlo entre losas, que cambia la pieza más que la marca.
3. **`fence` y `roofShrub`.**
   - `fence` se marca porque los dos solapes que el brief nombra con cercos (las esquinas de constructionSite y openDock, en "postes o pilares dobles en esquina") son esquinas del cerco, y openDock no tiene otro solape (medido).
   - `roofShrub` y `streetTree` son árboles (`props.ts:36-40`), y la marca de árbol va en el constructor.
   - Rechazado: marcar en cada receta, que duplica.
4. **Rebote entre marcas.** Se midió sobre la muestra del contrato con el prototipo de marcas. Todos los pares excusados son de los casos listados:
   - cono × cono, cornisa × cornisa, hip × hip, cornisa × hip;
   - pilastras, paredes de coveredMarket, cerco, losa × columna/núcleo, uniones de grúa;
   - la vegetación de eatenRuin y derelictHall (árbol × losa, bloque o viga).

   El único rebote fue mástil × losa en constructionSite, y lo saca el traslado del mástil. Rechazado: una lista blanca de pares de materiales en el test, que el brief no pide.
5. **campus puede quedar con menos árboles,** incluso cero en una semilla rara. Ningún test fija la cantidad (`kit.test.ts:202-212`): el patio y su suelo `leafDark` siguen ahí. Rechazado: re-sortear la posición, que consume rng variable.
6. **Cabios de derelictHall.** En `beam()` (`src/iso/solids.ts:261-273`), `w` va por `side` (y, horizontal) y `h` por `up`, en el plano xz del cabio. La caja se corre `0.15·sinθ` en x y `0.15·cosθ` en z, los dos ≤ 0.15. Por eso el corrimiento de 0.15 de los extremos alcanza para toda pendiente.
7. **El chequeo de landmarks que se borra** corría `createRng(1)` × `STYLES.civic` × (LOT, LAB o el lote propio), con 1e-6 y sin excepciones (`landmarks.test.ts:40-50`). El nuevo usa más semillas y estilos, pero excusa los pares marcados. Medido: ninguna receta landmark aparece en la lista de excusados, así que en esta muestra no se pierde nada.
8. **Lo que el traslado del mástil deja dentro del lote** lo cubre el test existente del contrato "every solid inside the lot + 0.8" (`kit.test.ts:120-131`).
9. **Bordes al ras en shopRow.** `r.x + r.w` del vecino y `r.x` de la tienda siguiente salen de los mismos `s0`, así que difieren a lo sumo en un ulp, muy por debajo de 1e-6. `hipRoof` y `cornice` suman exactamente 0.5 (`roofs.ts:21,50`).
10. **Capturas.** `lab/kit.html` en su estado inicial (sin teclas: el README dice que `s` cambia la semilla y `1..4` el estilo) y los exhibits del storybook. Son escenas estáticas: no hace falta time-lapse.

## Grilling

- Rondas: 1 (los cambios fueron menores: un test por predicados para la grúa, el follow-up de `maxH 10`, assumptions). Griller `fable`.
- Preguntas: 18.
  - ISSUE: 4 (1, 4, 17, 2 en parte);
  - CODE: 9 (5, 7, 8, 9, 10, 12, 13, 14, 15);
  - DOC: 1 (16, README);
  - NO SOURCE → assumptions: 6 (2, 3, 6, 11, 18; la convención de commits la fija el pipeline: `test(#152)` para los evals y `fix(#152)` porque el issue es un `bug`, como los `fix(#…)` de `git log`).
- Spec ambiguities: 0.
- Issues abiertos: #354 (el chequeo con `maxH 10`, fuera de alcance).
