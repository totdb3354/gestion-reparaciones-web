import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { AYUDA, AYUDA_ADMIN, bloqueaGuardar, MSG_NO_COMPROBADA, useNotaPassword } from './medidor'
import { MedidorPassword } from './MedidorPassword'

function registrarEvaluaciones(responder: (password: string) => Response | Promise<Response>) {
  const pedidas: string[] = []
  server.use(
    http.post('*/api/auth/evaluar-password', async ({ request }) => {
      const { password } = (await request.json()) as { password: string }
      pedidas.push(password)
      return responder(password)
    }),
  )
  return pedidas
}

describe('useNotaPassword', () => {
  it('vacía: no pide nada', async () => {
    const pedidas = registrarEvaluaciones(() => HttpResponse.json({ nota: 4, aceptable: true, mensaje: null }))
    const { result } = renderHook(() => useNotaPassword(''))
    expect(result.current).toEqual({ estado: 'vacio' })
    await new Promise((r) => setTimeout(r, 400))
    expect(pedidas).toHaveLength(0)
  })

  it('espera 0,3 s tras la última tecla y pide una sola vez', async () => {
    const pedidas = registrarEvaluaciones(() => HttpResponse.json({ nota: 2, aceptable: false, mensaje: 'La contraseña es poco segura.' }))
    const { result, rerender } = renderHook(({ p }) => useNotaPassword(p), { initialProps: { p: 'a' } })
    rerender({ p: 'ab' })
    rerender({ p: 'abc' })
    expect(result.current).toEqual({ estado: 'comprobando' })
    await waitFor(() => expect(result.current).toEqual({ estado: 'listo', nota: 2, aceptable: false, mensaje: 'La contraseña es poco segura.' }))
    expect(pedidas).toEqual(['abc'])
  })

  it('descarta una respuesta que llega tarde', async () => {
    registrarEvaluaciones(async (p) => {
      if (p === 'vieja-larga-1') await new Promise((r) => setTimeout(r, 300))
      return HttpResponse.json({ nota: p === 'vieja-larga-1' ? 0 : 4, aceptable: p !== 'vieja-larga-1', mensaje: null })
    })
    const { result, rerender } = renderHook(({ p }) => useNotaPassword(p), { initialProps: { p: 'vieja-larga-1' } })
    await new Promise((r) => setTimeout(r, 350))
    rerender({ p: 'nueva-larga-1' })
    await waitFor(() => expect(result.current).toMatchObject({ estado: 'listo', nota: 4 }))
    await new Promise((r) => setTimeout(r, 400))
    expect(result.current).toMatchObject({ estado: 'listo', nota: 4 })
  })

  it('si falla la consulta: error, que no bloquea', async () => {
    registrarEvaluaciones(() => new HttpResponse(null, { status: 500 }))
    const { result } = renderHook(() => useNotaPassword('nueva-larga-1'))
    await waitFor(() => expect(result.current).toEqual({ estado: 'error' }))
    expect(bloqueaGuardar(result.current)).toBe(false)
  })
})

describe('bloqueaGuardar', () => {
  it('bloquea mientras comprueba y si no se acepta; no bloquea vacía, aceptada ni con error', () => {
    expect(bloqueaGuardar({ estado: 'comprobando' })).toBe(true)
    expect(bloqueaGuardar({ estado: 'listo', nota: 2, aceptable: false, mensaje: 'x' })).toBe(true)
    expect(bloqueaGuardar({ estado: 'listo', nota: 3, aceptable: true, mensaje: null })).toBe(false)
    expect(bloqueaGuardar({ estado: 'vacio' })).toBe(false)
    expect(bloqueaGuardar({ estado: 'error' })).toBe(false)
  })
})

describe('MedidorPassword', () => {
  it('vacía: solo la ayuda, sin barra', () => {
    render(<MedidorPassword estado={{ estado: 'vacio' }} esAdmin={false} />)
    expect(screen.getByText(AYUDA)).toBeInTheDocument()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('pinta la nota con su texto, los tramos encendidos y el mensaje', () => {
    render(<MedidorPassword estado={{ estado: 'listo', nota: 2, aceptable: false, mensaje: 'La contraseña es poco segura. Añade otra palabra.' }} esAdmin={false} />)
    const barra = screen.getByRole('meter', { name: 'Seguridad de la contraseña' })
    expect(barra).toHaveAttribute('aria-valuenow', '2')
    expect(barra).toHaveAttribute('aria-valuetext', 'Poco segura')
    expect(screen.getByText('Poco segura')).toBeInTheDocument()
    expect(barra.querySelectorAll('[data-encendido="true"]')).toHaveLength(3)
    expect(screen.getByText('La contraseña es poco segura. Añade otra palabra.')).toBeInTheDocument()
  })

  it.each([
    [0, 'Muy débil'], [1, 'Débil'], [2, 'Poco segura'], [3, 'Segura'], [4, 'Muy segura'],
  ])('nota %i → %s', (nota, texto) => {
    render(<MedidorPassword estado={{ estado: 'listo', nota, aceptable: nota >= 3, mensaje: null }} esAdmin={false} />)
    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it('al administrador le recuerda que se pide «Muy segura»', () => {
    render(<MedidorPassword estado={{ estado: 'vacio' }} esAdmin />)
    expect(screen.getByText(AYUDA_ADMIN)).toBeInTheDocument()
  })

  it('error: lo dice sin barra', () => {
    render(<MedidorPassword estado={{ estado: 'error' }} esAdmin={false} />)
    expect(screen.getByText(MSG_NO_COMPROBADA)).toBeInTheDocument()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('comprobando: mantiene el hueco (sin barra ni texto de nota)', () => {
    const { container } = render(<MedidorPassword estado={{ estado: 'comprobando' }} esAdmin={false} />)
    expect(container.firstChild).toHaveClass('min-h-[52px]')
  })
})
