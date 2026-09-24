# Ficha de paridad — Modal "Asignar trabajos" (PendientesSuperTecnicoController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), el modal "Asignar trabajos" de `PendientesSuperTecnicoController` (la vista del mismo controlador es el sub-proyecto 3a y no entra aquí). Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-22-web-asignar-trabajos-design.md`.

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `asignaciones/{modal-inicial,modal-inicial-abajo,modal-pegado-imeis,modal-cliente-popup,modal-selector-modelo,modal-detalle-completo,modal-lleva-glass,modal-asignados,modal-cola-glass,modal-cola-pulido,modal-imei-invalido,modal-cerrar-sin-guardar,modal-duplicado}.png`.

Los ejemplos de IMEI, técnico ("Técnico A") y cliente son sintéticos.

## Diferencias deliberadas respecto al JavaFX

Las seis de la spec §10:

- **Subtítulo corregido** (D6). *"Elige el tipo, escanea IMEIs y configúralos. Los técnicos se mantienen entre IMEIs. Se guardan todos al final."* El JavaFX dice que el comentario también se mantiene entre IMEIs, y no es cierto: no se arrastra.
- **El cliente inactivo de la BD se muestra también en Reparación y Glass** (D6). El JavaFX solo lo hacía en Pulido; aquí el selector de cliente de una entrada ofrece el inactivo que esa entrada ya tenga en BD, además de los activos.
- **Guardado atómico y con clave de idempotencia** (D1). El lote se guarda de una vez al final: un fallo real no deja nada a medias, y reintentar con la misma clave no duplica. El JavaFX manda una petición por asignación.
- **La predicción de la glass se calcula con la BD del momento** (D2), no con la tabla de carga de hasta 60 s de antigüedad que usaba el JavaFX.
- **Esc y clic fuera piden "Descartar"** con el número de IMEIs escaneados, en vez de cerrar sin más.
- **"Calculando…" y el aviso de predicción fallida** son nuevos: hay un paso por red (`POST /api/glass/prediccion`) que el JavaFX no tenía.

Decididas durante la ejecución:

- **El texto de ayuda del campo Modelo se calcula por entrada** ("Buscando…", "No encontrado — selecciona manualmente" o "Escribe modelo..." según el estado de esa entrada), y no es un valor global: en el JavaFX el último mensaje se queda pegado al cambiar de entrada aunque ya no aplique.
- **Una entrada verde sin modelo manda al guardar el modelo vivo del IMEI**, y "Asignar →"/"Guardar cambios" se deshabilita si no hay ninguno; el JavaFX mandaba `null` y dejaba que el servidor conservara el modelo ya guardado.
- **El cliente inactivo de una entrada se ofrece en el selector de esa misma entrada** (Task 15 / D6): el buscador no lo propone para las demás entradas ni para IMEIs nuevos, solo para la que ya lo tenía.

Aceptada como desviación de implementación: el toggle de colas, las pastillas de recuento y el badge Rep/Glass de cada fila son piezas propias del modal (`AsignarTrabajosDialog.tsx`, `FilaCola.tsx`), no `TogglePill`, `PildoraContador` ni `BadgeTipo` de `shared/ui`. `TogglePill` está construido sobre `NavLink` (navegación de ruta, no cambia de pestaña en un estado local) y `BadgeTipo` exige un `idRep` que las filas de Pulido no tienen.

Decididas en la comparación de capturas (todas aceptadas tal como está la web):

- **El combo de técnico de Pulido muestra "Nombre (P62%)" en todas partes**; el JavaFX pinta "Nombre ●62%" con el punto y el porcentaje coloreados en el desplegable abierto. `ComboNavy` solo admite texto.
- **El campo Cliente deshabilitado se queda vacío** (texto guía "Escribe cliente...") cuando no hay ninguna entrada cargada, por ejemplo justo después de "Asignar →"; el JavaFX sigue mostrando el último cliente en el campo gris. Los técnicos marcados sí se mantienen en ambos.
- **El título del aviso de conflictos es "Aviso"**; el JavaFX usa la alerta `WARNING` sin título propio.
- **El borde del recuadro de detalle y del textarea de comentario es `#D4D8DE`** (`borde-input`), algo más claro que el `#C2C8D0` del JavaFX.
- **Los dos combos de técnico de Pulido miden 344 px**; en el JavaFX llenan todo el ancho.

## Verificación

Marcada el 2026-09-24 con la web de la rama en local contra la API de producción: las 13 capturas `web-modal-*.png` tomadas en las mismas situaciones que las del JavaFX y comparadas una a una (documentación privada, junto a las de referencia), el smoke `tests/e2e/asignar.spec.ts` en verde contra producción, y la suite de la web (cada regla del inventario tiene su test, según la tabla de trazabilidad del plan).

## Cabecera y pestañas

- [x] Título "Asignar trabajos" y el subtítulo corregido (ver diferencias).
- [x] Toggle Reparación · Glass · Pulido, Reparación por defecto, sin poder deseleccionar.
- [x] Una pastilla por cola con el número de entradas: roja si hay alguna pendiente, gris si no.
- [x] Cambiar de pestaña vacía el detalle; las tres colas conservan lo escaneado.
- [x] Barra final con el progreso y el botón "Guardar (N)".

## Escaneo y pegado

- [x] Campo de escaneo solo de dígitos: a los 15 se añade sin pulsar Enter.
- [x] IMEI incompleto + Enter: sin mensaje y con los dígitos en el campo (calco).
- [x] Repetido en la cola activa: "Ese IMEI ya está en la cola (Reparación)." / "(Glass)".
- [x] El mismo IMEI puede estar a la vez en Reparación y en Glass.
- [x] Pegado: se trocea en bloques de 15; si no cuadra, "Algún IMEI del pegado está corrupto. Revisa que todos los IMEIs son válidos."
- [x] Pegado correcto: "N IMEIs añadidos." o "N IMEIs añadidos · M ya estaban en la lista." si había repetidos.
- [x] Pegado en Reparación y Glass no carga el detalle (calco, D6).
- [x] En Pulido el pegado sí selecciona la última fila añadida.

