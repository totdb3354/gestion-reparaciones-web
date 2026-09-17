# Ficha de paridad — Historial (tabla de ReparacionView{Tecnico,SuperTecnico,Admin}.fxml + HistorialPulidoView.fxml)

Referencia: línea hotfix 0.16.2 del cliente JavaFX (idéntica a `hotfix/0.16.3` en estas vistas). Specs de origen: separar-glass (2026-06-30), otros-tecnicos-por-defecto (2026-06-22), urgente-cliente-y-filtros (2026-06-24), filtro-imei-pegado (2026-06-29), paridad-pulido (2026-07-02), entrega-glass (2026-08-28). Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-16-web-taller-design.md`.

Capturas: `Apuntes/paridad-capturas/taller/{historial-reparaciones-tecnico,historial-reparaciones-supertecnico,historial-reparaciones-admin,historial-glass-tecnico,historial-glass-supertecnico,historial-glass-admin,historial-pulidos-tecnico,historial-pulidos-supertecnico,historial-pulidos-admin,historial-filtro-pieza,historial-filtro-tecnico,historial-filtro-incidencias,historial-filtro-fecha-desde,historial-menu-contextual,historial-menu-contextual-supertecnico,historial-menu-contextual-admin,historial-pulidos-menu-contextual,historial-pulidos-menu-contextual-supertecnico,historial-pulidos-menu-contextual-admin,historial-dialogo-borrar,historial-observaciones-popup}.png` (los diálogos "Añadir incidencia" y "Borrar incidencia" son los mismos que en IMEIs: ver `imeis-dialogo-incidencia.png`).

## Común a los tres toggles

- [x] Roles: los tres. Es la vista de entrada de ADMIN y, hasta el sub-proyecto 3, también de SUPERTECNICO. Entrada "Historial" de la columna lateral.
- [x] Toggles "Reparaciones" · "Glass" · "Pulidos" (misma píldora segmentada que en Pendientes, sin sufijo). Rutas `/reparaciones/historial`, `/reparaciones/historial/glass`, `/reparaciones/historial/pulidos`. Al cambiar de toggle se conserva el texto del filtro IMEI.
- [x] Filtro "Filtrar por IMEI" con la misma canonicalización y bordes que en Pendientes; "Limpiar filtros" (`btn-secondary`) vacía todos los filtros del toggle.
- [x] "Desde:" / "Hasta:" (etiquetas 12 px) con selector de fecha (campo no editable a mano, botón de calendario); filtran por la **fecha de fin** del trabajo en hora de Madrid, ambos extremos incluidos; con un rango puesto, los trabajos sin fecha de fin no se muestran.
- [x] Filtro "Técnico" (multiselección navy, 130 px; etiqueta "Técnico" / el nombre si hay uno / "N técnicos"): en Reparaciones y Glass solo para SUPERTECNICO y ADMIN, con todos los técnicos de `GET /api/tecnicos` (activos e inactivos, en el orden del servidor); en Pulidos para los tres roles con los activos de `GET /api/tecnicos/activos`. Sin selección no filtra; con selección deja las filas cuyo `idTec` está marcado.
- [x] Etiqueta "Actualizado HH:mm" abajo a la derecha, clicable para recargar (igual que en Pendientes).
- [x] Refresco cada 60 s (5 s con el banner) y al volver a la pestaña para TECNICO y SUPERTECNICO; ADMIN solo al volver a la pestaña y al recargar a mano (sin poller, como hoy).
- [x] Tablas sin ordenación por clic ni reordenación; orden = el que devuelve el servidor (fecha de asignación descendente y, a igual fecha, número de ID descendente); fila seleccionada azul medio con el texto en blanco (también las dos fechas y "Reutilizado"; conservan su color las píldoras, "Llegó…", "Sin incidencia", el texto de la incidencia y el enlace "Id Rep. Anterior") y el borde izquierdo transparente; separador `fila-sep`; celdas 12 px; el texto que no cabe en su columna no invade la vecina: se corta, con "…" en los textos de una línea.
- [x] Menú contextual con "📋  Copiar celda" para los tres roles (columnas copiables: Id, IMEI, Modelo, Reparador, Fechas (la de fin), Componente, Observaciones, Incidencia, Id Rep. Anterior; en Pulidos: Id, IMEI, Modelo, Técnico, las dos fechas, Comentario, Cliente, Asignado por).
- [x] Datos: `GET /api/reparaciones/historial`, `GET /api/glass/historial`, `GET /api/pulidos/historial`. El TECNICO no envía `?tecnico=` (el servidor devuelve solo lo suyo); SUPERTECNICO y ADMIN tampoco (reciben todo). Para el TECNICO ya no hace falta filtrar por `idTec` en la web.

## Toggles Reparaciones y Glass (tabla `tablaReparaciones`)

- [x] Título "Mis reparaciones" para TECNICO (también con el toggle Glass) y "Historial de reparaciones" para SUPERTECNICO y ADMIN; píldora "N reparaciones" / "1 reparación" con las filas visibles.
- [x] Filtros, en este orden: IMEI · [Técnico] · Pieza · Desde · Hasta · Incidencias · Limpiar filtros. El filtro Cliente existe en el FXML pero está oculto en el historial plano: no se pinta.
- [x] Filtro "Pieza" (multiselección navy, 140 px; "Pieza" / nombre / "N piezas"): las categorías presentes en los datos cargados, ordenadas alfabéticamente, derivadas del prefijo del SKU del componente (`bat` Batería, `cha` Chasis, `g` Glass, `cam` Cámara, `lcd` Pantalla, `mc` Marco, `otro` Otros; prefijos más largos primero; sin categoría si no empieza por ninguno). Con selección deja las filas cuya categoría está marcada.
- [x] Filtro "Incidencias" (`MenuButton` navy, 130 px) con casillas "Abiertas", "Cerradas", "Sin incidencia"; etiqueta "Incidencias" / la única marcada / "Todas" / "N filtros". Abierta = `esIncidencia && !esResuelto`; cerrada = `esIncidencia && esResuelto`; sin incidencia = `!esIncidencia`.
- [x] Columnas (ancho mínimo en px; se estiran proporcionalmente para llenar la tabla y aparece scroll horizontal si no caben): Id Reparación 110 · IMEI teléfono 130 · Modelo 100 · Reparador 100 · Asignado por 100 · Fechas 110 · Componente 150 · Observaciones 200 (máx. 320) · Estado 120 (máx. 150) · Incidencia 200 (máx. 360) · Id Rep. Anterior 150. Filas de 44 px.
- [x] Reparador: nombre y, en glass con `entregadoAt`, debajo "Llegó dd/MM HH:mm" (10 px, #8A94A6; tooltip "Bajado por <quien>, dd/MM HH:mm").
- [x] Asignado por = `nombreTecnicoAsigna` o "—".
- [x] Fechas en dos líneas: asignación (10 px, #9AA0AA) y "→ fin" (11 px, azul medio); "—" si falta. Formato según el rol, también en "Copiar celda": `yyyy/MM/dd` (sin hora) para TECNICO; `yyyy/MM/dd HH:mm` para SUPERTECNICO y ADMIN.
- [x] Componente = `tipoComponente` y debajo "Reutilizado" (10 px cursiva #9AA0AA) si `esReutilizado`.
- [x] Observaciones: texto con elipsis; si hay texto, cursor de mano y el clic sobre el texto abre el popup "Observaciones" (título, área de texto de solo lectura, botón "Copiar" que copia y cierra, ✕).
- [x] Estado: badge "Incidencia" (`fila-incidencia-bg` / `fila-incidencia-brd`) si abierta, "Resuelta" (`fila-reparado-bg` / `fila-reparado-ico`) si cerrada, "Normal" (#E8EAF0 / #586376) si no.
- [x] Incidencia: "Sin incidencia" en cursiva gris (#A0A0A0) si no la hay; el texto de la incidencia en negro si está abierta y en gris (#A9A9A9) sobre fondo `fila-reparado-bg` si está resuelta; el clic sobre el texto abre el popup "Incidencia".
- [x] Id Rep. Anterior: enlace (color `texto-accion`, subrayado al pasar) que selecciona y desplaza la tabla hasta esa fila si está cargada.
- [x] Filas: borde izquierdo de 8 px `fila-incidencia-brd` con incidencia abierta, `fila-reparado-brd` con incidencia resuelta, transparente si no y en la seleccionada.
- [x] Menú contextual SUPERTECNICO: "Editar" (solo R/G; **deshabilitado en este sub-proyecto**, tooltip "Disponible con el formulario de reparación (siguiente entrega)"), "Borrar", separador, "📋  Copiar celda", separador, "Añadir incidencia" (solo si no tiene incidencia), "Cancelar incidencia" (solo con incidencia abierta). TECNICO y ADMIN: solo "Copiar celda".
- [x] "Borrar": primero `GET /api/reparaciones/{id}/referenciadora`; si devuelve otro ID, aviso "No se puede borrar" / "Esta reparación está siendo referenciada" / "La reparación <ref> apunta a esta. Bórrala primero." y no sigue; si no, `ConfirmDialog` con motivo "Borrar reparación" / "Se borrará <id>. Los componentes usados volverán a stock y, si resolvía una incidencia, esta quedará activa de nuevo. Escribe el motivo." / campo de motivo (placeholder "Escribe el motivo del borrado...", 3 líneas) / botón "Borrar reparación" deshabilitado hasta que haya texto / "Cancelar" → `DELETE /api/reparaciones/{id}` con `{motivo}` (recortado). Recarga.
- [x] "Añadir incidencia": diálogo "Añadir incidencia" con "Comentario de incidencia" (área de texto, placeholder "Describe la incidencia..."), "Técnico asignado" (desplegable con los técnicos activos, preseleccionado el reparador de la fila; "Selecciona técnico" si ninguno) y botón "Añadir incidencia y asignar" (verde `fila-reparado-ico` con texto blanco cuando está habilitado; gris cuando faltan comentario o técnico) más "Cerrar" → `POST /api/reparaciones/{id}/incidencia {comentario, imei, idTec}`. Error al guardar: "No se pudo guardar: <mensaje>". Recarga.
- [x] "Cancelar incidencia": `ConfirmDialog` "Borrar incidencia" / "Esta acción solo es válida si fue un error al añadirla." / "Borrar incidencia" → `DELETE /api/reparacion-componentes/{id}/incidencia`. Recarga.
- [x] CSV con las filas visibles: TECNICO `mis_reparaciones` / `mis_glass` con "ID Reparación", "IMEI" (`="…"`), "Fecha asig.", "Fecha fin", "Componente", "Reutilizado", "Observaciones", "Incidencia", "Resuelto", "ID Rep. anterior"; SUPERTECNICO y ADMIN `historial_reparaciones` / `historial_glass` con "Técnico" entre "IMEI" y "Fecha asig.". Fechas `dd/MM/yyyy HH:mm`; "Reutilizado" y "Resuelto" Sí/No; "Incidencia" = texto (o "Sí" sin texto) / "No".

## Toggle Pulidos (HistorialPulidoView)

- [x] Título "Historial de pulidos" + píldora "N pulidos" / "1 pulido" (sin tope).
- [x] Filtros: IMEI · Técnico (activos, los tres roles) · Desde · Hasta · Limpiar filtros.
- [x] Columnas y anchos (px): Id Pulido 110 · IMEI 130 · Modelo 120 · Técnico 110 · Fecha asignación 130 · Fecha fin 130 · Comentario 160 · Cliente 110 · Asignado por 120; el resto en blanco. Fechas `yyyy/MM/dd HH:mm`. Comentario = `comentarioAsignacion`. Asignado por = `nombreTecnicoAsigna` o "—".
- [x] Filas sin borde de estado.
- [x] Menú contextual SUPERTECNICO: "Editar modelo" (icono `editar.png`), "Borrar", separador, "📋  Copiar celda". TECNICO y ADMIN: solo "Copiar celda".
- [x] "Editar modelo": ventana "Editar modelo" con "Selecciona el modelo:", campo "Filtrar modelo…" (filtra por el nombre traducido, sin distinguir mayúsculas), lista de `MODELOS_ORDENADOS` traducidos con el modelo actual preseleccionado, botones "Cancelar" y "Guardar" (deshabilitado sin selección) → `POST /api/telefonos {imei, modelo}` (el código interno). Recarga.
- [x] "Borrar": `ConfirmDialog` con motivo "Borrar pulido <id>" / "Se borrará <id> del historial de pulido. Escribe el motivo." / "Borrar" → `DELETE /api/pulidos/historial/{id}` con `{motivo}`. Recarga.
- [x] Placeholder "No hay pulidos completados".
- [x] Datos: `GET /api/pulidos/historial`; orden del servidor (fecha de asignación descendente).
- [x] CSV `historial_pulidos` con las filas visibles: "ID", "IMEI" (`="…"`), "Modelo", ["Técnico" solo SUPERTECNICO y ADMIN], "Fecha inicio", "Fecha fin", "Comentario" (fechas `dd/MM/yyyy HH:mm`).

## Diferencias aceptadas

- "Editar" deshabilitado con tooltip hasta el sub-proyecto 2.
- El SUPERTECNICO entra en Historial en vez de en Asignaciones hasta el sub-proyecto 3.
- Los toggles son rutas (el botón atrás del navegador cambia de toggle); los diálogos y ventanas son modales con los mismos títulos, etiquetas y botones; sin cuenta atrás en los `ConfirmDialog`.
- El selector de fecha es el calendario del navegador con el mismo formato visible.
- El CSV es una descarga del navegador con nombre `<base>_yyyy-MM-dd_HH-mm.csv`.
- El resaltado al copiar una celda es un cambio de fondo breve, sin animación.
