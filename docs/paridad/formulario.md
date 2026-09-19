# Ficha de paridad — Formulario de reparación (FormularioReparacionView.fxml: flujo nuevo, Glass y modo edición)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), `FormularioReparacionController` (con sus clases internas de fila y de otras acciones), `FormularioReparacionView.fxml` y `ConfirmDialog`. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-19-web-formulario-design.md`.

Capturas: `Apuntes/paridad-capturas/formulario/{form-nuevo-inicial,form-combo-sku,form-filtro-modelo,form-fila-activa,form-fila-reutilizado,form-dialogo-observacion,form-otras-acciones-linea,form-subfila-sin-stock,form-dialogo-solicitar-pieza-sin-stock,form-subfila-stock-limite,form-dialogo-solicitar-y-descontar,form-subfila-solicitud-confirmada,form-dialogo-editar-descripcion,form-confirmacion-terminar,form-borrador-con-solicitud-confirmada,form-glass-nuevo,form-con-solicitud-pendiente,form-dialogo-solicitud-guardada,form-con-solicitud-rechazada,form-editar,form-editar-invalido,form-editar-cambio-valido,form-editar-cerrar-con-cambios,historial-menu-editar,pendientes-glass-con-boton,pendientes-tecnico-solicitud-pendiente,pendientes-tecnico-solicitud-rechazada}.png`. Las capturas están a ~125 % de escala: sus píxeles no son los lógicos; los valores de esta ficha salen del código. Sin captura (descrito desde el código): "Selecciona un modelo de iPhone para continuar", banda de incidencia, "✓ Recibido", "⚠ En camino", "✓  Ya reparado" y "✓ Ya reparada", "✓ Confirmar" de fila y de acción, línea de acción guardada, avisos de error, "✓  Confirmar terminar" en edición y "Cancelar solicitud" sobre una solicitud ya guardada.

Los dobles espacios dentro de los textos entre comillas son literales. `<tipo>` = nombre traducido del tipo de fila.

## Apertura, rutas y cierre

- [ ] Roles: flujo nuevo y Glass, TECNICO y SUPERTECNICO sobre sus propias asignaciones; edición, solo SUPERTECNICO; ADMIN no tiene ninguna entrada al formulario.
- [ ] Flujo nuevo: el botón "Añadir reparación" de Pendientes navega a `/reparaciones/pendientes/reparar/<idAsignacion>`; "Añadir glass" a `/reparaciones/pendientes/glass/reparar/<idAsignacion>`. Se abre directamente, sin confirmación previa.
- [ ] Edición: "Editar" del menú contextual del Historial navega a `/reparaciones/historial/editar/<idRep>` (pestaña Glass: `/reparaciones/historial/glass/editar/<idRep>`) y el del detalle de IMEIs a `/reparaciones/imeis/<imei>/editar/<idRep>`. Se abre directamente, sin confirmación previa.
- [ ] Título (pestaña del navegador): "Nueva reparación — IMEI <imei>" en flujo nuevo y Glass; "Editar reparación — <idRep>" en edición. El formulario no tiene barra de título propia con otro texto.
- [ ] Diálogo modal sobre la página (la lista sigue montada debajo y no es interactiva), fondo #DDE1E7, que ocupa casi toda la ventana con un mínimo equivalente a 960×700 px; contenido de arriba abajo: barra superior, bandas de aviso, cabecera de columnas, filas (o "Selecciona modelo"), OTRAS ACCIONES, hueco flexible y zona de guardar pegada al fondo.
- [ ] Cerrar en flujo nuevo y Glass (✕, Atrás, Escape sin otro diálogo encima): **nunca pregunta**; cancela el temporizador del borrador, vuelca el borrador en ese momento (PUT, o DELETE si está vacío) y cierra.
- [ ] Cerrar en edición: si la zona de guardar no está visible, cierra sin más; si está visible ("hay cambios"), no cierra y abre el diálogo "Salir sin guardar".
- [ ] Diálogo "Salir sin guardar": caja de 400 px, fondo #F6F6F6, borde 1 px #C2C8D0, padding 24, separación 10, sin barra de título. Arriba, título "Salir sin guardar" (18 px negrita, #B03040) y a la derecha "✕" (16 px negrita, #586376, cursor de mano; equivale a "Cancelar"), con 8 px de padding inferior. Descripción "Tienes cambios sin guardar que se perderán si cierras el formulario." (13 px, #2C3B54, ancho máximo 352, con salto de línea). Botón "Salir sin guardar" a ancho completo (fondo #A84040, texto #F6F6F6, 12 px, radio 4, padding 10): cierra el formulario sin guardar. Debajo, "Cancelar" a ancho completo (fondo #F6F6F6, texto y borde #586376, radio 4, 12 px, padding 10): vuelve al formulario. Sin cuenta atrás: los botones están activos desde el principio.
- [ ] Al cerrar, con o sin guardar, se recarga la lista de debajo (y los contadores de Pendientes).
- [ ] F5 o acceso directo por URL reabre el formulario con la misma carga que desde la lista; en flujo nuevo recupera el borrador.
- [ ] Si falla la carga inicial (componentes, solicitudes, incidencia, detalle de edición) se muestra el mensaje del error con el aviso del shell. En edición, si el detalle llega vacío, el formulario queda sin contenido.

## Cabecera y avisos