## Listas roja y verde

- [x] "Pendiente de asignar (N)" y "Asignados (N) · sin guardar", ordenadas de lo último escaneado a lo primero.
- [x] Cada fila: IMEI, badge Rep/Glass, pastilla de modelo (nombre traducido, "Buscando…" o "⚠ falta modelo") y una ✕.
- [x] En las filas verdes, además "auto" cuando aplica y los técnicos asignados.
- [x] La ✕ quita la entrada; quitar una reparación se lleva su glass asociada.

## Detalle

- [x] Panel derecho deshabilitado mientras no hay ninguna entrada cargada.
- [x] "IMEI en curso" con el IMEI de la entrada seleccionada, o "—" sin selección.
- [x] Los técnicos son pegajosos por cola (se recuerdan al marcarlos); comentario y chasis no se arrastran entre entradas.

## Modelo

- [x] Campo con autocompletado y lookup automático al cargar la entrada.
- [x] Una decisión manual del modelo se propaga a las dos colas del mismo IMEI y se recuerda para los IMEIs que se escaneen después.
- [x] El modelo decidido a mano se guarda al momento en segundo plano (calco, D3); errores de ese guardado se ignoran y el lote lo vuelve a mandar.
- [x] Sin modelo no encontrado por lookup: pastilla "⚠ falta modelo" y prompt "No encontrado — selecciona manualmente".

## Técnicos y duplicado

- [x] Cada técnico con su % de Pedidos; en la cola Glass, además la pastilla "glass" en los técnicos habilitados para ella.
- [x] Un técnico que ya tiene ese IMEI en esa categoría sale deshabilitado con "N asignado(s)".
- [x] "Asignar →" exige modelo y al menos un técnico marcado; en una entrada verde el botón dice "Guardar cambios".
- [x] En Pulido el combo de técnico no deshabilita a quien ya tiene el IMEI (calco, D4); el duplicado solo lo frena el guardado del lote.

## Cliente

- [x] Campo con autocompletado y el sentinel "— Sin cliente —".
- [x] Precedencia: decisión manual del IMEI → cliente del IMEI en BD → cliente pegajoso del modal (uno para todo el modal) → vacío.
- [x] Elegir un cliente en cualquier cola lo propaga a las demás entradas del mismo IMEI en las tres colas.
- [x] El cliente inactivo de la BD se ofrece también en Reparación y Glass, no solo en Pulido (diferencia, ver arriba).

## Glass automática

- [x] Casilla "Lleva glass" solo en Reparación; marcarla en una roja es solo intención hasta "Asignar →".
- [x] En una entrada verde, marcarla crea la glass y pide la predicción al momento.
- [x] La glass nace con el modelo y el cliente de la reparación, y sin comentario.
- [x] Mientras llega la predicción: "Calculando…"; con candidato: verde y "auto"; sin candidato o si falla: roja con el aviso.
- [x] Una glass "auto" se recalcula al reasignar la reparación; editarla a mano le quita "auto".
- [x] Quitar la reparación retira su glass, salvo que ya hubiera una glass abierta en BD.
- [x] Quitar la glass desmarca la casilla "Lleva glass" de la reparación.
- [x] "ya tiene glass: `<técnico>`" cuando hay glass abierta en BD para ese IMEI.

## Pulido

- [x] Combo "Técnico (se aplica a los IMEIs que escanees)" arriba del todo.
- [x] Lista "Nada añadido aún" o "N en pulido".
- [x] Cada fila: "`<técnico>` · `<cliente>`" o, sin técnico, "(sin técnico) · `<cliente>`" en rojo.
- [x] Detalle con técnico, cliente y comentario, sin botón de asignar (se aplica al momento).
- [x] Sin campo de modelo, sin chasis y sin "Lleva glass".
- [x] Sin bloqueo del duplicado al seleccionar (D4): solo lo frena el guardado del lote.

## Barra y Guardar

- [x] N = entradas verdes de Reparación y Glass + filas de Pulido.
- [x] "Guardar (N)" deshabilitado si hay alguna entrada roja, algún pulido sin técnico o N = 0.
- [x] Progreso: "N configurados · M pendientes", con " · K pulido" y " · J sin modelo" cuando corresponde.

## Guardado y conflictos

- [x] El cuerpo del lote se construye a partir del estado completo del modal (`lote.ts`).
- [x] La clave de idempotencia depende del cuerpo: mismo cuerpo, misma clave; si el lote cambia entre dos intentos, clave nueva.
- [x] Mientras se envía: "Guardando…", botón deshabilitado y el modal no se cierra.
- [x] Éxito: el modal se cierra, se refrescan la tabla y el contador del lateral.
- [x] Si hay conflictos: aviso "Algunas asignaciones no se crearon:" con una línea por conflicto, "• `<imei>` → `<técnico>` (ya asignado · `<categoría>`)" (calco del texto).
- [x] Fallo real: el modal sigue abierto con todo el lote; reintentar con la misma clave no duplica ni muestra conflictos falsos.

## Cerrar

- [x] Con entradas en alguna cola, la ✕, Esc o un clic fuera abren la confirmación "Descartar" con "Se descartarán los N IMEIs escaneados." (diferencia respecto al JavaFX, ver arriba).
- [x] Sin ninguna entrada en ninguna cola, se cierra directamente sin confirmación.
