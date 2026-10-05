import { useEffect, useState } from 'react'
import { api } from '@/shared/api/client'

/** Nota de una contraseña propuesta, de 0 a 4, según el servidor (la misma regla que al guardar: PoliticaPassword). */
export type EstadoNota =
  | { estado: 'vacio' }
  | { estado: 'comprobando' }
  | { estado: 'listo'; nota: number; aceptable: boolean; mensaje: string | null }
  | { estado: 'error' }

/** Pausa tras la última tecla antes de preguntar: una petición por pausa, no por letra. */
export const PAUSA_MS = 300

export const ETIQUETAS_NOTA = ['Muy débil', 'Débil', 'Poco segura', 'Segura', 'Muy segura'] as const
export const AYUDA = 'Mínimo 10 caracteres.'
export const AYUDA_ADMIN = 'Para el administrador se pide «Muy segura».'
export const MSG_NO_COMPROBADA = 'No se pudo comprobar'

/**
 * Pide al servidor la nota de `password` cuando deja de cambiar durante PAUSA_MS. Cada cambio cancela la consulta
 * anterior (AbortController), así que una respuesta vieja nunca pisa a la nueva. La contraseña solo viaja en el cuerpo de
 * esa petición: no se guarda en ninguna caché ni en el almacenamiento del navegador.
 */
export function useNotaPassword(password: string): EstadoNota {
  const [estado, setEstado] = useState<EstadoNota>({ estado: 'vacio' })

  useEffect(() => {
    if (password === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia la nota al cambiar la contraseña
      setEstado({ estado: 'vacio' })
      return
    }
    setEstado({ estado: 'comprobando' })
    const control = new AbortController()
    const temporizador = window.setTimeout(() => {
      api
        .POST('/api/auth/evaluar-password', { body: { password }, signal: control.signal })
        .then(({ data }) => {
          if (control.signal.aborted) return
          if (!data) setEstado({ estado: 'error' })
          else setEstado({ estado: 'listo', nota: data.nota, aceptable: data.aceptable, mensaje: data.mensaje ?? null })
        })
        .catch(() => {
          if (!control.signal.aborted) setEstado({ estado: 'error' })
        })
    }, PAUSA_MS)
    return () => {
      window.clearTimeout(temporizador)
      control.abort()
    }
  }, [password])

  return estado
}

/** "Guardar" espera a la nota y no deja guardar una que el servidor no acepta. Vacía no bloquea (al pulsar sale "Rellena
 *  todos los campos.") y un fallo de la consulta tampoco: al guardar decide el servidor. */
export function bloqueaGuardar(e: EstadoNota): boolean {
  return e.estado === 'comprobando' || (e.estado === 'listo' && !e.aceptable)
}
