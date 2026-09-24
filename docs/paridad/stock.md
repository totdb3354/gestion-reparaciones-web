# Ficha de paridad — Stock actual y Proveedores (StockController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), la vista Stock de `StockController` con sus pestañas "Stock actual" y "Proveedores" (la pestaña "Pedidos" y los formularios de pedido son el sub-proyecto 4b y no entran aquí). La pestaña Proveedores se compara con la petición `?tipo=COMPONENTES` de `main`, porque el hotfix pide `/api/proveedores` sin tipo. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-24-web-almacen-stock-design.md`.

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `almacen/stock-*.png`, `almacen/proveedores-*.png` y `almacen/campana-*.png`. Cuatro situaciones no se pudieron reproducir en la toma y se comprueban directamente con la web: `stock-banner-sin-conexion`, `stock-filtro-estado-sin-desactivados`, `stock-editar-stock-conflicto` y `proveedores-vacio`; de ellas, el banner sin conexión se simuló en la web y la comparación lo dio por bueno.

Comparación lado a lado realizada el 2026-09-24 (49 parejas): 12 diferencias deliberadas confirmadas, 21 calcos, 18 diferencias nuevas de las que 9 se corrigieron en el commit de paridad y 9 se anotan abajo como aceptadas.

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

- **"Editar proveedor" lleva el nombre del proveedor en el subtítulo**, no en el título: los diálogos de la web no tienen título de ventana ("Editar proveedor — `<nombre>`" en el JavaFX; ver la nota general de diálogos más abajo) y así queda coherente con "Editar stock" (decisión 7).
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
- **El filtro de proveedores conserva los nombres marcados aunque ese proveedor se renombre o se desactive** después (calco del conjunto de nombres del JavaFX); la comparación de capturas no encontró diferencias.

Aceptadas tras la comparación de capturas del 2026-09-24:

- **El gráfico por SKU mantiene la fila seleccionada aunque se desactive o el filtro la oculte** (consecuencia de S4); el JavaFX pierde la selección en los dos casos (`stock-desactivar-compartido-despues`, `stock-vacio`).
- **Sin rejilla ni fondo alterno en el gráfico de barras**; el eje Y sí calca la regla `tickUnit = max(1, max/5)`.
- **La tabla no llena el ancho ni el alto de la vista y encoge con pocas filas** ("Sin componentes" queda arriba); el JavaFX mantiene la altura con el placeholder centrado. Es del DataTable compartido y va al backlog de tablas.
- **La tarjeta de gráficos apila su contenido arriba** en vez de repartir la altura entre el donut y el gráfico por SKU.
- **Al desplazar, los bordes de color de las filas asoman bajo la cabecera fija** (`campana-ver-stock-completo`); backlog de tablas.
- **La fila seleccionada deja 8 px transparentes a la izquierda**, donde el JavaFX pinta navy hasta el borde; backlog de tablas.
- **Cabeceras de columna alineadas a la izquierda y en azul-medio**; en el JavaFX van centradas y en gris.
- **Columna lateral de 200 px**, como el resto del shell; el JavaFX mide 160.
- **Diálogos con una X de cierre** (nombre accesible "Close"), **fondo oscurecido y sin título de ventana**, y que **crecen al aparecer el error** en vez de reservar el hueco; vale para todos los diálogos del almacén (`stock-editar-stock`, `stock-editar-stock-error`, `stock-solicitar-pieza`).
- **La web lista solo proveedores de componentes** (`?tipo=COMPONENTES`), mientras el cliente 0.16.3 mezcla los de teléfonos (`proveedores-supertecnico`).

Internas, sin efecto visible: `BadgeEstadoStock` vive en su propio fichero (`stock/BadgeEstadoStock.tsx`) y `subtituloComponente`/`parseEnteroNoNegativo` en `stock/dialogos.ts`, por la regla de lint de React Refresh; `MSG_NOMBRE_VACIO` se exporta desde `NuevoProveedorDialog.tsx`; `useInteraccionesAbiertas` está en `shared/lib` y no en `shared/api` como decía la spec §5; el smoke obtiene el id del proveedor de prueba con un GET por nombre exacto porque el alta no lo devuelve.

## Pendiente de decidir

Sin puntos pendientes tras la comparación de capturas del 2026-09-24.

## Columna lateral y rutas

