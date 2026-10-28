# Fábrica: el complejo se muda al frente, los galpones atrás

**Fecha:** 2026-10-27
**Estado:** implementado en #238 (rama `feature/238-fabrica-mudanza`, hijos #241–#247 y este cierre, #248); los desvíos están en §9
**Alcance:** intercambiar el lugar del complejo fabril de Portfolio (la
"Fábrica de Luz" con la maltería, el tanque, las chimeneas, la torre de
enfriamiento y la subestación) con los galpones del astillero (naves de
montaje) y lo que los rodea. Así la fábrica, la pieza más trabajada del mapa,
ocupa un lugar más visible. Es el ítem 3 de la captura anotada
(`assets/2026-10-27-anotaciones/mapa-anotado.jpg`, recorte
`fabrica-3-estacion-5.jpg`).
**Reemplaza** las "huellas estables" de
`2026-10-24-fabrica-detalle-design.md` §2: posiciones de planta, portón,
`STACKS`, cinta, playa de camiones y subestación. **No cambia** el detalle
arquitectónico de cada pieza (§5–§9 de ese spec); solo el lugar y, en la
nave, la cantidad de vanos (§3.2).

## 1. Situación actual

Proyección: `sx = x − y`, `sy = (x + y)/2 − 1.4·z`. En pantalla, +x va hacia
abajo-derecha y +y hacia abajo-izquierda. La cámara ve solo el techo y las
caras +x (este) y +y (sur).

**Complejo fabril** (`src/scenes/factory.ts`, `maltings.ts`, `boiler-house.ts`, `substation.ts`):

| Pieza | Hoy |
|---|---|
| `PLANT` (maltería `MALT` x 20..44 + nave `NAVE` x 44..120) | x 20..120, y −46..−16, h 14 (maltería h 18, techos hasta z 26) |
| Tanque de agua `WATER_TOWER` | centro (10, −36), patas ±4, tope z 24.7 |
| Torre de escalera `STAIR_TOWER` | x 121..126, y −34..−26, h 16 |
| Portón este | x 119.8..120.3, y −23..−17 |
| Cinta inclinada + tolva | de (50, −4) a la tolva x 58.2..61.2, y −16..−14 |
| `STACKS` + pedestales 7×7 | (130, −40), (140, −34), (150, −40); pedestales x 126.5..153.5 |
| Torre de enfriamiento `COOLING` | (172, −36), r 9, h 16 |
| `SUBSTATION` | x 149..190, y −60..−47 (todas las coordenadas literales) |
| Cinta transportadora | (121, −20..2) y (30..123, 1..3) a z 6, hasta el patio de material |
| Playa de camiones | camiones en (40, −12), (70, −6), (95, −12); pallets x 22..45, y −3; faroles |

**Se quedan donde están:** el desvío `SIDING_Y = −8` con sus vagones y la
locomotora, la grúa torre (60, −12) sobre el desvío, la columna oeste
(playa de vías `RAIL_YARD_X`, excavadora, acopios y selva) y el hinterland.

**Galpones y vecinos** (`src/scenes/shipyard.ts`):

| Pieza | Hoy |
|---|---|
| Naves de montaje `halls()` | dos prismas a dos aguas x 8..98, y 36..52 y 56..72, h 10 (cumbrera 13.5), con autoelevadores |
| Patio de material | x 10..97, y 6..~28, cilindros (80, 10) r 5 y (92, 22) r 4 |
| Ramal `SPUR_Y = 32` | rieles y 30.5 / 33.5, x 10..104 |
| Ramal de la calle | rieles embutidos x 101 / 104, y 30.5..131; chatas en x 100.3..104.7, y 60..77 |
| Rieles nave→grada | y 40, 47, 60, 67, x 98..110 |
| Talleres `workshops()` | techo escalonado, x 46..70 y 74..98, y 80..94, h 7 |
| Playa de estacionamiento | x 46..98, y 100..126 — **se queda** |

## 2. Disposición nueva

### 2.1 Región del complejo

El complejo ocupa la región que hoy usan el patio de material, el ramal, los
galpones y los talleres. Límites duros, que salen de los vecinos que se
quedan:

- **x ≥ 4**: caja del exhibit `excavadora` (x1 = 4) y sombra de la excavadora.
- **x ≤ 98.7** para todo lo de más de 7 de alto: calle de transferencia
  (x 100..108) y caja del exhibit `calle-faroles` (x 99, h 7).
- **y ≥ −4**: el desvío (`SIDING_Y = −8`, vagones hasta y −6.8).
- **y ≤ 99**: playa de estacionamiento (y 100).

