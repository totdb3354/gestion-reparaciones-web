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
  it('pinta contador, nombre, SKU, stock, Reutilizado y "Añadir observación"', () => {
    montar([MODELO_13])
    const fila = screen.getByTestId('fila-bat')
    expect(fila).toHaveAttribute('data-estado', 'normal')
    expect(fila).toHaveClass('bg-fondo-input', 'border-form-fila-brd')
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
    expect(screen.getByTestId('contador-bat')).toHaveClass('text-gris-borde')
    expect(within(fila).getByText('Batería')).toBeInTheDocument()
    expect(within(fila).getByRole('combobox', { name: 'SKU de Batería' })).toHaveTextContent('bati13')
    expect(screen.getByTestId('stock-bat')).toHaveTextContent('5')
    expect(within(fila).getByText('Reutilizado')).toBeInTheDocument()
    expect(within(fila).getByRole('checkbox', { name: 'Reutilizado Batería' })).not.toBeChecked()
    expect(within(fila).getByRole('button', { name: 'Añadir observación' })).toBeEnabled()
    expect(within(fila).getByRole('button', { name: 'Restar Batería' })).toBeDisabled()
    expect(screen.queryByTestId('boton-derecho-bat')).not.toBeInTheDocument()
  })

  it('el SKU sin stock sale en rojo y el bajo en ámbar, en la lista y en el botón', async () => {
    montar([])
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
    const combo = within(fila).getByRole('combobox', { name: 'SKU de Chasis' })
    expect(combo).toBeDisabled()
    expect(combo).toHaveTextContent('—')
    expect(within(fila).getByRole('button', { name: 'Sumar Chasis' })).toBeDisabled()
    expect(within(fila).getByRole('button', { name: 'Restar Chasis' })).toBeDisabled()
    expect(within(fila).getByRole('checkbox', { name: 'Reutilizado Chasis' })).toBeDisabled()
    expect(within(fila).getByRole('button', { name: 'Añadir observación' })).toBeDisabled()
  })

  it('+ y - despachan y respetan el deshabilitado', async () => {
    montar([MODELO_13])
    const bat = within(screen.getByTestId('fila-bat'))
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('1')
    expect(screen.getByTestId('contador-bat')).toHaveClass('text-texto-incidencia')
    expect(bat.getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeDisabled()
    await userEvent.click(bat.getByRole('button', { name: 'Restar Batería' }))
    expect(screen.getByTestId('contador-bat')).toHaveTextContent('0')
    expect(bat.getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeEnabled()
    // Pantalla: stock 1 → tras sumar una, "+" se deshabilita.
    const lcd = within(screen.getByTestId('fila-lcd'))
    await userEvent.click(lcd.getByRole('button', { name: 'Sumar Pantalla' }))
    expect(lcd.getByRole('button', { name: 'Sumar Pantalla' })).toBeDisabled()
    // Reutilizado deshabilita + y -.
    const cam = within(screen.getByTestId('fila-cam'))
    await userEvent.click(cam.getByRole('checkbox', { name: 'Reutilizado Cámara' }))
    expect(cam.getByRole('checkbox', { name: 'Reutilizado Cámara' })).toBeChecked()
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
    await userEvent.click(bat.getByRole('button', { name: 'Sumar Batería' }))
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
    // Con "Reutilizado" también se ofrece.
    await userEvent.click(within(screen.getByTestId('fila-lcd')).getByRole('checkbox', { name: 'Reutilizado Pantalla' }))
    expect(screen.getByTestId('boton-derecho-lcd')).toHaveTextContent('✓ Guardar fila')
  })

  it('fila guardada: verde, "✓ Guardada dd/MM HH:mm" y todo deshabilitado, también la papelera', () => {
    montar([
      MODELO_13,
      { tipo: 'SUMAR', prefijo: 'bat' },
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
    expect(bat.getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeDisabled()
    expect(bat.getByRole('button', { name: 'Borrar observación de Batería' })).toBeDisabled()
  })

  it('en camino: botón derecho "⚠ En camino" deshabilitado y Reutilizado deshabilitado', () => {
    montar([], [solicitudAsignacion({ enCamino: true })])
    const boton = screen.getByTestId('boton-derecho-bat')
    expect(boton).toHaveTextContent('⚠ En camino')
    expect(boton).toBeDisabled()
    expect(boton).toHaveClass('bg-tipo-reparacion-bg', 'text-tipo-reparacion-text', 'rounded-none')
    const casilla = within(screen.getByTestId('fila-bat')).getByRole('checkbox', { name: 'Reutilizado Batería' })
    expect(casilla).toBeDisabled()
    expect(casilla).not.toBeChecked()
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
    await userEvent.click(lcd.getByRole('button', { name: 'Sumar Pantalla' }))
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
    expect(screen.getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeDisabled()
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
    expect(screen.getByRole('checkbox', { name: 'Reutilizado Pantalla' })).toBeDisabled()
  })

  it('fila nueva activa en edición: fondo normal, sin "✓ Guardar fila"; con el SKU a 0, "+" deshabilitado', () => {
    const activa = pintarFila(reducir(estadoEditar(), { tipo: 'SUMAR', prefijo: 'cam' }), 'cam')
    expect(screen.getByTestId('fila-cam')).toHaveAttribute('data-estado', 'normal')
    expect(screen.getByTestId('contador-cam')).toHaveTextContent('1')
    expect(screen.queryByText('✓ Guardar fila')).not.toBeInTheDocument()
    expect(screen.getByTestId('stock-cam').textContent).toBe('4')
    activa.unmount()
    const sinStock = { ...agrupados(), cam: [componente({ idCom: 121, tipo: 'cami13', stock: 0, stockMinimo: 1 })] }
    pintarFila(estadoEditar({ agrupados: sinStock }), 'cam')
    expect(screen.getByRole('button', { name: 'Sumar Cámara' })).toBeDisabled()
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
})
