# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.9.22] - (pendiente) — Lo que no cuadra con NSYS: cuatro tarjetas, «Hecho» y plantillas para subir a NSYS

- **«Por pasar a NSYS» con cuatro tarjetas** (supertécnicos y administrador): **Cambio de color** (con la plantilla de NSYS para borrar y volver a subir el móvil, con el grado que tiene hoy en NSYS y su mismo precio de compra), **Cambio de grado** («Copiar lista»: en NSYS se cambia uno a uno, después del color), **No está en NSYS** (móviles que han pasado por el taller y NSYS no conoce, con su plantilla de altas: lo que falta va en rojo) y **Revisar a mano** (lo que el ERP no supo calcular al guardar una reparación: «✓ Revisado» si ya estaba bien, o «Corregir…»). Cada tarjeta dice cuántos hay y cuántos hechos; la pestaña cuenta lo pendiente.
- **«Hecho»** por fila y **«✓ Marcar todo»**: la fila se queda en gris con quién y cuándo, y las plantillas y «Copiar lista» ya no la llevan. Se va sola cuando la importación ve NSYS al día; si NSYS sigue igual, vuelve a salir con «Marcado «Hecho» a las …, pero NSYS sigue igual».
- **«compruébalo»**: si NSYS nunca ha escrito un color, el producto sale del nombre del maestro tal cual, avisado en la ficha, en «Corregir…» y en la lista (en amarillo en la plantilla).
- **Rastro:** «Revisado por …» cuando alguien da un aviso por bueno.
- **«Poner en NSYS» y la deducción del color del chasis** saben cómo se llama cada color en NSYS aunque ningún móvil de ese modelo y capacidad lo tenga (pieza 1): el nombre en inglés sale del «Product Name» del maestro (el Excel no se toca) y se escribe con la grafía que ya usa NSYS en otra capacidad u otro modelo.
- **Coste de NSYS** (pieza 1): al importar se guarda el «Total cost» de cada móvil; solo lo usa la plantilla de color.
- Servidor con dos migraciones aditivas: `migracion-nombres-y-coste-nsys.sql` (pieza 1) y `migracion-plantillas-nsys.sql` (tabla `Taller_hecho` y «Revisado» en `Taller_aviso`).

## [0.9.21.1] - 2026-10-23 — La tapa trasera no cambia el grado y el chasis sobre «n/a» pone la A

- **Reparaciones con tapa trasera:** la tapa trasera sola cambia el color del móvil, pero **ya no le pone grado A** ni avisa de un grado que no se puede calcular: el grado lo cambian el chasis (letra A) y la batería («100»). En la 0.9.21, una tapa sola pasaba el móvil a A.
- **Chasis sobre un móvil sin grado** («n/a» o vacío en NSYS): el chasis lo deja en **A** y, con batería nueva en el mismo guardado, en **A100** (en la 0.9.21 no cambiaba y avisaba). Dentro de un guardado, el chasis se aplica antes que la batería sea cual sea el orden de las filas, así que «n/a» + batería nueva + chasis queda en A100 sin aviso. La batería sola sobre «n/a» sigue sin cambiarlo y con el aviso; los grados ID, F, A+, G y P tampoco cambian con ninguna pieza y siguen avisando.
- Solo servidor: la web sigue en la 0.9.21. Sin migración.

## [0.9.21] - 2026-10-22 — Corrección en NSYS, SKU del taller y descripción completa

- **Correcciones de NSYS** (supertécnico y administrador): cuando NSYS corrige un móvil dándolo de baja y dándolo de alta en otro lote (por ejemplo, tras cambiarle el chasis de color en el taller), el ERP lo trata como el mismo móvil.
  - En el rastro, una sola línea «Corrección en NSYS (lote … → …)» con el móvil antes y después, en vez de «Estado en NSYS: Removed» y «Vuelve a entrar».
  - En la ficha del IMEI y en la tabla de Stock de teléfonos, los días cuentan desde que entró el primer lote; la ficha cuenta solo las entradas de verdad, conserva la revisión y la espera de antes de la corrección y, si es de pedido, su última caja.