- [ ] Barra superior: fondo #C8CDD6, padding 10 16, separación 16, centrada en vertical. A la izquierda la etiqueta IMEI (13 px negrita, #2C3B54); a la derecha "Filtrar por modelo:" (12 px, #586376) y el combo de modelo.
- [ ] Etiqueta IMEI: "IMEI: <imei>" en flujo nuevo; "IMEI: <imei>  ·  Editando <idRep>" en edición de una pieza; "IMEI: <imei>  ·  Editando acción <idRep>" en edición de una acción "otro" (dos espacios a cada lado del "·").
- [ ] Combo de modelo: 180 px, estilo de combo navy de la aplicación (fondo #001232, radio 24, texto #FAFAFA 12 px negrita, hover #0A2040; lista blanca con borde #C2C8D0 y radio 8, opción 12 px negrita #001232, opción activa con fondo #001232 y texto blanco, radio 8), texto vacío "— Selecciona modelo —". El valor interno es el código del modelo; se muestra traducido en el botón y en la lista.
- [ ] Opciones del combo: solo los modelos para los que alguna fila de componente visible tiene un SKU activo, en este orden fijo: 6s, 6splus, 7, 7plus, 8, 8plus, se2020, x, xr, xs, xsmax, 11, 11pro, 11promax, 12, 12mini, 12pro, 12promax, 13, 13mini, 13pro, 13promax, 14, 14plus, 14pro, 14promax, 15, 15plus, 15pro, 15promax, 16, 16e, 16plus, 16pro, 16promax, 17, air, 17pro, 17promax. Los componentes "otro" no aportan modelos.
- [ ] Traducción del modelo: `se2020` → "iPhone SE 2020", `x` → "iPhone X", `xr` → "iPhone XR", `xs` → "iPhone XS", `xsmax` → "iPhone XS Max", `6s` → "iPhone 6S", `6splus` → "iPhone 6S Plus", `air` → "iPhone Air"; resto "iPhone " + dígitos + sufijo (`plus` → " Plus", `mini` → " Mini", `pro` → " Pro", `promax` → " Pro Max", `e` → "e" pegado: "iPhone 16e").
- [ ] Modelo de un SKU: en minúsculas, se quita el prefijo del tipo y, si lo que queda empieza por "i", esa "i"; el modelo es el código de la lista **más largo** que sea prefijo del resto (`<prefijo>i13promax…` → `13promax`, no `13`); si ninguno, sin modelo.
- [ ] Modelo inicial con solicitudes cargadas (de cualquier estado, también rechazadas): se pone el primer modelo deducible del SKU de alguna solicitud; el combo se deshabilita solo si alguna fila quedó con solicitud activa (pendiente o en camino); con solo rechazadas o recibidas queda habilitado. Las filas están siempre visibles; si no se deduce modelo, quedan visibles sin filtro (todos los SKU activos de cada tipo).
- [ ] Modelo inicial sin solicitudes, flujo nuevo: filas ocultas y texto "Selecciona un modelo de iPhone para continuar" (13 px, #586376, centrado, padding vertical 40) hasta que haya modelo; la cabecera de columnas sigue visible. Al elegir modelo aparecen las filas; si se vacía, se vuelven a ocultar.
- [ ] Después, si el combo sigue sin valor y no es edición, se consulta `GET /api/telefonos/{imei}/modelo`; si devuelve un modelo de la lista, se selecciona y el combo queda **deshabilitado**. Un fallo se ignora en silencio.
- [ ] El borrador solo fija el modelo si el combo no está deshabilitado y el modelo existe entre las opciones.
- [ ] En edición: el modelo es el del SKU de la fila editada (o el del SKU `otro…` de la acción editada) y el combo está siempre deshabilitado.
- [ ] Cambiar el modelo reaplica el filtro a todas las filas y **resetea todas las no guardadas sin avisar** (cantidad 0, "Reutilizado" desmarcado, observación borrada, agotado confirmado deshecho, sub-fila oculta) y recalcula la sección OTRAS ACCIONES.
- [ ] Banda de conflicto (solo flujo nuevo y Glass): fondo #FFF3E0, padding 5 16, texto 12 px negrita #E65100 con salto de línea. Datos de `GET /api/reparaciones/imei/{imei}/asignaciones-activas`, excluida la asignación propia; si queda alguna: "⚠ Este IMEI también está asignado a — " + categorías unidas por " · ", cada una "<Categoría>: <técnico>, <técnico>". Categoría por prefijo del id: `AG` → "Glass", `AP` → "Pulido", resto → "Reparación"; orden fijo Reparación, Glass, Pulido, omitiendo las vacías; al nombre se le añade " (tú)" si es el técnico de la sesión. Un fallo de la consulta se ignora en silencio.
- [ ] Banda de incidencia (solo flujo nuevo y Glass): sin fondo, padding 5 16, texto 12 px sin negrita #CC4444: "⚠ Resuelve incidencia: <idRep>". Se consulta siempre `GET /api/reparaciones/imei/{imei}/incidencia-activa?tipo=R` (`tipo=G` si la asignación empieza por `AG`); si devuelve un id se muestra la banda y ese id se envía como `idRepAnterior` en todos los guardados. Un fallo de esta consulta sí muestra error.
- [ ] Banda "✓ Borrador recuperado": justo debajo de la de incidencia y encima de la cabecera de columnas; fondo #E3F2FD, texto #1565C0 11 px negrita, padding 4 16, ancho completo. Solo si se recuperó un borrador no vacío; no desaparece mientras el formulario siga abierto.

## Filas de componente

- [ ] Cabecera de columnas: fondo #BCC2CB, borde inferior 1 px #A8AEB7; etiquetas 12 px #586376, padding 6 10, con anchos mínimos: "Unit (+/-)" 70 · "Componente" 100 · "SKU" 170 · "Stock" 70 · "¿Reutilizado?" 110 · "Observación" 280 (fijo). El botón de la derecha de cada fila no tiene columna.
- [ ] Una fila por tipo de `GET /api/componentes/agrupados` (mapa prefijo → componentes), en el orden de claves del servidor, saltando los grupos vacíos; `g` y `mc` siempre al final; `otro` no es fila (alimenta OTRAS ACCIONES). Nombres: `bat` → "Batería", `cha` → "Chasis", `g` → "Glass", `cam` → "Cámara", `lcd` → "Pantalla", `mc` → "Marco"; cualquier otro prefijo se muestra tal cual. Reparación: todos menos `g` y `mc`; Glass: solo `g` y `mc`.
- [ ] Fila: fondo #F3F3F3, borde inferior 1 px #E0E0E0, alto mínimo 37 px, centrada en vertical; orden: contador, nombre, combo SKU, stock, "Reutilizado", observación, botón derecho; debajo, la sub-fila de agotado.
- [ ] Contador (70 px): número de 34 px de ancho centrado, fuente Inter 20 px, inicial "0"; a su derecha, columna de 35 px con "+" arriba y "-" abajo (35×18 px cada uno, fondo #A9A9A9, texto #E7E7E7 14 px negrita, radio 0, padding 0, cursor de mano). Color del número: #A9A9A9 con 0, #000000 con más de 0, peso normal.
- [ ] Nombre del tipo: 100 px, 12 px, padding 0 10.
- [ ] Combo SKU: 170 px fijo, 8 opciones visibles, 11 px, mismo estilo navy; cada opción es el SKU; sin valor muestra "—". Opciones = SKU activos del tipo cuyo modelo coincide con el elegido (todos los activos si no hay modelo). Valor por defecto: el primero con stock > 0 o, si ninguno, el primero.
- [ ] Color del SKU, en la lista y en el botón: #B03040 si stock 0; #C07800 si 0 < stock ≤ mínimo; color normal en otro caso.
- [ ] Stock: 70 px centrado, 12 px, padding 0 10; el stock del SKU seleccionado, o "—" si el tipo no tiene SKU para el modelo.
- [ ] Tipo sin SKU para el modelo: la fila **no se oculta**; queda con opacidad 0,4, combo vacío y deshabilitado, y "+", "-", "Reutilizado" y observación deshabilitados.
- [ ] Estado inicial de una fila con SKU: "-" deshabilitado; "+" deshabilitado si el stock es ≤ 0; "Reutilizado" y observación habilitados; opacidad 1.
- [ ] "+": solo suma si cantidad < stock; tras sumar se deshabilita si cantidad ≥ stock y deshabilita "Reutilizado". "-": resta si > 0, recalcula "+", y al llegar a 0 rehabilita "Reutilizado" y se deshabilita.
- [ ] "Reutilizado" (casilla con ese texto, 110 px, 12 px, padding 0 10): al marcar deshabilita "+" y "-"; al desmarcar habilita "+" **sin mirar el stock** (con stock 0 el clic no hace nada) y "-" vuelve a deshabilitado por estar a 0. Cantidad > 0 y "Reutilizado" son excluyentes.
- [ ] Cambiar de SKU: actualiza el stock mostrado; si la cantidad supera el nuevo stock pasa a 0 y se rehabilita "Reutilizado"; sin "Reutilizado", "+" se deshabilita si cantidad ≥ stock; recalcula la sub-fila de agotado. (En la fila en edición, con el mismo componente original, ni se pone a 0 ni se deshabilita "+" por este motivo.)
- [ ] Observación (ancho máximo 280): botón "Añadir observación" con icono `editar.png` 14×14 (fondo #888888, texto #E7E7E7 11 px, radio 0, padding 4 10, alto 27). Con observación puesta: el texto (12 px, #000000, cortado con "…") y una papelera (`borrar.png` 20×20, fondo transparente, padding 2 4); el botón de añadir se oculta, así que para cambiarla hay que borrarla y añadirla de nuevo. La papelera la borra sin confirmación.
- [ ] Diálogo "Observación" (440 px): cabecera "Observación para: <tipo>", área de texto de 5 líneas (13 px, con salto de línea, precargada con la observación actual), botón "Guardar" a ancho completo (fondo #8AC7AF, texto blanco 12 px, padding 8) y "Cancelar". "Guardar" recorta espacios: con texto lo guarda y cierra; con texto vacío cierra **sin cambiar nada** (no borra la existente).
- [ ] Cualquier cambio en la fila (contador, SKU, "Reutilizado", observación) recalcula el botón derecho, la zona de guardar y reprograma el autoguardado del borrador.

## Guardar fila y fila guardada

- [ ] "✓ Guardar fila" (botón derecho, alto 27: fondo #001232, texto blanco 11 px negrita, radio 4, padding 4 10) aparece solo en flujo nuevo y Glass, en una fila no guardada, sin solicitud activa y sin agotado confirmado, cuando cantidad > 0 o "Reutilizado" está marcado; se oculta cuando deja de cumplirse. Convive con la sub-fila "Stock agotado…" cuando cantidad = stock. En edición no existe nunca.
- [ ] Dos clics: el primero cambia el texto a "✓ Confirmar" (mismo estilo); cualquier cambio en la fila lo devuelve a "✓ Guardar fila"; el segundo guarda.
- [ ] Guardar: botón deshabilitado mientras dura; `POST /api/reparaciones/{idAsignacion}/filas` con una fila `{idCom, cantidad, reutilizado, observacion, prefijo, esSolicitud: false}` más `imei` e `idRepAnterior` (si hay incidencia); respuesta `{value: <idRep>}`. Con éxito: fila guardada con la fecha **local del navegador** en formato `dd/MM HH:mm`, borrador volcado al momento (sin esperar los 2 s) y zona de guardar recalculada.
- [ ] Fila guardada: fondo #F1F8F1 con borde inferior #C5E1C5; combo SKU, "+", "-", "Reutilizado" y "Añadir observación" deshabilitados; botón derecho deshabilitado "✓ Guardada dd/MM HH:mm" (fondo #E8F5E9, texto #2E7D32, 11 px, radio 0, padding 4 10). Una guardada con "Reutilizado" muestra contador 0 y la casilla marcada y atenuada. Ignora los cambios de modelo y no vuelve a enviarse al terminar.
- [ ] La papelera de una observación ya puesta en una fila guardada no se deshabilita (ver «Pendiente de decidir» n.º 3).
- [ ] El estado "guardada" vive **solo en el borrador**: tras "Terminar asignación" el borrador se borra, y si la asignación sigue abierta (por una solicitud) y se reabre, esa fila vuelve a salir normal.
- [ ] Error al guardar: el botón se rehabilita, la fila no se bloquea y se avisa con "No se pudo guardar la fila: <mensaje>".

## Sub-fila de agotado y solicitud de pieza

- [ ] Sub-fila bajo la fila: fondo #FFF8E0, padding 4 8 4 70 (sangría izquierda de 70 px), separación 10, con etiqueta (11 px, #7A5C00), botón ámbar (fondo #E8A825, texto blanco 11 px, radio 4, padding 4 10, cursor de mano) y lápiz (`editar.png` 16×16, fondo transparente, padding 2 4) oculto hasta confirmar.
- [ ] No se evalúa en la fila en edición, ni con agotado ya confirmado, ni con solicitud activa. Variante **sin stock** (stock del SKU = 0): "⚠  Sin stock disponible. Solicita la pieza para que el admin gestione el pedido." + botón "Solicitar pieza". Variante **límite** (sin "Reutilizado", stock > 0 y cantidad ≥ stock): "⚠  Stock agotado. Puedes descontar los componentes fallidos y solicitar reposición." + botón "Solicitar y descontar stock". Si ninguna, oculta. Se evalúa también al pintar la fila por primera vez.
- [ ] Diálogo "Solicitar pieza — <tipo>" (460 px): cabecera según variante — sin stock: "Sin stock disponible." y, en otra línea, "Se creará una solicitud PENDIENTE para que el admin gestione el pedido."; límite: "Se descontarán <N> unidades de stock y quedará una solicitud PENDIENTE." y, en otra línea, "La asignación permanecerá abierta hasta recibir la pieza." (N = stock del SKU). Área de texto de 4 líneas (13 px) con texto de ayuda "Describe la pieza que necesitas (opcional)...", precargada si ya había descripción. Botón a ancho completo (fondo #E8A825, texto blanco 12 px, padding 8): "Confirmar: solicitar pieza" o "Confirmar: descontar <N> ud. de stock y solicitar"; y "Cancelar".
- [ ] Confirmar es **local** (no llama al servidor hasta "Terminar asignación"): descripción = texto recortado o nada; se deshabilitan "+", "-", "Reutilizado", combo SKU y "Añadir observación"; la observación que hubiera **se borra**; el botón derecho se oculta. En la variante límite el contador conserva la cantidad (= stock).
- [ ] Estado confirmado: sub-fila con fondo #E8F5E9, botón ámbar oculto, lápiz visible y etiqueta 11 px negrita #2E7D32: con stock 0, "✓  Solicitud de reposición pendiente"; con stock > 0, "✓  <N> uds. se descontarán al guardar — solicitud pendiente"; a ambas se añade " — <descripción>" si la hay. La fila cuenta como activa (aparece "Terminar asignación") y no ofrece "✓ Guardar fila".
- [ ] Lápiz → diálogo "Editar descripción de solicitud" (440 px, sin cabecera): misma área de texto precargada; "Guardar descripción" (fondo #E8A825, texto blanco 12 px, padding 8), "Cancelar solicitud" (fondo #C94040, mismo formato) y "Cancelar" (cierra sin cambios).
- [ ] "Guardar descripción" actualiza la descripción y la etiqueta, pero **no** reprograma el autoguardado: el cambio entra en el borrador con el siguiente cambio o al cerrar.
- [ ] "Cancelar solicitud" sobre una solicitud local: vuelve al estado anterior a confirmar — cantidad 0, "Reutilizado", combo SKU y observación habilitados, "+" según stock, sub-fila de nuevo en #FFF8E0 con etiqueta #7A5C00, botón ámbar visible y lápiz oculto; se recalcula la variante.

## Solicitudes ya guardadas (estados)

- [ ] Al abrir (flujo nuevo y Glass): `GET /api/reparaciones/asignaciones/{idAsignacion}/solicitudes` (se usan `idCom`, `descripcionSolicitud`, `estadoSolicitud`, `enCamino`; incluye rechazadas). Cada solicitud no rechazada se aplica a la fila cuyo tipo contiene ese `idCom`, seleccionando ese SKU, y se vuelve a aplicar después de fijar el modelo (que resetea las filas).
- [ ] **Pendiente** (o gestionada sin stock), sin `enCamino`: fila bloqueada — cantidad 0, "+", "-" y combo SKU deshabilitados, **"Reutilizado" habilitado**, "Añadir observación" habilitado, sin botón derecho; sub-fila verde "✓  Solicitud de reposición pendiente" + " — <descripción>" con lápiz. No ofrece "✓ Guardar fila" ni hace visible por sí sola la zona de guardar.
- [ ] **En camino** (`enCamino`, salvo el caso "recibido"): igual, pero "Reutilizado" desmarcado y **deshabilitado**, y botón derecho deshabilitado "⚠ En camino" (fondo #E3F2FD, texto #1565C0, 11 px, radio 0, padding 4 10).
- [ ] **Recibido** (`estadoSolicitud = GESTIONADA` y stock del SKU > 0): fila normal y editable, sin sub-fila, con botón derecho deshabilitado "✓ Recibido" (fondo #E8F5E9, texto #2E7D32, 11 px, radio 0, padding 4 10). Al activar la fila, el botón pasa a "✓ Guardar fila"; si se desactiva, se oculta y "✓ Recibido" ya no vuelve.
- [ ] **Rechazada**: no se marca de ningún modo; solo se preselecciona su SKU (si está entre las opciones del modelo), con lo que la fila muestra el SKU en rojo y la sub-fila amarilla "Sin stock… / Solicitar pieza". El combo de modelo queda habilitado.
- [ ] Marcar "Reutilizado" en una fila con solicitud pendiente la activa: al terminar se envía como fila normal (`reutilizado: true`, `esSolicitud: false`) y el servidor resuelve la solicitud de ese componente.
- [ ] Una fila con solicitud activa ignora lo que traiga el borrador para su tipo.
- [ ] Lápiz sobre una solicitud ya guardada: abre el mismo diálogo con la descripción precargada; "Guardar descripción" cambia solo la etiqueta en pantalla, sin llamada al servidor; "Cancelar solicitud" tampoco llama al servidor: la fila queda con la sub-fila visible en ámbar (texto anterior, botón ámbar visible) y el combo y "Reutilizado" habilitados, y al reabrir el formulario la solicitud sigue ahí (ver «Pendiente de decidir» n.º 1).
- [ ] Fila con "✓ Recibido" visible y cambio a un modelo sin SKU para ese tipo: el botón derecho queda visible en una fila atenuada (ver «Pendiente de decidir» n.º 6).

## Otras acciones

- [ ] Sección bajo las filas, en reparación y en Glass: fondo #F6F7F9 con franja izquierda de 4 px #2C3B54. Visible solo si, con el modelo elegido, existe un componente del grupo `otro` cuyo SKU da ese modelo; sin modelo, oculta. Ese componente es el `idCom` de todas las acciones.
- [ ] Cabecera (padding 8 14 2 14, separación 8): "OTRAS ACCIONES" (11,5 px negrita, #2C3B54) + badge (fondo #2C3B54, texto blanco 10 px negrita, radio 10, padding 1 8) = número de líneas guardadas o con texto; inicial "0".
- [ ] Cuerpo (padding 2 14 12 14, separación 8): caja blanca con desplazamiento (alto máximo 150, borde #C2C8D0, radio 6; líneas con separación 5 y padding 5; vacía se ve como un rectángulo blanco) y botón "+ Añadir acción" (fondo #2C3B54, texto blanco 11,5 px negrita, radio 6, padding 6 12).
- [ ] "+ Añadir acción" añade una línea y le da el foco; está deshabilitado mientras exista una línea no guardada con el texto vacío.
- [ ] Línea: campo con texto de ayuda "Describe la acción" (12 px, fondo blanco, borde #C2C8D0, radio 4, ocupa el ancho) + "✓ Guardar" (fondo #001232, texto blanco 11 px negrita, radio 4, padding 4 10; deshabilitado con texto vacío) + papelera (`borrar.png` 18×18, transparente, padding 2 4) que quita la línea sin confirmación.
- [ ] "✓ Guardar" en dos clics: el primero pasa a "✓ Confirmar"; escribir lo devuelve a "✓ Guardar"; el segundo deshabilita el botón y llama a `POST /api/reparaciones/{idAsignacion}/filas` con una fila `{idCom: <otro>, cantidad: 0, reutilizado: false, observacion: <texto recortado>, prefijo: "otro", esSolicitud: false}` más `imei` e `idRepAnterior`. Con éxito: borrador volcado al momento y línea guardada.
- [ ] Línea guardada: campo deshabilitado, "✓ Guardar" y papelera ocultos, y etiqueta "✓ Guardada dd/MM HH:mm" (11 px negrita, #2E7D32, padding 0 4), con la hora local del navegador.
- [ ] Error al guardar la acción: botón rehabilitado con el texto todavía en "✓ Confirmar" (el siguiente clic vuelve a pedir confirmación) y aviso "No se pudo guardar la acción: <mensaje>".
- [ ] En edición las líneas no tienen "✓ Guardar": se guardan con "Guardar cambios".

## Zona de guardar y terminar

- [ ] Zona pegada al fondo: fondo #ECEEF1, borde superior 1 px #CFD3DA, padding 12 16, contenido a la derecha; un único botón navy (fondo #001232, texto blanco 12 px negrita, radio 24, padding 8 16, hover #0A2040). Se muestra u oculta **la zona entera**; el botón nunca se deshabilita.
- [ ] Visible en flujo nuevo y Glass si hay alguna fila no guardada activa (cantidad > 0, "Reutilizado", o agotado confirmado en esta sesión), alguna acción pendiente con texto, alguna fila guardada o alguna acción guardada. Una solicitud cargada del servidor no la muestra por sí sola.
- [ ] Texto "Terminar asignación" (flujo nuevo y Glass) o "Guardar cambios" (edición). Primer clic: "✓  Confirmar terminar" — **también en edición** (ver «Pendiente de decidir» n.º 7). Segundo clic: ejecuta. No hay vuelta atrás: cambiar filas no restaura el texto. Si el guardado falla, el texto sigue en "✓  Confirmar terminar" pero hacen falta otros dos clics.
- [ ] Terminar, paso 1: por cada fila con agotado confirmado en esta sesión, en orden de filas, `POST /api/reparaciones/{idAsignacion}/agotar-componente {idCom, cantidad, descripcion}` (`cantidad` = contador: 0 en "sin stock", el stock en "límite"; sin descripción se omite). Si una falla se avisa y se detiene; las anteriores quedan hechas (ver «Pendiente de decidir» n.º 4).
- [ ] Paso 2: filas a enviar = las no guardadas, sin agotado nuevo y activas (incluidas las de solicitud cargada con "Reutilizado" marcado), más una por cada acción pendiente (`cantidad: 0`, `prefijo: "otro"`, `observacion` = texto).
- [ ] Paso 3: si no hay filas a enviar y hubo algún agotado nuevo, **no** se llama a `completa`: se borra el borrador y se cierra (la asignación queda abierta con su solicitud).
- [ ] Paso 4: en otro caso, `POST /api/reparaciones/completa {filas, imei, idRepAnterior, idAsignacion}` — también con `filas` vacía cuando solo había filas guardadas una a una (es lo que cierra la asignación). Con éxito: se borra el borrador, se cierra y se recarga la lista.
- [ ] Los campos sin valor se omiten del JSON; cada fila lleva `idCom, cantidad, reutilizado, prefijo, esSolicitud: false, enCamino: false` y, si los hay, `observacion` y `descripcionSolicitud`.

## Borrador

- [ ] Solo flujo nuevo y Glass, por asignación: `GET|PUT|DELETE /api/reparaciones/{idAsignacion}/borrador`; el contenido viaja como cadena JSON en `{contenido}`.
- [ ] Forma exacta (mismos nombres que el JavaFX): `{modelo, filas[], otros[]}`; fila `{prefijo, idCom (-1 sin elegir), cantidad, reutilizado, observacion, solicitudNueva, descripcionSolicitud, agotadoConfirmado, descripcionAgotado, guardada, idRepGenerado, fechaGuardado}`; acción `{descripcion, guardada, idRepGenerado, fechaGuardado}`. `solicitudNueva` se escribe siempre `false`.
- [ ] Qué se captura: fila guardada → `prefijo, idCom, cantidad, reutilizado, guardada: true, idRepGenerado, fechaGuardado` (sin observación); fila no guardada → se omite si cantidad 0, sin "Reutilizado", sin observación y sin agotado nuevo; una solicitud cargada del servidor no se guarda como agotado; acciones con texto o guardadas, con la descripción recortada. Borrador vacío = sin filas y sin acciones (el modelo solo no cuenta).
- [ ] Autoguardado 2 s después del último cambio (se reinicia con cada cambio): vacío → DELETE; si no → PUT. Volcado inmediato tras guardar una fila, tras guardar una acción, al cerrar y tras desbloquear filas borradas. Los fallos son silenciosos.
- [ ] No se guarda mientras se está aplicando un borrador recuperado ni después de un guardado real ("Terminar asignación").
- [ ] Recuperación, después de cargar componentes y solicitudes: modelo (según la regla de la cabecera); cada fila del borrador se aplica a la primera fila de su `prefijo`; el SKU solo se preselecciona si está entre las opciones actuales (si no, queda el SKU por defecto). Fila guardada → SKU, cantidad, "Reutilizado" y estado guardado ("?" si falta el id, fecha vacía si falta). Agotado confirmado → estado confirmado con su descripción, con la variante según el stock **actual**. Normal → "Reutilizado", cantidad (mínimo 0, **sin revalidar contra el stock**) y observación. Acciones: una línea por descripción no vacía; las guardadas, bloqueadas.
- [ ] JSON ilegible o fallo al leerlo: formulario limpio, sin error y sin banda.
- [ ] Filas guardadas borradas por otro: si el borrador traía algo guardado, `GET /api/reparaciones/imei/{imei}`; cada fila o acción cuyo `idRepGenerado` ya no exista vuelve a editable (cantidad 0, "Reutilizado" desmarcado, observación borrada, fondo #F3F3F3, botón derecho oculto) y el borrador se reescribe al momento. Si la consulta falla, quedan bloqueadas hasta la siguiente apertura.

## Modo edición

- [ ] Carga: `GET /api/reparaciones/{idRep}/detalle-edicion` → `{imei, idTec, idCom, esReutilizado, observacion, cantidad, updatedAt}`; componentes agrupados (filtro Glass si `<idRep>` empieza por `G`); `GET /api/reparaciones/imei/{imei}/ya-reparados?excluir=<idRep>`. Sin banda de conflicto, incidencia, solicitudes, borrador ni consulta del modelo del teléfono.
- [ ] Fila editada: fondo #EBF4FF con borde inferior #B3D4F5; SKU, cantidad, "Reutilizado" y observación originales (la observación, como texto con papelera). "+" deshabilitado si stock ≤ 0; si era reutilizada, "+" y "-" deshabilitados; si no y cantidad > 0, "Reutilizado" deshabilitado. Sin sub-fila de agotado y sin botón derecho. "+" sigue limitado por el stock actual (no suma las unidades que se devolverían).
- [ ] Previsualización de stock en la fila editada: "<stock> → <previsto>" (p. ej. "155 → 154"), 12 px negrita, con previsto = stock + devuelto − descontado; devuelto = cantidad original si el SKU es el original y no era reutilizada (si no, 0); descontado = 0 con "Reutilizado", si no la cantidad. Color #C94040 si baja, #4CAF50 si sube, #586376 si igual. Se recalcula al cambiar contador, SKU o "Reutilizado".
- [ ] Hay cambio si varía cantidad, SKU, "Reutilizado" u observación respecto al original. Cambio sin uso (cantidad 0 y sin "Reutilizado") = inválido: contador en #C94040 negrita y zona de guardar oculta.
- [ ] Filas de otros tipos con algún SKU (de cualquier modelo) ya reparado en el IMEI: todo deshabilitado, fondo #EBF5EB con borde inferior #C5E1C5 y, al final de la fila, "✓  Ya reparado" (11 px negrita, #4CAF50, padding 0 10). Solo existe en edición.
- [ ] Resto de filas: normales (fondo gris) y editables, sin "✓ Guardar fila"; si se activan, se guardan como reparaciones nuevas con "Guardar cambios".
- [ ] Esas filas nuevas muestran la sub-fila de agotado y permiten confirmar el diálogo, pero "Guardar cambios" no registra el agotado: la fila se envía como fila normal (ver «Pendiente de decidir» n.º 2).
- [ ] Acciones en edición: las acciones "otro" de otras reparaciones del IMEI en la misma categoría (`GET /api/reparaciones/imei/{imei}/acciones?categoria=R|G&excluir=<idRep>`, fallo silencioso) salen como líneas bloqueadas con "✓ Ya reparada" (mismo estilo verde) y cuentan en el badge.
- [ ] Editar una acción "otro": ninguna fila de componente está en edición; la acción es una línea precargada, sin papelera ni "✓ Guardar". Texto vacío = inválido (oculta la zona); texto distinto y no vacío = cambio.
- [ ] Zona de guardar visible si no hay nada inválido y hay cambio válido en la fila editada, cambio en la acción editada, alguna fila nueva activa o alguna acción nueva con texto.
- [ ] "Guardar cambios", en orden: (0) acción editada → `PUT /api/reparaciones/{idRep} {idComNuevo: <otro>, esReutilizadoNuevo: false, observacionNueva, nNuevas: 0, updatedAt}`; (1) fila editada → `PUT /api/reparaciones/{idRep} {idComNuevo, esReutilizadoNuevo, observacionNueva, nNuevas: <cantidad>, updatedAt}`; (2) filas nuevas → `POST /api/reparaciones/completa {filas, imei, categoria: "G" solo si <idRep> empieza por G}`, sin `idAsignacion` ni `idRepAnterior`; (3) acciones nuevas → otro `POST /api/reparaciones/completa` aparte con esas filas (`cantidad: 0`); (4) cierra y recarga la lista. Lo ya hecho no se deshace si un paso posterior falla (para el técnico de los pasos 2 y 3, ver «Pendiente de decidir» n.º 5).
- [ ] Un cambio inválido oculta la zona de guardar, así que cerrar en ese estado **no pregunta** y el cambio se pierde.

## Variante Glass

- [ ] Asignación `AG…` o edición de una `G…`: solo filas "Glass" y "Marco" (en el orden del servidor) más OTRAS ACCIONES.
- [ ] Ningún texto del formulario cambia (título, "Terminar asignación", avisos); solo el botón de la lista dice "Añadir glass".
- [ ] Incidencia con `tipo=G`; acciones ya reparadas con `categoria=G`; la banda de conflicto agrupa igual, excluida la propia `AG…`.
- [ ] En flujo nuevo no se envía `categoria` en ninguna llamada (el servidor la deduce del prefijo `AG` de la asignación); solo en edición de una `G…` se envía `categoria: "G"` en los `POST /api/reparaciones/completa`.

## Errores

- [ ] Guardar fila: "No se pudo guardar la fila: <mensaje>". Guardar acción: "No se pudo guardar la acción: <mensaje>".
- [ ] Agotar componente: con 409, "No se pudo registrar componente agotado: <mensaje>"; con otro error, "Error al registrar componente agotado: <mensaje>". El formulario sigue abierto.
- [ ] Terminar: con 409, "No se pudo guardar: <mensaje>" y, en otra línea, "Cierra el formulario y comprueba el estado de la asignación."; con otro error, "No se pudo guardar: <mensaje>". El formulario sigue abierto y el borrador intacto.
- [ ] Guardar cambios: con 409, "No se pudo guardar: otro usuario modificó esta reparación." y, en otra línea, "Cierra y vuelve a abrir el formulario para ver los cambios actuales."; con otro error, "No se pudo guardar: <mensaje>".
- [ ] `<mensaje>`: el del servidor en 409 y 422; genéricos en el resto — 401 "Sesión expirada. Vuelve a iniciar sesión.", 403 "No tienes permisos para realizar esta acción.", 404 "Recurso no encontrado.", 500 o más "El servidor no está disponible. Inténtalo de nuevo en unos segundos.".
- [ ] 403 al abrir (asignación de otro técnico, o edición sin ser SUPERTECNICO): mensaje genérico "No tienes permisos para realizar esta acción." y vuelta a la lista.
- [ ] Silenciosos: asignaciones activas del IMEI, modelo del teléfono, acciones ya reparadas, lectura y escritura del borrador, comprobación de filas guardadas.
- [ ] Sin conexión: el banner existente del shell.

## Llamadas a la API

El técnico de cada escritura lo toma el servidor del token: la web no envía `idTec` (si el contrato lo exige, envía el de la sesión y el servidor lo ignora). Solo se completa una asignación propia; editar exige SUPERTECNICO.

| Método y URL | Cuerpo / respuesta | Cuándo |
|---|---|---|
| `GET /api/componentes/agrupados` | → `{prefijo: [{idCom, tipo (SKU), stock, stockMinimo, activo, …}]}` | Al abrir, en los tres modos |
| `GET /api/reparaciones/imei/{imei}/incidencia-activa?tipo=R\|G` | → id de la incidencia o nada | Al abrir, flujo nuevo y Glass |
| `GET /api/reparaciones/imei/{imei}/asignaciones-activas` | → `[{idRep, nombreTecnico, idTec}]` | Al abrir, flujo nuevo y Glass (fallo silencioso) |
| `GET /api/reparaciones/asignaciones/{idAsignacion}/solicitudes` | → `[{idCom, descripcionSolicitud, estadoSolicitud, enCamino}]` | Al abrir, flujo nuevo y Glass |
| `GET /api/telefonos/{imei}/modelo` | → código de modelo o nada | Al abrir, solo si el modelo sigue sin valor (fallo silencioso) |
| `GET /api/reparaciones/{idAsignacion}/borrador` | → `{contenido}` | Al abrir, flujo nuevo y Glass |
| `GET /api/reparaciones/imei/{imei}` | → reparaciones del IMEI (se usa `idRep`) | Solo si el borrador trae algo guardado |
| `PUT /api/reparaciones/{idAsignacion}/borrador` | `{contenido: "<json>"}` | Autoguardado a los 2 s y volcados inmediatos |
| `DELETE /api/reparaciones/{idAsignacion}/borrador` | — | Borrador vacío; tras terminar |
| `POST /api/reparaciones/{idAsignacion}/filas` | `{filas: [fila], imei, idRepAnterior?}` → `{value: <idRep>}` | "✓ Guardar fila" y "✓ Guardar" de acción. Asignación propia; si no, 403 |
| `POST /api/reparaciones/{idAsignacion}/agotar-componente` | `{idCom, cantidad, descripcion?}` | Terminar: una por fila con agotado nuevo, antes de `completa`. Asignación propia; si no, 403 |
| `POST /api/reparaciones/completa` | `{filas, imei, idRepAnterior?, idAsignacion?, categoria?}` | Terminar (con `idAsignacion`: asignación propia; si no, 403); filas y acciones nuevas en edición |
| `GET /api/reparaciones/{idRep}/detalle-edicion` | → `{imei, idTec, idCom, esReutilizado, observacion, cantidad, updatedAt}` | Al abrir en edición |
| `GET /api/reparaciones/imei/{imei}/ya-reparados?excluir={idRep}` | → `[idCom]` | Al abrir en edición |
| `GET /api/reparaciones/imei/{imei}/acciones?categoria=R\|G&excluir={idRep}` | → `[descripción]` | Al abrir en edición (fallo silencioso) |
| `PUT /api/reparaciones/{idRep}` | `{idComNuevo, esReutilizadoNuevo, observacionNueva?, nNuevas, updatedAt}` | "Guardar cambios". Solo SUPERTECNICO; 409 si `updatedAt` no coincide |

## Diferencias aceptadas

- Diálogo modal dentro de la página en vez de ventana aparte: ocupa casi toda la ventana con un mínimo equivalente a 960×700, y no es redimensionable ni movible (la ventana del JavaFX sí se podía redimensionar).
- La URL gobierna el formulario: ✕, Atrás del navegador y Escape (sin otro diálogo encima) hacen lo mismo que el ✕ del JavaFX; F5 lo reabre y, en flujo nuevo, recupera el borrador. El título de la ventana del JavaFX pasa a ser el de la pestaña del navegador.
- Al cerrar se recarga siempre la lista de debajo; en el JavaFX, cerrar el flujo nuevo con ✕ no la recargaba (lo hacía su refresco periódico).
- Los diálogos "Observación", "Solicitar pieza — <tipo>" y "Editar descripción de solicitud" usan el diálogo compartido de la web con los mismos textos, colores de botón y orden; en el JavaFX eran ventanas del sistema sin la hoja de estilos. "Salir sin guardar" es un modal con el mismo aspecto, sin arrastre.
- Los avisos de error usan el aviso del shell (en el JavaFX, alerta bloqueante en los 409 y no bloqueante en el resto).
- Tras el aviso de 409 en edición, la web recarga los datos de la reparación; en el JavaFX había que cerrar y volver a abrir.
- Las llamadas no bloquean la interfaz; mientras dura un guardado, su botón queda deshabilitado (en el JavaFX iban en el hilo de la interfaz).
- La web no envía `idTec`: el servidor toma el técnico del token. Un 403 muestra el mensaje genérico y vuelve a la lista.
- No se pide `GET /api/tecnicos/activos` en edición (el JavaFX lo pedía sin usarlo: el selector de técnico por fila está oculto).
- Código inalcanzable del JavaFX que no se migra: el diálogo `abrirSolicitud` ("Solicitud de pieza" / "Pieza pendiente: <tipo>", con "Marcar como solicitud") y sus textos de botón "⚠ Solicitud pieza" y "⚠ Pieza pendiente"; el doble envío "uso + solicitud" y `esSolicitud: true`; la marca de "solicitud cancelada" que mostraría la zona de guardar; el deshabilitado de filas "no implicadas" y el selector de técnico por fila. `solicitudNueva` se conserva en el borrador solo por compatibilidad, siempre `false`.

## Comportamientos del JavaFX calcados a propósito

- El flujo nuevo no marca "✓  Ya reparado" ni avisa de piezas ya cambiadas en el IMEI; solo la edición.
- "✓  Confirmar terminar" no vuelve a "Terminar asignación" aunque cambien las filas, y tras un fallo conserva el texto pero pide otros dos clics. Lo mismo el "✓ Confirmar" de una acción tras un error.
- Cerrar el flujo nuevo nunca pregunta (lo cubre el borrador); en edición, un cambio inválido se pierde al cerrar sin preguntar.
- El estado "Guardada" de filas y acciones vive solo en el borrador: sin borrador, esas filas salen editables.
- Cambiar de modelo resetea todas las filas no guardadas sin avisar, incluidos los agotados confirmados.
- Las filas sin SKU para el modelo se atenúan al 40 % en vez de ocultarse; la cabecera de columnas sigue visible con "Selecciona un modelo…".
- Una observación no se puede editar: se borra y se añade de nuevo; "Guardar" con texto vacío no borra la existente; confirmar una solicitud borra la observación de la fila.
- Tras desmarcar "Reutilizado", "+" queda habilitado aunque el stock sea 0 (sin efecto).
- El borrador restaura la cantidad sin revalidarla contra el stock actual, y "Guardar descripción" no dispara el autoguardado.
- La fecha de "✓ Guardada" es la hora local del equipo, como texto `dd/MM HH:mm` sin año.
- Una solicitud rechazada no deja ninguna marca en el formulario; con solicitud guardada, "Reutilizado" y "Añadir observación" siguen activos, mientras que con la local quedan deshabilitados.
- En la variante límite, el número del diálogo y de la etiqueta es el stock del SKU, no el contador.
- Los agotados se registran antes que `completa` y uno a uno, sin deshacer si algo falla después.
- La sección OTRAS ACCIONES no mira si el componente `otro` del modelo está activo.

## Pendiente de decidir con el usuario

1. **Lápiz sobre una solicitud ya guardada en el servidor.** "Guardar descripción" solo cambia la etiqueta en pantalla y "Cancelar solicitud" deja la fila a medio desbloquear sin cancelar nada; al reabrir, todo vuelve a como estaba. Opciones: (a) calcar tal cual; (b) ocultar o deshabilitar el lápiz cuando la solicitud ya está guardada; (c) dejar solo "Cancelar" operativo en ese diálogo.
2. **Sub-fila de agotado en filas nuevas de un formulario de edición.** El JavaFX la muestra y deja confirmar, pero "Guardar cambios" no registra el agotado: la fila se envía como normal (con cantidad 0 en la variante sin stock). Sin verificar en ejecución. Opciones: (a) calcar; (b) ocultar la sub-fila en edición.
3. **Papelera de la observación en una fila guardada.** El código bloquea "Añadir observación" pero no la papelera de una observación ya puesta; sin verificar si queda pulsable. Opciones: (a) calcar (pulsable: borra el texto en pantalla, sin efecto en el servidor); (b) deshabilitarla con el resto de la fila.
4. **Reintento de "Terminar asignación" tras un fallo parcial.** Si falla un `agotar-componente` o el `completa` posterior, los agotados ya registrados no se marcan y un reintento los enviaría otra vez. Opciones: (a) calcar; (b) recordar en el estado los ya registrados y no repetirlos.
5. **Técnico de las filas y acciones nuevas añadidas en edición.** El JavaFX las envía a `completa` con el técnico original de la reparación editada, no con el de la sesión. Con el técnico tomado del token quedarían a nombre del supertécnico que edita. Opciones: (a) atribuirlas al técnico original (el servidor lo resuelve a partir de la reparación editada); (b) aceptar que queden a nombre de quien edita.
6. **"✓ Recibido" y cambio a un modelo sin SKU para ese tipo.** Único camino teórico por el que el botón derecho quedaría visible y pulsable con la acción que no se migra, en una fila atenuada. Sin verificar. Opciones: (a) ocultar el botón en ese caso (recomendado); (b) dejarlo visible y deshabilitado con "✓ Recibido".
7. **Texto de confirmación en edición.** El primer clic en "Guardar cambios" muestra "✓  Confirmar terminar" (no existe un "Confirmar cambios"); sale del código, sin captura. Opciones: (a) calcar; (b) usar un texto propio de edición.
