# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.8.3] - 2026-09-27 — Fechas, carga y modal

- Asignaciones, Mis asignaciones pendientes, Pulidos pendientes, Historial, Historial de pulidos y Agrupado por IMEI muestran las fechas como día/mes/año (`dd/MM/yyyy HH:mm`; `dd/MM/yyyy` en el Historial de técnico). Los CSV, Pedidos y los logs no cambian.
- Mientras una vista hace su primera carga o se guarda un cambio, un círculo girando sobre la pantalla atenuada indica que el programa está trabajando y evita clics dobles; solo aparece si la espera pasa de 200 ms. Los refrescos automáticos no lo muestran.
- "Asignar trabajos" abre a 720 px de ancho, como la ventana del programa de escritorio (antes, más ancho); en Pulido la lista mide 280 px para que el detalle quepa al lado.
- La lista de sugerencias de los campos de autocompletar que se ensanchan con su contenido tiene un ancho máximo; las opciones largas se recortan con puntos suspensivos y se leen enteras al pasar el ratón.
- Con una conexión lenta, si una respuesta del servidor tarda más de 15 segundos en llegar entera, el programa lo trata como "sin conexión" (aviso amarillo y reintento) en lugar de mostrar el error genérico del navegador.
- Interno: pruebas de la tabla fluida al pasar de vacía a llena, restauración de los simulacros aunque falle una prueba y un comentario de Técnicos al día.
- Diferencias decididas respecto al programa de escritorio (fechas e indicador de carga): anotadas en las fichas de `docs/paridad/`.

## [0.8.2] - 2026-09-27 — Tablas fluidas

- Almacén (Stock actual, Pedidos y Proveedores): el componente, el concepto, el proveedor y el comentario se quedan con el ancho que sobra en pantallas grandes; las cantidades, las fechas, los importes y el estado mantienen su ancho.
- Clientes: el nombre se queda con el ancho que sobra; el estado mantiene su ancho.
- Agrupado por IMEI: el modelo, los trabajos, la observación y el cliente se quedan con el ancho que sobra; el IMEI, las fechas y el estado mantienen su ancho.
- Mis asignaciones pendientes (Reparaciones/Glass), Pulidos pendientes e Historial de pulidos: el modelo, el técnico, el comentario, el cliente y "Asignado por" se quedan con el ancho que sobra; el identificador, el IMEI, las fechas, las etiquetas y los botones mantienen su ancho.
- En pantallas pequeñas las columnas no bajan de su ancho de siempre y la tabla se desplaza en horizontal. Diferencia decidida respecto al programa de escritorio, que deja el sobrante en blanco y recorta el texto: anotada en las fichas de `docs/paridad/`.

## [0.8.1] - 2026-09-27 — Dimensionado

- El ojo de los campos de contraseña se ve al tamaño del programa de escritorio: encajado en 18 × 18 sin deformarse (antes el ojo abierto salía más ancho).
- Cada ventana emergente mide lo que le corresponde: "Carga de técnicos" 680 px, "Técnicos de glass" y los avisos 420 px, las listas de selección 440 px y los comentarios, observaciones e incidencias 520 px, en vez de quedarse todas en 512 px.
- En las tablas de columnas fijas (Stock, Pedidos, Proveedores, Clientes, IMEIs, Mis asignaciones pendientes (Reparaciones/Glass), Pulidos pendientes e Historial de pulidos) la banda gris de la cabecera y las líneas de cada fila llegan hasta el borde derecho, como el programa de escritorio.
- Una tabla vacía ocupa el mismo alto que llena, en todas las vistas (por ejemplo, Mis asignaciones pendientes sin asignaciones).

## [0.8.0] - 2026-09-26 — Gestión