- **Carga de técnicos:** el panel flotante es un poco más grande (440 px de ancho en vez de 340), con más sitio para el nombre del técnico, la letra algo mayor y la lista más alta. Si tapa algo, se minimiza como antes.
- Corrección en NSYS: servidor y web, sin migración. Panel de carga: solo web.
- **SKU del taller: lo del taller por encima de NSYS.**
  - **Stock de teléfonos, ficha del IMEI, «Pegar varios IMEIs» y buscador de IMEI** (supertécnico y administrador): el color, el grado y el SKU que se ven son **los que valen**: lo que el taller ha cambiado manda sobre NSYS hasta que NSYS lo alcance. Las celdas cambiadas llevan la marca «taller» y, debajo, lo que dice NSYS («NSYS: Azul»). Los filtros y la tabla color × grado cuentan lo que vale.
  - **«Corregir color, grado o batería…»** en la ficha de NSYS del IMEI: color (los del maestro para ese modelo, capacidad y eSIM), grado (A, A-, B o C, con «Batería nueva (100)» y «Mensaje de pieza (Ms)») y motivo obligatorio, con la vista previa del SKU nuevo (o «sin SKU en el maestro», que se guarda igual) y de lo que habrá que poner en NSYS. «Volver a lo de NSYS» quita lo del taller. Queda en el registro de actividad (`CORREGIR_MOVIL_TALLER`) y en el rastro.
  - **Pestaña «Por pasar a NSYS (N)»** en el stock de teléfonos: lo que hay que cambiar a mano en NSYS (producto y grado), con el SKU nuevo, quién y por qué; «Exportar a Excel» la copia para pegarla. Se vacía sola cuando la importación ve NSYS igual; si después NSYS pone otra cosa, manda NSYS.
  - **Rastro:** los cambios del taller, «Pasado a NSYS», «Manda NSYS» y «Vuelve a lo de NSYS».
- **Las reparaciones cambian solas el color y el grado del móvil** (pieza 2 del SKU del taller): al guardar una reparación con **chasis** o **tapa trasera** (nueva o reutilizada), el móvil pasa al color de la pieza (deducido del maestro) y a grado **A**, conservando «Ms» y «100»; con **batería nueva**, el grado lleva «100»; con batería reutilizada, se le quita. Solo en los móviles que están en NSYS; glass y marco no cambian nada. Si el color no se puede deducir, o el grado no es de la forma de NSYS (ID, F, n/a…), ese dato no cambia y el rastro lo avisa para corregirlo a mano.
- **Editar o borrar una reparación** deshace lo suyo si nadie lo ha cambiado después ni ha pasado ya a NSYS; si no, el rastro avisa para corregirlo a mano.
- **Rastro y «Por pasar a NSYS»:** «Taller: color Azul → Rojo (reparación R… · quién · chasis chai13red nuevo)», «Se deshace: …» y los avisos; en «Por qué», «Color: reparación R… · quién · pieza».
- **Listas del taller: el móvil entero donde ponía el modelo** (todos los roles, también el técnico): Asignaciones, Pendientes, Pulidos pendientes (también su confirmación), el Historial de trabajos y de pulidos, IMEIs y la barra del detalle del IMEI pasan de «iPhone 13» a **«iPhone 13 128GB Azul»**: la capacidad y el color de NSYS (el color que vale, con lo del taller encima), también en «Copiar celda». La columna «Modelo» es más ancha y se abre con un clic, como «Comentario» (salvo en IMEIs, donde el doble clic abre el detalle y cabe entera), que cede sitio y también se abre con un clic en Pendientes, Pulidos pendientes e Historial de pulidos. Sin grado ni marca «taller». Un móvil que no está en NSYS sigue con el modelo solo; en el historial sale el color de hoy. Los CSV `reparaciones_pendientes`, `pulidos_pendientes`, `historial_pulidos` y `agrupado_resumen` ganan «Capacidad» y «Color» detrás de «Modelo». Servidor y web, sin migración.
- Requiere el servidor de la 0.9.21 y la migración `migracion-sku-taller.sql` (tablas `Taller_cambio` y `Taller_aviso`). La web 0.9.20 funciona con ese servidor.

## [0.9.20] - 2026-10-21 — Carga de técnicos: panel flotante en directo

- **Carga de técnicos** (supertécnico y administrador): la ventana que bloqueaba la pantalla pasa a ser un **panel flotante** que se ve en cualquier pantalla mientras se trabaja.
  - Sale abierto de fábrica arriba a la derecha, bajo la barra superior; si se cierra, se vuelve a abrir con «Carga técnicos» de Asignaciones.
  - Queda por encima de cualquier ventana abierta (por ejemplo «Asignar trabajos») y se puede usar mientras tanto; tocarlo no cierra la ventana.
  - Se arrastra por la cabecera y se queda en la esquina más cercana; «–» lo minimiza a una pastilla con mini-barras y cuántos técnicos están al 90 % o más.
  - Se actualiza solo: lo que hace el usuario, al momento (cualquier escritura vuelve a pedir la carga); lo demás, cada 30 s (5 s sin conexión). Con el ratón encima no cambia.
  - Pulsar un técnico lleva a Asignaciones con su filtro, y el panel sigue abierto.
  - El navegador recuerda si estaba abierto, minimizado o cerrado, dónde y en qué alcance (Pedidos/Total).
  - Ya no congela el refresco de la tabla de Asignaciones.
