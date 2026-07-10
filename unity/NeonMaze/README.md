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

El build WebGL ya esta generado en `web/unity/neonmaze/`. Coolify lo publicara
al desplegar los cambios del repositorio.

Para regenerarlo tras cambiar el juego, abre **Tools > Neon Maze > Build WebGL**.
El export se produce directamente en `web/unity/neonmaze/` y evita compresion
propia de Unity para funcionar en cualquier servidor estatico.

La tarjeta `UNITY NEON MAZE` del panel ya carga esa ruta.
