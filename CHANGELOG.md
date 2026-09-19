# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.3.0] - <fecha del tag> — Formulario de reparación y campana

- Formulario de reparación como diálogo gobernado por la URL, en tres modos: nueva reparación y glass desde Pendientes ("Añadir reparación" / "Añadir glass") y edición desde Historial e IMEIs ("Editar", solo supertécnico).
- Filas por tipo de componente con filtro por modelo, SKU coloreado por stock, cantidad, "Reutilizado" y observación; "✓ Guardar fila" en dos clics.
- Solicitud de pieza desde la fila (sin stock y stock al límite), solicitudes ya guardadas con sus estados (pendiente, en camino, recibido, rechazada) y "Otras acciones".
- "Terminar asignación" y "Guardar cambios" en dos clics; en edición, previsión de stock, "Salir sin guardar" y aviso de modificación concurrente sin recarga automática.
- Borrador persistente por asignación, compatible con el del cliente de escritorio: autoguardado a los 2 s, volcado al cerrar y banda "✓ Borrador recuperado".
- Campana de notificaciones del supertécnico: contador de solicitudes pendientes, pulso de alertas de stock y panel con Solicitudes (rechazar, recuperar, quitar, "Rechazar todo") y Alertas; refresco cada 60 s sin parpadeo. Las acciones de Almacén quedan visibles y deshabilitadas hasta esa entrega.
- Compartidos: `ComboNavy`, avisos multilínea que devuelven el foco al cerrar, `renderConRouter` para tests con data router y consultas con `meta.silenciarError`.
- Servidor: el técnico de las escrituras del formulario se toma del token y la asignación debe ser propia; la edición de reparaciones y el ajuste de stock son del supertécnico; roles por método en las solicitudes de stock; la asignación pasa a chasis al usar o pedir una pieza `cha`; contrato con nullabilidad y respuestas tipadas para lo que la web consume.
- Diferencias aceptadas, correcciones deliberadas y comportamientos calcados: secciones del mismo nombre en `docs/paridad/formulario.md` y `docs/paridad/notificaciones.md`.
- Reintentos seguros: las escrituras del formulario llevan clave de idempotencia; reintentar tras un fallo no repite el trabajo ya registrado.

## [0.2.0] - 2026-09-16 — Taller técnico

- Pendientes del técnico: reparaciones, glass y pulidos (filtros, badges de estado, entrega a glass y llegada, papelera del supertécnico, completar pulidos en lote, CSV).
- Historial: reparaciones, glass y pulidos (filtros por rol, borrado con motivo, incidencias, editar modelo, CSV).
- IMEIs: maestro agrupado por IMEI (observación y cliente del teléfono) y detalle por IMEI.
- Columna lateral de Reparaciones por rol con contador de pendientes; entrada por rol.
- Refresco periódico (60 s, 5 s sin conexión) con etiqueta "Actualizado HH:mm".
- `DataTable` con anchos fijos (`colgroup`), selección, teclado y virtualización.
- Contrato OpenAPI con `required`/`nullable` explícitos (sin `Required<>` en el cliente).
- Servidor: `?tecnico=` verificado contra el token y `GET /api/reparaciones/pendientes/contadores`.
- Diferencias aceptadas respecto al JavaFX: las recoge la sección "Diferencias aceptadas" de cada ficha de paridad del taller (`docs/paridad/`).

## [0.1.0] - 2026-09-16 — Cimientos

Fecha del tag; la verificación de paridad contra producción y las capturas del JavaFX son del 2026-09-15 y el lote de cierre del 2026-09-16.

- Shell (barra superior, columna lateral, menú de usuario, banner de conexión, refresco al volver).
- Login y sesión (JWT, expiración, guard de rutas).
- API tipada desde OpenAPI (`npm run api:types`, snapshot `api/openapi.json`).
- Componentes compartidos (DataTable, MultiSelect, StatusBadge, ConfirmDialog, AlertaProvider).
- Módulo Clientes (CRUD con bloqueo optimista y menú contextual).
- CI.
- Dockerfile + `deploy/`.
- Smoke e2e con Playwright.