- "Gestionar técnicos" en `/gestion/tecnicos` (solo administrador): alta de usuario y técnico con rol TECNICO o SUPERTECNICO, aviso mientras se escribe si el nombre ya existe, tabla de técnicos registrados con su estado, candado para activar o desactivar el acceso y papelera con confirmación, o con aviso si el técnico tiene historial.
- "Ver logs" en `/gestion/logs` (solo administrador): registro de actividad con buscador, filtros de acción, técnico y fechas, las 1.000 entradas más recientes con aviso al llegar al tope y el detalle completo con doble clic.
- "Cambiar contraseña" se abre encima de la vista en la que estás, con un ojo en cada campo para ver lo escrito.
- El inicio de sesión dice "Rellena usuario y contraseña." con los campos vacíos, como el programa de escritorio.
- Asignaciones: "Descargar CSV" exporta las asignaciones visibles con 14 columnas, incluida "Entregado".
- Servidor: el alta de usuarios y el cambio de contraseña se validan también en el servidor; un técnico con historial (reparaciones, asignaciones, entregas, solicitudes o movimientos) no se puede borrar y se explica por qué; un técnico inexistente responde "no encontrado"; el filtro de fechas del registro de actividad usa la hora de Madrid, también para el programa de escritorio; solo el administrador puede crear o borrar técnicos.
- Diferencias aceptadas respecto al programa de escritorio: `docs/paridad/tecnicos.md`, `docs/paridad/logs.md` y `docs/paridad/cuenta.md`.

## [0.7.0] - 2026-09-25 — Pedidos

- Pestaña Pedidos en `/stock/pedidos` con el conmutador Componentes | Otros: tablas con fecha, componente o concepto, proveedor, cantidad, precio por unidad, total en euros y estado, con sus colores, "!" en los recibidos a precio cero y "⚠" en los urgentes en camino; filtros de estado, proveedor, buscador y fechas compartidos por las dos tablas, "Limpiar filtros" y CSV de cada tabla.
- Menú del supertécnico según el estado del pedido: confirmar pedido, recepción parcial, confirmar recibido, recibir resto, cerrar sin resto, cancelar, borrar, revertir a En camino y editar, con sus diálogos y confirmaciones.
- Formularios "Nuevo pedido" y "Nuevo otro pedido" como ventana encima de la vista en la que estás, con varias líneas y el total en euros de cada una; "Editar pedido" para pedidos de componentes y de otros.
- Stock actual: "Pedir" abre el formulario sin salir de Stock; el componente de un pedido lleva a su fila de Stock actual y "En Camino" lleva a sus pedidos.
- La campana: "Pedir" de una alerta, "Pedir todas las piezas" y "Pedir piezas" abren el formulario; al confirmar, las solicitudes pedidas quedan gestionadas en el mismo guardado y las de componentes desactivados se avisan y siguen pendientes.
- Servidor: los cambios de estado y las cantidades de recepción se validan también en el servidor; el importe en euros lo calcula el servidor con el tipo de cambio en el sentido correcto, también para el programa de escritorio; el alta de varios pedidos se guarda de una vez, sin quedar a medias ni duplicarse al reintentar.
- Diferencias aceptadas respecto al programa de escritorio: `docs/paridad/pedidos.md`.

## [0.6.0] - 2026-09-24 — Stock actual y Proveedores

- Vista Stock en `/stock` con la columna lateral Stock actual · Pedidos · Proveedores (Pedidos llega en la siguiente entrega).
- Stock actual: tabla con componente, en stock, en camino (enlace a Pedidos), mínimo, último pedido y el semáforo OK / Bajo / Sin stock / Desactivado; filtro de estado, buscador y "Limpiar filtros"; donut "Estado del stock" y gráfico por SKU al seleccionar una fila; menú por rol con Pedir, Editar stock, Ajustar mínimo, Desactivar/Activar y Solicitar pieza.
- Proveedores: tabla, filtro de activos, alta, edición (divisa y comentario), activar/desactivar y borrado con confirmación.
- La campana: "Ver Stock Completo" e "→ Ir a pedidos" abren la vista de Stock.
- Servidor: cantidad en camino resuelta al SKU master, 409 al borrar un proveedor con pedidos y 422 en cantidades negativas, nombre vacío o de más de 100 caracteres o divisa desconocida.
- Diferencias aceptadas respecto al programa de escritorio: `docs/paridad/stock.md`.
- Ajustes de paridad tras comparar capturas con el programa de escritorio (bordes de fila, fila desactivada seleccionada, donut, tooltip y eje del gráfico, pie y pestaña de Stock al volver).

## [0.5.0] - 2026-09-24 — Asignar trabajos

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
