import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

/**
 * Únicos handlers por defecto (resetHandlers vuelve a ellos; server.use de cada test los tapa): las tres listas de
 * asignaciones y las dos de pedidos (piezas y otros) vacías. Las pide el badge de "Asignaciones" del lateral del supertécnico (BadgeAsignaciones), que va en
 * el SubNav de <AppLayout/>: cualquier test que monte el layout con SESION_SUPER las dispara aunque su vista no tenga
 * nada que ver con Asignaciones. Una lista vacía deja el badge oculto, así que no altera lo que esos tests comprueban.
 * Además, la nota de la contraseña: «Muy segura», para que los formularios de contraseña de cualquier test se puedan guardar.
 * Y desde la 0.9.18, el estado de NSYS y la lista de importaciones (el indicador de la barra superior).
 * Y desde la 0.9.21, la lista "Por pasar a NSYS" (vacía).
 * Y desde la 0.9.21, la previa del SKU del taller (fuera de NSYS).
 */
export const server = setupServer(
  http.get('*/api/reparaciones/asignaciones', () => HttpResponse.json([])),
  http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
  http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
  // 0.9.14: con la navegación por grupos, el badge de "Pendientes" (técnico y supertécnico) va en la columna en todas las
  // vistas, así que cualquier test que monte el layout con esas sesiones pide sus contadores. A cero no se pinta.
  http.get('*/api/reparaciones/pendientes/contadores', () => HttpResponse.json({ reparaciones: 0, glass: 0, pulidos: 0 })),
  // 0.9.9: «Nuevo pedido» y «Editar pedido» leen los pedidos para ofrecer sus bloques; los abren tests de Stock, de la
  // campana y del layout que no van de pedidos. Una lista vacía = ningún bloque abierto (regla por defecto).
  http.get('*/api/compras', () => HttpResponse.json([])),
  // 0.9.15: los bloques llevan piezas y otros, así que «Nuevo pedido», los editores y Pedidos leen también los otros.
  http.get('*/api/compras-otros', () => HttpResponse.json([])),
  // 0.9.20: el panel de carga de técnicos vive en el marco y sale abierto de fábrica para el supertécnico y el admin, así
  // que cualquier test que monte el layout con esas sesiones pide la carga. Vacía: el panel dice «Sin técnicos activos».
  http.get('*/api/reparaciones/carga-tecnicos', () => HttpResponse.json({ pedidos: [], total: [] })),
  http.post('*/api/auth/evaluar-password', () => HttpResponse.json({ nota: 4, aceptable: true, mensaje: null })),
  // 0.9.17: el detalle de IMEIs del supertécnico y del admin pide la ficha de NSYS (y su rastro) y la lista busca en el
  // espejo al filtrar por IMEI. Por defecto NSYS no conoce el IMEI (404, la ficha no sale) y la búsqueda no encuentra nada.
  // «buscar» va antes que «:imeiSn» porque el patrón también lo cubriría.
  // 0.9.18: el indicador «NSYS sin datos» de la barra superior pide el estado en cualquier vista del supertécnico y del
  // admin: por defecto, al día (no se pinta). La lista de importaciones de la píldora, vacía. Van antes que «:imeiSn», que
  // también las cubriría.
  http.get('*/api/stock-telefonos/estado', () =>
    HttpResponse.json({ ultimaExportacion: '2026-10-16T13:31:00', nivel: 'OK', ultimoFallo: null, motivoFallo: null })),
  http.get('*/api/stock-telefonos/importaciones', () =>
    HttpResponse.json({ importaciones: [], historico: { total: 0, hechos: 0, ultimo: null, hasta: null } })),
  // 0.9.21: el stock de teléfonos pide la lista «Por pasar a NSYS» para el número de su pestaña: por defecto, vacía. Va antes
  // que «:imeiSn», que también la cubriría (y daría 404).
  http.get('*/api/stock-telefonos/por-pasar', () => HttpResponse.json([])),
  http.get('*/api/stock-telefonos/buscar', () => HttpResponse.json([])),
  http.get('*/api/stock-telefonos/:imeiSn/rastro', () => HttpResponse.json([])),
  http.get('*/api/stock-telefonos/:imeiSn', () => HttpResponse.json({ message: 'NSYS no conoce el IMEI' }, { status: 404 })),
)
