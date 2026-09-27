# Ficha de paridad — Gestionar técnicos (RegisterView.fxml + RegisterController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), la ventana "Gestión de técnicos" que abre "Gestionar técnicos" del menú de usuario (`MainController`), con `RegisterView.fxml` y `RegisterController`. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-26-web-gestion-design.md` (§6.1 y §10).

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `gestion/gestion-tecnicos-{vacio-formulario,tabla,fila-seleccionada,tooltip-desactivar,tooltip-activar,combo-rol,dup-tecnico,dup-usuario,error-vacios,error-no-coinciden,error-corta,error-409-admin,alta-ok,desactivado,no-se-puede-eliminar,confirmar-eliminar,error-eliminar,tabla-vacia,login-inactivo,tras-cerrar}.png` y `gestion/gestion-menu-usuario-admin.png`. Las de la web llevan el prefijo `web-`. Las situaciones que no se puedan reproducir en la toma se anotan como tales y se comprueban con la web o por test.

Los ejemplos de técnico ("tecnico-a") y de usuario ("usuario-a") son sintéticos.

## Diferencias deliberadas respecto al JavaFX

Las de la spec §10:

- **Página del shell** `/gestion/tecnicos` con la guarda `RequiereAdmin` (G2), en vez de la ventana modal "Gestión de técnicos"; sin título de ventana. El resto de roles recibe el aviso de permisos y vuelve a `/reparaciones`.
- **"Cerrar" vuelve a la vista desde la que el menú abrió la página** (`volverA`), o a `/reparaciones` si se entró por URL; equivale a cerrar la ventana.
- **Validaciones también en el servidor** (G1): el alta responde 422 "Todos los campos son obligatorios.", "La contraseña debe tener al menos 6 caracteres.", "El nombre de usuario no puede superar 50 caracteres.", "El nombre del técnico no puede superar 100 caracteres." y "Rol no permitido."; los duplicados siguen siendo 409; un `idTec` inexistente es 404 "Técnico no encontrado.". El JavaFX no los ve porque valida antes.
- **Borrar un técnico con cualquier referencia** (reparaciones propias, asignadas por él, entregas de glass, revisiones, envíos, devoluciones, solicitudes de stock o movimientos de teléfonos) da el aviso "No se puede eliminar", y si la comprobación y el borrado se cruzan, el `DELETE` responde 409 `"{nombre}" tiene reparaciones asociadas.` sin borrar nada (G8). En el JavaFX solo miraba `Reparacion.ID_TEC` y el borrado acababa en "Error al eliminar el técnico." (500 por integridad).
- **Diálogos nativos → propios** (G9): "No se puede eliminar" es un `mostrarAviso` y "Eliminar técnico" un `ConfirmDialog` con los botones "Eliminar" y "Cancelar".
- **Línea de error inline que se vacía al empezar cada acción** (registrar, candado, papelera) y que muestra el `message` del servidor en 404/409/422 (G9); el JavaFX deja el último error hasta un alta correcta y usa textos fijos.
- **Sin ordenación por cabecera** (G10).
- **Toda escritura con éxito invalida las listas de usuarios y de técnicos** de toda la web: los combos de técnicos del resto de vistas ven altas y bajas (equivale a la recarga de la vista de fondo al cerrar el modal del JavaFX).
- **"Registrar técnico" no se envía dos veces y lleva clave de reintento** (web 0.8.5): un doble clic registra una sola vez, y repetir el alta con el mismo formulario tras un fallo reutiliza la clave, así que el servidor no duplica el técnico; al cambiar un campo o tras un alta correcta, clave nueva. En el JavaFX la llamada bloqueaba la ventana (verificado por test: `TecnicosPage.cerrojo.test.tsx` "dos clics seguidos en \"Registrar técnico\" registran una sola vez", `TecnicosPage.test.tsx` "alta con Idempotency-Key: …").

Decididas durante la ejecución y la comparación de capturas: se añaden aquí, cada una con la decisión del usuario.

- **La fila seleccionada se conserva tras recargar la tabla** (alta o candado); el JavaFX la pierde al recargar (decisión del usuario 2026-09-26, aceptada).
- **El ojo de las contraseñas del login y del diálogo de contraseña conserva la proporción del icono** (18 px de alto, ancho automático), como el `ImageView` con `preserveRatio` del JavaFX; antes salía estrujado (decisión del usuario 2026-09-26, corregido).

## Calcos

