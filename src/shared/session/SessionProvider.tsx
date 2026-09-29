import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, type LoginResponse } from '@/shared/api/client'
import { ConexionError, SesionExpiradaError } from '@/shared/api/errors'
import { reiniciarStores } from '@/shared/lib/store'
import { rearmarSesionExpirada } from '@/shared/session/expiracion'
import { borrarSesion, CLAVE_SESION, guardarSesion, leerSesion, type Sesion } from '@/shared/session/storage'

export const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos.'

type Ctx = {
  sesion: Sesion | null
  login: (usuario: string, password: string) => Promise<void>
  logout: () => void
  /** La persona ya ha puesto una contraseña propia: la sesión deja de estar retenida en el cambio obligatorio. */
  olvidarPasswordTemporal: () => void
}
const SessionContext = createContext<Ctx | null>(null)

/** Guardia en runtime: los tipos se borran al compilar y esto valida un `unknown` que llega del
 *  servidor (el contrato ya marca todos los campos como required e `idTec` como nullable). */
function esLoginResponse(x: unknown): x is LoginResponse {
  if (typeof x !== 'object' || x === null) return false
  const r = x as Record<string, unknown>
  // `passwordTemporal` no entra en la guarda: se normaliza a booleano al construir la sesión, así que un servidor que
  // todavía no lo envíe deja la sesión normal en vez de rechazar el login.
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
    // Nada de la sesión anterior pasa a esta: ni la caché de consultas ni los filtros que sobreviven al cambio de ruta.
    qc.clear()
    reiniciarStores()
    const s: Sesion = {
      idUsu: data.idUsu,
      nombreUsuario: data.nombreUsuario,
      rol: data.rol,
      idTec: data.idTec ?? null,
      token: data.token,
      passwordTemporal: data.passwordTemporal === true,
    }
    guardarSesion(s)
    rearmarSesionExpirada()
    // El estado sigue a lo guardado: si el almacenamiento no la acepta, la pestaña queda sin sesión, igual que el cliente HTTP.
    setSesion(leerSesion())
  }, [qc])

  /** Tras cambiar la contraseña en el cambio obligatorio: se reescribe la sesión guardada (mismo token, así que las otras
   *  pestañas la reconocen como la suya y no recargan) y esta pestaña deja de estar retenida. */
  const olvidarPasswordTemporal = useCallback(() => {
    if (sesion === null || !sesion.passwordTemporal) return
    guardarSesion({ ...sesion, passwordTemporal: false })
    // El estado sigue a lo guardado, como en el login: si el almacenamiento no la acepta, la pestaña queda sin sesión.
    setSesion(leerSesion())
  }, [sesion])

  const logout = useCallback(() => {
    borrarSesion()
    qc.clear()
    reiniciarStores()
    setSesion(null)
  }, [qc])

  // Una sesión para todas las pestañas: el evento `storage` avisa de lo que cambian las OTRAS (nunca de lo que escribe esta,
  // así que no hay bucle; la señal de actividad `fsgr.latido` se ignora). Se decide por lo que hay guardado ahora.
  useEffect(() => {
    const alCambiarEnOtraPestana = (e: StorageEvent) => {
      // key null: se vació el almacenamiento entero.
      if (e.key !== CLAVE_SESION && e.key !== null) return
      const guardada = leerSesion()
      if (guardada === null) {
        // Cerrar Sesión (o sesión caducada) en otra pestaña: aquí igual que si se hubiera pulsado en esta; sin sesión,
        // RequireSesion lleva a /login.
        if (sesion !== null) logout()
        return
      }
      // Entró otra persona, u otra sesión de la misma: recarga completa hacia la raíz para no mezclar en pantalla datos
      // de una sesión con otra. Una pestaña en /login que recibe una sesión entra así en la aplicación.
      if (sesion === null || guardada.idUsu !== sesion.idUsu || guardada.token !== sesion.token) window.location.replace('/')
    }
    window.addEventListener('storage', alCambiarEnOtraPestana)
    return () => window.removeEventListener('storage', alCambiarEnOtraPestana)
  }, [sesion, logout])

  const value = useMemo(
    () => ({ sesion, login, logout, olvidarPasswordTemporal }),
    [sesion, login, logout, olvidarPasswordTemporal],
  )
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
