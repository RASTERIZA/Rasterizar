# Plataformas Studio

Programa para **crear y editar juegos de plataformas** al estilo Mario, directamente en el navegador.
No necesita instalación ni conexión a internet: abre `index.html` con doble clic (Chrome, Edge, Firefox o Safari).

## Qué incluye

- **Editor de niveles** por casillas: lápiz, goma, rectángulo, relleno, cuentagotas y mano; deshacer/rehacer (120 pasos), zoom, minimapa y cuadrícula.
- **Cinco escenarios:** Día, Tarde, Noche, Cueva y Neón, con fondos en parallax, estrellas, nubes, iluminación dinámica (Noche y Cueva) y efectos de color.
- **Música original** (5 pistas compuestas por código, sin archivos de audio): Aventura, Neón, Noche, Cueva y Turbo. Cada nivel puede usar la pista automática de su escenario, otra distinta o ninguna. Hay vista previa en el editor y volúmenes de música y efectos.
- **Elementos:** suelo, ladrillos, bloques `?` (moneda u hongo), bloques duros, tubos, **resortes**, monedas, **gemas**, pinchos, meta, nubes y arbustos.
- **Personajes:** punto de inicio, enemigo caminante, enemigo con pinchos y **murciélago** volador.
- **Juego pulido:** partículas, sacudida de cámara, deformación al saltar y aterrizar, sombras, combos al pisar enemigos, marcador moderno, pantalla de título, resultados con estrellas y récord guardado por nivel.
- **Modo prueba (▶ Probar o tecla `P`):** juega el nivel al instante dentro del editor.
- **Reglas editables:** gravedad, fuerza de salto, velocidad, tiempo, vidas y tamaño del nivel.
- **Guardar / Abrir** niveles en archivos `.json`. El nivel también se guarda solo en el navegador.
- **Exportar juego:** genera un único archivo `.html` jugable (con título, música y controles táctiles) que se puede enviar a cualquiera.

## Controles del editor

| Acción | Cómo |
| --- | --- |
| Dibujar / borrar | clic izquierdo / clic derecho |
| Mover la vista | rueda del ratón, `Espacio` + arrastrar, botón central, herramienta Mano o clic en el minimapa |
| Mover en vertical | `Shift` + rueda |
| Zoom | `Ctrl` + rueda |
| Herramientas | `B` lápiz · `E` goma · `R` rectángulo · `G` relleno · `I` cuentagotas · `H` mano |
| Elegir elemento | teclas `1`–`9` o clic en la paleta |
| Deshacer / rehacer / guardar | `Ctrl+Z` / `Ctrl+Y` / `Ctrl+S` |
| Ayuda | botón `?` |

## Controles del juego

Mover `←` `→` o `A` `D` · Saltar `Espacio`, `↑` o `Z` · Correr `Shift` o `X` · Música `M` · Efectos `N` · Pausa `P` · Salir `Esc`.

Reglas: pisar al enemigo lo elimina (varios seguidos suman más puntos); el hongo hace crecer al jugador (puede romper ladrillos y aguantar un golpe); el resorte lanza muy alto; caer al vacío, tocar pinchos o agotar el tiempo cuesta una vida; tocar la meta completa el nivel. Las estrellas finales premian completar el nivel, juntar el 70 % de las monedas y recoger todas las gemas.

## En el celular o la tablet

Funciona en el navegador del teléfono.

- **Editor:** un dedo dibuja con la herramienta elegida; dos dedos mueven y hacen zoom; la herramienta **Mano** desplaza con un solo dedo; la goma borra (no hay clic derecho).
- **Juego:** al tocar la pantalla aparecen los botones ◀ ▶ (mover), salto y correr (se pueden pulsar varios a la vez), además de música, pausa y salir. Conviene girar el celular en horizontal.

## Notas técnicas

- Un solo archivo (`index.html`), sin dependencias. Los gráficos y la música se generan por código; no hay imágenes ni audio externos. La tipografía Inter se carga de Google Fonts si hay conexión; sin conexión se usa la del sistema.
- El motor del juego está en el bloque `<script id="engine">`; el editor lo usa para probar el nivel y lo copia tal cual al exportar.
- Formato del nivel (`.json`): `w`, `h`, `theme` (`dia`, `atardecer`, `noche`, `cueva`, `neon`), `music` (`auto`, `none` o el id de una pista), `settings`, `tiles` (lista de `w*h` números, 0 = vacío) y `entities` (`player`, `goomba`, `spiky`, `bat` con `c`, `r`). Los niveles de la versión anterior se abren sin cambios.
