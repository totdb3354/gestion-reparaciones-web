import { StrictMode, useReducer } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agrupados, BORRADOR_JAVAFX, detalleEdicion } from '../test/fabrica'
import { estadoInicial, reducir, type DatosEditar, type DatosNuevo, type EstadoFormulario } from './estado'
import { borradorEnReposo, RETARDO_BORRADOR_MS, useBorrador } from './useBorrador'

// Temporizadores falsos + red real es frágil: el hook se prueba contra un ./api sustituido. El tráfico HTTP de estas tres
// funciones lo cubre api.test.tsx y, de punta a punta, FormularioReparacion.test.tsx.
const api = vi.hoisted(() => ({
  guardarBorrador: vi.fn<(idAsignacion: string, contenido: string) => Promise<void>>(),
  borrarBorrador: vi.fn<(idAsignacion: string) => Promise<void>>(),
  idsReparacionesDelImei: vi.fn<(imei: string) => Promise<string[]>>(),
}))
vi.mock('./api', () => api)

const IMEI = '355400000000111'
const ID = 'A20260916_1'

function datosNuevo(parcial: Partial<DatosNuevo> = {}): DatosNuevo {
  return { modo: 'nuevo', idAsignacion: ID, imei: IMEI, agrupados: agrupados(), solicitudes: [], incidencia: null, modeloTelefono: '13', ...parcial }
}
const DATOS_EDITAR: DatosEditar = { modo: 'editar', idRep: 'R20260916_5', detalle: detalleEdicion(), agrupados: agrupados(), yaReparados: [], accionesYaReparadas: [] }

/** Un borrador mínimo con el formato del cliente de escritorio: batería con dos unidades. */
const BORRADOR_SIMPLE = JSON.stringify({
  modelo: '13',
  filas: [{ prefijo: 'bat', idCom: 101, cantidad: 2, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: false }],
  otros: [],
})
type Guardable = { guardada: boolean; idRepGenerado?: string }
const crudo = JSON.parse(BORRADOR_JAVAFX) as { filas: Guardable[]; otros: Guardable[] }
/** Los idRep que BORRADOR_JAVAFX da por guardados (una fila y una acción). */
const IDS_GUARDADOS = [...crudo.filas, ...crudo.otros].filter((x) => x.guardada).map((x) => x.idRepGenerado ?? '?')

function montar(borradorJson: string | null, opciones: { datos?: DatosNuevo | DatosEditar; activo?: boolean; estricto?: boolean } = {}) {
  return renderHook(
    () => {
      const [estado, dispatch] = useReducer(reducir, opciones.datos ?? datosNuevo(), estadoInicial)
      const borrador = useBorrador({ estado, dispatch, borradorJson, activo: opciones.activo ?? true })
      return { estado, dispatch, borrador }
    },
    opciones.estricto ? { wrapper: StrictMode } : undefined,
  )
}
const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
/** Deja correr promesas, efectos y la cola de escrituras sin mover el reloj. */
async function asentar() {
  for (let i = 0; i < 3; i++) await act(async () => { await borradorEnReposo() })
}
const fila = (e: EstadoFormulario, prefijo: string) => e.filas.find((f) => f.prefijo === prefijo)!
const contenidoDe = (n: number) => JSON.parse(api.guardarBorrador.mock.calls[n][1]) as { modelo?: string; filas: Record<string, unknown>[]; otros: Record<string, unknown>[] }

