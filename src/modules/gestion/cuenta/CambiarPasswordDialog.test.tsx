import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderConProviders, SESION_TEC } from '@/test/render'
import { server } from '@/test/server'
import { CambiarPasswordDialog } from './CambiarPasswordDialog'

/** Registra los cuerpos de cada PATCH; por defecto responde 204. */
function registrarCambio(respuesta: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 })) {
  const cuerpos: unknown[] = []
  server.use(
    http.patch('*/api/auth/cambiar-password', async ({ request }) => {
      cuerpos.push(await request.json())
      return respuesta()
    }),
  )
  return cuerpos
}

function abrir(onCerrar = vi.fn()) {
  renderConProviders(<CambiarPasswordDialog abierto onCerrar={onCerrar} />, { sesion: SESION_TEC })
  return onCerrar
}

async function rellenar(actual: string, nueva: string, confirmar: string) {
  if (actual) await userEvent.type(screen.getByLabelText('Contraseña actual'), actual)
  if (nueva) await userEvent.type(screen.getByLabelText('Nueva contraseña'), nueva)
  if (confirmar) await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), confirmar)
}

describe('CambiarPasswordDialog: estructura (CambiarPasswordView.fxml)', () => {
  it('barra navy con el título, tres campos con sus etiquetas y placeholders, botones y 380 px', () => {
    abrir()
    const dlg = screen.getByRole('dialog', { name: 'Cambiar contraseña' })
    expect(dlg).toHaveClass('w-[380px]', 'p-0', 'max-w-[min(380px,calc(100%-2rem))]')
    expect(dlg).not.toHaveClass('sm:max-w-lg')
    const titulo = within(dlg).getByText('Cambiar contraseña')
    expect(titulo).toHaveClass('text-[15px]', 'font-bold', 'text-white')
    expect(titulo.parentElement).toHaveClass('bg-azul-noche', 'px-5', 'py-4')
    for (const etiqueta of ['Contraseña actual', 'Nueva contraseña', 'Confirmar nueva contraseña']) {
      expect(within(dlg).getByText(etiqueta)).toHaveClass('text-[11px]', 'font-bold', 'text-etiqueta-password')
    }
    expect(within(dlg).getByLabelText('Contraseña actual')).toHaveAttribute('placeholder', 'Contraseña actual')
    expect(within(dlg).getByLabelText('Nueva contraseña')).toHaveAttribute('placeholder', 'Nueva contraseña')
    expect(within(dlg).getByLabelText('Confirmar nueva contraseña')).toHaveAttribute('placeholder', 'Confirmar contraseña')
    for (const nombre of ['Contraseña actual', 'Nueva contraseña', 'Confirmar nueva contraseña']) {
      expect(within(dlg).getByLabelText(nombre)).toHaveAttribute('type', 'password')
    }
    const cancelar = within(dlg).getByRole('button', { name: 'Cancelar' })
    const guardar = within(dlg).getByRole('button', { name: 'Guardar' })
    expect(cancelar.compareDocumentPosition(guardar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(guardar).toHaveClass('bg-azul-noche', 'font-bold', 'rounded-md')
    expect(cancelar).toHaveClass('border-fila-sep', 'rounded-md')
    expect(within(dlg).getByText('Contraseña actual').closest('form')).toHaveClass('p-6', 'gap-4')
    // Línea de error oculta hasta que hay error; sin la ✕ de shadcn (el JavaFX no la tiene).
    expect(within(dlg).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dlg).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })
  it('el foco inicial está en la contraseña actual', async () => {
    abrir()
    await waitFor(() => expect(screen.getByLabelText('Contraseña actual')).toHaveFocus())
  })
  it('cada campo tiene su ojo independiente', async () => {
    abrir()
    const ojos = screen.getAllByRole('button', { name: 'Mostrar contraseña' })
    expect(ojos).toHaveLength(3)
    await userEvent.click(ojos[0])
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getAllByRole('button', { name: 'Ocultar contraseña' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Mostrar contraseña' })).toHaveLength(2)
  })
})

describe('CambiarPasswordDialog: validación en la línea de error', () => {
  it.each([
    ['', '', '', 'Rellena todos los campos.'],
    ['secreta1', 'nue12', 'nue12', 'La contraseña debe tener al menos 6 caracteres.'],
    ['secreta1', 'nueva123', 'nueva124', 'Las contraseñas nuevas no coinciden.'],
  ])('("%s", "%s", "%s") → "%s" sin llamar al servidor', async (actual, nueva, confirmar, mensaje) => {
    const cuerpos = registrarCambio()
    const onCerrar = abrir()
    await rellenar(actual, nueva, confirmar)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent(mensaje)
    expect(error).toHaveClass('text-[12px]', 'text-error-password')
    expect(cuerpos).toHaveLength(0)
    expect(onCerrar).not.toHaveBeenCalled()
  })
})

describe('CambiarPasswordDialog: guardado', () => {
  it('éxito: manda actual y nueva (sin la confirmación), cierra y avisa "Contraseña cambiada correctamente."; la sesión sigue', async () => {
    const cuerpos = registrarCambio()
    const onCerrar = abrir()
    await rellenar('secreta1', 'nueva123', 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const aviso = await screen.findByRole('dialog', { name: 'Mensaje' })
    expect(aviso).toHaveTextContent('Contraseña cambiada correctamente.')
    expect(cuerpos).toEqual([{ passwordActual: 'secreta1', passwordNueva: 'nueva123' }])
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('fsgr.sesion')).not.toBeNull()
  })
  it('Enter en un campo guarda', async () => {
    const cuerpos = registrarCambio()
    abrir()
    await rellenar('secreta1', 'nueva123', '')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'nueva123{Enter}')
    await waitFor(() => expect(cuerpos).toHaveLength(1))
  })
  it('"Guardar" y "Cancelar" quedan deshabilitados mientras responde y Esc no cierra', async () => {
    let soltar!: () => void
    const espera = new Promise<void>((r) => { soltar = r })
    registrarCambio(async () => { await espera; return new HttpResponse(null, { status: 204 }) })
    const onCerrar = abrir()
    await rellenar('secreta1', 'nueva123', 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).not.toHaveBeenCalled()
    soltar()
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1))
  })
  it('422: el message del servidor en la línea, los campos se conservan y no hay diálogo genérico', async () => {
    registrarCambio(() => HttpResponse.json({ message: 'Contraseña actual incorrecta.' }, { status: 422 }))
    const onCerrar = abrir()
    await rellenar('mala1234', 'nueva123', 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña actual incorrecta.')
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('mala1234')
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('nueva123')
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toHaveValue('nueva123')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(onCerrar).not.toHaveBeenCalled()
  })
  it('un nuevo intento limpia el error anterior antes de validar', async () => {
    registrarCambio(() => HttpResponse.json({ message: 'Contraseña actual incorrecta.' }, { status: 422 }))
    abrir()
    await rellenar('mala1234', 'nueva123', 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('Contraseña actual incorrecta.')
    await userEvent.clear(screen.getByLabelText('Confirmar nueva contraseña'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Rellena todos los campos.')
    expect(screen.queryByText('Contraseña actual incorrecta.')).not.toBeInTheDocument()
  })
  it('otro error (403): el texto de la web en la línea', async () => {
    registrarCambio(() => new HttpResponse(null, { status: 403 }))
    abrir()
    await rellenar('secreta1', 'nueva123', 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para realizar esta acción.')
  })
  it('sin conexión: sin texto en la línea; lo avisa el diálogo global de conexión', async () => {
    registrarCambio(() => new HttpResponse(null, { status: 500 }))
    abrir()
    await rellenar('secreta1', 'nueva123', 'nueva123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('dialog', { name: 'Error' })).toHaveTextContent('Sin conexión con el servidor: HTTP 500')
    // El diálogo de error deja el de contraseña con aria-hidden (fuera del árbol accesible): se mira el formulario por el DOM.
    expect(screen.getByLabelText('Contraseña actual').closest('form')?.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('CambiarPasswordDialog: cerrar', () => {
  it('"Cancelar" cierra sin preguntar aunque haya texto, sin llamar al servidor', async () => {
    const cuerpos = registrarCambio()
    const onCerrar = abrir()
    await rellenar('secreta1', 'nueva123', '')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: /Eliminar|Descartar/ })).not.toBeInTheDocument()
    expect(cuerpos).toHaveLength(0)
  })
  it('Esc cierra', async () => {
    const onCerrar = abrir()
    await userEvent.keyboard('{Escape}')
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
  it('pulsar fuera del diálogo (el velo o el body) no lo cierra y conserva lo tecleado (Stage modal del JavaFX)', async () => {
    const onCerrar = abrir()
    await rellenar('secreta1', '', '')
    const velo = document.querySelector('[data-slot="dialog-overlay"]')
    expect(velo).not.toBeNull()
    await userEvent.click(velo!)
    // Radix pone `pointer-events: none` en el body mientras el modal está abierto (user-event se niega a pulsarlo): el
    // `pointerdown` que escucha su DismissableLayer se dispara a mano.
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(onCerrar).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('secreta1')
  })
  it('al reabrir, los campos y el error vuelven vacíos (la ventana del JavaFX se crea de nuevo)', async () => {
    function Arnes() {
      const [abierto, setAbierto] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setAbierto(true)}>Abrir</button>
          <CambiarPasswordDialog abierto={abierto} onCerrar={() => setAbierto(false)} />
        </>
      )
    }
    renderConProviders(<Arnes />, { sesion: SESION_TEC })
    await rellenar('secreta1', 'abc', 'abc')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('La contraseña debe tener al menos 6 caracteres.')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cambiar contraseña' })).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const dlg = await screen.findByRole('dialog', { name: 'Cambiar contraseña' })
    expect(within(dlg).getByLabelText('Contraseña actual')).toHaveValue('')
    expect(within(dlg).getByLabelText('Nueva contraseña')).toHaveValue('')
    expect(within(dlg).queryByRole('alert')).not.toBeInTheDocument()
  })
})
