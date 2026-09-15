# Changelog

Todos los cambios notables de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.1.0] - 2026-09-16 — Cimientos

Fecha del tag; la verificación de paridad contra producción y las capturas del JavaFX son del 2026-09-15 y el lote de cierre del 2026-09-16.

- Shell (barra superior, columna lateral, menú de usuario, banner de conexión, refresco al volver).
- Login y sesión (JWT, expiración, guard de rutas).
- API tipada desde OpenAPI (`npm run api:types`, snapshot `api/openapi.json`).
- Componentes compartidos (DataTable, MultiSelect, StatusBadge, ConfirmDialog, AlertaProvider).
- Módulo Clientes (CRUD con bloqueo optimista y menú contextual).
- CI.
- Dockerfile + `deploy/`.
- Smoke e2e con Playwright.
