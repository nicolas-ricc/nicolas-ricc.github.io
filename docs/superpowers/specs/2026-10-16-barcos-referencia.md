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

- **Astillero/clase:** Damen Shipyards (Países Bajos), Combi Freighter 3850; según la ficha, construido en Asia con garantía desde los Países Bajos. Carguero multipropósito de cabotaje con una sola bodega de caja y casa a popa; en las fotos no se ven grúas propias y la ficha no las lista (ver Decisiones). Ficha del fabricante: https://www.damen.com/vessels/cargo/multi-purpose-cargo-vessels/combi-freighter-3850
- **Eslora:** 89.75 m · **Manga:** 12.50 m · **Altura sobre el agua:** ~22 m (estimada a ojo desde las fotos: cubierta principal a ~4.5 m del agua, casa de cuatro niveles con puente más palo de radar, ~15.5 m sobre cubierta; el fabricante no publica el calado aéreo) · **Calado:** 5.48 m · **Bodega:** 62.5 × 10.1 m, 8.4 m de alto, 5250 m³ · **Porte:** 3800 t · **Velocidad:** 11.8 kn
- **Caja en mapa:** 60 × 10 u · **Altura máx.:** z = 12

### Fotos

Los buques son gemelos de la clase: están todos bajo `Category:Damen Combi Freighter 3850` de Commons (por IMO). La foto de *Birgit G.* en Bilbao lo dice en su descripción ("Damen Combi Freighter 3850 Birgit G."). Para los demás buques se confirmó la pertenencia por la categoría de IMO. No encontré en Commons una foto aérea (dron) de esta clase; la "cenital" es la toma más alta que existe, desde un muelle elevado.

