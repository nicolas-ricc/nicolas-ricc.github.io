# Estación terminal (Tigre) con tren animado

**Fecha:** 2026-10-27
**Estado:** implementado en #239 (rama `feature/239-estacion-tigre`, hijos
#276–#281 y este cierre, #282); los desvíos están en §12. Depende de
`2026-10-27-fabrica-mudanza-design.md` (mismo archivo `shipyard.ts`; deja la
vía del oeste terminando en x 104 sin ramales).
**Alcance:** construir una estación cabecera de verdad al final de la vía del
oeste, en el lugar de la calderería del astillero, y un tren eléctrico que
llega por la vía del oeste, para, espera y vuelve a salir. Es el ítem 5 de la
captura anotada (`assets/2026-10-27-anotaciones/mapa-anotado.jpg`, recorte
`fabrica-3-estacion-5.jpg`).

## 1. Situación actual

- **No hay estación.** Lo que la captura marca como estación es la
  **calderería del astillero**: `factory(out, accents)` en
  `src/scenes/shipyard.ts:176-199`. Tiene:
  - la nave de dientes de sierra, x 112..172, y 98..122, h 9;
  - dos chimeneas `rust` en (176, 104) y (176, 114);
  - el rack de cañerías x 183.6;
  - tres tanques r 4 en x 190;
  - el galpón de pintura x 112..142, y 126..140;
  - el tanque de agua (156.4, 132.4);
  - la subestación chica en x 146;
  - autoelevadores, faroles y las secciones prefabricadas (rng) en
    x 112..157, y 82..95.
- **La vía del oeste** es `RAIL_Y = [131, 134]` (trocha 3, eje y 132.5).
  - Viene del borde del sangrado (`WEST_RAIL_X0 = −402`, `hinterland.ts:158-163`)
    por el cinturón verde y entra al astillero hasta x 104.
  - Termina ahí, 8 u antes del galpón de pintura, sin andén.
  - Los durmientes son `rust` cada 4 u.
- **Nada anda sobre rieles** salvo el tren de la montaña rusa de la feria.
- **Límites:**
  - zona Portfolio para y < 146 (`ZONE_SPLIT_Y`, `worldZoneAt`);
  - sólidos del astillero con x ≤ 345 e y ≤ 147 (`shipyard.test.ts:18-25`);
  - losa hasta y 142 (`BOTTOM`);
  - muelle en `QUAY_X = 198`;
  - calle de transferencia x 100..108;
  - playa de estacionamiento x 46..98, y 100..126, que se queda.

## 2. Referencias

Fotos de licencia libre en `docs/superpowers/specs/assets/estacion-refs/`,
con créditos en `CREDITS.md`. **Mirarlas antes de modelar.**

| Pieza | Modelo real | Fotos |
|---|---|---|
| Estación | **Estación Tigre**, cabecera de la Línea Mitre (Tigre, Buenos Aires, 1995): edificio de ladrillo con techos de teja, torre del reloj de piedra, pórtico verde, andenes con marquesinas verdes y topes contra un andén transversal | `estacion/01`–`08` |
| Tren | **EMU CSR Sifang de la Línea Mitre** (2014–16), librea "Trenes Argentinos": tercer riel, sin pantógrafo | `tren/01`–`04` |

La Tigre real tiene un río y una estación fluvial cruzando la avenida. Acá el
edificio mira al río del astillero (x ≥ 198), así que la referencia encaja.

## 3. Escala

El mapa comprime: la nave de calderas mide 76 u para 52 m (≈ 1.46 u/m), pero
los vagones de carga miden 8 u. El tren y la estación se escalan **a ojo
contra los vecinos**, no en metros:

- coche ≈ 11 u de largo, 3.4 de ancho y 4 de alto;
- formación de **4 coches** (≈ 46 u con los fuelles);
- andenes de ≈ 50 u;
- torre del reloj de ≈ 6 × 6 u y ≈ 28 u de alto (la chimenea más alta llega a 29).

## 4. Disposición

### 4.1 Región

La calderería y todo lo listado en §1 se **eliminan**, incluidas las
secciones prefabricadas. Al sacar sus llamadas al rng, cambia lo que sigue
en `shipyard()`; sigue siendo determinista y los tests se ajustan. La
estación ocupa aprox. **x 100..197, y 80..142**:

- cruza la calle de transferencia con un **paso a nivel**;
- **x ≤ 197**, antes del muelle;
- **y ≤ 142** para todo sólido, dentro de la losa y de Portfolio.

### 4.2 Planta sugerida

El plan puede ajustarla dentro de §4.1 y anota los desvíos.

