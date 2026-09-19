import type { Dispatch } from 'react'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { traducirModelo } from '../lib/modelos'
import { etiquetaImei, type AccionFormulario, type EstadoFormulario } from './estado'

type Props = { estado: EstadoFormulario; conflicto: string | null; dispatch: Dispatch<AccionFormulario>; onCerrar: () => void }

/** Barra superior (etiqueta IMEI, "Filtrar por modelo:", combo y ✕) y, debajo, las bandas de aviso. No decide nada: el texto
 *  del conflicto llega calculado (`textoConflicto`) y la incidencia es la del estado. whitespace-pre conserva los dobles
 *  espacios de la etiqueta en edición. */
export function CabeceraFormulario({ estado, conflicto, dispatch, onCerrar }: Props) {
  return (
    <>
      <div className="flex items-center gap-4 bg-form-barra-bg px-4 py-2.5">
        <span className="text-[13px] font-bold whitespace-pre text-azul-medio">{etiquetaImei(estado)}</span>
        <span className="flex-1" />
        <span className="text-[12px] text-azul-gris">Filtrar por modelo:</span>
        <ComboNavy
          aria-label="Filtrar por modelo"
          valor={estado.modelo}
          opciones={estado.modelos.map((m) => ({ valor: m, etiqueta: traducirModelo(m) }))}
          onChange={(modelo) => dispatch({ tipo: 'CAMBIAR_MODELO', modelo })}
          textoVacio="— Selecciona modelo —"
          ancho={180}
          disabled={estado.modeloBloqueado}
        />
        <button type="button" aria-label="Cerrar formulario" onClick={onCerrar} className="cursor-pointer px-1 text-[16px] leading-none font-bold text-azul-gris">
          ✕
        </button>
      </div>
      {conflicto !== null && (
        <div data-testid="banda-conflicto" className="bg-aviso-conflicto-bg px-4 py-[5px] text-[12px] font-bold text-aviso-conflicto-text">
          {conflicto}
        </div>
      )}
      {estado.incidencia !== null && (
        <div data-testid="banda-incidencia" className="px-4 py-[5px] text-[12px] text-aviso-incidencia-text">
          {`⚠ Resuelve incidencia: ${estado.incidencia}`}
        </div>
      )}
    </>
  )
}
