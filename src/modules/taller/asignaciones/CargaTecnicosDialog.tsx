import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FilaCarga } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { BotonSecundario } from '@/shared/ui/Botones'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useCargaTecnicos } from './api'
import {
  anchoBarra, CLASE_BARRA_NIVEL, CLASE_TEXTO_NIVEL, formatearPct, nivelCarga, ordenarPorCarga, pctTotal, textoDesglose,
  type Alcance,
} from './carga'

type Props = {
  abierto: boolean
  onCerrar: () => void
  /** Pulsar una fila deja la tabla de fondo con el filtro de técnico puesto en ese técnico, en solitario. */
  onFiltrarPorTecnico: (idTec: number) => void
  /** Aviso de ventana abierta/cerrada: congela el sondeo de la tabla (spec 3a, D4). La Task 16 lo conecta. */
  onInteraccion: (abierta: boolean) => void
}

const MSG_ERROR = 'No se pudo cargar la carga de técnicos.'
/** Nombre accesible de la lista: la vista tiene más de un diálogo y `getByRole('list')` a secas es ambiguo. */
const ETIQUETA_LISTA = 'Carga por técnico'
/** Segunda línea del tooltip: la fila es pulsable y no hay otra pista visual que lo diga. */
const PISTA_CLICK = 'Click: ver sus asignaciones'

/** Los dos botones del toggle, en el orden del JavaFX; Pedidos es el de arranque. */
const ALCANCES: { clave: Alcance; etiqueta: string }[] = [
  { clave: 'pedidos', etiqueta: 'Pedidos' },
  { clave: 'total', etiqueta: 'Total' },
]

/**
 * Ventana "Carga de técnicos" (spec 3a §11): una fila por técnico activo, de mayor a menor carga, con las dos
 * barras en la misma escala, las cifras del día y el desglose en el tooltip. Pulsar una fila cierra la ventana y
 * filtra la tabla por ese técnico.
 *
 * El toggle Pedidos|Total es estado LOCAL a propósito: la respuesta trae los dos alcances (D3), así que cambiar
 * de alcance no puede costar un viaje al servidor — en el JavaFX es instantáneo y aquí también.
 */
