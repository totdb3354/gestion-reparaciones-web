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

Decididas durante la ejecución y la comparación de capturas: se añaden aquí, cada una con la decisión del usuario.

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
  - **En una fila seleccionada (navy), el enlace Componente, el importe ámbar y el "!" conservan su color**, como el `Label` del JavaFX, que fija su propio color de texto; a confirmar con `pedidos-fila-seleccionada`.

## Pendiente de decidir

Sin puntos al escribir la ficha.

## Pestaña, rutas y toggle

- [ ] "Pedidos" en la columna lateral de Stock abre `/stock/pedidos`; título "Pedidos" y, a la derecha, el toggle "Componentes" | "Otros" con Componentes marcado (`pedidos-vista-referencia-4b`, `pedidos-con-datos`).
- [ ] "Otros" abre `/stock/pedidos/otros` con su tabla y el botón "Nuevo otro pedido" (`pedidos-otros-con-datos`).
- [ ] El botón "Stock" de la barra superior vuelve a la última pestaña de Stock, también desde Pedidos.
- [ ] Los tres roles ven la pestaña; ADMIN y TECNICO sin "Nuevo…" ni menú (`pedidos-admin`, `pedidos-tecnico`).

## Tabla de componentes

- [ ] Columnas Pedido (`dd/MM/yy HH:mm`, hora de Madrid), Componente (enlace), Proveedor, Cant., P.Unit., EUR y Estado; sin "Div." (`pedidos-con-datos`).
- [ ] Cant.: "recibida/cantidad" en parcial, la recibida en recibido, la cantidad en el resto (`pedidos-cant-parcial`).
- [ ] P.Unit. "12,50 €" con coma decimal; `$` en USD; total EUR = unidades × importe en euros (`pedidos-usd`).
- [ ] "!" ámbar en P.Unit. y EUR de un recibido con precio o total 0 (`pedidos-precio-cero`).
- [ ] Orden del servidor (fecha descendente) con los cancelados al final (`pedidos-con-datos`).
- [ ] Placeholder "Sin pedidos" con la barra de filtros completa (`pedidos-vacio`).
- [ ] Enlace Componente azul, subrayado al pasar.

## Tabla de otros

- [ ] Concepto como texto sin enlace en vez de Componente; mismas reglas de Cant., P.Unit., EUR y Estado (`pedidos-otros-con-datos`).
- [ ] Placeholder "Sin otros pedidos" (`pedidos-otros-vacio`).

## Colores y badges

- [ ] Barra izquierda de 8 px: pendiente ámbar, en camino urgente naranja y normal sin barra, recibido verde, parcial violeta; cancelado sin barra y atenuado al 45 % (`pedidos-con-datos`).
- [ ] Badges: pendiente, en camino urgente y normal, recibido, parcial y cancelado con sus colores; radio 12, 11 px negrita; "⚠" a la derecha en urgentes en camino o parciales (`pedidos-con-datos`).
- [ ] Fila seleccionada navy con textos claros; el enlace Componente, el importe ámbar y el "!" conservan su color (calco, ver arriba) (`pedidos-fila-seleccionada`, `pedidos-fila-seleccionada-enlace`).
- [ ] Un cancelado seleccionado, navy sin la opacidad (calco, ver arriba) (`pedidos-fila-cancelada-seleccionada`).

## Filtros

- [ ] "Estado" con "pendiente", "en camino", "parcial", "recibido" y "cancelado", ninguno marcado al entrar; el botón dice el único marcado o "N estados" (`pedidos-filtro-estado-abierto`).
- [ ] "Proveedor" con solo los activos; "N proveedores" con varios (`pedidos-filtro-proveedor-abierto`).
- [ ] Buscador "Buscar componente…" en los dos toggles: "contiene", sin mayúsculas, sobre el componente o el concepto.
- [ ] "Desde:" / "Hasta:" inclusivos sobre la fecha del pedido en hora de Madrid (`pedidos-filtro-fechas`).
- [ ] Los cuatro filtros se combinan con Y y se conservan al cambiar de toggle y al volver desde Reparaciones.
- [ ] "Limpiar filtros" desmarca estados y vacía proveedor, buscador y fechas, sin tocar el toggle ni la selección.

## Pie y refresco