- Solo web: funciona con el servidor 0.9.18. Sin migración.
- La 0.9.19 no salió sola: llegó a producción dentro de esta versión.

## [0.9.19] - 2026-10-21 — Completar pulidos: solo lo que se ve, con confirmación

- **Mis pulidos pendientes:** con el filtro por IMEI, «Seleccionar todo» marcaba también los pulidos que el filtro ocultaba, y «Completar seleccionados» los completaba todos. Ahora «Seleccionar todo» y «Completar seleccionados» solo cuentan las filas que se ven; una casilla marcada que el filtro oculta ni se cuenta ni se completa.
- «Completar seleccionados» pide confirmación: «Completar N pulidos», con los IMEIs (los cinco primeros y cuántos más). Cancelar no completa nada y deja la selección.
- **Formulario de reparación: «Nueva» o «Reutilizada» en la celda del SKU.** Cada pieza empieza eligiendo, donde estaba el desplegable, si es **nueva** (gasta del stock) o **reutilizada** (no gasta); después sale el desplegable. Con «Nueva» el contador se pone en 1 y Stock enseña lo que quedará («5 → 4»); con «Reutilizada» el contador enseña «—». La columna «¿Reutilizado?» pasa a «Pieza», con la marca «+ Nueva», «↺ Reutilizada» o «Solicitada» y una «×» para volver atrás («−» hasta 0 también). Si ningún SKU de la pieza tiene stock, el botón ya dice «Solicitar pieza». La banda «Sin stock… Solicitar pieza» solo sale con «Nueva». Con una pieza elegida sin SKU (chasis o tapa sin color), «Terminar» avisa «Falta elegir el SKU de: …». Al editar una reparación, la «×» permite pasar una pieza de nueva a reutilizada y al revés (el servidor ya ajusta el stock). Una pieza «Nueva» sin stock y sin pedir tampoco deja terminar («Sin stock: …»), y con una solicitud la marca dice «Solicitada».
- Solo web: funciona con el servidor 0.9.18. Sin migración.

## [0.9.18.1] - 2026-10-20 — Stock de teléfonos: el descuadre no cuenta los de pedido

- **Stock de teléfonos** (supertécnico y administrador): un móvil de pedido («Pedidos realizados») con un trabajo abierto ya no sale como descuadre. Tiene dueño, pero se repara ahí hasta que NSYS lo pone Released: sale el técnico, como en cualquier otro trabajo. El descuadre queda para un trabajo abierto de hace más de una hora con el móvil en Listos. Cambia en la tabla, en el aviso «con descuadre», en el filtro «Técnico» y en «Pegar varios IMEIs».
- Solo web: funciona con el servidor 0.9.18. Sin migración.

## [0.9.18] - 2026-10-20 — Stock de teléfonos: quién lo tiene, SKU y revisado

- **Stock de teléfonos** (supertécnico y administrador):
  - la columna de la izquierda tiene una fila por modelo, con sus capacidades en pastillas y la barra listos / taller / revisión; el buscador acepta un modelo o un SKU, entero o el principio;
  - el modelo se abre con pestañas de capacidad, y una tabla color × grado sustituye a los chips de color y de grado;
  - la tabla de móviles dice **quién tiene cada móvil** (las asignaciones abiertas de reparación, glass y pulido, con la llegada de la glass), avisa de los móviles en caja de taller sin asignar y de los descuadres (un trabajo abierto de hace más de una hora con el móvil en Listos o de pedido) y tiene un filtro «Técnico»;
  - el grado lleva color por familias;
  - «Pegar varios IMEIs» comprueba una lista de hasta 500 IMEIs, también los vendidos, y copia el resultado para Excel; si la comprobación falla, lo dice y se puede reintentar;
  - la píldora de NSYS abre la lista de las últimas importaciones, con los huecos y el progreso del histórico.
- **Barra superior** (supertécnico y administrador): un aviso rojo «NSYS sin datos» en cualquier página cuando no llegan datos de NSYS.
- **IMEIs** (supertécnico y administrador): la ficha de NSYS dice cuándo se revisó el móvil o desde cuándo espera la revisión, y el rastro rotula «Revisado →». Un móvil en «Funcionalidad pendiente» también sale como pendiente de revisar, y su revisión es el paso a una caja.
- Requiere el servidor 0.9.18. Sin migración.

