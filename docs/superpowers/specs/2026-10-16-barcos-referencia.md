# Barcos de referencia para el mapa isométrico

**Fecha:** 2026-10-16
**Estado:** documento de referencia; las secciones de estilo se completan por tareas
**Issues:** #57 (flota de barcos del mapa) y #59 (este documento). Lo consumen #60, #61 y #62 para remodelar cada barco.
**Alcance:** reunir, para cada estilo de barco, los datos reales, los enlaces a fotos de referencia, los rasgos de silueta y una traducción a la escala y al kit del mapa. No cambia código.

Este documento es solo de enlaces: no se copia ninguna imagen al repositorio. Cada foto se cita con la URL de su página de origen y una descripción de qué ángulo muestra y qué se puede medir en ella.

## Escala y caja

- **Escala:** 1 u ≈ 1.5 m. Un barco de 90 m de eslora ocupa 60 u. La eslora real se divide por 1.5 salvo donde se aclare otra cosa.
- **Caja de una ruta:** 60 u de eslora total (incluido el empujador en el caso de `barge`), 10 u de manga y ningún sólido por encima de z = 13.
- **Agua:** z = −1. La cubierta queda en z = −1 + h, donde h es el parámetro de altura del casco en el kit. Las alturas se miden desde el agua, no desde z = 0.
- **Altura:** cuando el calado aéreo real supera unos 21 m (z = 13 equivale a 14 u sobre el agua, es decir 21 m), se comprime para entrar en la caja. Cada sección de estilo dice qué se comprimió y cuánto.
- **Objetivos por barco:** `cargo` 60 × 10 u, `tug` 19 × 7 u, `barge` 40 × 8 u de barcaza más empujador de 20 × 7 u (60 u en total).
- **Coordenadas locales de las piezas:** x crece de popa a proa (la popa está en 0), y crece hacia estribor. El kit rota esas coordenadas por el rumbo (`heading`) del barco.

### Proyección y caras visibles

`src/iso/project.ts` proyecta un punto del mundo (x este, y sur, z arriba) así:

- `xs = x − y`
- `ys = (x + y) / 2 − z · Z_SCALE`, con `Z_SCALE = 1.4`

La cámara mira desde la dirección `VIEW_DIR = normalize(1.4, 1.4, 1)`, y `tessellate` descarta toda cara cuya normal no tenga producto punto positivo con ella. Con esa dirección solo se ven tres caras de un sólido alineado a los ejes: la superior, la que mira a +x y la que mira a +y. Las caras que miran a −x y a −y nunca se ven.

Para un barco con rumbo 0 (local = mundo) eso significa que se ve la cubierta, la cara de proa (+x) y la de estribor (+y); la popa y el costado de babor quedan ocultos. Con otro rumbo cambia qué extremo del casco da hacia la cámara. Para decidir qué detallar, conviene pensar en los lados que la cámara ve en cada ruta y no repartir el esfuerzo en partes ocultas.

Dos consecuencias para el modelado:

- La exageración vertical estira todo 1.4 veces en pantalla: una altura de 1 u pesa más en la imagen que 1 u de eslora. Las superestructuras bajas ya se leen bien; las altas se comprimen primero.

## Kit y materiales

El kit local es la interfaz `Kit` de `src/scenes/ships.ts`. Cada barco es una función `(k, spec, solids, lights)` que empuja piezas a dos listas. Firmas (coordenadas locales, rotadas por el rumbo):

- `hull(dx, len, beam, h, sheer, topMat)`: casco lofteado (`kind: "hull"`). La obra viva usa siempre el material `hull`; `topMat` pinta la obra muerta y la cubierta se pinta con `deck`. `sheer` es el arrufo. El anillo de cubierta es fijo (`DECK_RING` en `src/iso/solids.ts`): popa redondeada, manga máxima al 57 % de la eslora, proa en punta. No se puede cambiar el contorno desde el kit.
- `box(dx, dy, w, d, z, h, mat, facade?)`: caja con huella rectangular. Produce un sólido `poly` (`kind: "poly"` con huella de cuatro puntos, no un `prism`), con fachada opcional (`Facade`: filas, columnas y ventana) en las paredes. `z` es la altura de la base, `h` el alto.
- `cyl(dx, dy, z, r, h, mat)`: cilindro de 8 lados (`kind: "cylinder"`).
- `dot(dx, dy, z, r, color)`: luz puntual, un acento.
- `poly(pts, color, alpha)`: polígono plano translúcido de color de acento. Es un acento, no un sólido, y no cuenta contra el presupuesto de sólidos. Los barcos actuales lo usan para las ventanas encendidas del puente.