export function CargaTecnicosDialog({ abierto, onCerrar, onFiltrarPorTecnico, onInteraccion }: Props) {
  const [alcance, setAlcance] = useState<Alcance>('pedidos')
  // Solo consulta con la ventana abierta: no tiene sentido sondear la carga de fondo.
  const { data, isPending, isError } = useCargaTecnicos(abierto)

  // `onInteraccion` va por ref y NO en las dependencias del efecto: con el consumidor real (Task 16) un padre que
  // lo pasara como flecha en línea cambiaría su identidad en cada render, el efecto se rearmaría y el aviso
  // parpadearía (false→true por render), descongelando el sondeo a ratos. Con la ref sale UNA vez al abrir y una
  // al cerrar, pase lo que pase con la identidad de la función.
  const avisar = useRef(onInteraccion)
  useLayoutEffect(() => {
    avisar.current = onInteraccion
  })
  useEffect(() => {
    if (!abierto) return
    avisar.current(true)
    return () => avisar.current(false)
  }, [abierto])

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cada apertura arranca en Pedidos, como la ventana nueva del JavaFX (patrón de SelectorLista)
    if (abierto) setAlcance('pedidos')
  }, [abierto])

  const filas = ordenarPorCarga(data?.[alcance] ?? [])

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[680px] gap-3 bg-superficie p-4">
        <DialogHeader className="flex-row items-center gap-3.5">
          <DialogTitle className="text-[14px] font-bold text-azul-medio">Carga de técnicos</DialogTitle>
          {/* Calco de toggle-pill, pero no es el TogglePill de shared: aquel navega (son NavLink) y aquí el
              alcance es estado local que no debe tocar la ruta ni volver al servidor. */}
          <div role="group" aria-label="Alcance de la carga" className="inline-flex">
            {ALCANCES.map((a, i) => (
              <button
                key={a.clave}
                type="button"
                aria-pressed={alcance === a.clave}
                onClick={() => setAlcance(a.clave)}
                className={cn(
                  'border border-pill-borde px-3.5 py-[5px] text-[12px] font-bold',
                  i === 0 ? 'rounded-l-3xl' : '-ml-px rounded-r-3xl',
                  alcance === a.clave ? 'border-azul-noche bg-azul-noche text-superficie' : 'bg-pill-bg text-azul-gris hover:bg-azul-medio/8',
                )}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
        </DialogHeader>
        <div className="max-h-[460px] min-h-[120px] overflow-y-auto pr-3.5">
          {isError ? (
            <p role="alert" className="py-6 text-center text-[13px] text-texto-error">{MSG_ERROR}</p>
          ) : isPending ? (
            <p className="py-6 text-center text-[13px] text-azul-gris">Cargando…</p>
          ) : (
            // group/carga: al pasar el ratón por la lista, todas las filas se atenúan y la de debajo del cursor
            // recupera la opacidad. Es el fundido del JavaFX resuelto en CSS, sin animación en JS.
            //
            // La separación entre filas es padding de cada <li>, NO un `gap` del <ul>: con `gap` el hueco entre
            // filas pertenece al <ul> pero a ninguna fila, así que el cursor ahí atenuaba las filas SIN resaltar
            // ninguna. En el JavaFX el fundido lo dispara cada fila (setOnMouseEntered) y el hueco no atenúa nada;
            // con el padding, todo punto del <ul> cae dentro de alguna fila y no queda zona muerta.
            <ul aria-label={ETIQUETA_LISTA} className="group/carga flex flex-col">
              {filas.map((f) => (
                <li key={f.idTec} className="py-[5px] transition-opacity duration-150 group-hover/carga:opacity-35 hover:opacity-100!">
                  <FilaTecnico
                    fila={f}
                    alcance={alcance}
                    onElegir={() => {
                      onCerrar()
                      onFiltrarPorTecnico(f.idTec)
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <BotonSecundario onClick={onCerrar}>Cerrar</BotonSecundario>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Nombre + las dos barras + las cifras, todo dentro de un botón: la fila entera es pulsable (y enfocable). */
function FilaTecnico({ fila, alcance, onElegir }: { fila: FilaCarga; alcance: Alcance; onElegir: () => void }) {
  const total = pctTotal(fila)
  const nivel = nivelCarga(total)
  return (
    <button
      type="button"
      onClick={onElegir}
      title={`${textoDesglose(fila, alcance)}\n${PISTA_CLICK}`}
      className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left hover:bg-seleccion-suave"
    >
      <span className="w-[110px] shrink-0 truncate text-[13px] font-bold text-azul-medio">{fila.nombre}</span>
      {/* Las dos barras comparten carril y escala: cuando la verde alcanza a la de arriba, el día está hecho. */}
      <span className="flex flex-1 flex-col gap-[3px]">
        <span className="block h-[10px] rounded bg-carga-pista">
          <span className={cn('block h-full rounded', CLASE_BARRA_NIVEL[nivel])} style={{ width: `${anchoBarra(total, fila.sinJornada)}%` }} />
        </span>
        <span className="block h-[5px] rounded bg-carga-pista">
          <span className="block h-full rounded bg-verde-ok" style={{ width: `${anchoBarra(fila.pctHecho, fila.sinJornada)}%` }} />
        </span>
      </span>
      {/* Hueco fijo para las cifras: así las barras no bailan de una fila a otra. */}
      <span className="flex w-[140px] shrink-0 flex-col">
        <span className={cn('flex items-center gap-1 text-[12px] font-bold', fila.sinJornada ? 'text-azul-medio' : CLASE_TEXTO_NIVEL[nivel])}>
          <span aria-hidden className={cn('text-[11px]', alcance === 'pedidos' ? 'text-carga-pedidos' : 'text-carga-total')}>●</span>
          {fila.sinJornada ? '—' : formatearPct(total)}
        </span>
        {fila.sinJornada ? (
          <span className="text-[9px] text-texto-sub">sin jornada hoy</span>
        ) : (
          <span className="text-[10px] font-bold text-recibido-text">✓ {formatearPct(fila.pctHecho)}</span>
        )}
      </span>
    </button>
  )
}
