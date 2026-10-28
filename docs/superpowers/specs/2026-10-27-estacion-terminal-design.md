# Estación terminal (Tigre) con tren animado

**Fecha:** 2026-10-27
**Estado:** aprobado, listo para agente. Depende de
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

- [ ] Hall de un piso de ladrillo `brick`, alero a ≈ 8 u, con **techo a dos
      aguas o a cuatro aguas de teja**. Material nuevo `tile` (terracota) si
      `rust` no lee como teja.
- [ ] **Linterna vidriada** a lo largo de la cumbrera del hall: caja baja de
      marco oscuro con vidrio, encendida de noche.
- [ ] **Medio punto** (abanico vidriado) bajo un arco de ladrillo en el
      piñón principal.
- [ ] **Cornisa dentada** de ladrillo (impostas) en los piñones.
- [ ] **Pórtico de acceso** sobre la fachada este: marquesina de acero y
      vidrio verde de ≈ 10 u de ancho, dos columnas redondas verdes y faja
      con el cartel "ESTACION TIGRE" como placa clara (sin texto real).
- [ ] Debajo del pórtico, **tres ventanales vidriados** con parteluces verdes
      (`facade` con `grid`) y **pilastras de ladrillo** entre ellos.
- [ ] **Zócalo** verde grisáceo y farolas de pared.
- [ ] **Alas bajas** con techo propio de teja y toldos rojos (`signal`) de
      los locales.
- [ ] De noche: el pórtico y la linterna con luz cálida (acentos ámbar) y
      ventanas encendidas.

### 5.2 Torre del reloj

- [ ] Fuste de **piedra beige** (`stone`), planta cuadrada, con ranuras
      angostas (placas oscuras) más abajo.
- [ ] Cuerpo del reloj arriba: **cuatro esferas blancas** (disco
      `whitewash` con anillo dorado `safety` o `stockbrick`). Las de las caras
      +x y +y se ven; las otras dos se modelan igual.
- [ ] **Ménsulas o pináculos dorados** en las cuatro esquinas del cuerpo
      del reloj.
- [ ] Remate de **teja empinado** con hastiales de piedra en cada cara y un
      respiradero cuadrado en cada hastial.
- [ ] De noche: las esferas iluminadas (acento cálido), el foco del conjunto.

### 5.3 Andenes y vías

- [ ] Tres vías de trocha 3 con durmientes `rust` cada 4 u, como la vía del
      oeste; el **tercer riel** como franja clara al costado de cada vía.
- [ ] **Abanico de cambios** de la vía 3 a las vías 1 y 2.
- [ ] Andenes de hormigón (`concrete` o `paving`) con **franja amarilla** en
      el borde.
- [ ] **Marquesinas verdes** (material nuevo `canopy`, verde oscuro de chapa)
      con columnas finas, cabriadas triangulares y faja; luces bajo la
      marquesina (acentos fríos).
- [ ] **Topes** a franjas amarillas y negras con **luz roja** encima.
- [ ] **Andén transversal** con marquesina baja contra el edificio y baranda.
- [ ] **Semáforos** de vía (poste con dos o tres luces) a la salida del
      abanico, con el aspecto que corresponda al tren (§7).
- [ ] **Paso a nivel**: tablones sobre la calle, dos barreras (brazo `beam`
      a franjas rojas y blancas) y dos postes con luces rojas que titilan
      mientras pasa el tren.

### 5.4 Tren EMU (Línea Mitre)

- [ ] **4 coches**, caja blanca (`whitewash`) con una **banda azul ancha**
      sobre la línea de ventanas (material nuevo `livery`, azul cobalto) y
      **filetes** azules finos abajo.
- [ ] **Banda de ventanas** oscura (`glass`) que de noche se ve **encendida**
      (blanco frío) en el salón.
- [ ] **Tres puertas azules** por lado y por coche.
- [ ] Techo gris claro con **un equipo de aire acondicionado** por coche
      (caja con rejillas, ≈ 1/3 del largo). **Sin pantógrafo.**
- [ ] **Frentes de cabina** en los dos extremos: casi planos, parabrisas
      envolvente negro, cartel LED arriba (acento ámbar), mitad superior
      azul y franja blanca abajo, **faros** en las esquinas inferiores y
      **enganche amarillo**.
- [ ] Bogies y bastidor grises oscuros (`steel`); fuelles entre coches.
- [ ] Luces: **faros blancos** adelante y **rojas** atrás según el sentido
      de marcha (se invierten al salir).

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

- [ ] `npm run typecheck` y `npm test` pasan, incluida la guarda de paleta.
- [ ] Calderería eliminada; estación dentro de §4.1; tests de vecindad.
- [ ] Tren con el ciclo de §7; tests de ciclo, luces, paso a nivel, `reducedMotion`, oclusión y tope de 600 caras.
- [ ] Exhibits `estacion`, `tren` y `paso-a-nivel`.
- [ ] Inventario §5 completo y marcado en el PR.
- [ ] Capturas antes/después, time-lapse y delta de caras en el PR y en `assets/2026-10-27-estacion/`.
- [ ] Sección "Desvíos" al final de este spec.

## 11. Fuera de alcance

- Pasajeros, puertas que se abren, interiores (hall con cabriadas).
- Más de un tren en movimiento, cambios de vía animados.
- Electrificación aérea: la Mitre usa tercer riel.
- Trenes de carga en movimiento por las playas de la fábrica.
