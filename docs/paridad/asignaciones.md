# Ficha de paridad — Asignaciones pendientes del supertécnico (PendientesSuperTecnicoView.fxml + PendientesSuperTecnicoController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), `PendientesSuperTecnicoController` (la vista; el modal "Asignar trabajos" del mismo controlador es el sub-proyecto 3b y no entra aquí), `PendientesSuperTecnicoView.fxml`, `CargaTecnicos` y `EntregaGlass`. Specs de origen: carga-capacidad-diaria (2026-07-09), separar-glass (2026-06-30), entrega-glass (2026-08-28). Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-22-web-asignaciones-design.md`.

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `asignaciones/{asig-lista,asig-vacia,asig-tipo-glass,asig-tipo-pulido,asig-filtros-aplicados,asig-filtro-tecnico,asig-filtro-tecnico-marcado,asig-filtro-cliente,asig-filtro-tipo,asig-filtro-estado,asig-filtro-imei,asig-filtro-imei-invalido,asig-menu-reparacion,asig-menu-glass,asig-menu-pulido,asig-estado-solicitud,asig-fila-urgente-chasis,asig-confirm-borrar,entrega-glass-accion,entrega-glass-llegada,entrega-glass-celda,carga-tecnicos,carga-tecnicos-alcance,carga-tecnicos-fila-resaltada,carga-tecnicos-click-tecnico,tecnicos-glass,editor-comentario,editar-modelo,editar-cliente,asig-admin,asig-admin-menu}.png`. Sin captura (especificado desde el código): el badge "Incidencia" de la columna Estado y el fin de semana de la ventana de carga; las capturas `modal-*` de esa misma carpeta son del modal "Asignar trabajos" y las consume la ficha del sub-proyecto 3b.

Los ejemplos de identificador (`A20260922_1`, `AG20260922_1`, `AP20260922_1`) y de técnico ("Técnico A") son sintéticos.

## Diferencias deliberadas respecto al JavaFX

Las tres que la spec ya anunciaba:

- **La tabla no se ordena por columna** (D5). El orden urgente → con cliente → resto es funcional: lo que corre va arriba. Ordenar por otra cosa entierra lo urgente sin avisar, así que la web podría ordenar y deliberadamente no lo hace (el JavaFX apaga el `sortable` de todas sus columnas por el mismo motivo).
- **Aviso con "Deshacer" de 8 s** en reasignar, urgente y chasis (D2). El JavaFX escribe al instante y sin confirmación; en un navegador un clic o una tecla de más cambian un desplegable sin querer y eso mueve trabajo entre técnicos en silencio. El gesto se calca tal cual y se le añade la vuelta atrás, que no estorba y evita el daño.
- **El refresco se congela** mientras haya un menú, un desplegable, un editor o una de las dos ventanas abiertos (D4). Sin eso la fila se mueve bajo el cursor y la acción se pierde o cae en otra fila; verificado en el JavaFX durante la sesión de capturas.

Las que han aparecido al implementar:

- **El ancho del desplegable de la celda Técnico (96 px) no es un calco.** El `ComboBox` del JavaFX no declara ancho (`setMaxWidth(MAX_VALUE)`: llena la celda) y el combo navy de la web exige un número; 96 es el ancho de columna menos el padding de la celda. Es una elección de la web, no un valor verificado contra las capturas.
- **La ventana de carga ordena los empates con `localeCompare('es')`.** El JavaFX usa el orden natural de `String`, donde una inicial acentuada cae detrás de la Z. En una interfaz en español el orden del idioma es el correcto.
- **Tercer nivel de desempate por identificador de técnico en la carga.** El JavaFX solo tiene dos (carga y nombre), así que en fin de semana —todos a 0— su lista puede bailar entre refrescos. El tercer nivel la deja estable sin cambiar nada más.
- **"Técnicos de glass" intenta todos los cambios y no aborta al primer fallo.** El JavaFX deja el resto sin mandar. Intentarlo todo y repintar los checks desde el servidor le dice al usuario qué quedó guardado y qué no, en vez de dejarlo a ciegas.
- **El 409 del editor de comentario muestra el mensaje del servidor**, no el literal del JavaFX. Cumple igual la regla de errores (avisa y recarga); darle un literal propio exigía tocar la capa de API compartida, fuera del alcance de este sub-proyecto.
- **La entrada por defecto del SUPERTÉCNICO se queda en Historial.** El `visible="true"` del FXML *es* la entrada por rol y la web lo calca en los tres roles: el panel que arranca visible en el FXML del supertécnico es el Historial, no Asignaciones. Asignaciones ya es la primera entrada de su columna lateral.

