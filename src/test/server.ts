import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Únicos handlers por defecto (resetHandlers vuelve a ellos; server.use de cada test los tapa): las tres listas de
 * asignaciones y la de pedidos vacías. Las pide el badge de "Asignaciones" del lateral del supertécnico (BadgeAsignaciones), que va en
 * el SubNav de <AppLayout/>: cualquier test que monte el layout con SESION_SUPER las dispara aunque su vista no tenga
 * nada que ver con Asignaciones. Una lista vacía deja el badge oculto, así que no altera lo que esos tests comprueban.
 * Además, la nota de la contraseña: «Muy segura», para que los formularios de contraseña de cualquier test se puedan guardar.
 */
export const server = setupServer(
  http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([])),
  http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
  http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
  // 0.9.9: «Nuevo pedido» y «Editar pedido» leen los pedidos para ofrecer sus bloques; los abren tests de Stock, de la
  // campana y del layout que no van de pedidos. Una lista vacía = ningún bloque abierto (regla por defecto).
  http.get('*/api/compras', () => HttpResponse.json([])),
  http.post('*/api/auth/evaluar-password', () => HttpResponse.json({ nota: 4, aceptable: true, mensaje: null })),
)
