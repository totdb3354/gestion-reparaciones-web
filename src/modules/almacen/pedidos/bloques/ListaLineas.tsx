import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { BadgeEstadoPedido } from '../BadgeEstadoPedido'
import { PildoraTipo } from '../PildoraTipo'
import { claveLinea, esCompra, idVisible, nombrePedido, type Pedido } from '../reglas'
import { etiquetaLinea } from './reglas'

/** Casillas de la lista (0.9.13): las líneas marcadas (por `claveLinea`, 0.9.15: tipo + id), qué hacer al cambiar una o
 *  todas, y el texto de una desmarcada. */
export type CasillasLista = {
  marcadas: Set<string>
  onAlternar: (clave: string, marcada: boolean) => void
  onAlternarTodas: (marcar: boolean) => void
  textoQueda: string
}

type Props = { titulo: string; lineas: Pedido[]; motivo?: (p: Pedido) => string; apagada?: boolean; casillas?: CasillasLista }

/** ID («O-{id}» en lila para un otro), píldora «pieza»/«otro» (0.9.15, spec §5.1), nombre y cantidad. */
function Datos({ p, tachada = false }: { p: Pedido; tachada?: boolean }) {
  return (
    <>
      <span className={cn('shrink-0', esCompra(p) ? 'text-azul-gris' : 'text-otro-text')}>{idVisible(p)}</span>
      <PildoraTipo tipo={esCompra(p) ? 'pieza' : 'otro'} />
      <b className={cn('min-w-0 truncate', tachada && 'line-through')}>{nombrePedido(p)}</b>
      <span className="shrink-0">× {p.cantidad}</span>
    </>
  )
}

/** Lista de líneas de los diálogos de bloque (prototipo): ID, píldora, componente o concepto, cantidad y su estado o, en «No
 *  cambian», el motivo. Con `casillas` (0.9.13) cada línea se puede desmarcar (gris, tachada y con `textoQueda`) y la
 *  cabecera lleva «Marcar todas»: marcada con todas, a medias con algunas; al pulsarla, desmarca si estaban todas y si no,
 *  marca todas. La cabecera se queda fija arriba mientras se desplaza su lista (bloques de muchas líneas). */
export function ListaLineas({ titulo, lineas, motivo, apagada = false, casillas }: Props) {
  const nMarcadas = casillas ? lineas.filter((p) => casillas.marcadas.has(claveLinea(p))).length : 0
  const todas = nMarcadas === lineas.length
  return (
    <section aria-label={titulo} className="rounded-lg border border-fila-sep bg-superficie">
      <div className={cn('sticky top-0 z-10 flex items-center gap-2 rounded-t-lg border-b border-fila-sep bg-crema px-2.5 py-1.5 text-[12px] font-bold', apagada ? 'text-texto-sub' : 'text-azul-medio')}>
        {casillas && lineas.length > 0 && (
          <Checkbox aria-label="Marcar todas" checked={todas ? true : nMarcadas === 0 ? false : 'indeterminate'}
            onCheckedChange={() => casillas.onAlternarTodas(!todas)} className="bg-superficie" />
        )}
        <h4 className="m-0 text-[length:inherit] font-[inherit]">{titulo}</h4>
      </div>
      <ul>
        {lineas.map((p) => {
          if (!casillas) {
            return (
              <li key={claveLinea(p)} className="flex items-center gap-2.5 border-b border-crema px-2.5 py-1.5 text-[12px] text-azul-medio last:border-b-0">
                <Datos p={p} />
                <span className="ml-auto shrink-0">{motivo ? <span className="text-[11px] text-texto-sub">{motivo(p)}</span> : <BadgeEstadoPedido pedido={p} />}</span>
              </li>
            )
          }
          const marcada = casillas.marcadas.has(claveLinea(p))
          return (
            <li key={claveLinea(p)} className="border-b border-crema last:border-b-0">
              <label className={cn('flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-[12px]', marcada ? 'text-azul-medio' : 'text-texto-sub')}>
                <Checkbox checked={marcada} onCheckedChange={(v) => casillas.onAlternar(claveLinea(p), v === true)}
                  aria-label={etiquetaLinea(p)} className="bg-superficie" />
                <Datos p={p} tachada={!marcada} />
                <span className="ml-auto shrink-0">{marcada ? <BadgeEstadoPedido pedido={p} /> : <span className="text-[11px] italic">{casillas.textoQueda}</span>}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
