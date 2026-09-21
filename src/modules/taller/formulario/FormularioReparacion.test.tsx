import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http, type RequestHandler } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderConProviders, renderConRouter, SESION_SUPER, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { agrupados, asignacionActiva, componente, detalleEdicion, reparacion, solicitudAsignacion } from '../test/fabrica'
import { FormularioReparacion } from './FormularioReparacion'
import { conRegistro, type EscenarioFormulario, type LlamadaRegistrada } from './test/handlers'
import { borradorEnReposo } from './useBorrador'

// Red de seguridad: se desmonta AQUÍ (con los handlers de MSW todavía activos) y se espera el volcado del desmontaje.
// Este afterEach corre antes que el de src/test/setup.ts (los hooks "after" van en orden inverso al de registro).
afterEach(async () => {
  cleanup()
  await borradorEnReposo()
})

const TITULO = 'Nueva reparación — IMEI 355400000000111'

/** Monta el formulario de la asignación A20260916_1 (IMEI 355400000000111, del técnico de SESION_TEC) sobre un data router. */
function abrir(escenario: EscenarioFormulario = {}) {
  const onCerrar = vi.fn()
  const { handlers, llamadas } = conRegistro(escenario)
  server.use(...handlers)
  const r = renderConRouter([{ path: '/', element: <FormularioReparacion modo="nuevo" idAsignacion="A20260916_1" onCerrar={onCerrar} /> }], { sesion: SESION_TEC, ruta: '/' })
  return { ...r, onCerrar, llamadas }
}

/** Escrituras del formulario en orden, sin las del borrador. `conRegistro` anota `metodo` en mayúsculas (`request.method`), `ruta` =
 *  pathname (`/api/reparaciones/...`) y `cuerpo` = JSON recibido (null si no hay): se comparan tal cual. */
const escrituras = (llamadas: LlamadaRegistrada[]) =>
  llamadas.filter((l) => !l.ruta.endsWith('/borrador'))

async function elegirModelo(nombre: string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
  // El manejador de clic vive en el <button> interior de cada <li role="option"> (ComboNavy): clicar la opción misma
  // (el <li>) no lo dispara, porque el evento no baja a un descendiente (ver ComboNavy.test.tsx, que clica el botón).
  await userEvent.click(await screen.findByRole('button', { name: nombre }))
}

describe('FormularioReparacion · cabecera, avisos y cierre (ficha docs/paridad/formulario.md)', () => {
  it('sin modelo: cabecera de columnas visible y "Selecciona un modelo de iPhone para continuar"', async () => {
    abrir()
    expect(await screen.findByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(screen.getByText('IMEI: 355400000000111')).toBeInTheDocument()
    expect(screen.getByText('Filtrar por modelo:')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('— Selecciona modelo —')
    for (const columna of ['Unit (+/-)', 'Componente', 'SKU', 'Stock', '¿Reutilizado?', 'Observación']) expect(screen.getByText(columna)).toBeInTheDocument()
    expect(screen.getByText('Selecciona un modelo de iPhone para continuar')).toBeInTheDocument()
    expect(screen.queryByTestId('fila-bat')).not.toBeInTheDocument()
    expect(screen.queryByTestId('banda-conflicto')).not.toBeInTheDocument()
    expect(screen.queryByTestId('banda-incidencia')).not.toBeInTheDocument()
  })

  it('elegir modelo muestra las filas (data-testid fila-*) en el orden del servidor, sin glass, marco ni otro', async () => {
    abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    expect(screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))).toEqual(['fila-bat', 'fila-cha', 'fila-lcd', 'fila-cam'])
    expect(screen.queryByText('Selecciona un modelo de iPhone para continuar')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('iPhone 13')
  })

  it('las opciones del combo son los modelos con SKU activo, traducidos y en orden de tienda', async () => {
    abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['iPhone 13', 'iPhone 13 Pro Max', 'iPhone 14'])
  })

  it('modelo autodetectado: combo deshabilitado y filas a la vista', async () => {
    abrir({ modeloTelefono: '13' })
    await screen.findByRole('dialog', { name: TITULO })
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    expect(combo).toBeDisabled()
    expect(combo).toHaveTextContent('iPhone 13')
    expect(screen.getByTestId('fila-bat')).toBeInTheDocument()
  })

  it('banda de conflicto con el literal, sin la asignación propia y con "(tú)"', async () => {
    abrir({
      activas: [
        asignacionActiva(),
        asignacionActiva({ idRep: 'A20260916_1', nombreTecnico: 'Técnico A', idTec: 4 }),
        asignacionActiva({ idRep: 'AP20260916_3', nombreTecnico: 'Técnico A', idTec: 4 }),
      ],
    })
    const banda = await screen.findByTestId('banda-conflicto')
    expect(banda.textContent).toBe('⚠ Este IMEI también está asignado a — Glass: Técnico H · Pulido: Técnico A (tú)')
    expect(banda).toHaveClass('bg-aviso-conflicto-bg', 'text-aviso-conflicto-text')
  })

  it('banda de incidencia con el idRep', async () => {
    abrir({ incidencia: 'R20260910_3' })
    const banda = await screen.findByTestId('banda-incidencia')
    expect(banda.textContent).toBe('⚠ Resuelve incidencia: R20260910_3')
    expect(banda).toHaveClass('text-aviso-incidencia-text')
  })

  it('✕ y Escape piden cerrar sin preguntar', async () => {
    const { onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Salir sin guardar')).not.toBeInTheDocument()
  })

  it('con el diálogo abierto, Escape en el combo de modelo cierra la lista sin cerrar el formulario', async () => {
    const { onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por modelo' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })
})

describe('FormularioReparacion · filas y "✓ Guardar fila"', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 16, 9, 15))
  })
  afterEach(() => vi.useRealTimers())

  it('"✓ Guardar fila" → "✓ Confirmar" → POST con el cuerpo exacto; éxito: fila verde con "✓ Guardada dd/MM HH:mm" y controles deshabilitados', async () => {
    const { llamadas } = abrir({ incidencia: 'R20260910_3' })
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Confirmar')
    expect(escrituras(llamadas)).toEqual([])
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await waitFor(() => expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardada 16/09 09:15'))
    expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'guardada')
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeDisabled()
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toBeDisabled()
    expect(escrituras(llamadas)).toEqual([
      {
        metodo: 'POST',
        ruta: '/api/reparaciones/A20260916_1/filas',
        cuerpo: {
          filas: [{ idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }],
          imei: '355400000000111',
          idTec: 4,
          idRepAnterior: 'R20260910_3',
        },
      },
    ])
  })

  it('cambiar algo tras el primer clic vuelve a "✓ Guardar fila" y no se llama al servidor', async () => {
    const { llamadas } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardar fila')
    expect(escrituras(llamadas)).toEqual([])
  })

  it('error 409: aviso "No se pudo guardar la fila: <mensaje del servidor>" y la fila sigue editable', async () => {
    abrir()
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => HttpResponse.json({ message: 'La asignación ya fue eliminada o completada' }, { status: 409 })))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await userEvent.click(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    expect(await screen.findByText('No se pudo guardar la fila: La asignación ya fue eliminada o completada')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'normal')
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardar fila')
    expect(screen.getByTestId('boton-derecho-bat')).toBeEnabled()
    expect(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Sumar Batería' })).toBeEnabled()
  })

  it('mientras guarda el botón está deshabilitado', async () => {
    abrir()
    let soltar: () => void = () => {}
    const puerta = new Promise<void>((resolve) => { soltar = resolve })
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', async () => { await puerta; return HttpResponse.json({ value: 'R20260916_9' }) }))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await userEvent.click(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await waitFor(() => expect(screen.getByTestId('boton-derecho-bat')).toBeDisabled())
    expect(screen.getByTestId('boton-derecho-bat')).not.toHaveTextContent('Guardada')
    soltar()
    await waitFor(() => expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardada 16/09 09:15'))
  })
})