| Ángulo | Buque | Enlace | Qué se ve |
| --- | --- | --- | --- |
| perfil | Birgit G. (IMO 9536064) | https://commons.wikimedia.org/wiki/File:9536064_Birgit_G_2010.jpg | Perfil casi puro de babor en el Korsfjorden, navegando. Casa y puente a popa con el puente en el nivel más alto, bodega larga y lisa con tapas, mástil blanco en la proa, casco azul con obra viva rojiza. Sirve para medir proporciones: la casa ocupa ~17 % de la eslora y la bodega ~70 %. |
| proa | Haringvliet (IMO 9625229) | https://commons.wikimedia.org/wiki/File:Haringvliet_-_IMO_9625229,_Boudewijnsluis,_Port_of_Antwerp_pic_1.JPG | Proa casi de frente, apenas girada por babor, entrando en la esclusa. Se ven la roda alta con los escobenes, la amurada blanca, el castillo con el mástil de proa y, sobre la bodega, el pórtico rojo delante de la casa blanca con puente y mástil. Sirve para medir la altura de la casa contra el castillo. |
| proa | Tucana (IMO 9455674) | https://commons.wikimedia.org/wiki/File:Tucana_ship_R05.jpg | Proa casi de frente, amarrado en el puerto de Brujas. Se ven los dos escobenes con óxido, la línea blanca de la amurada, el castillo gris con la baranda y, detrás, la casa de popa con el puente de techo rojo, domo y mástil de radar. Las fotos R01 a R04 de la misma serie son del mismo barco amarrado, tomadas desde otros puntos. |
| perfil | Helas (IMO 9195743) | https://commons.wikimedia.org/wiki/File:Helas_%28ship,_2001%29_IMO_9195743,_Ijmuiden_pic2.JPG | Perfil de estribor, apenas oblicuo, con mar picado frente a IJmuiden, proa a la derecha. Se ven el castillo con borde rojo y el nombre HELAS, el mástil de proa con bandera neerlandesa, la bodega larga con coaming oscuro y, a la izquierda, la casa con el puente de techo naranja y un pórtico azul delante. |
| perfil | Haringvliet (IMO 9625229) | https://commons.wikimedia.org/wiki/File:Haringvliet_-_IMO_9625229,_Boudewijnsluis,_Port_of_Antwerp_pic_3.JPG | Costado de babor de la sección de popa, casi de través, con la proa fuera de cuadro a la izquierda. Se ven el pórtico rojo en el borde izquierdo, el bote naranja con pescante visto de largo, la pared lateral de la casa con puerta, ventanas y salvavidas, cuatro portillos y dos escobenes ovalados en la franja blanca, y la bandera neerlandesa en la popa a la derecha. No se ve el espejo de popa. |
| popa | Eems Exe (IMO 9195535) | https://commons.wikimedia.org/wiki/File:IMO_9195535_EEMS_EXE_%2802%29.jpg | Casi de popa, apenas girada, pasando bajo un puente levadizo abierto en Alblasserdam. Se ve el espejo de popa azul sobre obra viva roja con el nombre EEMS EXE, GIBRALTAR y el IMO, la cara de popa de la casa con sus niveles, pasamanos y escaleras, la caja anaranjada de los escapes sobre el techo, el bote naranja a la izquierda (babor), el mástil de radar con banderas y, bajo la casa, el coaming de la bodega. |
| tres cuartos | Tucana (IMO 9455674) | https://commons.wikimedia.org/wiki/File:Tucana_%28IMO_9455674%29_River_Mersey.jpg | Tres cuartos de proa por babor, navegando con ola de proa. Se lee todo el conjunto: proa en V con castillo y mástil, tapas grises planas sobre un coaming rojo, pórtico delante de la casa, bote naranja con pescante en babor, casa blanca con puente de techo rojo, domo y mástil de radar. |
| cenital | Birgit G. (IMO 9536064) | https://commons.wikimedia.org/wiki/File:Birgit_G._%28IMO_9536064%29_Bilbao_2022.jpg | Toma alta (unos 40° sobre el horizonte, desde una cota elevada del puerto de Bilbao) de la popa y el costado de estribor, amarrado con la proa a la derecha. Deja ver el techo de la casa, los niveles y pasamanos, el coaming rojo y, en el extremo de proa de la bodega, el pórtico móvil con las tapas apiladas. Es lo más parecido a una vista desde arriba que hay para esta clase. |
| tres cuartos | Eems Dart (IMO 9195640) | https://commons.wikimedia.org/wiki/File:Eems_Dart_-_IMO_9195640_leaving_Berendrechtsluis,_Port_of_Antwerp_pic4.JPG | Tres cuartos de popa por babor, de cerca, en la esclusa de Berendrecht. La casa se ve de costado con sus niveles y escaleras exteriores, el bote naranja con pescante en babor, dos escapes sobre el techo, el mástil de radar y, a la izquierda, el coaming rojo de la bodega con el pórtico. |
| tres cuartos | Eems Dart (IMO 9195640) | https://commons.wikimedia.org/wiki/File:Eems_Dart_-_IMO_9195640_leaving_Berendrechtsluis,_Port_of_Antwerp_pic5.JPG | Tres cuartos de popa por babor, navegando. Muestra el largo de la bodega con su coaming rojo y la barandilla azul de la amurada, la casa con el pórtico delante, el bote naranja en babor y el castillo gris con el mástil de proa pequeño al fondo. Útil para la proporción popa-proa. |
| tres cuartos | Eems Dart (IMO 9195640) | https://commons.wikimedia.org/wiki/File:Eems_Dart_-_IMO_9195640_leaving_Berendrechtsluis,_Port_of_Antwerp_pic1.JPG | Tres cuartos de proa por babor, entrando en la esclusa. La roda alta y el castillo gris con el mástil de proa, la línea de amurada blanca y la casa de popa con puente y mástil. Sirve para ver la altura de la casa contra la del castillo. |

### Rasgos de silueta