- [ ] "Actualizado HH:mm" a la derecha, subrayado al pasar, recarga la tabla visible (diferencia, ver arriba) (`pedidos-actualizado-hover`).
- [ ] Refresco cada 60 s (5 s con el banner), solo de la tabla visible, con la selección mantenida.

## Llegada desde Stock y vuelta a Stock

- [ ] "En Camino" de Stock actual abre Pedidos con "pendiente", "en camino" y "parcial" marcados, el componente en el buscador y la primera fila seleccionada, sin tocar proveedor ni fechas (`pedidos-desde-en-camino`).
- [ ] El enlace Componente selecciona la fila del pedido y vuelve a Stock actual con OK, Bajo y Sin stock desmarcados (Desactivado se conserva), el buscador vacío y la fila del componente seleccionada con scroll si queda visible (calco, ver arriba) (`stock-desde-pedidos`).
- [ ] "Pedir" de Stock actual abre "Nuevo pedido" encima de Stock con la línea del componente (`form-nuevo-desde-stock`).

## Menú contextual (solo SUPERTECNICO)

- [ ] pendiente: "Confirmar pedido" · separador · "Editar" · "Borrar" (`pedidos-menu-pendiente`, `pedidos-menu-pendiente-referencia-4b`).
- [ ] en camino: "Recepción parcial" · "Confirmar recibido" · separador · "Editar" · "Cancelar pedido" (`pedidos-menu-en-camino`, `pedidos-menu-en-camino-referencia-4b`).
- [ ] parcial: "Recibir resto" · "Cerrar sin resto" (`pedidos-menu-parcial`).
- [ ] recibido: "Revertir a En camino" · separador · "Editar" (`pedidos-menu-recibido`).
- [ ] cancelado: sin menú propio (el del navegador, diferencia inocua, ver arriba) (`pedidos-menu-cancelado`).

## Acciones sin diálogo

- [ ] "Confirmar pedido", "Confirmar recibido" y "Cerrar sin resto" escriben al pulsar y recargan.

## Recepción parcial y Recibir unidades

- [ ] "Recepción parcial": "Pedido #{id} — {componente} ({cantidad} pedidas)", "Cantidad recibida ahora:", campo vacío, "Confirmar" (`pedidos-dialogo-parcial`).
- [ ] Fuera de rango: "La cantidad debe ser mayor que 0 y menor que {cantidad}." inline (`pedidos-error-parcial-rango`).
- [ ] "Recibir unidades": "Pedido #{id} — {componente} (recibidas: {recibida}/{cantidad})" y "Si introduces {restante}, el pedido se cerrará como recibido.", "Cantidad que llega ahora:" precargada con el restante (diferencia de texto, ver arriba) (`pedidos-dialogo-resto`).
- [ ] Exceso: "No puedes recibir más de lo pedido. Faltan {restante} unidad(es)." inline (`pedidos-error-resto-exceso`).

## Confirmaciones

- [ ] "Cancelar pedido" / "¿Cancelar el pedido #{id} de {componente}?" con "Cancelar pedido" y "Cancelar" (`pedidos-confirm-cancelar`, `pedidos-cancelar-confirm-referencia-4b`).
- [ ] "Borrar pedido" / "¿Borrar el pedido pendiente #{id} de {componente}?" con "Borrar" (`pedidos-confirm-borrar`).
- [ ] "Revertir a En camino" de componentes con las tres líneas y "Se descontarán {n} unidad(es) del stock." (`pedidos-confirm-revertir`).
- [ ] "Revertir a En camino" de otros con una sola línea (`pedidos-otros-confirm-revertir`).

## Errores de las acciones

- [ ] 409 en una transición: "Este pedido fue modificado por otro usuario. Los datos se han recargado." y recarga (`pedidos-conflicto`).
- [ ] 409 al revertir: el mensaje del servidor (stock insuficiente) y recarga (`pedidos-error-revertir-stock`).

## Nuevo pedido

