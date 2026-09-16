# Ficha de paridad — Pendientes (PendientesTecnicoView.fxml ×2 + PulidoTecnicoView.fxml; toggles de ReparacionView{Tecnico,SuperTecnico})

Referencia: línea hotfix 0.16.2 del cliente JavaFX (la que usa la tienda; idéntica a `hotfix/0.16.3` en estas vistas). Specs de origen: separar-glass (2026-06-30), badge-pendientes-cap99-pulidos (2026-07-01), paridad-pulido (2026-07-02), por-cerrar-carga (2026-07-08), entrega-glass (2026-08-28). Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-16-web-taller-design.md`.

Capturas: `Apuntes/paridad-capturas/taller/{pendientes-reparaciones-tecnico,pendientes-filtro-tipo,pendientes-menu-contextual,pendientes-menu-contextual-con-glass,pendientes-filtro-imei-valido,pendientes-filtro-imei-incompleto,pendientes-glass-tecnico,pendientes-pulidos-tecnico,pendientes-reparaciones-supertecnico}.png`.

## Común a las tres pestañas

- [x] Roles: TECNICO y SUPERTECNICO (los que tienen `idTec`); es la vista de entrada del TECNICO. ADMIN no tiene el apartado (la ruta le lleva a Historial).
- [x] Entrada de la columna lateral "Pendientes" con badge = reparaciones + glass + pulidos abiertos (tope "99+"; oculto si es 0; en el apartado activo el badge es blanco con texto navy, en los demás navy con texto blanco; 9 px negrita, radio 8, padding 1 5). El badge se alimenta de `GET /api/reparaciones/pendientes/contadores` y se refresca con el mismo intervalo que las listas y tras cada acción.
- [x] Toggles "Reparaciones (n)" · "Glass (n)" · "Pulidos (n)" (píldora segmentada `toggle-pill-left/mid/right`: 12 px negrita, fondo #F0F2F5 texto #586376 y borde #C8CDD5; activo navy con texto blanco; extremos con radio 24). El sufijo "(n)" va siempre, incluido "(0)", con tope "99+". Al cambiar de pestaña se conserva el texto del filtro IMEI.
- [x] Rutas: `/reparaciones/pendientes`, `/reparaciones/pendientes/glass`, `/reparaciones/pendientes/pulidos`.
- [x] Título 24 px negrita azul medio + píldora contador gris (#E8EAF0 / #586376, 12 px negrita, radio 12, padding 3 10): "N pendientes" / "1 pendiente" (tope "999+"), que cuenta las filas visibles tras filtrar.
- [x] Filtro "Filtrar por IMEI" (160 px, clase `buscador`): al teclear se canonicaliza (solo dígitos y comas, separador ", ", ", " automático tras 15 dígitos, los tokens de más de 15 se parten cada 15); borde rojo (`fila-incidencia-brd`) si hay algún token incompleto, verde (`fila-reparado-ico`) si todos son IMEIs de 15; filtra por los IMEIs de 15 dígitos (los incompletos no filtran).
- [x] Botón "Limpiar filtros" (`btn-secondary`: crema, borde navy, radio 24, 12 px negrita) que vacía el IMEI y los demás filtros de la pestaña.
- [x] Etiqueta "Actualizado HH:mm" abajo a la derecha (10 px, #A0A0A0, hora local del PC), clicable para recargar (subrayado al pasar por encima). Si esa recarga manual falla por conexión se muestra el diálogo (la ha pedido el usuario).
- [x] Refresco cada 60 s (5 s con el banner de conexión activo), al volver a la pestaña y tras cada acción. Las tres pestañas recargan a la vez (el badge necesita las tres cifras): las consultas de las pestañas no visibles siguen montadas a través del hook de contadores, no de las listas.
- [x] Tablas sin ordenación por clic ni columnas reordenables; fila seleccionada con fondo azul medio y texto blanco; separador inferior `fila-sep`; celdas de 12 px.
- [x] Menú contextual (clic derecho sobre la fila) con "📋  Copiar celda" en todas las pestañas: copia al portapapeles el texto de la celda pulsada y la resalta brevemente (fondo #E0F7FA que se desvanece). Columnas copiables: Id, IMEI, Modelo, Fecha, Comentario (y en Pulidos también Cliente y Asignado por); el resto no copia nada.
- [x] Textos vacíos: "No tienes asignaciones pendientes" (Reparaciones y Glass), "No tienes pulidos pendientes" (Pulidos).
- [x] Errores: 403 y 422 de las acciones con el mensaje del servidor ("Solo puedes marcar tus propias asignaciones", "Solo puedes entregar tus propias asignaciones", "Sin glass abierta para este IMEI", "No hay entrega que deshacer", "Solo quien registró la entrega puede deshacerla", "La entrega ya está registrada", …); resto según la política del shell.

## Pestañas Reparaciones y Glass (PendientesTecnicoView, `setModoGlass` en la segunda)

- [x] Filtro "Tipo" (`MenuButton` navy, 130 px) con tres casillas: "Solicitudes pieza", "Incidencias", "Asignaciones" (el menú no se cierra al marcar). Etiqueta del botón: "Tipo" sin marcar, el nombre de la única marcada, "Todas" con las tres, "N filtros" con dos. Predicado: solicitud = `esSolicitud > 0`; incidencia = `esIncidencia`; asignación = ni lo uno ni lo otro; una fila pasa si es de alguno de los tipos marcados.
- [x] Columnas y anchos (px): Id Asignación 90 · Tipo 90 · IMEI 130 · Modelo 120 · Fecha asignación 130 · Comentario 160 · Cliente 110 · Asignado por 120 · Estado 100 · botón 150 · papelera 45 (solo SUPERTECNICO); el resto del ancho queda en blanco.
- [x] Tipo: píldora "Reparación" (#E3F2FD / #1565C0) o "Glass" (#E0F2F1 / #00796B), radio 10, 11 px negrita, padding 2 10; debajo "Chasis" (10 px, #8A94A6) si `esChasis` y es reparación.
- [x] IMEI (12 px azul medio) con mini-píldora debajo (10 px negrita, radio 8, padding 1 8): "Glass: <técnico>" con la paleta Glass en filas de reparación con `glassAbierta` y sin `glassEntregadoAt` (tooltip "Glass abierta de <técnico> — entrega sin registrar"; "glass" si no hay nombre); "Rep: <técnico>" con la paleta Reparación en filas de glass con `normalAbierta` (tooltip "Reparación abierta de <técnico>"; "técnico" si no hay nombre; se mantiene tras "Llegó").
- [x] Modelo traducido (`traducirModelo`: "12promax" → "iPhone 12 Pro Max"; vacío si no hay).
- [x] Fecha asignación `yyyy/MM/dd HH:mm` en hora de Madrid.
- [x] Comentario = `comentarioAsignacion` (vacío si nulo). Cliente (vacío si nulo). Asignado por = `nombreTecnicoAsigna` o "—".
- [x] Estado: badges apilados (radio 10, 11 px negrita, padding 2 10), de arriba abajo: "Urgente" (#FDDEDE / #C62828) si `urgente`; "Por cerrar" (#E0F2F1 / #00796B) si `porCerrar`; entrega en índigo (#E8EAF6 / #3949AB): "→ <técnico de glass>" en filas de reparación con `glassEntregadoAt` (tooltip "Entregado a <glass> por <quien>, dd/MM HH:mm"), "Llegó HH:mm" si es hoy o "Llegó dd/MM" si no en filas de glass con `entregadoAt` (tooltip "Bajado por <quien>, dd/MM HH:mm"); después uno solo: "Incidencia" (`fila-incidencia-bg` / `fila-incidencia-brd`) si `esIncidencia`; si no y `esSolicitud > 0`: "Recibido" (#E8F5E9 / #2E7D32) si `estadoSolicitud = GESTIONADA` y `stockSolicitud > 0`, "En camino" (#E3F2FD / #1565C0) si `enCamino`, si no "Solicitud" (`fila-solicitud-bg` / `fila-solicitud-brd`), con debajo "N piezas" (10 px #586376) si `esSolicitud > 1` o los tipos (`tiposSolicitud`) si es una, y tooltip con los tipos; si no, "Normal" (#E8EAF0 / #586376) salvo que sea urgente (entonces sin "Normal").
- [x] Botón "Añadir reparación" / "Añadir glass" (`btn-primary`: navy, radio 24, 12 px negrita) en cada fila. **Deshabilitado en este sub-proyecto** con tooltip "Disponible con el formulario de reparación (siguiente entrega)". En la pestaña Glass el botón se oculta mientras la fila tenga `normalAbierta` y no tenga `entregadoAt` ("sin teléfono no hay glass").
- [x] Papelera (imagen `borrar.png`, 25 px, cursor de mano; solo SUPERTECNICO): `ConfirmDialog` "Borrar asignación <id>" / "El técnico dejará de verla en su lista de pendientes." (si `esIncidencia`: "El técnico dejará de verla en su lista de pendientes y la incidencia se marcará como no activa en la tabla principal.") / botón "Borrar asignación" y "Cancelar". Confirmar: si `esIncidencia` → `DELETE /api/reparaciones/imei/{imei}/incidencia-activa?tipo=R|G` (G en la pestaña Glass); si no → `DELETE /api/reparaciones/asignaciones/{id}`. Recarga lista y contadores.
- [x] Filas: borde izquierdo de 8 px `fila-solicitud-brd` si `esSolicitud > 0`, `fila-incidencia-brd` si `esIncidencia`, transparente si no.
- [x] Orden: urgentes primero, después las que tienen cliente, después el resto; estable dentro de cada grupo sobre el orden del servidor (fecha de asignación ascendente).
- [x] Menú contextual, además de "Copiar celda": "Marcar por cerrar" / "Quitar por cerrar" (solo pestaña Reparaciones y fila de reparación) → `PATCH /api/reparaciones/asignaciones/{id}/por-cerrar {porCerrar}`; "Entregar a <técnico de glass>" (pestaña Reparaciones, fila con `glassAbierta` y sin `glassEntregadoAt`; "glass" si no hay nombre) o "Deshacer entrega" (con `glassEntregadoAt` y `glassEntregadoPor` igual a mi `idTec`; si la firmó otro no aparece) → `PATCH /api/reparaciones/asignaciones/{id}/entrega-glass {entregado}`; "Marcar que llegó" (pestaña Glass, fila con `normalAbierta` y sin `entregadoAt`) → `PATCH /api/reparaciones/asignaciones/{id}/llegada`; "Deshacer llegada" (pestaña Glass, fila con `entregadoAt` y `entregadoPor` igual a mi `idTec`) → `DELETE /api/reparaciones/asignaciones/{id}/llegada`. Tras cada acción se recargan la lista y los contadores.
- [x] Datos: `GET /api/reparaciones/asignaciones` (pestaña Reparaciones) y `GET /api/glass/asignaciones` (Glass). El TECNICO no envía `?tecnico=` (el servidor lo fuerza a lo suyo); el SUPERTECNICO envía `?tecnico=<su idTec>`.
- [x] CSV `mis_pendientes` con las filas visibles: TECNICO → "ID Reparación", "IMEI" (`="…"`), "Fecha asig.", "Fecha fin", "Componente", "Observaciones", "Incidencia", "Resuelto", "ID Rep. anterior"; SUPERTECNICO → las mismas con "Técnico" entre "IMEI" y "Fecha asig.". Fechas `dd/MM/yyyy HH:mm`; "Incidencia" = texto de la incidencia (o "Sí" sin texto) / "No"; "Resuelto" Sí/No.

## Pestaña Pulidos (PulidoTecnicoView)

- [x] Título "Mis pulidos pendientes" + píldora "N pendientes" / "1 pendiente".
- [x] Filtros: "Filtrar por IMEI" y "Limpiar filtros"; a la derecha (margen 24 px) "Seleccionar todo" (`btn-secondary`; marca todas las filas, o las desmarca todas si ya estaban todas marcadas) y "Completar seleccionados" (`btn-primary`, deshabilitado sin selección).
- [x] Columnas y anchos (px): casilla 40 · Id Asignación 90 · IMEI 130 · Modelo 120 · Fecha asignación 130 · Comentario 160 · Cliente 110 · Asignado por 120 · papelera 50 (solo SUPERTECNICO).
- [x] Filas sin borde de estado (solo separador); la selección de casillas sobrevive al filtrado y se vacía al recargar.
- [x] "Completar seleccionados": `POST /api/pulidos/asignaciones/completar-lote {ids}`, vacía la selección, recarga lista y contadores.
- [x] Papelera (SUPERTECNICO): `ConfirmDialog` "Borrar asignación <id>" / "El pulido dejará de estar asignado y desaparecerá de tus pendientes." / "Borrar asignación" → `DELETE /api/pulidos/asignaciones/{id}`.
- [x] Menú contextual: solo "Copiar celda" (la edición de pulidos vive en Asignaciones e Historial).
- [x] Datos: `GET /api/pulidos/asignaciones` (mismo criterio de `?tecnico=` que arriba).
- [x] CSV `pulidos_pendientes`: "ID", "IMEI" (`="…"`), "Modelo", "Fecha asig." (`dd/MM/yyyy HH:mm`), "Comentario".

## Diferencias aceptadas

- "Añadir reparación" / "Añadir glass" deshabilitados con tooltip hasta el sub-proyecto 2 (formulario de reparación).
- Las pestañas son rutas: el botón atrás del navegador cambia de pestaña.
- El `ConfirmDialog` de la papelera es un modal con el mismo título, texto y botones (sin cuenta atrás, como en Clientes).
- El resaltado al copiar una celda es un cambio de fondo breve, sin animación de desvanecido.
- El CSV es una descarga del navegador con nombre `<base>_yyyy-MM-dd_HH-mm.csv`.
- El CSV del supertécnico del JavaFX escribe 11 valores bajo 10 cabeceras (añade "Reutilizado" a las filas pero no a la cabecera); el CSV de esta ficha exporta las 10 columnas coherentes.
- Pulidos: "Completar seleccionados" vacía la selección en cuanto se pulsa; el JavaFX la conserva si el guardado falla.
