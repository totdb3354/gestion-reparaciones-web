import { afterEach, describe, expect, it, vi } from 'vitest'
import { copiarAlPortapapeles } from './copiar'

// navigator.clipboard no existe en jsdom por defecto (ni siquiera como propiedad); se define/retira con
// Object.defineProperty en vez de Object.assign para poder restaurar el descriptor original tras cada test.
const descriptorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const descriptorExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

afterEach(() => {
  if (descriptorClipboard) Object.defineProperty(navigator, 'clipboard', descriptorClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  if (descriptorExecCommand) Object.defineProperty(document, 'execCommand', descriptorExecCommand)
  else Reflect.deleteProperty(document, 'execCommand')
})

describe('copiarAlPortapapeles', () => {
  it('con navigator.clipboard.writeText disponible, lo usa con el texto', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    await copiarAlPortapapeles('355400000000111')
    expect(escribir).toHaveBeenCalledWith('355400000000111')
  })

  it('sin navigator.clipboard cae al textarea temporal + document.execCommand', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    let textoDuranteCopia: string | null = null
    let estiloDuranteCopia: { position: string; top: string; left: string } | null = null
    let enfocadaYSeleccionada = false
    document.execCommand = vi.fn((comando: string) => {
      expect(comando).toBe('copy')
      const area = document.querySelector('textarea')
      textoDuranteCopia = area ? area.value : null
      estiloDuranteCopia = area ? { position: area.style.position, top: area.style.top, left: area.style.left } : null
      enfocadaYSeleccionada = area !== null && area === document.activeElement && area.selectionStart === 0 && area.selectionEnd === area.value.length
      return true
    })
    await expect(copiarAlPortapapeles('355400000000111')).resolves.toBeUndefined()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    // el textarea existe y tiene el texto mientras se copia...
    expect(textoDuranteCopia).toBe('355400000000111')
    // ...posicionado fijo en la esquina (sin provocar salto de scroll)...
    expect(estiloDuranteCopia).toEqual({ position: 'fixed', top: '0px', left: '0px' })
    // ...enfocado y con el texto seleccionado antes de copiar...
    expect(enfocadaYSeleccionada).toBe(true)
    // ...y se retira después, pase lo que pase.
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('sin navigator.clipboard y sin document.execCommand (jsdom real) la promesa se resuelve igualmente', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(document, 'execCommand')
    await expect(copiarAlPortapapeles('355400000000111')).resolves.toBeUndefined()
    expect(document.querySelector('textarea')).toBeNull()
  })
})