De presentación, heredadas de los sub-proyectos anteriores y comunes a toda la web:

- El botón "Asignar" va en su **propia fila** bajo los filtros; en el JavaFX comparte el `FlowPane` con ellos (con 24 px de margen). Con los cinco filtros delante, en una sola fila se corta en cuanto la ventana se estrecha.
- Las dos ventanas de la cabecera y los tres editores son **diálogos modales dentro de la página**, no ventanas del sistema: no se pueden mover ni redimensionar (las del JavaFX también son modales, pero sí se redimensionan).
- Mientras el modal "Asignar trabajos" no exista (sub-proyecto 3b), el botón "Asignar" está **deshabilitado y con tooltip**, en su sitio, igual que se hizo en el sub-proyecto 2 con las acciones que terminaban en Almacén.

### Decisión de redacción pendiente del usuario

El texto del aviso de deshacer dice "`<idRep>` marcada como urgente", nombrando **una** fila, pero el servidor propaga el urgente al teléfono entero: marcar urgente una `A…` marca también su `AG…` hermana (el deshacer sí revierte las dos). El usuario ve cambiar dos filas y el mensaje habla de una. Opciones: dejarlo así, o redactarlo por teléfono ("el IMEI …001 pasa a urgente"). **Aparcada a propósito para decidirla al revisar esta ficha.**

### Diferencias nuevas detectadas al marcar la ficha (sin decidir)

- **El IMEI no muestra la tercera línea "N asignados".** En el JavaFX, la celda IMEI de esta vista apila IMEI · píldora `Glass:`/`Rep:` · "N asignados" (10 px, cursiva, gris) cuando el IMEI tiene dos o más técnicos distintos y la píldora no cuenta ya al segundo (la regla fina de `ocultarContadorAsignados`: con exactamente 2 se oculta, con 3 o más convive con la píldora). La web no lo pinta: el conteo de técnicos por IMEI no llegó a implementarse, aunque la spec lo nombra dos veces. La casilla correspondiente queda **sin marcar**.
- **En solo lectura, la celda Técnico añade un subtexto que el JavaFX no tiene.** La web reutiliza la celda de reparador del Historial, que en una fila de glass con entrega registrada pinta debajo del nombre "Llegó dd/MM HH:mm"; el JavaFX en solo lectura pinta el nombre y nada más. La casilla correspondiente queda **sin marcar**.

## Ruta, rol y refresco

- [x] `/reparaciones/asignaciones` deja de ser un placeholder y muestra la vista real, dentro de una guarda que admite **SUPERTECNICO y ADMIN** (D6). El TECNICO que llegue por URL recibe el aviso genérico de permisos y sale a `/reparaciones`, que ya reparte por rol.
- [x] Entrada "Asignaciones" en la columna lateral de Reparaciones, primera, solo para SUPERTECNICO y ADMIN; el TECNICO no la ve. Sin badge (el badge del lateral es el de Pendientes).
- [x] Refresco periódico con el intervalo del resto de la web (60 s; 5 s con el banner de conexión activo) y al volver a la pestaña, como el poller y la recarga al recuperar el foco del JavaFX.
- [x] (D4) Un contador de interacciones abiertas suspende el sondeo mientras haya un menú contextual, un desplegable de filtro, el desplegable de técnico de una celda, un editor, el diálogo de borrado o una de las dos ventanas de la cabecera; se reanuda al cerrarse la última. El contador se libera también al desmontar y nunca baja de cero.
- [x] Etiqueta "Actualizado HH:mm" abajo a la derecha (10 px, gris, hora local del equipo), clicable para recargar y con subrayado al pasar por encima, como el `lblUltimaActualizacion` del supertécnico. Si esa recarga manual falla por conexión se muestra el diálogo.

## Cabecera

