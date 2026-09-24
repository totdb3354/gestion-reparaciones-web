import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, renderConRouter, SESION_SUPER } from '@/test/render'
import { server } from '@/test/server'
import { TOOLTIP_ALMACEN } from '../lib/textos'
import { componente, solicitudPreventiva, solicitudUrgente } from '../test/fabrica'
import { CLAVE_NOTIF_COMPONENTES, CLAVE_NOTIF_SOLICITUDES } from './api'
import { Campana } from './Campana'
import { conRegistroNotificaciones, type EscenarioNotificaciones } from './test/handlers'

const control = vi.hoisted(() => ({ intervalo: null as number | null }))
vi.mock('@/shared/api/refresco', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/api/refresco')>()
  function useIntervaloRefresco(activo = true): number | false {
    const normal = real.useIntervaloRefresco(activo)
    return control.intervalo !== null && activo ? control.intervalo : normal
  }
  return { ...real, useIntervaloRefresco }
})

function espiarGets(): string[] {
  const gets: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') return
    const url = new URL(request.url)
    gets.push(url.pathname + url.search)
  })
  return gets
}
const cuantas = (gets: string[], ruta: string) => gets.filter((g) => g === ruta).length

afterEach(() => {
  control.intervalo = null
  server.events.removeAllListeners()
  vi.restoreAllMocks()
})

const ESCENARIO: EscenarioNotificaciones = {
  urgPend: [solicitudUrgente({ idRc: 501, descripcion: 'Batería hinchada' }), solicitudUrgente({ idRc: 502, tipoComponente: null })],
  prevPend: [solicitudPreventiva({ idSol: 701, descripcion: 'Quedan pocas' })],
  urgRech: [solicitudUrgente({ idRc: 503, descripcion: 'No se debe ver' })],
  prevRech: [solicitudPreventiva({ idSol: 702, descripcion: 'Tampoco se ve' })],
  gestionados: [
    componente({ idCom: 101, tipo: 'bati13', stock: 1, stockMinimo: 2 }),
    componente({ idCom: 102, tipo: 'bati14', stock: 0, stockMinimo: 2 }),
    componente({ idCom: 112, tipo: 'lcdi14', stock: 3, stockMinimo: 1 }),
  ],
}

/** Monta la campana del supertécnico y abre el panel. Con alertas en el escenario el pulso late y la primera apertura cae
 *  en "Alertas"; `pestana` deja el panel en la pestaña pedida. */
async function abrirPanel(escenario: EscenarioNotificaciones = ESCENARIO, pestana: 'Solicitudes' | 'Alertas' = 'Solicitudes') {
  const registro = conRegistroNotificaciones(escenario)
  server.use(...registro.handlers)
  const resultado = renderConProviders(<Campana />, { sesion: SESION_SUPER })
  await userEvent.click(screen.getByTestId('campana'))
  await userEvent.click(screen.getByRole('tab', { name: pestana }))
  return { ...resultado, llamadas: registro.llamadas }
}
/** Como abrirPanel, pero con un data router para leer la ruta tras navegar (sub-proyecto 4a). La Campana va en la ruta
 *  comodín para seguir montada después de ir a /stock o /stock/pedidos. */
async function abrirPanelConRouter(escenario: EscenarioNotificaciones = ESCENARIO, pestana: 'Solicitudes' | 'Alertas' = 'Solicitudes') {
  const registro = conRegistroNotificaciones(escenario)
  server.use(...registro.handlers)
  const resultado = renderConRouter([{ path: '*', element: <Campana /> }], { sesion: SESION_SUPER })
  await userEvent.click(screen.getByTestId('campana'))
  await userEvent.click(screen.getByRole('tab', { name: pestana }))
  return { ...resultado, llamadas: registro.llamadas }
}
const tarjeta = (id: string) => screen.findByTestId(`tarjeta-solicitud-${id}`)

