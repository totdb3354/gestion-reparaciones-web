import { describe, expect, it } from 'vitest'
import type { Cliente } from '@/shared/api/client'
import { SIN, opcionesCliente, refDeClave, valorCliente } from './opcionesCliente'

const cliente = (p: Partial<Cliente> & Pick<Cliente, 'idCli' | 'nombre'>): Cliente => ({ activo: true, updatedAt: '', ...p })

describe('opcionesCliente', () => {
  const clientes = [
    cliente({ idCli: 5, nombre: 'CLIENTE UNO' }),
    cliente({ idCli: 6, nombre: 'CLIENTE VIEJO', activo: false }),
    cliente({ idCli: 7, nombre: 'CLIENTE DOS' }),
  ]

  it('siempre ofrece "— Sin cliente —" y los activos', () => {
    const o = opcionesCliente(clientes, null)
    expect(o).toEqual([
      { clave: SIN, etiqueta: '— Sin cliente —' },
      { clave: '5', etiqueta: 'CLIENTE UNO' },
      { clave: '7', etiqueta: 'CLIENTE DOS' },
    ])
  })

  it('un inactivo se ofrece solo si es el de la entrada actual (D6)', () => {
    const o = opcionesCliente(clientes, 6)
    expect(o.map((x) => x.etiqueta)).toEqual(['— Sin cliente —', 'CLIENTE UNO', 'CLIENTE VIEJO', 'CLIENTE DOS'])
    // a otra entrada (sin ese idCli) no se le ofrece
    expect(opcionesCliente(clientes, null).map((x) => x.etiqueta)).not.toContain('CLIENTE VIEJO')
    expect(opcionesCliente(clientes, 7).map((x) => x.etiqueta)).not.toContain('CLIENTE VIEJO')
  })
})

describe('valorCliente', () => {
  it('null sin entrada', () => {
    expect(valorCliente(null)).toBeNull()
    expect(valorCliente(undefined)).toBeNull()
  })
  it('SIN si sinCliente', () => {
    expect(valorCliente({ idCli: null, sinCliente: true })).toBe(SIN)
    expect(valorCliente({ idCli: 5, sinCliente: true })).toBe(SIN)
  })
  it('el idCli como texto si lo hay', () => {
    expect(valorCliente({ idCli: 5, sinCliente: false })).toBe('5')
  })
  it('null sin cliente elegido ni decisión', () => {
    expect(valorCliente({ idCli: null, sinCliente: false })).toBeNull()
  })
})

describe('refDeClave', () => {
  it('SIN → sin cliente explícito', () => {
    expect(refDeClave(SIN)).toEqual({ idCli: null, sin: true })
  })
  it('una clave numérica → ese cliente', () => {
    expect(refDeClave('5')).toEqual({ idCli: 5, sin: false })
  })
})
