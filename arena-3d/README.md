# Arena Nocturna

Juego de **peleas 3D uno contra uno** en el navegador, con render de aspecto de consola: iluminación física (PBR), sombras suaves, suelo mojado con reflejos reales, lluvia, letreros de neón con bloom y post-procesado (tono ACES, viñeta, aberración cromática, grano y cámara lenta con zoom en el K.O.).

Abre `index.html` con doble clic. El motor 3D (Three.js r128) se carga de internet; si no hay conexión, usa la copia local `three.min.js` que está en la misma carpeta.

## Qué incluye

- **Escenario:** azotea nocturna bajo la lluvia, con rascacielos iluminados, letreros de neón, relámpagos y niebla.
- **Tres luchadores:** Kael (equilibrado), Nyx (rápida) y Tauro (pesado), con figuras 3D generadas por código y animación procedural (guardia, caminar, puño, patada, especial, bloqueo, golpe recibido, K.O. y festejo).
- **Modos:** contra la máquina (fácil, normal y difícil) o dos jugadores en el mismo teclado.
- **Reglas:** mejor de 3 asaltos de 99 segundos. Puño (rápido), patada (fuerte), bloqueo (reduce el daño a casi nada), salto y **especial** cuando se llena la barra. Los golpes seguidos hacen combo; el daño baja un poco en cada golpe del combo.
- **Efectos:** chispas, destellos, sacudida de cámara, pausa de impacto, aura del especial, cámara lenta en el K.O. y pantalla de resultados con estadísticas.
- **Música y sonido** sintetizados por código: tema de menú, tema de pelea, golpes, bloqueos, campana, trueno y ambiente de lluvia.
- **Celular:** botones táctiles en pantalla (aparecen al tocar). Conviene girar el celular en horizontal.
- **Calidad:** Alta, Media o Baja (en el menú principal), para equipos menos potentes.

## Controles

| | Jugador 1 | Jugador 2 |
| --- | --- | --- |
| Mover | `A` `D` | `←` `→` |
| Saltar | `W` | `↑` |
| Puño | `J` (o `U`) | `1` |
| Patada | `K` (o `O`) | `2` |
| Bloquear | `L` (mantener) | `3` |
| Especial | `I` | `4` |

`P` pausa · `M` música · `N` efectos · `Esc` volver al menú · `Enter` confirmar.

## Notas técnicas

- Un solo `index.html` más `three.min.js` (copia de respaldo del motor). No hay imágenes ni audio externos: las texturas del suelo (albedo, rugosidad y normales), las ventanas de los edificios y los sonidos se generan al arrancar.
- El post-procesado se hace con una cadena propia: brillo → desenfoque en dos pasadas → composición final. Al iniciar, el juego comprueba que la cadena produce una imagen válida y, si el dispositivo no soporta alguna configuración (por ejemplo, texturas de medio flotante), cambia a otra compatible.
- Los reflejos del suelo se obtienen pintando la escena desde una cámara espejo y proyectándola sobre el material del suelo según su rugosidad; en los charcos el reflejo es nítido y en el concreto, difuso.
- Sobre el realismo: no hay modelos escaneados ni animación capturada. Lo que se logra es iluminación y materiales de aspecto realista sobre figuras estilizadas.