`prism` y `cone` existen como sólidos en `src/iso/solids.ts` (`prism` con techo plano, a dos aguas o escalonado; `cone` de `sides` lados, 6 por defecto), pero el `Kit` no los expone. Una tarea que los necesite agrega un helper al kit; no está resuelto en este documento. Las secciones de estilo pueden citarlos en las piezas sugeridas, con la salvedad de que requieren ese helper.

### Presupuesto

Decisión 3 de #57: hasta 40 sólidos y 8 luces por barco. En `barge` el límite cubre la barcaza y el empujador juntos. El casco cuenta como un sólido. Los `poly` de acento cuentan como luces.

### Materiales (`ISO_TONES`)

La lista de materiales es `ISO_TONES` en `src/map/palette-iso.ts`; el tipo `Material` es `keyof typeof ISO_TONES`. No existe `ISO_MATERIALS`, aunque el issue use ese nombre. Cada material tiene cinco tonos (`top`, `lit`, `shade`, `up`, `down`) y los sólidos los eligen por la normal de cada cara. Hoy los barcos usan los siete de `SHIP_MATS`: `hull`, `hullBlue`, `whitewash`, `steel`, `rust`, `deck` y `glass`. Los demás del atlas que sirven para barcos:

- `hull`: obra viva del casco (rojo oxidado oscuro). El kit lo fija; no se elige.
- `hullBlue`: obra muerta azul de cascos y amuradas; también castillos de proa.
- `deck`: cubierta de madera o pintada; la aplica el casco solo.
- `whitewash`: superestructura blanca, puentes, casetas.
- `glass`: ventanas, puente acristalado; también como `base` de una fachada.
- `steel`: grúas, mástiles, cruceta, tapas de chimenea, barandas.
- `rust`: chimeneas, escotillas, tolvas, defensas; barcazas oxidadas.
- `concrete`: carga cubierta, lastre o bloques; gris cálido.
- `copper`: verdín de cubierta; instalaciones pintadas de verde azulado.
- `foam`: espuma y detalles claros chicos (pinturas blancas apagadas, cabos, boyas).
- `slab`, `rail`: grises pardos de apoyo para piezas de carga o contenedores neutros.
- `brick`: ladrillo cálido; contenedores o cargas rojizas.
- `stone`, `sand`, `rock`: cargas a granel (áridos) en la barcaza.
- `curtain`, `office`, `officeDark`: azules y violetas fríos; contenedores de color o estructuras apagadas.
- `leaf`, `leafDark`: verde; contenedores o pintura verde (poco uso).

El agua (`shallow`, `water`, `waterDeep`, `abyss`) y `glint` no se usan en barcos. Las piezas sugeridas solo pueden nombrar claves de `ISO_TONES`.

### Acentos (`ACCENT_COLORS`)

Para luces y ventanas encendidas: `cyan`, `cyanMid`, `cyanBleed`, `amber`, `amberMid`, `amberBleed`, `magenta`, `magentaMid` y `magentaBleed`. Los acentos no se oscurecen con el crepúsculo, así los neones destacan sobre la escena. La convención actual de luces de navegación en los cuatro barcos:

- `magentaMid`: luz de tope, en el mástil o sobre el puente (punto de radio 0.7).
- `magenta`: luz de babor (punto de radio 0.4).
- `cyanMid`: luz de estribor (punto de radio 0.4).

La lancha de la feria (`ferry`) suma una `amber`. Los `magentaBleed` translúcidos de `poly` sirven para ventanas encendidas.

## `cargo` — Damen Combi Freighter 3850

