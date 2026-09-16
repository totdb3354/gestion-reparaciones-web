# Ficha de paridad — IMEIs (AgrupadoView.fxml / AgrupadoController, apartado "Agrupado por IMEI")

Referencia: línea hotfix 0.16.2 del cliente JavaFX (idéntica a `hotfix/0.16.3` en esta vista). Specs de origen: desagrupar y agrupado (2026-06-11), otros-tecnicos-por-defecto y filtro-tecnico-agrupada (2026-06-22), urgente-cliente-y-filtros (2026-06-24), separar-glass (2026-06-30), entrega-glass (2026-08-28). Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-16-web-taller-design.md`.

Capturas: `Apuntes/paridad-capturas/taller/{imeis-maestro-tecnico,imeis-maestro-supertecnico,imeis-maestro-admin,imeis-filtro-tecnico,imeis-filtro-cliente,imeis-maestro-filtro-incidencias,imeis-maestro-menu-contextual,imeis-maestro-menu-contextual-supertecnico,imeis-maestro-menu-contextual-admin,imeis-maestro-tras-volver,imeis-detalle-tecnico,imeis-detalle-supertecnico,imeis-detalle-admin,imeis-detalle-filtro-incidencias,imeis-detalle-menu-contextual,imeis-detalle-menu-contextual-supertecnico,imeis-detalle-menu-contextual-admin,imeis-dialogo-observacion,imeis-dialogo-cliente,imeis-dialogo-incidencia,imeis-dialogo-borrar}.png`.

## Común a maestro y detalle

- [x] Roles: los tres. Entrada "IMEIs" de la columna lateral; pulsarla estando en el detalle vuelve al maestro (equivale a "← Volver").
- [x] Rutas: `/reparaciones/imeis` (maestro) y `/reparaciones/imeis/:imei` (detalle).
- [x] Datos: la unión de `GET /api/reparaciones/historial`, `GET /api/glass/historial` y `GET /api/pulidos/historial` (las mismas consultas que el Historial, compartidas en caché). El TECNICO recibe solo sus trabajos (lo fuerza el servidor), así que solo ve los IMEIs en los que ha trabajado y, en el detalle, solo sus trabajos; SUPERTECNICO y ADMIN ven todo.
- [ ] Título "Agrupado por IMEI" (24 px negrita azul medio). Sin etiqueta "Actualizado" (el JavaFX no la tiene). Refresco cada 60 s (5 s con el banner) y al volver a la pestaña para TECNICO y SUPERTECNICO; ADMIN solo al volver a la pestaña.
- [x] Los filtros Técnico, Desde/Hasta e Incidencias son los mismos controles en maestro y detalle y conservan su valor al entrar y salir del detalle; "Limpiar filtros" los vacía todos (también IMEI y Cliente).
- [x] Filtro "Técnico" (multiselección navy, 130 px; "Técnico" / nombre / "N técnicos"; lista completa de `GET /api/tecnicos`, los tres roles). En el maestro deja los IMEIs en los que **alguno** de los técnicos marcados tiene un trabajo; en el detalle ordena primero los trabajos de los marcados y después los de otros, atenuados (opacidad 0,45).
- [x] "Desde:" / "Hasta:" por fecha de fin de cada trabajo (hora de Madrid, extremos incluidos; sin fecha de fin → fuera si hay rango).
- [x] Menú contextual con "📋  Copiar celda" para los tres roles (maestro: IMEI, Modelo, Fechas ("primera → última"), Trabajos, Observación, Cliente; detalle: Tipo, Id, IMEI, Modelo, Reparador, Asignado por, Fechas (la de fin), Componente, Observaciones, Incidencia, Id Rep. Anterior).
- [x] Tablas sin ordenación por clic ni reordenación; fila seleccionada azul medio; filas de 44 px.

## Maestro

- [x] Píldora contador "N IMEIs" / "1 IMEI" junto al título, con los grupos visibles.
- [x] Filtros, en este orden: IMEI · Técnico · Cliente · Desde · Hasta · Incidencias · Limpiar filtros.
- [x] Filtro "Cliente" (multiselección navy, 150 px; "Cliente" / nombre / "N clientes"): los clientes presentes en los trabajos cargados, ordenados alfabéticamente, con "(Sin cliente)" al principio si hay trabajos sin cliente. Deja los trabajos cuyo cliente está marcado (o sin cliente si se marcó "(Sin cliente)") antes de agrupar.
- [ ] Filtro "Incidencias" con solo dos casillas en el maestro: "Incidencia" y "Normal" (la casilla "Cerradas" se oculta); etiqueta "Incidencias" / la única marcada / "Todas" / "N filtros". Incidencia = el grupo tiene alguna incidencia abierta; Normal = ninguna.
- [x] Agrupación: un grupo por IMEI con todos sus trabajos (reparaciones R, glass G y pulidos P que pasan el filtro de IMEI, fechas y cliente); modelo, observación y cliente = primer valor no vacío del grupo; fecha más antigua = mínima fecha de asignación; fecha más reciente = máxima fecha de fin; incidencias abiertas = trabajos con `esIncidencia && !esResuelto`. Un grupo se muestra si algún trabajo pasa el filtro de técnico. Orden: fecha más reciente descendente (los grupos sin fecha al final).
- [x] Columnas: IMEI teléfono (12 px negrita azul medio, con el icono `Historial.png` de 25 px a la derecha que abre el detalle; ancho 180) · Modelo (150) · Fechas (130; dos líneas `yyyy/MM/dd HH:mm`: más antigua en gris pequeño y "→ más reciente"; "—" si falta) · Trabajos (160; "2 Rep · 1 Glass · 1 Pul", omitiendo los tipos a cero) · Estado (130; badge "Incidencia" con incidencias abiertas, "Normal" si no) · Observación (del teléfono, con elipsis y popup "Observación" al pulsar el texto; 150–300) · Cliente (150–300, con popup "Cliente" al pulsar el texto). **Sin columna "Revisión"** (diferencia aceptada).
- [x] Filas: fondo #EEF0F5, borde izquierdo de 4 px (`fila-incidencia-brd` con incidencias abiertas, azul medio si no), cursor de mano; seleccionada azul medio con borde izquierdo de 4 px.
- [x] Doble clic en la fila o clic en el icono → detalle del IMEI.
- [x] Al volver del detalle el maestro vuelve a seleccionar el IMEI y desplaza la tabla hasta él (tres filas por encima).
- [x] Menú contextual SUPERTECNICO: "📋  Copiar celda", separador, "Editar observación", separador, "Editar cliente". TECNICO y ADMIN: solo "Copiar celda".
- [x] "Editar observación": diálogo "Observación del teléfono" con "Observación — IMEI <imei>", área de texto (placeholder "Observación del teléfono...", 4 líneas, precargada) y botón "Guardar" (verde `fila-reparado-ico`) más "Cerrar" → `PATCH /api/telefonos/{imei}/observacion {observacion, updatedAt}` (observación recortada; `updatedAt` = `telefonoUpdatedAt` del grupo). 409 → "El teléfono fue modificado por otro usuario. Se recargan los datos." y recarga; otro error → "No se pudo guardar: <mensaje>". Recarga.
- [x] "Editar cliente": diálogo "Seleccionar cliente" (✕ arriba a la derecha) con campo "Buscar cliente..." que filtra la lista, lista con "— Sin cliente —" primero y después los clientes activos (`GET /api/clientes/activos`) con el actual resaltado, texto "Nada seleccionado" o "Seleccionado: <nombre>", botón "Seleccionar" (deshabilitado sin selección) y "Cancelar" → `PATCH /api/telefonos/{imei}/cliente {idCli, updatedAt}` (`idCli` nulo para "— Sin cliente —"). 409 → mismo aviso y recarga. Recarga.
- [x] CSV `agrupado_resumen` con los grupos visibles: "IMEI" (`="…"`), "Modelo", "Primera", "Última" (`dd/MM/yyyy`), "Reparaciones", "Glass", "Pulidos", "Inc. abiertas", "Observación", "Cliente". **Sin "Revisión logística"** (diferencia aceptada).

## Detalle (`/reparaciones/imeis/:imei`)

- [ ] Barra encima de la tabla: botón "← Volver" (`btn-secondary`), separador vertical, "IMEI: <imei>" (13 px negrita), "• <modelo traducido>" (12 px #586376; vacío si no hay) y "• N trabajos" / "• 1 trabajo"; con filtro de técnico: "• X de filtrados + Y de otros" (o solo "• X de filtrados" si Y es 0). Sin píldora contador ni filtro IMEI (ocultos); filtro Cliente oculto.
- [x] Filtros visibles: Técnico · Desde · Hasta · Incidencias (aquí con las tres casillas "Abiertas", "Cerradas", "Sin incidencia") · Limpiar filtros.
- [x] Filas: los trabajos del IMEI que pasan fechas e incidencias, ordenados por fecha de asignación ascendente (sin fecha al final); con filtro de técnico, primero los suyos y después los ajenos atenuados.
- [ ] Columnas (ancho mínimo en px, estiradas proporcionalmente): Tipo 100 · Id 110 · IMEI teléfono 130 · Modelo 100 · Reparador 100 · Asignado por 100 · Fechas 110 · Componente 150 · Observaciones 200 (máx. 320) · Estado 120 (máx. 150) · Incidencia 200 (máx. 360) · Id Rep. Anterior 150.
- [x] Tipo: píldora "Reparación" / "Glass" / "Pulido" (#EDE7F6 / #5E35B1) según el prefijo del ID. Reparador con "Llegó dd/MM HH:mm" debajo en glass con entrega. Asignado por ("—" si no hay). Fechas en dos líneas `yyyy/MM/dd HH:mm` (asignación en gris pequeño, "→ fin"). Componente con "Reutilizado" debajo si procede. Observaciones e Incidencia con elipsis y popup al pulsar el texto. Estado "Incidencia" / "Resuelta" / "Normal". Id Rep. Anterior como enlace que selecciona esa fila, oculto en pulidos (su `idRepAnterior` es un enlace interno a su asignación).
- [x] Filas: borde izquierdo de 8 px `fila-incidencia-brd` con incidencia abierta, `fila-reparado-brd` con resuelta, transparente si no; opacidad 0,45 en las ajenas al filtro de técnico.
- [x] Menú contextual SUPERTECNICO: "Editar" (solo R/G; **deshabilitado en este sub-proyecto**, con tooltip), "Borrar", separador, "📋  Copiar celda", separador, "Añadir incidencia" (si no tiene), "Cancelar incidencia" (si está abierta). TECNICO y ADMIN: solo "Copiar celda".
- [x] "Borrar": comprobación de referencia (`GET /api/reparaciones/{id}/referenciadora`; si hay otra, aviso "No se puede borrar" / "Este trabajo está siendo referenciado" / "La reparación <ref> apunta a esta. Bórrala primero.") y después `ConfirmDialog` con motivo "Borrar trabajo" / "Se borrará <id>. Los componentes usados volverán a stock y, si resolvía una incidencia, esta quedará activa de nuevo. Escribe el motivo." / "Borrar trabajo" → `DELETE /api/reparaciones/{id}` con `{motivo}`. Recarga.
- [x] "Añadir incidencia" y "Cancelar incidencia": mismos diálogos y llamadas que en el Historial (`POST /api/reparaciones/{id}/incidencia`, `DELETE /api/reparacion-componentes/{id}/incidencia`).
- [x] CSV `agrupado_<imei>` con los trabajos visibles: "Tipo", "ID", "IMEI" (`="…"`), "Técnico", "Fecha asig.", "Fecha fin" (`dd/MM/yyyy HH:mm`), "Componente", "Reutilizado", "Observaciones", "Incidencia", "Resuelto", "ID Rep. anterior" (vacío en pulidos).

## Diferencias aceptadas

- Sin columna "Revisión" ni "Revisión logística" en el CSV: el servidor de producción ya no envía `revisionLogistica` (hoy siempre "—" / "No").
- "Editar" deshabilitado con tooltip hasta el sub-proyecto 2.
- El detalle es una ruta: el botón atrás del navegador equivale a "← Volver". Los diálogos son modales con los mismos textos; sin cuenta atrás en los `ConfirmDialog`.
- El CSV es una descarga del navegador con nombre `<base>_yyyy-MM-dd_HH-mm.csv`.
- El resaltado al copiar una celda es un cambio de fondo breve, sin animación.
- "Editar observación" y "Editar cliente" solo se ofrecen cuando el teléfono tiene fila (`telefonoUpdatedAt`); el servidor exige esa fecha para guardar, y en el JavaFX guardar fallaba.
