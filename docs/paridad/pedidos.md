# Ficha de paridad — Pedidos y formularios de pedido (StockController, FormularioCompra*, FormularioOtroPedido*)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), la pestaña "Pedidos" de la vista Stock de `StockController` (toggle Componentes | Otros) y los formularios `FormularioCompra`, `FormularioCompraEditar`, `FormularioOtroPedido` y `FormularioOtroPedidoEditar`, con los puntos de contacto de Stock actual y de la campana. Los combos de proveedor se comparan con `?tipo=COMPONENTES` de `main`, porque el hotfix pide los proveedores sin tipo. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-25-web-almacen-pedidos-design.md`.

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `almacen/pedidos-*.png`, `almacen/form-*.png` y `almacen/stock-desde-pedidos.png`, más las cinco de referencia tomadas antes del plan (`pedidos-vista-referencia-4b`, `pedidos-menu-pendiente-referencia-4b`, `pedidos-menu-en-camino-referencia-4b`, `pedidos-cancelar-confirm-referencia-4b`, `pedidos-nuevo-combo-proveedor-referencia-4b`). Las de la web llevan el prefijo `web-`. Las situaciones que no se puedan reproducir en la toma se anotan como tales y se comprueban con la web o por test.

Los ejemplos de componente ("bat-x", "lcd-x-negro"), de proveedor ("Proveedor A", "ACME") y de concepto ("Cinta de embalar") son sintéticos.

## Diferencias deliberadas respecto al JavaFX

Las de la spec §10:

- **El formulario de alta es un modal encima de la vista actual** desde Stock actual ("Pedir"), Pedidos ("Nuevo pedido" / "Nuevo otro pedido") y la campana (P1). Calco del `Stage` modal; el parámetro `?componente=` que 4a dejó en "Pedir" desaparece.
- **Sin título de ventana**: el JavaFX titula la ventana "Nuevo pedido — alertas de stock" o "— solicitudes pendientes"; la web no tiene título de ventana y el interno dice siempre "Nuevo pedido", como el `lblTitulo` del JavaFX.
- **Editar un pedido recibido precarga la cantidad pedida** y el servidor responde 422 "No se puede cambiar la cantidad de un pedido recibido." si cambia (P2); el JavaFX precargaba la recibida y la escribía en la pedida.
- **`precioEur` lo calcula el servidor** en todas las escrituras con `precio / tasa` redondeado a 2 decimales (P3); el JavaFX multiplicaba. Corrige también al JavaFX 0.16.x, que sigue mandando su valor y el servidor lo ignora.
- **Alta por lotes** con clave de idempotencia y una sola transacción; las solicitudes que originan las líneas se marcan GESTIONADA en el mismo guardado (P5, D10). En el JavaFX eran N altas y N marcados sueltos, que duplicaban al reintentar.
- **Componente desactivado en "Pedir piezas"**: se omite, el formulario avisa "N solicitud(es) de componentes desactivados no se han añadido y siguen pendientes." y su solicitud no se marca (D10); el JavaFX lo omitía en silencio y lo marcaba GESTIONADA. Si la lista de componentes no se puede leer al abrir, no se avisa de omitidas (el aviso global de error ya informa del fallo).
- **"Recepción parcial" y "Recibir unidades" son diálogos propios** con el error inline, y los avisos de los formularios ("Línea i: …", "Selecciona un proveedor.", 409 y 422 al guardar) van en una línea de error dentro del formulario, que sigue abierto (P6).
- **Textos corregidos** (P7): la cabecera de "Recibir unidades" dice "Si introduces {restante}, el pedido se cerrará como recibido." (sin "o más", que el cliente bloqueaba); la etiqueta de tasa del editor dice "(1 {DIV} = {1/tasa} €)"; "Actualizado HH:mm" recarga la tabla visible (el JavaFX, siempre la de componentes); sin tasa, el Total EUR dice "—" en vez de calcular como si fuera EUR.
- **Celdas de la tabla de líneas siempre editables** (P8), en vez del paso `Label` → `TextField` del `TableView`.
- **Ordenación por cabecera bloqueada** en las dos tablas (P10).
- **La selección se mantiene en el refresco y el refresco se congela** con un menú, un diálogo o un formulario abiertos (S4, D4); el JavaFX perdía la selección y seguía recargando detrás del formulario.
- **Llegada desde "En Camino" siempre al toggle Componentes**; el JavaFX se quedaba en Otros si estaba ahí.
- **Filtros Estado y Proveedor como `MultiSelect`** sin el buscador "Buscar…" del desplegable de proveedores (aceptado en 4a) y **fechas "Desde/Hasta" tecleables** (aceptado en Historial).
- **Guards de estado y rangos en el servidor**: una transición no permitida responde 409 y una cantidad fuera de rango 422, con los textos del cliente; el JavaFX 0.16.x no los dispara porque su menú y sus validaciones ya lo impiden.
- **Editar un pedido cuyo proveedor se desactivó después** responde 422 "El proveedor no está activo." aunque no se cambie el proveedor (spec §4.2, desviación 8 del servidor); el JavaFX no lo bloqueaba, y el JavaFX 0.16.x también recibe ahora ese 422 al editar. El componente no se valida en la edición (el `PUT` no lo lleva; "El componente no está activo." es solo del alta).

