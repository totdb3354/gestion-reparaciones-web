# Ficha de paridad — Stock actual y Proveedores (StockController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), la vista Stock de `StockController` con sus pestañas "Stock actual" y "Proveedores" (la pestaña "Pedidos" y los formularios de pedido son el sub-proyecto 4b y no entran aquí). La pestaña Proveedores se compara con la petición `?tipo=COMPONENTES` de `main`, porque el hotfix pide `/api/proveedores` sin tipo. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-24-web-almacen-stock-design.md`.

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `almacen/stock-*.png`, `almacen/proveedores-*.png` y `almacen/campana-*.png`. Cuatro situaciones no se pudieron reproducir en la toma y se comprueban directamente con la web: `stock-banner-sin-conexion`, `stock-filtro-estado-sin-desactivados`, `stock-editar-stock-conflicto` y `proveedores-vacio`.

Los ejemplos de componente ("Batería X", "Pantalla Y") y de proveedor ("Proveedor A") son sintéticos.

## Diferencias deliberadas respecto al JavaFX

Las de la spec §10:

- **"Ajustar mínimo" y "Nuevo proveedor" son diálogos propios** (S5), con el mismo estilo que "Editar stock" (título, subtítulo, campo, error inline, Cancelar/Confirmar), en vez de los `TextInputDialog` nativos.
- **"Nuevo proveedor" con el nombre en blanco avisa** "El nombre no puede estar vacío." (S5); el JavaFX se cierra en silencio.
- **Ordenación por cabecera bloqueada** en las dos tablas (S9). En el JavaFX estaba permitida por omisión, aunque en la toma el clic en la cabecera no ordenaba (`stock-orden-cabecera`).
- **La selección de fila, y con ella el gráfico por SKU, se mantiene en el refresco** de 60 s (S4); el JavaFX la pierde en cada tick (`stock-seleccion-tras-refresco`).
- **Borrar un proveedor que tiene pedidos responde 409** "El proveedor tiene pedidos y no se puede borrar." y la web lo enseña como error de negocio (S6); el JavaFX recibía un 500 disfrazado de "servidor no disponible".
- **`tiene-pedidos` se consulta al abrir el menú** del proveedor, no en cada clic de fila (S6).
- **Gráficos con Recharts** (S7): colores, tamaños y textos calcados, implementación distinta.

Decididas durante la ejecución:

- **"Editar proveedor" lleva el nombre del proveedor en el subtítulo**, no en el título: la web no tiene título de ventana ("Editar proveedor — `<nombre>`" en el JavaFX) y así queda coherente con "Editar stock" (decisión 7).
- **"Último pedido" en hora de Madrid.** El JavaFX pinta la fecha UTC sin convertir; la web la pasa a hora de Madrid con `formatear`, como el resto de la web y el CSV del JavaFX. Solo difiere con pedidos hechos entre las 22:00 y las 24:00 UTC; diferencia aceptada (decisión 8).
- **"Ajustar mínimo" se titula "Ajustar mínimo"** y lleva el subtítulo de componente, en vez del título de ventana "Stock mínimo" con el SKU como cabecera del `TextInputDialog` (decisión 6, spec §6/S5).
- **El filtro "Estado" es el `MultiSelect` compartido** (casillas en un popover) en vez del `MenuButton` del JavaFX; marcar no lo cierra, como allí (decisión 9, spec §5).
- **Nombre de proveedor de más de 100 caracteres → 422** "El nombre no puede superar los 100 caracteres." (decisión 3); el JavaFX acababa en un 500.
- **Enter confirma en "Editar proveedor"**; el JavaFX no tiene atajo en ese diálogo.
- **"Solicitar pieza" mide 360 px** de ancho, como el resto de diálogos del almacén; el JavaFX usa 380.
- **Un 422 del servidor se pinta inline** con el diálogo abierto.
- **El alta de proveedor manda `divisa: 'EUR'` explícita** junto a `tipo: 'COMPONENTES'`; el servidor ya ponía EUR por defecto.
- **"Cantidad en camino" de un SKU inexistente responde 500** en vez de `{"value":0}`, como `insertar`, al resolver el master; ningún flujo de la web pide un id que no esté en la tabla.
- **El negativo del combo de SKU del formulario de reparación pasa a ámbar**: `nivelStock` se rehace sobre el semáforo compartido (S3), que da "Bajo" al stock negativo como el JavaFX.
- **El servidor recorta el nombre del proveedor y pasa la divisa a mayúsculas** antes de validar y guardar; inocuo, porque el JavaFX y la web ya mandan los valores limpios. El `PUT` rechaza con 422 "Divisa no válida (EUR o USD)." una divisa que no sea EUR o USD (decisión 1: antes del merge se normalizan en BD las que hubiera).
- **`BORRAR_PROVEEDOR` es un tipo de log nuevo** (spec §4.2) y no se puede filtrar en el visor de logs del JavaFX, que no lo conoce; las entradas se ven igualmente sin filtro.
- **El filtro de proveedores conserva los nombres marcados aunque ese proveedor se renombre o se desactive** después (calco del conjunto de nombres del JavaFX); a comprobar en capturas.
- **Tooltip del gráfico por SKU**: la web pinta el valor con el separador de Recharts (" : N"); a comprobar en capturas (`stock-tooltip-barra`).

