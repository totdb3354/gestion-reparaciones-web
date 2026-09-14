# Ficha de paridad — Clientes (ClientesView.fxml / ClientesController, spec 2026-06-23-clientes-design.md)

Capturas: `Apuntes/paridad-capturas/clientes/{lista-supertecnico,lista-tecnico,menu-contextual,nuevo-cliente,editar-cliente,borrar-cliente}.png`.

- [ ] Roles: la ven los tres. Solo SUPERTECNICO escribe (`soloLectura = !esSuperTecnico`): sin "Nuevo cliente" ni menú contextual para TECNICO y ADMIN. El servidor ya protege con `hasRole('SUPERTECNICO')`.
- [ ] Título "Clientes" (24 px negrita azul medio) en la cabecera de la vista.
- [ ] Filtro multiselección por nombre: lista SOLO clientes activos; etiqueta "Cliente" / nombre único / "N clientes"; sin selección se muestran todos los clientes (activos e inactivos); con selección, solo los nombres marcados.
- [ ] Botón "Nuevo cliente" (`btn-primary`: navy, radio 24, 12 px negrita) solo SUPERTECNICO.
- [ ] Tabla: columnas "Nombre" y "Estado"; orden = el que devuelve `GET /api/clientes`; sin ordenación por clic; columnas no reordenables.
- [ ] Estado como badge: "Activo" (`--color-fila-reparado-bg` / texto `--color-fila-reparado-ico`) o "Inactivo" (`--color-fila-cancelado-bg` / texto `--color-fila-cancelado-text`); radio 10, 11 px negrita.
- [ ] Filas: borde izquierdo de 8 px verde `--color-fila-reparado-brd` si activo, transparente si inactivo; separador inferior `--color-fila-sep`; fila seleccionada fondo `--color-azul-medio`.
- [ ] Placeholder "Sin clientes".
- [ ] Menú contextual (clic derecho, SUPERTECNICO): "Desactivar"/"Activar" según estado, "Editar", y "Borrar" solo si `GET /api/clientes/{id}/tiene-telefonos` devuelve false (se consulta al abrir el menú).
- [ ] "Nuevo cliente": diálogo título "Nuevo cliente", campo "Nombre del cliente:"; nombre recortado; vacío = no hace nada; `POST /api/clientes {nombre}` y recarga.
- [ ] "Editar": diálogo título "Editar cliente", campo "Nombre:" precargado; si queda igual o vacío no llama; `PUT /api/clientes/{id} {nombre, updatedAt}` y recarga.
- [ ] "Activar"/"Desactivar": `PATCH /api/clientes/{id}/activo {activo, updatedAt}` directo, sin confirmación, y recarga.
- [ ] "Borrar": ConfirmDialog "Borrar cliente" / "¿Seguro que quieres borrar el cliente "<nombre>"? Esta acción no se puede deshacer." / botones "Borrar" y "Cancelar"; `DELETE /api/clientes/{id}` y recarga.
- [ ] 409 en editar o activar: alerta "El cliente fue modificado por otro usuario. Se recargan los datos." y recarga. 409 en borrar (teléfonos asociados): alerta con el mensaje del servidor y recarga. Cualquier otro error: alerta con su mensaje.
- [ ] Sin poller. Recarga tras cada escritura y al volver a la pestaña.
- [ ] No exportable: "Descargar CSV" deshabilitado en esta vista.
- Diferencias aceptadas: el menú contextual del JavaFX se abre al seleccionar fila; en web se abre con clic derecho sobre la fila (misma lista de opciones). Los `TextInputDialog` pasan a un diálogo modal con el mismo título y etiqueta. La tabla web no tiene selección de fila, así que no hay fondo de fila seleccionada (el menú contextual actúa sobre la fila pulsada) (añadido tras la revisión, pendiente de confirmar con el usuario). En "Nuevo cliente"/"Editar cliente" un nombre vacío deja el diálogo abierto en vez de cerrarlo sin hacer nada (añadido tras la revisión, pendiente de confirmar con el usuario).
