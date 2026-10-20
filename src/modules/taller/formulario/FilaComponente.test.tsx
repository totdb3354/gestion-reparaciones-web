import { useReducer } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SolicitudAsignacion } from '@/shared/api/client'
import { renderConProviders } from '@/test/render'
import { agrupados, componente, detalleEdicion, solicitudAsignacion } from '../test/fabrica'
import { estadoInicial, reducir, type AccionFormulario, type DatosEditar, type DatosNuevo, type EstadoFormulario } from './estado'
import { FilaComponente } from './FilaComponente'

const datos = (solicitudes: SolicitudAsignacion[]): DatosNuevo => ({ modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000111', agrupados: agrupados(), solicitudes, incidencia: null, modeloTelefono: null })

/** Arnés: el reductor real con las filas pintadas. "Guardar fila" aquí solo pide la confirmación (el POST es de useGuardado). */
function Arnes({ acciones, solicitudes, alGuardar }: { acciones: AccionFormulario[]; solicitudes: SolicitudAsignacion[]; alGuardar: (prefijo: string) => void }) {
  const [estado, dispatch] = useReducer(reducir, datos(solicitudes), (d) => acciones.reduce(reducir, estadoInicial(d)))
  return (
    <div>
      {estado.filas.map((fila) => (
        <FilaComponente
          key={fila.prefijo}
          estado={estado}
          fila={fila}
          dispatch={dispatch}
          onGuardarFila={(prefijo) => { alGuardar(prefijo); dispatch({ tipo: 'PEDIR_CONFIRMACION_FILA', prefijo }) }}
        />
      ))}
    </div>
  )
}

function montar(acciones: AccionFormulario[], solicitudes: SolicitudAsignacion[] = []) {
  const alGuardar = vi.fn()
  renderConProviders(<Arnes acciones={acciones} solicitudes={solicitudes} alGuardar={alGuardar} />)
  return { alGuardar }
}
const MODELO_13: AccionFormulario = { tipo: 'CAMBIAR_MODELO', modelo: '13' }
const MODELO_14: AccionFormulario = { tipo: 'CAMBIAR_MODELO', modelo: '14' }

describe('FilaComponente (ficha docs/paridad/formulario.md · Filas de componente)', () => {
  it('pinta contador, nombre, los dos botones de la elección (0.9.19: sin elegir no hay combo), stock y "Añadir observación"', () => {
    montar([MODELO_13])
    const fila = screen.getByTestId('fila-bat')
    expect(fila).toHaveAttribute('data-estado', 'normal')
    expect(fila).toHaveClass('bg-fondo-input', 'border-form-fila-brd')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
    expect(screen.getByTestId('contador-bat')).toHaveClass('text-gris-borde')
    expect(within(fila).getByText('Batería')).toBeInTheDocument()
    expect(within(fila).queryByRole('combobox', { name: 'SKU de Batería' })).not.toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Nueva Batería' })).toBeEnabled()
    expect(within(fila).getByRole('button', { name: 'Reutilizada Batería' })).toBeEnabled()
    expect(screen.getByTestId('stock-bat')).toHaveTextContent('5')
    expect(within(fila).getByRole('button', { name: 'Añadir observación' })).toBeEnabled()
    expect(within(fila).getByRole('button', { name: 'Restar Batería' })).toBeDisabled()
    expect(screen.queryByTestId('boton-derecho-bat')).not.toBeInTheDocument()
  })

  it('el SKU sin stock sale en rojo y el bajo en ámbar, en la lista y en el botón', async () => {
    montar([])
    await userEvent.click(within(screen.getByTestId('fila-bat')).getByRole('button', { name: 'Nueva Batería' })) // sin elegir no hay combo
    const combo = within(screen.getByTestId('fila-bat')).getByRole('combobox', { name: 'SKU de Batería' })
    await userEvent.click(combo)
    const opciones = await screen.findAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['bati13', 'bati14', 'bati13promax'])
    expect(opciones[1].outerHTML).toContain('text-rojo-sin-stock')
    expect(opciones[2].outerHTML).toContain('text-fila-solicitud-brd')
    // El onClick vive en el <button> interior de cada <li role="option">: clicar la option no selecciona nada.
    await userEvent.click(screen.getByRole('button', { name: 'bati14' }))
    expect(screen.getByTestId('stock-bat')).toHaveTextContent('0')
    expect(combo).toHaveTextContent('bati14')
    expect(combo.outerHTML).toContain('text-rojo-sin-stock')
  })

  it('fila sin SKU: atenuada y todo deshabilitado, stock "—"', () => {
    montar([MODELO_14])
    const fila = screen.getByTestId('fila-cha')
    expect(fila).toHaveAttribute('data-estado', 'sinSku')
    expect(fila).toHaveClass('opacity-40')
    expect(screen.getByTestId('stock-cha')).toHaveTextContent('—')
    // 0.9.19: sin elegir no hay combo; la celda del SKU lleva los dos botones, deshabilitados, y no hay casilla.
    expect(within(fila).queryByRole('combobox', { name: 'SKU de Chasis' })).not.toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Nueva Chasis' })).toBeDisabled()
    expect(within(fila).getByRole('button', { name: 'Reutilizada Chasis' })).toBeDisabled()
    expect(within(fila).getByRole('button', { name: 'Sumar Chasis' })).toBeDisabled()
    expect(within(fila).getByRole('button', { name: 'Restar Chasis' })).toBeDisabled()
    expect(within(fila).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: 'Añadir observación' })).toBeDisabled()
  })

  it('+ y - despachan y respetan el deshabilitado', async () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Nueva Batería' }))
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('1')
    expect(screen.getByTestId('contador-bat')).toHaveClass('text-texto-incidencia')
    expect(bat.queryByRole('button', { name: 'Reutilizada Batería' })).not.toBeInTheDocument()
    await userEvent.click(bat.getByRole('button', { name: 'Restar Batería' }))
    // 0.9.19 (cambio 1): «−» hasta 0 deja la fila sin elegir.
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
    expect(bat.getByRole('button', { name: 'Reutilizada Batería' })).toBeEnabled()
    // Pantalla: stock 1 → tras sumar una, "+" se deshabilita.
    const lcd = within(screen.getByTestId('fila-lcd'))
    await userEvent.click(lcd.getByRole('button', { name: 'Nueva Pantalla' }))
    expect(lcd.getByRole('button', { name: 'Sumar Pantalla' })).toBeDisabled()
    // Reutilizada deshabilita + y -.
    const cam = within(screen.getByTestId('fila-cam'))
    await userEvent.click(cam.getByRole('button', { name: 'Reutilizada Cámara' }))
    expect(screen.getByTestId('marca-cam')).toHaveTextContent('↺ Reutilizada')
    expect(cam.getByRole('button', { name: 'Sumar Cámara' })).toBeDisabled()
    expect(cam.getByRole('button', { name: 'Restar Cámara' })).toBeDisabled()
  })

  it('diálogo Observación: cabecera "Observación para: <tipo>", guarda recortado, vacío no cambia, Cancelar', async () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    // Vacío: cierra sin cambiar nada.
    await userEvent.click(bat.getByRole('button', { name: 'Añadir observación' }))
    let dlg = within(await screen.findByRole('dialog', { name: 'Observación para: Batería' }))
    expect(dlg.getByRole('textbox')).toHaveValue('')
    expect(dlg.getByRole('textbox')).toHaveAttribute('rows', '5')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bat.getByRole('button', { name: 'Añadir observación' })).toBeInTheDocument()
    // Cancelar: tampoco cambia.
    await userEvent.click(bat.getByRole('button', { name: 'Añadir observación' }))
    dlg = within(await screen.findByRole('dialog', { name: 'Observación para: Batería' }))
    await userEvent.type(dlg.getByRole('textbox'), 'No se guarda')
    await userEvent.click(dlg.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bat.queryByText('No se guarda')).not.toBeInTheDocument()
    // Con texto: lo guarda recortado.
    await userEvent.click(bat.getByRole('button', { name: 'Añadir observación' }))
    dlg = within(await screen.findByRole('dialog', { name: 'Observación para: Batería' }))
    expect(dlg.getByRole('textbox')).toHaveValue('')
    await userEvent.type(dlg.getByRole('textbox'), '  Conector sucio  ')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bat.getByText('Conector sucio').textContent).toBe('Conector sucio')
  })

  it('con observación: texto, papelera y sin botón de añadir; la papelera la borra sin confirmación', async () => {
    montar([MODELO_13, { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'Conector sucio' }])
    const bat = within(screen.getByTestId('fila-bat'))
    expect(bat.getByText('Conector sucio')).toHaveClass('truncate', 'text-texto-incidencia')
    expect(bat.queryByRole('button', { name: 'Añadir observación' })).not.toBeInTheDocument()
    await userEvent.click(bat.getByRole('button', { name: 'Borrar observación de Batería' }))
    expect(bat.queryByText('Conector sucio')).not.toBeInTheDocument()
    expect(bat.getByRole('button', { name: 'Añadir observación' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"✓ Guardar fila" aparece con la fila activa, pasa a "✓ Confirmar" y cualquier cambio lo devuelve', async () => {
    const { alGuardar } = montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Nueva Batería' }))
    const boton = screen.getByTestId('boton-derecho-bat')
    expect(boton).toHaveTextContent('✓ Guardar fila')
    expect(boton).toHaveClass('bg-azul-noche', 'h-[27px]')
    await userEvent.click(boton)
    expect(alGuardar).toHaveBeenCalledWith('bat')
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Confirmar')
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    expect(screen.getByTestId('boton-derecho-bat')).toHaveTextContent('✓ Guardar fila')
    await userEvent.click(bat.getByRole('button', { name: 'Restar Batería' }))
    await userEvent.click(bat.getByRole('button', { name: 'Restar Batería' }))
    expect(screen.queryByTestId('boton-derecho-bat')).not.toBeInTheDocument()
    // Con "Reutilizada" también se ofrece.
    await userEvent.click(within(screen.getByTestId('fila-lcd')).getByRole('button', { name: 'Reutilizada Pantalla' }))
    expect(screen.getByTestId('boton-derecho-lcd')).toHaveTextContent('✓ Guardar fila')
  })

  it('fila guardada: verde, "✓ Guardada dd/MM HH:mm" y todo deshabilitado, también la papelera', () => {
    montar([
      MODELO_13,
      { tipo: 'ELEGIR', prefijo: 'bat', eleccion: 'nueva' },
      { tipo: 'PONER_OBSERVACION', prefijo: 'bat', texto: 'Conector sucio' },
      { tipo: 'PEDIR_CONFIRMACION_FILA', prefijo: 'bat' },
      { tipo: 'INICIO_GUARDAR_FILA', prefijo: 'bat' },
      { tipo: 'FILA_GUARDADA', prefijo: 'bat', idRep: 'R20260916_5', fecha: '16/09 09:15' },
    ])
    const fila = screen.getByTestId('fila-bat')
    expect(fila).toHaveAttribute('data-estado', 'guardada')
    expect(fila).toHaveClass('bg-form-guardada-bg', 'border-fila-reparado-brd')
    const boton = screen.getByTestId('boton-derecho-bat')
    expect(boton).toHaveTextContent('✓ Guardada 16/09 09:15')
    expect(boton).toBeDisabled()
    expect(boton).toHaveClass('bg-recibido-bg', 'text-recibido-text')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('1')
    const bat = within(fila)
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toBeDisabled()
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeDisabled()
    expect(bat.getByRole('button', { name: 'Restar Batería' })).toBeDisabled()
    expect(screen.getByTestId('marca-bat')).toHaveTextContent('+ Nueva')
    expect(bat.queryByRole('button', { name: 'Volver atrás Batería' })).not.toBeInTheDocument()
    expect(bat.getByRole('button', { name: 'Borrar observación de Batería' })).toBeDisabled()
  })

  it('en camino: botón derecho "⚠ En camino" deshabilitado y sin "↺ Reutilizada"', () => {
    montar([], [solicitudAsignacion({ enCamino: true })])
    const boton = screen.getByTestId('boton-derecho-bat')
    expect(boton).toHaveTextContent('⚠ En camino')
    expect(boton).toBeDisabled()
    expect(boton).toHaveClass('bg-tipo-reparacion-bg', 'text-tipo-reparacion-text', 'rounded-none')
    expect(within(screen.getByTestId('fila-bat')).queryByRole('button', { name: 'Reutilizada Batería' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('marca-bat')).not.toBeInTheDocument()
  })

  it('recibido: "✓ Recibido" deshabilitado en una fila editable; al activarla pasa a "✓ Guardar fila" y ya no vuelve', async () => {
    // lcdi14 (idCom 112) tiene stock 3: GESTIONADA con stock = recibido.
    montar([], [solicitudAsignacion({ idCom: 112, estadoSolicitud: 'GESTIONADA' })])
    const boton = screen.getByTestId('boton-derecho-lcd')
    expect(boton).toHaveTextContent('✓ Recibido')
    expect(boton).toBeDisabled()
    expect(boton).toHaveClass('bg-recibido-bg', 'text-recibido-text')
    const lcd = within(screen.getByTestId('fila-lcd'))
    expect(screen.getByTestId('fila-lcd')).toHaveAttribute('data-estado', 'normal')
    await userEvent.click(lcd.getByRole('button', { name: 'Nueva Pantalla' }))
    expect(screen.getByTestId('boton-derecho-lcd')).toHaveTextContent('✓ Guardar fila')
    await userEvent.click(lcd.getByRole('button', { name: 'Restar Pantalla' }))
    expect(screen.queryByTestId('boton-derecho-lcd')).not.toBeInTheDocument()
  })
})

function estadoEditar(parcial: Partial<DatosEditar> = {}): EstadoFormulario {
  return estadoInicial({ modo: 'editar', idRep: 'R20260916_5', detalle: detalleEdicion(), agrupados: agrupados(), yaReparados: [111], accionesYaReparadas: [], ...parcial })
}
function pintarFila(estado: EstadoFormulario, prefijo: string) {
  const fila = estado.filas.find((f) => f.prefijo === prefijo)!
  return renderConProviders(<FilaComponente estado={estado} fila={fila} dispatch={vi.fn()} onGuardarFila={vi.fn()} />)
}

describe('FilaComponente — modo edición', () => {
  it('fila editada en azul, con SKU, cantidad y previsión "5 → 5" en gris; sin botón derecho', () => {
    pintarFila(estadoEditar(), 'bat')
    const fila = screen.getByTestId('fila-bat')
    expect(fila).toHaveAttribute('data-estado', 'editada')
    expect(fila).toHaveClass('border-b', 'bg-fila-edicion-bg', 'border-fila-edicion-brd')
    expect(screen.getByRole('combobox', { name: 'SKU de Batería' })).toHaveTextContent('bati13')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('1')
    expect(screen.getByTestId('stock-bat').textContent).toBe('5 → 5')
    expect(screen.getByTestId('stock-bat')).toHaveClass('font-bold', 'text-azul-gris')
    expect(screen.getByTestId('marca-bat')).toHaveTextContent('+ Nueva')
    expect(screen.queryByText('✓ Guardar fila')).not.toBeInTheDocument()
  })

  it('previsión "5 → 4" en rojo al sumar y "5 → 6" en verde al restar', () => {
    const mas = reducir(estadoEditar(), { tipo: 'SUMAR', prefijo: 'bat' })
    const primera = pintarFila(mas, 'bat')
    expect(screen.getByTestId('stock-bat').textContent).toBe('5 → 4')
    expect(screen.getByTestId('stock-bat')).toHaveClass('text-rojo-cancelar')
    primera.unmount()
    pintarFila(reducir(estadoEditar(), { tipo: 'RESTAR', prefijo: 'bat' }), 'bat')
    expect(screen.getByTestId('stock-bat').textContent).toBe('5 → 6')
    expect(screen.getByTestId('stock-bat')).toHaveClass('text-verde-ok')
  })

  it('cambio inválido (cantidad 0 sin Reutilizado): contador en rojo y negrita', () => {
    pintarFila(reducir(estadoEditar(), { tipo: 'RESTAR', prefijo: 'bat' }), 'bat')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
    expect(screen.getByTestId('contador-bat')).toHaveClass('text-rojo-cancelar', 'font-bold')
  })

  it('fila ya reparada: verde, todo deshabilitado y "✓  Ya reparado" al final', () => {
    pintarFila(estadoEditar(), 'lcd')
    const fila = screen.getByTestId('fila-lcd')
    expect(fila).toHaveAttribute('data-estado', 'yaReparado')
    expect(fila).toHaveClass('border-b', 'bg-fila-reparado-bg', 'border-fila-reparado-brd')
    expect(screen.getByTestId('boton-derecho-lcd').textContent).toBe('✓  Ya reparado')
    expect(screen.getByTestId('boton-derecho-lcd')).toHaveClass('text-[11px]', 'font-bold', 'text-verde-ok')
    expect(screen.getByRole('button', { name: 'Sumar Pantalla' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Restar Pantalla' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'SKU de Pantalla' })).toBeDisabled()
    expect(screen.queryByTestId('marca-lcd')).not.toBeInTheDocument()
  })

  it('fila nueva activa en edición: fondo normal, sin "✓ Guardar fila"; con el SKU a 0, "+" deshabilitado', () => {
    const activa = pintarFila(reducir(estadoEditar(), { tipo: 'ELEGIR', prefijo: 'cam', eleccion: 'nueva' }), 'cam')
    expect(screen.getByTestId('fila-cam')).toHaveAttribute('data-estado', 'normal')
    expect(screen.getByTestId('contador-cam')).toHaveTextContent('1')
    expect(screen.queryByText('✓ Guardar fila')).not.toBeInTheDocument()
    expect(screen.getByTestId('stock-cam').textContent).toBe('4 → 3') // 0.9.19 (cambio 9): también la Nueva sin guardar
    activa.unmount()
    const sinStock = { ...agrupados(), cam: [componente({ idCom: 121, tipo: 'cami13', stock: 0, stockMinimo: 1 })] }
    pintarFila(estadoEditar({ agrupados: sinStock }), 'cam')
    expect(screen.getByRole('button', { name: 'Sumar Cámara' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Nueva Cámara' })).toBeDisabled()
  })

  it('fila ya reparada de un tipo sin SKU para el modelo elegido: se pinta yaReparado (verde), no sinSku (gris atenuado)', () => {
    // Se edita una pantalla del modelo 14 (idCom 112, lcdi14); el chasis "ya reparado" es de OTRO modelo (chai13negro,
    // idCom 131, el único SKU del grupo 'cha' — no hay ninguno para el modelo 14): sus opciones para ese modelo están
    // vacías (filaSinSku), pero la fila sigue siendo "ya reparada" y debe pintarse como tal, no como "sin SKU".
    pintarFila(estadoEditar({ detalle: detalleEdicion({ idCom: 112 }), yaReparados: [131] }), 'cha')
    const fila = screen.getByTestId('fila-cha')
    expect(fila).toHaveAttribute('data-estado', 'yaReparado')
    expect(fila).toHaveClass('bg-fila-reparado-bg', 'border-fila-reparado-brd')
    expect(fila).not.toHaveClass('opacity-40')
    expect(screen.getByTestId('boton-derecho-cha').textContent).toBe('✓  Ya reparado')
  })

  it('fila de chasis ya reparada del mismo modelo (con opciones y sin SKU elegido): el combo enseña «—», no «— Elige color —»', () => {
    // Se edita una batería del modelo 13; el chasis chai13negro (131) ya está reparado: la fila tiene opciones pero está bloqueada.
    const estado = estadoEditar({ yaReparados: [131] })
    const chasis = estado.filas.find((f) => f.prefijo === 'cha')!
    expect(chasis).toMatchObject({ rol: 'yaReparado', idCom: null })
    expect(chasis.opciones.length).toBeGreaterThan(0)
    pintarFila(estado, 'cha')
    expect(screen.getByRole('combobox', { name: 'SKU de Chasis' })).toHaveTextContent(/^—$/)
  })
})

describe('0.9.19 · la elección en la celda del SKU (spec §2)', () => {
  it('sin elegir: «+ Nueva» y «↺ Reutilizada» en lugar del desplegable; contador apagado y sin marca', () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    expect(bat.queryByRole('combobox', { name: 'SKU de Batería' })).not.toBeInTheDocument()
    expect(bat.getByRole('button', { name: 'Nueva Batería' })).toHaveTextContent('+ Nueva')
    expect(bat.getByRole('button', { name: 'Reutilizada Batería' })).toHaveTextContent('↺ Reutilizada')
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeDisabled()
    expect(screen.queryByTestId('marca-bat')).not.toBeInTheDocument()
  })

  it('«Nueva»: desplegable, contador en 1, «5 → 4» y marca con «×» que vuelve atrás', async () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Nueva Batería' }))
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toHaveTextContent('bati13')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('1')
    expect(screen.getByTestId('stock-bat')).toHaveTextContent('5 → 4')
    expect(screen.getByTestId('marca-bat')).toHaveTextContent('+ Nueva')
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeEnabled()
    await userEvent.click(bat.getByRole('button', { name: 'Volver atrás Batería' }))
    expect(bat.getByRole('button', { name: 'Nueva Batería' })).toBeInTheDocument()
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
  })

  it('«Reutilizada»: contador «—», sin «+», stock sin flecha y marca «↺ Reutilizada»', async () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Reutilizada Batería' }))
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('—')
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeDisabled()
    expect(screen.getByTestId('stock-bat')).toHaveTextContent(/^5$/)
    expect(screen.getByTestId('marca-bat')).toHaveTextContent('↺ Reutilizada')
  })

  it('ningún SKU con stock: «Solicitar pieza» abre el diálogo y la fila queda «Solicitada»; cancelar no cambia nada', async () => {
    montar([MODELO_14]) // bati14: stock 0, el único del modelo
    const bat = within(screen.getByTestId('fila-bat'))
    expect(bat.queryByRole('button', { name: 'Nueva Batería' })).not.toBeInTheDocument()
    await userEvent.click(bat.getByRole('button', { name: 'Solicitar pieza Batería' }))
    let dlg = within(await screen.findByRole('dialog', { name: 'Solicitar pieza — Batería' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Cancelar' }))
    expect(bat.getByRole('button', { name: 'Solicitar pieza Batería' })).toBeInTheDocument()
    await userEvent.click(bat.getByRole('button', { name: 'Solicitar pieza Batería' }))
    dlg = within(await screen.findByRole('dialog', { name: 'Solicitar pieza — Batería' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar: solicitar pieza' }))
    expect(screen.getByTestId('marca-bat')).toHaveTextContent('Solicitada')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
  })

  it('la × de «Solicitada» explica que cancela la solicitud; la de «+ Nueva» no', async () => {
    montar([MODELO_14])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Solicitar pieza Batería' }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Solicitar pieza — Batería' })).getByRole('button', { name: 'Confirmar: solicitar pieza' }))
    expect(bat.getByRole('button', { name: 'Volver atrás Batería' })).toHaveAttribute('title', 'Volver atrás: cancela la solicitud y la fila queda como al principio')
  })

  it('la × de «+ Nueva» conserva su texto de siempre', async () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Nueva Batería' }))
    expect(bat.getByRole('button', { name: 'Volver atrás Batería' })).toHaveAttribute('title', 'Volver atrás: la fila queda como al principio')
  })

  it('solicitud guardada pendiente: SKU fijo y «↺ Reutilizada» en «Pieza»; en camino, sin botón', async () => {
    montar([], [solicitudAsignacion()]) // pendiente de bati14 → modelo 14
    const bat = within(screen.getByTestId('fila-bat'))
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toBeDisabled()
    expect(screen.queryByTestId('marca-bat')).not.toBeInTheDocument()
    await userEvent.click(bat.getByRole('button', { name: 'Reutilizada Batería' }))
    expect(screen.getByTestId('marca-bat')).toHaveTextContent('↺ Reutilizada')
    await userEvent.click(bat.getByRole('button', { name: 'Volver atrás Batería' }))
    expect(bat.getByRole('button', { name: 'Reutilizada Batería' })).toBeInTheDocument()
  })

  it('solicitud en camino: sin «↺ Reutilizada»', () => {
    montar([], [solicitudAsignacion({ enCamino: true })])
    expect(within(screen.getByTestId('fila-bat')).queryByRole('button', { name: 'Reutilizada Batería' })).not.toBeInTheDocument()
  })

  it('chasis: «Nueva» enseña «— Elige color —»; al elegirlo, el contador pasa a 1', async () => {
    montar([MODELO_13])
    const cha = within(screen.getByTestId('fila-cha'))
    await userEvent.click(cha.getByRole('button', { name: 'Nueva Chasis' }))
    const combo = cha.getByRole('combobox', { name: 'SKU de Chasis' })
    expect(combo).toHaveTextContent('— Elige color —')
    expect(screen.getByTestId('contador-cha')).toHaveTextContent('0')
    await userEvent.click(combo)
    // chai13negro: «negro» no está en la tabla de colores, así que la opción se llama por su token (opcionesSku).
    await userEvent.click(within(await screen.findByRole('listbox', { name: 'SKU de Chasis' })).getByRole('button', { name: 'negro' }))
    expect(screen.getByTestId('contador-cha')).toHaveTextContent('1')
    expect(cha.getByRole('button', { name: 'Añadir observación' })).toBeEnabled()
  })

  it('chasis sin ningun color con stock: «Solicitar Chasis» elige Nueva y enseña «— Elige color —» (no abre dialogo)', async () => {
    const a = agrupados()
    a.cha = a.cha.map((c) => ({ ...c, stock: 0 }))
    const d: DatosNuevo = { ...datos([]), agrupados: a }
    const Sin = () => {
      const [estado, dispatch] = useReducer(reducir, d, (x) => [MODELO_13].reduce(reducir, estadoInicial(x)))
      return <div>{estado.filas.map((f) => <FilaComponente key={f.prefijo} estado={estado} fila={f} dispatch={dispatch} onGuardarFila={() => {}} />)}</div>
    }
    renderConProviders(<Sin />)
    const cha = within(screen.getByTestId('fila-cha'))
    await userEvent.click(cha.getByRole('button', { name: 'Solicitar pieza Chasis' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cha.getByRole('combobox', { name: 'SKU de Chasis' })).toHaveTextContent('— Elige color —')
  })
})