Internas, sin efecto visible: `BadgeEstadoStock` vive en su propio fichero (`stock/BadgeEstadoStock.tsx`) y `subtituloComponente`/`parseEnteroNoNegativo` en `stock/dialogos.ts`, por la regla de lint de React Refresh; `MSG_NOMBRE_VACIO` se exporta desde `NuevoProveedorDialog.tsx`; `useInteraccionesAbiertas` está en `shared/lib` y no en `shared/api` como decía la spec §5; el smoke obtiene el id del proveedor de prueba con un GET por nombre exacto porque el alta no lo devuelve.

## Pendiente de decidir

- [ ] **Los dos puntos "a comprobar en capturas"**: el separador " : N" del tooltip del gráfico por SKU (`stock-tooltip-barra`) y el filtro de proveedores que conserva nombres renombrados o desactivados.

## Columna lateral y rutas

- [ ] Columna blanca de 160 px con "Stock actual", "Pedidos" y "Proveedores" en ese orden; la activa en navy con texto crema (`stock-actual-supertecnico`).
- [ ] "Stock actual" activa al entrar en `/stock`; "Proveedores" en `/stock/proveedores` (`proveedores-supertecnico`).
- [ ] "Pedidos" lleva a `/stock/pedidos`, que en 4a sigue "Pendiente de migrar".
- [ ] Los tres roles ven la vista entera, con la columna "En Camino" (`stock-actual-tecnico`, `stock-actual-admin`).
- [ ] Al volver desde Reparaciones se conservan la pestaña, los filtros y la selección (`stock-cache-vuelta`).

## Tabla de stock

- [ ] Título "Stock actual", fila de filtros, tabla con pie a la izquierda y tarjeta de gráficos de 240 px a la derecha (`stock-actual-supertecnico`).
- [ ] Seis columnas: Componente, En Stock, En Camino, Stock Mínimo, Último pedido y Estado, con sus anchos (`stock-actual-supertecnico`).
- [ ] Componente compartido con el sufijo "  (compartido)" (dos espacios) (`stock-fila-compartido-seleccionada`).
- [ ] "En Camino" a 0 pinta "—"; mayor que 0 es un enlace azul subrayado al pasar (`stock-en-camino-hover`).
- [ ] El clic en "En Camino" navega a Pedidos con pendiente, en camino y parcial y el buscador con el componente (`stock-en-camino-navegacion`; en 4a llega a "Pendiente de migrar" con los parámetros en la URL).
- [ ] "Último pedido" en `dd/MM/yyyy`; nulo → "—" (`stock-actual-supertecnico`).
- [ ] Activos primero y desactivados al final; dentro de cada grupo, el orden del servidor (`stock-actual-supertecnico`).
- [ ] Sin ordenación por cabecera (diferencia, ver arriba) (`stock-orden-cabecera`).
- [ ] Placeholder "Sin componentes" cuando el filtro no deja filas; el donut no cambia (`stock-vacio`).

## Semáforo y estilos

- [ ] Badge OK gris, Bajo ámbar sobre crema, Sin stock rojo sobre rosa, Desactivado gris sobre gris claro (`stock-actual-supertecnico`).
- [ ] Borde izquierdo de 8 px ámbar en "Bajo" y rojo en "Sin stock"; transparente en "OK" (`stock-fila-seleccionada-bajo`, `stock-fila-seleccionada-sinstock`).
- [ ] Fila seleccionada navy con textos crema; el badge y el enlace conservan su color (`stock-fila-seleccionada-ok`).
- [ ] Fila desactivada con opacidad 0.45, que prevalece sobre la selección: seleccionada no se pone azul (`stock-fila-desactivada-seleccionada`).
- [ ] Stock negativo = "Bajo" (calco).

## Filtros

