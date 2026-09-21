# Ficha de paridad — Campana de notificaciones (MainView.fxml: campana de la barra + NotificacionesModal.fxml)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), `MainController` y `NotificacionesModal.fxml`. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-19-web-formulario-design.md`.

Capturas de referencia (documentación privada, fuera del repo): `formulario/{campana-on-badge-pulso,notif-alertas,notif-solicitudes,notif-solicitudes-urgente-y-preventiva,notif-rechazadas,notif-pedir-piezas-destino}.png` y `shell/{navbar-supertecnico,navbar-tecnico,navbar-admin}.png`. Las capturas están a ~125 % de escala: sus píxeles no son los lógicos; los valores de esta ficha salen del código. Sin captura (descrito desde el código): campana apagada, tarjeta "Stock Bajo", preventiva rechazada, "Sin alertas de stock", "Rechazar todo", menús contextuales.

## Campana en la barra

- [x] Roles: solo SUPERTECNICO. TECNICO y ADMIN no la ven (ni ocupa hueco).
- [x] Posición: extremo derecho de la barra superior, a la izquierda del botón de usuario ("Hola, <usuario>"), separación 10 px.
- [x] Botón transparente sin borde, padding 2, cursor de mano; al pasar por encima, fondo `rgba(255,255,255,0.08)` con radio 8. Dentro, la imagen a 30×30 px: encendida `NotfON.png` (círculo amarillo con campana oscura), apagada `NotifOFF.png`. Los dos PNG se copian del cliente a `public/` con el mismo nombre.
- [x] Badge: arriba a la derecha, desplazado 10 px a la derecha y 7 px hacia arriba, no recibe clics; imagen `Badge.png` de 16×16 y encima el número (10 px negrita, #F1E356, centrado). **Sin tope** (no hay "99+").
- [x] Contador = solicitudes urgentes `PENDIENTE` + solicitudes preventivas `PENDIENTE` (`GET /api/solicitudes/count` + `GET /api/solicitudes-stock/count`, ambos `{value}`). Las alertas de stock y las rechazadas no cuentan. Con total > 0: imagen encendida y badge visible; con 0: imagen apagada y badge oculto. Un fallo al contar se ignora en silencio.
- [x] La imagen encendida también se fuerza mientras dura el pulso y al abrir el panel, aunque el total sea 0 (por eso puede verse campana amarilla sin badge); el siguiente recuento la corrige.
- [x] El contador se recalcula: al iniciar sesión, al volver el foco a la ventana, en cada recarga del panel (apertura, sondeo, tras cada acción) y al cerrar el panel.

## Pulso de alertas

- [x] Alerta de stock = componente master (`idComMaster == null`), activo y con `stock <= stockMinimo` (stock 0 con mínimo 0 también es alerta), calculado en la web sobre `GET /api/componentes/gestionados` (no se usa `/stock-bajo`).
- [x] Al iniciar sesión, si hay alguna alerta, la campana (con su badge) late sin fin: escala 1 → 1,25 → 1 y halo #F1E356 de radio 0 → 40 px → 0, ciclo de 1,2 s, interpolación lineal. Un fallo al cargar los componentes muestra el error. (solo en la primera carga: ver «Diferencias aceptadas»)
- [x] El pulso se para con el primer clic en la campana y **no vuelve a arrancar** hasta el siguiente inicio de sesión, aunque sigan o aparezcan alertas.
- [x] No hay diálogo automático de alertas al entrar (el javadoc del JavaFX lo menciona; el código no lo hace).

## Panel

- [x] Se abre con un clic en la campana y se cierra con otro (conmutador). Panel flotante sin cabecera, título ni botón de cerrar, no modal: 480 px de ancho, fondo #DDE1E7, borde 1 px #C4C9D4, sin sombra ni radio, padding 20, separación vertical 12; borde derecho alineado con el de la campana y 6 px por debajo de ella; se recoloca si cambia el tamaño de la ventana.
- [x] También se cierra al pulsar en cualquier punto de la página fuera del panel y de la campana, y con "→ Ir a pedidos" y "Ver Stock Completo". No se cierra por perder el foco la ventana.
- [x] Pestaña inicial: "Solicitudes", salvo que el pulso estuviera latiendo en el momento del clic: entonces "Alertas" (solo ocurre en la primera apertura de la sesión con alertas).
- [x] Control segmentado "Solicitudes" · "Alertas": contenedor blanco, radio 20, borde 1 px #D0D4DC, padding 3. Activo: fondo #2C3B54, texto blanco, 12 px negrita, radio 17, padding 7 18. Inactivo: transparente, texto #586376, 12 px sin negrita. Sin contadores. Cambiar de pestaña no recarga datos.
- [x] A la derecha de esa fila, enlace "→ Ir a pedidos" (12 px negrita, #001232, cursor de mano, sin subrayado), visible en las dos pestañas. **Deshabilitado hasta el sub-proyecto 4** con tooltip "Disponible con Almacén (próxima entrega)" (en el JavaFX cierra el panel y abre Stock en la pestaña Pedidos).

## Pestaña Solicitudes

- [x] Zona con desplazamiento vertical de 370 px de alto (sin barra horizontal), fondo #DDE1E7, con: título "Solicitudes de pieza" (14 px negrita, #2C3B54), lista de pendientes (separación 6), título "Rechazadas" (12 px negrita, #9AA0AA), lista de rechazadas. Los dos títulos se ven siempre; no hay texto de "sin solicitudes".
- [x] Orden: en cada lista, primero todas las urgentes (`GET /api/solicitudes?estado=PENDIENTE|RECHAZADA`, en el orden del servidor) y después todas las preventivas (`GET /api/solicitudes-stock?estado=…`); no se intercalan por fecha.
- [x] Fondo alterno con un único contador por lista (compartido entre urgentes y preventivas): 1ª, 3ª… normales; 2ª, 4ª… alternas.
- [x] Fechas `dd/MM/yyyy HH:mm` en hora de Madrid; separador de la línea de información `"  ·  "`.
- [x] **Urgente pendiente**: tarjeta blanca (alterna #F5F6F8), radio 6, padding 10, separación 10, centrada en vertical. Avatar circular de 36 px (#E8EAF0) con la inicial del SKU en mayúscula ("?" si no hay; 13 px negrita, #586376). Línea principal: SKU (13 px negrita, #2C3B54) + etiqueta "⚠" (10 px negrita, #D97B00 sobre #FFF3E0, radio 4, padding 1 5). Línea de información (11 px, #9AA0AA): `<técnico de la reparación>  ·  <fecha>  ·  <idRep>`; la fecha es `fechaSolicitud`, que el servidor rellena con la fecha de la asignación. Descripción debajo si la hay (11 px, #586376, con salto de línea). El IMEI no se muestra. Botón "Rechazar" (fondo #F5A0A0, texto #7A2020, 11 px, radio 20, padding 6 14).
- [x] "Rechazar" (urgente): `PATCH /api/solicitudes/{idRc}/estado {estado: "RECHAZADA"}`, **sin confirmación**; después recarga solicitudes y alertas. Menú contextual de la tarjeta: "Rechazar solicitud" (misma acción).
- [x] **Urgente rechazada**: tarjeta #F0F1F3 (alterna #E9EAEC), radio 6, padding 8. Avatar #EDEEF0 con letra #B0B5BF. SKU 13 px sin negrita #9AA0AA + "⚠" atenuado (#C8A060 sobre #FFF8ED). Información (11 px, #B0B5BF): `<técnico>  ·  <idRep>`, **sin fecha y sin descripción**. Botón "Recuperar" (fondo #2C3B54, texto blanco, 11 px, radio 20, padding 6 14) y papelera (`borrar.png` 18×18, opacidad 0,5, cursor de mano).
- [x] "Recuperar" (urgente): `PATCH /api/solicitudes/{idRc}/estado {estado: "PENDIENTE"}`, sin confirmación; recarga todo. Menú contextual: "Recuperar solicitud". Papelera: `PATCH /api/solicitudes/{idRc}/limpiar` (sin cuerpo), sin confirmación; la solicitud deja de aparecer; recarga todo. La papelera no está en el menú contextual.
- [x] **Preventiva pendiente**: igual que la urgente pendiente pero sin "⚠"; información `<usuario que la creó>  ·  <fecha de la solicitud>` (sin id de asignación); descripción si la hay. "Rechazar": `PATCH /api/solicitudes-stock/{idSol}/estado {estado: "RECHAZADA"}`, sin confirmación; menú contextual "Rechazar solicitud".
- [x] **Preventiva rechazada**: igual que la urgente rechazada pero sin "⚠" y **con fecha** (`<usuario>  ·  <fecha>`), sin descripción. "Recuperar": `PATCH /api/solicitudes-stock/{idSol}/estado {estado: "PENDIENTE"}`; menú contextual "Recuperar solicitud". Papelera: `DELETE /api/solicitudes-stock/{idSol}`, sin confirmación.
- [x] Errores de cualquier acción: aviso con el mensaje del servidor según la política del shell; la lista no cambia.
- [x] Botones inferiores, mitad y mitad, separación 8, siempre habilitados en el JavaFX: "Pedir piezas" (fondo #2C3B54, texto blanco, 13 px negrita, radio 20, padding 11) y "Rechazar todo" (mismo formato, fondo #F5A0A0 y texto #7A2020).
- [x] "Rechazar todo": **sin confirmación**; pide las `PENDIENTE` al servidor en ese momento y las pasa a `RECHAZADA` una a una, urgentes primero y preventivas después; al primer error se detiene (las ya rechazadas quedan así), muestra el error y no recarga; si todo va bien, recarga las solicitudes. Con la lista vacía no hace nada.
- [x] "Pedir piezas": **deshabilitado hasta el sub-proyecto 4** con tooltip "Disponible con Almacén (próxima entrega)" (en el JavaFX abre "Nuevo pedido — solicitudes pendientes" con una línea por componente y, al confirmar el pedido, pasa a `GESTIONADA` todas las solicitudes pendientes).

## Pestaña Alertas

- [x] Zona con desplazamiento de 320 px de alto: título "Alertas de Stock" (16 px negrita, #2C3B54) y lista (separación 6). Vacía: "Sin alertas de stock" (13 px, #9AA0AA).
- [x] Orden: primero las de stock 0, después las de stock > 0; dentro de cada grupo, el orden del servidor (por SKU). Fondo alterno con un único contador para los dos grupos. Se repinta en cada recarga. Un fallo al cargar es silencioso y se mantiene la última lista buena.
- [x] Tarjeta: blanca (alterna #F5F6F8), radio 6, padding 12, separación 12. Icono circular de 40 px: #E8504A con "✕" (sin stock) o #E8903A con "!" (stock bajo), 14 px negrita blanco. SKU (14 px negrita, #2C3B54). Debajo, etiqueta "Sin Stock" / "Stock Bajo" (11 px negrita, del color del icono, sin fondo) y a su lado "Sin unidades" / "<stock> unid. restantes" (11 px, #9AA0AA; sin forma singular). El mínimo no se muestra. Sin menú contextual.
- [x] Un componente con stock negativo cuenta como alerta (pulso) pero no tiene tarjeta (los grupos son `== 0` y `> 0`), como en el JavaFX.
- [x] Botón "Pedir" de cada tarjeta (fondo #2C3B54, texto blanco, 11 px, radio 20, padding 6 16): **deshabilitado hasta el sub-proyecto 4** con el mismo tooltip (en el JavaFX abre "Nuevo pedido" con ese componente).
- [x] Botones inferiores, mitad y mitad, los dos con el formato oscuro de "Pedir piezas": "Pedir todas las piezas" y "Ver Stock Completo". **Deshabilitados hasta el sub-proyecto 4** con el mismo tooltip (en el JavaFX: "Nuevo pedido — alertas de stock" con una línea por alerta, y cerrar el panel para abrir Stock en "Stock actual").
- [x] Pedir una pieza no quita la alerta: solo desaparece cuando el stock supera el mínimo.

## Refresco

- [x] Con el panel abierto: recarga de solicitudes, contadores y alertas cada 60 s (5 s con el banner de conexión activo); los fallos de conexión de ese sondeo no muestran error.
- [x] Las tarjetas de solicitudes no se redibujan si no cambia el conjunto de identificadores y su grupo (pendiente/rechazada, urgente/preventiva): un cambio de descripción, técnico o fecha no repinta mientras el panel siga abierto; así no parpadea ni pierde el desplazamiento. Las alertas se repintan siempre.
- [x] Recarga también al abrir el panel (alertas), al volver el foco a la ventana y tras cada acción de tarjeta (solicitudes y alertas); tras "Rechazar todo", las solicitudes y el contador (no las alertas).

## Diferencias aceptadas

- Panel dentro de la página (popover anclado a la campana) en vez de ventana sin decoración; mismo tamaño, posición y aspecto.
- **Escape cierra el panel** (accesibilidad web); en el JavaFX no había manejador.
- Con el panel cerrado, la web sigue recalculando el contador con el intervalo general (60 s / 5 s), además de al volver el foco; el JavaFX solo lo hacía al volver el foco. Efecto: el badge se pone al día antes.
- "Inicio de sesión" a efectos del pulso = carga de la aplicación con sesión (incluye recargar la página).
- "→ Ir a pedidos", "Pedir piezas", "Pedir", "Pedir todas las piezas" y "Ver Stock Completo": deshabilitados con tooltip hasta que exista Almacén (sub-proyecto 4).
- Las llamadas no bloquean la interfaz (en el JavaFX iban en el hilo de la UI).
- Un fallo al cargar los componentes muestra el error solo en la primera carga (la que decide el pulso); los sondeos y recargas posteriores son silenciosos y conservan la última lista buena.
- Al cambiar el tamaño de la ventana el panel se recoloca; en el JavaFX se cerraba.

## Comportamientos del JavaFX calcados a propósito

- Ninguna acción pide confirmación ("Rechazar", "Recuperar", papeleras, "Rechazar todo").
- La tarjeta urgente muestra la fecha de la asignación, no la de la solicitud; la urgente rechazada pierde la fecha y la preventiva rechazada la conserva; ninguna rechazada muestra la descripción.
- Badge sin tope de cifras.
- El pulso solo se activa una vez por sesión; después no hay indicador de alertas salvo abrir la pestaña.
- El técnico no recibe aviso cuando se rechaza su solicitud.
- La papelera de la urgente la oculta para siempre (no se borra la fila); la de la preventiva la borra.