## [0.9.17] - 2026-10-20 — Stock de teléfonos y rastro

- **Stock de teléfonos** (grupo nuevo «Teléfonos», solo supertécnico y administrador): los móviles que hay en la empresa según NSYS, por modelo y capacidad, con sus totales (listos, taller, revisión y libres; lo que está en «Pedidos realizados» no cuenta como stock vendible, como en el Excel) y filtros de un clic por color, grado, batería, ubicación y estado. Busca cualquier IMEI, también los vendidos, y avisa de la hora de los datos de NSYS (en ámbar con retraso; banda roja si no llegan). Es de solo lectura.
- **IMEIs** (supertécnico y administrador): el detalle lleva encima la ficha de NSYS y «Ver rastro», que abre en un panel lateral la línea de tiempo del teléfono (cajas, grados, venta y trabajos del taller). Un IMEI sin trabajos del taller también tiene detalle, y la lista avisa de los móviles de NSYS sin trabajos al filtrar por IMEI. El técnico ve IMEIs como hasta ahora.
- El modelo que se rellena al escribir un IMEI sale del espejo de NSYS en vez de IMEIcheck. Si NSYS no conoce el IMEI, se escribe a mano, como cuando IMEIcheck fallaba.
- Requiere el servidor 0.9.17 y la migración `migracion-nsys-espejo.sql`.

## [0.9.16] - 2026-10-15 — El técnico sin Pedidos ni Proveedores

- **Pedidos y Proveedores son del supertécnico y del administrador.** El técnico ya no los tiene en la columna: el grupo Stock le queda con «Stock actual». Si entra por la dirección, ve «No tienes permisos para realizar esta acción.» y vuelve a Stock actual. El administrador sigue viéndolos en solo lectura.
- **Stock actual del técnico:** «En Camino» es el número, sin enlace a Pedidos, y la barra «Pedido» del gráfico de la pieza enseña lo que está en camino (antes marcaba 0).
- Requiere el servidor 0.9.16: las lecturas de pedidos y proveedores (`GET /api/compras`, `/api/compras-otros` y `/api/proveedores`) dan 403 al técnico.

## [0.9.15] - 2026-10-15 — «Añadir otro»: los otros pedidos dentro del bloque de su proveedor

- **Una sola lista en Pedidos.** Los otros pedidos (conceptos libres) van dentro del bloque de su proveedor, junto a las piezas. Cada línea lleva delante una píldora «pieza» u «otro» (las dos del mismo ancho), y el ID de un otro se ve como «O-88». Desaparecen el toggle «Componentes | Otros», la página «Otros» y «Nuevo otro pedido»; la dirección antigua simplemente abre Pedidos, y el buscador encuentra un otro por su concepto.
- **Cabecera del bloque con los otros.** La cabecera del bloque cuenta los otros («3 líneas (1 otro)»), y el total, los estados y las acciones del bloque (confirmar, recibir, cancelar, borrar, separar y juntar) cuentan las dos cosas. Recibir un otro no toca el stock.
- **«+ Añadir otro»** en «Nuevo pedido», junto a «+ Añadir línea»: una línea con un concepto de texto libre que no entra en la previsión ni en «lo que falta» y que se puede repetir. En el menú del bloque, **«Añadir otro…»**.
- Un otro tiene «Mover a bloque», y al cambiarle el proveedor en «Editar» pasa a un bloque de ese proveedor.
- **CSV** (general y «Exportar bloque en CSV»): incluye los otros, con la columna nueva «Tipo» tras «ID».
- Los otros pedidos que ya existían pasan a bloques antiguos (mismo proveedor y día).
- Requiere el servidor 0.9.15 con `migracion-otros-en-bloques.sql` y `reconstruir-bloques-otros.sql`.

## [0.9.14] - 2026-10-14 — Navegación por grupos

- **Toda la navegación en la columna de la izquierda.** Cada sección es un grupo con su cabecera, que se pliega y se despliega: Reparaciones, Stock, Estadísticas (Rendimiento), Clientes (Listado) y, para el administrador, Gestión (Técnicos y Logs). Cualquier pestaña está a un clic desde cualquier sitio.
- **La barra de arriba ya no tiene botones de sección**: se queda con el logo, la versión, la campana y el usuario. Gestionar técnicos y Ver logs salen del menú de usuario y pasan al grupo Gestión. Técnicos y Logs ya no tienen «Cerrar»: son pestañas como las demás.
- **Los números de Pendientes y Asignaciones se ven siempre**, también desde Stock o Clientes. Con su grupo plegado, la cabecera enseña la suma.
- Con la columna plegada se ven todos los iconos, separados por grupos, y al pasar el ratón sale «Grupo · Pestaña». El navegador recuerda qué grupos se dejaron plegados.
- Solo web: sin cambios en el servidor, la base ni nginx.