Inocuas:

- **Recarga de compras, stock y campana tras cualquier acción**; el JavaFX recargaba stock solo en algunas. La campana se invalida entera (`['notificaciones']`: contador, solicitudes y alertas), no solo sus componentes.
- **Los botones de pedir de la campana cierran el panel** antes de abrir el formulario (spec §6); en el JavaFX la ventana de notificaciones quedaba abierta detrás del formulario modal.
- **"Pedir piezas" queda deshabilitado mientras relee** las pendientes; en el JavaFX la relectura bloqueaba la interfaz.
- **El congelado del refresco con el formulario de pedido abierto aplica a Stock actual y Pedidos** (las vistas que leen el store del formulario); una vista del taller desde la que se abra el formulario por la campana sigue sondeando debajo del modal, sin tocar nada que el usuario esté editando.
- **Clic derecho en una fila cancelada** muestra el menú nativo del navegador (no hay `preventDefault` sin menú propio), igual que hoy en las filas sin menú de ADMIN y TECNICO; el JavaFX no muestra nada.
- **Enter no confirma en los formularios de alta** (no había atajo en el JavaFX); en los editores sí, como el resto de diálogos del almacén (aceptado en 4a).
- **Los campos "Desde:" / "Hasta:" vacíos enseñan el formato del navegador** ("dd/mm/yyyy", según el idioma); el JavaFX los deja en blanco. Va con las fechas tecleables (`pedidos-filtro-fechas`).
- **La lista del autocompletar de componentes mide lo que el campo**; en el JavaFX el popup es más ancho. Mismas sugerencias y mismo orden (`form-nuevo-popup-componente`).
- **El CSV se descarga desde "Descargar CSV" del menú de usuario** sin el diálogo "Guardar CSV" del sistema (diferencia de plataforma, como en 4a); mismo nombre y mismas cabeceras (`pedidos-csv`).

Decididas durante la ejecución, antes de la comparación de capturas (cada una con la decisión del usuario; las de la comparación van en su sección, más abajo):

- **Un 503 es de negocio solo si trae el JSON `{message}` del servidor** (decisión D-503): el 503 del tipo de cambio al guardar ("No se pudo obtener el tipo de cambio de USD. Inténtalo de nuevo.") se pinta en la línea de error del formulario, sin banner ni aviso global; un 503 con texto plano o HTML sigue siendo "sin conexión" y enciende el banner, que solo se enciende con errores de conexión.
- **"Pedir" de Stock actual sobre un componente desactivado**: el formulario abre con la línea vacía (calco) y, si se guarda con ese componente, el servidor responde 422 "El componente no está activo." (spec §4.2). El JavaFX lo guardaba; desde 4b el JavaFX 0.16.x recibe ese 422 con el mensaje legible.
- **Editar desde el JavaFX 0.16.x un `recibido` cerrado con "Cerrar sin resto"** (recibida < pedida): el JavaFX precarga la recibida y el servidor responde 422 "No se puede cambiar la cantidad de un pedido recibido." salvo que se teclee la cantidad pedida (P2). La web no lo sufre porque precarga la pedida. Decisión del usuario: se deja así, con nota en las NOVEDADES del JavaFX y al backlog del servidor tolerar `cantidad == cantidadRecibida` como "sin cambio".

Internas, sin efecto visible: `crearClavesIdempotencia` vive en `shared/lib` (P9); el formulario de alta se abre con el store `shared/lib/formularioPedido.ts` y lo pinta un host en el shell; los helpers puros van en `.ts` propios por la regla de React Refresh.

## Calcos

