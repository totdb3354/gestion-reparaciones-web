# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.9.3] - 2026-10-05 — Barra de seguridad siempre visible

- La barra de seguridad de la contraseña ("Cambiar contraseña" y "Cambia tu contraseña") se ve desde el principio, con los cinco tramos en gris, y se va coloreando según se escribe.
- Ya no parpadea al escribir: mientras se comprueba lo último que se ha tecleado, sigue enseñando la nota anterior.
- Solo cambia la web; el servidor sigue en la 0.9.2. Sin cambios en la base de datos ni en la configuración de nginx.

## [0.9.2] - 2026-10-05 — Contraseñas seguras

- **Barra de seguridad.** Al elegir una contraseña nueva (menú de usuario → "Cambiar contraseña" y la pantalla "Cambia tu contraseña"), una barra dice lo fácil que es adivinarla: Muy débil, Débil, Poco segura, Segura o Muy segura. "Guardar" se activa a partir de "Segura"; para el administrador, solo con "Muy segura". Debajo sale el motivo cuando no vale ("La contraseña es poco segura. Añade otra palabra.").
- **Reglas nuevas.** Mínimo 10 caracteres, máximo 64, distinta de la actual. No hace falta poner mayúsculas, números ni símbolos: una frase de varias palabras sueltas es de lo más seguro.
- **Alta de técnicos sin contraseña.** El programa genera una contraseña temporal y la enseña una sola vez, como "Restablecer contraseña". Al entrar con ella hay que elegir una propia.
- Requiere el servidor 0.9.2. Sin cambios en la base de datos ni en la configuración de nginx.

## [0.9.1] - 2026-10-04 — Arreglos de sesión

- Si dos pestañas estaban en la pantalla "Cambia tu contraseña" y se cambia en una, la otra sale sola al programa en vez de seguir pidiendo el cambio. Llegar a esa pantalla por su dirección sin tener que cambiar la contraseña también lleva al inicio.
- Con el servidor 0.9.1, activar, desactivar o eliminar a un usuario y restablecer su contraseña surten efecto en su siguiente acción, sin esperar hasta medio minuto. Quien acaba de ser reactivado puede entrar y trabajar enseguida.
- Es la primera versión que llega a una web 0.9.0 abierta: las pestañas avisan con "Hay una versión nueva del programa." y el botón "Recargar".
- Sin cambios en la base de datos ni en la configuración de nginx.

## [0.9.0] - 2026-09-29 — Sesiones y contraseñas

- **Cierre por inactividad.** Tras dos horas sin usar el programa, la sesión se cierra sola. Un minuto antes sale el aviso "Vas a salir por inactividad" con el botón "Seguir trabajando". Cuenta como uso el ratón y el teclado en cualquier pestaña de la web; volver a la ventana y el refresco automático de las tablas no cuentan. Lo que esté sin guardar en un pedido o en el reparto de trabajos se pierde; las reparaciones a medias se guardan solas. Un PC suspendido con la web abierta más de dos horas vuelve a pedir usuario y contraseña al despertar.
- **Aviso de versión nueva.** Cuando se publica una versión, las pestañas abiertas lo avisan abajo ("Hay una versión nueva del programa.") con un botón "Recargar". Nunca recarga sola, para no perder lo que haya escrito. Se comprueba al abrir la web y cada cinco minutos.
- **Contraseña temporal.** En Técnicos, el administrador tiene "Restablecer contraseña" en cada fila: el programa genera una contraseña temporal y la muestra una sola vez, con un botón para copiarla. Al entrar con ella, la persona pasa a una pantalla en la que tiene que elegir una contraseña propia antes de seguir; desde ahí puede cerrar sesión. Los usuarios nuevos también entran con la contraseña del alta como temporal. Si se restablece la contraseña de alguien con la web abierta, su siguiente acción lo lleva a esa pantalla, y cambiarla en una pestaña vale para todas.
- Requiere el servidor 0.9.0 y su migración (`sql/migracion-sp7b-auditoria-password.sql`).
- Cambia la configuración del servidor web (`deploy/nginx/default.conf`, nueva ruta `/version.json` sin caché): hay que copiarla a la máquina y reiniciar nginx.

## [0.8.5] - 2026-09-27 — Arreglos de la verificación