describe('FormularioReparacion · solicitud de pieza y solicitudes ya guardadas', () => {
  it('confirmar no llama al servidor y deja la sub-fila verde con lápiz y sin botón ámbar', async () => {
    const { llamadas } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 14')
    await userEvent.click(within(screen.getByTestId('subfila-bat')).getByRole('button', { name: 'Solicitar pieza' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Solicitar pieza — Batería' })).getByRole('button', { name: 'Confirmar: solicitar pieza' }))
    const sub = screen.getByTestId('subfila-bat')
    expect(sub).toHaveAttribute('data-variante', 'confirmada')
    expect(within(sub).getByRole('button', { name: 'Editar descripción de solicitud de Batería' })).toBeEnabled()
    expect(within(sub).queryByRole('button', { name: 'Solicitar pieza' })).not.toBeInTheDocument()
    expect(escrituras(llamadas)).toEqual([])
  })

  it('solicitud pendiente cargada del servidor: modelo deducido y bloqueado, fila con la sub-fila verde', async () => {
    abrir({ solicitudes: [solicitudAsignacion()] })
    await screen.findByRole('dialog', { name: TITULO })
    const combo = screen.getByRole('combobox', { name: 'Filtrar por modelo' })
    expect(combo).toHaveTextContent('iPhone 14')
    expect(combo).toBeDisabled()
    expect(screen.getByTestId('subfila-bat')).toHaveAttribute('data-variante', 'confirmada')
  })
})

const FILA_BAT = { idCom: 101, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'bat', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }
const FILA_LCD_14 = { idCom: 112, cantidad: 1, reutilizado: false, observacion: null, prefijo: 'lcd', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }
const FILA_ACCION = { idCom: 161, cantidad: 0, reutilizado: false, observacion: 'Limpieza de conector', prefijo: 'otro', esSolicitud: false, descripcionSolicitud: null, estadoSolicitud: null, enCamino: false }
const completa = (filas: unknown[]) => ({ metodo: 'POST', ruta: '/api/reparaciones/completa', cuerpo: { filas, imei: '355400000000111', idTec: 4, idRepAnterior: null, idAsignacion: 'A20260916_1', categoria: null } })
const agotar = (idCom: number, cantidad: number, descripcion: string | null) => ({ metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/agotar-componente', cuerpo: { idCom, cantidad, descripcion } })

const botonZona = () => within(screen.getByTestId('zona-guardar')).getByRole('button')
/** Los dos clics de "Terminar asignación". */
async function terminar() {
  await userEvent.click(botonZona())
  await userEvent.click(botonZona())
}
async function sumar(prefijo: string, tipo: string, veces = 1) {
  for (let i = 0; i < veces; i++) await userEvent.click(within(screen.getByTestId(`fila-${prefijo}`)).getByRole('button', { name: `Sumar ${tipo}` }))
}
/** Abre el diálogo de la sub-fila, escribe la descripción (si la hay) y confirma. */
async function solicitar(prefijo: string, boton: 'Solicitar pieza' | 'Solicitar y descontar stock', descripcion?: string) {
  await userEvent.click(within(screen.getByTestId(`subfila-${prefijo}`)).getByRole('button', { name: boton }))
  const dlg = within(await screen.findByRole('dialog', { name: /^Solicitar pieza — / }))
  if (descripcion) await userEvent.type(dlg.getByRole('textbox'), descripcion)
  await userEvent.click(dlg.getByRole('button', { name: /^Confirmar: / }))
}
async function escribirAccion(texto: string) {
  await userEvent.click(screen.getByRole('button', { name: '+ Añadir acción' }))
  await userEvent.type(within(screen.getByTestId('accion-1')).getByPlaceholderText('Describe la acción'), texto)
}
const cerrarAviso = () => userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))

describe('FormularioReparacion · otras acciones', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 16, 9, 15))
  })
  afterEach(() => vi.useRealTimers())

  it('"✓ Guardar" en dos clics: POST con { idCom otro, cantidad 0, prefijo "otro", observacion recortada }; la línea queda guardada', async () => {
    const { llamadas } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await escribirAccion('  Limpieza de conector  ')
    const linea = within(screen.getByTestId('accion-1'))
    await userEvent.click(linea.getByRole('button', { name: '✓ Guardar' }))
    expect(escrituras(llamadas)).toEqual([])
    await userEvent.click(linea.getByRole('button', { name: '✓ Confirmar' }))
    expect(await linea.findByText('✓ Guardada 16/09 09:15')).toBeInTheDocument()
    expect(linea.getByPlaceholderText('Describe la acción')).toBeDisabled()
    expect(escrituras(llamadas)).toEqual([
      { metodo: 'POST', ruta: '/api/reparaciones/A20260916_1/filas', cuerpo: { filas: [FILA_ACCION], imei: '355400000000111', idTec: 4, idRepAnterior: null } },
    ])
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('1')
  })

  it('error: "No se pudo guardar la acción: <mensaje>" y el botón sigue en "✓ Confirmar", rehabilitado', async () => {
    abrir()
    server.use(http.post('*/api/reparaciones/:idAsignacion/filas', () => HttpResponse.json({ message: 'Componente no válido' }, { status: 422 })))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await escribirAccion('Limpieza de conector')
    const linea = within(screen.getByTestId('accion-1'))
    await userEvent.click(linea.getByRole('button', { name: '✓ Guardar' }))
    await userEvent.click(linea.getByRole('button', { name: '✓ Confirmar' }))
    expect(await screen.findByText('No se pudo guardar la acción: Componente no válido')).toBeInTheDocument()
    await cerrarAviso()
    expect(linea.getByRole('button', { name: '✓ Confirmar' })).toBeEnabled()
    expect(linea.getByPlaceholderText('Describe la acción')).toBeEnabled()
  })
})

