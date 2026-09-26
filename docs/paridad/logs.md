# Ficha de paridad — Ver logs (LogView.fxml + LogController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), la ventana "Log de actividad" que abre "Ver logs" del menú de usuario (`MainController`), con `LogView.fxml` y `LogController`. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-26-web-gestion-design.md` (§6.2 y §10).

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `gestion/gestion-logs-{inicial,maximizada,fila-seleccionada,popup-accion,popup-accion-filtrado,filtro-accion,popup-tecnico,fechas,fechas-madrugada,buscador,vacio,detalle,detalle-motivo,detalle-largo,orden-cabecera,error}.png` y `gestion/gestion-menu-usuario-{admin,supertecnico}.png`. Las de la web llevan el prefijo `web-`. Las situaciones que no se puedan reproducir en la toma se anotan como tales y se comprueban con la web o por test.

Los ejemplos de usuario ("usuario-a") y de IMEI (`000000000000000`) son sintéticos.

## Diferencias deliberadas respecto al JavaFX

Las de la spec §10:

- **Página del shell** `/gestion/logs` con la guarda `RequiereAdmin` (G2), en vez de una ventana independiente no modal; para tenerla al lado de otra vista se abre en otra pestaña del navegador.
- **"Cerrar" vuelve a la vista desde la que el menú abrió la página** (`volverA`), o a `/reparaciones` si se entró por URL.
- **Las 1.000 entradas más recientes** (G3): la web pide `limite=1000` y, si llegan exactamente 1.000, avisa "Mostrando los 1.000 registros más recientes; acota con los filtros."; el JavaFX descarga el log entero en cada cambio de filtro.
- **Lista de acciones real y alfabética** (G4), de `GET /api/logs/acciones`; el JavaFX usa 56 códigos agrupados a mano (le faltan unos 40 de los que escribe el servidor y sobran 3 que ya no se generan).
- **Filtro de fechas en hora de Madrid** (G5): lo ocurrido entre las 00:00 y las 01:59 ya no cae en el día anterior; corrige también al JavaFX.
- **Barra de filtros con salto de línea y el estilo estándar de la web** (el JavaFX no carga `app.css` en esa ventana).
- **"Acción..." y "Técnico..." como `CampoAutocompletar`** (teclado y Enter), en vez del `Popup` con `ListView` (G10).
- **Sin ordenación por cabecera** (G10); el JavaFX ordenaba la fecha como texto `dd/MM/yyyy`.
- **Fallo de carga** con "Error al cargar los logs: …" en el diálogo de error y la tabla conservando lo que tenía, salvo sesión caducada y sin conexión, que siguen la política general (banner y login).

Decididas durante la ejecución y la comparación de capturas: se añaden aquí, cada una con la decisión del usuario.

- **El aviso "Mostrando los 1.000 registros más recientes; acota con los filtros." depende de las filas recibidas del servidor, no de las que deja el buscador**: puede verse con pocas filas o con "Tabla sin contenido", porque el buscador solo mira esas 1.000 (decisión del usuario 2026-09-26, aceptada).
- **"Acción..." y "Técnico..." abren la lista al enfocarlos o pulsarlos**, sin teclear, y la lista es más ancha que el campo (mínimo 250 px) para leer los códigos enteros, como el `Popup` del JavaFX (decisión del usuario 2026-09-26, calcado).
- **Ancho de "Detalle"**: reparto proporcional de las cuatro columnas (`ajuste="estirar"`), equivalente al del JavaFX maximizado (decisión del usuario 2026-09-26, aceptada).
- **La ventana no modal del JavaFX sobrevive a "Cerrar Sesión"; la página de la web no**, consecuencia de ser una página del shell (G2) (decisión del usuario 2026-09-26, aceptada).

## Calcos

- El buscador no mira el motivo ni la fecha; el motivo solo se ve con el doble clic.
- "Técnico..." lista los nombres de usuario de TECNICO y SUPERTECNICO, activos e inactivos, sin ADMIN.
- Los filtros no sobreviven a salir de la página: al volver, vacíos.
- Con "Desde" posterior a "Hasta" la tabla queda vacía sin aviso.
- Sin colores por acción, sin menú contextual, sin sondeo, sin "Actualizado" y sin CSV ("Descargar CSV" deshabilitado en esta ruta).
- Un fallo al cargar la lista de acciones o de usuarios deja el autocompletar vacío, sin aviso.

## Pendiente de decidir

Cerrado con la comparación de capturas (decisión del usuario 2026-09-26):

- Placeholder de la tabla vacía: "Tabla sin contenido", el mismo que en técnicos (fijado con la captura `gestion-logs-vacio`).

## Ruta y acceso

- [x] "Ver logs" del menú (solo ADMIN) abre `/gestion/logs`; SUPERTECNICO y TECNICO no tienen el ítem (`gestion-menu-usuario-admin`, `gestion-menu-usuario-supertecnico`) y por URL reciben el aviso de permisos.

