# gestion-reparaciones-web

Cliente web del ERP de reparaciones (React + TypeScript). Sustituye al cliente JavaFX
(`gestion-reparaciones-cliente`) contra el mismo servidor Spring Boot (`gestion-reparaciones-servidor`).

## Arranque en local
1. `npm install`
2. Copia `.env.example` a `.env.local` y pon en `VITE_API_PROXY_TARGET` la URL de la API
   (la del entorno desplegado o un servidor local `http://localhost:8080`).
3. `npm run dev` → http://localhost:5173. Las llamadas a `/api` van por proxy a esa URL, sin CORS.

El tamaño del texto se ajusta con el zoom del navegador (Ctrl + / Ctrl −), que el navegador recuerda por sitio.

## Calidad
`npm run check` = lint + typecheck + tests (lo mismo que ejecuta la CI). `npm run test:watch` en desarrollo.

## Contrato de la API
Los tipos de `src/shared/api/schema.d.ts` salen del snapshot `api/openapi.json`, el OpenAPI que genera el servidor. Flujo
habitual, sin servidor arrancado:
1. En `gestion-reparaciones-servidor`, en la rama con los cambios de la API: `mvn test` (o solo
   `mvn test -Dtest=OpenApiContractTest`) deja el contrato en `target/openapi.json`.
2. Copia ese fichero a `api/openapi.json` de este repo.
3. `npm run api:types:offline` regenera `src/shared/api/schema.d.ts`; `npm run check` confirma que la web sigue compilando.

El contrato de una rama de la web es el de la rama del servidor de la que salió el snapshot, y ese servidor se despliega
antes que la web: una web nueva contra un servidor anterior pediría rutas o campos que todavía no existen.
`npm run api:types` hace lo mismo descargando `/v3/api-docs` de un servidor en marcha (`API_URL`, `API_USER`, `API_PASS`;
ver `scripts/fetch-openapi.mjs`).

## Smoke e2e (Playwright)
Necesita la web ya desplegada (no funciona contra un backend simulado). Exporta en la shell las variables de
`.env.e2e.example` (`E2E_BASE_URL`, `E2E_USER`, `E2E_PASS`, con un usuario supertécnico) y luego:
```bash
npm run e2e
```
`clientes.spec.ts` crea y borra un cliente de prueba llamado `E2E <timestamp>`. `taller.spec.ts` necesita además `TEC_USER`/`TEC_PASS`
(un técnico con pendientes) y es de solo lectura: no crea, edita ni borra nada. `formulario.spec.ts` **escribe**: con `TEC_USER`
abre una asignación de reparación pendiente, guarda una fila (consume una unidad de stock), registra una solicitud de pieza y
termina; con `E2E_USER` rechaza y recupera esa solicitud desde la campana y abre "Editar" del Historial sin guardar. La
asignación la crea el propio test por la API (con `E2E_USER`, para el técnico de `TEC_USER`, sobre un IMEI sintético nuevo en
cada ejecución) y, si el test cae antes de terminarla, `afterAll` la borra por su id. `E2E_MODELO_PRUEBA` (opcional) fija el
modelo del teléfono sintético: uno que tenga un tipo con stock y otro con el SKU a 0. Solo se ejecuta contra un entorno con
usuarios y datos de prueba.
`asignar.spec.ts` también **escribe** en el entorno de destino: con `E2E_USER` abre el modal "Asignar trabajos", crea UNA
asignación de Reparación del IMEI `E2E_IMEI_PRUEBA` al técnico `E2E_TEC_PRUEBA` y la borra al terminar (solo borra el id que
devuelve el propio guardado; si el guardado no crea exactamente esa asignación, falla sin borrar nada). Usa siempre un IMEI
sintético de prueba sin asignación de Reparación abierta para ese técnico y un técnico de prueba, nunca datos reales.
`stock.spec.ts` también **escribe**: con `E2E_USER` edita el stock del SKU `E2E_SKU_PRUEBA` (+1 y lo devuelve) y crea y
borra un proveedor de prueba `E2E <timestamp>` (el id a borrar sale del listado por el nombre exacto; sin ese id, falla sin
limpiar). Si falla la restauración del stock, el SKU de prueba queda en +1 y se corrige a mano. Usa siempre un SKU de
prueba, nunca uno real.
`pedidos.spec.ts` también **escribe**: con `E2E_USER` crea por API un proveedor de prueba `e2e-proveedor-<marca>`, crea
desde "Nuevo pedido" un pedido de una línea del SKU `E2E_SKU_PRUEBA` con precio 0 y desde "Nuevo otro pedido" uno con un
concepto sintético, edita los dos (cantidad 2) y los borra por el id que devuelve su propio lote; al final borra el
proveedor (lo que no se haya borrado por la interfaz se borra por API, siempre por id). No confirma ni recibe ningún
pedido, así que no toca stock.
`gestion.spec.ts` también **escribe**: con `ADMIN_USER`/`ADMIN_PASS` (un administrador) registra desde "Gestionar técnicos"
un técnico de prueba `e2e-tecnico-<marca>` con usuario `e2e-usuario-<marca>` y una contraseña sintética, lo desactiva y lo
activa con el candado, comprueba su `CREAR_USUARIO` en "Ver logs" (filtro de acción y fechas de hoy, buscador y detalle),
entra con él, cambia su contraseña desde el menú y la restaura, y lo borra como administrador desde la papelera. Solo deja
escribir sobre ese usuario; si el test cae antes del borrado, lo borra por la API buscándolo por su nombre exacto. Hace
cuatro inicios de sesión (el límite es de 5 por minuto): no lo lances pegado a otra ejecución.
Sin credenciales (o sin `E2E_IMEI_PRUEBA`/`E2E_TEC_PRUEBA` en el caso
de `asignar.spec.ts`, sin `E2E_SKU_PRUEBA` en el de `stock.spec.ts` y `pedidos.spec.ts`, o sin `ADMIN_USER`/`ADMIN_PASS` en el de
`gestion.spec.ts`) en el entorno, los tests se saltan.

## Despliegue
Los ficheros de referencia (compose, nginx, README) están en `deploy/`. La guía operativa es privada y vive fuera del repo.

## Documentación
- Spec maestra y de cimientos: repo raíz, `docs/superpowers/specs/2026-09-13-*`.
- Spec del taller técnico: repo raíz, `docs/superpowers/specs/2026-09-16-web-taller-design.md`.
- Spec del formulario de reparación y la campana: repo raíz, `docs/superpowers/specs/2026-09-19-web-formulario-design.md`.
- Fichas de paridad por vista: `docs/paridad/` (taller: `docs/paridad/{pendientes,historial,imeis,formulario,notificaciones}.md`).
- Spec de Gestión (técnicos, logs y contraseña): repo raíz, `docs/superpowers/specs/2026-09-26-web-gestion-design.md`; fichas `docs/paridad/{tecnicos,logs,cuenta}.md`.