## [0.9.13] - 2026-10-14 — Casillas en las acciones de bloque y «Exportar bloque en CSV»

- **Casillas en «Confirmar bloque», «Recibir todo» y «Cancelar bloque».** Al abrir, todas las líneas que cambian salen marcadas; se desmarcan las que no deben cambiar (por ejemplo, las que no han llegado) y «Marcar todas» marca o desmarca todas. El título y el botón cuentan las marcadas («Se reciben (suman al stock) (36 de 39)», «Recibir (36)»); una desmarcada sale en gris y tachada con «se queda en camino» («se queda pendiente» al confirmar), y debajo se avisa de cuántas no cambian. Las parciales siguen fuera, en «No cambian», y «Borrar bloque» sigue sin casillas.
- **«Exportar bloque en CSV»** en el menú del bloque (⋮ o clic derecho en su cabecera): descarga todas las líneas de ese bloque, aunque haya filtros, con las columnas del CSV de Pedidos, en `pedidos_bloque_<n>_<fecha>.csv`. El administrador y el técnico también ven el ⋮, solo con esta entrada.
- Solo web: sin cambios en el servidor, la base ni nginx.

## [0.9.11] - 2026-10-14 — «Abrir» automático al entregar a glass

- **«Abrir» automático.** «Entregar a …» (Mis pendientes, Reparación) apunta sola una acción «otro» «Abrir» a quien entrega, en su reparación. Si la llegada la marca el de glass («Marcar que llegó»), el «Abrir» va al dueño de la reparación normal. «Deshacer entrega» y «Deshacer llegada» lo borran. Si ya había un «abrir» apuntado a mano no se duplica; si el modelo no tiene pieza «otro», la entrega se hace igual, sin «Abrir».
- **Aviso breve** abajo al centro tras entregar, marcar la llegada o deshacer («Entregado a … · Abierto», …): no es un diálogo; una barra amarilla encoge en 4 s y se cierra solo, o con un clic.
- **Atajo «+ Cerrar»** en Otras acciones del formulario de **reparación** (al completar): añade la línea «Cerrar» lista para «✓ Guardar». Solo sale si desde que se asignó la reparación hay más «Abrir» que «Cerrar» y el teléfono ya ha vuelto de glass: con una glass abierta en el IMEI no sale; cuando se completa o se elimina, sí. Cada bajada a glass apunta su propio «Abrir».
- **«Actualizado» sin diálogo de error al pulsar varias veces.** Pulsar «Actualizado HH:mm» tres o más veces mientras la recarga seguía en curso abría el diálogo «Error: CancelledError»; ahora cuenta la última recarga, sin diálogo.
- Requiere el servidor con `migracion-abrir-glass.sql` (columna `ID_REP_ABRIR` y puntos `abrir` 0,25 / `cerrar` 0,17).

## [0.9.10] - 2026-10-14 — Columna lateral plegable

- **Iconos en la columna lateral.** Cada pestaña de la columna de la izquierda lleva su icono delante del nombre: Asignaciones, Pendientes, Historial, IMEIs, Stock actual, Pedidos, Proveedores y Clientes.
- **La columna se pliega.** El botón redondo de su borde la deja en una franja de 56 px con solo los iconos, y el contenido gana 144 px; el mismo botón la despliega. Plegada, al pasar el ratón por un icono sale su nombre, y los números de Pendientes y Asignaciones siguen cada uno en su icono. El navegador recuerda cómo se dejó (es del ordenador, no del usuario).
- **Sin columna vacía.** En Estadísticas, Gestionar técnicos y Ver logs ya no sale la columna en blanco: el contenido usa todo el ancho.
- Solo web: sin cambios en el servidor, la base ni nginx.

## [0.9.9] - 2026-10-14 — Pedidos por bloques