- [ ] Botón "Estado" con las casillas "OK", "Bajo", "Sin stock" y "Desactivado"; marcar no cierra el desplegable (`stock-filtro-estado-abierto`).
- [ ] Sin desactivados, "Desactivado" no aparece en el filtro ni hay "N desactivados" en el pie (`stock-filtro-estado-sin-desactivados`: no reproducible en la toma; se comprueba con la web).
- [ ] Un estado marcado: el botón dice su nombre (`stock-filtro-bajo`).
- [ ] Varios marcados: se combinan con O y el botón dice "N estados" (`stock-filtro-dos-estados`).
- [ ] Solo "Desactivado": quedan las filas atenuadas (`stock-filtro-desactivado`).
- [ ] Buscador "Buscar componente…": "contiene", sin mayúsculas, sobre el tipo sin sufijo (`stock-buscador`).
- [ ] "Limpiar filtros" desmarca las casillas y vacía el buscador sin tocar la selección.

## Pie

- [ ] A la izquierda "N desactivado" / "N desactivados", solo si hay alguno (`stock-actual-supertecnico`).
- [ ] A la derecha "Actualizado HH:mm", subrayado al pasar y clicable para recargar (`stock-actualizado-hover`).

## Donut "Estado del stock"

- [ ] Título "Estado del stock", donut de tres sectores (OK verde, Bajo ámbar del gráfico, Sin stock rojo) con el total y la palabra "total" en el centro (`stock-actual-supertecnico`).
- [ ] Leyenda con cuadrado de color, nombre y número por sector (`stock-actual-supertecnico`).
- [ ] Se calcula sobre toda la lista sin filtros, sin desactivados ni negativos; los compartidos cuentan cada uno como una fila (calco).

## Gráfico por SKU

- [ ] Sin selección: "Selecciona un componente" y "↑ Haz clic en una fila" (`stock-actual-supertecnico`).
- [ ] Con selección: título = tipo, barras "Stock" con el color del semáforo y "Pedido" azul, eje "Unidades" (`stock-fila-seleccionada-ok`, `stock-fila-seleccionada-bajo`, `stock-fila-seleccionada-sinstock`).
- [ ] En un compartido la barra "Pedido" suma los pedidos del master (arreglo del servidor) (`stock-fila-compartido-seleccionada`).
- [ ] Tooltip con el número al pasar por una barra (`stock-tooltip-barra`; ver "Pendiente de decidir").
- [ ] El TECNICO ve "Pedido" a 0 sin pedir la cantidad; ADMIN y SUPERTECNICO la piden (`stock-actual-tecnico`, `stock-actual-admin`).

## Menú contextual por rol

- [ ] SUPERTECNICO: Pedir, Editar stock | Ajustar mínimo | Desactivar | Solicitar pieza, con separadores (`stock-menu-contextual-supertecnico`).
- [ ] En una fila desactivada el ítem dice "Activar" (`stock-menu-contextual-desactivado`).
- [ ] TECNICO: solo "Solicitar pieza" (`stock-menu-contextual-tecnico`).
- [ ] ADMIN: sin menú (`stock-actual-admin`).
- [ ] "Pedir" navega a `/stock/pedidos?componente=<id>`, "Pendiente de migrar" hasta 4b (`stock-pedir-desde-componente`, `stock-pedir-desde-desactivado`).

## Editar stock

- [ ] Título "Editar stock", subtítulo "Componente: `<tipo>`   ·   Stock actual: `<stock>` ud(s).", "Nueva cantidad" precargada con foco (`stock-editar-stock`).
- [ ] Enter confirma.
- [ ] No entero o negativo: "Cantidad no válida (debe ser ≥ 0)." con el diálogo abierto (`stock-editar-stock-error`).
- [ ] Confirmar manda el PUT con tipo, stock, mínimo y `updatedAt` tal como llegaron, cierra y recarga.
- [ ] 409: cierra, aviso "El componente fue modificado mientras editabas. Recarga los datos." y recarga (`stock-editar-stock-conflicto`: no reproducible en la toma; se comprueba con la web).
- [ ] Con un error que no sea 409 ni 422 (403/404/5xx/red) el diálogo queda abierto y el error se muestra con el aviso global (calco del JavaFX; `stock-editar-stock-error` no aplica, sin captura).

## Ajustar mínimo

- [ ] Título "Ajustar mínimo", subtítulo de componente, "Nuevo stock mínimo:" precargado (diferencia, ver arriba) (`stock-ajustar-minimo`).
- [ ] Negativo o no entero: "Valor no válido (debe ser ≥ 0)." (inline en la web; aviso aparte en el JavaFX) (`stock-ajustar-minimo-error`).
- [ ] Confirmar manda el PATCH del mínimo y recarga.

## Activar / desactivar

- [ ] Sin confirmación; recarga.
- [ ] En un compartido se desactiva todo el grupo, que baja al final atenuado (calco) (`stock-desactivar-compartido-antes`, `stock-desactivar-compartido-despues`).

