# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.5.0] - 2026-09-XX — Asignar trabajos

- El botón "Asignar" abre el modal de asignación: colas de Reparación, Glass y Pulido, escaneo y pegado de IMEIs, modelo y cliente por IMEI, técnicos que se mantienen entre IMEIs, chasis y "Lleva glass" con la glass automática.
- Todo el lote se guarda de una vez al final; si algo falla no queda nada a medias y reintentar no duplica. Las asignaciones que ya existían se saltan y se avisan.
- Compartidos: campo con autocompletado en línea y troceado del pegado de IMEIs.
- Servidor: predicción de la glass automática y guardado por lotes con clave de idempotencia.
- Diferencias aceptadas respecto al programa de escritorio: `docs/paridad/asignar-trabajos.md`.

## [0.4.0] - 2026-09-22 — Asignaciones del supertécnico

- Vista "Asignaciones pendientes" del supertécnico en `/reparaciones/asignaciones`: una sola tabla con reparación, glass y pulido, en orden fijo (urgente, con cliente, resto) y sin orden por columna, que ocupa todo el ancho.
- Once columnas con el técnico editable en la celda, la píldora de enlace cruzado y el contador "N asignados" bajo el IMEI, y la columna Estado con sus badges apilados; franja de color por solicitud o incidencia.
- Cinco filtros en memoria (IMEI múltiple, técnico, cliente con "(Sin cliente)", tipo y estado combinado con O) y "Limpiar filtros".
- Menú contextual por categoría: copiar celda, editar comentario, modelo (pulido) y cliente, y marcar o quitar urgente y chasis.
- Reasignar, urgente y chasis escriben al instante, como en el cliente de escritorio, con un aviso "Deshacer" de 8 s; el aviso de urgente nombra el IMEI porque el servidor lo propaga al teléfono entero.
- Borrado con confirmación y sin motivo, con su texto propio para las incidencias.
- Ventana "Carga de técnicos" con los alcances Pedidos y Total, barras de total y de hecho, desglose y filtro por técnico al pulsar una fila; diálogo "Técnicos de glass".
- El refresco periódico se congela mientras hay un menú, desplegable o diálogo abiertos, también ante el foco de la ventana.
- Contador del total de asignaciones en la columna lateral del supertécnico.
- Modo solo lectura del ADMIN: sin "Asignar", sin papelera, técnico como texto y menú reducido a "Copiar celda".
- El botón "Asignar" queda visible y deshabilitado hasta el modal de asignación (siguiente entrega).
- Compartidos: `ComboNavy` y `MultiSelect` avisan de apertura y cierre; literal `MSG_TELEFONO_MODIFICADO` y patrón de fecha de asignación únicos.
- Servidor: la carga diaria por técnico pasa del cliente al servidor (`GET /api/reparaciones/carga-tecnicos`, los dos alcances en una respuesta, día resuelto en Europe/Madrid, rol supertécnico o ADMIN).
- Diferencias aceptadas y comportamientos calcados: `docs/paridad/asignaciones.md`.

## [0.3.0] - 2026-09-21 — Formulario de reparación y campana

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