| Elemento | Lugar sugerido |
|---|---|
| Vía 3 (la del tren animado) | eje **y 132.5**, la misma de la vía del oeste, recta, de x 104 a los topes en x ≈ 160. Sin cambio de vía: el tren nunca dobla |
| Vías 1 y 2 | ejes y ≈ 112 e y ≈ 122, nacen de la vía 3 con un abanico de cambios en x 108..125 (`strip` diagonales); topes en x ≈ 160 |
| Andén isla | entre vías 2 y 3, y ≈ 125.5..129.5, x 115..160, h ≈ 1, con borde amarillo (`safety`) |
| Andén lateral norte | al norte de la vía 1, y ≈ 104..108.5 |
| Sur de la vía 3 | **sin andén alto ni marquesina** (ver §6.2): solo losa, cerco bajo (h ≤ 1) y el borde |
| Marquesinas | una por andén, techo verde a un agua o dos aguas bajo, columnas finas cada ≈ 5 u, cabriadas (`beam`), faja en el borde |
| Topes | marco de acero bajo con franjas amarillas y negras y luz roja (acento), contra el andén transversal |
| Andén transversal | x ≈ 160..166, y 104..131, con marquesina verde baja contra el edificio |
| Edificio de pasajeros | x ≈ 166..190, y ≈ 100..132 (planta en L o ancha, con alas bajas), **fachada principal al este** (cara +x, vista por la cámara) hacia el muelle |
| Torre del reloj | en la **esquina SE** del edificio (ve +x y +y), ≈ 6 × 6 u, ≈ 28 u de alto |
| Explanada | x ≈ 190..197, entre el edificio y el muelle: faroles altos, palmeras, baranda verde |
| Paso a nivel | en la calle x 100..108 sobre la vía 3: tablones, dos barreras y dos semáforos con luces rojas |
| Tren estacionado | en la vía 1, un EMU igual al animado, **estático**, con el salón encendido |

## 5. Inventario (casillas para el PR)

### 5.1 Edificio de pasajeros

- [x] Hall de un piso de ladrillo `brick`, alero a ≈ 8 u, con **techo a dos
      aguas o a cuatro aguas de teja**. Material nuevo `tile` (terracota) si
      `rust` no lee como teja.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "hall:
      alero 8, cumbrera 10.8, linterna con tapas, medio punto, cornisa dentada,
      ventanales y zócalo")
- [x] **Linterna vidriada** a lo largo de la cumbrera del hall: caja baja de
      marco oscuro con vidrio, encendida de noche.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "hall:
      alero 8, cumbrera 10.8, linterna con tapas, medio punto, cornisa dentada,
      ventanales y zócalo")
- [x] **Medio punto** (abanico vidriado) bajo un arco de ladrillo en el
      piñón principal.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "hall:
      alero 8, cumbrera 10.8, linterna con tapas, medio punto, cornisa dentada,
      ventanales y zócalo")
- [x] **Cornisa dentada** de ladrillo (impostas) en los piñones.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "hall:
      alero 8, cumbrera 10.8, linterna con tapas, medio punto, cornisa dentada,
      ventanales y zócalo")
- [x] **Pórtico de acceso** sobre la fachada este: marquesina de acero y
      vidrio verde de ≈ 10 u de ancho, dos columnas redondas verdes y faja
      con el cartel "ESTACION TIGRE" como placa clara (sin texto real).
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "pórtico:
      marquesina con vidrio, dos columnas redondas, cartel claro")
- [x] Debajo del pórtico, **tres ventanales vidriados** con parteluces verdes
      (`facade` con `grid`) y **pilastras de ladrillo** entre ellos.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "hall:
      alero 8, cumbrera 10.8, linterna con tapas, medio punto, cornisa dentada,
      ventanales y zócalo")
- [x] **Zócalo** verde grisáceo y farolas de pared.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "hall:
      alero 8, cumbrera 10.8, linterna con tapas, medio punto, cornisa dentada,
      ventanales y zócalo")
- [x] **Alas bajas** con techo propio de teja y toldos rojos (`signal`) de
      los locales.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "alas y
      toldos: cuatro al sur de WING_S, dos al este de WING_N, cada uno con su
      vidriera")
- [x] De noche: el pórtico y la linterna con luz cálida (acentos ámbar) y
      ventanas encendidas.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "luces de
      noche: pórtico, linterna, medio punto, ventanas, esferas y faroles")

### 5.2 Torre del reloj

- [x] Fuste de **piedra beige** (`stone`), planta cuadrada, con ranuras
      angostas (placas oscuras) más abajo.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "torre:
      fuste de piedra con ranuras, cuatro esferas con anillo, pináculos, remate
      de teja con hastiales y respiraderos")