describe('tarjetas de solicitudes (ficha notificaciones.md, "Pestaña Solicitudes")', () => {
  it('urgente pendiente: avatar con inicial, SKU, "⚠", línea "<técnico>  ·  <fecha>  ·  <idRep>", descripción y "Rechazar"', async () => {
    await abrirPanel()
    const t = await tarjeta('U-501')
    expect(t).toHaveAttribute('data-grupo', 'pendiente')
    expect(t).toHaveClass('bg-superficie', 'rounded-md', 'p-2.5', 'gap-2.5')
    expect(within(t).getByText('B')).toHaveClass('h-9', 'w-9', 'rounded-full', 'bg-badge-neutro-bg', 'text-[13px]', 'font-bold', 'text-azul-gris')
    expect(within(t).getByText('bati14')).toHaveClass('text-[13px]', 'font-bold', 'text-azul-medio')
    expect(within(t).getByText('⚠')).toHaveClass('bg-aviso-conflicto-bg', 'text-notif-urgente-text', 'text-[10px]', 'font-bold')
    const info = within(t).getByText(/Técnico A/)
    expect(info.textContent).toBe('Técnico A  ·  16/09/2026 09:02  ·  A20260916_1')
    expect(info).toHaveClass('whitespace-pre-wrap', 'text-[11px]', 'text-texto-fecha-inicio')
    expect(within(t).getByText('Batería hinchada')).toHaveClass('whitespace-pre-line', 'text-[11px]', 'text-azul-gris')
    expect(within(t).queryByText(/355400000000111/)).not.toBeInTheDocument()
    expect(within(t).getByRole('button', { name: 'Rechazar' })).toHaveClass('bg-notif-rechazar-bg', 'text-notif-rechazar-text', 'rounded-[20px]', 'text-[11px]')
    expect(within(t).queryByRole('button', { name: 'Borrar solicitud' })).not.toBeInTheDocument()
    // Sin SKU: inicial "?"
    expect(within(await tarjeta('U-502')).getByText('?')).toBeInTheDocument()
  })
  it('urgente rechazada: sin fecha ni descripción, "Recuperar" y papelera', async () => {
    await abrirPanel()
    const t = await tarjeta('U-503')
    expect(t).toHaveAttribute('data-grupo', 'rechazada')
    expect(t).toHaveClass('bg-notif-rechazada-bg', 'p-2')
    expect(within(t).getByText('B')).toHaveClass('bg-notif-avatar-apagado', 'text-notif-texto-apagado')
    expect(within(t).getByText('bati14')).toHaveClass('font-normal', 'text-texto-fecha-inicio')
    expect(within(t).getByText('⚠')).toHaveClass('bg-notif-urgente-apagado-bg', 'text-notif-urgente-apagado-text')
    expect(within(t).getByText(/Técnico A/).textContent).toBe('Técnico A  ·  A20260916_1')
    expect(within(t).getByText(/Técnico A/)).toHaveClass('text-notif-texto-apagado')
    expect(within(t).queryByText('No se debe ver')).not.toBeInTheDocument()
    expect(within(t).getByRole('button', { name: 'Recuperar' })).toHaveClass('bg-azul-medio', 'text-superficie', 'rounded-[20px]', 'text-[11px]')
    const papelera = within(t).getByRole('button', { name: 'Borrar solicitud' })
    expect(papelera.querySelector('img')).toHaveAttribute('src', '/borrar.png')
    expect(papelera.querySelector('img')).toHaveClass('h-[18px]', 'w-[18px]', 'opacity-50')
  })
  it('preventiva pendiente y rechazada según la ficha: sin "⚠", "<usuario>  ·  <fecha>"; la rechazada conserva la fecha y pierde la descripción', async () => {
    await abrirPanel()
    const pendiente = await tarjeta('P-701')
    expect(within(pendiente).queryByText('⚠')).not.toBeInTheDocument()
    expect(within(pendiente).getByText('L')).toBeInTheDocument()
    expect(within(pendiente).getByText('lcdi13')).toBeInTheDocument()
    expect(within(pendiente).getByText(/tecnico_n/).textContent).toBe('tecnico_n  ·  16/09/2026 11:30')
    expect(within(pendiente).getByText('Quedan pocas')).toBeInTheDocument()
    expect(within(pendiente).getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    const rechazada = await tarjeta('P-702')
    expect(within(rechazada).queryByText('⚠')).not.toBeInTheDocument()
    expect(within(rechazada).getByText(/tecnico_n/).textContent).toBe('tecnico_n  ·  16/09/2026 11:30')
    expect(within(rechazada).queryByText('Tampoco se ve')).not.toBeInTheDocument()
    expect(within(rechazada).getByRole('button', { name: 'Recuperar' })).toBeInTheDocument()
    expect(within(rechazada).getByRole('button', { name: 'Borrar solicitud' })).toBeInTheDocument()
  })
  it('fondo alterno con un único contador por lista (compartido entre urgentes y preventivas)', async () => {
    await abrirPanel()
    expect(await tarjeta('U-501')).toHaveClass('bg-superficie')
    expect(await tarjeta('U-502')).toHaveClass('bg-notif-tarjeta-alt')
    expect(await tarjeta('P-701')).toHaveClass('bg-superficie')
    expect(await tarjeta('U-503')).toHaveClass('bg-notif-rechazada-bg')
    expect(await tarjeta('P-702')).toHaveClass('bg-notif-rechazada-alt')
  })
})

describe('panel (ficha notificaciones.md, "Panel")', () => {
  const rect = (right: number): DOMRect => ({ x: right - 34, y: 15, left: right - 34, top: 15, right, bottom: 49, width: 34, height: 34, toJSON: () => ({}) })

  it('panel de 480 px anclado a la campana; se recoloca con la ventana', async () => {
    const espia = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(900))
    await abrirPanel({})
    const panel = screen.getByTestId('panel-notificaciones')
    expect(panel).toHaveClass('fixed', 'w-[480px]', 'bg-fondo-vista', 'border', 'border-notif-panel-brd', 'p-5', 'gap-3')
    expect(panel.style.top).toBe('55px')
    expect(panel.style.left).toBe('420px')
    espia.mockReturnValue(rect(700))
    fireEvent(window, new Event('resize'))
    expect(panel.style.left).toBe('220px')
  })
  it('clic fuera y Escape lo cierran; clic dentro no', async () => {
    await abrirPanel({})
    await userEvent.click(screen.getByRole('heading', { name: 'Solicitudes de pieza' }))
    expect(screen.getByTestId('panel-notificaciones')).toBeInTheDocument()
    await userEvent.click(document.body)
    expect(screen.queryByTestId('panel-notificaciones')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('campana'))
    expect(screen.getByTestId('panel-notificaciones')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('panel-notificaciones')).not.toBeInTheDocument()
  })
  it('segmentado: "Solicitudes" activo por defecto; cambiar de pestaña no vuelve a pedir datos', async () => {
    const gets = espiarGets()
    const registro = conRegistroNotificaciones({})
    server.use(...registro.handlers)
    const { queryClient } = renderConProviders(<Campana />, { sesion: SESION_SUPER })
    await userEvent.click(screen.getByTestId('campana'))
    const solicitudes = screen.getByRole('tab', { name: 'Solicitudes' })
    const alertas = screen.getByRole('tab', { name: 'Alertas' })
    expect(solicitudes).toHaveAttribute('aria-selected', 'true')
    expect(solicitudes).toHaveClass('bg-azul-medio', 'text-superficie', 'font-bold', 'rounded-[17px]', 'text-[12px]')
    expect(alertas).toHaveClass('text-azul-gris')
    expect(alertas).not.toHaveClass('font-bold')
    expect(solicitudes.parentElement).toHaveClass('rounded-[20px]', 'border-notif-segmento-brd', 'bg-superficie', 'p-[3px]')
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes?estado=PENDIENTE')).toBe(1))
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    const antes = gets.length
    await userEvent.click(alertas)
    expect(await screen.findByRole('heading', { name: 'Alertas de Stock' })).toBeInTheDocument()
    await userEvent.click(solicitudes)
    expect(screen.getByRole('heading', { name: 'Solicitudes de pieza' })).toBeInTheDocument()
    expect(gets.length).toBe(antes)
  })
  it('títulos "Solicitudes de pieza" y "Rechazadas" siempre visibles, sin texto de lista vacía', async () => {
    await abrirPanel({})
    expect(screen.getByRole('heading', { name: 'Solicitudes de pieza' })).toHaveClass('text-[14px]', 'font-bold', 'text-azul-medio')
    expect(screen.getByRole('heading', { name: 'Rechazadas' })).toHaveClass('text-[12px]', 'font-bold', 'text-texto-fecha-inicio')
    expect(screen.getByRole('tabpanel', { name: 'Solicitudes' })).toHaveClass('h-[370px]', 'overflow-y-auto', 'overflow-x-hidden')
    expect(screen.queryByText(/sin solicitudes/i)).not.toBeInTheDocument()
  })
  it('"→ Ir a pedidos" cierra el panel y navega a /stock/pedidos desde las dos pestañas', async () => {
    for (const pestana of ['Solicitudes', 'Alertas'] as const) {
      const { router, unmount } = await abrirPanelConRouter({}, pestana)
      const enlace = screen.getByRole('button', { name: '→ Ir a pedidos' })
      expect(enlace).toBeEnabled()
      expect(enlace).toHaveClass('text-[12px]', 'font-bold', 'text-azul-noche', 'cursor-pointer')
      await userEvent.click(enlace)
      await waitFor(() => expect(screen.queryByTestId('panel-notificaciones')).not.toBeInTheDocument())
      expect(screen.getByTestId('campana')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/stock/pedidos')
      unmount()
    }
  })
  it('"Pedir piezas", "Pedir" y "Pedir todas las piezas" deshabilitados con tooltip; "Rechazar todo" habilitado', async () => {
    await abrirPanel()
    expect(screen.getByRole('button', { name: 'Rechazar todo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Rechazar todo' })).toHaveClass('bg-notif-rechazar-bg', 'text-notif-rechazar-text', 'text-[13px]', 'font-bold', 'rounded-[20px]', 'p-[11px]')
    const pedirPiezas = screen.getByRole('button', { name: 'Pedir piezas' })
    expect(pedirPiezas).toHaveClass('bg-azul-medio', 'text-superficie', 'text-[13px]', 'font-bold')
    expect(pedirPiezas).toBeDisabled()
    expect(pedirPiezas.parentElement).toHaveAttribute('title', TOOLTIP_ALMACEN)
    await userEvent.click(screen.getByRole('tab', { name: 'Alertas' }))
    const reservados = [...screen.getAllByRole('button', { name: 'Pedir' }), screen.getByRole('button', { name: 'Pedir todas las piezas' })]
    expect(reservados).toHaveLength(3)
    for (const boton of reservados) {
      expect(boton).toBeDisabled()
      expect(boton.parentElement).toHaveAttribute('title', TOOLTIP_ALMACEN)
    }
  })
  it('"Ver Stock Completo" cierra el panel y navega a /stock sin filtros', async () => {
    const { router } = await abrirPanelConRouter(ESCENARIO, 'Alertas')
    const boton = screen.getByRole('button', { name: 'Ver Stock Completo' })
    expect(boton).toBeEnabled()
    expect(boton).toHaveClass('bg-azul-medio', 'text-superficie')
    await userEvent.click(boton)
    await waitFor(() => expect(screen.queryByTestId('panel-notificaciones')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/stock')
    expect(router.state.location.search).toBe('')
  })
})

describe('acciones (sin confirmación)', () => {
  it('"Rechazar" → PATCH { estado: "RECHAZADA" } sin confirmación y recarga solicitudes, contador y alertas', async () => {
    const gets = espiarGets()
    const { llamadas } = await abrirPanel()
    const t = await tarjeta('U-501')
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBeGreaterThanOrEqual(1))
    const antes = { componentes: cuantas(gets, '/api/componentes/gestionados'), contador: cuantas(gets, '/api/solicitudes/count') }
    await userEvent.click(within(t).getByRole('button', { name: 'Rechazar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('tarjeta-solicitud-U-501')).toHaveAttribute('data-grupo', 'rechazada'))
    expect(llamadas).toEqual([{ metodo: 'PATCH', ruta: '/api/solicitudes/501/estado', cuerpo: { estado: 'RECHAZADA' } }])
    expect(cuantas(gets, '/api/componentes/gestionados')).toBeGreaterThan(antes.componentes)
    expect(cuantas(gets, '/api/solicitudes/count')).toBeGreaterThan(antes.contador)
    // El badge baja de 3 a 2
    await waitFor(() => expect(screen.getByTestId('campana-badge')).toHaveTextContent('2'))
  })
  it('"Recuperar" → PATCH { estado: "PENDIENTE" }, urgente y preventiva', async () => {
    const { llamadas } = await abrirPanel()
    await userEvent.click(within(await tarjeta('U-503')).getByRole('button', { name: 'Recuperar' }))
    await waitFor(() => expect(screen.getByTestId('tarjeta-solicitud-U-503')).toHaveAttribute('data-grupo', 'pendiente'))
    await userEvent.click(within(await tarjeta('P-702')).getByRole('button', { name: 'Recuperar' }))
    await waitFor(() => expect(screen.getByTestId('tarjeta-solicitud-P-702')).toHaveAttribute('data-grupo', 'pendiente'))
    expect(llamadas).toEqual([
      { metodo: 'PATCH', ruta: '/api/solicitudes/503/estado', cuerpo: { estado: 'PENDIENTE' } },
      { metodo: 'PATCH', ruta: '/api/solicitudes-stock/702/estado', cuerpo: { estado: 'PENDIENTE' } },
    ])
  })
  it('papelera urgente → PATCH limpiar; preventiva → DELETE; la solicitud deja de aparecer', async () => {
    const { llamadas } = await abrirPanel()
    await userEvent.click(within(await tarjeta('U-503')).getByRole('button', { name: 'Borrar solicitud' }))
    await waitFor(() => expect(screen.queryByTestId('tarjeta-solicitud-U-503')).not.toBeInTheDocument())
    await userEvent.click(within(await tarjeta('P-702')).getByRole('button', { name: 'Borrar solicitud' }))
    await waitFor(() => expect(screen.queryByTestId('tarjeta-solicitud-P-702')).not.toBeInTheDocument())
    expect(llamadas).toEqual([
      { metodo: 'PATCH', ruta: '/api/solicitudes/503/limpiar', cuerpo: null },
      { metodo: 'DELETE', ruta: '/api/solicitudes-stock/702', cuerpo: null },
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('menú contextual: "Rechazar solicitud" / "Recuperar solicitud", sin papelera; usarlo no cierra el panel', async () => {
    const { llamadas } = await abrirPanel()
    await userEvent.pointer({ keys: '[MouseRight]', target: await tarjeta('P-701') })
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Rechazar solicitud'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rechazar solicitud' }))
    await waitFor(() => expect(screen.getByTestId('tarjeta-solicitud-P-701')).toHaveAttribute('data-grupo', 'rechazada'))
    await userEvent.pointer({ keys: '[MouseRight]', target: await tarjeta('U-503') })
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Recuperar solicitud'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Recuperar solicitud' }))
    await waitFor(() => expect(screen.getByTestId('tarjeta-solicitud-U-503')).toHaveAttribute('data-grupo', 'pendiente'))
    expect(llamadas.map((l) => `${l.ruta} ${JSON.stringify(l.cuerpo)}`)).toEqual([
      '/api/solicitudes-stock/701/estado {"estado":"RECHAZADA"}',
      '/api/solicitudes/503/estado {"estado":"PENDIENTE"}',
    ])
    expect(screen.getByTestId('panel-notificaciones')).toBeInTheDocument()
  })
  it('error de una acción: aviso con el mensaje y la lista no cambia; aceptar el aviso no cierra el panel', async () => {
    await abrirPanel()
    // Después de abrirPanel: MSW antepone cada server.use, así que este 409 gana a los handlers del escenario
    server.use(http.patch('*/api/solicitudes/501/estado', () => HttpResponse.json({ message: 'La solicitud ya fue gestionada' }, { status: 409 })))
    await userEvent.click(within(await tarjeta('U-501')).getByRole('button', { name: 'Rechazar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('La solicitud ya fue gestionada')
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.getByTestId('panel-notificaciones')).toBeInTheDocument()
    expect(screen.getByTestId('tarjeta-solicitud-U-501')).toHaveAttribute('data-grupo', 'pendiente')
  })
  it('"Rechazar todo": pide las pendientes, rechaza urgentes y luego preventivas una a una, y no recarga las alertas', async () => {
    const gets = espiarGets()
    const { llamadas, queryClient } = await abrirPanel()
    await tarjeta('U-501')
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    const componentesAntes = cuantas(gets, '/api/componentes/gestionados')
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar todo' }))
    await waitFor(() => expect(screen.getByTestId('tarjeta-solicitud-P-701')).toHaveAttribute('data-grupo', 'rechazada'))
    expect(llamadas.map((l) => l.ruta)).toEqual(['/api/solicitudes/501/estado', '/api/solicitudes/502/estado', '/api/solicitudes-stock/701/estado'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cuantas(gets, '/api/componentes/gestionados')).toBe(componentesAntes)
    await waitFor(() => expect(screen.queryByTestId('campana-badge')).not.toBeInTheDocument())
  })
  it('"Rechazar todo" se detiene en el primer error, lo muestra y no recarga', async () => {
    const { llamadas } = await abrirPanel()
    await tarjeta('U-501')
    server.use(http.patch('*/api/solicitudes/502/estado', () => HttpResponse.json({ message: 'La solicitud ya fue gestionada' }, { status: 409 })))
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar todo' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('La solicitud ya fue gestionada')
    expect(llamadas.map((l) => l.ruta)).toEqual(['/api/solicitudes/501/estado'])
    // No recarga: la 501 ya está rechazada en el servidor pero el panel la sigue pintando como pendiente
    expect(screen.getByTestId('tarjeta-solicitud-U-501')).toHaveAttribute('data-grupo', 'pendiente')
  })
  it('"Rechazar todo" con la lista vacía no escribe nada', async () => {
    const { llamadas, queryClient } = await abrirPanel({})
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar todo' }))
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(llamadas).toEqual([])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('pestaña Alertas', () => {
  it('alertas: "Sin alertas de stock" cuando no hay', async () => {
    await abrirPanel({ gestionados: [componente({ stock: 5, stockMinimo: 2 })] }, 'Alertas')
    expect(screen.getByRole('heading', { name: 'Alertas de Stock' })).toHaveClass('text-[16px]', 'font-bold', 'text-azul-medio')
    expect(await screen.findByText('Sin alertas de stock')).toHaveClass('text-[13px]', 'text-texto-fecha-inicio')
    expect(screen.getByRole('tabpanel', { name: 'Alertas' })).toHaveClass('h-[320px]', 'overflow-y-auto')
  })
  it('tarjeta "Sin Stock / Sin unidades" y "Stock Bajo / N unid. restantes", sin stock primero, fondo alterno y sin menú contextual', async () => {
    await abrirPanel(ESCENARIO, 'Alertas')
    const sinStock = await screen.findByTestId('tarjeta-alerta-102')
    const bajo = screen.getByTestId('tarjeta-alerta-101')
    expect(screen.queryByTestId('tarjeta-alerta-112')).not.toBeInTheDocument()
    expect(sinStock.compareDocumentPosition(bajo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sinStock).toHaveClass('bg-superficie', 'rounded-md', 'p-3', 'gap-3')
    expect(bajo).toHaveClass('bg-notif-tarjeta-alt')
    expect(within(sinStock).getByText('✕')).toHaveClass('h-10', 'w-10', 'rounded-full', 'bg-notif-sin-stock', 'text-[14px]', 'font-bold', 'text-superficie')
    expect(within(sinStock).getByText('bati14')).toHaveClass('text-[14px]', 'font-bold', 'text-azul-medio')
    expect(within(sinStock).getByText('Sin Stock')).toHaveClass('font-bold', 'text-notif-sin-stock')
    expect(within(sinStock).getByText('Sin unidades')).toHaveClass('text-texto-fecha-inicio')
    expect(within(bajo).getByText('!')).toHaveClass('bg-notif-stock-bajo')
    expect(within(bajo).getByText('Stock Bajo')).toHaveClass('text-notif-stock-bajo')
    expect(within(bajo).getByText('1 unid. restantes')).toBeInTheDocument()
    expect(within(bajo).queryByText(/mínimo/i)).not.toBeInTheDocument()
    await userEvent.pointer({ keys: '[MouseRight]', target: sinStock })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('refresco (ficha notificaciones.md, "Refresco")', () => {
  it('sondeo con el panel abierto: solicitudes, contadores y alertas', async () => {
    control.intervalo = 40
    const gets = espiarGets()
    await abrirPanel()
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes?estado=PENDIENTE')).toBeGreaterThanOrEqual(3))
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes-stock?estado=RECHAZADA')).toBeGreaterThanOrEqual(3))
    await waitFor(() => expect(cuantas(gets, '/api/componentes/gestionados')).toBeGreaterThanOrEqual(3))
    await waitFor(() => expect(cuantas(gets, '/api/solicitudes/count')).toBeGreaterThanOrEqual(3))
  })
  it('un cambio de descripción no repinta las tarjetas, un id nuevo sí; las alertas se repintan siempre', async () => {
    const { queryClient } = await abrirPanel({ urgPend: [solicitudUrgente({ idRc: 501, descripcion: 'Texto inicial' })], gestionados: [componente({ idCom: 102, tipo: 'bati14', stock: 0 })] })
    expect(await screen.findByText('Texto inicial')).toBeInTheDocument()
    const recargar = async () => {
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_SOLICITUDES })
        await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_COMPONENTES })
      })
    }
    let urgentes = [solicitudUrgente({ idRc: 501, descripcion: 'Texto cambiado', nombreTecnico: 'Técnico H' })]
    server.use(
      http.get('*/api/solicitudes', ({ request }) => HttpResponse.json(new URL(request.url).searchParams.get('estado') === 'PENDIENTE' ? urgentes : [])),
      http.get('*/api/componentes/gestionados', () => HttpResponse.json([componente({ idCom: 102, tipo: 'bati14', stock: 1, stockMinimo: 2 })])),
    )
    await recargar()
    expect(screen.getByText('Texto inicial')).toBeInTheDocument()
    expect(screen.queryByText('Texto cambiado')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Alertas' }))
    expect(screen.getByText('1 unid. restantes')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Solicitudes' }))

    urgentes = [...urgentes, solicitudUrgente({ idRc: 504 })]
    await recargar()
    expect(await screen.findByTestId('tarjeta-solicitud-U-504')).toBeInTheDocument()
    expect(screen.getByText('Texto cambiado')).toBeInTheDocument()
  })
  it('fallo del sondeo: sin aviso y se conserva la última lista (solicitudes y alertas)', async () => {
    const { queryClient } = await abrirPanel()
    await tarjeta('U-501')
    await waitFor(() => expect(queryClient.isFetching()).toBe(0))
    const caido = () => new HttpResponse(null, { status: 500 })
    server.use(http.get('*/api/solicitudes', caido), http.get('*/api/solicitudes-stock', caido), http.get('*/api/componentes/gestionados', caido))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_SOLICITUDES })
      await queryClient.invalidateQueries({ queryKey: CLAVE_NOTIF_COMPONENTES })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('tarjeta-solicitud-U-501')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Alertas' }))
    expect(screen.getByTestId('tarjeta-alerta-102')).toBeInTheDocument()
  })
})