Son unas 95 × 103 u. El núcleo actual mide unas 121 u de este a oeste
(tanque 9 + planta 100 + torre de escalera 6), así que **no entra
trasladando**: hay que reacomodar.

### 2.2 Disposición sugerida

El plan puede ajustarla dentro de §2.1, y anota los cambios en los desvíos.

| Pieza | Lugar sugerido | Nota |
|---|---|---|
| Planta (maltería + nave) | x 6..92, y 44..74 | Nave acortada a 9 vanos (§3.2). Cabecera sur de la maltería y fachada sur de la nave mirando a la cámara |
| Torre de escalera | x 92..97, y 56..64 | Delante del testero este |
| Portón este | en el testero, como hoy | Sin cinta hacia el este |
| Tanque de agua | x 10..19, y 28..37 | Al norte de la maltería; asoma por encima de ella |
| Chimeneas `STACKS` | en fila detrás de la nave, aprox. (60, 34), (72, 28), (84, 34) | Ver §3.3 |
| Torre de enfriamiento | aprox. (40, 14), r 9 | Detrás, al oeste de las chimeneas |
| Subestación | aprox. x 54..95, y −2..11 | Al fondo, contra el desvío. Se mueve entera, con cerco y portón |
| Playa de camiones, cinta inclinada, tolva, pallets, faroles | y 76..98, delante de la fachada sur | La cinta sube por la fachada sur como hoy |

### 2.3 Lo que va a la banda vieja

La banda norte que deja la fábrica (aprox. x 0..195, y −60..−12, sin tocar el
desvío ni la grúa torre) recibe:

- las **dos naves de montaje** (90 × 16 cada una, separadas 4), por ejemplo
  x 10..100, y −52..−16, con sus autoelevadores;
- los **talleres** (dos de 24 × 14, techo escalonado, equipos en el techo);
- el **patio de material** con sus cilindros y secciones prefabricadas.

Altura máxima en la banda: la de los vecinos (h ≤ 22). Nada pisa el desvío,
los vagones ni la grúa.

### 2.4 Lo que se va

- La **cinta transportadora** larga (fábrica → patio de material): ya no
  conecta nada. Se elimina, incluido el tramo x 121..123.
- El **ramal `SPUR_Y`**, el **ramal embutido en la calle** al norte de
  y 96 y las chatas sobre él: servían al patio de material. La vía del oeste
  (`RAIL_Y = [131, 134]`) termina en x 104 como hoy. La estación
  (`2026-10-27-estacion-terminal-design.md`) la prolonga después.
- Los **rieles nave→grada** (y 40/47/60/67, x 98..110): las naves ya no están
  al lado de las gradas.

La línea de producción del astillero que cuenta el docstring de
`shipyard.ts` (patio → nave → grada → río) se reescribe: las naves y el
patio quedan al norte, detrás de la fábrica.

## 3. Reglas

### 3.1 Cómo se mueve

- Todo lo de la fábrica está en coordenadas absolutas. Agregar a `src/iso/`
  un **`translate(solid, dx, dy)`** (y para acentos) con tests para cada
  `kind` con posición: `at` de prism, ramp, cylinder, cone, hull y wheel;
  `from`/`to` de beam; `footprint` de poly; `path` de strip; `tris` de
  ground. Alternativa válida: parametrizar los constructores por origen. El
  plan elige una de las dos y la usa en todas las piezas.
- Desplazamientos enteros, para que las caras que se tocan sigan exactas.
  Los tests de contacto de `factory.test.ts`, `maltings.test.ts` y
  `boiler-house.test.ts` se re-expresan relativos al origen nuevo, no con
  literales nuevos copiados.
- El orden de consumo del rng de `railYard` (acopios, selva) puede cambiar si
  aparecen obstáculos nuevos. Sigue siendo determinista.

### 3.2 Nave más corta

La nave pasa de 11 a **9 vanos** (de unas 76 u a unas 62 u). Las cuentas que
fijan los tests (12 pilastras, 20 tubos del zócalo, 22/11 columnas de
fachada) se recalculan a partir de la cantidad de vanos, no a mano. El resto
del inventario de `2026-10-24-fabrica-detalle-design.md` §5 (testero
escalonado, cuatro chimeneas metálicas, caperuzas, torre de escalera) sigue
igual. Si el plan encuentra una disposición que entre con 10 vanos, se
permite.

### 3.3 Chimeneas visibles