- **Bloques de pedido.** Cada pedido de componentes pertenece a un **bloque**: lo que se le pide de una vez a un proveedor. Al guardar «Nuevo pedido», las líneas de cada proveedor se suman a su bloque abierto (sin nada confirmado) o van a uno nuevo; la cabecera del recuadro de cada proveedor enseña y deja elegir el destino.
- **Pedidos agrupada por bloques** (Componentes): cabeceras plegables con número, proveedor, fecha, líneas, total, ⚠, resumen de estados y nota. Los bloques con algo por hacer salen desplegados; los terminados, plegados; con filtros, solo las líneas que cumplen («mostrando k de n»). El interruptor **«Agrupar por bloque»** vuelve a la vista plana de siempre (con columna «Bloque»), y el navegador lo recuerda.
- **Menú del bloque** (⋮ o clic derecho en la cabecera, supertécnicos): Confirmar bloque, Recibir todo, Añadir líneas…, Separar líneas…, Juntar con…, Nota, Cancelar bloque y Borrar bloque. Cada acción se aplica a las líneas que pueden recibirla y la confirmación lista lo que cambia y lo que no. Si otra persona cambia el bloque a la vez, no se aplica nada y se avisa.
- **Mover a bloque** en el menú de cada línea (solo en líneas vivas): una pendiente se mueve sin preguntar; una ya pedida pide confirmación y queda en el registro. «Editar» con otro proveedor lleva la línea a un bloque de ese proveedor.
- **Varios proveedores en un mismo «Nuevo pedido».** Cada proveedor va en su recuadro, que es su bloque: en la cabecera se ve a qué bloque va («Añadir a Bloque N» o «Bloque nuevo»), su «Añadir previsión (n)», ▼ para plegarlo y × para quitarlo. «+ Otro proveedor» añade otro y «Confirmar pedido (n bloques)» lo guarda todo de una vez. Lo que llega de la campana, de Stock o de las solicitudes va solo al proveedor que vende cada pieza; si la venden varios o ninguno, espera en «⚠ Por repartir» con «Pasar a…». Al elegir una pieza sale lo que falta: su «Pedir 60 d» menos lo que ya va a otros proveedores en el pedido. Ya no hay «Proveedor general» ni el recuadro «Bloques» del pie. Al abrir vacío ya hay un primer recuadro con el proveedor por elegir; «+ Otro proveedor» está en el pie, junto a «Cancelar» y «Confirmar pedido».
- **Cantidad prevista en «Nuevo pedido».** Al elegir la pieza de una línea, la cantidad pasa a su «Pedir 60 d» (o a 1 si no tiene) si la línea seguía con la cantidad automática (1, o la prevista de la pieza anterior); si se cambió a mano, no se toca. «Pedir» desde Stock y «Pedir todas las piezas» desde la campana entran con esa cantidad, leída de la lista recién cargada. Una pieza no se repite dentro de un mismo proveedor (en dos proveedores sí, con el aviso «… también va a X (n).»): si se elige una que ya estaba, se queda la que ya la tenía, seleccionada, con el aviso «… ya está en el pedido a X (línea n).».
- **Cabecera del bloque:** chip ámbar «! N sin precio» si hay líneas recibidas sin precio (las del «!» de su fila), y la nota con un icono de bocadillo en lugar del emoji.
- **Solo se mueve lo vivo.** «Mover a bloque» solo sale en líneas pendientes, en camino o parciales, y ofrece los bloques vivos (abiertos o en curso) del mismo proveedor, sin tope, y «Bloque nuevo». «Juntar con…» y el «Bloque» de «Editar», igual. Un bloque terminado (todo recibido o cancelado) queda cerrado: sin añadir líneas ni previsión, separar ni juntar. «Separar líneas…» solo deja marcar líneas vivas.
- **Piezas que vende cada proveedor** (Proveedores → clic derecho → «Piezas que vende…», supertécnicos): un renglón por **tipo de pieza** (Batería, Chasis, Tapa trasera, Glass, Marco, Pantalla, Cámara) con su casilla. Un tipo marcado se vende de **todos los modelos**, también los que salgan más adelante; en su desplegable se desmarcan los modelos que no vende («Seleccionados K de M», con los que faltan al lado). Arranca rellenada con los tipos que se le han pedido a cada proveedor.
- **Previsión por proveedor** en «Nuevo pedido»: cada recuadro de proveedor lleva su «Añadir previsión (N)», que añade las piezas en Auto que vende ese proveedor con lo que falta. Avisa de las piezas en Auto con algo que pedir que no están en la lista de ningún proveedor. También desde el menú del bloque: «Añadir previsión…».
- **«Pedir 60 d» descuenta lo pendiente** (lo apuntado en cualquier bloque y aún sin pedir), y Stock tiene la columna **«Pendiente»** (también en el CSV).
- **Buscar un bloque por su número**: en Pedidos (Componentes), escribir solo cifras en el buscador enseña ese bloque.
- **«En camino» en azul** en Pedidos y Otros pedidos (badge de la línea y chip de la cabecera del bloque): el gris de antes se confundía con «cancelado». El urgente sigue en naranja con ⚠.
- CSV de pedidos con las columnas «Bloque» y «Nota del bloque». Los pedidos anteriores se agrupan en bloques «antiguos» (mismo proveedor y día).
- Requiere el servidor 0.9.9 y las migraciones `migracion-bloques-compra.sql`, `reconstruir-bloques-compra.sql`, `migracion-catalogo-proveedores.sql` y `rellenar-catalogo-proveedores.sql`. Sin cambios en nginx.

