import { test } from '@playwright/test'

/** Credenciales del entorno para el login de un smoke. Si faltan, el test en curso se salta con un motivo claro en vez de
 *  fallar al rellenar el formulario con `undefined`. */
export function credenciales(variableUsuario: string, variableClave: string) {
  const usuario = process.env[variableUsuario]
  const clave = process.env[variableClave]
  test.skip(!usuario || !clave, `Faltan ${variableUsuario}/${variableClave} en el entorno (ver .env.e2e.example y el README).`)
  return { usuario: usuario ?? '', clave: clave ?? '' }
}