- Casa de popa de tres niveles blancos más un puente que sobresale con alerones a ambos lados; es lo que da la silueta y ocupa solo el 15-17 % final de la eslora.
- Puente con techo azul o rojo (según el armador), baranda perimetral, mástil de radar con cruceta y un domo o antena blanca; en el techo de la casa van uno o dos escapes cortos (no hay chimenea alta).
- Una sola bodega larga (62.5 m, ~70 % de la eslora) con coaming rojizo elevado y tapas grises planas.
- Grúas: ninguna en el barco (las fotos no muestran aparejo propio y la ficha del fabricante no lista grúas; las grúas que aparecen en las fotos son de muelle). El pedido del issue pide grúas de cubierta, así que quedan como piezas opcionales: dos, a una sola banda (estribor), sobre pedestal.
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
31. `box` · `steel` — opcional (grúa 1, pluma hacia proa): dx 20, dy 3.8, w 7, d 0.4, z 6.6, h 0.4
32. `cyl` · `steel` — opcional (grúa 2, pedestal en estribor): dx 34, dy 4, z 4, r 0.45, h 3
33. `box` · `steel` — opcional (grúa 2, pluma hacia proa): dx 34, dy 3.8, w 7, d 0.4, z 6.6, h 0.4

## `tug` — Damen ASD Tug 2810

- **Astillero/clase:** Damen Shipyards Group, ASD Tug 2810 (remolcador de puerto azimutal, "Azimuth Stern Drive"; más de 200 unidades entre 2000 y 2021, construidas en Gdynia, Galati y Song Cam, según Damen). Dos motores Caterpillar 3516C (3730 kW), dos propulsores azimutales Kongsberg US 205 bajo la popa, tracción a 58 t hacia proa y 54 t hacia popa en la versión estándar (60 t máx. en la ficha comercial), 7 tripulantes. Existe en versiones estándar, hybrid, ICE y con equipo contraincendios. Datos de la ficha de producto (archivada, ya no está en el sitio vigente porque el modelo salió de catálogo): https://web.archive.org/web/20220808080514/https://products.damen.com/-/media/products/images/clusters-groups/tugs/asd-tugs/asd-tug-2810/documents/product_sheet_asd_tug_2810_std.pdf , y página del modelo (archivada): https://web.archive.org/web/20210929015652/https://products.damen.com/en/ranges/asd-tug/asd-tug-2810 . Fin de la serie: https://www.damen.com/insights-center/articles/farewell-to-the-asd-tug-2810
- **Eslora:** 28.67 m · **Manga:** 10.43 m · **Altura sobre el agua:** ~16 m hasta la punta del mástil (estimada a ojo desde las fotos de perfil, con la escala dada por la eslora; la ficha no publica el calado aéreo): cubierta a ~2.7 m, techo de la timonera a ~8 m · **Puntal:** 4.60 m · **Calado a popa:** 4.80 m · **Desplazamiento:** 525 t · **Velocidad:** 12.9 kn
- **Caja en mapa:** 19 × 7 u · **Altura máx.:** z = 10

### Fotos