- **Astillero/clase:** Damen Shipyards (Países Bajos), Combi Freighter 3850; según la ficha, construido en Asia con garantía desde los Países Bajos. Carguero multipropósito de cabotaje con una sola bodega de caja y casa a popa; el diseño base no lleva grúas propias (ver Decisiones). Ficha del fabricante: https://www.damen.com/vessels/cargo/multi-purpose-cargo-vessels/combi-freighter-3850
- **Eslora:** 89.75 m · **Manga:** 12.50 m · **Altura sobre el agua:** ~22 m (estimada a ojo desde las fotos: cubierta principal a ~4.5 m del agua, casa de cuatro niveles con puente más palo de radar, ~15.5 m sobre cubierta; el fabricante no publica el calado aéreo) · **Calado:** 5.48 m · **Bodega:** 62.5 × 10.1 m, 8.4 m de alto, 5250 m³ · **Porte:** 3800 t · **Velocidad:** 11.8 kn
- **Caja en mapa:** 60 × 10 u · **Altura máx.:** z = 12

### Fotos

Los buques son gemelos de la clase: están todos bajo `Category:Damen Combi Freighter 3850` de Commons (por IMO). La foto de *Birgit G.* en Bilbao lo dice en su descripción ("Damen Combi Freighter 3850 Birgit G."). Para los demás buques se confirmó la pertenencia por la categoría de IMO. No encontré en Commons una foto aérea (dron) de esta clase; la "cenital" es la toma más alta que existe, desde un muelle elevado.

| Ángulo | Buque | Enlace | Qué se ve |
| --- | --- | --- | --- |
| perfil | Birgit G. (IMO 9536064) | https://commons.wikimedia.org/wiki/File:9536064_Birgit_G_2010.jpg | Perfil casi puro de babor en el Korsfjorden, navegando. Casa y puente a popa con el puente en el nivel más alto, bodega larga y lisa con tapas, mástil blanco en la proa, casco azul con obra viva rojiza. Sirve para medir proporciones: la casa ocupa ~17 % de la eslora y la bodega ~70 %. |
| proa | Haringvliet (IMO 9625229) | https://commons.wikimedia.org/wiki/File:Haringvliet_-_IMO_9625229,_Boudewijnsluis,_Port_of_Antwerp_pic_1.JPG | Proa casi de frente, apenas girada por babor, entrando en la esclusa. Se ven la roda alta con los escobenes, la amurada blanca, el castillo con el mástil de proa y, sobre la bodega, el pórtico rojo delante de la casa blanca con puente y mástil. Sirve para medir la altura de la casa contra el castillo. |
| proa | Tucana (IMO 9455674) | https://commons.wikimedia.org/wiki/File:Tucana_ship_R05.jpg | Proa casi de frente, amarrado en el puerto de Brujas. Se ven los dos escobenes con óxido, la línea blanca de la amurada, el castillo gris con la baranda y, detrás, la casa de popa con el puente de techo rojo, domo y mástil de radar. Las fotos R01 a R04 de la misma serie muestran el mismo barco girando hacia esta toma. |
| popa | Helas (IMO 9195743) | https://commons.wikimedia.org/wiki/File:Helas_%28ship,_2001%29_IMO_9195743,_Ijmuiden_pic2.JPG | Casi de popa, con poca luz y mar picado, desde la entrada de IJmuiden. Se ve la casa de popa con el puente de techo naranja y la baranda, el pórtico delante, la bodega de coaming oscuro y, lejos, el castillo con el mástil de proa. Sirve para el ancho de la casa respecto de la manga. |
| tres cuartos | Tucana (IMO 9455674) | https://commons.wikimedia.org/wiki/File:Tucana_%28IMO_9455674%29_River_Mersey.jpg | Tres cuartos de proa por babor, navegando con ola de proa. Se lee todo el conjunto: proa en V con castillo y mástil, tapas grises planas sobre un coaming rojo, pórtico delante de la casa, bote naranja con pescante en babor, casa blanca con puente de techo rojo, domo y mástil de radar. |
| cenital | Birgit G. (IMO 9536064) | https://commons.wikimedia.org/wiki/File:Birgit_G._%28IMO_9536064%29_Bilbao_2022.jpg | Toma alta (unos 40° sobre el horizonte, desde una cota elevada del puerto de Bilbao) de la popa y el costado de estribor, amarrado con la proa a la derecha. Deja ver el techo de la casa, los niveles y pasamanos, el coaming rojo y, en el extremo de proa de la bodega, el pórtico móvil con las tapas apiladas. Es lo más parecido a una vista desde arriba que hay para esta clase. |
| tres cuartos | Eems Dart (IMO 9195640) | https://commons.wikimedia.org/wiki/File:Eems_Dart_-_IMO_9195640_leaving_Berendrechtsluis,_Port_of_Antwerp_pic4.JPG | Tres cuartos de popa por babor, de cerca, en la esclusa de Berendrecht. La casa se ve de costado con sus niveles y escaleras exteriores, el bote naranja con pescante en babor, dos escapes sobre el techo, el mástil de radar y, a la izquierda, el coaming rojo de la bodega con el pórtico. |
| tres cuartos | Eems Dart (IMO 9195640) | https://commons.wikimedia.org/wiki/File:Eems_Dart_-_IMO_9195640_leaving_Berendrechtsluis,_Port_of_Antwerp_pic5.JPG | Tres cuartos de popa por babor, navegando. Muestra el largo de la bodega con su coaming rojo y la barandilla azul de la amurada, la casa con el pórtico delante, el bote naranja en babor y el castillo gris con el mástil de proa pequeño al fondo. Útil para la proporción popa-proa. |
| tres cuartos | Eems Dart (IMO 9195640) | https://commons.wikimedia.org/wiki/File:Eems_Dart_-_IMO_9195640_leaving_Berendrechtsluis,_Port_of_Antwerp_pic1.JPG | Tres cuartos de proa por babor, entrando en la esclusa. La roda alta y el castillo gris con el mástil de proa, la línea de amurada blanca y la casa de popa con puente y mástil. Sirve para ver la altura de la casa contra la del castillo. |