- [x] Columna blanca de 200 px (160 en el JavaFX, ver arriba) con "Stock actual", "Pedidos" y "Proveedores" en ese orden; la activa en navy con texto crema (`stock-actual-supertecnico`).
- [x] "Stock actual" activa al entrar en `/stock`; "Proveedores" en `/stock/proveedores` (`proveedores-supertecnico`).
- [x] "Pedidos" lleva a `/stock/pedidos`, que en 4a sigue "Pendiente de migrar". (verificado por test: `SubNav.test.tsx` "en Stock pinta las tres entradas del sidebar del JavaFX, para cualquier rol, con la activa marcada")
- [x] Los tres roles ven la vista entera, con la columna "En Camino" (`stock-actual-tecnico`, `stock-actual-admin`).
- [x] Al volver desde Reparaciones se conservan la pestaña, los filtros y la selección (`stock-cache-vuelta`).

## Tabla de stock

- [x] Título "Stock actual", fila de filtros, tabla con pie a la izquierda y tarjeta de gráficos de 240 px a la derecha (`stock-actual-supertecnico`).
- [x] Seis columnas: Componente, En Stock, En Camino, Stock Mínimo, Último pedido y Estado, con sus anchos (`stock-actual-supertecnico`).
- [x] Componente compartido con el sufijo "  (compartido)" (dos espacios) (`stock-fila-compartido-seleccionada`).
- [x] "En Camino" a 0 pinta "—"; mayor que 0 es un enlace azul subrayado al pasar (`stock-en-camino-hover`) (no reproducible hoy: sin En Camino > 0). (verificado por test: `columnas.test.tsx` "'En Camino' a 0 es texto —; > 0 es un enlace azul que avisa con el componente")
- [x] El clic en "En Camino" navega a Pedidos con pendiente, en camino y parcial y el buscador con el componente (`stock-en-camino-navegacion`; en 4a llega a "Pendiente de migrar" con los parámetros en la URL) (no reproducible hoy: sin En Camino > 0). (verificado por test: `StockPage.test.tsx` "'En Camino' > 0 navega a Pedidos con los tres estados y el buscador")
- [x] "Último pedido" en `dd/MM/yyyy`; nulo → "—" (`stock-actual-supertecnico`).
- [x] Activos primero y desactivados al final; dentro de cada grupo, el orden del servidor (`stock-actual-supertecnico`).
- [x] Sin ordenación por cabecera (diferencia, ver arriba) (`stock-orden-cabecera`).
- [x] Placeholder "Sin componentes" cuando el filtro no deja filas; el donut no cambia (`stock-vacio`).

## Semáforo y estilos

- [x] Badge OK gris, Bajo ámbar sobre crema, Sin stock rojo sobre rosa, Desactivado gris sobre gris claro (`stock-actual-supertecnico`).
- [x] Borde izquierdo de 8 px ámbar en "Bajo" y rojo en "Sin stock"; transparente en "OK" (`stock-fila-seleccionada-bajo`, `stock-fila-seleccionada-sinstock`).
- [x] Fila seleccionada navy con textos crema; el badge y el enlace conservan su color (`stock-fila-seleccionada-ok`).
- [x] Fila desactivada con opacidad 0.45; seleccionada se pinta navy con textos crema, atenuada al 45 % (`stock-fila-desactivada-seleccionada`).
- [x] Stock negativo = "Bajo" (calco). (verificado por test: `semaforoStock.test.ts` "stock negativo es Bajo (calco)")

## Filtros

- [x] Botón "Estado" con las casillas "OK", "Bajo", "Sin stock" y "Desactivado"; marcar no cierra el desplegable (`stock-filtro-estado-abierto`).
- [x] Sin desactivados, "Desactivado" no aparece en el filtro ni hay "N desactivados" en el pie (`stock-filtro-estado-sin-desactivados`) (no reproducible en la toma). (verificado por test: `StockPage.test.tsx` "sin desactivados el check \"Desactivado\" no aparece ni el pie")
- [x] Un estado marcado: el botón dice su nombre (`stock-filtro-bajo`).
- [x] Varios marcados: se combinan con O y el botón dice "N estados" (`stock-filtro-dos-estados`).
- [x] Solo "Desactivado": quedan las filas atenuadas (`stock-filtro-desactivado`).
- [x] Buscador "Buscar componente…": "contiene", sin mayúsculas, sobre el tipo sin sufijo (`stock-buscador`).
- [x] "Limpiar filtros" desmarca las casillas y vacía el buscador sin tocar la selección. (verificado por test: `src/modules/almacen/stock/StockPage.test.tsx` ""Limpiar filtros" desmarca las casillas y vacía el buscador sin tocar la selección")

