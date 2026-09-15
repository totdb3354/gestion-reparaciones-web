# Ficha de paridad — Shell (MainView.fxml / MainController)

Capturas: `Apuntes/paridad-capturas/shell/{navbar-tecnico,navbar-supertecnico,menu-usuario-admin,banner-conexion}.png`.

- [x] Barra superior navy `--color-azul-noche`, 64 px, padding lateral 20 px.
- [x] Logo (`logoNavBar.png`, 38 px de alto) clicable → panel inicial del rol (`/reparaciones`).
- [x] "FSGR:" en negrita 13 px crema + "Gestión de Stock y Reparaciones V.<versión>" normal 13 px crema.
- [x] Píldora de navegación `--color-nav-switch` radio 24, con 4 botones: Reparaciones, Stock, Estadísticas, Clientes; botón activo navy con texto `#FAFAFA`; 12 px negrita; hover azul medio al 8 %.
- [ ] Los 4 botones visibles para los 3 roles. (SUPERTECNICO y TECNICO verificados; ADMIN pendiente de comprobar en navegador)
- [x] Campana con badge: solo SUPERTECNICO. **No en este sub-proyecto** (llega con Formulario/notificaciones).
- [x] Botón de usuario: icono `user.png` 28 px + "Hola, <usuario>" 12 px negrita crema; hover blanco al 8 %.
- [x] Menú de usuario: [ADMIN: "Gestionar técnicos", "Ver logs", separador] "Descargar CSV" (deshabilitado si la vista no exporta), "Cambiar contraseña", separador, "Cerrar Sesión".
- [x] "Cerrar Sesión": borra la sesión, limpia caché de datos, vuelve a `/login`.
- [x] Banner bajo la barra "⚠ Sin conexión con el servidor. Reintentando…" cuando falla la red o hay 5xx; se autocura; mientras está, el refresco pasa a 5 s.
- [x] 401 con sesión → `/login` con "Tu sesión ha expirado. Inicia sesión de nuevo." (una sola vez).
- [x] Fondo del área de contenido `--color-fondo-vista`.
- [x] Refresco al volver a la pestaña (equivale a la recarga al recuperar foco).
- [x] Columna lateral de sub-navegación (200 px, blanca, píldora navy del apartado activo; en Clientes una sola píldora "Clientes"; el resto de secciones la rellenan los sub-proyectos 1-6).
- [x] Banner con tokens `--color-banner-bg` #F6C453 / `--color-banner-text` #5A4500.
- [x] Diálogo "Error / Sin conexión con el servidor: <detalle>" además del banner cuando falla una acción del usuario (cualquier mutación) o el primer fallo de carga de una vista sin datos; los refrescos automáticos (foco, intervalo, reintento) y las cargas con datos previos solo muestran el banner. Dentro de los 5 minutos de caché de una consulta fallida no se repite el diálogo al volver a la vista.
- Diferencias aceptadas: la campana pulsante y las ventanas secundarias (logs, gestionar técnicos) pasan a rutas/modales; el título de ventana es la pestaña del navegador ("FSGR"); el colapso de los 4 botones de navegación en un menú por debajo de 900 px queda para cuando haya más de una vista real (sub-proyecto 1); el panel inicial por rol (ADMIN→Historial, SUPERTECNICO→Asignaciones, TECNICO→Pendientes) queda para el sub-proyecto 1, cuando existan esas vistas; hasta entonces todos entran en `/reparaciones`; sin vistas que sondeen, el banner se cura al siguiente request (acción o volver a la pestaña), no cada 5 s; el intervalo de 5 s llega con `useIntervaloRefresco` en el sub-proyecto 1; la caché de consultas es de 5 minutos por defecto, así que volver a una vista que ya falló sin conexión no reabre el diálogo hasta que caduca; el JavaFX lo reabriría en cada navegación.