beforeEach(() => {
  vi.useFakeTimers()
  api.guardarBorrador.mockReset().mockResolvedValue(undefined)
  api.borrarBorrador.mockReset().mockResolvedValue(undefined)
  api.idsReparacionesDelImei.mockReset().mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useBorrador (ficha docs/paridad/formulario.md, sección Borrador)', () => {
  it('RETARDO_BORRADOR_MS son 2 s', () => {
    expect(RETARDO_BORRADOR_MS).toBe(2000)
  })

  it('no escribe nada hasta 2 s después del último cambio y reinicia con cada cambio', async () => {
    const { result } = montar(null)
    expect(result.current.borrador.listo).toBe(true)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await avanzar(1500)
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await avanzar(1999)
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    await avanzar(1)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    expect(api.guardarBorrador.mock.calls[0][0]).toBe(ID)
    expect(contenidoDe(0).filas).toEqual([expect.objectContaining({ prefijo: 'bat', idCom: 101, cantidad: 2 })])
  })

  it('borrador vacío → DELETE; con contenido → PUT { contenido }', async () => {
    const { result } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await avanzar(RETARDO_BORRADOR_MS)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    expect(contenidoDe(0)).toMatchObject({
      modelo: '13',
      filas: [{ prefijo: 'bat', idCom: 101, cantidad: 1, reutilizado: false, solicitudNueva: false, agotadoConfirmado: false, guardada: false }],
      otros: [],
    })
    expect(api.borrarBorrador).not.toHaveBeenCalled()
    act(() => result.current.dispatch({ tipo: 'RESTAR', prefijo: 'bat' }))
    await avanzar(RETARDO_BORRADOR_MS)
    expect(api.borrarBorrador).toHaveBeenCalledTimes(1)
    expect(api.borrarBorrador).toHaveBeenCalledWith(ID)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
  })

  it('volcados dispara un PUT inmediato (fila guardada) y el temporizador pendiente no lo repite', async () => {
    const { result } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    act(() => result.current.dispatch({ tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' }))
    act(() => result.current.dispatch({ tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' }))
    act(() => result.current.dispatch({ tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_9', fecha: '16/09 09:15' }))
    await asentar()
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    expect(contenidoDe(0).filas).toEqual([expect.objectContaining({ prefijo: 'bat', guardada: true, idRepGenerado: 'R20260916_9', fechaGuardado: '16/09 09:15' })])
    await avanzar(5000)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
  })

  it('aplicar el borrador recuperado no dispara escritura', async () => {
    const { result } = montar(BORRADOR_SIMPLE)
    await asentar()
    expect(result.current.borrador.listo).toBe(true)
    expect(result.current.estado.borradorRecuperado).toBe(true)
    expect(fila(result.current.estado, 'bat').cantidad).toBe(2)
    await avanzar(5000)
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    expect(api.borrarBorrador).not.toHaveBeenCalled()
    expect(api.idsReparacionesDelImei).not.toHaveBeenCalled()
  })

  it('StrictMode: el montaje doble no vuelca un borrador vacío encima del que aún no se ha aplicado', async () => {
    const { result } = montar(BORRADOR_SIMPLE, { estricto: true })
    await asentar()
    await avanzar(5000)
    expect(api.borrarBorrador).not.toHaveBeenCalled()
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    expect(fila(result.current.estado, 'bat').cantidad).toBe(2)
  })

  it('borrador ilegible: formulario limpio, sin banda y sin error', async () => {
    const { result } = montar('{esto no es json')
    await asentar()
    expect(result.current.borrador.listo).toBe(true)
    expect(result.current.estado.borradorRecuperado).toBe(false)
    expect(fila(result.current.estado, 'bat').cantidad).toBe(0)
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    expect(api.borrarBorrador).not.toHaveBeenCalled()
  })

  it('banda "✓ Borrador recuperado" solo con borrador no vacío: un borrador con solo el modelo no cuenta', async () => {
    const { result } = montar(JSON.stringify({ modelo: '13', filas: [], otros: [] }))
    await asentar()
    expect(result.current.estado.borradorRecuperado).toBe(false)
    expect(result.current.borrador.listo).toBe(true)
  })

  it('con filas guardadas pide las reparaciones del IMEI; las que faltan vuelven a editables y se reescribe el borrador al momento', async () => {
    api.idsReparacionesDelImei.mockResolvedValue([])
    const { result } = montar(BORRADOR_JAVAFX)
    await asentar()
    expect(api.idsReparacionesDelImei).toHaveBeenCalledTimes(1)
    expect(api.idsReparacionesDelImei).toHaveBeenCalledWith(IMEI)
    expect(fila(result.current.estado, 'bat').guardada).toBeNull()
    expect(result.current.estado.otros.every((o) => o.guardada === null)).toBe(true)
    // Sin mover el reloj: el desbloqueo sube `volcados`.
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    expect(contenidoDe(0).filas.every((f) => f.guardada === false)).toBe(true)
    expect(contenidoDe(0).otros.every((o) => o.guardada === false)).toBe(true)
  })

  it('si las guardadas siguen existiendo, quedan bloqueadas y no se reescribe nada', async () => {
    api.idsReparacionesDelImei.mockResolvedValue(IDS_GUARDADOS)
    const { result } = montar(BORRADOR_JAVAFX)
    await asentar()
    expect(fila(result.current.estado, 'bat').guardada).toEqual({ idRep: 'R20260916_5', fecha: '16/09 09:15' })
    await avanzar(5000)
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    expect(api.borrarBorrador).not.toHaveBeenCalled()
  })

  it('si esa consulta falla, quedan bloqueadas y no hay error', async () => {
    api.idsReparacionesDelImei.mockRejectedValue(new Error('sin red'))
    const { result } = montar(BORRADOR_JAVAFX)
    await asentar()
    expect(fila(result.current.estado, 'bat').guardada).not.toBeNull()
    await avanzar(5000)
    expect(api.guardarBorrador).not.toHaveBeenCalled()
  })

  it('volcarAhora cancela el temporizador', async () => {
    const { result } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await avanzar(500)
    await act(async () => { await result.current.borrador.volcarAhora() })
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    await avanzar(5000)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
  })

  it('descartar hace DELETE y después ningún cambio vuelve a escribir, tampoco al desmontar', async () => {
    const { result, unmount } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await act(async () => { await result.current.borrador.descartar() })
    expect(api.borrarBorrador).toHaveBeenCalledTimes(1)
    expect(api.borrarBorrador).toHaveBeenCalledWith(ID)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await avanzar(5000)
    unmount()
    await asentar()
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    expect(api.borrarBorrador).toHaveBeenCalledTimes(1)
  })

  it('tras GUARDADO_COMPLETADO (borradorDescartado) tampoco escribe', async () => {
    const { result } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    act(() => result.current.dispatch({ tipo: 'GUARDADO_COMPLETADO' }))
    await avanzar(5000)
    await act(async () => { await result.current.borrador.volcarAhora() })
    expect(api.guardarBorrador).not.toHaveBeenCalled()
  })

  it('desmontar (Atrás) vuelca sin esperar los 2 s', async () => {
    const { result, unmount } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    unmount()
    await asentar()
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    expect(contenidoDe(0).filas).toEqual([expect.objectContaining({ prefijo: 'bat', cantidad: 1 })])
  })

  it('✕ y desmontaje seguidos con el mismo contenido escriben una sola vez', async () => {
    const { result, unmount } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await act(async () => { await result.current.borrador.volcarAhora() })
    unmount()
    await asentar()
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
  })

  it('un fallo del PUT no muestra nada y el volcado de cerrar lo reintenta una vez', async () => {
    api.guardarBorrador.mockRejectedValueOnce(new Error('sin red'))
    const { result } = montar(null)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'bat' }))
    await avanzar(RETARDO_BORRADOR_MS)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    await act(async () => { await result.current.borrador.volcarAhora() })
    expect(api.guardarBorrador).toHaveBeenCalledTimes(2)
    // Ya escrito: otro volcado con el mismo contenido no repite.
    await act(async () => { await result.current.borrador.volcarAhora() })
    expect(api.guardarBorrador).toHaveBeenCalledTimes(2)
  })

  it('"Guardar descripción" no reprograma el autoguardado; el cambio entra con el volcado de cerrar', async () => {
    // Modelo 14: la batería (bati14) está a 0 → variante sin stock.
    const { result } = montar(null, { datos: datosNuevo({ modeloTelefono: '14' }) })
    act(() => result.current.dispatch({ tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: 'batería original' }))
    await avanzar(RETARDO_BORRADOR_MS)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    act(() => result.current.dispatch({ tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo: 'bat', descripcion: 'batería compatible' }))
    await avanzar(5000)
    expect(api.guardarBorrador).toHaveBeenCalledTimes(1)
    await act(async () => { await result.current.borrador.volcarAhora() })
    expect(api.guardarBorrador).toHaveBeenCalledTimes(2)
    expect(contenidoDe(1).filas).toEqual([expect.objectContaining({ prefijo: 'bat', agotadoConfirmado: true, descripcionAgotado: 'batería compatible' })])
  })

  it('modo editar: el hook inactivo no llama a nada', async () => {
    const { result, unmount } = montar(null, { datos: DATOS_EDITAR, activo: false })
    expect(result.current.borrador.listo).toBe(true)
    act(() => result.current.dispatch({ tipo: 'SUMAR', prefijo: 'cam' }))
    await avanzar(5000)
    await act(async () => { await result.current.borrador.volcarAhora() })
    await act(async () => { await result.current.borrador.descartar() })
    unmount()
    await asentar()
    expect(api.guardarBorrador).not.toHaveBeenCalled()
    expect(api.borrarBorrador).not.toHaveBeenCalled()
    expect(api.idsReparacionesDelImei).not.toHaveBeenCalled()
  })
})
