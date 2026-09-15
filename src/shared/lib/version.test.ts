import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './version'

describe('APP_VERSION', () => {
  it('es un semver tomado de package.json', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