- Chips de estado sin marcar al entrar; badge con el estado tal cual (`en_camino` con guion bajo); "⚠" solo en urgentes en camino o parciales (no en pendientes).
- Confirmación de cancelar con los botones "Cancelar pedido" y "Cancelar".
- Placeholder "Buscar componente…" también en Otros; el filtro Proveedor solo ofrece activos.
- En el editor, la divisa es independiente del proveedor (EUR/USD) y un proveedor inactivo deja el combo vacío; el editor de otros no tiene "Urgente" y conserva el valor.
- "Pedir piezas" con las dos listas vacías y "Pedir todas las piezas" sin alertas no hacen nada.
- "Cancelar" del formulario cierra sin preguntar aunque haya líneas.
- El autocompletar de componentes incluye los slaves de SKU compartido; el servidor los resuelve al master.
- CSV de otros sin "Urgente"; "Cantidad" es la pedida; Estado con guion bajo; coma decimal.
- El TECNICO y el ADMIN ven Pedidos sin botones "Nuevo…" ni menú; `/api/tipo-cambio` sin rol (D6, SP7).
- Columna "Div." oculta; símbolo en P.Unit. de la tabla: `€`, `$` o el código de la divisa; en los formularios de alta, `$` para USD y `€` para el resto.
- Decididos durante la ejecución (decisión del usuario, tras la revisión final):
  - **Una fila `cancelado` seleccionada se pinta navy sin la opacidad 0,45**: `actualizarEstilo` del JavaFX pinta el navy antes de mirar el estado. La spec §6 decía que la opacidad prevalecía; se corrigió.
  - **Pulsar el enlace Componente también selecciona la fila** del pedido antes de navegar, como el clic sobre la celda del JavaFX.
  - **La vuelta a Stock con `?componente=` selecciona la fila solo si queda visible** tras los filtros de vuelta; con solo "Desactivado" marcado y un componente activo, aplica los filtros y no selecciona nada.
  - **En una fila seleccionada (navy), el enlace Componente, el importe ámbar y el "!" conservan su color**, como el `Label` del JavaFX, que fija su propio color de texto; confirmado con `pedidos-fila-seleccionada` y `pedidos-fila-seleccionada-enlace`.

## Decididas durante la ejecución y la comparación de capturas

Diferencias nuevas de la comparación lado a lado (JavaFX `hotfix/0.16.3` frente a la web), con la decisión del usuario.

Corregidas en la rama:

- **C1. El 409 de una acción del menú se avisa como "Advertencia"** (título y cabecera), como el Alert WARNING de `StockController.mostrarConflicto`, y no como "Error"; el resto de errores sigue como "Error". El triángulo ámbar no se replica: los avisos de la web no llevan icono (`pedidos-conflicto`; `PedidosPage.test.tsx` "un 409 en cualquier otra transición avisa…").
- **C24. La tabla de líneas del formulario de alta tiene alto máximo con scroll propio** y "+ Añadir línea", "Cancelar" y "Confirmar pedido" siguen a la vista con muchas líneas; la línea añadida se lleva a la vista y la lista del autocompletar se pinta en un portal para no quedar recortada por el scroll (`form-nuevo-desde-alertas`; `NuevoPedidoDialog.test.tsx` "con muchas líneas: … (C24)", `CampoAutocompletar.test.tsx` "la lista va en un portal…").
- **C25. Sin autofoco con el texto seleccionado en las líneas precargadas** ("Pedir", "Pedir todas las piezas", "Pedir piezas"): teclear ya no pisa el componente precargado (`form-nuevo-desde-stock`, `form-nuevo-desde-solicitudes`; `NuevoPedidoDialog.test.tsx` "…con un componente precargado: no autoenfoca el campo Componente (C25…)").
- **C40. El Total EUR de los formularios calcula como el servidor**: el unitario en euros se redondea a 2 decimales (HALF_UP) antes de multiplicar por la cantidad, y en EUR el precio no se redondea; así el editor y la fila de la tabla dan el mismo total (`form-editar-usd`; `conversion.test.ts` "aEuros redondea el unitario … (C40)", `edicion.test.ts` "USD: precio / tasa × cantidad… (C40…)").

Anotadas como diferencias aceptadas:

