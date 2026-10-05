import { cn } from '@/shared/lib/utils'
import { AYUDA, AYUDA_ADMIN, ETIQUETAS_NOTA, MSG_NO_COMPROBADA, SIN_NOTA, type EstadoNota } from './medidor'

/** Color de cada nota: rojo (0-1), naranja (2), verde (3), verde oscuro (4). */
const COLOR_NOTA = ['bg-texto-error', 'bg-texto-error', 'bg-orange-500', 'bg-verde-ok', 'bg-badge-usuario-activo-text'] as const
const COLOR_TEXTO = ['text-texto-error', 'text-texto-error', 'text-orange-600', 'text-badge-usuario-activo-text', 'text-badge-usuario-activo-text'] as const

type Props = { estado: EstadoNota; esAdmin: boolean }

/**
 * Barra de seguridad bajo "Nueva contraseña" (spec política de contraseñas §4.1): cinco tramos, el texto de la nota, el
 * motivo del servidor si no se acepta y la ayuda fija. La barra está siempre: en gris mientras no hay nota (campo vacío,
 * primera comprobación o fallo) y, mientras llega la nota nueva, con la anterior, para que no parpadee al escribir.
 */
export function MedidorPassword({ estado, esAdmin }: Props) {
  const mostrada = estado.estado === 'listo' ? estado : estado.estado === 'comprobando' ? estado.previa : undefined
  const nota = mostrada?.nota
  return (
    <div className="flex min-h-[52px] w-full flex-col gap-1">
      <div className="flex items-center gap-2">
        <div
          role="meter"
          aria-label="Seguridad de la contraseña"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={nota ?? 0}
          aria-valuetext={nota === undefined ? SIN_NOTA : ETIQUETAS_NOTA[nota]}
          className="flex flex-1 gap-1"
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const encendido = nota !== undefined && i <= nota
            return (
              <span
                key={i}
                data-encendido={encendido}
                className={cn('h-1.5 flex-1 rounded-full', encendido ? COLOR_NOTA[nota] : 'bg-fila-sep')}
              />
            )
          })}
        </div>
        {nota !== undefined && (
          <span className={cn('text-[11px] font-bold', COLOR_TEXTO[nota])}>{ETIQUETAS_NOTA[nota]}</span>
        )}
      </div>
      {mostrada && mostrada.mensaje !== null && <p className="text-[11px] text-error-password">{mostrada.mensaje}</p>}
      {estado.estado === 'error' && <p className="text-[11px] text-azul-gris">{MSG_NO_COMPROBADA}</p>}
      <p className="text-[11px] text-azul-gris">{AYUDA}</p>
      {esAdmin && <p className="text-[11px] text-azul-gris">{AYUDA_ADMIN}</p>}
    </div>
  )
}