## [0.9.8] - 2026-10-09 — Cliente guardado en cada trabajo

- **Cada trabajo recuerda para qué cliente se hizo.** Al terminar una reparación, un glass o un pulido se guarda el cliente que tenía el teléfono en ese momento. Si después se cambia el cliente del teléfono (por ejemplo, porque se vende a otro), los trabajos ya hechos no cambian: el Historial, sus filtros y sus CSV siguen mostrando el cliente con el que se hicieron. Los trabajos pendientes siguen al cliente del teléfono, como siempre (urgente, orden de la cola, barra de Pedidos y predicción de glass sin cambios).
- **Vista IMEIs:** la columna Cliente, su filtro y su CSV muestran el cliente **actual** del teléfono (el que cambia «Editar cliente»).
- **Historial con el cliente de cada trabajo:** columna **Cliente** (también en el detalle de un IMEI), filtro «Cliente» y columna en el CSV.
- **Corregir cliente** (supertécnicos y administrador): clic derecho en un trabajo cerrado → «Corregir cliente». Se elige el cliente correcto y qué trabajos cerrados del mismo IMEI con ese cliente se corrigen (de entrada, los del mismo día). El cliente actual del teléfono no cambia. Queda en el registro.
- **Clientes:** un cliente que aparece en trabajos ya no ofrece «Borrar»; se desactiva.
- Requiere el servidor 0.9.8, la migración `migracion-cliente-por-trabajo.sql` (columna `ID_CLI` en `Reparacion`) antes de desplegar y, después, el relleno `relleno-cliente-por-trabajo.sql` en consola (los trabajos anteriores se completan con el registro de cambios de cliente). Sin cambios en nginx.

## [0.9.7] - 2026-10-09 — Tapa trasera

- **Tapa trasera como pieza propia.** Nueva fila **"Tapa trasera"** en el formulario de reparación, justo después de Chasis, con un SKU por modelo y color (los mismos colores que el chasis) para el 14, el 14 Plus, toda la serie 15, toda la serie 16, el 17, el Air, el 17 Pro y el 17 Pro Max. Descuenta stock y sale en Stock, en la previsión, en los pedidos y en el filtro "Pieza" del historial como el resto de piezas. Puntúa 1 punto en las estadísticas (hasta ahora se apuntaba como "otro" y valía 0,5).
- **Formulario más limpio:** con el modelo elegido, la fila de un tipo de pieza que no existe para ese modelo ya no se pinta (por ejemplo, "Tapa trasera" en un iPhone 13). Si el tipo existe pero todos sus SKU de ese modelo están desactivados, la fila sigue saliendo en gris.
- **Chasis y tapa trasera se eligen a mano y con color.** Ya no vienen con un SKU preseleccionado: el desplegable dice "— Elige color —" y "+", "-", "Reutilizado" y "Añadir observación" se activan al elegirlo. En la lista, cada opción lleva un círculo con su color y el nombre oficial (Ultramarine, Black Titanium…); en el botón, el SKU completo (la columna SKU del formulario es ahora más ancha, 240 px, para que se vea entero, con su "esim"). El chasis separa las opciones en **SIM** y **eSIM**. Chasis y tapa van enlazados: al elegir el chasis, la tapa pasa a su color; al elegir la tapa, el chasis cambia de color conservando su SIM/eSIM (si aún no está elegido, se resaltan las opciones de ese color).
- Requiere el servidor 0.9.7 y el script `datos-tapa-trasera.sql` (puntos de la tapa y las tapas), que se aplica después de desplegar. Sin cambios en el esquema de la base ni en nginx.

## [0.9.6] - 2026-10-08 — Pedir para 60 días y pedido automático

