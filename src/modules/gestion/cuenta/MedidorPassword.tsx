import { cn } from '@/shared/lib/utils'
import { AYUDA, AYUDA_ADMIN, ETIQUETAS_NOTA, MSG_NO_COMPROBADA, type EstadoNota } from './medidor'

/** Color de cada nota: rojo (0-1), naranja (2), verde (3), verde oscuro (4). */
const COLOR_NOTA = ['bg-texto-error', 'bg-texto-error', 'bg-orange-500', 'bg-verde-ok', 'bg-badge-usuario-activo-text'] as const
const COLOR_TEXTO = ['text-texto-error', 'text-texto-error', 'text-orange-600', 'text-badge-usuario-activo-text', 'text-badge-usuario-activo-text'] as const

type Props = { estado: EstadoNota; esAdmin: boolean }

/**
 * Barra de seguridad bajo "Nueva contraseña" (spec política de contraseñas §4.1): cinco tramos, el texto de la nota, el
 * motivo del servidor si no se acepta y la ayuda fija. Ocupa siempre su hueco para que el formulario no salte.
 */
export function MedidorPassword({ estado, esAdmin }: Props) {
  return (
    <div className="flex min-h-[52px] w-full flex-col gap-1">
      {estado.estado === 'listo' && (
        <div className="flex items-center gap-2">
          <div
            role="meter"
            aria-label="Seguridad de la contraseña"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={estado.nota}
            aria-valuetext={ETIQUETAS_NOTA[estado.nota]}
            className="flex flex-1 gap-1"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                data-encendido={i <= estado.nota}
                className={cn('h-1.5 flex-1 rounded-full', i <= estado.nota ? COLOR_NOTA[estado.nota] : 'bg-fila-sep')}
              />
            ))}
          </div>
          <span className={cn('text-[11px] font-bold', COLOR_TEXTO[estado.nota])}>{ETIQUETAS_NOTA[estado.nota]}</span>
        </div>
      )}
      {estado.estado === 'listo' && estado.mensaje !== null && (
        <p className="text-[11px] text-error-password">{estado.mensaje}</p>
      )}
      {estado.estado === 'error' && <p className="text-[11px] text-azul-gris">{MSG_NO_COMPROBADA}</p>}
      <p className="text-[11px] text-azul-gris">{AYUDA}</p>
      {esAdmin && <p className="text-[11px] text-azul-gris">{AYUDA_ADMIN}</p>}
    </div>
  )
}
