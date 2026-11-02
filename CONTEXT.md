# mapa

Un mundo isométrico en pixel art que es la navegación del sitio: cada zona (Portfolio, Blog, Resume) es un barrio de un mismo mapa.

## Lenguaje

### Zonas

**Zona**:
Una de las tres secciones del sitio (Portfolio, Blog, Resume) y la porción del mapa que le pertenece. Un punto pertenece a una zona por su posición geográfica.
_Evitar_: sección, mundo

**Velo**:
El oscurecimiento de las zonas que no tienen el foco. Una luz se vela con la zona donde está parada; las luces de un barco en movimiento se velan con la zona del barco.
_Evitar_: dim, máscara

### Barcos

**Casco**:
El sólido que es el cuerpo de un barco hasta su cubierta, con arrufo en proa y popa.

**Pieza de cubierta**:
Un sólido del barco cuya base apoya en la cubierta del casco y cae dentro del casco en planta. Siempre se dibuja después del casco.
_Evitar_: superestructura, pieza de arriba

**Pieza de costado**:
Un sólido del barco que solapa el casco en planta pero empieza por debajo de la cubierta: defensas, cubiertas de goma, bloques de lanzamiento. Se dibuja después del casco en el costado que mira al espectador y antes en el costado lejano.
_Evitar_: pieza montada en el casco

**Pluma**:
El brazo inclinado de una grúa de cubierta, que sale de la cabina y sostiene el gancho.
_Evitar_: jib, brazo

**Estay**:
El cable tenso que va de la cabina de una grúa a la punta de su pluma.
