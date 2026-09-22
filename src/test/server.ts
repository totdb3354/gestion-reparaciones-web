import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Únicos handlers por defecto (resetHandlers vuelve a ellos; server.use de cada test los tapa): las tres listas de
 * asignaciones vacías. Las pide el badge de "Asignaciones" del lateral del supertécnico (BadgeAsignaciones), que va en
 * el SubNav de <AppLayout/>: cualquier test que monte el layout con SESION_SUPER las dispara aunque su vista no tenga
 * nada que ver con Asignaciones. Una lista vacía deja el badge oculto, así que no altera lo que esos tests comprueban.
 */
export const server = setupServer(
  http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([])),
  http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
  http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
)
