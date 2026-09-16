# gestion-reparaciones-web

Cliente web del ERP de reparaciones de Fonestore (React + TypeScript). Sustituye al cliente JavaFX
(`gestion-reparaciones-cliente`) contra el mismo servidor Spring Boot (`gestion-reparaciones-servidor`).

## Arranque en local
1. `npm install`
2. Copia `.env.example` a `.env.local` y pon en `VITE_API_PROXY_TARGET` la URL de la API
   (VM de producción `https://erp.fonestore.es` o un servidor local `http://localhost:8080`).
3. `npm run dev` → http://localhost:5173. Las llamadas a `/api` van por proxy a esa URL, sin CORS.

## Calidad
`npm run check` = lint + typecheck + tests (lo mismo que ejecuta la CI). `npm run test:watch` en desarrollo.

## Contrato de la API
`npm run api:types` descarga el OpenAPI del servidor y regenera `src/shared/api/schema.d.ts` (ver `scripts/`).

## Smoke e2e (Playwright)
Necesita la web ya desplegada (no funciona contra un backend simulado). Exporta en la shell las variables de
`.env.e2e.example` (`E2E_BASE_URL`, `E2E_USER`, `E2E_PASS`, con un usuario supertécnico) y luego:
```bash
npm run e2e
```
El test crea y borra un cliente de prueba llamado `E2E <timestamp>`. `taller.spec.ts` necesita además `TEC_USER`/`TEC_PASS`
(un técnico con pendientes) y es de solo lectura: no crea, edita ni borra nada.

## Despliegue
Los ficheros de referencia (compose, nginx, README) están en `deploy/`. La guía operativa es privada
(`Apuntes/despliegue_vdc_produccion.md`, fuera del repo).

## Documentación
- Spec maestra y de cimientos: repo raíz, `docs/superpowers/specs/2026-09-13-*`.
- Spec del taller técnico: repo raíz, `docs/superpowers/specs/2026-09-16-web-taller-design.md`.
- Fichas de paridad por vista: `docs/paridad/` (taller: `docs/paridad/{pendientes,historial,imeis}.md`).
