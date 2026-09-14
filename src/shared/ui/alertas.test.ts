import { describe, expect, it, vi } from 'vitest'
import { emitirError, onError } from './alertas'

describe('alertas (store externo)', () => {
  it('avisa a los suscriptores mientras están suscritos y deja de hacerlo tras darse de baja', () => {
    const listener = vi.fn()
    const unsubscribe = onError(listener)
    emitirError('boom')
    expect(listener).toHaveBeenCalledWith('boom')
    unsubscribe()
    emitirError('otro más')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