## Pie

- [x] A la izquierda "N desactivado" / "N desactivados", solo si hay alguno (`stock-actual-supertecnico`).
- [x] A la derecha "Actualizado HH:mm", subrayado al pasar y clicable para recargar (`stock-actualizado-hover`).

## Donut "Estado del stock"

- [x] Título "Estado del stock", donut de tres sectores (OK verde, Bajo ámbar del gráfico, Sin stock rojo) con el total y la palabra "total" en el centro (`stock-actual-supertecnico`).
- [x] Leyenda con cuadrado de color, nombre y número por sector (`stock-actual-supertecnico`).
- [x] Se calcula sobre toda la lista sin filtros, sin desactivados ni negativos; los compartidos cuentan cada uno como una fila (calco). (verificado por test: `graficos.test.ts` "cuenta OK, Bajo y Sin stock sobre los activos; excluye desactivados y negativos (calco :495-501)" y "un grupo compartido cuenta cada fila (calco)")

## Gráfico por SKU

- [x] Sin selección: "Selecciona un componente" y "↑ Haz clic en una fila" (`stock-actual-supertecnico`).
- [x] Con selección: título = tipo, barras "Stock" con el color del semáforo y "Pedido" azul, eje "Unidades" (`stock-fila-seleccionada-ok`, `stock-fila-seleccionada-bajo`, `stock-fila-seleccionada-sinstock`).
- [x] En un compartido la barra "Pedido" suma los pedidos del master (arreglo del servidor) (`stock-fila-compartido-seleccionada`) (no comparable: sin En Camino > 0 en la web). (verificado por test: `CompraComponenteDAOEnCaminoTest` "unSlaveConsultaLaSumaDeSuMaster"; en la web, `api.test.tsx` "pedirCantidadEnCamino lee el value tipado")
- [x] Tooltip oscuro solo con el número al pasar por una barra, sin banda gris (`stock-tooltip-barra`).
- [x] El TECNICO ve "Pedido" a 0 sin pedir la cantidad; ADMIN y SUPERTECNICO la piden (`stock-actual-tecnico`, `stock-actual-admin`).

## Menú contextual por rol

- [x] SUPERTECNICO: Pedir, Editar stock | Ajustar mínimo | Desactivar | Solicitar pieza, con separadores (`stock-menu-contextual-supertecnico`).
- [x] En una fila desactivada el ítem dice "Activar" (`stock-menu-contextual-desactivado`).
- [x] TECNICO: solo "Solicitar pieza" (`stock-menu-contextual-tecnico`).
- [x] ADMIN: sin menú (`stock-actual-admin`).
- [x] "Pedir" navega a `/stock/pedidos?componente=<id>`, "Pendiente de migrar" hasta 4b (`stock-pedir-desde-componente`, `stock-pedir-desde-desactivado`).

## Editar stock

- [x] Título "Editar stock", subtítulo "Componente: `<tipo>`   ·   Stock actual: `<stock>` ud(s).", "Nueva cantidad" precargada con foco (`stock-editar-stock`).
- [x] Enter confirma. (verificado por test: `dialogos.test.tsx` "abre con el stock precargado y el subtítulo; confirma con el entero")
- [x] No entero o negativo: "Cantidad no válida (debe ser ≥ 0)." con el diálogo abierto (`stock-editar-stock-error`).
- [x] Confirmar manda el PUT con tipo, stock, mínimo y `updatedAt` tal como llegaron, cierra y recarga. (verificado por test: `StockPage.test.tsx` "\"Editar stock\" manda el PUT, recarga, y un 409 cierra el diálogo con el aviso y recarga")
- [x] 409: cierra, aviso "El componente fue modificado mientras editabas. Recarga los datos." y recarga (`stock-editar-stock-conflicto`) (no reproducible en la toma). (verificado por test: `StockPage.test.tsx` "\"Editar stock\" manda el PUT, recarga, y un 409 cierra el diálogo con el aviso y recarga")
- [x] Con un error que no sea 409 ni 422 (403/404/5xx/red) el diálogo queda abierto y el error se muestra con el aviso global (calco del JavaFX; `stock-editar-stock-error` no aplica, sin captura). (verificado por test: `StockPage.test.tsx` "un error que no es 409 ni 422 en Editar stock deja el diálogo abierto y avisa")