describe('FormularioReparacion · zona de guardar y "Terminar asignación"', () => {
  it('zona oculta sin nada activo y visible con fila activa; "Terminar asignación" → "✓  Confirmar terminar" sin vuelta atrás', async () => {
    const { llamadas } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    expect(screen.queryByTestId('zona-guardar')).not.toBeInTheDocument()
    await sumar('bat', 'Batería')
    expect(screen.getByTestId('zona-guardar')).toHaveClass('bg-form-zona-bg', 'border-form-zona-brd')
    expect(botonZona().textContent).toBe('Terminar asignación')
    expect(botonZona()).toBeEnabled()
    await userEvent.click(botonZona())
    expect(botonZona().textContent).toBe('✓  Confirmar terminar')
    expect(escrituras(llamadas)).toEqual([])
    // Desactivar la fila oculta la zona entera; al reactivarla el texto no ha vuelto atrás.
    await userEvent.click(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Restar Batería' }))
    expect(screen.queryByTestId('zona-guardar')).not.toBeInTheDocument()
    await sumar('bat', 'Batería')
    expect(botonZona().textContent).toBe('✓  Confirmar terminar')
  })

  it('orden de llamadas: agotar ×N en orden de filas, luego completa con las filas activas y las acciones pendientes; éxito: cierra', async () => {
    const { llamadas, onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    // Se preparan al revés (pantalla antes que chasis) para comprobar que manda el orden de filas.
    await sumar('lcd', 'Pantalla')
    await solicitar('lcd', 'Solicitar y descontar stock')
    await sumar('cha', 'Chasis', 2)
    await solicitar('cha', 'Solicitar y descontar stock', 'Marco doblado')
    await sumar('bat', 'Batería')
    await escribirAccion('Limpieza de conector')
    await terminar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(escrituras(llamadas)).toEqual([agotar(131, 2, 'Marco doblado'), agotar(111, 1, null), completa([FILA_BAT, FILA_ACCION])])
  })

  it('solo agotados: no se llama a completa y se cierra (cantidad 0 en la variante sin stock)', async () => {
    const { llamadas, onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 14')
    await solicitar('bat', 'Solicitar pieza')
    await terminar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(escrituras(llamadas)).toEqual([agotar(102, 0, null)])
  })

  it('solo filas guardadas: completa con filas []', async () => {
    const { llamadas, onCerrar } = abrir()
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await sumar('bat', 'Batería')
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await waitFor(() => expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'guardada'))
    expect(botonZona().textContent).toBe('Terminar asignación')
    await terminar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(escrituras(llamadas).map((l) => l.ruta)).toEqual(['/api/reparaciones/A20260916_1/filas', '/api/reparaciones/completa'])
    expect(escrituras(llamadas)[1]).toEqual(completa([]))
  })

  it('fallo en el 2.º agotado con 409: aviso "No se pudo registrar componente agotado: …", se detiene, y el reintento no repite el 1.º', async () => {
    const { llamadas, onCerrar } = abrir()
    const agotados: number[] = []
    let fallar = true
    server.use(http.post('*/api/reparaciones/:idAsignacion/agotar-componente', async ({ request }) => {
      const cuerpo = (await request.json()) as { idCom: number }
      agotados.push(cuerpo.idCom)
      if (cuerpo.idCom === 111 && fallar) { fallar = false; return HttpResponse.json({ message: 'Stock insuficiente' }, { status: 409 }) }
      return new HttpResponse(null, { status: 200 })
    }))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 13')
    await sumar('cha', 'Chasis', 2)
    await solicitar('cha', 'Solicitar y descontar stock')
    await sumar('lcd', 'Pantalla')
    await solicitar('lcd', 'Solicitar y descontar stock')
    await terminar()
    expect(await screen.findByText('No se pudo registrar componente agotado: Stock insuficiente')).toBeInTheDocument()
    expect(agotados).toEqual([131, 111])
    expect(onCerrar).not.toHaveBeenCalled()
    await cerrarAviso()
    expect(botonZona().textContent).toBe('✓  Confirmar terminar')
    await terminar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(agotados).toEqual([131, 111, 111])
    // Solo había agotados: completa no se llama en ningún intento.
    expect(escrituras(llamadas)).toEqual([])
  })

  it('fallo de agotar no 409: "Error al registrar componente agotado: …" y el formulario sigue abierto', async () => {
    const { onCerrar } = abrir()
    server.use(http.post('*/api/reparaciones/:idAsignacion/agotar-componente', () => HttpResponse.json({ message: 'Componente inactivo' }, { status: 422 })))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 14')
    await solicitar('bat', 'Solicitar pieza')
    await terminar()
    expect(await screen.findByText('Error al registrar componente agotado: Componente inactivo')).toBeInTheDocument()
    await cerrarAviso()
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
  })

  it('fallo de completa con 409: mensaje en dos líneas; el formulario sigue abierto, hacen falta otros dos clics y el reintento no repite agotados', async () => {
    const { llamadas, onCerrar } = abrir()
    let completas = 0
    let ultimoCuerpo: unknown = null
    server.use(http.post('*/api/reparaciones/completa', async ({ request }) => {
      completas++
      ultimoCuerpo = await request.json()
      return completas === 1 ? HttpResponse.json({ message: 'La asignación ya fue eliminada o completada' }, { status: 409 }) : new HttpResponse(null, { status: 200 })
    }))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 14')
    await solicitar('bat', 'Solicitar pieza')
    await sumar('lcd', 'Pantalla')
    await terminar()
    const aviso = await screen.findByText(/No se pudo guardar: La asignación ya fue eliminada o completada/)
    expect(aviso.textContent).toBe('No se pudo guardar: La asignación ya fue eliminada o completada\nCierra el formulario y comprueba el estado de la asignación.')
    expect(aviso).toHaveClass('whitespace-pre-line')
    await cerrarAviso()
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
    // El texto sigue en "✓  Confirmar terminar", pero un solo clic no ejecuta.
    expect(botonZona().textContent).toBe('✓  Confirmar terminar')
    await userEvent.click(botonZona())
    expect(completas).toBe(1)
    await userEvent.click(botonZona())
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(completas).toBe(2)
    expect(ultimoCuerpo).toEqual(completa([FILA_LCD_14]).cuerpo)
    expect(escrituras(llamadas)).toEqual([agotar(102, 0, null)])
  })

  it('fallo de completa con otro error: una sola línea', async () => {
    const { onCerrar } = abrir()
    server.use(http.post('*/api/reparaciones/completa', () => HttpResponse.json({ message: 'Stock insuficiente para lcdi14' }, { status: 422 })))
    await screen.findByRole('dialog', { name: TITULO })
    await elegirModelo('iPhone 14')
    await sumar('lcd', 'Pantalla')
    await terminar()
    const aviso = await screen.findByText(/No se pudo guardar/)
    expect(aviso.textContent).toBe('No se pudo guardar: Stock insuficiente para lcdi14')
    await cerrarAviso()
    expect(onCerrar).not.toHaveBeenCalled()
  })
})

const BORRADOR_BAT_2 = JSON.stringify({
  modelo: '13',
  filas: [{ prefijo: 'bat', idCom: 101, cantidad: 2, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: false }],
  otros: [],
})
const BORRADOR_BAT_GUARDADA = JSON.stringify({
  modelo: '13',
  filas: [{ prefijo: 'bat', idCom: 101, cantidad: 1, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: true, idRepGenerado: 'R20260916_5', fechaGuardado: '16/09 09:15' }],
  otros: [],
})

function abrirNuevo(escenario: EscenarioFormulario = {}) {
  const registro = conRegistro({ modeloTelefono: '13', ...escenario })
  server.use(...registro.handlers)
  const onCerrar = vi.fn()
  const vista = renderConProviders(<FormularioReparacion modo="nuevo" idAsignacion="A20260916_1" onCerrar={onCerrar} />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/reparar/A20260916_1' })
  return { ...vista, ...registro, onCerrar }
}
/** `conRegistro` anota `metodo` en mayúsculas (`request.method`), `ruta` = pathname y `cuerpo` = JSON recibido (null en un DELETE). */
const delBorrador = (llamadas: LlamadaRegistrada[]) => llamadas.filter((l) => l.ruta.endsWith('/borrador'))
const contenidoDe = (l: LlamadaRegistrada) => JSON.parse((l.cuerpo as { contenido: string }).contenido) as { filas: Record<string, unknown>[]; otros: Record<string, unknown>[] }
// `botonZona()` ya existe en este fichero desde la Task 15 (el botón de data-testid="zona-guardar"): se reutiliza, no se redeclara.

describe('FormularioReparacion — borrador persistente', () => {
  it('F5 o acceso directo recupera el borrador: banda "✓ Borrador recuperado" bajo los avisos y la fila con su cantidad', async () => {
    abrirNuevo({ borrador: BORRADOR_BAT_2, incidencia: 'R20260910_1' })
    const banda = await screen.findByTestId('banda-borrador')
    expect(banda.textContent).toBe('✓ Borrador recuperado')
    expect(banda).toHaveClass('bg-tipo-reparacion-bg', 'text-tipo-reparacion-text', 'text-[11px]', 'font-bold', 'w-full')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('2')
    // Justo debajo de la banda de incidencia.
    expect(screen.getByTestId('banda-incidencia').compareDocumentPosition(banda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin borrador, o con un borrador ilegible, no hay banda ni aviso', async () => {
    const { unmount } = abrirNuevo({ borrador: null })
    await screen.findByTestId('fila-bat')
    expect(screen.queryByTestId('banda-borrador')).not.toBeInTheDocument()
    unmount()
    abrirNuevo({ borrador: '{esto no es json' })
    await screen.findByTestId('fila-bat')
    expect(screen.queryByTestId('banda-borrador')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Error' })).not.toBeInTheDocument()
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
  })

  it('✕ vuelca el borrador en ese momento (PUT) y cierra sin preguntar', async () => {
    const { llamadas, onCerrar } = abrirNuevo()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(delBorrador(llamadas)).toHaveLength(1))
    expect(delBorrador(llamadas)[0]).toMatchObject({ metodo: 'PUT', ruta: '/api/reparaciones/A20260916_1/borrador' })
    expect(contenidoDe(delBorrador(llamadas)[0]).filas).toEqual([expect.objectContaining({ prefijo: 'bat', idCom: 101, cantidad: 1 })])
  })

  it('✕ con el formulario vacío borra el borrador (DELETE)', async () => {
    const { llamadas } = abrirNuevo()
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar formulario' }))
    await waitFor(() => expect(delBorrador(llamadas)).toHaveLength(1))
    expect(delBorrador(llamadas)[0]).toMatchObject({ metodo: 'DELETE', ruta: '/api/reparaciones/A20260916_1/borrador', cuerpo: null })
  })

  it('guardar una fila vuelca el borrador al momento, sin esperar los 2 s', async () => {
    const { llamadas } = abrirNuevo()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    await userEvent.click(screen.getByTestId('boton-derecho-bat'))
    // waitFor espera 1 s como mucho: si el volcado dependiera del retardo de 2 s, no llegaría.
    await waitFor(() => expect(delBorrador(llamadas)).toHaveLength(1))
    expect(contenidoDe(delBorrador(llamadas)[0]).filas).toEqual([expect.objectContaining({ prefijo: 'bat', guardada: true, idRepGenerado: 'R20260916_9' })])
  })

  it('"Terminar asignación": el DELETE del borrador va después de completa y antes de cerrar, y al desmontar no se reescribe', async () => {
    const { llamadas, onCerrar, unmount } = abrirNuevo()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(botonZona())
    await userEvent.click(botonZona())
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    const orden = llamadas.map((l) => `${l.metodo} ${l.ruta}`)
    const iCompleta = orden.indexOf('POST /api/reparaciones/completa')
    expect(iCompleta).toBeGreaterThanOrEqual(0)
    expect(orden.indexOf('DELETE /api/reparaciones/A20260916_1/borrador')).toBeGreaterThan(iCompleta)
    unmount()
    await borradorEnReposo()
    // Lo último que se hizo con el borrador fue borrarlo: el desmontaje no lo reescribe.
    expect(delBorrador(llamadas).at(-1)?.metodo).toBe('DELETE')
  })

  it('fila guardada que otro borró vuelve a editable y el borrador se reescribe; si sigue existiendo, queda bloqueada', async () => {
    const primera = abrirNuevo({ borrador: BORRADOR_BAT_GUARDADA, reparacionesImei: [] })
    await waitFor(() => expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'normal'))
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
    // La banda no desaparece mientras el formulario siga abierto, aunque el desbloqueo deje el borrador vacío.
    expect(screen.getByTestId('banda-borrador')).toBeInTheDocument()
    // El borrador queda vacío tras el desbloqueo → DELETE inmediato.
    await waitFor(() => expect(delBorrador(primera.llamadas)).toHaveLength(1))
    expect(delBorrador(primera.llamadas)[0].metodo).toBe('DELETE')
    primera.unmount()
    await borradorEnReposo()
    abrirNuevo({ borrador: BORRADOR_BAT_GUARDADA, reparacionesImei: [reparacion({ idRep: 'R20260916_5' })] })
    await waitFor(() => expect(screen.getByTestId('fila-bat')).toHaveAttribute('data-estado', 'guardada'))
    expect(screen.getByTestId('boton-derecho-bat').textContent).toBe('✓ Guardada 16/09 09:15')
  })
})

function abrirGlass(escenario: EscenarioFormulario = {}) {
  const registro = conRegistro({ asignacion: { idRep: 'AG20260916_2', imei: '355400000000222' }, modeloTelefono: '13', ...escenario })
  server.use(...registro.handlers)
  const onCerrar = vi.fn()
  const vista = renderConProviders(<FormularioReparacion modo="glass" idAsignacion="AG20260916_2" onCerrar={onCerrar} />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass/reparar/AG20260916_2' })
  return { ...vista, ...registro, onCerrar }
}

describe('FormularioReparacion — variante glass', () => {
  it('solo tiene las filas "Glass" y "Marco" (en el orden del servidor) más OTRAS ACCIONES', async () => {
    abrirGlass()
    await screen.findByTestId('fila-g')
    expect(screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))).toEqual(['fila-g', 'fila-mc'])
    expect(within(screen.getByTestId('fila-g')).getByText('Glass')).toBeInTheDocument()
    expect(within(screen.getByTestId('fila-mc')).getByText('Marco')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'SKU de Glass' })).toHaveTextContent('gi13')
    expect(screen.getByTestId('otras-acciones')).toBeInTheDocument()
  })

  it('los textos no cambian: título "Nueva reparación — IMEI …", etiqueta IMEI y "Terminar asignación"', async () => {
    abrirGlass()
    expect(await screen.findByRole('dialog', { name: 'Nueva reparación — IMEI 355400000000222' })).toBeInTheDocument()
    expect(document.title).toBe('Nueva reparación — IMEI 355400000000222')
    expect(screen.getByText('IMEI: 355400000000222')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Glass' }))
    expect(within(screen.getByTestId('zona-guardar')).getByRole('button').textContent).toBe('Terminar asignación')
  })

  it('la incidencia se pide con tipo=G y se muestra igual', async () => {
    let tipo: string | null = null
    const { handlers } = conRegistro({ asignacion: { idRep: 'AG20260916_2', imei: '355400000000222' }, modeloTelefono: '13' })
    server.use(...handlers)
    server.use(http.get('*/api/reparaciones/imei/:imei/incidencia-activa', ({ request }) => {
      tipo = new URL(request.url).searchParams.get('tipo')
      return HttpResponse.json({ value: 'G20260910_4' })
    }))
    renderConProviders(<FormularioReparacion modo="glass" idAsignacion="AG20260916_2" onCerrar={vi.fn()} />, { sesion: SESION_TEC, ruta: '/reparaciones/pendientes/glass/reparar/AG20260916_2' })
    expect((await screen.findByTestId('banda-incidencia')).textContent).toBe('⚠ Resuelve incidencia: G20260910_4')
    expect(tipo).toBe('G')
  })

  it('"✓ Guardar fila" y "Terminar asignación" no llevan categoria (el servidor la deduce del prefijo AG)', async () => {
    const { llamadas, onCerrar } = abrirGlass()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Glass' }))
    await userEvent.click(screen.getByTestId('boton-derecho-g'))
    await userEvent.click(screen.getByTestId('boton-derecho-g'))
    await waitFor(() => expect(screen.getByTestId('fila-g')).toHaveAttribute('data-estado', 'guardada'))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Marco' }))
    const zona = () => within(screen.getByTestId('zona-guardar')).getByRole('button')
    await userEvent.click(zona())
    await userEvent.click(zona())
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    const filas = llamadas.find((l) => l.ruta.endsWith('/AG20260916_2/filas'))!
    expect(filas.cuerpo).not.toHaveProperty('categoria')
    expect(filas.cuerpo).toMatchObject({ imei: '355400000000222', filas: [{ idCom: 141, cantidad: 1, prefijo: 'g', esSolicitud: false }] })
    const completa = llamadas.find((l) => l.ruta.endsWith('/completa'))!
    // El contrato marca todas las propiedades como required: "no se envía" = viaja a null.
    expect(completa.cuerpo).toMatchObject({ idAsignacion: 'AG20260916_2', categoria: null, imei: '355400000000222', filas: [{ idCom: 151, cantidad: 1, prefijo: 'mc' }] })
  })

  it('la banda de conflicto agrupa igual y excluye la propia AG', async () => {
    abrirGlass({
      activas: [
        asignacionActiva({ idRep: 'AG20260916_2', nombreTecnico: 'Técnico A', idTec: 4 }),
        asignacionActiva({ idRep: 'A20260916_7', nombreTecnico: 'Técnico H', idTec: 6 }),
        asignacionActiva({ idRep: 'AP20260916_3', nombreTecnico: 'Técnico A', idTec: 4 }),
      ],
    })
    expect((await screen.findByTestId('banda-conflicto')).textContent).toBe('⚠ Este IMEI también está asignado a — Reparación: Técnico H · Pulido: Técnico A (tú)')
  })
})

/** `extra`: handlers que deben ganar a los del escenario. Van en una SEGUNDA llamada a `server.use` (en una misma llamada gana
 *  el primero de la lista; cada llamada nueva se antepone a las anteriores) y ANTES de montar (la carga sale en el primer efecto). */
function abrirEditar(escenario: EscenarioFormulario = {}, idRep = 'R20260916_5', extra: RequestHandler[] = []) {
  const registro = conRegistro({ detalle: detalleEdicion(), yaReparados: [111], acciones: ['Limpieza de conector'], ...escenario })
  server.use(...registro.handlers)
  if (extra.length > 0) server.use(...extra)
  const onCerrar = vi.fn()
  const vista = renderConRouter([{ path: '/editar', element: <FormularioReparacion modo="editar" idRep={idRep} onCerrar={onCerrar} /> }], { sesion: SESION_SUPER, ruta: '/editar' })
  return { ...vista, ...registro, onCerrar }
}

describe('FormularioReparacion — modo edición', () => {
  it('title "Editar reparación — <idRep>", etiqueta "IMEI: …  ·  Editando <idRep>", modelo bloqueado y sin bandas ni borrador', async () => {
    const { llamadas } = abrirEditar()
    expect(await screen.findByRole('dialog', { name: 'Editar reparación — R20260916_5' })).toBeInTheDocument()
    expect(document.title).toBe('Editar reparación — R20260916_5')
    expect(screen.getByText(/^IMEI:/).textContent).toBe('IMEI: 355400000000111  ·  Editando R20260916_5')
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Filtrar por modelo' })).toHaveTextContent('iPhone 13')
    expect(screen.queryByTestId('banda-conflicto')).not.toBeInTheDocument()
    expect(screen.queryByTestId('banda-incidencia')).not.toBeInTheDocument()
    expect(screen.queryByTestId('banda-borrador')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }))
    await borradorEnReposo()
    expect(llamadas.filter((l) => l.ruta.endsWith('/borrador'))).toHaveLength(0)
  })

  it('fila editada en azul con previsión "5 → 4" en rojo; fila ya reparada con "✓  Ya reparado"; acción ya reparada con "✓ Ya reparada"', async () => {
    abrirEditar()
    expect(await screen.findByTestId('fila-bat')).toHaveAttribute('data-estado', 'editada')
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Batería' }))
    expect(screen.getByTestId('stock-bat').textContent).toBe('5 → 4')
    expect(screen.getByTestId('stock-bat')).toHaveClass('text-rojo-cancelar')
    expect(screen.getByTestId('fila-lcd')).toHaveAttribute('data-estado', 'yaReparado')
    expect(screen.getByTestId('boton-derecho-lcd').textContent).toBe('✓  Ya reparado')
    expect(within(screen.getByTestId('otras-acciones')).getByText('✓ Ya reparada')).toBeInTheDocument()
    expect(screen.getByTestId('otras-acciones-badge')).toHaveTextContent('1')
  })

  it('cambio inválido: contador en rojo y sin zona de guardar; cambio válido: "Guardar cambios"', async () => {
    abrirEditar()
    await screen.findByTestId('fila-bat')
    expect(screen.queryByTestId('zona-guardar')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Restar Batería' }))
    expect(screen.getByTestId('contador-bat')).toHaveClass('text-rojo-cancelar', 'font-bold')
    expect(screen.queryByTestId('zona-guardar')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Batería' }))
    expect(botonZona().textContent).toBe('Guardar cambios')
  })

  it('sin sub-fila de agotado aunque el SKU esté a 0, y sin "✓ Guardar fila" en una fila nueva activa', async () => {
    abrirEditar({ agrupados: { ...agrupados(), cam: [componente({ idCom: 121, tipo: 'cami13', stock: 0, stockMinimo: 1 })] } })
    await screen.findByTestId('fila-cam')
    expect(screen.queryByTestId('subfila-cam')).not.toBeInTheDocument()
    expect(screen.queryByText('Solicitar pieza')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sumar Cámara' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Chasis' }))
    expect(screen.queryByText('✓ Guardar fila')).not.toBeInTheDocument()
    expect(screen.queryByTestId('subfila-cha')).not.toBeInTheDocument()
  })

  it('editar acción: "Editando acción <idRep>", línea precargada sin papelera ni "✓ Guardar"; texto vacío oculta la zona', async () => {
    abrirEditar({ detalle: detalleEdicion({ idCom: 161, cantidad: 0, observacion: 'Cambio de tornillos' }), yaReparados: [], acciones: [] })
    const campo = await screen.findByDisplayValue('Cambio de tornillos')
    expect(screen.getByText(/^IMEI:/).textContent).toBe('IMEI: 355400000000111  ·  Editando acción R20260916_5')
    expect(screen.getAllByTestId(/^fila-/).every((f) => f.getAttribute('data-estado') !== 'editada')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Quitar acción' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '✓ Guardar' })).not.toBeInTheDocument()
    await userEvent.type(campo, ' nuevos')
    expect(botonZona().textContent).toBe('Guardar cambios')
    await userEvent.clear(campo)
    expect(screen.queryByTestId('zona-guardar')).not.toBeInTheDocument()
  })

  it('"Guardar cambios" → "✓  Confirmar terminar" → PUT, completa de filas y completa de acciones con el idTec original; cierra', async () => {
    const { llamadas, onCerrar } = abrirEditar()
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sumar Cámara' }))
    await userEvent.click(screen.getByRole('button', { name: '+ Añadir acción' }))
    // "+ Añadir acción" deja el foco en la línea nueva: se escribe directamente.
    await userEvent.keyboard('Limpieza interna')
    await userEvent.click(botonZona())
    expect(botonZona().textContent).toBe('✓  Confirmar terminar')
    await userEvent.click(botonZona())
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(llamadas.map((l) => `${l.metodo} ${l.ruta}`)).toEqual(['PUT /api/reparaciones/R20260916_5', 'POST /api/reparaciones/completa', 'POST /api/reparaciones/completa'])
    expect(llamadas[0].cuerpo).toMatchObject({ idComNuevo: 101, nNuevas: 2, esReutilizadoNuevo: false, updatedAt: '2026-09-16T07:02:00' })
    expect(llamadas[1].cuerpo).toMatchObject({ idTec: 4, idAsignacion: null, idRepAnterior: null, filas: [{ idCom: 121, cantidad: 1 }] })
    expect(llamadas[2].cuerpo).toMatchObject({ idTec: 4, idAsignacion: null, filas: [{ idCom: 161, cantidad: 0, prefijo: 'otro', observacion: 'Limpieza interna' }] })
  })

  it('409: aviso de dos líneas y el formulario sigue abierto sin recargar', async () => {
    let cargasDetalle = 0
    const { onCerrar } = abrirEditar({}, 'R20260916_5', [
      http.get('*/api/reparaciones/R20260916_5/detalle-edicion', () => { cargasDetalle++; return HttpResponse.json(detalleEdicion()) }),
      http.put('*/api/reparaciones/R20260916_5', () => HttpResponse.json({ message: 'El registro fue modificado por otro usuario' }, { status: 409 })),
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Sumar Batería' }))
    await userEvent.click(botonZona())
    await userEvent.click(botonZona())
    const aviso = await screen.findByRole('dialog', { name: 'Error' })
    expect(within(aviso).getByText(/otro usuario modificó/).textContent).toBe('No se pudo guardar: otro usuario modificó esta reparación.\nCierra y vuelve a abrir el formulario para ver los cambios actuales.')
    await userEvent.click(within(aviso).getByRole('button', { name: 'Aceptar' }))
    expect(screen.getByRole('dialog', { name: 'Editar reparación — R20260916_5' })).toBeInTheDocument()
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('2')
    expect(botonZona().textContent).toBe('✓  Confirmar terminar')
    expect(cargasDetalle).toBe(1)
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('edición de una G…: solo filas Glass y Marco', async () => {
    abrirEditar({ detalle: detalleEdicion({ idCom: 141 }), yaReparados: [], acciones: [] }, 'G20260916_3')
    expect(await screen.findByTestId('fila-g')).toHaveAttribute('data-estado', 'editada')
    expect(screen.getAllByTestId(/^fila-/).map((f) => f.getAttribute('data-testid'))).toEqual(['fila-g', 'fila-mc'])
  })

  it('fallo de carga (403 del detalle): aviso genérico y cierre', async () => {
    const { onCerrar } = abrirEditar({}, 'R20260916_5', [http.get('*/api/reparaciones/R20260916_5/detalle-edicion', () => new HttpResponse(null, { status: 403 }))])
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('No tienes permisos para realizar esta acción.')
    await waitFor(() => expect(onCerrar).toHaveBeenCalled())
  })

  it('el detalle llega vacío (la reparación ya no existe): el formulario queda sin contenido, aviso del shell y cierre', async () => {
    // `cargarEditar` convierte un detalle-edicion sin cuerpo en NoEncontradoError (Task 11): se trata como cualquier fallo de carga.
    const { onCerrar } = abrirEditar({}, 'R20260916_5', [http.get('*/api/reparaciones/R20260916_5/detalle-edicion', () => new HttpResponse(null, { status: 200 }))])
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('Recurso no encontrado.')
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog', { name: /^Editar reparación/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('fila-bat')).not.toBeInTheDocument()
  })
})