Todos los buques son del tipo ASD Tug 2810. La categoría de Commons `Damen ASD Tug 2810` agrupa las categorías por IMO de *Smit Donau* (9389473), *Bernardus* (9668025), *Zuiderzee* (9705263) y *Arashi*/*Svitzer Trident* (9769398); la de *Smit Donau* dice "Tugboat, Damen ASD Tug 2810, 28.75 × 10.43 m". En las fotos de *Bernardus* (archivo "ASD TUG 2810 HYBRID") y *Zuiderzee* se lee la placa "DAMEN ASD TUG 2810" y "HYBRID" en la pared de la caseta. Las dos son hybrid; solo cambian la pintura y el equipo opcional (grúa a babor, cañón de agua). Todas las fotos se miraron una por una para fijar el ángulo y el lado; "estribor" y "babor" salen de hacia dónde apunta la proa. No hay una toma aérea de dron en Commons de esta clase: la "cenital" es la más alta que encontré.

| Ángulo | Buque | Enlace | Qué se ve |
| --- | --- | --- | --- |
| perfil | Bernardus (IMO 9668025) | https://commons.wikimedia.org/wiki/File:Bernardus_%28tugboat,_2014%29_IMO_9668025,_Port_of_Amsterdam.JPG | Perfil casi puro de estribor, navegando con la proa a la derecha. La timonera blanca con ventanas panorámicas queda a ~51-69 % de la eslora desde la popa (la caseta blanca, a ~43-75 %), es decir a proa de la mitad; el mástil sale del techo; una chimenea gris sube junto al borde de popa de la caseta; el guinche negro (a ~78-87 %) está delante de la caseta y detrás del pudding de proa, un cilindro ancho con franjas amarillas sobre una cara de goma acanalada. La cubierta de popa es baja y abierta, con la grúa amarilla a babor (lado lejano). Es la foto para medir proporciones. |
| perfil | Bernardus (IMO 9668025) | https://commons.wikimedia.org/wiki/File:Bernardus_IMO_9668025_at_IJmuiden,_Noorzeekanaal_pic2.JPG | Perfil de babor, casi puro, navegando con la proa a la izquierda. Se ve el casco azul oscuro con la defensa corrida negra a lo largo de la banda, el pudding de proa a la izquierda, la grúa amarilla articulada en la cubierta de popa a babor y las dos chimeneas curvas detrás de la caseta (una por banda). |
| perfil | Arashi (IMO 9769398) | https://commons.wikimedia.org/wiki/File:Arashi_%28ship,_2016%29_IMO_9769398,_Afrikahaven,_Port_of_Amsterdam.JPG | Perfil de estribor apenas girado hacia proa, de cerca, con la proa a la derecha. Muestra la timonera de frente desde un costado: ventanas altas continuas, techo con proyectores y radar, y el mástil de reflectores y luces con la bandera. Se ve la chimenea curva sobre la caseta y el pudding con una sola hilera de cilindro (franjas amarillas) sobre la cara de goma. Sirve para ver el detalle de la timonera. |
| proa | Bernardus (IMO 9668025) | https://commons.wikimedia.org/wiki/File:Bernardus_-_IMO_9668025,_IJmuiden_pic1.JPG | Proa casi de frente, apenas girada, amarrado en un muelle. Se ve el pudding como un cilindro ancho y macizo con franjas amarillas sobre una cara de goma acanalada, el guinche de remolque con bitas y dos defensas rojas detrás, la timonera con ventanas panorámicas por delante y el mástil con la cruceta y las luces. La proa es roma y redondeada, no en punta. |
| popa | A873 Zr.Ms. Zuiderzee (IMO 9705263) | https://commons.wikimedia.org/wiki/File:De_Y8019_Balgzand_en_de_A873_Zr.Ms._Zuiderzee_in_Den_Helder_%2801%29.jpg | Casi de popa, apenas girada hacia estribor. Transom bajo con "A873 DEN HELDER", cilindros de goma negros sobre el borde del transom con un hueco entre ellos, las dos chimeneas curvas que suben una a cada lado de la caseta, la grúa amarilla articulada entre ellas y, encima, la timonera con ventanas hacia popa y el mástil. Es la versión de la marina neerlandesa (casco gris), mismo casco y misma disposición. |
| tres cuartos | Bernardus (IMO 9668025) | https://commons.wikimedia.org/wiki/File:BERNARDUS_%2814342118684%29.jpg | Tres cuartos de popa por estribor, navegando de espaldas a la cámara con la proa a la derecha y lejos. Se ve el transom bajo con "IJMUIDEN", los cilindros de goma con franjas amarillas en el borde de popa, las chimeneas a ambos lados de la caseta, la grúa amarilla a babor, el mástil alto con escalera y la timonera con ventanas panorámicas. |
| tres cuartos | Bernardus (IMO 9668025) | https://commons.wikimedia.org/wiki/File:Bernardus_-_IMO_9668025,_IJmuiden_pic2.JPG | Tres cuartos de proa por estribor, muy cerrado a la proa, amarrado a un muelle. Se ve el pudding y la cara de goma acanalada de frente, el guinche con las bitas, la proa chata y la banda de estribor con "BERNARDUS" hacia atrás, la timonera de frente con el techo de proyectores y radar y la chimenea de estribor. |
| cenital | Smit Donau (IMO 9389473) | https://commons.wikimedia.org/wiki/File:Smit_Donau_%282007%29.jpg | Toma elevada (unos 30-40° sobre el horizonte, desde un punto alto) de la proa y la banda de estribor, con la proa hacia la derecha, entrando en una dársena. Deja ver la cubierta de proa con el guinche, el cilindro de proa con amarres amarillos y, debajo, neumáticos colgados en lugar de la cara acanalada (variante del armador), el techo de la timonera con el equipo y el mástil, y la cubierta de popa baja y abierta. Es lo más parecido a una vista desde arriba que hay para esta clase. |

### Rasgos de silueta

- Timonera panorámica de una sola pieza, con ventanas altas continuas en las cuatro caras (visibilidad de 360°), sobre una caseta blanca de unos 2.5 m de alto. Está a proa de la mitad (vidrio de ~51 % a ~69 % desde la popa; la caseta, de ~43 % a ~75 %); el techo queda a unos 8 m del agua. No es una timonera "alta" en el sentido de varias cubiertas: es una sola, sobre la caseta.
- Mástil con cruceta, escalera, radar, proyectores y luces sobre el techo de la timonera, unos 8 m más alto que ella (la punta queda a ~16 m del agua). Es lo más alto del barco; el techo lleva además dos proyectores a proa y una barandilla.
- Dos chimeneas de escape delgadas y curvas, de acero inoxidable gris, una por banda, que suben en el borde de popa de la caseta (detrás de la timonera) y se inclinan hacia afuera; las puntas llegan al nivel del techo de la timonera o poco más. No son chimeneas macizas.
- Guinche de remolque en la cubierta de proa, justo delante de la timonera: tambor negro con bitas y un par de defensas rojas. La ficha lista un guinche de ancla y remolque (el de proa) y uno opcional a popa. La cubierta de proa es más alta que la de popa.
- Pudding de proa macizo: un cilindro ancho de goma negra con franjas amarillas que rodea la proa roma, sobre una cara vertical de goma acanalada ("W-block" en la ficha) que baja hasta el agua. Domina la silueta de proa vista de frente y desde un costado.
- Defensas: la ficha pide defensas en D a los lados, cilindros en las esquinas del transom y cilindro con W-block a proa. Las fotos lo confirman. No hay defensa en D en la popa: en la foto de popa los cilindros cubren casi todo el espejo, con un hueco angosto donde está pintado "A873". El plan de #57 dice "defensas en todo el contorno"; es cierto para los costados y la proa, no para la popa. Algunos armadores usan neumáticos (*Smit Donau*).
- Amurada alta y maciza a proa y una cubierta de popa baja y abierta, con una baranda: el casco queda más alto en la proa y baja de golpe en la zona de la caseta. La obra viva es la parte oscura o roja del casco; la obra muerta toma el color del armador (azul oscuro en *Bernardus*, rojo en *Smit Donau* y *Waterstroom*, gris en la marina).
- Los propulsores azimutales (dos, de 2.4 m de hélice) y el patín van bajo el agua en la popa: no se ven, pero la popa es corta y redondeada y la ficha da el calado a popa (4.80 m).
- Grúa articulada amarilla opcional en la cubierta de popa a babor (Heila, 0.8 t), detrás de la caseta y entre las chimeneas, que no está en todas las unidades.

### Traducción a la escala del mapa

- **Casco:** 19 × 7 u (28.67 m son 19.1 u y 10.43 m son 6.95 u: no hay compresión en planta). `h` 2.2, arrufo 0.3: la cubierta queda en z = 1.2 (3.3 m sobre el agua; real ~2.7 m, un poco exagerada para que se lea) y sube a z ≈ 1.8 en la proa (4.3 m; real ~3.5 m). El contorno del kit tiene la manga máxima al 57 % (x 10.8) y la proa en punta; el real es roma. No se puede cambiar (ver Decisiones).
- **Altura:** el calado aéreo real (~16 m, 10.7 u sobre el agua) entra sin comprimir en z = 13: la punta del mástil queda en z ≈ 9.9. La exageración de la cubierta suma ~0.7 u. Cada u de altura sobre la cubierta vale 1.5 m.
- **Caseta (x 8.2 a 14.2):** 6 × 4.4 u, de z 1.2 a 2.9 (1.7 u, unos 2.5 m). Va a proa de la mitad (la mitad está en x 9.5), como en las fotos.
- **Timonera (x 9.7 a 13.2):** 3.5 × 3.8 u, de z 2.9 a 4.8 (1.9 u, unos 2.8 m), con ventanas continuas en las cuatro caras; techo de acero de 3.9 × 4.2 u (x 9.5 a 13.4) en z 4.8 a 4.95. Queda 0.3 u más angosta que la caseta de cada lado, como en las fotos.
- **Chimeneas (x 8.5, y ±1.9):** cilindros de radio 0.3 y 2.7 u de alto (z 2.9 a 5.6), un poco por encima del techo; en el kit solo son verticales, no se inclinan hacia afuera.
- **Mástil (x 11.2 a 11.5, sobre el techo):** de z 4.95 a 9.85 (4.9 u, unos 7.4 m), con cruceta de 2.6 u en z 7.9 y un radar de 1.6 u en z 6.2. Es el punto más alto: la luz de tope en z 10.0.
- **Proa (x 14.2 a 19):** guinche (cilindro vertical de radio 0.6, el real es de eje horizontal) en x 15.2, z 1.4 a 2.3 (a ~80 % de la eslora); pudding en dos cajas negras de 1 u de alto (z 0.9 a 1.9), una de 1.8 × 4 u en x 16.2 a 18 y otra de 1 × 1.6 u en x 18 a 19. Sobresalen unas 0.2 u del casco y dan la sensación de pudding macizo.
- **Defensas laterales y de popa:** rieles de goma de 0.3 × 7 u pegados a cada costado (x 4.2 a 11.2, z 0.2 a 0.7) y dos cilindros de radio 0.45 sobre el borde del espejo (x 0.9, y ±1.7, z 1.0 a 1.9: el anillo de cubierta tiene la esquina en x 0.76, y ±2.1, y la cubierta ahí está en z ≈ 1.4, así que asoman 0.5 u).
- **Amurada de proa:** un tramo por banda, de 1 u de largo y 0.8 u de alto (x 14.4 a 15.4, z 1.4 a 2.2), pegado al borde pero unas 0.15 a 0.3 u hacia adentro (la media manga del casco es ≈ 2.6 en x 14.4 y ≈ 2.4 en x 15.4; los tramos van en |y| 2.1 a 2.35).
- **Lados visibles:** con rumbo 0 se ven la cubierta, la proa (+x) y la banda de estribor; la popa y la banda de babor quedan ocultas. Por eso conviene detallar primero el pudding (proa), la cara de proa de la timonera y la banda de estribor; las chimeneas se ven desde arriba y por el lado de estribor, y la grúa de babor queda oculta con rumbo 0.
- **Luces:** tope en el mástil (x 11.35, z 10.0), babor y estribor en los bordes del techo de la timonera (x 12.0, y ±2.1, z 5.15), dos proyectores ámbar sobre las cajas de los proyectores (x 12.95, y ±1.45, z 5.5) y ventanas encendidas en la cara de proa de la timonera (x 13.22).

### Piezas sugeridas (por importancia)

1. `hull` · `hullBlue` — casco 19 × 7, h 2.2, arrufo 0.3
2. `box` · `whitewash` — caseta: dx 8.2, dy −2.2, w 6, d 4.4, z 1.2, h 1.7, fachada 1 piso y 3 columnas
3. `box` · `whitewash` — timonera panorámica: dx 9.7, dy −1.9, w 3.5, d 3.8, z 2.9, h 1.9, fachada de 1 piso con `base: "glass"` y 4 columnas
4. `box` · `asphalt` — pudding de proa, tramo ancho: dx 16.2, dy −2, w 1.8, d 4, z 0.9, h 1
5. `box` · `asphalt` — pudding de proa, punta: dx 18, dy −0.8, w 1, d 1.6, z 0.9, h 1
6. `cyl` · `steel` — guinche de proa: dx 15.2, dy 0, z 1.4, r 0.6, h 0.9
7. `cyl` · `steel` — chimenea de babor: dx 8.5, dy −1.9, z 2.9, r 0.3, h 2.7
8. `cyl` · `steel` — chimenea de estribor: dx 8.5, dy 1.9, z 2.9, r 0.3, h 2.7
9. `box` · `steel` — techo de la timonera: dx 9.5, dy −2.1, w 3.9, d 4.2, z 4.8, h 0.15
10. `box` · `steel` — mástil: dx 11.2, dy −0.15, w 0.3, d 0.3, z 4.95, h 4.9
11. `box` · `steel` — cruceta del mástil: dx 11.1, dy −1.3, w 0.25, d 2.6, z 7.9, h 0.2
12. `box` · `steel` — radar: dx 10.9, dy −0.8, w 0.3, d 1.6, z 6.2, h 0.2
13. `box` · `asphalt` — riel de defensa de babor: dx 4.2, dy −3.5, w 7, d 0.3, z 0.2, h 0.5
14. `box` · `asphalt` — riel de defensa de estribor: dx 4.2, dy 3.2, w 7, d 0.3, z 0.2, h 0.5
15. `cyl` · `asphalt` — cilindro de esquina de popa, babor: dx 0.9, dy −1.7, z 1, r 0.45, h 0.9
16. `cyl` · `asphalt` — cilindro de esquina de popa, estribor: dx 0.9, dy 1.7, z 1, r 0.45, h 0.9
17. `box` · `hullBlue` — amurada de proa, babor: dx 14.4, dy −2.35, w 1, d 0.25, z 1.4, h 0.8
18. `box` · `hullBlue` — amurada de proa, estribor: dx 14.4, dy 2.1, w 1, d 0.25, z 1.4, h 0.8
19. `box` · `steel` — proyector de babor: dx 12.7, dy −1.7, w 0.5, d 0.5, z 4.95, h 0.5
20. `box` · `steel` — proyector de estribor: dx 12.7, dy 1.2, w 0.5, d 0.5, z 4.95, h 0.5
21. `cyl` · `steel` — bita de popa: dx 2.5, dy 0, z 1.2, r 0.35, h 0.6
22. `cyl` · `steel` — opcional: pedestal de la grúa a babor: dx 5.8, dy −2.3, z 1.2, r 0.35, h 0.9
23. `box` · `steel` — opcional: pluma de la grúa, hacia popa: dx 3.2, dy −2.45, w 2.8, d 0.3, z 2.1, h 0.3
24. `dot` · `magentaMid` — luz de tope: dx 11.35, dy 0, z 10, r 0.7
25. `dot` · `magenta` — luz de babor en el techo de la timonera: dx 12, dy −2.1, z 5.15, r 0.4
26. `dot` · `cyanMid` — luz de estribor en el techo de la timonera: dx 12, dy 2.1, z 5.15, r 0.4
27. `dot` · `amber` — proyector de babor encendido: dx 12.95, dy −1.45, z 5.5, r 0.35
28. `dot` · `amber` — proyector de estribor encendido: dx 12.95, dy 1.45, z 5.5, r 0.35
29. `poly` · `magentaBleed` — ventanas encendidas, cara de proa de la timonera: puntos (13.22, −1.7, 3.2), (13.22, 1.7, 3.2), (13.22, 1.7, 4.5), (13.22, −1.7, 4.5), alfa 0.8

## `barge` — Empujador fluvial de tres cubiertas con barcaza tolva Jumbo Mississippi

Sección a completar en la tarea 4 del plan.

## Decisiones

Heredadas del plan de #57:

- `cargo` pasa a ser el Damen Combi Freighter 3850 y reemplaza al carguero genérico actual.
- `tug` pasa a ser el Damen ASD Tug 2810.
- `barge` pasa a ser un empujador fluvial con una barcaza tolva Jumbo del Mississippi. La barcaza va por delante y el empujador queda apoyado contra su popa, como en la operación real.
- `cargo`: fotos de *Birgit G.* (IMO 9536064), *Tucana* (IMO 9455674), *Eems Dart* (IMO 9195640), *Haringvliet* (IMO 9625229), *Helas* (IMO 9195743) y *Eems Exe* (IMO 9195535), todos de la categoría de Commons `Damen Combi Freighter 3850` (gemelos, sin sustituir de clase; no se encontró una foto aérea, la cenital es una toma alta desde el muelle). Compresiones para la caja: manga 12.5 m a 10 u (×1.2), bodega de 41.7 u a 38 u, alturas sobre cubierta ×0.77 para no pasar de z = 12; no se modelan bulbo ni anclas.
- `cargo` y las grúas: el issue #59 pide un carguero "con grúas propias" y el plan de #57 habla de "dos grúas de cubierta a una banda", pero el Damen CF 3850 base no las lleva (las fotos no muestran aparejo propio y la ficha no lista grúas; las grúas que se ven en las fotos son de muelle). Se mantiene el CF 3850, porque el tipo lo fija el issue. El modelo por defecto sigue la referencia y no lleva grúas; las piezas 30 a 33 las agregan como opción de menor prioridad (dos grúas en estribor, dentro del tope de 40 sólidos) si #60 decide priorizar el pedido del issue.
- `cargo` y la foto de proa: hay dos tomas de proa casi de frente, *Haringvliet* (IMO 9625229, también de la categoría de la clase) y *Tucana*; ninguna es perfectamente axial. La fila `popa` es *Eems Exe*, casi axial pero apenas girada; no se encontró una foto exactamente axial de popa de la clase (se revisaron también *Haringvliet*, *Geervliet*, *Helas*, *Svealand*, *Baltic Fin* y *Conformity*). ShipSpotting no se consultó.
- `tug`: fotos de *Bernardus* (IMO 9668025, hybrid de Iskes), *A873 Zr.Ms. Zuiderzee* (IMO 9705263, hybrid de la marina neerlandesa), *Smit Donau* (IMO 9389473) y *Arashi* (IMO 9769398), todos de la categoría de Commons `Damen ASD Tug 2810` (sin sustituir de clase). Los datos salen de la ficha de producto archivada (el modelo salió de catálogo en 2021 y la página ya no existe en damen.com; el enlace es de web.archive.org, que se puede perder): eslora 28.67 m, manga 10.43 m, puntal 4.60 m, calado a popa 4.80 m. No hay foto aérea (dron) en Commons: la "cenital" es *Smit Donau* a ~30-40°; la popa es la versión de la marina (gris), mismo casco. Compresiones: ninguna en planta (19.1 × 6.95 u) ni en altura (16 m entran en z = 10; la cubierta se exagera ~0.7 u). No se modelan los propulsores azimutales (van bajo el agua) ni el patín.
- `tug` y el plan de #57: se verificó cada rasgo contra las fotos. Se confirman la timonera panorámica a proa de la mitad, el mástil con luces, el guinche de remolque y el pudding de proa. Difieren tres cosas: (1) la timonera no es "alta" sino una sola pieza sobre la caseta (el techo queda a ~8 m, unos 5 u sobre el agua), con el mástil como punto más alto; (2) las dos chimeneas son escapes delgados, curvos y de acero que salen del borde de popa de la caseta, no chimeneas macizas, y se modelan como cilindros verticales; (3) las "defensas en todo el contorno" valen para los costados (defensa en D) y la proa (cilindro y W-block), pero en la popa no hay defensa en D: los cilindros cubren casi todo el espejo (*Zuiderzee*), con un hueco angosto donde va pintado "A873". El tug actual de `ships.ts` pone la caseta a popa (x 5 a 9) y la chimenea al centro; la referencia la pone a proa de la mitad (caseta x 8.2 a 14.2, timonera x 9.7 a 13.2) y las dos chimeneas a los lados.
- `tug` y el kit: el contorno del casco es fijo (`DECK_RING`: proa en punta, manga máxima al 57 %), pero el tug real tiene la proa roma y el pudding la redondea. Se suple con dos cajas negras para el pudding, que sobresalen del contorno. El cilindro del kit es vertical, así que el guinche (de eje horizontal) y las chimeneas (inclinadas) se aproximan con cilindros verticales. El material de la goma negra es `asphalt`, porque `ISO_TONES` no tiene un negro de goma. Las piezas 22 y 23 (grúa) son opcionales; las 24 a 29 son luces (cinco puntos y un `poly`, seis en total, dentro de las 8).
- Los identificadores de `ShipKind` (`cargo`, `tug`, `barge`, `ferry`) se mantienen, para no tocar las rutas ni la animación.
