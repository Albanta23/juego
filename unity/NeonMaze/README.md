# Unity Neon Maze

Comecocos clasico redisenado en 3D neon. Incluye laberinto, bolitas de energia,
cuatro perseguidores, orbes de poder, tres vidas, niveles progresivos y controles
de teclado, botones tactiles y deslizamiento en pantalla.

## Abrir y jugar

1. En Unity Hub, selecciona **Add project from disk** y elige `unity/NeonMaze`.
2. Abre **Tools > Neon Maze > Create Scene**.
3. Pulsa Play.

Controles: flechas o WASD en escritorio; botones inferiores y swipe en movil.

## Integracion WebGL

1. Abre **File > Build Settings**, selecciona **WebGL** y pulsa **Switch Platform**.
2. Genera el build dentro de una carpeta temporal.
3. Copia los archivos generados a `web/unity/neonmaze/`, sustituyendo la pagina
   temporal actual.

La tarjeta `UNITY NEON MAZE` del panel ya carga esa ruta.
