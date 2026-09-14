# Ficha de paridad — Shell (MainView.fxml / MainController)

Capturas: `Apuntes/paridad-capturas/shell/{navbar-tecnico,navbar-supertecnico,menu-usuario-admin,banner-conexion}.png`.

- [ ] Barra superior navy `--color-azul-noche`, 64 px, padding lateral 20 px.
- [ ] Logo (`logoNavBar.png`, 38 px de alto) clicable → panel inicial del rol (`/reparaciones`).
- [ ] "FSGR:" en negrita 13 px crema + "Gestión de Stock y Reparaciones V.<versión>" normal 13 px crema.
- [ ] Píldora de navegación `--color-nav-switch` radio 24, con 4 botones: Reparaciones, Stock, Estadísticas, Clientes; botón activo navy con texto `#FAFAFA`; 12 px negrita; hover azul medio al 8 %.
- [ ] Los 4 botones visibles para los 3 roles.
- [ ] Campana con badge: solo SUPERTECNICO. **No en este sub-proyecto** (llega con Formulario/notificaciones).
- [ ] Botón de usuario: icono `user.png` 28 px + "Hola, <usuario>" 12 px negrita crema; hover blanco al 8 %.
- [ ] Menú de usuario: [ADMIN: "Gestionar técnicos", "Ver logs", separador] "Descargar CSV" (deshabilitado si la vista no exporta), "Cambiar contraseña", separador, "Cerrar Sesión".
- [ ] "Cerrar Sesión": borra la sesión, limpia caché de datos, vuelve a `/login`.
- [ ] Banner bajo la barra "⚠ Sin conexión con el servidor. Reintentando…" cuando falla la red o hay 5xx; se autocura; mientras está, el refresco pasa a 5 s.
- [ ] 401 con sesión → `/login` con "Tu sesión ha expirado. Inicia sesión de nuevo." (una sola vez).
- [ ] Fondo del área de contenido `--color-fondo-vista`.
- [ ] Refresco al volver a la pestaña (equivale a la recarga al recuperar foco).
- Diferencias aceptadas: la campana pulsante y las ventanas secundarias (logs, gestionar técnicos) pasan a rutas/modales; el título de ventana es la pestaña del navegador ("FSGR"); el colapso de los 4 botones de navegación en un menú por debajo de 900 px queda para cuando haya más de una vista real (sub-proyecto 1).
