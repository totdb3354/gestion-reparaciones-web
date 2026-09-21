import { useReducer } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { SolicitudAsignacion } from '@/shared/api/client'
import { renderConProviders } from '@/test/render'
import { agrupados, solicitudAsignacion } from '../test/fabrica'
import { estadoInicial, reducir, type AccionFormulario, type DatosNuevo } from './estado'
import { FilaComponente } from './FilaComponente'
import { SubFilaAgotado } from './SubFilaAgotado'

const datos = (solicitudes: SolicitudAsignacion[] = []): DatosNuevo => ({ modo: 'nuevo', idAsignacion: 'A20260916_1', imei: '355400000000111', agrupados: agrupados(), solicitudes, incidencia: null, modeloTelefono: null })

function Arnes({ solicitudes, acciones }: { solicitudes: SolicitudAsignacion[]; acciones: AccionFormulario[] }) {
  const [estado, dispatch] = useReducer(reducir, datos(solicitudes), (d) => acciones.reduce(reducir, estadoInicial(d)))
  return (
    <div>
      {estado.filas.map((fila) => (
        <FilaComponente key={fila.prefijo} estado={estado} fila={fila} dispatch={dispatch} onGuardarFila={() => {}}>
          <SubFilaAgotado estado={estado} fila={fila} dispatch={dispatch} />
        </FilaComponente>
      ))}
      <output data-testid="revision">{estado.revision}</output>
    </div>
  )
}
const montar = (acciones: AccionFormulario[], solicitudes: SolicitudAsignacion[] = []) => renderConProviders(<Arnes solicitudes={solicitudes} acciones={acciones} />)

// Modelo 14: batería bati14 (idCom 102) con stock 0. Modelo 13: chasis chai13negro (idCom 131) con stock 2.
const MODELO_13: AccionFormulario = { tipo: 'CAMBIAR_MODELO', modelo: '13' }
const MODELO_14: AccionFormulario = { tipo: 'CAMBIAR_MODELO', modelo: '14' }
const CHASIS_AL_LIMITE: AccionFormulario[] = [MODELO_13, { tipo: 'SUMAR', prefijo: 'cha' }, { tipo: 'SUMAR', prefijo: 'cha' }]

