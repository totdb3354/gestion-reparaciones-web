# Despliegue en la VM de producción

Los ficheros de esta carpeta son la referencia versionada de lo que vive en `/opt/reparaciones` de la VM:
- `docker-compose.prod.yml` → `/opt/reparaciones/docker-compose.yml` (sustituir `CAMBIAR_PASSWORD_ROOT`,
  `CAMBIAR_PASSWORD_SQL`, `CAMBIAR_JWT_SECRET` y `CAMBIAR_PALABRAS_PROPIAS`; los valores reales solo existen en la VM).
  `CAMBIAR_PALABRAS_PROPIAS` es la lista, separada por comas, de palabras propias de la empresa que la regla de
  contraseñas penaliza (no es un secreto, pero no va en el repo).
- Una máquina de pruebas puede construir la web con `build: { context: ./gestion-reparaciones-web, args: { VITE_ENTORNO: preproduccion } }`:
  enseña un letrero «PREPRODUCCIÓN» y pone «[PRE]» en la pestaña. Sin ese argumento (producción) no cambia nada.
- `nginx/bootstrap.conf` → `/opt/reparaciones/nginx/default.conf` SOLO hasta emitir el certificado.
- `nginx/default.conf` → `/opt/reparaciones/nginx/default.conf` definitivo (80 → 301 → 443).
Antes del primer `up`, `/opt/reparaciones/sql/init.sql` tiene que existir (dump de preproducción): si no, Docker crea un directorio con ese nombre al montar el volumen y la base de datos arranca vacía.
El backend no expone puertos al host. `SERVER_ERROR_INCLUDE_MESSAGE=always` (decisión 2026-09-15): los 409/422 de los DAOs viajan como `ResponseStatusException` y solo llevan su mensaje de negocio con `always`; se revisará con un manejador de errores propio en el hardening.
Actualizar: `cd /opt/reparaciones && git -C gestion-reparaciones-servidor pull && git -C gestion-reparaciones-web pull && docker compose up -d --build`.
El paso a paso de la primera instalación y el mantenimiento están en la guía privada del equipo `Apuntes/despliegue_vdc_produccion.md` (fuera del repo).

Tras cambiar `nginx/default.conf` en el repo: copiarlo a `/opt/reparaciones/nginx/default.conf`, comprobar la sintaxis con `docker compose exec nginx nginx -t` y reiniciar con `docker compose restart nginx`.
