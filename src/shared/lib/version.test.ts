import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './version'

describe('APP_VERSION', () => {
  it('es un semver tomado de package.json (con un cuarto número en un arreglo aparte, como 0.9.18.1)', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(\.\d+)?$/)
  })
})