describe('SubFilaAgotado (ficha docs/paridad/formulario.md · Sub-fila de agotado y solicitud de pieza)', () => {
  it('variante sin stock: texto literal y botón "Solicitar pieza"', () => {
    montar([MODELO_14])
    const sub = screen.getByTestId('subfila-bat')
    expect(sub).toHaveAttribute('data-variante', 'sinStock')
    expect(sub).toHaveClass('bg-form-agotado-bg', 'pl-[70px]')
    const etiqueta = within(sub).getByText(/Sin stock disponible/)
    expect(etiqueta.textContent).toBe('⚠  Sin stock disponible. Solicita la pieza para que el admin gestione el pedido.')
    expect(etiqueta).toHaveClass('text-form-agotado-text', 'whitespace-pre-wrap')
    expect(within(sub).getByRole('button', { name: 'Solicitar pieza' })).toHaveClass('bg-ambar')
    expect(within(sub).queryByRole('button', { name: 'Editar descripción de solicitud de Batería' })).not.toBeInTheDocument()
    // Con stock de sobra no hay sub-fila.
    expect(screen.queryByTestId('subfila-lcd')).not.toBeInTheDocument()
  })

  it('variante límite: texto literal y "Solicitar y descontar stock"; convive con "✓ Guardar fila"', () => {
    montar(CHASIS_AL_LIMITE)
    const sub = screen.getByTestId('subfila-cha')
    expect(sub).toHaveAttribute('data-variante', 'limite')
    expect(within(sub).getByText(/Stock agotado/).textContent).toBe('⚠  Stock agotado. Puedes descontar los componentes fallidos y solicitar reposición.')
    expect(within(sub).getByRole('button', { name: 'Solicitar y descontar stock' })).toBeInTheDocument()
    expect(screen.getByTestId('boton-derecho-cha')).toHaveTextContent('✓ Guardar fila')
    expect(screen.queryByTestId('subfila-bat')).not.toBeInTheDocument()
  })

  it('diálogo sin stock: título "Solicitar pieza — <tipo>", dos líneas de cabecera, placeholder, "Confirmar: solicitar pieza"; Cancelar no cambia nada', async () => {
    montar([MODELO_14])
    await userEvent.click(within(screen.getByTestId('subfila-bat')).getByRole('button', { name: 'Solicitar pieza' }))
    const dlg = within(await screen.findByRole('dialog', { name: 'Solicitar pieza — Batería' }))
    expect(dlg.getByText('Sin stock disponible.')).toBeInTheDocument()
    expect(dlg.getByText('Se creará una solicitud PENDIENTE para que el admin gestione el pedido.')).toBeInTheDocument()
    const area = dlg.getByPlaceholderText('Describe la pieza que necesitas (opcional)...')
    expect(area).toHaveAttribute('rows', '4')
    expect(area).toHaveValue('')
    expect(dlg.getByRole('button', { name: 'Confirmar: solicitar pieza' })).toHaveClass('bg-ambar')
    await userEvent.click(dlg.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('subfila-bat')).toHaveAttribute('data-variante', 'sinStock')
  })

  it('diálogo límite: "Se descontarán <N> unidades…" y "Confirmar: descontar <N> ud. de stock y solicitar" con N = stock', async () => {
    montar(CHASIS_AL_LIMITE)
    await userEvent.click(within(screen.getByTestId('subfila-cha')).getByRole('button', { name: 'Solicitar y descontar stock' }))
    const dlg = within(await screen.findByRole('dialog', { name: 'Solicitar pieza — Chasis' }))
    expect(dlg.getByText('Se descontarán 2 unidades de stock y quedará una solicitud PENDIENTE.')).toBeInTheDocument()
    expect(dlg.getByText('La asignación permanecerá abierta hasta recibir la pieza.')).toBeInTheDocument()
    expect(dlg.getByRole('button', { name: 'Confirmar: descontar 2 ud. de stock y solicitar' })).toBeInTheDocument()
  })

  it('confirmar deja la sub-fila verde con lápiz y sin botón ámbar, bloquea la fila y oculta el botón derecho', async () => {
    montar([MODELO_14])
    await userEvent.click(within(screen.getByTestId('subfila-bat')).getByRole('button', { name: 'Solicitar pieza' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar: solicitar pieza' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const sub = screen.getByTestId('subfila-bat')
    expect(sub).toHaveAttribute('data-variante', 'confirmada')
    expect(sub).toHaveClass('bg-recibido-bg')
    const etiqueta = within(sub).getByText(/Solicitud de reposición pendiente/)
    expect(etiqueta.textContent).toBe('✓  Solicitud de reposición pendiente')
    expect(etiqueta).toHaveClass('font-bold', 'text-recibido-text')
    expect(within(sub).queryByRole('button', { name: 'Solicitar pieza' })).not.toBeInTheDocument()
    expect(within(sub).getByRole('button', { name: 'Editar descripción de solicitud de Batería' })).toBeEnabled()
    const bat = within(screen.getByTestId('fila-bat'))
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toBeDisabled()
    expect(bat.getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeDisabled()
    expect(bat.getByRole('button', { name: 'Añadir observación' })).toBeDisabled()
    expect(screen.queryByTestId('boton-derecho-bat')).not.toBeInTheDocument()
  })

  it('etiqueta con " — <descripción>"; en límite conserva la cantidad y el número es el stock', async () => {
    montar(CHASIS_AL_LIMITE)
    await userEvent.click(within(screen.getByTestId('subfila-cha')).getByRole('button', { name: 'Solicitar y descontar stock' }))
    const dlg = within(await screen.findByRole('dialog'))
    await userEvent.type(dlg.getByRole('textbox'), '  Marco doblado  ')
    await userEvent.click(dlg.getByRole('button', { name: 'Confirmar: descontar 2 ud. de stock y solicitar' }))
    expect(within(screen.getByTestId('subfila-cha')).getByText(/se descontarán al guardar/).textContent).toBe('✓  2 uds. se descontarán al guardar — solicitud pendiente — Marco doblado')
    expect(screen.getByTestId('contador-cha')).toHaveTextContent('2')
    expect(screen.queryByTestId('boton-derecho-cha')).not.toBeInTheDocument()
  })

  it('lápiz abre "Editar descripción de solicitud" con tres botones; "Guardar descripción" actualiza sin subir revision; "Cancelar" no cambia; "Cancelar solicitud" devuelve la sub-fila amarilla', async () => {
    montar([MODELO_14, { tipo: 'CONFIRMAR_AGOTADO', prefijo: 'bat', descripcion: 'Batería hinchada' }])
    const lapiz = () => within(screen.getByTestId('subfila-bat')).getByRole('button', { name: 'Editar descripción de solicitud de Batería' })
    const revision = screen.getByTestId('revision').textContent
    await userEvent.click(lapiz())
    let dlg = within(await screen.findByRole('dialog', { name: 'Editar descripción de solicitud' }))
    expect(dlg.getByRole('textbox')).toHaveValue('Batería hinchada')
    expect(dlg.getAllByRole('button').map((b) => b.textContent)).toEqual(['Guardar descripción', 'Cancelar solicitud', 'Cancelar'])
    expect(dlg.getByRole('button', { name: 'Guardar descripción' })).toHaveClass('bg-ambar')
    expect(dlg.getByRole('button', { name: 'Cancelar solicitud' })).toHaveClass('bg-rojo-cancelar')
    await userEvent.clear(dlg.getByRole('textbox'))
    await userEvent.type(dlg.getByRole('textbox'), 'Batería hinchada, urgente')
    await userEvent.click(dlg.getByRole('button', { name: 'Guardar descripción' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('subfila-bat')).getByText(/Solicitud de reposición/).textContent).toBe('✓  Solicitud de reposición pendiente — Batería hinchada, urgente')
    expect(screen.getByTestId('revision').textContent).toBe(revision)
    // "Cancelar" cierra sin cambios.
    await userEvent.click(lapiz())
    dlg = within(await screen.findByRole('dialog', { name: 'Editar descripción de solicitud' }))
    await userEvent.type(dlg.getByRole('textbox'), ' y algo más')
    await userEvent.click(dlg.getByRole('button', { name: 'Cancelar' }))
    expect(within(screen.getByTestId('subfila-bat')).getByText(/Solicitud de reposición/).textContent).toBe('✓  Solicitud de reposición pendiente — Batería hinchada, urgente')
    // "Cancelar solicitud" vuelve al estado anterior a confirmar.
    await userEvent.click(lapiz())
    dlg = within(await screen.findByRole('dialog', { name: 'Editar descripción de solicitud' }))
    await userEvent.click(dlg.getByRole('button', { name: 'Cancelar solicitud' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const sub = screen.getByTestId('subfila-bat')
    expect(sub).toHaveAttribute('data-variante', 'sinStock')
    expect(sub).toHaveClass('bg-form-agotado-bg')
    expect(within(sub).getByRole('button', { name: 'Solicitar pieza' })).toBeInTheDocument()
    expect(within(screen.getByTestId('fila-bat')).getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeEnabled()
  })

  it('solicitud pendiente del servidor: sub-fila verde con lápiz deshabilitado que no abre nada; Reutilizado y observación siguen activos', async () => {
    montar([], [solicitudAsignacion({ descripcionSolicitud: 'Urgente para cliente' })])
    const sub = screen.getByTestId('subfila-bat')
    expect(sub).toHaveAttribute('data-variante', 'confirmada')
    expect(within(sub).getByText(/Solicitud de reposición/).textContent).toBe('✓  Solicitud de reposición pendiente — Urgente para cliente')
    const lapiz = within(sub).getByRole('button', { name: 'Editar descripción de solicitud de Batería' })
    expect(lapiz).toBeDisabled()
    expect(lapiz).not.toHaveClass('cursor-pointer')
    await userEvent.click(lapiz)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const bat = within(screen.getByTestId('fila-bat'))
    expect(bat.getByRole('checkbox', { name: 'Reutilizado Batería' })).toBeEnabled()
    expect(bat.getByRole('button', { name: 'Añadir observación' })).toBeEnabled()
    expect(bat.getByRole('button', { name: 'Sumar Batería' })).toBeDisabled()
    expect(bat.getByRole('combobox', { name: 'SKU de Batería' })).toBeDisabled()
    expect(screen.queryByTestId('boton-derecho-bat')).not.toBeInTheDocument()
  })

  it('rechazada: SKU en rojo y sub-fila amarilla "Solicitar pieza", sin ninguna marca', () => {
    montar([], [solicitudAsignacion({ estadoSolicitud: 'RECHAZADA' })])
    const combo = within(screen.getByTestId('fila-bat')).getByRole('combobox', { name: 'SKU de Batería' })
    expect(combo).toHaveTextContent('bati14')
    expect(combo.outerHTML).toContain('text-rojo-sin-stock')
    expect(combo).toBeEnabled()
    const sub = screen.getByTestId('subfila-bat')
    expect(sub).toHaveAttribute('data-variante', 'sinStock')
    expect(within(sub).getByRole('button', { name: 'Solicitar pieza' })).toBeInTheDocument()
    expect(screen.queryByTestId('boton-derecho-bat')).not.toBeInTheDocument()
  })
})