- Tres nombres para la misma pantalla: "Gestión de usuarios" en la cabecera y "Gestionar técnicos" en el menú (el título de ventana "Gestión de técnicos" no existe en la web).
- "Registrar técnico" aunque el rol elegido sea SUPERTECNICO; roles en mayúsculas; sin ADMIN en el combo.
- Papelera en todas las filas, sin tooltip.
- Sin mensaje de éxito al registrar.
- El error en vivo de duplicados se calcula contra la lista cargada, que no incluye ADMIN: "admin" pasa en vivo y lo frena el 409 del servidor.
- La confirmación vacía cae en "Las contraseñas no coinciden."; las contraseñas no se recortan.
- Enter no registra; "Cerrar" cierra sin preguntar aunque haya texto.
- El log de actividad del usuario eliminado se borra con él (G8).
- Sin CSV: "Descargar CSV" queda deshabilitado en esta ruta (`RegisterController` no implementa `Exportable`).
- Sin filtros, sin sondeo y sin "Actualizado".

## Pendiente de decidir

Cerrado con la comparación de capturas (decisión del usuario 2026-09-26):

- Placeholder de la tabla vacía: "Tabla sin contenido" (fijado con la captura del JavaFX).
- Columna de acciones: calcada. Absorbe todo el ancho sobrante, como la `FLEX_LAST_COLUMN` del JavaFX (`ajuste="ultima"` de `DataTable`), con el candado y la papelera centrados en ella.

## Ruta y acceso

- [x] "Gestionar técnicos" del menú (solo ADMIN) abre `/gestion/tecnicos` (`gestion-menu-usuario-admin`).
- [x] TECNICO y SUPERTECNICO por URL: aviso de permisos y vuelta a `/reparaciones` (cubierto por test `modules/gestion/rutas.test.tsx`).

## Cabecera

- [x] Logo `logo_inicio_sesion.png` de 46 px, "Gestión de usuarios" (18 px negrita azul medio) y "Registra o elimina accesos al sistema" (12 px azul gris); fondo de página `#EFEFEF`; padding lateral 48 px (`gestion-tecnicos-vacio-formulario`).

## Formulario de alta

- [x] Fila de cuatro campos a partes iguales, etiqueta 11 px negrita azul gris encima, campo blanco con borde `#D4D8DE`, radio 8, padding 10/12: "Nombre del técnico" ("Nombre visible en reparaciones"), "Nombre de usuario" ("Credencial de login"), "Contraseña" ("Contraseña", sin ojo), "Confirmar" ("Repite la contraseña") (`gestion-tecnicos-vacio-formulario`).
- [x] Fila de acción: línea de error (11 px rojo, ocupa su hueco vacía) · combo de 130 px "TECNICO" / "SUPERTECNICO" con TECNICO por defecto · botón navy "Registrar técnico" en píldora de radio 24 (`gestion-tecnicos-combo-rol`).
- [x] Separador `#D4D8DE` bajo el formulario (`gestion-tecnicos-vacio-formulario`).

## Duplicados en vivo

- [x] "Ya existe un técnico con ese nombre." bajo el primer campo (10 px rojo) al escribir un nombre existente con otras mayúsculas o espacios; "Registrar técnico" deshabilitado (`gestion-tecnicos-dup-tecnico`).
- [x] "Ese nombre de usuario ya existe." bajo el segundo campo, igual (`gestion-tecnicos-dup-usuario`).

## Validación y guardado

- [x] Nombres o contraseña vacíos (nombres con trim): "Todos los campos son obligatorios." (`gestion-tecnicos-error-vacios`).
- [x] Contraseña distinta de la confirmación: "Las contraseñas no coinciden." (`gestion-tecnicos-error-no-coinciden`).
- [x] Menos de 6 caracteres: "La contraseña debe tener al menos 6 caracteres." (`gestion-tecnicos-error-corta`).
- [x] Un 409 o 422 del servidor pinta su mensaje en la línea; p. ej. usuario "admin": "Ese nombre de usuario ya existe." (`gestion-tecnicos-error-409-admin`).
- [x] Otro error: "Error al registrar. Inténtalo de nuevo." (no reproducible en producción; cubierto por test `modules/gestion/tecnicos/TecnicosPage.test.tsx`).
- [x] Éxito: los cuatro campos vacíos, combo en TECNICO, línea vacía y la fila nueva en su sitio alfabético, sin mensaje (`gestion-tecnicos-alta-ok`).

## Tabla "Técnicos registrados"

