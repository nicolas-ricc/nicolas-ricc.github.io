# Storybook: fuera las luces redondas, encuadre y recortes limpios

Fecha: 2026-11-16. Origen: 11 capturas del storybook (`/lab/storybook.html`)
en un teléfono plegable, en `assets/2026-11-16-storybook-luces/01..11.jpg`.

| # | Exhibit | Captura |
|---|---------|---------|
| 1 | Truck yard | 01 |
| 2 | Slipways | 02 |
| 3 | Terminal station | 03 |
| 4 | Container yard (east bank) | 04 |
| 5 | Quay crane | 05 |
| 6 | Portfolio tinker sign in its scene | 06 |
| 7 | Silos | 07 |
| 8 | Container yard (hinterland) | 08 |
| 9 | Bumper cars | 09 |
| 10 | Lighthouse | 10 |
| 11 | Wreck | 11 |

## 1. Luces redondas (accent `kind: "dot"`)

La "luz redonda con halo" es el accent `dot` que `drawAccents` dibuja con
`HALO_BASE`/`HALO_FALLBACK` (`src/world/frame.ts:62-80`). En estas piezas
sobra por completo.

### Alcance acordado con el dueño

- **Solo los dots que se ven en las 11 piezas de arriba.** El tipo `dot`, el
  halo y el resto del mundo (lámparas `lamp()` ámbar de la ciudad, Lamp street,
  feria fuera de Bumper cars, etc.) **quedan**.
- Los exhibits de región son recortes del mundo vivo
  (`src/lab/storybook.ts:41` llama a `assembleWorld` como `src/main.ts:54`),
  así que el cambio se hace **en los builders de escena**, y esas luces
  desaparecen también del sitio en esas zonas. No hay que filtrarlas solo en el
  storybook: el storybook tiene que seguir mostrando lo mismo que el sitio.
- **Si la luz viene de una lámpara con poste** (`industrialLamp`), se va la
  lámpara **entera**: poste y bulbo. No pueden quedar postes de acero sueltos.
- **Las luces con función** (la linterna/galería del faro, los faros y luces
  rojas del tren, las señales ferroviarias y las boyas) se **reemplazan por un
  accent `poly` chico sin halo** (como las ventanas o el haz), no se borran.
- No hay que editar a ciegas los helpers compartidos (`industrialLamp`,
  `quayCraneAt`, `towerCrane`): se usan también en exhibits que no forman parte
  de este cambio (Boiler house, Substation, Lamp street, Level crossing,
  Floating dock, North point, Rail yard y los reflectores del cartel RESUME,
  `sign-crown.ts:104`). Hay que sacar la llamada en el sitio puntual o pasar
  una opción.

### Inventario (lectura del código, 2026-11-16; verificar al implementar)

| Exhibit | Dot | Origen | Acción |
|---|---|---|---|
| Truck yard | 8 × `industrialLamp` cian r 1.2 | `factory.ts:107` (truckYard, 2), `factory.ts:135` (lamps, 3), `shipyard.ts:200` (seamFence, 3 dentro del box) | quitar lámpara entera |
| Slipways | 2 × `industrialLamp` | `shipyard.ts:193` (y 40, 68) | quitar lámpara entera |
| Slipways | lámpara del carro del pórtico, cyanMid r 1.4 | `shipyard-anim.ts:46` | quitar |
| Slipways | chispas de soldadura, spark r 0.6 | `shipyard-anim.ts:55` | quitar |
| Terminal station | 8 dots de andén/marquesina cyanMid r 0.8 | `station.ts:109`, `:113` | quitar |
| Terminal station | 3 dots en paragolpes magenta r 0.35 | `station.ts:122` | poly chico (señal de fin de vía) |
| Terminal station | 3 dots del pórtico ámbar r 0.9; 2 apliques ámbar r 0.5 | `station.ts:210`, `:211` | quitar |
| Terminal station | 2 `industrialLamp` de la explanada + 1 de `shipyard.ts:193` (y 124) | `station.ts:259`, `shipyard.ts:193` | quitar lámpara entera |
| Terminal station | señal de salida, cruce sur | `rail-anim.ts:145`, `:139` | poly chico |
| Terminal station | faros cian r 0.3 / luces rojas magenta r 0.25 del tren | `train.ts:82-83` | poly chico |
| Container yard (east bank) | 2 `industrialLamp` | `shipyard-east.ts:82` | quitar lámpara entera |
| Container yard (east bank), Quay crane | punta de pluma cian r 1 (×2 en el patio, ×1 en la pieza) | `kit/forms/industrial.ts:232` (`quayCraneAt`) | quitar |
| Tinker sign in its scene | reflector `industrialLamp` (recoloreado a ámbar) sobre el techo | `sign-tinker.ts:253-254` | quitar lámpara entera |
| Tinker sign in its scene | punta de la grúa torre de la fábrica, cian r 1 | `pieces.ts:29` (desde `factory.ts:145`) | quitar en esa grúa |
| Tinker sign in its scene | bombitas de marquesina de las "O" (amberMid r 0.3, estáticas + 1 animada) | `sign-tinker.ts:86/119`, `:137`, `:275-292` | **quedan**: son lettering del cartel, no la luz redonda con halo. Ver la pregunta abierta |
| Silos | 1 `industrialLamp` (32, −180) | `hinterland.ts:188` | quitar lámpara entera |
| Container yard (hinterland) | 2 `industrialLamp` | `hinterland.ts:149` | quitar lámpara entera |
| Bumper cars | 6 dots cian r 0.4 bajo el techo | `fair.ts:364` | quitar |
| Lighthouse | neón de galería, 2 de 8 puntos encendidos, magenta r 0.45 | `sea-anim.ts:170`, `sea.ts:176`, `GALLERY_LIT` `sea-anim.ts:50` | poly chico sin halo (sigue girando) |
| Wreck | dot de la boya del naufragio, magentaMid r 1 | `sea.ts:120` | poly chico (es una boya) |