### Rasgos de silueta

- Casa de popa de tres niveles blancos más un puente que sobresale con alerones a ambos lados; es lo que da la silueta y ocupa solo el 15-17 % final de la eslora.
- Puente con techo azul o rojo (según el armador), baranda perimetral, mástil de radar con cruceta y un domo o antena blanca; en el techo de la casa van uno o dos escapes cortos (no hay chimenea alta).
- Una sola bodega larga (62.5 m, ~70 % de la eslora) con coaming rojizo elevado y tapas grises planas.
- Grúas: ninguna en el barco (diseño base sin aparejo propio, según la ficha y las fotos; las grúas que aparecen en las fotos son de muelle). El pedido del issue pide grúas de cubierta, así que quedan como piezas opcionales: dos, a una sola banda (estribor), sobre pedestal.
- Pórtico móvil de acero (rojo en *Haringvliet*) para manejar las tapas de bodega: corre sobre el coaming, normalmente estacionado delante de la casa o, como en *Birgit G.* en Bilbao, en el extremo de proa de la bodega.
- Castillo de proa bajo y gris con una baranda, y un mástil blanco con cruceta detrás; la roda es alta y en V, con dos escobenes con óxido.
- Casco azul de obra muerta con una línea blanca en el borde de la amurada y obra viva roja o marrón; la amurada de la bodega es una barandilla de tubos azul, no una chapa cerrada.
- Bote salvavidas naranja con pescante amarillo en babor, a la altura del segundo nivel de la casa, y los cabos de amarre en pasacables en proa y popa.
- Bulbo de proa bajo el agua: no se ve, pero la roda tiene mucha curva y la ola de proa sale más adelante del casco.

### Traducción a la escala del mapa