- Un doble clic en "Aceptar", "Guardar", "Registrar técnico" o "Añadir incidencia y asignar" de los diálogos de alta ya no crea el registro dos veces: el segundo clic se ignora mientras el primero se envía. Si el envío falla, o si falta un dato, se puede volver a pulsar.
- Las altas de solicitud de pieza (Stock), proveedor, cliente, técnico e incidencia llevan una clave de reintento: si se repite el mismo envío tras un fallo o un corte, el servidor lo registra una sola vez. Con el servidor anterior todo funciona igual que antes.
- El formulario de reparación cabe en pantallas bajas: la cabecera con el IMEI y la ✕ y la zona de "Terminar asignación" / "Guardar cambios" quedan siempre a la vista, y lo que se desplaza son las filas. En pantallas estrechas el formulario se desplaza en horizontal en vez de cortarse.
- Antes de recargar, cerrar la pestaña o salir de la web con trabajo sin guardar (editando una reparación, en un formulario nuevo aún sin autoguardar, en "Asignar trabajos" con IMEIs en las colas o en "Nuevo pedido" / "Nuevo otro pedido" con líneas), el navegador pregunta. En un formulario de reparación nuevo, el botón Atrás del navegador guarda el borrador igual que la ✕.
- En "Asignar trabajos" con IMEIs en las colas, el botón Atrás del navegador pide la misma confirmación "Descartar" que cerrar el modal: "Cancelar" deja todo como estaba y "Descartar" cierra el modal y vuelve atrás.
- En "Nuevo pedido" y "Nuevo otro pedido" con líneas, el botón Atrás del navegador pide confirmación antes de descartarlas ("Descartar", con "Cancelar" para seguir en el formulario). La ✕ y el "Cancelar" del formulario siguen cerrando sin preguntar, como en el programa de escritorio.
- "Añadir incidencia", "Observación del teléfono" y "Editar modelo" ya no se cierran hasta que el guardado sale bien: si falla, el diálogo sigue abierto con lo escrito. Excepción, como en el programa de escritorio: si otro usuario ha modificado el teléfono mientras tanto, "Observación del teléfono" avisa, se cierra y recarga la lista para que se vuelva a escribir sobre los datos nuevos.
- En "Nuevo pedido", "+ Añadir línea" añade siempre una línea vacía, también cuando el formulario se abrió con "Pedir" sobre un componente (antes repetía ese componente), como en el programa de escritorio. La primera línea sigue llegando con el componente elegido.
- En Asignaciones, un cliente que aparece en una recarga entra marcado en el filtro Cliente aunque el filtro esté aplicado a medias, como en el programa de escritorio: sus trabajos ya no quedan ocultos sin avisar.
- Si se supera el límite de intentos de inicio de sesión, la pantalla de entrada lo dice ("Demasiados intentos de inicio de sesión. Espera unos segundos y vuelve a intentarlo.") y no reintenta sola, en vez de mostrar "Sin conexión con el servidor.".
- El supertécnico entra en Asignaciones al iniciar sesión y al pulsar "Reparaciones", como en el programa de escritorio (antes entraba en el Historial). Técnico y administrador siguen igual: Pendientes e Historial.
- "Descargar CSV" abre la ventana "Guardar como" con el nombre del fichero ya propuesto, como el programa de escritorio, para elegir dónde guardarlo (en Chrome y Edge; en otros navegadores se descarga a la carpeta de descargas, como hasta ahora). Si se cancela, no se guarda nada.
- Una sola sesión para todas las pestañas del navegador: abrir la web en otra pestaña, o un enlace en una pestaña nueva, entra sin volver a pedir usuario y contraseña. "Cerrar Sesión" en una pestaña la cierra en todas. Al cerrar el navegador la sesión se cierra, aunque el navegador vuelva a abrir las pestañas: se conserva mientras haya alguna pestaña de la web abierta o durante los dos minutos y medio siguientes a cerrar la última; un PC suspendido con la web abierta sigue con la sesión al despertar. En un puesto compartido, al dejarlo, pulsa "Cerrar Sesión".
- Documentación: fichas de paridad corregidas donde afirmaban un calco que no lo es ("+ Añadir línea" tras "Pedir", CSV del administrador en Asignaciones, vista de entrada del supertécnico, orden de botones de Clientes), nueva regla para marcar las casillas de comportamiento, y el smoke del formulario crea y borra su propia asignación de prueba.

## [0.8.4] - 2026-09-27 — Respuestas comprimidas

- El servidor web envía comprimidos los datos de la API y los ficheros de la propia web. Los historiales, que eran las descargas más pesadas, ocupan entre 27 y 39 veces menos, así que las vistas cargan antes y deja de aparecer el aviso de "sin conexión" cuando una descarga grande tardaba demasiado. No cambia nada de lo que se ve ni de cómo se refresca.
- Solo cambia la configuración del servidor web (`deploy/nginx/default.conf`): hay que copiarla a la máquina y reiniciar nginx.

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
