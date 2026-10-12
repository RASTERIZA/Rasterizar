# Editor de Plataformas

Programa para **crear y editar juegos de plataformas** al estilo Mario, directamente en el navegador.
No necesita instalación ni conexión a internet: abre `index.html` con doble clic (Chrome, Edge, Firefox o Safari).

## Qué incluye

- **Editor de niveles** por casillas: lápiz, goma, rectángulo, relleno y cuentagotas, con deshacer/rehacer ilimitado (120 pasos), zoom y desplazamiento.
- **Elementos:** suelo, ladrillos, bloques `?` (con moneda o con hongo), bloques duros, tubos, monedas, pinchos, meta, nubes y arbustos.
- **Personajes:** punto de inicio del jugador y dos tipos de enemigo (uno se puede pisar, el otro tiene pinchos).
- **Modo prueba (▶ Probar o tecla `P`):** juega el nivel al instante dentro del editor.
- **Reglas editables:** gravedad, fuerza de salto, velocidad, tiempo, vidas, tamaño del nivel y color del cielo.
- **Guardar / Abrir** niveles en archivos `.json`. El nivel también se guarda solo en el navegador.
- **Exportar juego:** genera un único archivo `.html` jugable que se puede enviar a cualquiera.

## Controles del editor

| Acción | Cómo |
| --- | --- |
| Dibujar / borrar | clic izquierdo / clic derecho |
| Mover la vista | rueda del ratón, o `Espacio` + arrastrar, o botón central |
| Mover en vertical | `Shift` + rueda |
| Zoom | `Ctrl` + rueda |
| Herramientas | `B` lápiz · `E` goma · `R` rectángulo · `G` relleno · `I` cuentagotas |
| Elegir elemento | teclas `1`–`9` o clic en la paleta |
| Deshacer / rehacer / guardar | `Ctrl+Z` / `Ctrl+Y` / `Ctrl+S` |

## Controles del juego

Mover `←` `→` o `A` `D` · Saltar `Espacio`, `↑` o `Z` · Correr `Shift` o `X` · Pausa `P` · Sonido `M` · Salir `Esc`.

Reglas: pisar al enemigo lo elimina; el hongo hace crecer al jugador (puede romper ladrillos y aguantar un golpe); caer al vacío, tocar pinchos o agotar el tiempo cuesta una vida; tocar la meta completa el nivel.

## En el celular o la tablet

Funciona en el navegador del teléfono (Chrome, Safari, etc.).

- **Editor:** un dedo dibuja con la herramienta elegida; dos dedos mueven y hacen zoom; la herramienta **✋ Mover** desplaza con un solo dedo; **🧽 Goma** borra (no hay clic derecho).
- **Juego:** al tocar la pantalla aparecen los botones ◀ ▶ (mover), SALTO y CORRER (se pueden pulsar varios a la vez), además de pausa y salir. Conviene girar el celular en horizontal.
- **Exportar juego** descarga un `.html` que también se juega con los botones táctiles. En iPhone/iPad puede ser más cómodo abrirlo desde la app Archivos o publicarlo en una página web.

## Notas técnicas

- Un solo archivo (`index.html`), sin dependencias. Todos los gráficos y sonidos se generan por código, así que no hay imágenes ni audio externos.
- El motor del juego está en el bloque `<script id="engine">`; el editor lo usa para probar el nivel y lo copia tal cual al exportar.
- Formato del nivel (`.json`): `w`, `h`, `sky`, `settings`, `tiles` (lista de `w*h` números, 0 = vacío) y `entities` (`player`, `goomba`, `spiky` con `c`, `r`).