Las chimeneas quedan detrás (al norte) de la nave. Con la nave hasta y 44 y
la boca a z 25..29, una chimenea a 10 u al norte del muro norte se ve desde
z ≈ 7: más del 70 % del fuste, con las bandas de balizamiento. Regla:
**en la vista cover se ve al menos el 50 % de la altura de cada chimenea**,
verificado en la captura. El humo (`factory-anim.ts`) toma la boca de
`scene.stacks` y sigue solo.

### 3.4 Sin solapes

- Ningún sólido del complejo cruza los límites de §2.1.
- Ningún sólido de la banda vieja pisa el desvío, los vagones, la grúa ni el
  hinterland (patio de maniobras y < −72).
- Un test por cada vecindad nueva: planta ↔ playa de camiones, chimeneas ↔
  nave, subestación ↔ desvío, tanque ↔ maltería, naves ↔ talleres ↔ patio.

## 4. Lo que no cambia

- `LABEL_AT.portfolio = (66, −128)` (`src/main.ts:29-38`). Con la fábrica en
  el lugar nuevo, el rótulo ya no la tapa.
- `zoneFrame`, `zoneView`, `coverView`, `worldZoneAt`, el velo y los grupos
  de bloom por zona: las dos regiones son Portfolio (x < 344, y < 146).
- Acentos de la fábrica: `{amber 3, cyan 8, magenta 6}`
  (`portfolio-accents.test.ts:15`). Se mueven con sus piezas.
- Detalle arquitectónico y materiales de cada pieza.

## 5. Tests y documentación a actualizar

- `world.test.ts:89-94` (sólidos de la fábrica con max.y ≤ 4 o max.x ≤ 0):
  reemplazar por las cotas de §2.1 y de la banda vieja.
- `factory.test.ts`, `maltings.test.ts`, `boiler-house.test.ts`,
  `substation` (en `factory.test.ts:396-600`): huellas, portón, farol, tanque,
  caja de profundidad y cerco, relativos al origen nuevo (§3.1).
- `shipyard.test.ts`: las naves y los talleres en la banda vieja (sus tests
  de techo escalonado, equipos y autos siguen pasando); los rieles y ramales
  que se van (§2.4).
- Storybook (`src/lab/exhibits.ts`, `exhibits.test.ts`): cajas de `planta`,
  `chimeneas`, `subestacion`, `playa-camiones`, `naves` y `tanque-agua`. El
  exhibit `cinta` se elimina o pasa a mostrar la cinta inclinada (anotarlo).
  `CATALOG` se actualiza. El test "vecinos" (`exhibits.test.ts:107`) sigue
  pasando con las cajas nuevas.
- `docs.test.ts:77-100` y documentación: README (párrafo de la fábrica),
  docstrings de `factory.ts` ("Banda norte…") y de `shipyard.ts` (línea de
  producción), comentarios de exhibits. En `2026-10-24-fabrica-detalle-design.md`,
  una nota al tope de §2 que remita a este spec.

## 6. Verificación visual

- Capturas **antes/después** de la vista cover del sitio
  (`http://localhost:5173/`, 1600×900 a 2x) y de los exhibits `planta`,
  `chimeneas`, `subestacion`, `naves`, en
  `docs/superpowers/specs/assets/2026-10-27-fabrica-mudanza/`.
- En la vista cover, la fábrica se lee entera: fachada sur de la nave,
  cabecera de la maltería, chimeneas con bandas y humo, y el rótulo
  PORTFOLIO no la tapa.
- Tabla de caras por exhibit antes/después (panel del storybook). La
  mudanza no debería sumar caras; la nave corta resta. Delta total anotado
  en el PR.

## 7. Criterios de aceptación

- [ ] `npm run typecheck` y `npm test` pasan.
- [ ] `translate` (o constructores con origen) con tests por `kind`.
- [ ] Complejo dentro de §2.1; galpones, talleres y patio en la banda vieja; tests de vecindad (§3.4).
- [ ] Chimeneas con ≥ 50 % visible en la vista cover; el humo sale de sus bocas.
- [ ] Cinta larga, ramales y rieles nave→grada eliminados; la vía del oeste termina en x 104.
- [ ] Storybook, README, docstrings y `docs.test.ts` al día.
- [ ] Capturas antes/después y tabla de caras en el PR y en `assets/2026-10-27-fabrica-mudanza/`.
- [ ] Sección "Desvíos" al final de este spec.

## 8. Fuera de alcance

- La estación y la prolongación de la vía del oeste
  (`2026-10-27-estacion-terminal-design.md`, ticket aparte, que depende de
  este).