## Ajustar mínimo

- [x] Título "Ajustar mínimo", subtítulo de componente, "Nuevo stock mínimo:" precargado (diferencia, ver arriba) (`stock-ajustar-minimo`).
- [x] Negativo o no entero: "Valor no válido (debe ser ≥ 0)." (inline en la web; aviso aparte en el JavaFX) (`stock-ajustar-minimo-error`).
- [x] Confirmar manda el PATCH del mínimo y recarga. (verificado por test: `src/modules/almacen/stock/StockPage.test.tsx` ""Ajustar mínimo": tras el PATCH se cierra el diálogo y se recarga la lista de componentes")

## Activar / desactivar

- [x] Sin confirmación; recarga. (verificado por test: `StockPage.test.tsx` "\"Ajustar mínimo\" hace el PATCH; \"Desactivar\" sin confirmación; \"Solicitar pieza\" hace el POST sin recargar")
- [x] En un compartido se desactiva todo el grupo, que baja al final atenuado (calco) (`stock-desactivar-compartido-antes`, `stock-desactivar-compartido-despues`).

## Solicitar pieza

- [x] Título "Solicitar pieza", subtítulo de componente, "Descripción (opcional)" con área de 3 filas y placeholder "Motivo o contexto de la solicitud...", botón "Solicitar" (`stock-solicitar-pieza`).
- [x] Sin validación; descripción vacía → nula; sin mensaje de éxito ni recarga (calco). (verificado por test: `StockPage.test.tsx` "\"Ajustar mínimo\" hace el PATCH; \"Desactivar\" sin confirmación; \"Solicitar pieza\" hace el POST sin recargar")

## Proveedores — tabla

- [x] Título "Proveedores", filtro "Proveedor", botón "Nuevo proveedor" (solo SUPERTECNICO), tabla y pie "Actualizado HH:mm" (`proveedores-supertecnico`).
- [x] Columnas Nombre, Divisa, Estado y Comentario; orden del servidor por nombre (`proveedores-supertecnico`).
- [x] Badge "Activo" verde / "Inactivo" gris; fila activa con borde izquierdo verde suave, inactiva sin opacidad (`proveedores-fila-seleccionada`) (inactiva no comparable: sin proveedores inactivos en la toma). (verificado por test: `src/modules/almacen/proveedores/ProveedoresPage.test.tsx` "badge "Activo" verde e "Inactivo" gris; la fila activa con borde verde y la inactiva sin opacidad")
- [x] Fila seleccionada navy (`proveedores-fila-seleccionada`).
- [x] TECNICO y ADMIN: sin botón ni menú (`proveedores-tecnico`, `proveedores-admin`).
- [x] Solo proveedores de componentes (`?tipo=COMPONENTES`).

## Proveedores — filtro

- [x] El desplegable ofrece solo los activos (`proveedores-filtro-abierto`).
- [x] Uno marcado: el botón dice su nombre (`proveedores-filtro-uno`).
- [x] Varios: "N proveedores" (`proveedores-filtro-varios`).
- [x] Sin "Limpiar filtros". (verificado por test: `ProveedoresPage.test.tsx` "el filtro solo ofrece activos, dice \"N proveedores\" con varios y filtra por nombre; vacío pinta \"Sin proveedores\"")
- [x] Tabla vacía por el filtro: "Sin proveedores" (`proveedores-vacio`) (no reproducible en la toma). (verificado por test: `src/modules/almacen/proveedores/ProveedoresPage.test.tsx` "tabla vacía por el filtro: el proveedor filtrado deja de venir tras recargar y se pinta "Sin proveedores"")

## Proveedores — menú

