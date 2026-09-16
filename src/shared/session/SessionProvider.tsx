import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type LoginResponse } from '@/shared/api/client'
import { ConexionError, SesionExpiradaError } from '@/shared/api/errors'
import { rearmarSesionExpirada } from '@/shared/session/expiracion'
import { borrarSesion, guardarSesion, leerSesion, type Sesion } from '@/shared/session/storage'

export const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos.'

type Ctx = {
  sesion: Sesion | null
  login: (usuario: string, password: string) => Promise<void>
  logout: () => void
}
const SessionContext = createContext<Ctx | null>(null)

/** Guardia en runtime: los tipos se borran al compilar y esto valida un `unknown` que llega del
 *  servidor (el contrato ya marca todos los campos como required e `idTec` como nullable). */
function esLoginResponse(x: unknown): x is LoginResponse {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  return typeof r.token === 'string' && typeof r.idUsu === 'number' && typeof r.nombreUsuario === 'string' && typeof r.rol === 'string'
}

async function pedirLogin(usuario: string, password: string): Promise<LoginResponse> {
  const { data } = await api.POST('/api/auth/login', { body: { usuario, password } })
  if (!data) throw new ConexionError(0, 'Respuesta vacía del servidor.')
  if (!esLoginResponse(data)) throw new ConexionError(0, 'Respuesta de login incompleta.')
  return data
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())
  const qc = useQueryClient()

  const login = useCallback(async (usuario: string, password: string) => {
    // Intentar entrar da por muerta la sesión anterior: sin ella un 401 del login no puede confundirse
    // con "sesión expirada" (dispararSesionExpirada solo actúa si hay sesión guardada). setSesion(null)
    // mantiene el estado de React sincronizado con el storage ya borrado: sin esto, un login fallido con
    // una sesión previa dejaba el contexto sirviendo la sesión vieja aunque storage ya estuviera vacío.
    borrarSesion()
    setSesion(null)
    let data: LoginResponse
    try {
      data = await pedirLogin(usuario, password)
    } catch (e) {
      // Un único reintento solo en el login, como el parche de conexión del JavaFX.
      if (!(e instanceof ConexionError)) throw traducir(e)
      try {
        data = await pedirLogin(usuario, password)
      } catch (e2) {
        throw traducir(e2)
      }
    }
    qc.clear()
    const s: Sesion = { idUsu: data.idUsu, nombreUsuario: data.nombreUsuario, rol: data.rol, idTec: data.idTec ?? null, token: data.token }
    guardarSesion(s)
    rearmarSesionExpirada()
    setSesion(s)
  }, [qc])

  const logout = useCallback(() => {
    borrarSesion()
    qc.clear()
    setSesion(null)
  }, [qc])

  const value = useMemo(() => ({ sesion, login, logout }), [sesion, login, logout])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** En el login, un 401 no es "sesión expirada" sino credenciales incorrectas. */
function traducir(e: unknown): Error {
  if (e instanceof SesionExpiradaError) return new Error(MSG_CREDENCIALES)
  return e instanceof Error ? e : new Error(String(e))
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocado con su Provider, patrón del proyecto
export function useSession(): Ctx {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession fuera de SessionProvider')
  return ctx
}