- **C20. P.Unit. del formulario de alta**: el JavaFX pinta la divisa dentro del campo con dos decimales ("0,00 €", "10,00 $"); la web conserva lo tecleado y pone el símbolo fuera del campo (`form-nuevo-linea`, `form-nuevo-usd`).
- **C21. Texto no numérico en Cant. o P.Unit.**: el JavaFX descarta la edición en silencio y vuelve al valor anterior; la web lo acepta, deja el Total EUR en "—" y al confirmar avisa "Línea {i}: la cantidad debe ser mayor que 0." o "Línea {i}: el precio no puede ser negativo." (`web-form-nuevo-error-cantidad`, `web-form-nuevo-error-precio`, sin pareja).
- **C22. El aviso en línea del formulario de alta sigue visible mientras se corrige** la línea, hasta el siguiente "Confirmar pedido"; en el JavaFX era un Alert que se cerraba con "Aceptar" (`form-nuevo-popup-componente`, `form-nuevo-combo-proveedor`).
- **C23. "Pedir todas las piezas" precarga en el orden de la campana** (sin stock primero, después bajo mínimo), como pide la spec; el JavaFX usa un solo orden alfabético. Mismas líneas (`form-nuevo-desde-alertas`).
- **C26. La papelera de cada línea se ve siempre** en la web; en el JavaFX, en Otros, queda tras el scroll horizontal de la tabla (`form-otro-linea`).
- **C41. El texto de las celdas es azul pizarra (#2C3B54) en todas las tablas de la web** frente al gris oscuro del JavaFX; es transversal y se decide en el backlog, no en esta ficha (`stock-sku-prueba-filtrado`).

## Pendiente de decidir

Sin puntos: las diferencias nuevas de la comparación se decidieron (ver la sección anterior).

## Pestaña, rutas y toggle

- [x] "Pedidos" en la columna lateral de Stock abre `/stock/pedidos`; título "Pedidos" y, a la derecha, el toggle "Componentes" | "Otros" con Componentes marcado (`pedidos-vista-referencia-4b`, `pedidos-con-datos`).
- [x] "Otros" abre `/stock/pedidos/otros` con su tabla y el botón "Nuevo otro pedido" (`pedidos-otros-con-datos`).
- [x] El botón "Stock" de la barra superior vuelve a la última pestaña de Stock, también desde Pedidos. (verificado por test: `TopBar.test.tsx` "\"Stock\" lleva a la última pestaña de Stock visitada…", `PedidosPage.test.tsx` "título, toggle en Componentes, … y última pestaña de Stock")
- [ ] Los tres roles ven la pestaña; ADMIN y TECNICO sin "Nuevo…" ni menú (`pedidos-admin`, `pedidos-tecnico`). Sin marcar: faltan las capturas ADMIN y TECNICO del JavaFX, que toma el usuario. Las de la web (`web-pedidos-admin`, `web-pedidos-tecnico`) ya muestran la barra sin "Nuevo pedido" y el clic derecho sin menú, y el comportamiento del JavaFX es el del inventario.

## Tabla de componentes

- [x] Columnas Pedido (`dd/MM/yy HH:mm`, hora de Madrid), Componente (enlace), Proveedor, Cant., P.Unit., EUR y Estado; sin "Div." (`pedidos-con-datos`; `columnas.test.tsx` "siete cabeceras en orden, sin Div.…").
- [x] Cant.: "recibida/cantidad" en parcial, la recibida en recibido, la cantidad en el resto (`pedidos-cant-parcial`, cubierta por `pedidos-con-datos`; `reglas.test.ts` "columna Cant.").
- [x] P.Unit. "12,50 €" con coma decimal; `$` en USD; total EUR = unidades × importe en euros (`pedidos-usd`, cubierta por `pedidos-con-datos`; `columnas.test.tsx` "P.Unit. con el símbolo de su divisa…").
- [x] "!" ámbar en P.Unit. y EUR de un recibido con precio o total 0 (`pedidos-precio-cero`, cubierta por `pedidos-con-datos`; `reglas.test.ts` "\"!\" solo en recibido…").
- [x] Orden del servidor (fecha descendente) con los cancelados al final (`pedidos-con-datos`, `pedidos-final-tabla`; `filtros.test.ts` "ordenarCanceladosAlFinal").
- [x] Placeholder "Sin pedidos" con la barra de filtros completa (`pedidos-vacio`).
- [x] Enlace Componente azul, subrayado al pasar (`pedidos-fila-seleccionada-enlace`; `columnas.test.tsx` "Componente es un enlace…").

## Tabla de otros

- [x] Concepto como texto sin enlace en vez de Componente; mismas reglas de Cant., P.Unit., EUR y Estado (`pedidos-otros-con-datos`; `columnas.test.tsx` "Concepto en vez de Componente, como texto sin enlace…").
- [x] Placeholder "Sin otros pedidos" (`pedidos-otros-vacio`).

## Colores y badges

- [x] Barra izquierda de 8 px: pendiente ámbar, en camino urgente naranja y normal sin barra, recibido verde, parcial violeta; cancelado sin barra y atenuado al 45 % (`pedidos-con-datos`; `columnas.test.tsx` "clase de fila: barra de 8 px por estado…").
- [x] Badges: pendiente, en camino urgente y normal, recibido, parcial y cancelado con sus colores; radio 12, 11 px negrita; "⚠" a la derecha en urgentes en camino o parciales (`pedidos-con-datos`; `reglas.test.ts` "\"⚠\" solo si urgente y en camino o parcial…").
- [x] Fila seleccionada navy con textos claros; el enlace Componente, el importe ámbar y el "!" conservan su color (calco, ver arriba) (`pedidos-fila-seleccionada`, `pedidos-fila-seleccionada-enlace`).
- [x] Un cancelado seleccionado, navy sin la opacidad (calco, ver arriba) (`pedidos-fila-cancelada-seleccionada`; `columnas.test.tsx` "cancelado seleccionado…").

## Filtros

- [x] "Estado" con "pendiente", "en camino", "parcial", "recibido" y "cancelado", ninguno marcado al entrar; el botón dice el único marcado o "N estados" (`pedidos-filtro-estado-abierto`, `pedidos-filtro-estado-dos`).
- [x] "Proveedor" con solo los activos; "N proveedores" con varios (`pedidos-filtro-proveedor-abierto`; `PedidosPage.test.tsx` "filtros: … Proveedor solo con activos…").
- [x] Buscador "Buscar componente…" en los dos toggles: "contiene", sin mayúsculas, sobre el componente o el concepto (`pedidos-vacio`, `pedidos-otros-vacio`; `filtros.test.ts` "buscador…").
- [x] "Desde:" / "Hasta:" inclusivos sobre la fecha del pedido en hora de Madrid (`pedidos-filtro-fechas` no comparable: el calendario del navegador no sale en la captura; `web-pedidos-filtro-fechas-aplicado`; `filtros.test.ts` "Desde/Hasta: día de Madrid de la fecha de pedido, inclusivos").
- [x] Los cuatro filtros se combinan con Y y se conservan al cambiar de toggle y al volver desde Reparaciones (`filtros.test.ts` "los cuatro filtros se combinan con Y", `PedidosPage.test.tsx` "el toggle \"Otros\" … conserva los filtros…"; viven en el store de la vista, como los de Stock).
- [x] "Limpiar filtros" desmarca estados y vacía proveedor, buscador y fechas, sin tocar el toggle ni la selección. (verificado por test: `PedidosPage.test.tsx` "filtros: … y \"Limpiar filtros\"")

## Pie y refresco

- [x] "Actualizado HH:mm" a la derecha, subrayado al pasar, recarga la tabla visible (diferencia, ver arriba) (`pedidos-actualizado-hover`; `PedidosPage.test.tsx` "\"Actualizado HH:mm\" recarga la tabla visible (Otros)…").
- [x] Refresco cada 60 s (5 s con el banner), solo de la tabla visible, con la selección mantenida (`pedidos-tras-conflicto`; `PedidosPage.test.tsx` "la selección sobrevive al refresco de 60 s").

## Llegada desde Stock y vuelta a Stock

- [x] "En Camino" de Stock actual abre Pedidos con "pendiente", "en camino" y "parcial" marcados, el componente en el buscador y la primera fila seleccionada, sin tocar proveedor ni fechas (`pedidos-desde-en-camino`; `PedidosPage.test.tsx` "llegada desde \"En Camino\" de Stock…").
- [x] El enlace Componente selecciona la fila del pedido y vuelve a Stock actual con OK, Bajo y Sin stock desmarcados (Desactivado se conserva), el buscador vacío y la fila del componente seleccionada con scroll si queda visible (calco, ver arriba) (`stock-desde-pedidos`; `StockPage.test.tsx` "?componente=<id> al llegar desde Pedidos…").
- [x] "Pedir" de Stock actual abre "Nuevo pedido" encima de Stock con la línea del componente (`form-nuevo-desde-stock`; foco corregido, C25).

## Menú contextual (solo SUPERTECNICO)

- [x] pendiente: "Confirmar pedido" · separador · "Editar" · "Borrar" (`pedidos-menu-pendiente`, `pedidos-otros-menu-pendiente`, `pedidos-menu-pendiente-referencia-4b`).
- [x] en camino: "Recepción parcial" · "Confirmar recibido" · separador · "Editar" · "Cancelar pedido" (`pedidos-menu-en-camino`, `pedidos-menu-en-camino-referencia-4b`).
- [x] parcial: "Recibir resto" · "Cerrar sin resto" (`pedidos-menu-parcial`).
- [x] recibido: "Revertir a En camino" · separador · "Editar" (`pedidos-menu-recibido`).
- [x] cancelado: sin menú propio (el del navegador, diferencia inocua, ver arriba) (`pedidos-menu-cancelado`; `MenuPedido.test.tsx` "cancelado: sin entradas").

## Acciones sin diálogo

- [x] "Confirmar pedido", "Confirmar recibido" y "Cerrar sin resto" escriben al pulsar y recargan. (verificado por test: `PedidosPage.test.tsx` "\"Confirmar pedido\" escribe al pulsar, sin diálogo, y recarga", "\"Confirmar recibido\" y \"Cerrar sin resto\" también escriben al pulsar")

## Recepción parcial y Recibir unidades

- [x] "Recepción parcial": "Pedido #{id} — {componente} ({cantidad} pedidas)", "Cantidad recibida ahora:", campo vacío, "Confirmar" (`pedidos-dialogo-parcial`).
- [x] Fuera de rango: "La cantidad debe ser mayor que 0 y menor que {cantidad}." inline (`pedidos-error-parcial-rango`).
- [x] "Recibir unidades": "Pedido #{id} — {componente} (recibidas: {recibida}/{cantidad})" y "Si introduces {restante}, el pedido se cerrará como recibido.", "Cantidad que llega ahora:" precargada con el restante (diferencia de texto, ver arriba) (`pedidos-dialogo-resto`).
- [x] Exceso: "No puedes recibir más de lo pedido. Faltan {restante} unidad(es)." inline (`pedidos-error-resto-exceso`).

## Confirmaciones

- [x] "Cancelar pedido" / "¿Cancelar el pedido #{id} de {componente}?" con "Cancelar pedido" y "Cancelar" (`pedidos-confirm-cancelar`, `pedidos-cancelar-confirm-referencia-4b`).
- [x] "Borrar pedido" / "¿Borrar el pedido pendiente #{id} de {componente}?" con "Borrar" (`pedidos-confirm-borrar`).
- [x] "Revertir a En camino" de componentes con las tres líneas y "Se descontarán {n} unidad(es) del stock." (`pedidos-confirm-revertir`).
- [x] "Revertir a En camino" de otros con una sola línea (`pedidos-otros-confirm-revertir`).

## Errores de las acciones

- [x] 409 en una transición: "Este pedido fue modificado por otro usuario. Los datos se han recargado." y recarga, avisado como "Advertencia" (corregido, C1) (`pedidos-conflicto`, `pedidos-tras-conflicto`; `PedidosPage.test.tsx` "un 409 en cualquier otra transición avisa…").
- [x] 409 al revertir: el mensaje del servidor (stock insuficiente) y recarga (`pedidos-error-revertir-stock` no reproducible en la toma sin bajar el stock; verificado por test: `PedidosPage.test.tsx` "\"Revertir a En camino\" de componentes: tres líneas; un 409 enseña el mensaje del servidor y recarga").

## Nuevo pedido

- [x] Modal de 700 px, título "Nuevo pedido", placeholder "Añade al menos una línea", "+ Añadir línea", "Cancelar" y "Confirmar pedido" (`form-nuevo-vacio`).
- [x] Línea: Componente (campo navy, "Escribe componente..."), Proveedor (combo navy), Cant. 1, P.Unit. "0,00" con `€`/`$`, Urg., Total EUR y papelera (diferencia de celdas editables, ver arriba; formato de P.Unit., C20) (`form-nuevo-linea`).
- [x] Autocompletar "contiene", hasta 6 filas visibles; Enter elige la primera (`form-nuevo-popup-componente`; `NuevoPedidoDialog.test.tsx` "autocompletar: … Enter elige el primero", `CampoAutocompletar.test.tsx` "muestra como mucho 6 filas a la vez…").
- [x] Cant. y P.Unit. editables (`form-nuevo-editando-cantidad`).
- [x] Proveedor en USD: `$` en P.Unit. y Total EUR convertido con `precio / tasa` (`form-nuevo-usd`; `NuevoPedidoDialog.test.tsx` "proveedor en USD…").
- [x] "+ Añadir línea" añade, selecciona y desplaza hasta la línea nueva (`form-nuevo-varias-lineas`; `NuevoPedidoDialog.test.tsx` "\"Pedir\" (un componente): … \"+ Añadir línea\" lo repite y selecciona la nueva").
- [x] Avisos inline: "Añade al menos una línea.", "Línea {i}: selecciona un componente.", "Línea {i}: selecciona un proveedor.", "Línea {i}: la cantidad debe ser mayor que 0.", "Línea {i}: el precio no puede ser negativo." (`form-nuevo-error-sin-lineas`, `form-nuevo-error-componente`, `form-nuevo-error-proveedor`; los de cantidad y precio solo en la web, C21; `lineas.test.ts` "validarLineasCompra").
- [x] Guardar cierra y recarga pedidos, stock y campana; "Cancelar" cierra sin preguntar. (verificado por test: `api.test.tsx` "useRecargaPedidos", `NuevoPedidoDialog.test.tsx` "\"Pedir piezas\" → un lote con clave… cierra", "\"Cancelar\" cierra sin preguntar aunque haya líneas…")
- [x] 503 del tipo de cambio al guardar: el mensaje del servidor en la línea de error, formulario abierto y sin banner (diferencia D-503, ver arriba). (verificado por test: `NuevoPedidoDialog.test.tsx` "503 del tipo de cambio al guardar…")

## Precargas del Nuevo pedido

- [x] Desde "Pedir" de Stock actual o de una alerta: una línea con el componente, cantidad 1, sin proveedor; vacía si está desactivado (`form-nuevo-desde-stock`, `form-nuevo-desde-alerta-pedir` solo en la web; `stock-pedir-desde-desactivado` sin captura, verificado por test: `NuevoPedidoDialog.test.tsx` "componente desactivado o desconocido: la línea va vacía (calco)…").
- [x] Desde "Pedir todas las piezas": una línea por alerta, cantidad 1, en el orden de la campana (diferencia aceptada, C23) (`form-nuevo-desde-alertas`; `PanelNotificaciones.test.tsx` "\"Pedir todas las piezas\" cierra el panel … en el orden de la campana").
- [x] Desde "Pedir piezas": una línea por componente con cantidad = número de solicitudes, urgentes primero (`form-nuevo-desde-solicitudes`; `NuevoPedidoDialog.test.tsx` "\"Pedir piezas\": agrupa por componente con urgentes primero…").

## Nuevo otro pedido

- [x] Título "Nuevo otro pedido", columna Concepto con "Escribe concepto..." (`form-otro-vacio`, `form-otro-linea`).
- [x] "Línea {i}: el concepto no puede estar vacío." antes de proveedor, cantidad y precio (`form-otro-error-concepto`; `NuevoOtroPedidoDialog.test.tsx` "validación en orden: concepto en blanco → proveedor → cantidad → precio").

## Editar pedido

- [x] "Editar pedido #{id}" (520 px): "Componente:" de solo lectura, "Proveedor:", "Cantidad:" ("Ej. 10"), "Urgente:", "Precio unidad:" con EUR/USD, "Total EUR:", "Cancelar" y "Guardar" (`form-editar-pendiente`; `EditarPedidoDialog.test.tsx` "precarga: título, etiquetas en orden…").
- [x] Divisa distinta de EUR: "Obteniendo tasa…" y después el total con "  (1 USD = x,xxxx €)" (diferencia de sentido, ver arriba; total como el servidor, C40) (`form-editar-usd`; "Obteniendo tasa…" no salió en `web-form-editar-obteniendo-tasa`, verificado por test: `EditarPedidoDialog.test.tsx` "mientras llega la tasa: \"Obteniendo tasa…\"").
- [x] Recibido: la cantidad precargada es la pedida (diferencia, ver arriba) (`form-editar-recibido`).
- [x] Proveedor inactivo: combo vacío (calco) (`form-editar-proveedor-inactivo`).
- [x] Avisos inline "Selecciona un proveedor.", "Cantidad no válida (debe ser > 0).", "Precio no válido." (`form-editar-error-proveedor`, `form-editar-error-cantidad`, `form-editar-error-precio`).
- [x] 409: "El pedido fue modificado por otro usuario. Cierra y recarga los datos." inline, formulario abierto (`form-editar-conflicto`).

## Editar otro pedido

- [x] "Concepto:" arriba ("Descripción del pedido"), sin "Urgente" (`form-editar-otro`).
- [x] "El concepto no puede estar vacío." antes que el resto (`form-editar-otro-error-concepto`).

## Campana

- [x] "Pedir" de una alerta, "Pedir todas las piezas" y "Pedir piezas" cierran el panel y abren "Nuevo pedido" con su precarga (`form-nuevo-desde-alertas`, `form-nuevo-desde-solicitudes`; `PanelNotificaciones.test.tsx` "botones de pedir").
- [x] "→ Ir a pedidos" y "Ver Stock Completo" siguen como en 4a (`campana-alertas-4b`, `campana-solicitudes-4b`).

## CSV

- [x] Componentes: `pedidos_<fecha>_<hora>.csv` con `Fecha pedido;Componente;Cantidad;Urgente;Proveedor;Precio unidad;Divisa;Total EUR;Estado`, "Sí"/"No", coma decimal, filas filtradas en el orden de pantalla (`pedidos-csv`; `PedidosPage.test.tsx` "Descargar CSV en Componentes…").
- [x] Otros: `pedidos_otros_<fecha>_<hora>.csv` sin "Urgente" (`web-pedidos-otros-csv`, sin pareja; `PedidosPage.test.tsx` "Descargar CSV en Otros exporta pedidos_otros sin Urgente").

## Comprobado por tests

Lo que no se ve en una captura o no se puede provocar en la toma:

- [x] Máquina de estados en el servidor: cada transición permitida escribe y cada prohibida responde 409 sin tocar stock, en componentes y en otros (`CompraComponenteDAOTransicionesTest`, `CompraOtroDAOTransicionesTest`).
- [x] Rangos de parcial y resto, validación de alta y edición y 422 de cantidad en un recibido, sin escribir ni registrar log; en `en_camino` la cantidad sí cambia; precio infinito 422 (`CompraControllerTest` / `CompraOtroControllerTest` (validaciones de `ValidacionPedidos`), `editarEnCaminoConCantidadDistintaEscribe`, `altaConPrecioInfinitoEs422`).
- [x] 422 "El proveedor no está activo." en el alta y en el `PUT` de un pedido cuyo proveedor se desactivó; 422 "El componente no está activo." solo en el alta (`CompraControllerTest`, `CompraOtroControllerTest`, `CompraLoteControllerTest`).
- [x] `precioEur` = `precio / tasa` con 2 decimales; EUR sin llamada; 503 con mensaje si falla el tipo de cambio; una tasa 0 o no numérica es 503 y no se guarda en la caché del día (`ConversionEurTest`, `TipoCambioDAOTest` `tasaCeroEs503SinCachear`, `tasaNoNumericaEs503SinCachear`).
- [x] Lotes: 400 sin clave, 422 por línea, atómicos, reintento con la misma clave sin volver a insertar, solicitudes marcadas en la transacción, solicitud sin línea 422 (`CompraLoteControllerTest`, `CompraLoteControllerTest` (casos de otros)).
- [x] Contrato con las dos rutas nuevas, sus esquemas y los nullables (`OpenApiContractTest`).
- [x] 503 con `{message}` de negocio sin banner; 503 sin JSON sigue siendo sin conexión (`client.test.ts` "un 503 con {message} de nuestro backend es de negocio y no enciende el banner", `NuevoPedidoDialog.test.tsx` "503 del tipo de cambio al guardar: el mensaje del servidor inline, sin aviso global y con el formulario abierto").
- [x] Reintento del formulario con la misma clave tras un fallo (`NuevoPedidoDialog.test.tsx`, `NuevoOtroPedidoDialog.test.tsx`).
- [x] Congelación del refresco con menú, diálogo o formulario abiertos (`PedidosPage.test.tsx`, `StockPage.test.tsx` "con el formulario de pedido abierto el sondeo se congela; al cerrarlo se reanuda").
- [x] Selección tras el refresco (`PedidosPage.test.tsx`).
- [x] 409 dentro de "Recepción parcial": cierra el diálogo, avisa y recarga (`PedidosPage.test.tsx` "un 409 dentro de \"Recepción parcial\" cierra el diálogo, avisa \"modificado por otro usuario\" y recarga").
- [x] Componentes desactivados omitidos y avisados en "Pedir piezas"; sin aviso si la lista de componentes no se pudo leer (`lineas.test.ts`, `NuevoPedidoDialog.test.tsx` "si falla la carga de componentes (500), no hay aviso de omitidas y \"Cancelar\" cierra el diálogo").
- [x] "Pedir piezas" sin pendientes y "Pedir todas las piezas" sin alertas no hacen nada (`PanelNotificaciones.test.tsx`).
- [x] El enlace Componente selecciona la fila; un cancelado seleccionado anula la opacidad (`columnas.test.tsx` "clic en el enlace Componente también selecciona la fila (calco: no lleva stopPropagation)", "cancelado seleccionado: la fila lleva la clase que anula la opacidad con data-state=\"selected\"").
- [x] La vuelta a Stock no selecciona un componente que los filtros dejan oculto (`StockPage.test.tsx` "?componente= de un componente activo con solo \"Desactivado\" marcado: aplica los filtros y limpia la URL, pero no selecciona ni pide desplazamiento (T19 #12)").