## Cabecera

- [x] Logo de 46 px, "Log de actividad" y "Registro de acciones realizadas en el sistema"; separador (`gestion-logs-inicial`).

## Barra de filtros

- [x] En este orden: "Buscar..." (220 px), "Acción..." (150 px), "Técnico..." (150 px), "Desde:" / "Hasta:" y "Limpiar filtros" (`gestion-logs-inicial`).
- [x] "Buscar...": contiene, sin mayúsculas y con trim, sobre usuario, acción y detalle; se conserva al recargar (`gestion-logs-buscador`).
- [x] "Acción...": lista completa y filtrada al teclear; elegir filtra en el servidor por igualdad; borrar el texto quita el filtro (`gestion-logs-popup-accion`, `gestion-logs-popup-accion-filtrado`, `gestion-logs-filtro-accion`; la apertura al enfocar y el ancho de la lista, corregidos tras la toma, los cubre el test `modules/gestion/logs/LogsPage.test.tsx`).
- [x] "Técnico...": nombres de usuario en orden natural, sin ADMIN (`gestion-logs-popup-tecnico`; la apertura al enfocar la cubre el test `modules/gestion/logs/LogsPage.test.tsx`).
- [x] "Desde:" / "Hasta:" inclusivos en hora de Madrid (`gestion-logs-fechas`, `gestion-logs-fechas-madrugada`: diferencia, ver arriba; sin actividad de madrugada en la toma, el caso lo cubre el test `LogDAOFiltroTest`).
- [x] "Limpiar filtros" vacía los cinco con una sola recarga (cubierto por test `modules/gestion/logs/LogsPage.test.tsx`).

## Aviso de tope

- [x] Con 1.000 filas exactas, bajo la barra: "Mostrando los 1.000 registros más recientes; acota con los filtros." (sin captura del JavaFX: diferencia; se ve en `web-gestion-logs-inicial` y lo cubre el test `modules/gestion/logs/LogsPage.test.tsx`).

## Tabla

- [x] Fecha (150; `dd/MM/yyyy HH:mm:ss` en hora de Madrid), Usuario (80; nombre de login), Acción (180; el código tal cual), Detalle (el resto, una línea con elipsis); orden del servidor, fecha y desempate por id descendentes (`gestion-logs-inicial`, `gestion-logs-maximizada`).
- [x] Fila seleccionada navy con texto claro (`gestion-logs-fila-seleccionada`).
- [x] Sin ordenación por cabecera (`gestion-logs-orden-cabecera`: diferencia, ver arriba).
- [x] Tabla vacía: "Tabla sin contenido" (`gestion-logs-vacio`).

## Detalle

- [x] Doble clic en una fila: "Detalle del log" con el detalle de solo lectura y "Copiar" (`gestion-logs-detalle`).
- [x] Con motivo: línea en blanco y "MOTIVO: …" debajo del detalle (`gestion-logs-detalle-motivo`; la captura de la web se tomó sobre un registro sin motivo, que equivale a `gestion-logs-detalle-sin-motivo`: la línea del motivo la cubre el test `modules/gestion/logs/LogsPage.test.tsx`).
- [x] Detalle largo con ajuste de línea y scroll (`gestion-logs-detalle-largo`).

## Pie y errores

- [x] "Actualizar" (navy) recarga con los filtros actuales; "Cerrar" vuelve a la vista de origen (cubierto por test `modules/gestion/logs/LogsPage.test.tsx`).
- [x] Fallo de carga: "Error al cargar los logs: …" conservando la tabla (`gestion-logs-error`: diferencia de presentación, ver arriba; no reproducible en producción; cubierto por test `modules/gestion/logs/LogsPage.test.tsx`).

## Comprobado por tests

Lo que no se ve en una captura o no se puede provocar en la toma:

- [x] `limite` opcional, 422 "Límite no válido (debe estar entre 1 y 5000)." fuera de rango, `GET /api/logs/acciones` solo ADMIN (`LogControllerTest`).
- [x] Límites de día en Madrid convertidos a UTC en verano e invierno y orden con desempate (`LogDAOFiltroTest`).
- [x] Ruta nueva, `limite` y los nulos de `LogActividad` en el contrato (`OpenApiContractTest`).
- [x] Los nueve casos de `coincideTexto` portados del cliente y `queryLogs` sin vacíos (`modules/gestion/logs/filtros.test.ts`).
- [x] Filtros de servidor y de memoria, aviso de tope, doble clic con y sin motivo, "Actualizar", "Limpiar filtros" con una sola carga y error conservando los datos (`modules/gestion/logs/LogsPage.test.tsx`, `columnas.test.tsx`, `api.test.ts`).
- [x] `CREAR_USUARIO` del día filtrando por acción y fechas contra producción, buscador y detalle (`tests/e2e/gestion.spec.ts`).