- [ ] Modal de 700 px, título "Nuevo pedido", placeholder "Añade al menos una línea", "+ Añadir línea", "Cancelar" y "Confirmar pedido" (`form-nuevo-vacio`).
- [ ] Línea: Componente (campo navy, "Escribe componente..."), Proveedor (combo navy), Cant. 1, P.Unit. "0,00" con `€`/`$`, Urg., Total EUR y papelera (diferencia de celdas editables, ver arriba) (`form-nuevo-linea`).
- [ ] Autocompletar "contiene", hasta 6 filas visibles; Enter elige la primera (`form-nuevo-popup-componente`).
- [ ] Cant. y P.Unit. editables (`form-nuevo-editando-cantidad`).
- [ ] Proveedor en USD: `$` en P.Unit. y Total EUR convertido con `precio / tasa` (`form-nuevo-usd`).
- [ ] "+ Añadir línea" añade, selecciona y desplaza hasta la línea nueva (`form-nuevo-varias-lineas`).
- [ ] Avisos inline: "Añade al menos una línea.", "Línea {i}: selecciona un componente.", "Línea {i}: selecciona un proveedor.", "Línea {i}: la cantidad debe ser mayor que 0.", "Línea {i}: el precio no puede ser negativo." (`form-nuevo-error-sin-lineas`, `form-nuevo-error-sin-componente`, `form-nuevo-error-sin-proveedor`, `form-nuevo-error-cantidad`, `form-nuevo-error-precio`).
- [ ] Guardar cierra y recarga pedidos, stock y campana; "Cancelar" cierra sin preguntar.
- [ ] 503 del tipo de cambio al guardar: el mensaje del servidor en la línea de error, formulario abierto y sin banner (diferencia D-503, ver arriba).

## Precargas del Nuevo pedido

- [ ] Desde "Pedir" de Stock actual o de una alerta: una línea con el componente, cantidad 1, sin proveedor; vacía si está desactivado (`form-nuevo-desde-stock`, `stock-pedir-desde-desactivado`).
- [ ] Desde "Pedir todas las piezas": una línea por alerta, cantidad 1, en el orden de la campana (`form-nuevo-desde-alertas`).
- [ ] Desde "Pedir piezas": una línea por componente con cantidad = número de solicitudes, urgentes primero (`form-nuevo-desde-solicitudes`).

## Nuevo otro pedido

- [ ] Título "Nuevo otro pedido", columna Concepto con "Escribe concepto..." (`form-otro-vacio`, `form-otro-linea`).
- [ ] "Línea {i}: el concepto no puede estar vacío." antes de proveedor, cantidad y precio (`form-otro-error-concepto`).

## Editar pedido

- [ ] "Editar pedido #{id}" (520 px): "Componente:" de solo lectura, "Proveedor:", "Cantidad:" ("Ej. 10"), "Urgente:", "Precio unidad:" con EUR/USD, "Total EUR:", "Cancelar" y "Guardar" (`form-editar-pendiente`).
- [ ] Divisa distinta de EUR: "Obteniendo tasa…" y después el total con "  (1 USD = x,xxxx €)" (diferencia de sentido, ver arriba) (`form-editar-usd`).
- [ ] Recibido: la cantidad precargada es la pedida (diferencia, ver arriba) (`form-editar-recibido`).
- [ ] Proveedor inactivo: combo vacío (calco) (`form-editar-proveedor-inactivo`).
- [ ] Avisos inline "Selecciona un proveedor.", "Cantidad no válida (debe ser > 0).", "Precio no válido." (`form-editar-error-proveedor`, `form-editar-error-cantidad`, `form-editar-error-precio`).
- [ ] 409: "El pedido fue modificado por otro usuario. Cierra y recarga los datos." inline, formulario abierto (`form-editar-conflicto`).

## Editar otro pedido

- [ ] "Concepto:" arriba ("Descripción del pedido"), sin "Urgente" (`form-editar-otro`).
- [ ] "El concepto no puede estar vacío." antes que el resto (`form-editar-otro-error-concepto`).

## Campana

- [ ] "Pedir" de una alerta, "Pedir todas las piezas" y "Pedir piezas" cierran el panel y abren "Nuevo pedido" con su precarga (`form-nuevo-desde-alertas`, `form-nuevo-desde-solicitudes`).
- [ ] "→ Ir a pedidos" y "Ver Stock Completo" siguen como en 4a.

## CSV