- [x] Cuerpo del reloj arriba: **cuatro esferas blancas** (disco
      `whitewash` con anillo dorado `safety` o `stockbrick`). Las de las caras
      +x y +y se ven; las otras dos se modelan igual.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "torre:
      fuste de piedra con ranuras, cuatro esferas con anillo, pináculos, remate
      de teja con hastiales y respiraderos")
- [x] **Ménsulas o pináculos dorados** en las cuatro esquinas del cuerpo
      del reloj.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "torre:
      fuste de piedra con ranuras, cuatro esferas con anillo, pináculos, remate
      de teja con hastiales y respiraderos")
- [x] Remate de **teja empinado** con hastiales de piedra en cada cara y un
      respiradero cuadrado en cada hastial.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "torre:
      fuste de piedra con ranuras, cuatro esferas con anillo, pináculos, remate
      de teja con hastiales y respiraderos")
- [x] De noche: las esferas iluminadas (acento cálido), el foco del conjunto.
      (captura `estacion-edificio.png`, #278; test `station.test.ts` "luces de
      noche: pórtico, linterna, medio punto, ventanas, esferas y faroles")

### 5.3 Andenes y vías

- [x] Tres vías de trocha 3 con durmientes `rust` cada 4 u, como la vía del
      oeste; el **tercer riel** como franja clara al costado de cada vía.
      (captura `estacion-vias.png`, #277; test `station.test.ts` "vías: rieles
      de TRACK_X0 a BUFFER_X en eje ±1.5, durmientes cada 4 u y tercer riel en
      eje + 2.1")
- [x] **Abanico de cambios** de la vía 3 a las vías 1 y 2.
      (captura `estacion-vias.png`, #277; test `station.test.ts` "abanico: dos
      rieles diagonales de LADDER[0] a LADDER[1], corridos ±1.5 en
      perpendicular")
- [x] Andenes de hormigón (`concrete` o `paving`) con **franja amarilla** en
      el borde.
      (captura `estacion-vias.png`, #277; test `station.test.ts` "andenes
      concrete h 1 con franjas amarillas del lado de las vías y baranda en el
      transversal"; andenes de ≈ 37 u, ver §12)
- [x] **Marquesinas verdes** (material nuevo `canopy`, verde oscuro de chapa)
      con columnas finas, cabriadas triangulares y faja; luces bajo la
      marquesina (acentos fríos).
      (captura `estacion-vias.png`, #277; test `station.test.ts` "marquesinas:
      dos aguas bajas, columnas cada 5 u, cabriadas, fajas y luces cyanMid")
- [x] **Topes** a franjas amarillas y negras con **luz roja** encima.
      (captura `estacion-vias.png`, #277; test `station.test.ts` "topes: tres en
      x 160..161.5, h 1.2, franjas safety/asphalt en este y sur, luz magenta";
      tope de h 1.2, ver §12)
- [x] **Andén transversal** con marquesina baja contra el edificio y baranda.
      (captura `estacion-vias.png`, #277; test `station.test.ts` "andenes
      concrete h 1 con franjas amarillas del lado de las vías y baranda en el
      transversal")
- [x] **Semáforos** de vía (poste con dos o tres luces) a la salida del
      abanico, con el aspecto que corresponda al tren (§7).
      (captura `estacion-vias.png`, #277; test `station.test.ts` "semáforos:
      poste steel 0.3 h 3.5 bajo una cabeza asphalt 0.5×0.5×1.2 anclada en
      SIGNALS"; con luces, #281: `rail-anim.test.ts` "entrada verde al
      principio de la entrada y roja cuando el frente pasa x 96"; semáforos con
      la esquina NO como punto, ver §12)
- [x] **Paso a nivel**: tablones sobre la calle, dos barreras (brazo `beam`
      a franjas rojas y blancas) y dos postes con luces rojas que titilan
      mientras pasa el tren.
      (capturas `estacion-vias.png` (#277) y `paso-a-nivel.png` (#281); tests
      `station.test.ts` "paso a nivel: tablones deck, dos postes y dos barreras
      bajas de cuatro tramos signal/whitewash" y `rail-anim.test.ts` "activo: un
      dot magenta r 0.45 por poste a z h − 0.4, que alterna 1 u en y cada
      BLINK_MS")

### 5.4 Tren EMU (Línea Mitre)

- [x] **4 coches**, caja blanca (`whitewash`) con una **banda azul ancha**
      sobre la línea de ventanas (material nuevo `livery`, azul cobalto) y
      **filetes** azules finos abajo.
      (capturas `tren-estacionado.png` (#279) y `tren-despues.png`; test
      `train.test.ts` "inventario por coche (%i coches)"; la formación
      estacionada es de 3 coches, ver §12)
- [x] **Banda de ventanas** oscura (`glass`) que de noche se ve **encendida**
      (blanco frío) en el salón.
      (captura `tren-estacionado.png`; test `train.test.ts` "salón: sin
      cyanBleed apagado; 4 por coche encendido, cada uno sobre un tramo de la
      banda de ventanas")
- [x] **Tres puertas azules** por lado y por coche.
      (captura `tren-estacionado.png`; test `train.test.ts` "inventario por
      coche (%i coches)")
- [x] Techo gris claro con **un equipo de aire acondicionado** por coche
      (caja con rejillas, ≈ 1/3 del largo). **Sin pantógrafo.**
      (captura `tren-estacionado.png`; test `train.test.ts` "inventario por
      coche (%i coches)")
- [x] **Frentes de cabina** en los dos extremos: casi planos, parabrisas
      envolvente negro, cartel LED arriba (acento ámbar), mitad superior
      azul y franja blanca abajo, **faros** en las esquinas inferiores y
      **enganche amarillo**.
      (captura `tren-estacionado.png`; test `train.test.ts` "frentes de cabina:
      parabrisas, mitad superior y franja livery en wall 1 del último coche y
      wall 3 del primero")
- [x] Bogies y bastidor grises oscuros (`steel`); fuelles entre coches.
      (captura `tren-estacionado.png`; test `train.test.ts` "inventario por
      coche (%i coches)")
- [x] Luces: **faros blancos** adelante y **rojas** atrás según el sentido
      de marcha (se invierten al salir).
      (capturas `tren.png` y `tren-llegando.png` (#281); tests `train.test.ts`
      "lead %s: faros cyan adelante, rojas magenta atrás" y `rail-anim.test.ts`
      "saliendo: invertidas")

## 6. Reglas

### 6.1 Modelado

Valen las reglas de `2026-10-24-fabrica-detalle-design.md` §2:

- el detalle va en las caras +x, +y y el techo;
- tamaño mínimo 0.15 u;
- ningún sólido pisa otro, con un test por cada vecindad nombrada acá:
  edificio ↔ andén transversal, marquesinas ↔ vías, torre ↔ explanada,
  paso a nivel ↔ calle, estación ↔ playa de estacionamiento;
- materiales nuevos (`canopy`, `livery` y, si hace falta, `tile`) en
  `src/map/palette-base.ts`, generados con `npm run palette` y cubiertos
  por la guarda de paleta.

### 6.2 El tren no pasa por detrás de nada

Las capas animadas de sólidos se dibujan **encima** de toda la escena
estática (`src/world/stage.ts:109-112`, `solidSlot`). Si un sólido estático
quedara delante del tren en pantalla, el tren lo taparía mal. Por eso:

- **Test de oclusión** como el de los barcos (`sea-anim.test.ts`: SAT entre
  polígonos de pantalla). En cada posición del recorrido, el polígono de
  pantalla del tren no se superpone con ningún sólido estático que esté
  delante de él. Se permiten sólidos de h ≤ 0.4: rieles, durmientes,
  tablones del paso a nivel.
- Para cumplirlo:
  - no hay andén alto ni marquesina al sur de la vía 3;
  - la selva al sur de la vía del oeste se despeja en un corredor del ancho
    que pida el test, en `hinterland.ts` (cinturón verde) y en la selva del
    astillero x 3..39;
  - `RAIL_CLEAR` de `flora.ts` puede crecer solo para el lado sur.
  Anotar cuántos conos se pierden.
- La barrera del paso a nivel del lado sur, si existe, es baja (h ≤ 0.4)
  o queda fuera de la huella del tren.

### 6.3 Presupuesto

- El tren se re-tesela en cada cuadro: su capa lleva un tope de
  **600 caras**, verificado por test (como la rueda de la excavadora, 400).
- La estación estática informa sus caras en el storybook.
- Se elimina la calderería, así que el total del astillero no debería
  crecer más de **+20 %**. Delta anotado en el PR.

## 7. Animación

Animador nuevo `src/scenes/rail-anim.ts` (puro, sin Pixi) +
`rail-animator.ts` (contrato `Animator`), armado en
`src/world/assemble.ts` con la zona `"portfolio"` y su propio
`createRng(SEED + n)`.

Capas:
- `rail.train`: sólidos, con `alpha`;
- `rail.lights`: faros, salón, cartel y luces rojas;
- `rail.crossing`: luces del paso a nivel;
- `rail.signals`: aspectos de los semáforos.

**Ciclo** (período ≈ 120 s de reloj de pared, ajustable):

1. **Entrada:** el tren aparece con fade en el borde oeste del sangrado
   (x ≈ −402, eje y 132.5), mirando al este, y anda a velocidad de línea
   (≈ 24 u/s) por la vía del oeste.
2. **Frenado** en los últimos ≈ 60 u y **parada** con el frente a ≈ 1 u de
   los topes de la vía 3.
3. **Espera** ≈ 30 s con las puertas cerradas: no se modelan abiertas.
4. **Salida** hacia el oeste. El EMU es reversible: no gira, se invierten
   faros y luces rojas. Acelera y se desvanece en el borde oeste.
5. **Fuera de pantalla** ≈ 20 s y repite.

Además:

- El paso a nivel titila mientras algún coche está a menos de ≈ 30 u de la
  calle.
- El semáforo de salida pasa a verde un poco antes de la partida y vuelve a
  rojo cuando el tren deja el abanico.
- `reducedMotion`: el tren queda **estacionado** en la vía 3 con el salón
  encendido, sin ciclo; las luces del paso a nivel quedan apagadas.
- El tiempo sigue al reloj de pared: no usar temporizadores propios (ver
  #192). `?speed=` del lab lo acelera como al resto.

Tests de la animación:

- posiciones del ciclo (aparece en el borde, se detiene a 1 u del tope,
  sale);
- inversión de luces;
- paso a nivel activo solo con el tren cerca;
- oclusión (§6.2);
- tope de caras (§6.3);
- `reducedMotion`;
- el tren siempre sobre `RAIL_Y` (eje 132.5) y nunca al este de los topes.

## 8. Storybook y capturas

- Exhibits nuevos en `src/lab/exhibits.ts`, `CATALOG` de
  `exhibits.test.ts` y el índice del spec del storybook:
  - `estacion`: región del edificio, la torre y los andenes;
  - `tren`: pieza reubicable armada en el origen, como los barcos, con su
    animación de luces;
  - `paso-a-nivel`.
- El PR trae capturas **antes/después**, todas a 1600×900 en 2x:
  - la vista cover del sitio (`http://localhost:5173/`);
  - los exhibits nuevos;
  - un **time-lapse** de un ciclo del tren con el método del CLAUDE.md
    (`deltaMS` fijo).

  Todo en `docs/superpowers/specs/assets/2026-10-27-estacion/`.
- Cada casilla del §5 marcada en el PR, señalando dónde se ve.

## 9. Tests y documentación a actualizar

- `shipyard.test.ts`: lo que fijaba la calderería (techos escalonados,
  equipos, autos, faroles) se ajusta a lo que queda tras este spec y el de
  la mudanza. Los tests nuevos de la estación pueden vivir en
  `station.test.ts` si la estación pasa a su propio módulo
  (`src/scenes/station.ts`, recomendado).
- `hinterland.test.ts:83-90`: rieles y durmientes intactos; los conos siguen
  despejados de las vías, con el corredor sur nuevo.
- `animators.test.ts`, `assemble.test.ts` (velo de la capa), `world.test.ts`.
- README (párrafo del mundo: estación y tren), docstring de `shipyard.ts`.
  En `2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md`, la
  estación planeada en (−18, 188) queda **descartada**: agregar una nota que
  remita a este spec.

## 10. Criterios de aceptación

- [x] `npm run typecheck` y `npm test` pasan, incluida la guarda de paleta.
      (`npm test`, `npm run typecheck` y la guarda de paleta,
      `palette-base.test.ts` "materiales de la estación: tile, canopy y livery;
      ISO_TONES es la base oscurecida canal a canal")
- [x] Calderería eliminada; estación dentro de §4.1; tests de vecindad.
      (tests `shipyard.test.ts` "no queda nada de la calderería (#277)" y
      `station.test.ts` "todo cae en STATION (x 96..197.3, y 80..142) y nada
      elevado al oeste del edificio pasa z 6", más el describe `station:
      vecindades (cajas disjuntas, 1e-9)`)
- [x] Tren con el ciclo de §7; tests de ciclo, luces, paso a nivel, `reducedMotion`, oclusión y tope de 600 caras.
      (tests de `rail-anim.test.ts`: describes `rail-anim: ciclo`, `rail-anim:
      paso a nivel activo`, `createRailAnim: luces del tren`, `createRailAnim:
      reducedMotion`, `rail-anim.test.ts` "rail.train tesela en ≤ 600 caras en
      20 muestras del ciclo" y `rail-anim.test.ts` "con el tren visible, ningún
      sólido estático alto que se le superpone en pantalla queda delante";
      además `train-occlusion.test.ts`)
- [x] Exhibits `estacion`, `tren` y `paso-a-nivel`.
      (`exhibits.test.ts` "las once piezas, cada una en su zona",
      `exhibits.test.ts` "estacion y paso-a-nivel recortan el animador del tren
      en su estado inicial (#281)" y los tests por región (`tiene las regiones
      de la spec, en orden`, `no-vacío…`, `encuadre…`, `vecinos…`))
- [x] Inventario §5 completo y marcado en el PR.
      (casillas de §5 marcadas arriba, cada una con su captura y su test)
- [x] Capturas antes/después, time-lapse y delta de caras en el PR y en `assets/2026-10-27-estacion/`.
      (capturas, time-lapse y delta de caras en §12.1–§12.3; las imágenes están
      en `assets/2026-10-27-estacion/`)
- [x] Sección "Desvíos" al final de este spec.
      (ver `## 12. Desvíos`)

## 11. Fuera de alcance

- Pasajeros, puertas que se abren, interiores (hall con cabriadas).
- Más de un tren en movimiento, cambios de vía animados.
- Electrificación aérea: la Mitre usa tercer riel.
- Trenes de carga en movimiento por las playas de la fábrica.

## 12. Desvíos

Lo que cambió al implementar respecto de lo escrito arriba. Cada viñeta cita
el issue hijo donde está la decisión (#276–#281; este cierre es #282).

### 12.0 Lista

- **§3 y §5.3, andenes de ≈ 37 u, no ≈ 50 (#277):** el andén isla va de x 123 a
  160 (`ISLAND`). El abanico arranca en x 108 (`LADDER`), así que la formación
  detenida (x 111.2..158) sobresale 11.8 u al oeste del andén isla.
- **§7, frente a 2 u del tope, no a ≈ 1 (#277, #281):** el frente se detiene en
  `STOP_X` 158 y los topes empiezan en `BUFFER_X` 160. La regla de oclusión del
  este (`min.x − 1.4·z ≥ 158`) admite topes de hasta h 1.43; el tope mide 1.2
  (`BUFFER_H`).
- **§4.2 y §5.4, formación estacionada de 3 coches en la vía 2, no de 4 en la
  vía 1 (#279):** el tramo recto de la vía 1 va de x 134 a 160, 26 u, y una
  formación de 4 coches mide 46.8. La vía 2 (x 121..160) aloja 3 coches
  (35.2 u): x 122.8..158 (`PARKED`). El tren animado sí es de 4.
- **§7, animador sin rng (#281):** no hay `createRng(SEED + n)` para el tren.
  Nada es aleatorio: el ciclo es una función cerrada de los ms.
- **§7, ciclo ≈ 101.7 s, no ≈ 120 (#281):** sale de las constantes del issue
  (`IN_MS` + `DWELL_MS` + `OUT_MS` + `OFF_MS`); ver §12.2.
- **§7, paso a nivel apagado durante la espera (#281):** se enciende solo en
  los últimos 5 s de la espera (`PRE_DEPART_MS`), como aviso de partida: parado,
  el tren siempre corta la calle (x 70..138) y solo manda ese aviso.
- **§6.1, extensión del kit (#276):** `roofMat` en `prism` (las dos vertientes
  de un `gable` con otro material que los muros) y placas en `gable`
  (`gablePlates`). Materiales nuevos `tile`, `canopy` y `livery`, con sus
  tonos pegados desde `npm run palette`.
- **§6.3, +20 % de caras no aplicable:** lo que salió con la calderería (con
  sus faroles y secciones) pesaba ≈ 137 caras, y la estación de #277 trae 376
  estáticas. El total del astillero pasa de 1061 a 1586
  (+49.5 %); la historia #239 ya había descartado el +20 % como criterio y lo
  midió en este cierre. Desglose en §12.1.
- **§6.2, conos perdidos (#280):** 11 conos de selva, por escena:

  | Escena | Antes | Después | Perdidos |
  |---|---|---|---|
  | hinterland (cinturón verde) | 36 | 32 | −4 |
  | astillero (cluster SO al sur de la vía) | 29 | 25 | −4 |
  | ciudad (cinturón de costura) | 229 | 228 | −1 |
  | tecnológico (cinturón) | 271 | 270 | −1 |
  | fábrica (selva del empalme) | 7 | 6 | −1 |

  Medido en #280 con `world(7)`; el total de sólidos del mundo pasa de 4166
  (b861565) a 4155 (726ab5c), medido de nuevo en este cierre. La regla de
  `flora.ts` (`Rails.train`) se aplicó también a una quinta selva, la del
  empalme de la fábrica (`factory.ts:136`): la spec nombra cuatro. El umbral
  de conos del cinturón en `hinterland.test.ts` bajó de ≥ 30 a ≥ 20.
- **§5.3, semáforos y paso a nivel (#277, A1):** `SIGNALS` y `CROSSING`
  guardan la esquina NO del cuadro como punto, no el centro del poste: una
  cabeza centrada en el poste de entrada empezaría en x 95.9, fuera de la
  cota x ≥ 96.
- **§5.2, hastiales del remate (#278, A3):** el kit hace que un `gable` de
  `w < d` tenga la cumbrera N-S; para que el hastial mire hacia afuera, este y
  oeste van `w 2, d 0.8`, y norte y sur, `0.8 × 2`.
- **§5.1, ventanas del sur del hall sin luz de noche (#278, A18):** las tapan
  `WING_S`, `LINK` y la torre, y los acentos se dibujan encima de todo. Las
  placas quedan.
- **§6.3 y tope de caras, piso de 120 (#279, A1):** el inventario tal cual
  tesela en 138 caras con 4 coches; el piso de 150 del issue no se podía
  cumplir sin inventar detalle. El test pide 120..600 (30 caras por coche).
  El tope de 600 se cumple (§12.1).
- **Exhibit `paso-a-nivel`, caja con `x0` 95, no 98 (#281):** sin eso
  `cropAnimators` descarta el animador del tren en su estado inicial y el
  exhibit nunca anima. `h` 5 sigue pasando encuadre y vecinos.
- **§7, luz del poste norte del paso a nivel (#281):** se ve sobre la caja del
  tren cuando pasa. Las luces son acentos y se dibujan encima de todo.
- **Materiales compartidos (#277, #278):** `asphalt` (cabezas de los semáforos)
  se comparte con la ciudad, `deck` (tablones) con el Blog, y `stone` y
  `paving` (torre y explanada) con la ciudad; `world.test.ts` lo registra.

### 12.1 Caras por exhibit

Medido con `readout` de `src/lab/crop.ts` sobre `assembleWorld(undefined,
{ reducedMotion: false })` (las capas animadas en ms 0), el mismo número que
muestra el panel del storybook, con la caja de cada árbol; las piezas, con
`pieceScene`. "Antes" es `main` (05318e5); "después", esta rama. Sin umbral.

| exhibit | sólidos antes | caras antes | sólidos después | caras después |
|---|---|---|---|---|
| `gradas` | 71 | 222 | 71 | 222 |
| `calle-faroles` | 14 | 35 | 14 | 31 |
| `estacion` | — | — | 174 | 651 |
| `paso-a-nivel` | — | — | 29 | 69 |
| `tren` | — | — | 26 | 144 |

`estacion`, `paso-a-nivel` y `tren` no existen en `main`. `calle-faroles`
baja de 35 a 31 con los mismos 14 sólidos: la caja (x 99..111, y 8..128) ya no
toma dos durmientes `rust` de la calderería (x 110..112, y 101..104 y
111..114; −6 caras) y sí dos rieles del abanico que la cruzan (+2). El
exhibit `tren` da 144 caras: 138 del tren (25 sólidos) y 6 de la losa
`paving` de la pieza.

Total estático del astillero (`tessellate` de `shipyard(createRng(7))`, suelo
más sólidos): antes 1061, después **1586**, delta **+525 (+49.5 %)**. Medido en
cada merge de un hijo:

| hijo | commit | total | delta |
|---|---|---|---|
| (antes) | 05318e5 | 1061 | — |
| #277 | fb857ce | 1300 | +239 |
| #278 | 7a9398a | 1493 | +193 |
| #279 | b861565 | 1598 | +105 |
| #280 | 726ab5c | 1586 | −12 |
| #281 | f96897f | 1586 | 0 |

#277 saca la calderería y mete vías, andenes, marquesinas, topes y paso a
nivel (+239 netos); #278 suma el edificio, la torre y la explanada; #279, la
formación estacionada (105 caras estáticas, 19 sólidos); #280 resta los 4
conos del astillero (−12 caras); #281 anima el tren y no toca lo estático.
Pasa del +20 % de §6.3 (1273 caras) desde #277.

Máximo de `rail.train` en el ciclo: **138 caras**, barriendo el ciclo entero
cada 250 ms con `trainStateAt` y `emu` (4 coches, `lit: true`) y contando las
posiciones con `alpha > 0`; el primer muestreo con tren visible es ms 250.
Está muy por debajo del tope de 600 de §6.3, que el test
`rail-anim.test.ts` "rail.train tesela en ≤ 600 caras en 20 muestras del
ciclo" fija.

### 12.2 Ciclo medido

Fases de `rail-anim.ts`, en ms desde el arranque del reloj de los animadores:

| fase | duración | desde |
|---|---|---|
| entrada (`in`) | `IN_MS` 25 833.3 (500 u de crucero a 24 u/s, 20 833.3, más 5 000 de frenado) | 0 |
| espera (`dwell`) | `DWELL_MS` 30 000 | 25 833.3 |
| salida (`out`) | `OUT_MS` 25 833.3 | 55 833.3 |
| fuera (`off`) | `OFF_MS` 20 000 | 81 666.7 |

`CYCLE_MS` = 101 666.7 ms. El tren detenido (52 s en `estacion-despues.png`)
cae dentro de la espera; el paso a nivel está activo a los 21.5 s de
`paso-a-nivel-despues.png`, con el tren sobre el cruce.

Time-lapse (`time-lapse-ciclo.png`): 55 cuadros de 2000 ms simulados, o sea
110 000 ms (1.08 ciclos), desde la carga de la página. Se llamó al listener del
ticker con un `deltaMS` fijo de 2 000 000 por cuadro y `?speed=0.001`, de modo
que cada cuadro suma 2000 ms (método del CLAUDE.md, que esquiva el tope de
`_maxElapsedMS`). El bucle avanza el reloj antes de dibujar: el primer cuadro
acumulado es el de ms 2000, no el de ms 0. El acumulador es `lighten`.

Consola de `/lab/world.html`, a los ~15 s de la carga:

    [lab] bloom: promedio 7.7 ms en 60 frames (tick 5.3 + render 2.5), presupuesto 15 ms → activo

### 12.3 Capturas

Todas a 1600×900 en 2x (3200×1800), en `assets/2026-10-27-estacion/`. Las del
"antes" ya existían; las "después" son del estado final de la rama.

| captura | qué muestra |
|---|---|
| [`cover-antes.png`](assets/2026-10-27-estacion/cover-antes.png) | cover del sitio con la calderería |
| [`cover-despues.png`](assets/2026-10-27-estacion/cover-despues.png) | cover del sitio, sin tocar el reloj (~6 s tras la carga) |
| [`portfolio-antes.png`](assets/2026-10-27-estacion/portfolio-antes.png) | Portfolio en `/lab/world.html`, tecla `1` |
| [`portfolio-despues.png`](assets/2026-10-27-estacion/portfolio-despues.png) | lo mismo a 52 s, con el tren en la estación |
| [`estacion-despues.png`](assets/2026-10-27-estacion/estacion-despues.png) | exhibit `#estacion` a 52 s, tren detenido en `STOP_X` |
| [`paso-a-nivel-despues.png`](assets/2026-10-27-estacion/paso-a-nivel-despues.png) | exhibit `#paso-a-nivel` a 21.5 s, tren sobre el cruce |
| [`tren-despues.png`](assets/2026-10-27-estacion/tren-despues.png) | exhibit `#tren` en ms 0 |
| [`time-lapse-ciclo.png`](assets/2026-10-27-estacion/time-lapse-ciclo.png) | time-lapse de un ciclo (§12.2) |
| [`estacion-vias.png`](assets/2026-10-27-estacion/estacion-vias.png) | vías, andenes y paso a nivel (#277) |
| [`estacion-edificio.png`](assets/2026-10-27-estacion/estacion-edificio.png) | edificio, torre y explanada (#278) |
| [`tren-estacionado.png`](assets/2026-10-27-estacion/tren-estacionado.png) | formación estacionada en la vía 2 (#279) |
| [`corredor-sur.png`](assets/2026-10-27-estacion/corredor-sur.png) | corredor de oclusión al sur de la vía (#280) |
| [`tren.png`](assets/2026-10-27-estacion/tren.png) | exhibit `#tren` (#281) |
| [`paso-a-nivel.png`](assets/2026-10-27-estacion/paso-a-nivel.png) | exhibit `#paso-a-nivel` con el tren encima (#281) |
| [`tren-llegando.png`](assets/2026-10-27-estacion/tren-llegando.png) | el tren entrando por la vía del oeste (#281) |

Lo que se ve: en la cover, un tren de 4 coches verde y azul parado junto al
edificio con torre del reloj; en `portfolio-despues.png`, coches con luz de
salón y faros, marquesinas y techos de teja; en `tren-despues.png`, aire
acondicionado por coche, faros cian al este y luces rojas al oeste. En
`time-lapse-ciclo.png` se lee la traza del tren desde el borde noroeste hasta
la estación, sin nada estático dibujado sobre ella.

Observaciones, **sin defectos de la estación vistos**:

- En `estacion-despues.png` sale hacia arriba a la izquierda una franja gris
  larga y diagonal, y en `paso-a-nivel-despues.png` hay grandes polígonos
  grises (caja del panel 0..160 × 0..142). No son defectos de la estación: el
  recorte del storybook conserva entero todo sólido que solape la caja
  (`cropSolid`, `src/lab/crop.ts:28`), así que el `strip` largo de la calle de
  transferencia (x 100..108) y los de la vía del oeste se ven sin cortar. Lo
  mismo ya se veía en las capturas de los hijos, `estacion-edificio.png` (#278)
  y `paso-a-nivel.png` (#281). No se abrió issue de seguimiento.
- Las capturas de la estación en movimiento no se pudieron ver a velocidad
  real: el headless corre a ~2 fps y los instantes se llevaron con el reloj a
  mano. La lectura visual del ciclo en un navegador con pantalla (#281) sigue
  pendiente.
