# Fichas de paridad

Una ficha por vista del cliente JavaFX. Se escribe antes de construir la vista web y es su criterio de aceptación:
la vista no se da por hecha hasta cumplir cada punto. Las capturas de referencia del JavaFX (con datos reales)
viven fuera del repo, en documentación privada, carpeta `<vista>/`, y se citan por nombre.
Plantilla: roles · sub-vistas · columnas · filtros · acciones y confirmaciones · badges y colores (token) ·
textos · CSV · refresco · reglas de negocio (spec de origen y dónde viven) · diferencias inevitables aceptadas.

Regla para marcar una casilla (aprendida en la auditoría de sustitución, 2026-09-27): una casilla sobre **comportamiento**
(qué hace la vista al pulsar, recargar, fallar o salir) solo se marca con la cita del código del JavaFX que lo respalda
(fichero y línea en `hotfix/0.16.3`), además de la captura o el test. Una captura enseña el estado de un momento y un test
comprueba lo que hace la web, pero ninguno de los dos prueba que el JavaFX haga lo mismo; sin la cita, la casilla se queda
sin marcar o se anota como diferencia.
