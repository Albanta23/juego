# Unity Star Runner

Juego Unity fuente para integrarlo en el panel web del arcade como build WebGL.

## Como abrirlo

1. Abre Unity Hub.
2. Add project from disk.
3. Selecciona `unity/StarRunner`.
4. En Unity, abre el menu `Tools > Star Runner > Create Scene`.
5. Pulsa Play para probar.

## Como exportarlo a la web

El build WebGL ya esta generado en `web/unity/starrunner/`. Coolify lo publicara
al desplegar los cambios del repositorio.

Para regenerarlo tras un cambio, usa `Tools > Star Runner > Build WebGL`.
El export se produce directamente en `web/unity/starrunner/`.

El panel web ya tiene la tarjeta `UNITY STAR RUNNER` y carga `web/unity/starrunner/index.html`.
