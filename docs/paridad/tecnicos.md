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

Decididas durante la ejecución y la comparación de capturas: se añaden aquí, cada una con la decisión del usuario.

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

- Placeholder de la tabla vacía: previsto "No hay contenido en la tabla" (texto por defecto del `TableView`); se fija con `gestion-tecnicos-tabla-vacia` o, si no es reproducible, con la JVM del JavaFX.
- Columna de acciones: la web la deja en 80 px y el sobrante va a la columna de relleno de `DataTable`; en el JavaFX la última columna absorbe el resto (`FLEX_LAST_COLUMN`, spec §6.1). Se acepta como diferencia o se le da el sobrante, según `gestion-tecnicos-tabla`.

## Ruta y acceso

- [ ] "Gestionar técnicos" del menú (solo ADMIN) abre `/gestion/tecnicos` (`gestion-menu-usuario-admin`).
- [ ] TECNICO y SUPERTECNICO por URL: aviso de permisos y vuelta a `/reparaciones`.

## Cabecera

- [ ] Logo `logo_inicio_sesion.png` de 46 px, "Gestión de usuarios" (18 px negrita azul medio) y "Registra o elimina accesos al sistema" (12 px azul gris); fondo de página `#EFEFEF`; padding lateral 48 px (`gestion-tecnicos-vacio-formulario`).

## Formulario de alta

- [ ] Fila de cuatro campos a partes iguales, etiqueta 11 px negrita azul gris encima, campo blanco con borde `#D4D8DE`, radio 8, padding 10/12: "Nombre del técnico" ("Nombre visible en reparaciones"), "Nombre de usuario" ("Credencial de login"), "Contraseña" ("Contraseña", sin ojo), "Confirmar" ("Repite la contraseña") (`gestion-tecnicos-vacio-formulario`).
- [ ] Fila de acción: línea de error (11 px rojo, ocupa su hueco vacía) · combo de 130 px "TECNICO" / "SUPERTECNICO" con TECNICO por defecto · botón navy "Registrar técnico" en píldora de radio 24 (`gestion-tecnicos-combo-rol`).
- [ ] Separador `#D4D8DE` bajo el formulario.

## Duplicados en vivo

- [ ] "Ya existe un técnico con ese nombre." bajo el primer campo (10 px rojo) al escribir un nombre existente con otras mayúsculas o espacios; "Registrar técnico" deshabilitado (`gestion-tecnicos-dup-tecnico`).
- [ ] "Ese nombre de usuario ya existe." bajo el segundo campo, igual (`gestion-tecnicos-dup-usuario`).

## Validación y guardado

- [ ] Nombres o contraseña vacíos (nombres con trim): "Todos los campos son obligatorios." (`gestion-tecnicos-error-vacios`).
- [ ] Contraseña distinta de la confirmación: "Las contraseñas no coinciden." (`gestion-tecnicos-error-no-coinciden`).
- [ ] Menos de 6 caracteres: "La contraseña debe tener al menos 6 caracteres." (`gestion-tecnicos-error-corta`).
- [ ] Un 409 o 422 del servidor pinta su mensaje en la línea; p. ej. usuario "admin": "Ese nombre de usuario ya existe." (`gestion-tecnicos-error-409-admin`).
- [ ] Otro error: "Error al registrar. Inténtalo de nuevo.".
- [ ] Éxito: los cuatro campos vacíos, combo en TECNICO, línea vacía y la fila nueva en su sitio alfabético, sin mensaje (`gestion-tecnicos-alta-ok`).

## Tabla "Técnicos registrados"