Pregunta abierta para quien implemente: si las bombitas de la marquesina del
cartel PORTFOLIO se ven con halo en la captura 06, tratalas igual que el resto
(poly sin halo) y no las borres. Las letras se tienen que seguir leyendo.

### Tests que fijan estas luces (hay que actualizarlos, no borrarlos)

`props.test.ts:13-37` (los helpers quedan iguales), `factory.test.ts:138,217-221`,
`seam-90.test.ts:123-131`, `shipyard.test.ts:51-64,114-118`,
`station.test.ts:145,158,234,444-448`,
`shipyard-east.test.ts:60,135,158-160`, `industrial.test.ts:224-231`,
`exhibits.test.ts:103,144-148,425-429`, `shipyard-anim.test.ts:43,82-87`,
`hinterland.test.ts:59-60,78`, `fair.test.ts:55`, `sea.test.ts:97`,
`sea-anim.test.ts:303-309`, `portfolio-accents.test.ts:44`. Reescribí cada
aserción para que fije el estado nuevo: ningún dot en esas zonas, y los polys
de reemplazo donde corresponde.

## 2. Encuadre: la pieza se corta en los costados

En casi todas las capturas el contenido se sale del canvas por izquierda o
derecha (el haz y la roca del faro, el hexágono de Bumper cars, Silos y los
dos container yards).

Causa: `fitTransform(boxFrame(box, h), …)` (`storybook.ts:59-67`,
`world/frame.ts:16-21,45-55`) encuadra solo el rombo del box a nivel del suelo,
más la esquina norte elevada a `h`, con un 4 % de margen. No incluye:

- las sombras, que caen hacia el ENE unas 3 u por unidad de altura, con tope
  en 18 de alto (`iso/light.ts:15-42`);
- los sólidos que el recorte conserva enteros;
- los halos;
- en el faro, el haz (un poly animado).

En un canvas vertical (teléfono) manda el ancho, y todo lo que queda fuera del
rombo se pierde. Además `lab/storybook.html:10` fija
`grid-template-columns: 14rem 1fr 16rem` sin media query, así que en un
teléfono el canvas se queda con lo que sobra de 30rem.

Se pide:

- Encuadrar con los límites proyectados reales de lo que se dibuja: sólidos,
  suelo, sombras y accents (los animados incluidos, por ejemplo con el máximo
  alcance del haz o tomando unos cuantos frames), no solo el rombo del box.
- Hacer responsive el layout del storybook: en pantallas angostas, la lista y
  el panel de datos van arriba o abajo del canvas, y el canvas usa el ancho
  completo.
- `?c=` (cover scale, `lab/cover-scale.ts`) sigue funcionando como hoy.

## 3. Recortes: losas y calles que entran por tocar el borde