- [x] Título "Asignaciones pendientes" (24 px negrita, azul medio) y, a su lado, la píldora gris del contador (#E8EAF0 / #586376, 12 px negrita, radio 12, padding 3 10).
- [x] El contador cuenta las filas **tras los filtros**: "N asignaciones" / "1 asignación", con tope "999+" (calco literal de `actualizarContador`). Es distinto del badge del lateral, que es el total (`asig-lista`, `asig-filtros-aplicados`).
- [x] A la derecha, empujados por un hueco elástico, "Técnicos de glass" y "Carga técnicos" (botones secundarios), en ese orden.
- [x] Botón "Asignar" (primario) bajo los filtros, deshabilitado y con el tooltip que remite al siguiente sub-proyecto. Para el ADMIN no existe.

## La tabla

- [x] Una sola lista con las tres categorías, concatenando `GET /api/reparaciones/asignaciones` + `GET /api/glass/asignaciones` + `GET /api/pulidos/asignaciones`, **sin** el parámetro `?tecnico=`: es la lista completa del supertécnico.
- [x] El tipo de cada fila se deriva del prefijo del identificador (`A…` reparación, `AG…` glass, `AP…` pulido), no de un campo (`asig-lista`, `asig-tipo-glass`, `asig-tipo-pulido`).
- [x] Orden fijo: urgentes primero, después las que tienen cliente, después el resto; estable dentro de cada grupo sobre el orden del servidor.
- [x] (D5) Ninguna columna ordena al pulsar la cabecera, ni es reordenable.
- [x] Borde izquierdo de 8 px en la fila: ámbar (#C07800) con solicitud de pieza, rojo (#B83746) si es incidencia, transparente si no (`asig-estado-solicitud`). La fila seleccionada apaga el borde.
- [x] Fila seleccionada con el fondo de selección de la web, el mismo que el resto de tablas.
- [x] El clic derecho **selecciona la fila** antes de abrir su menú, para que la acción no caiga en otra.
- [x] Placeholder "No hay asignaciones pendientes" cuando la tabla queda vacía (`asig-vacia`).
- [x] El filtrado es **en memoria** sobre lo ya cargado (D7): ningún control vuelve al servidor.

## Las once columnas

Anchos en píxeles, los `prefWidth` del FXML.

- [x] Orden y cabeceras: Id Asignación 90 · Tipo 90 · Técnico 110 · IMEI 130 · Modelo 120 · Fecha asignación 130 · Comentario 160 · Cliente 110 · Asignado por 120 · Estado 100 · columna sin título con la papelera 45.
- [x] Id Asignación: el identificador tal cual.
- [x] Tipo: píldora del tipo — "Reparación" (#E3F2FD / #1565C0), "Glass" (#E0F2F1 / #00796B), "Pulido" (#EDE7F6 / #5E35B1) — y debajo la palabra "Chasis" (10 px, #8A94A6) solo en reparaciones con chasis (`asig-tipo-glass`, `asig-tipo-pulido`, `asig-fila-urgente-chasis`).
- [x] Técnico: **desplegable dentro de la celda** (8 filas visibles, 11 px) con los técnicos activos y el de la fila seleccionado; elegir otro reasigna al instante (D2). Elegir el que ya estaba no escribe nada.
- [x] IMEI (12 px) con la mini-píldora debajo: "Glass: `<técnico>`" en filas de reparación con glass abierta y sin entregar, "Rep: `<técnico>`" en filas de glass con reparación abierta (se mantiene tras el "Llegó"); cada una con su tooltip. Son las de la lógica de entrega de glass, ya en la web desde el sub-proyecto 1 (`asig-tipo-glass`, `entrega-glass-accion`).
- [ ] IMEI: tercera línea "N asignados" (10 px, cursiva, gris) cuando el IMEI tiene dos o más técnicos distintos y la píldora no cuenta ya al segundo. **No implementado**: ver «Diferencias nuevas detectadas al marcar la ficha».
- [x] Modelo: nombre traducido del código del modelo (vacío si no hay).
- [x] Fecha asignación: `yyyy/MM/dd HH:mm`, en hora de Madrid, texto plano que hereda el color de la fila.
- [x] Comentario: el comentario de la asignación (vacío si es nulo); pulsar sobre el texto abre el popup de lectura.
- [x] Cliente: el nombre, o vacío.
- [x] Asignado por: el nombre de quien la creó, o "—" si no hay (calco del `cAsignadoPor`).
- [x] Estado: los badges apilados de §"La columna Estado".
- [x] Papelera en la última columna, sin cabecera; oculta para el ADMIN.

## La columna Estado

- [x] Apila, de arriba abajo, los que apliquen: "Urgente" (#FDDEDE / #C62828) si la fila es urgente; "Por cerrar" (#E0F2F1 / #00796B); el badge de entrega de glass en índigo (#E8EAF6 / #3949AB) con su tooltip.
- [x] Badge de entrega: "→ `<técnico de glass>`" sin hora en la fila de reparación entregada; "Llegó HH:mm" si la llegada es de hoy o "Llegó dd/MM" si no, en la fila de glass. Los dos lados conviven en la misma tabla (`entrega-glass-celda`, `entrega-glass-llegada`).
- [x] Y **uno solo** de estos, en cascada excluyente: "Incidencia" (#E8C8CE / #B83746); si no y hay solicitud de pieza, "Recibido" (#E8F5E9 / #2E7D32) si está gestionada y con stock, "En camino" (#E3F2FD / #1565C0) si viene en camino, si no "Solicitud" (#FDEBC8 / #C07800) — con la sub-línea de los tipos de pieza o "N piezas" y su tooltip (`asig-estado-solicitud`); si no, y la fila no es urgente, "Normal" (#E8EAF0 / #586376).
- [x] Una fila urgente y nada más no pinta el cuarto badge: "Urgente" ya está arriba.
- [x] El pulido nunca muestra badge de entrega, y su estado normal es "Normal" (`asig-tipo-pulido`).
- [x] El "hoy" que decide entre "Llegó HH:mm" y "Llegó dd/MM" se recalcula en cada render: con la pestaña abierta, pasada la medianoche los badges cambian de forma solos.

## Los cinco filtros

- [x] Barra de filtros que envuelve en varias líneas cuando la ventana se estrecha (el `FlowPane` del JavaFX, ya responsive).
- [x] IMEI: campo "Filtrar por IMEI" que admite **varios separados por comas** y exige los **15 dígitos**; al completar 15 se añade una coma para seguir escribiendo (`asig-filtro-imei`).
- [x] Un IMEI incompleto marca el campo en **rojo y no filtra**: la tabla se queda como estaba (`asig-filtro-imei-invalido`).
- [x] Técnico: desplegable de selección múltiple con los técnicos activos y su casilla. **Vacío significa "no filtrar"**, no "ninguno" (`asig-filtro-tecnico`).
- [x] La etiqueta del botón de técnico es "Técnico" sin nada marcado, el nombre del único marcado, y "N técnicos" con dos o más (`asig-filtro-tecnico-marcado`).
- [x] Cliente: desplegable de selección múltiple con el sentinel **"(Sin cliente)"** el primero, poblado con los clientes presentes en lo cargado (no con un catálogo) y repoblado en cada carga (`asig-filtro-cliente`).
- [x] El filtro de cliente arranca con **todas las casillas marcadas** y la etiqueta "Todos"; volver a marcarlas todas devuelve al estado "sin filtro", y el cliente que aparezca en la siguiente carga entra ya marcado.
- [x] Desmarcar clientes filtra por los que quedan; quedarse sin ninguno marcado **no vacía la tabla**, filtra igual que "todos" (calco: con el conjunto vacío el JavaFX no filtra).
- [x] Tipo: desplegable con Reparación / Glass / Pulido; vacío = todos (`asig-filtro-tipo`).
- [x] Estado: desplegable con "Solicitudes pieza" / "Incidencias" / "Asignaciones"; los marcados se combinan con **O**, y "Asignaciones" son las que no tienen ni solicitud ni incidencia. Una fila que es solicitud e incidencia a la vez sale con cualquiera de las dos casillas, y no con "Asignaciones" (`asig-filtro-estado`).
- [x] Entre grupos los filtros se combinan con **Y**, y el contador de la cabecera se recalcula con cada cambio (`asig-filtros-aplicados`).
- [x] "Limpiar filtros" resetea **los cinco**, técnico y cliente incluidos.

## Menú contextual (clic derecho sobre la fila)

- [x] Ítems por categoría de la fila, en este orden: "Copiar celda" · "Editar comentario" · "Editar modelo" (solo pulido) · "Editar cliente" · "Marcar/Quitar urgente" (reparación y glass) · "Marcar/Quitar chasis" (solo reparación) — `asig-menu-reparacion`, `asig-menu-glass`, `asig-menu-pulido`.
- [x] El texto de los dos interruptores **alterna** según el estado de la fila: "Marcar urgente" / "Quitar urgente", "Marcar chasis" / "Quitar chasis".
- [x] "Copiar celda" copia al portapapeles el texto de la celda sobre la que se abrió el menú y la resalta brevemente. Columnas copiables: Id, IMEI, Modelo, Fecha y Comentario; el resto no copia nada (calco exacto de `textoDeCelda`).
- [x] Urgente y chasis **escriben al pulsar, sin diálogo de confirmación**, como el JavaFX, y la lista se recarga después (D2 añade el aviso, no cambia el gesto).
- [x] Urgente: `PATCH /api/reparaciones/asignaciones/{idRep}/urgente`; chasis: `PATCH /api/reparaciones/asignaciones/{idRep}/chasis`. Las dos escrituras exigen SUPERTECNICO en el servidor.
- [x] Tras cada escritura sale el aviso "`<idRep>` marcada como urgente" / "ya no es urgente" (y sus equivalentes de chasis) con el botón "Deshacer" durante 8 s; "Deshacer" manda la misma escritura con el valor contrario.
- [x] Solo hay un aviso a la vez y gana **la última acción lanzada**, no la que resuelva antes; si la escritura falla no sale aviso (no hay nada que deshacer) y el error lo cuenta el manejador global.
- [x] El aviso es una región `role="status"` presente siempre en el DOM, para que el lector de pantalla lo anuncie sin robar el foco de la tabla.
- [x] Abrir y cerrar el menú (también al elegir un ítem, y también si la fila desaparece con el menú abierto) avisa de la interacción y congela/reanuda el sondeo.

## Reasignar desde la celda Técnico

- [x] Elegir otro técnico reasigna al instante, sin diálogo: `PATCH /api/reparaciones/asignaciones/{idRep}` (reparación y glass) o `PATCH /api/pulidos/asignaciones/{idAP}` (pulido), mandando el **comentario actual sin tocarlo** y el `updatedAt` de la fila como bloqueo optimista.
- [x] La celda muestra el técnico nuevo en el acto (pintado optimista), sin esperar a la recarga; si la escritura falla, vuelve al anterior.
- [x] Sale el aviso "`<idRep>` reasignada a Técnico A" con "Deshacer" durante 8 s, y deshacer devuelve la fila al técnico de antes.
- [x] "Deshacer" manda el `updatedAt` **recargado**, no el que caducó al reasignar. Si el cambio no se puede confirmar —la fila salió del listado, la recarga falló o otro supertécnico movió la fila dentro de los 8 s— no se manda una escritura condenada al 409 ni se pisa el cambio ajeno: se avisa al usuario de que lo revise a mano.
- [x] Abrir y cerrar el desplegable de la celda congela y reanuda el sondeo (D4).

## Editores del menú contextual

- [x] Comentario: diálogo "Comentario de asignación" con la etiqueta "Comentario — `<idRep>`", área de 4 líneas precargada con el comentario de la fila, "Guardar" y "Cancelar" (`editor-comentario`). El texto **no se recorta**: se guarda tal cual, como el JavaFX.
- [x] Guardar el comentario va por el mismo endpoint que reasignar, mandando el **técnico actual sin tocarlo**; el pulido va por el suyo.
- [x] Modelo (solo pulido): diálogo "Editar modelo" con campo de filtro, la lista de modelos y el actual **preseleccionado**, "Guardar" y "Cancelar" (`editar-modelo`). Escribe el modelo del **teléfono**, no de la asignación.
- [x] Cliente: diálogo "Seleccionar cliente" con buscador, el sentinel **"— Sin cliente —"** el primero, el cliente actual resaltado, la etiqueta "Nada seleccionado" y "Seleccionar" (`editar-cliente`). Escribe el cliente del **teléfono**.
- [x] Modelo y cliente cambian el teléfono, así que al terminar se recarga la lista entera: las demás filas del mismo IMEI quedan al día en el acto.
- [x] Cliente con bloqueo optimista sobre el teléfono: si otro lo cambió mientras tanto, **aviso y recarga** (spec §14).
- [x] Abrir, cerrar, guardar y salir con Escape en cualquiera de los tres avisa de la interacción y congela/reanuda el sondeo.

## Borrado

- [x] La papelera de la última columna abre la confirmación; **no pide motivo** (`asig-confirm-borrar`).
- [x] Título "Borrar asignación `<idRep>`"; texto "El técnico dejará de verla en su lista de pendientes."; botones "Borrar asignación" (rojo) y "Cancelar".
- [x] Si la fila es una incidencia, el texto añade "y la incidencia se marcará como no activa en la tabla principal.".
- [x] Tres endpoints según la fila, calco del JavaFX: el pulido por `DELETE /api/pulidos/asignaciones/{idAP}`; una incidencia por `DELETE /api/reparaciones/imei/{imei}/incidencia-activa?tipo=R|G` (así deja de ser activa también en el historial); el resto por `DELETE /api/reparaciones/asignaciones/{idAsig}`. Ninguna manda cuerpo.
- [x] "Cancelar" no borra. Tras borrar se recargan la lista y la carga de técnicos.
- [x] Mientras la confirmación está abierta el sondeo se congela (D4): una recarga movería la fila y la confirmación caería sobre otra.

## Ventana "Carga de técnicos"

- [x] El botón de la cabecera abre la ventana "Carga de técnicos", con el toggle **Pedidos | Total** al lado del título y **Pedidos** activo en cada apertura (`carga-tecnicos`).
- [x] Cambiar de alcance **no vuelve al servidor**: la respuesta trae los dos alcances y el toggle es instantáneo, como en el JavaFX (`carga-tecnicos-alcance`).
- [x] Los datos salen de `GET /api/reparaciones/carga-tecnicos`, que exige SUPERTECNICO o ADMIN y devuelve `{ pedidos, total }`. El cálculo se ha movido del cliente al servidor sin cambiar de resultado (D3), con la suite del cliente portada tal cual.
- [x] El día de la semana se resuelve en **Europe/Madrid**, no en la zona del proceso, o el fin de semana se desplazaría y la carga saldría a cero un día entero.
- [x] El tramo "hecho hoy" degrada a vacío si su consulta falla: la respuesta se queda en solo-pendiente en vez de dar error, igual que la tolerancia del JavaFX.
- [x] Una fila por técnico **activo**, con ceros para quien no tenga carga, ordenadas de mayor a menor carga del día (lo hecho más lo pendiente).
- [x] Cada fila: nombre (110 px, negrita, recortado con elipsis) + dos barras en el mismo carril y la misma escala, saturadas al 100 % — arriba 10 px con el total del día en el color de su nivel, debajo 5 px en verde con el progreso de lo completado hoy — + el hueco fijo de 140 px con las cifras.
- [x] Colores por nivel del total: ≥ 90 rojo #E53935, ≥ 70 ámbar #F9A825, resto azul #1565C0; y los tonos oscuros del texto #C62828 / #B26A00 / #0D47A1. Carril #E8EAF0.
- [x] Punto de identidad del alcance activo antes de la cifra: violeta #7B1FA2 en Pedidos, azul #1565C0 en Total.
- [x] Cifras: el porcentaje total redondeado a entero y teñido por su nivel, con "✓ N%" en verde (#2E7D32) debajo.
- [x] Sin jornada (fin de semana): la cifra es "—" en tinta plana, debajo "sin jornada hoy" (9 px, gris) y las dos barras no pintan nada. No hay porcentaje sin jornada.
- [x] Tooltip de la fila: "Pendiente: … — Hecho hoy: …" con el desglose (normales · chasis · por cerrar · glass · en espera de pieza) omitiendo los ceros, el tramo vacío omitido entero y, si los dos lo están, "sin carga de cliente" en Pedidos o "sin carga" en Total. Segunda línea: "Click: ver sus asignaciones" (`carga-tecnicos-fila-resaltada`).
- [x] El tooltip usa el plural fijo del JavaFX también con uno ("1 normales"): es calco literal, fijado con un test a propósito.
- [x] Al pasar el ratón por la lista, **las demás filas se atenúan** y la de debajo del cursor conserva la opacidad; el hueco entre filas pertenece a alguna fila, así que no hay zona muerta que atenúe sin resaltar nada.
- [x] Pulsar una fila **cierra la ventana y deja la tabla filtrada por ese técnico en solitario**; el resto de filtros se queda como estaba (`carga-tecnicos-click-tecnico`).
- [x] La fila entera es un botón: se puede enfocar y activar con el teclado.
- [x] Botón "Cerrar" abajo a la derecha.
- [x] La consulta solo se pide con la ventana abierta; no se sondea de fondo.
- [x] Si la consulta falla, la ventana se abre con un mensaje en el hueco de la lista y **la tabla de fondo no se ve afectada**: son dos consultas independientes. El mensaje se queda dentro de la ventana, sin apilar además el diálogo de error global.
- [x] Abrir y cerrar la ventana congela y reanuda el sondeo (D4).

## Diálogo "Técnicos de glass"

- [x] Título "Técnicos de glass", subtítulo "A quién se le asigna la glass automáticamente" y una casilla por técnico activo con su estado actual (`tecnicos-glass`).
- [x] Al pie, la nota que explica la regla, con los literales del JavaFX.
- [x] Al pulsar "Aceptar" **solo se mandan los cambios**: una llamada `PATCH /api/tecnicos/{idTec}/glass` por cada casilla que difiera del estado del servidor. El cuerpo lleva `habilitado` (no `esGlass`).
- [x] Aceptar sin tocar nada no manda ninguna petición: equivale a cerrar. Marcar y desmarcar al mismo técnico tampoco manda la suya.
- [x] Un técnico que ya no esté en la lista (dado de baja con el diálogo abierto) no genera una petición fantasma.
- [x] Si alguna llamada falla, **el diálogo no se cierra**: muestra "No se pudo guardar: `<motivo>`" y los checks vuelven a enseñar la lista ya recargada del servidor, de modo que lo que no se guardó aparece sin guardar.
- [x] Mientras hay escrituras en vuelo, ni "Aceptar" ni "Cancelar" ni Escape ni el fondo cierran el diálogo: un fallo posterior al cierre no tendría dónde avisar.
- [x] "Cancelar" cierra sin mandar nada. Cada apertura arranca del estado del servidor.
- [x] Abrir y cerrar el diálogo congela y reanuda el sondeo (D4).

## Modo solo lectura (ADMIN)

- [x] El ADMIN abre la misma ruta y ve la misma tabla; el TECNICO no puede (D6).
- [x] Desaparece el botón "Asignar" —con su fila entera, no queda un botón muerto— (`asig-admin`).
- [x] Desaparece la **columna** de la papelera: diez cabeceras en vez de once, no una celda vacía.
- [x] El menú contextual se queda en **"Copiar celda"** y nada más (`asig-admin-menu`).
- [ ] La celda Técnico se muestra como **texto plano**, sin desplegable: el ADMIN no reasigna. El texto plano está, pero con un subtexto de más que el JavaFX no tiene: ver «Diferencias nuevas detectadas al marcar la ficha».
- [x] Las casillas de "Técnicos de glass" salen deshabilitadas y el único botón es "Cerrar" (sin "Aceptar" ni "Cancelar").
- [x] Los cinco filtros, "Limpiar filtros" y la ventana de carga funcionan con normalidad para el ADMIN.
- [x] Esto es la capa visible, no la protección: reasignar, urgente, chasis, el comentario, el borrado y los técnicos de glass exigen ya **SUPERTECNICO** en el servidor, y la carga de técnicos exige SUPERTECNICO o ADMIN.

## Errores

- [x] Se reutiliza el mapeo de errores del sub-proyecto 0: sin conexión y timeout muestran el banner; 401 lleva al inicio de sesión; 403 muestra el aviso de permisos.
- [x] 409 en el editor de cliente: avisa con el literal de "el teléfono lo cambió otro usuario" y recarga la lista.
- [x] Un fallo en cualquiera de las escrituras de la tabla (reasignar, urgente, chasis, comentario, borrado) lo cuenta el manejador global de mutaciones, sin duplicar el aviso.
- [x] La carga de técnicos y los técnicos de glass silencian el manejador global a propósito y pintan su error **dentro** de su ventana.

## Comportamientos del JavaFX calcados a propósito

- El filtro Estado combina sus casillas con **O**, no de forma excluyente.
- Quedarse sin ningún cliente marcado **no vacía la tabla**: el conjunto vacío significa "no filtrar".
- El tooltip de la carga dice "1 normales", sin singular: es el literal del JavaFX y está fijado con un test.
- "Asignado por" vacío pinta "—".
- El filtrado es en memoria y la lista completa se descarga entera (D7).
- Urgente y chasis escriben sin confirmación previa; el único añadido es la vuelta atrás (D2).
- El urgente se propaga de la reparación a su glass hermana, y deshacerlo revierte las dos.
- La entrega de glass **no se maneja desde esta vista**: aquí solo se pintan sus badges y píldoras. El menú de entregar y deshacer vive en Pendientes del técnico.
