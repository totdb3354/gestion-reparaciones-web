import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, type LoginResponse } from '@/shared/api/client'
import { ConexionError, SesionExpiradaError } from '@/shared/api/errors'
import { rearmarSesionExpirada } from './expiracion'
import { borrarSesion, guardarSesion, leerSesion, type Sesion } from './storage'

export const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos.'

type Ctx = {
  sesion: Sesion | null
  login: (usuario: string, password: string) => Promise<void>
  logout: () => void
}
const SessionContext = createContext<Ctx | null>(null)

async function pedirLogin(usuario: string, password: string): Promise<LoginResponse> {
  const { data } = await api.POST('/api/auth/login', { body: { usuario, password } })
  if (!data) throw new ConexionError(0, 'Respuesta vacía del servidor.')
  // El schema generado marca los campos como opcionales (ver LoginResponse en client.ts); el servidor
  // siempre los manda todos en una respuesta 200 real.
  return data as LoginResponse
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())

  const login = useCallback(async (usuario: string, password: string) => {
    let data
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
    const s: Sesion = { idUsu: data.idUsu, nombreUsuario: data.nombreUsuario, rol: data.rol, idTec: data.idTec ?? null, token: data.token }
    guardarSesion(s)
    rearmarSesionExpirada()
    setSesion(s)
  }, [])

  const logout = useCallback(() => {
    borrarSesion()
    setSesion(null)
  }, [])

  const value = useMemo(() => ({ sesion, login, logout }), [sesion, login, logout])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** En el login, un 401 no es "sesión expirada" sino credenciales incorrectas. */
function traducir(e: unknown): Error {
  if (e instanceof SesionExpiradaError) return new Error(MSG_CREDENCIALES)
  return e instanceof Error ? e : new Error(String(e))
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession fuera de SessionProvider')
  return ctx
}