`cropSolid` (`lab/crop.ts:13-15,29-33`) conserva **entero** cualquier sólido
o tira cuyo plano se superponga con el box, y **tocar un borde cuenta**. Así
se cuelan cosas:

- **Truck yard (01):** los plintos de las manzanas de la ciudad en y 92
  (`city.ts:49/55`, `city-grid.ts:18`) aparecen como losas grises peladas,
  porque sus edificios empiezan en y ≥ 93.5. Las líneas centrales de las calles
  N-S (`city/streets.ts:44-58,78-79`) son las líneas finas. La cerca de la
  costura (`shipyard.ts:198`) atraviesa el box y sigue hasta x −60.
- **Terminal station (03) y Slipways (02):** la calle de transferencia
  (`shipyard.ts:74`, x 100..108) toca x0 = 108 y el muelle (`shipyard.ts:59`,
  x 198..202) toca x1 = 198. Los dos se van hacia el norte, fuera del cuadro.
- **Tinker sign in its scene (06):** la misma calle toca la esquina (100, 0) y
  sigue hasta y 142. Los rieles del desvío de la fábrica (`factory.ts:98`,
  x −60..110) se salen hacia los dos lados.
- **Silos (07):** la ruta de hinterland (`hinterland.ts:187`), el triángulo
  gris de la derecha.

Se pide:

- Un sólido que solo **toca** el borde del box no entra (superposición
  estricta).
- Lo que atraviesa el box (tiras de calle, rieles, cercas, muelles, prismas
  largos) se **recorta al box** en lugar de entrar entero.
- Un plinto cuya manzana queda fuera del box no aparece pelado.
- El encuadre del punto 2 se calcula después de este recorte, para que las
  tiras largas no achiquen la pieza.

## 4. Quay crane: la pluma no se lee

La pieza (05) muestra patas y un brazo corto y empinado, pero la sombra
dibuja una pluma larga. La pluma existe (`industrial.ts:229`). Es corta por
diseño: 3.4 u de alcance horizontal y 5.5 u de subida. El sol bajo
(`SHADOW_PER_UNIT` ≈ 3) estira su sombra hasta unos 13.5 u, y por eso parece
que falta algo.

Se pide: una pluma que se lea como la de una grúa de muelle (STS), casi
horizontal, que salga sobre el agua hacia el oeste, con el tope de z ≤ 18 y
las puntas en x < 280 en el patio este (`shipyard-east.test.ts:158-160`). La
sombra tiene que corresponder a lo que se ve. Sin la luz de la punta (punto 1).

## 5. Wreck: línea vertical tenue

En la captura 11 hay una línea vertical tenue muy por encima del barco
(aprox. x 840, y 540–700 sobre 1774 de ancho). El mástil (`sea.ts:165`,
z 2.8..7.3) está pegado al casco, así que probablemente no es eso. Hay que
diagnosticarla en el storybook (screenshot con agent-browser y la API de
`__PIXI_DEVTOOLS_WRAPPER__`, ver `CLAUDE.md`). Puede ser un accent animado
(el haz del faro, `sea-anim.ts:181`) que pasa por el recorte, o un borde de
sprite o filtro. Se elimina en el origen.

## Criterios de aceptación

1. En los 11 exhibits no queda ningún accent `dot`. Se verifica con un test
   que recorre los exhibits (accents estáticos más varios frames de los
   animadores) y afirma 0 dots, salvo las bombitas de marquesina si se
   conservan como lettering. No queda ningún poste de `industrialLamp`
   huérfano.
2. Faro, tren, señales ferroviarias, paragolpes y boya del naufragio llevan un
   accent `poly` sin halo en lugar del dot.
3. El resto del mundo conserva sus dots, y `lamp()`/`industrialLamp()` no
   cambian de forma.
4. En un viewport de teléfono (≈ 412×915 CSS px, 2×) y en desktop
   (1600×900), ninguno de los 11 exhibits queda cortado por el canvas, sombras
   y haz del faro incluidos. Hay que adjuntar capturas antes y después en el PR.
5. Las regiones no muestran sólidos que solo tocan el borde, y las tiras
   largas se recortan al box: sin losas peladas en Truck yard y sin calles ni
   muelles que se escapan en Terminal station, Slipways, Tinker sign y Silos.
6. La pluma de la Quay crane se lee en la pieza y en el patio este, y su
   sombra corresponde a lo que se ve.
7. La línea vertical del Wreck no aparece.
8. `npm test` y `npm run typecheck` pasan.
