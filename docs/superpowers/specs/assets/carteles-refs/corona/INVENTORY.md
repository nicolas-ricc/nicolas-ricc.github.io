# Inventario de la corona de la torre (cartel de Resume)

- [x] Panel oscuro de corona sobre la azotea, más ancho que la torre, con la palabra en letras corpóreas verdes — `cartel-torre-real.png` (panel `officeDark` de ≈ 50 u sobre una torre de 16 × 14: los extremos vuelan fuera de la azotea, dato para la integración)
- [x] Letras de cara llena (no tubo), con aire parejo entre ellas — `cartel-torre-real.png` (relleno `green` alpha 1, sin halo propio; aire ≈ 1.2 w)
- [x] Estructura de acero: postes sobre la azotea, vigas del panel y tensores a la cornisa — `cartel-torre-real.png` (postes bajo el panel y tensores a las esquinas de la cornisa; las vigas son el canto superior e inferior del panel)
- [x] Helipuerto sobre la corona: losa, disco con "H", 16 luces de borde verdes, red, reflectores ámbar — `cartel-torre-real.png` (losa r 7 a 1.4 u sobre el panel, reflectores en el borde NO)
- [x] La sala de máquinas y la antena reales quedan bajo la losa; nada de la corona las atraviesa — `cartel-torre-real.png` (sala de máquinas visible entre los postes; `sign-crown.test.ts` sin interpenetración sobre la torre de muestra). La luz de la antena real es un acento y se ve tenue a través del panel entre la "s" y la "u"
- [x] En `#cartel-torre-escena` la palabra se lee a 1.17 y a 0.83 sin que un vecino la tape — `cartel-torre-escena-117.png`, `cartel-torre-escena-083.png` (oclusión 0; nivel 3 en ✓ en `carteles-legibilidad/REPORT.md`)

Capturas en `docs/superpowers/specs/assets/374-carteles/`.

Referencias por ítem: panel oscuro más ancho que la torre 02; letras de cara llena
con aire parejo 01, 02, 05 (las letras "EQ" sobre el remate); estructura de acero
(postes, vigas, tensores) 01; helipuerto sobre la corona: sin foto propia, ver
`../helipuerto/` (01–04); sala de máquinas y antena bajo la corona 02 (antena sobre
el panel), 03, 04 (remates iluminados); lectura de la palabra con vecinos 01 (letras
contra el cielo), 05 (letras entre torres vecinas).