## Solicitar pieza

- [ ] Título "Solicitar pieza", subtítulo de componente, "Descripción (opcional)" con área de 3 filas y placeholder "Motivo o contexto de la solicitud...", botón "Solicitar" (`stock-solicitar-pieza`).
- [ ] Sin validación; descripción vacía → nula; sin mensaje de éxito ni recarga (calco).

## Proveedores — tabla

- [ ] Título "Proveedores", filtro "Proveedor", botón "Nuevo proveedor" (solo SUPERTECNICO), tabla y pie "Actualizado HH:mm" (`proveedores-supertecnico`).
- [ ] Columnas Nombre, Divisa, Estado y Comentario; orden del servidor por nombre (`proveedores-supertecnico`).
- [ ] Badge "Activo" verde / "Inactivo" gris; fila activa con borde izquierdo verde suave, inactiva sin opacidad (`proveedores-fila-seleccionada`).
- [ ] Fila seleccionada navy (`proveedores-fila-seleccionada`).
- [ ] TECNICO y ADMIN: sin botón ni menú (`proveedores-tecnico`, `proveedores-admin`).
- [ ] Solo proveedores de componentes (`?tipo=COMPONENTES`).

## Proveedores — filtro

- [ ] El desplegable ofrece solo los activos (`proveedores-filtro-abierto`).
- [ ] Uno marcado: el botón dice su nombre (`proveedores-filtro-uno`).
- [ ] Varios: "N proveedores" (`proveedores-filtro-varios`).
- [ ] Sin "Limpiar filtros".
- [ ] Tabla vacía por el filtro: "Sin proveedores" (`proveedores-vacio`: no reproducible en la toma; se comprueba con la web).

## Proveedores — menú

- [ ] Sin pedidos: Desactivar, Editar, Borrar (`proveedores-menu-contextual-con-borrar`).
- [ ] Con pedidos: solo Desactivar y Editar (`proveedores-menu-contextual-sin-borrar`).
- [ ] Inactivo: "Activar" (`proveedores-menu-contextual-inactivo`).
- [ ] Activar/desactivar sin confirmación; recarga.

## Proveedores — nuevo

- [ ] Diálogo "Nuevo proveedor" con "Nombre del proveedor:" vacío (diferencia de estilo, ver arriba) (`proveedores-nuevo`).
- [ ] Nombre en blanco: "El nombre no puede estar vacío." (diferencia, ver arriba).
- [ ] Alta con el nombre recortado, tipo COMPONENTES y divisa EUR; recarga.

## Proveedores — editar

- [ ] Título "Editar proveedor" con el nombre en el subtítulo; Nombre, Divisa (combo navy con EUR y USD) y Comentario de 3 filas, precargados (`proveedores-editar`).
- [ ] Nombre vacío: "El nombre no puede estar vacío." con el diálogo abierto (`proveedores-editar-error`).
- [ ] Confirmar manda el PUT, cierra y recarga.

## Proveedores — borrar

- [ ] Confirmación roja "Borrar proveedor" / "¿Eliminar el proveedor "`<nombre>`"?" con el botón "Borrar" (`proveedores-borrar-confirm`).
- [ ] Confirmar manda el DELETE y recarga; un 409 se enseña como error de negocio (diferencia, ver arriba).

## Campana

- [ ] "Ver Stock Completo" cierra el panel y abre Stock actual sin filtros (`campana-ver-stock-completo`).
- [ ] "→ Ir a pedidos" abre `/stock/pedidos` (`campana-ir-a-pedidos`).
- [ ] Los botones de pedir de la campana siguen deshabilitados hasta 4b (`campana-panel-alertas`).

## CSV

- [ ] Stock: `stock_actual_<fecha>.csv` con `Tipo;Stock;Stock mínimo;Estado;En camino;Fecha registro`, filas filtradas en el orden de pantalla, tipo sin sufijo (`stock-csv`).
- [ ] Proveedores: `proveedores_<fecha>.csv` con `ID;Nombre;Activo` ("Sí"/"No"), filas filtradas (`proveedores-csv`).

## Refresco y errores

- [ ] Refresco cada 60 s (5 s con el banner de conexión), solo de la pestaña visible.
- [ ] Congelado con un menú, el filtro o un diálogo abiertos.
- [ ] Sin conexión: banner amarillo, sin ventana de error (`stock-banner-sin-conexion`: no reproducible en la toma; se comprueba con la web).
- [ ] Fallo de la cantidad en camino: el gráfico por SKU conserva lo anterior y se avisa por el mapeo común.
- [ ] Errores de "Solicitar pieza" con el diálogo abierto.