- **Casco:** 60 × 10 u, `h` 5, arrufo 0.25. La manga real es 12.5 m (8.3 u); se estira a 10 u para llenar la caja. La cubierta queda en z = 4 (5 u sobre el agua, 7.5 m; real ~4.5 m, se exagera para que el casco se lea con la proyección).
- **Altura:** el calado aéreo real (~22 m) excede los 21 m que entran en z = 13, así que las alturas sobre la cubierta se comprimen. Real sobre cubierta ~15.5 m; en el mapa ~8 u (z 4 a z 12). Factor ≈ 0.77 sobre la escala de 1.5 m/u (cada u de altura sobre la cubierta vale ~1.9 m).
- **Casa (x 3 a 12):** tres niveles de 1.4 u (z 4 a 8.2), cada uno un poco más angosto (huella 9 × 7, 8 × 5.4, 7 × 4.8 u); puente en x 6.5 a 10.5, 8 u de ancho con alerones (y ±4), z 8.2 a 9.7; techo en z 9.7 a 9.9.
- **Bodega (x 14 a 52):** 38 u (real 41.7 u; se acorta para dejar sitio a la casa y al castillo), 6.8 u de ancho (hueco real 10.1 m = 6.7 u), coaming rojo de 1 u (z 4 a 5) con tres tapas grises encima (z 5 a 5.3).
- **Pórtico móvil (x 12.5 a 13.5, estacionado a proa de la casa):** dos patas de 0.5 × 0.5 u en y ±3, 2.5 u de alto, con una pasarela arriba (z 6.5 a 6.8).
- **Castillo (x 53 a 57):** bloque gris de 1.6 u de alto (z 4 a 5.6), mástil de proa 5.4 u (z 5.6 a 11) con cruceta en z 9.5, cabrestante en la proa.
- **Mástil de radar:** sobre el techo del puente, 2.1 u (z 9.9 a 12), cruceta en z 11. Es el punto más alto: z = 12.
- **Amurada:** barandilla azul de 0.8 u en ambos bordes, x 12 a 38, que es el tramo recto de la cubierta. Más allá la cubierta se afina (popa redondeada y proa en punta) y la barandilla no cabe.
- **Lados visibles:** con rumbo 0 se ven la cubierta, la proa (+x) y el costado de estribor; la popa con la casa queda de espaldas, así que su techo y sus costados pesan más que su cara de popa. Detallar primero el puente y la casa (a popa) y la bodega con sus tapas; el castillo de proa pesa poco.
- **Luces:** tope sobre el mástil de radar (x 8, z 11.6), babor y estribor en los alerones (y ±4, z 9.2), segunda luz de tope en el mástil de proa y ventanas encendidas en la cara de proa del puente (x 10.52).

### Piezas sugeridas (por importancia)

1. `hull` · `hullBlue` — casco 60 × 10, h 5, arrufo 0.25
2. `box` · `whitewash` — casa, nivel 1: dx 3, dy −3.5, w 9, d 7, z 4, h 1.4, fachada 1 piso y 4 columnas
3. `box` · `whitewash` — casa, nivel 2: dx 3.5, dy −2.7, w 8, d 5.4, z 5.4, h 1.4, fachada 1 piso y 4 columnas
4. `box` · `whitewash` — casa, nivel 3: dx 4, dy −2.4, w 7, d 4.8, z 6.8, h 1.4, fachada 1 piso y 3 columnas
5. `box` · `whitewash` — puente con alerones: dx 6.5, dy −4, w 4, d 8, z 8.2, h 1.5, fachada de 1 piso con `base: "glass"` y 4 columnas
6. `box` · `rust` — coaming de la bodega: dx 14, dy −3.4, w 38, d 6.8, z 4, h 1
7. `box` · `steel` — tapa 1: dx 14.2, dy −3.2, w 12.4, d 6.4, z 5, h 0.3
8. `box` · `steel` — tapa 2: dx 26.8, dy −3.2, w 12.4, d 6.4, z 5, h 0.3
9. `box` · `steel` — tapa 3: dx 39.4, dy −3.2, w 12.4, d 6.4, z 5, h 0.3
10. `box` · `steel` — castillo de proa: dx 53, dy −3, w 4, d 6, z 4, h 1.6
11. `box` · `steel` — mástil de radar: dx 8, dy −0.2, w 0.4, d 0.4, z 9.9, h 2.1
12. `box` · `steel` — cruceta del mástil de radar: dx 7.5, dy −1.5, w 0.4, d 3, z 11, h 0.25
13. `box` · `steel` — techo del puente: dx 6.3, dy −4.2, w 4.4, d 8.4, z 9.7, h 0.2
14. `cyl` · `steel` — escape de babor: dx 4.8, dy −1, z 8.2, r 0.5, h 1.8
15. `cyl` · `steel` — escape de estribor: dx 4.8, dy 1, z 8.2, r 0.5, h 1.8
16. `box` · `rust` — bote salvavidas naranja, a babor: dx 6, dy −3.6, w 3, d 0.9, z 5.4, h 0.9
17. `box` · `steel` — pata de babor del pórtico: dx 12.5, dy −3.2, w 0.5, d 0.5, z 4, h 2.5
18. `box` · `steel` — pata de estribor del pórtico: dx 12.5, dy 2.7, w 0.5, d 0.5, z 4, h 2.5
19. `box` · `steel` — pasarela del pórtico: dx 12.4, dy −3.5, w 1, d 7, z 6.5, h 0.3
20. `box` · `steel` — mástil de proa: dx 52, dy −0.2, w 0.4, d 0.4, z 5.6, h 5.4
21. `box` · `steel` — cruceta del mástil de proa: dx 51.6, dy −1.5, w 0.3, d 3, z 9.5, h 0.25
22. `cyl` · `steel` — cabrestante: dx 55, dy 0, z 5.6, r 0.6, h 0.6
23. `box` · `hullBlue` — barandilla de babor: dx 12, dy −5, w 26, d 0.3, z 4, h 0.8
24. `box` · `hullBlue` — barandilla de estribor: dx 12, dy 4.7, w 26, d 0.3, z 4, h 0.8
25. `dot` · `magentaMid` — luz de tope: dx 8, dy 0, z 11.6, r 0.7
26. `dot` · `magenta` — luz de babor en el alerón: dx 10, dy −4, z 9.2, r 0.4
27. `dot` · `cyanMid` — luz de estribor en el alerón: dx 10, dy 4, z 9.2, r 0.4
28. `dot` · `magentaMid` — luz de tope de proa, en el mástil: dx 52.2, dy 0, z 10.7, r 0.5
29. `poly` · `magentaBleed` — ventanas encendidas del puente, cara de proa: puntos (10.52, −3.6, 8.9), (10.52, 3.6, 8.9), (10.52, 3.6, 9.5), (10.52, −3.6, 9.5), alfa 0.8
30. `cyl` · `steel` — opcional: solo si #60 decide seguir el pedido del issue (grúa 1, pedestal en estribor): dx 20, dy 4, z 4, r 0.45, h 3
31. `box` · `steel` — opcional (grúa 1, pluma hacia popa): dx 20, dy 3.8, w 7, d 0.4, z 6.6, h 0.4
32. `cyl` · `steel` — opcional (grúa 2, pedestal en estribor): dx 34, dy 4, z 4, r 0.45, h 3
33. `box` · `steel` — opcional (grúa 2, pluma hacia popa): dx 34, dy 3.8, w 7, d 0.4, z 6.6, h 0.4