- [ ] Componentes: `pedidos_<fecha>_<hora>.csv` con `Fecha pedido;Componente;Cantidad;Urgente;Proveedor;Precio unidad;Divisa;Total EUR;Estado`, "Sí"/"No", coma decimal, filas filtradas en el orden de pantalla (`pedidos-csv`).
- [ ] Otros: `pedidos_otros_<fecha>_<hora>.csv` sin "Urgente".

## Comprobado por tests

Lo que no se ve en una captura o no se puede provocar en la toma:

- [ ] Máquina de estados en el servidor: cada transición permitida escribe y cada prohibida responde 409 sin tocar stock, en componentes y en otros (`CompraComponenteDAOTransicionesTest`, `CompraOtroDAOTransicionesTest`).
- [ ] Rangos de parcial y resto, validación de alta y edición y 422 de cantidad en un recibido, sin escribir ni registrar log; en `en_camino` la cantidad sí cambia; precio infinito 422 (`CompraControllerTest` / `CompraOtroControllerTest` (validaciones de `ValidacionPedidos`), `editarEnCaminoConCantidadDistintaEscribe`, `altaConPrecioInfinitoEs422`).
- [ ] 422 "El proveedor no está activo." en el alta y en el `PUT` de un pedido cuyo proveedor se desactivó; 422 "El componente no está activo." solo en el alta (`CompraControllerTest`, `CompraOtroControllerTest`, `CompraLoteControllerTest`).
- [ ] `precioEur` = `precio / tasa` con 2 decimales; EUR sin llamada; 503 con mensaje si falla el tipo de cambio; una tasa 0 o no numérica es 503 y no se guarda en la caché del día (`ConversionEurTest`, `TipoCambioDAOTest` `tasaCeroEs503SinCachear`, `tasaNoNumericaEs503SinCachear`).
- [ ] Lotes: 400 sin clave, 422 por línea, atómicos, reintento con la misma clave sin volver a insertar, solicitudes marcadas en la transacción, solicitud sin línea 422 (`CompraLoteControllerTest`, `CompraLoteControllerTest` (casos de otros)).
- [ ] Contrato con las dos rutas nuevas, sus esquemas y los nullables (`OpenApiContractTest`).
- [ ] 503 con `{message}` de negocio sin banner; 503 sin JSON sigue siendo sin conexión (`client.test.ts` "un 503 con {message} de nuestro backend es de negocio y no enciende el banner", `NuevoPedidoDialog.test.tsx` "503 del tipo de cambio al guardar: el mensaje del servidor inline, sin aviso global y con el formulario abierto").
- [ ] Reintento del formulario con la misma clave tras un fallo (`NuevoPedidoDialog.test.tsx`, `NuevoOtroPedidoDialog.test.tsx`).
- [ ] Congelación del refresco con menú, diálogo o formulario abiertos (`PedidosPage.test.tsx`, `StockPage.test.tsx` "con el formulario de pedido abierto el sondeo se congela; al cerrarlo se reanuda").
- [ ] Selección tras el refresco (`PedidosPage.test.tsx`).
- [ ] 409 dentro de "Recepción parcial": cierra el diálogo, avisa y recarga (`PedidosPage.test.tsx` "un 409 dentro de \"Recepción parcial\" cierra el diálogo, avisa \"modificado por otro usuario\" y recarga").
- [ ] Componentes desactivados omitidos y avisados en "Pedir piezas"; sin aviso si la lista de componentes no se pudo leer (`lineas.test.ts`, `NuevoPedidoDialog.test.tsx` "si falla la carga de componentes (500), no hay aviso de omitidas y \"Cancelar\" cierra el diálogo").
- [ ] "Pedir piezas" sin pendientes y "Pedir todas las piezas" sin alertas no hacen nada (`PanelNotificaciones.test.tsx`).
- [ ] El enlace Componente selecciona la fila; un cancelado seleccionado anula la opacidad (`columnas.test.tsx` "clic en el enlace Componente también selecciona la fila (calco: no lleva stopPropagation)", "cancelado seleccionado: la fila lleva la clase que anula la opacidad con data-state=\"selected\"").
- [ ] La vuelta a Stock no selecciona un componente que los filtros dejan oculto (`StockPage.test.tsx` "?componente= de un componente activo con solo \"Desactivado\" marcado: aplica los filtros y limpia la URL, pero no selecciona ni pide desplazamiento (T19 #12)").
