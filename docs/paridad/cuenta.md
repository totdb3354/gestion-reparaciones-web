# Ficha de paridad — Cambiar contraseña (CambiarPasswordView.fxml + CambiarPasswordController)

Referencia: línea hotfix del cliente JavaFX (`hotfix/0.16.3`, la que usa la tienda), la ventana modal "Cambiar contraseña" que abre el ítem del mismo nombre del menú de usuario (`MainController`), con `CambiarPasswordView.fxml` y `CambiarPasswordController`. El menú de usuario y el login se siguen en `shell.md`. Spec de este sub-proyecto: raíz `docs/superpowers/specs/2026-09-26-web-gestion-design.md` (§6.3, §6.4 y §10).

Capturas de referencia (documentación privada, fuera del repo; llevan datos reales del taller y se citan solo por nombre): `gestion/gestion-password-{vacia,ojo,error-vacios,error-corta,error-no-coinciden,error-actual,exito,sin-conexion,enter-esc,sesion-caducada}.png` y `gestion/gestion-menu-usuario-{admin,tecnico,supertecnico}.png`. Se toman con un usuario de prueba creado para ello, nunca uno real. Las de la web llevan el prefijo `web-`.

Las contraseñas de los ejemplos ("secreta1", "nueva123") son sintéticas.

## Diferencias deliberadas respecto al JavaFX

Las de la spec §10:

- **Enter guarda y Esc cierra** (inocua); en el JavaFX no hacen nada (`gestion-password-enter-esc`).
- **Validación también en el servidor** (G1): `PATCH /api/auth/cambiar-password` responde 422 "Rellena todos los campos." y "La contraseña debe tener al menos 6 caracteres." (antes, 400 sin cuerpo); el JavaFX no los ve porque valida antes.
- **Diálogo propio de la web** (sin el marco de ventana del sistema) y aviso de éxito con `mostrarAviso`.

Decididas durante la ejecución y la comparación de capturas: se añaden aquí, cada una con la decisión del usuario.

## Calcos

- Diálogo encima de la vista actual, sin navegar (G6): la vista de fondo se conserva.
- Placeholder "Confirmar contraseña" distinto de su etiqueta "Confirmar nueva contraseña".
- Sin trim en las contraseñas.
- "Cancelar" cierra sin preguntar.
- Tras el cambio, la sesión sigue igual (no se cierra ni se renueva).
- Sin CSV.

## Pendiente de decidir

- Título del aviso de éxito: previsto "Información"; se fija con `gestion-password-exito`.

## Menú

- [ ] "Cambiar contraseña" en el menú de los tres roles, entre "Descargar CSV" y el separador de "Cerrar Sesión" (`gestion-menu-usuario-admin`, `gestion-menu-usuario-tecnico`, `gestion-menu-usuario-supertecnico`).
- [ ] Abre el diálogo sin cambiar de ruta.

## Diálogo

- [ ] 380 px; barra superior navy `#001232` con "Cambiar contraseña" (15 px negrita blanco, padding 16/20); cuerpo blanco con padding 24 y separación 16 (`gestion-password-vacia`).
- [ ] Tres campos con etiqueta 11 px negrita `#555`: "Contraseña actual" (placeholder "Contraseña actual"), "Nueva contraseña" ("Nueva contraseña") y "Confirmar nueva contraseña" ("Confirmar contraseña"); foco inicial en la actual (`gestion-password-vacia`).
- [ ] Ojo independiente por campo (`ojo_activar` / `ojo_desactivar`, 18 px) que muestra y oculta el texto (`gestion-password-ojo`).
- [ ] Botones a la derecha: "Cancelar" (blanco, borde `#C2C8D0`, radio 6) y "Guardar" (navy, negrita, radio 6).

## Validación

- [ ] Línea de error `#CC0000` 12 px, oculta hasta que hay error.
- [ ] Alguno vacío: "Rellena todos los campos." (`gestion-password-error-vacios`).
- [ ] Nueva de menos de 6: "La contraseña debe tener al menos 6 caracteres." (`gestion-password-error-corta`).
- [ ] Nueva distinta de la confirmación: "Las contraseñas nuevas no coinciden." (`gestion-password-error-no-coinciden`).

## Guardado

- [ ] "Guardar" deshabilitado mientras responde el servidor.
- [ ] Actual incorrecta: "Contraseña actual incorrecta." (422 del servidor) en la línea, sin vaciar los campos (`gestion-password-error-actual`).
- [ ] Éxito: se cierra el diálogo y sale el aviso "Contraseña cambiada correctamente." (`gestion-password-exito`).
- [ ] Sin conexión: banner y el mensaje de la web para ese error (`gestion-password-sin-conexion`).
- [ ] Sesión caducada: flujo global de sesión caducada, vuelta al login (`gestion-password-sesion-caducada`).

## Comprobado por tests

- [ ] 204 con log `CAMBIAR_PASSWORD`, 422 con campos vacíos, 422 con la nueva corta y 422 con la actual incorrecta (`AuthControllerCambiarPasswordTest`).
- [ ] Orden y textos de la validación sin trim (`modules/gestion/cuenta/validacion.test.ts`).
- [ ] Validación, ojo por campo, envío, éxito con aviso y cierre, 422 inline y botón deshabilitado (`modules/gestion/cuenta/CambiarPasswordDialog.test.tsx`, `api.test.ts`).
- [ ] El diálogo se abre desde el menú sin navegar (`app/shell/TopBar.test.tsx`).
- [ ] Cambio real y vuelta a la contraseña original de un usuario de prueba contra producción (`tests/e2e/gestion.spec.ts`).