- [x] Sin pedidos: Desactivar, Editar, Borrar (`proveedores-menu-contextual-con-borrar`).
- [x] Con pedidos: solo Desactivar y Editar (`proveedores-menu-contextual-sin-borrar`).
- [x] Inactivo: "Activar" (`proveedores-menu-contextual-inactivo`) (no reproducible en la toma). (verificado por test: `ProveedoresPage.test.tsx` "menú del supertécnico: Desactivar/Editar y \"Borrar\" solo sin pedidos; \"Activar\" en el inactivo")
- [x] Activar/desactivar sin confirmación; recarga. (verificado por test: `src/modules/almacen/proveedores/ProveedoresPage.test.tsx` ""Desactivar"/"Activar": tras el PATCH recarga la lista")

## Proveedores — nuevo

- [x] Diálogo "Nuevo proveedor" con "Nombre del proveedor:" vacío (diferencia de estilo, ver arriba) (`proveedores-nuevo`).
- [x] Nombre en blanco: "El nombre no puede estar vacío." (diferencia, ver arriba). (verificado por test: `ProveedoresPage.test.tsx` "\"Nuevo proveedor\": nombre en blanco avisa (S5); con nombre hace el POST con tipo COMPONENTES y recarga")
- [x] Alta con el nombre recortado, tipo COMPONENTES y divisa EUR; recarga. (verificado por test: `src/modules/almacen/proveedores/ProveedoresPage.test.tsx` ""Nuevo proveedor": tras el POST cierra el diálogo y recarga")

## Proveedores — editar

- [x] Título "Editar proveedor" con el nombre en el subtítulo; Nombre, Divisa (combo navy con EUR y USD) y Comentario de 3 filas, precargados (`proveedores-editar`).
- [x] Nombre vacío: "El nombre no puede estar vacío." con el diálogo abierto (`proveedores-editar-error`).
- [x] Confirmar manda el PUT, cierra y recarga. (verificado por test: `src/modules/almacen/proveedores/ProveedoresPage.test.tsx` ""Editar": tras el PUT cierra el diálogo y recarga")

## Proveedores — borrar

- [x] Confirmación roja "Borrar proveedor" / "¿Eliminar el proveedor "`<nombre>`"?" con el botón "Borrar" (`proveedores-borrar-confirm`).
- [x] Confirmar manda el DELETE y recarga; un 409 se enseña como error de negocio (diferencia, ver arriba). (verificado por test: `src/modules/almacen/proveedores/ProveedoresPage.test.tsx` ""Borrar": tras el DELETE recarga la lista")

## Campana

- [x] "Ver Stock Completo" cierra el panel y abre Stock actual; conserva los filtros de la caché, como `irAStockActual()` (`campana-ver-stock-completo`).
- [x] "→ Ir a pedidos" abre `/stock/pedidos` (`campana-ir-a-pedidos`).
- [x] Los botones de pedir de la campana siguen deshabilitados hasta 4b (`campana-panel-alertas`).

## CSV

- [x] Stock: `stock_actual_<fecha>_<hora>.csv` con `Tipo;Stock;Stock mínimo;Estado;En camino;Fecha registro`, filas filtradas en el orden de pantalla, tipo sin sufijo (`stock-csv`).
- [x] Proveedores: `proveedores_<fecha>_<hora>.csv` con `ID;Nombre;Activo` ("Sí"/"No"), filas filtradas (`proveedores-csv`).

## Refresco y errores

- [x] Refresco cada 60 s (5 s con el banner de conexión), solo de la pestaña visible. (verificado por test: `src/modules/almacen/stock/StockPage.test.tsx` "el refresco de 60 s solo recarga la pestaña visible: componentes sí, proveedores no")
- [x] Congelado con un menú, el filtro o un diálogo abiertos. (verificado por test: `useInteraccionesAbiertas.test.tsx` "marcar(true) dos veces y marcar(false) una deja una abierta"; en la web, `StockPage.test.tsx` "con un diálogo abierto el sondeo se congela")
- [x] Sin conexión: banner amarillo, sin ventana de error (`stock-banner-sin-conexion`: no reproducible en el JavaFX; simulado en la web).
- [x] Fallo de la cantidad en camino: el gráfico por SKU conserva lo anterior y se avisa por el mapeo común. (verificado por test: `StockPage.test.tsx` "si falla la cantidad en camino, el gráfico por SKU conserva el anterior (título incluido) y avisa")
- [x] Errores de "Solicitar pieza" con el diálogo abierto. (verificado por test: `src/modules/almacen/stock/StockPage.test.tsx` "un error de "Solicitar pieza" (403) deja el diálogo abierto y avisa con el mensaje mapeado")