- **Previsión de pedidos: una sola columna "Pedir 60 d"** en lugar de "Pedir 15 d" y "Pedir 30 d": cuánto pedir para cubrir 60 días, con la misma regla (contando el stock y lo que ya está en camino, sin bajar nunca del stock mínimo). También en el CSV.
- **Pedido automático** (supertécnicos y administrador). En Stock, columna **Modo** con un interruptor por pieza: **Auto** (en verde) o **Manual** (en gris); en un grupo de stock compartido, uno para todo el grupo. Se cambia con un clic, se guarda al momento y lo ven igual todos los supertécnicos y el administrador. En el filtro **Estado**, bajo una línea, **Auto** y **Manual** (se combinan con los estados: "Bajo" + "Auto" = las bajas en Auto). También va en el CSV (columna "Modo").
- En **"Nuevo pedido"**, arriba: **Proveedor** general, **"Aplicar a todas"** (pone ese proveedor en todas las líneas) y **"Añadir previsión (N)"**, que añade las piezas marcadas con la cantidad de "Pedir 60 d". El proveedor general es opcional: al elegirlo se pone en las líneas que aún no tienen proveedor (las que ya tienen uno no cambian) y lo llevan las líneas que se añadan después; sin él, las líneas quedan sin proveedor para elegirlo en cada línea o con "Aplicar a todas". La ventana es más grande (880 px de ancho y hasta unas 12 líneas a la vista). Las marcadas que no necesitan pedido no se añaden y se avisa cuántas son. Si una pieza ya estaba en el pedido no se repite: se sube su cantidad a la de la previsión si es mayor, y el proveedor solo se pone si no tenía. El precio se puede dejar en 0 y ponerlo después con "Editar pedido".
- Requiere el servidor 0.9.6 y la migración `migracion-auto-pedido.sql` (columna `AUTO_PEDIDO` en `Componente`). Sin cambios en la configuración de nginx.
- **Pedidos**: columna estrecha **ID** a la izquierda con el número del pedido (en Componentes y en Otros), también al principio del CSV.
- Los desplegables que se abren dentro de una ventana ("Nuevo pedido", "Asignar"…) vuelven a desplazarse con la rueda del ratón y con el trackpad. Antes la ventana bloqueaba ese desplazamiento y, en los Mac que ocultan la barra de scroll, no había forma de llegar a las opciones de abajo.

## [0.9.5] - 2026-10-07 — Previsión de pedidos

- **Previsión de pedidos en Stock** (supertécnicos y administrador). Tres columnas nuevas: **Consumo/día** (lo que se gasta al día de cada pieza, con más peso lo de los últimos 30 días: 50 %, 30 % y 20 % para los días 1-30, 31-60 y 61-90) y **Pedir 15 d** / **Pedir 30 d** (cuánto pedir para cubrir 15 o 30 días, contando el stock y lo que ya está en camino, sin bajar nunca del stock mínimo). Un 0 sale en gris. También van en el CSV.
- **El stock mínimo es el suelo y solo lo cambia el administrador** (clic derecho → "Ajustar mínimo"). Los supertécnicos ya no tienen esa opción; "Editar stock" no toca el mínimo.
- **Parámetros de previsión** (solo administrador): botón en Stock para cambiar los tres pesos; tienen que sumar 100.
- **Stock compartido en una sola fila**: los SKU que comparten stock (p. ej. `cami13 / cami13pro`) salen en una fila con «stock compartido», el buscador los encuentra por cualquier nombre, «Solicitar pieza» pide elegir el modelo y «Nuevo pedido» los ofrece una vez.
- Al cerrarse la sesión por dos horas sin uso, el login lo dice: "Se cerró la sesión tras dos horas sin uso."
- En "Cambiar contraseña" y "Cambia tu contraseña", un Enter pulsado justo después de escribir ya guarda (decide el servidor).
- Requiere el servidor 0.9.5 y la migración `migracion-parametros-prevision.sql` (tabla `Parametro`). Sin cambios en la configuración de nginx.

## [0.9.4] - 2026-10-06 — Letrero de preproducción

- La web construida para la máquina de pruebas (argumento `VITE_ENTORNO=preproduccion`) enseña arriba una franja «PREPRODUCCIÓN · datos de prueba» y pone «[PRE]» delante del título de la pestaña, para no confundirla con la de producción.
- En producción no cambia nada: sin ese argumento no hay letrero ni cambia el título.
- La plantilla `deploy/docker-compose.prod.yml` recoge la variable de las palabras propias de la regla de contraseñas (con marcador).
- Solo cambia la web; el servidor sigue en la 0.9.2. Sin cambios en la base de datos ni en la configuración de nginx.

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
