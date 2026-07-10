# Unity Star Runner

Juego Unity fuente para integrarlo en el panel web del arcade como build WebGL.

## Como abrirlo

1. Abre Unity Hub.
2. Add project from disk.
3. Selecciona `unity/StarRunner`.
4. En Unity, abre el menu `Tools > Star Runner > Create Scene`.
5. Pulsa Play para probar.

## Como exportarlo a la web

1. File > Build Settings.
2. Selecciona `WebGL`.
3. Pulsa `Switch Platform`.
4. Build en una carpeta temporal.
5. Copia el contenido generado dentro de `web/unity/starrunner/`.

El panel web ya tiene la tarjeta `UNITY STAR RUNNER` y carga `web/unity/starrunner/index.html`.
