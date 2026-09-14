# Despliegue en la VM de producción

Los ficheros de esta carpeta son la referencia versionada de lo que vive en `/opt/reparaciones` de la VM:
- `docker-compose.prod.yml` → `/opt/reparaciones/docker-compose.yml` (sustituir `CAMBIAR_PASSWORD_ROOT`,
  `CAMBIAR_PASSWORD_SQL` y `CAMBIAR_JWT_SECRET`; los valores reales solo existen en la VM).
- `nginx/bootstrap.conf` → `/opt/reparaciones/nginx/default.conf` SOLO hasta emitir el certificado.
- `nginx/default.conf` → `/opt/reparaciones/nginx/default.conf` definitivo (80 → 301 → 443).
El backend no expone puertos al host. `SERVER_ERROR_INCLUDE_MESSAGE=always` (decisión 2026-09-15): los 409/422 de los DAOs viajan como `ResponseStatusException` y solo llevan su mensaje de negocio con `always`; se revisará con un manejador de errores propio en el hardening.
Actualizar: `cd /opt/reparaciones && git -C gestion-reparaciones-servidor pull && git -C gestion-reparaciones-web pull && docker compose up -d --build`.
El paso a paso de la primera instalación está en `Apuntes/despliegue_vdc.md`, sección "Producción y web".