- [ ] Título "Técnicos registrados" (13 px negrita); columnas Técnico (160), Usuario (130), Rol (110, tal cual), Estado (90) y acciones sin cabecera que absorbe el resto; orden del servidor (nombre de técnico); filas de 35 px (`gestion-tecnicos-tabla`).
- [ ] Badge "Activo" `#2E7D32` sobre `#D4EDDA` e "Inactivo" `#B03040` sobre `#F5E6E6`, radio 10, padding 3/10, 11 px negrita (`gestion-tecnicos-tabla`).
- [ ] Candado `Unlock.png` 18 px en activos con tooltip "Desactivar acceso" y `Lock.png` en inactivos con "Activar acceso" (`gestion-tecnicos-tooltip-desactivar`, `gestion-tecnicos-tooltip-activar`).
- [ ] Papelera `borrar.png` 22 px en todas las filas.
- [ ] Fila seleccionada navy con texto claro; badge e iconos sin cambiar (`gestion-tecnicos-fila-seleccionada`).
- [ ] Tabla vacía: el placeholder que se decida arriba (`gestion-tecnicos-tabla-vacia`).
- [ ] Error de carga: "Error al cargar los usuarios." en la línea inline y la tabla vacía.

## Activar y desactivar

- [ ] Clic en el candado, sin confirmación: cambia el badge y el candado y recarga (`gestion-tecnicos-desactivado`).
- [ ] Error: "Error al cambiar el estado del técnico." en la línea, o el mensaje del servidor si es 404.
- [ ] Un técnico desactivado no puede iniciar sesión (`gestion-tecnicos-login-inactivo`; mensaje del login, sin cambios en este sub-proyecto).

## Eliminar

- [ ] Con referencias: aviso "No se puede eliminar" con `"{nombre}" tiene reparaciones asociadas.`, "No es posible eliminarlo para conservar el historial." y "Puedes desactivarlo para bloquear su acceso." en tres líneas (`gestion-tecnicos-no-se-puede-eliminar`).
- [ ] Sin referencias: confirmación "Eliminar técnico" con `¿Eliminar a "{nombre}" definitivamente?` y "Se borrarán sus credenciales de acceso y su registro de técnico.", botones "Eliminar" y "Cancelar" (`gestion-tecnicos-confirmar-eliminar`).
- [ ] Error al comprobar: "Error al comprobar las reparaciones del técnico.".
- [ ] Error al borrar: el mensaje del servidor si es 404 o 409, si no "Error al eliminar el técnico." (`gestion-tecnicos-error-eliminar`: en la web el caso de la captura sale como aviso "No se puede eliminar", ver diferencias).

## Pie

- [ ] "Cerrar" (estilo enlace, 12 px azul gris) vuelve a la vista de origen, que muestra ya el técnico nuevo en sus combos (`gestion-tecnicos-tras-cerrar`).

## Comprobado por tests

Lo que no se ve en una captura o no se puede provocar en la toma:

- [ ] Los cinco 422 del alta en su orden, los nombres guardados recortados, los dos 409 y el 201 con log `CREAR_USUARIO` (`UsuarioControllerTest`).
- [ ] 404 de activar, desactivar, comprobar y eliminar; 409 del borrado con referencias sin borrar; `idUsu` resuelto desde `idTec` e ignorado (`UsuarioControllerTest`).
- [ ] Cada una de las nueve referencias hace `true` y ninguna `false` (`UsuarioDAOReferenciasTest`).
- [ ] `POST`/`DELETE /api/tecnicos` responden 403 a TECNICO y SUPERTECNICO (`RolesUsuarioTecnicoTest`).
- [ ] Orden y textos de la validación de la web y duplicados en vivo (`modules/gestion/tecnicos/validacion.test.ts`).
- [ ] Solo ADMIN (`modules/gestion/rutas.test.tsx`); formulario, alta con limpieza y recarga, 409/422 inline, candado, aviso, confirmación, errores del borrado, textos fijos, invalidaciones y "Cerrar" con `volverA` (`modules/gestion/tecnicos/TecnicosPage.test.tsx`, `columnas.test.tsx`, `api.test.ts`).
- [ ] Recorrido completo contra producción: alta, candado, log, contraseña y borrado (`tests/e2e/gestion.spec.ts`).