## `tug` — Damen ASD Tug 2810

Sección a completar en la tarea 3 del plan.

## `barge` — Empujador fluvial de tres cubiertas con barcaza tolva Jumbo Mississippi

Sección a completar en la tarea 4 del plan.

## Decisiones

Heredadas del plan de #57:

- `cargo` pasa a ser el Damen Combi Freighter 3850 y reemplaza al carguero genérico actual.
- `tug` pasa a ser el Damen ASD Tug 2810.
- `barge` pasa a ser un empujador fluvial con una barcaza tolva Jumbo del Mississippi. La barcaza va por delante y el empujador queda apoyado contra su popa, como en la operación real.
- `cargo`: fotos de *Birgit G.* (IMO 9536064), *Tucana* (IMO 9455674) y *Eems Dart* (IMO 9195640), todos de la categoría de Commons `Damen Combi Freighter 3850` (gemelos, sin sustituir de clase; no se encontró una foto aérea, la cenital es una toma alta desde el muelle). Compresiones para la caja: manga 12.5 m a 10 u (×1.2), bodega de 41.7 u a 38 u, alturas sobre cubierta ×0.77 para no pasar de z = 12; no se modelan bulbo ni anclas.
- `cargo` y las grúas: el issue #59 pide un carguero "con grúas propias" y el plan de #57 habla de "dos grúas de cubierta a una banda", pero el Damen CF 3850 base no las lleva (ficha del fabricante y fotos; las grúas que se ven en las fotos son de muelle). Se mantiene el CF 3850, porque el tipo lo fija el issue. El modelo por defecto sigue la referencia y no lleva grúas; las piezas 30 a 33 las agregan como opción de menor prioridad (dos grúas en estribor, dentro del tope de 40 sólidos) si #60 decide priorizar el pedido del issue.
- `cargo` y la foto de proa: hay dos tomas de proa casi de frente, *Haringvliet* (IMO 9625229, también de la categoría de la clase) y *Tucana*; ninguna es perfectamente axial.
- Los identificadores de `ShipKind` (`cargo`, `tug`, `barge`, `ferry`) se mantienen, para no tocar las rutas ni la animación.