- Rediseñar la calderería del astillero (marca 5): la reemplaza la estación.
- Rendimiento del bloom (#229).

## 9. Desvíos

Lo que cambió al implementar respecto de lo escrito arriba. Cada viñeta cita
el issue hijo donde está la decisión (#241–#247; este cierre es #248).

### 9.0 Lista

- **§2.4, ramal embutido (#242):** el ramal de la calle se eliminó entero, no
  solo al norte de y 96 (decisión de la spec de la estación). La vía del oeste
  termina en x 104 como hoy.
- **§3.2, nave (#243):** 63 u (9 vanos de 7), no "unas 62".
- **§2.2, tanque (#246):** en (15, 32), no en x 10..19, y 28..37.
- **§2.2, chimeneas (#245):** en (58, 32), (72, 26) y (86, 32), no en
  (60, 34), (72, 28) y (84, 34).
- **§2.2, torre de enfriamiento (#245):** en (40, 14).
- **§2.2, subestación (#244):** x 54..95, y −2..11.
- **§5, storybook (#242, #246):** el exhibit `cinta` se eliminó (no se
  reconvirtió a la cinta inclinada) y `planta` ya no incluye el tanque, que
  queda solo en `tanque-agua`.
- **§3.1, cómo se mueve (#241, #244, #246):** se eligió `translate` (marco
  local más desplazamiento) y no constructores con origen.
  `PLANT_SHIFT = (−15, +90)` está en `plant-frame.ts` y
  `SUBSTATION_SHIFT = (−95, +58)` en `substation.ts`.
- **Orden de los hijos (#242–#247):** entre #242 y #247 la rama queda sin
  galpones; es un estado intermedio de la historia, no de `main`. Los hijos
  van en orden.
- **§2.3, patio de material (#247):** su borde norte llega a y −58.62
  (el issue de #247 decía −58).
- **Farol (#246, PR #266):** el farol de (5, 76) entra en la caja de `planta`.
- **§3.3, chimeneas visibles (#245, medido en #248):** la chimenea de (86, 32)
  se ve entera (100 %), no el 86 % que suponía el issue; ver §9.2.

### 9.1 Caras por exhibit

Medido con `readout` de `src/lab/crop.ts` sobre `assembleWorld(undefined,
{ reducedMotion: false })`, el mismo número que muestra el panel del
storybook. Caja = ancho × fondo × alto de los sólidos recortados.

| exhibit | caja antes | sólidos antes | caras antes | caja después | sólidos después | caras después |
|---|---|---|---|---|---|---|
| `planta` | 120.4×48.6×26.1 | 221 | 1972 | 93.0×43.3×26.0 | 164 | 1652 |
| `chimeneas` | 69.2×40.0×35.8 | 463 | 1637 | 76.7×144.2×36.2 | 533 | 1830 |
| `subestacion` | 43.4×18.2×35.8 | 364 | 1212 | 46.6×17.4×35.8 | 362 | 1207 |
| `playa-camiones` | 183.0×158.0×20.4 | 58 | 523 | 90.6×15.0×13.5 | 21 | 63 |
| `naves` | 102.0×142.0×13.9 | 15 | 33 | 90.0×36.0×13.5 | 6 | 20 |
| `cinta` | 254.0×162.0×26.0 | 61 | 535 | — | — | — |
| `tanque-agua` | 63.5×39.4×26.7 | 46 | 165 | 63.5×39.4×26.7 | 46 | 165 |

Total de caras, sin `tanque-agua`: antes 5912, después 4772, **delta −1140**.
La mudanza no suma caras: restan la nave de 9 vanos y el exhibit `cinta`.

Notas:

- Cada columna usa la caja de exhibit de su propio árbol. "Antes" es
  `origin/main` (a34dec0, que incluye las costas de #237, no presentes en la
  rama de la historia); "después" es esta rama. La fila `tanque-agua` es
  informativa: no cambia, y el tanque entra en `planta` solo en parte.
- Cajas de los exhibits `{x0, y0, x1, y1}` h, antes → después:
  `planta` {2, −49, 126, −14} h 26 → {2, 41, 98, 76} h 26;
  `chimeneas` {124.2, −70.8, 184, −24} h 36 → {28, −4.8, 104.8, 39} h 36;
  `subestacion` {146, −63, 193, −46} h 13 → {51, −5, 98, 12} h 13;
  `playa-camiones` {17, −15, 113, 2} h 22 → {2, 76, 98, 92} h 16;
  `naves` {5, 33, 101, 75} h 14 → {7, −55, 102, −14} h 14;
  `cinta` {28, −15, 125, 4} h 22 → eliminado.
- `chimeneas` después mide 144 de fondo (y −2.1..142) porque la caja llega a
  x1 = 104.8 (x 86 + `stackR` 2.8, el mayor radio, de la chimenea de x 58, +
  margen 3 + 13 de deriva del humo) y corta la calle de transferencia
  (x 100..108, a lo largo de y). `cropSolid` conserva el
  sólido entero, así que la caja de sólidos se estira. Es solo del recorte:
  no cambia las caras de la fábrica.
- `subestacion` da 362/1207 y no 361/1200 como en #261 (medido en d1f393e).
  Los sólidos estáticos bajan de 361 a 358 (salen la viga de la cinta
  inclinada (50, −4), el camión (70, −6) y un prisma `steel` (76, −6) de la
  playa de camiones vieja, mudados en #246). La capa animada suma 4 sólidos y
  16 caras (las bocanadas de la chimenea de (86, 32), #245, que derivan al
  NNE dentro de la caja). Sin animación: 358/1191; con animación: 362/1207.
  El `readout` incluye la capa animada.

### 9.2 Chimeneas en la cover

Medido con `coverView(1600, 900)` (escala 1.4904, origen x 625.63,
y 157.14). Altura total = `STACK_BASE_H` + h. El oclusor es el alero norte
de la nave (y 43.4, z 14), calculado en forma analítica; "z visible desde" es
la altura a la que el fuste sale de atrás del oclusor.

| (cx, cy) | oclusor | z visible desde | fracción | altura visible (px CSS) |
|---|---|---|---|---|
| (58, 32) | alero norte | 5.86 | 76.6 % | 39.9 |
| (72, 26) | alero norte | 1.57 | 94.6 % | 57.2 |
| (86, 32) | ninguno | 0 | 100 % | 56.3 |

Las tres cumplen el mínimo de 50 % de §3.3, y las bocas y bases quedan dentro
de 0..1600 × 0..900. La tercera chimenea no sale con el 86 % que esperaba el
issue (que suponía el testero ocultándola hasta z ≈ 4, sin verificarlo): su
sx de 54 queda fuera del rango del alero (−14.4..48.6), el testero (x 92..93,
y 44..74) cubre sx ≤ 49 y la torre de escalera (x 93..98, y 56..64) cubre sx
29..42, así que ninguno la tapa. Un rayo hacia la cámara desde (86, 32) cruza
x = 92 en y = 38, antes de que empiece la nave (y 44).

Lo que se ve en `cover-despues.png` (recorte ampliado incluido):

- Las tres chimeneas, con las bandas rojo y blanco y las balizas magenta de
  las bocas, en la posición proyectada (≈ 664..706, 172..189 CSS en las
  bocas). La tercera se ve entera hasta el plinto, con la calle delante.
- El humo sale de las bocas: bocanadas de prismas hexagonales grises
  (`cylinder` de 6 lados, `concrete`, `factory-anim.ts`) que derivan al NNE
  (arriba a la derecha en pantalla).
- El rótulo PORTFOLIO, en `LABEL_AT.portfolio` (66, −128, 0) → pantalla CSS
  (914.8, 110.9), queda sobre el patio de galpones y tanques del noreste y no
  tapa la fábrica.
- La fachada sur de la nave y la cabecera de ladrillo de la maltería, a la
  izquierda de la nave, se leen.
- Sin errores en la consola de las once páginas capturadas.

### 9.3 Capturas

En `assets/2026-10-27-fabrica-mudanza/`, a 1600×900 a 2x (3200×1800) para la
cover:

- Cover: [antes](assets/2026-10-27-fabrica-mudanza/cover-antes.png) y
  [después](assets/2026-10-27-fabrica-mudanza/cover-despues.png).
- `planta`: [antes](assets/2026-10-27-fabrica-mudanza/planta-antes.png) y
  [después](assets/2026-10-27-fabrica-mudanza/planta-despues.png).
- `chimeneas`:
  [antes](assets/2026-10-27-fabrica-mudanza/chimeneas-antes.png) y
  [después](assets/2026-10-27-fabrica-mudanza/chimeneas-despues.png).
- `subestacion`:
  [antes](assets/2026-10-27-fabrica-mudanza/subestacion-antes.png) y
  [después](assets/2026-10-27-fabrica-mudanza/subestacion-despues.png).
- `naves`: [antes](assets/2026-10-27-fabrica-mudanza/naves-antes.png) y
  [después](assets/2026-10-27-fabrica-mudanza/naves-despues.png).
- `cinta`, solo antes (el exhibit ya no existe):
  [antes](assets/2026-10-27-fabrica-mudanza/cinta-antes.png).

Las demás capturas de esa carpeta (`playa-camiones-*`, `mundo-*`,
`planta-9-vanos-*`, `vaciar-*`) son el registro intermedio de cada hijo.
