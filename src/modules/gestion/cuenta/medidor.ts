import { useEffect, useState } from 'react'
import { api } from '@/shared/api/client'

/** Nota de una contraseña propuesta, de 0 a 4, según el servidor (la misma regla que al guardar: PoliticaPassword). */
export type NotaLista = { estado: 'listo'; nota: number; aceptable: boolean; mensaje: string | null }

/** `previa`: la última nota recibida, que la barra sigue pintando mientras llega la nueva (así no parpadea al escribir). */
export type EstadoNota =
  | { estado: 'vacio' }
  | { estado: 'comprobando'; previa?: NotaLista }
  | NotaLista
  | { estado: 'error' }

/** Pausa tras la última tecla antes de preguntar: una petición por pausa, no por letra. */
export const PAUSA_MS = 300

export const ETIQUETAS_NOTA = ['Muy débil', 'Débil', 'Poco segura', 'Segura', 'Muy segura'] as const
export const AYUDA = 'Mínimo 10 caracteres.'
export const AYUDA_ADMIN = 'Para el administrador se pide «Muy segura».'
export const MSG_NO_COMPROBADA = 'No se pudo comprobar'
/** Texto accesible de la barra cuando todavía no hay nota (campo vacío, primera comprobación o fallo). */
export const SIN_NOTA = 'Sin nota'

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
    setEstado((antes) => {
      const previa = antes.estado === 'listo' ? antes : antes.estado === 'comprobando' ? antes.previa : undefined
      return previa ? { estado: 'comprobando', previa } : { estado: 'comprobando' }
    })
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

/** "Guardar" solo se bloquea con una nota ya recibida que el servidor no acepta. Vacía no bloquea (al pulsar sale
 *  "Rellena todos los campos."), un fallo de la consulta tampoco, y mientras se comprueba tampoco: un Enter pulsado
 *  antes de que llegue la nota envía y decide el servidor, que aplica la misma regla (spec 0.9.5 §6). */
export function bloqueaGuardar(e: EstadoNota): boolean {
  return e.estado === 'listo' && !e.aceptable
}