- [x] Título "Técnicos registrados" (13 px negrita); columnas Técnico (160), Usuario (130), Rol (110, tal cual), Estado (90) y acciones sin cabecera que absorbe el resto; orden del servidor (nombre de técnico); filas de 35 px (`gestion-tecnicos-tabla`).
- [x] Badge "Activo" `#2E7D32` sobre `#D4EDDA` e "Inactivo" `#B03040` sobre `#F5E6E6`, radio 10, padding 3/10, 11 px negrita (`gestion-tecnicos-tabla`).
- [x] Candado `Unlock.png` 18 px en activos con tooltip "Desactivar acceso" y `Lock.png` en inactivos con "Activar acceso" (`gestion-tecnicos-tooltip-desactivar`, `gestion-tecnicos-tooltip-activar`; la captura de la web no pinta el `title` nativo: el texto lo cubre el test `modules/gestion/tecnicos/columnas.test.tsx`).
- [x] Papelera `borrar.png` 22 px en todas las filas (`gestion-tecnicos-tabla`).
- [x] Fila seleccionada navy con texto claro; badge e iconos sin cambiar (`gestion-tecnicos-fila-seleccionada`).
- [x] Tabla vacía: "Tabla sin contenido" (`gestion-tecnicos-tabla-vacia`: no reproducible en producción; cubierto por test `modules/gestion/tecnicos/TecnicosPage.test.tsx`).
- [x] Error de carga: "Error al cargar los usuarios." en la línea inline y la tabla vacía (no reproducible en producción; cubierto por test `modules/gestion/tecnicos/TecnicosPage.test.tsx`).

## Activar y desactivar

- [x] Clic en el candado, sin confirmación: cambia el badge y el candado y recarga (`gestion-tecnicos-desactivado`).
- [x] Error: "Error al cambiar el estado del técnico." en la línea, o el mensaje del servidor si es 404 (no reproducible en producción; cubierto por test `modules/gestion/tecnicos/TecnicosPage.test.tsx`).
- [x] Un técnico desactivado no puede iniciar sesión (`gestion-tecnicos-login-inactivo`; mensaje del login, sin cambios en este sub-proyecto).

## Eliminar

- [x] Con referencias: aviso "No se puede eliminar" con `"{nombre}" tiene reparaciones asociadas.`, "No es posible eliminarlo para conservar el historial." y "Puedes desactivarlo para bloquear su acceso." en tres líneas (`gestion-tecnicos-no-se-puede-eliminar`).
- [x] Sin referencias: confirmación "Eliminar técnico" con `¿Eliminar a "{nombre}" definitivamente?` y "Se borrarán sus credenciales de acceso y su registro de técnico.", botones "Eliminar" y "Cancelar" (`gestion-tecnicos-confirmar-eliminar`).
- [x] Error al comprobar: "Error al comprobar las reparaciones del técnico." (no reproducible en producción; cubierto por test `modules/gestion/tecnicos/TecnicosPage.test.tsx`).
- [x] Error al borrar: el mensaje del servidor si es 404 o 409, si no "Error al eliminar el técnico." (`gestion-tecnicos-error-eliminar`: en la web el caso de la captura sale como aviso "No se puede eliminar", ver diferencias).

## Pie

- [x] "Cerrar" (estilo enlace, 12 px azul gris) vuelve a la vista de origen, que muestra ya el técnico nuevo en sus combos (`gestion-tecnicos-tras-cerrar`; las capturas de la web no llegan al pie: "Cerrar" lo cubre el test `modules/gestion/tecnicos/TecnicosPage.test.tsx`).

## Comprobado por tests

Lo que no se ve en una captura o no se puede provocar en la toma:

- [x] Los cinco 422 del alta en su orden, los nombres guardados recortados, los dos 409 y el 201 con log `CREAR_USUARIO` (`UsuarioControllerTest`).
- [x] 404 de activar, desactivar, comprobar y eliminar; 409 del borrado con referencias sin borrar; `idUsu` resuelto desde `idTec` e ignorado (`UsuarioControllerTest`).
- [x] Cada una de las nueve referencias hace `true` y ninguna `false` (`UsuarioDAOReferenciasTest`).
- [x] `POST`/`DELETE /api/tecnicos` responden 403 a TECNICO y SUPERTECNICO (`RolesUsuarioTecnicoTest`).
- [x] Orden y textos de la validación de la web y duplicados en vivo (`modules/gestion/tecnicos/validacion.test.ts`).
- [x] Solo ADMIN (`modules/gestion/rutas.test.tsx`); formulario, alta con limpieza y recarga, 409/422 inline, candado, aviso, confirmación, errores del borrado, textos fijos, invalidaciones y "Cerrar" con `volverA` (`modules/gestion/tecnicos/TecnicosPage.test.tsx`, `columnas.test.tsx`, `api.test.ts`).
- [x] Recorrido completo contra producción: alta, candado, log, contraseña y borrado (`tests/e2e/gestion.spec.ts`).
