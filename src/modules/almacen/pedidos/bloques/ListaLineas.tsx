import type { CompraComponente } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { BadgeEstadoPedido } from '../BadgeEstadoPedido'

/** Casillas de la lista (0.9.13): las líneas marcadas, qué hacer al cambiar una o todas, y el texto de una desmarcada. */
export type CasillasLista = {
  marcadas: Set<number>
  onAlternar: (idCompra: number, marcada: boolean) => void
  onAlternarTodas: (marcar: boolean) => void
  textoQueda: string
}

type Props = { titulo: string; lineas: CompraComponente[]; motivo?: (p: CompraComponente) => string; apagada?: boolean; casillas?: CasillasLista }

function Datos({ p, tachada = false }: { p: CompraComponente; tachada?: boolean }) {
  return (
    <>
      <span className="text-azul-gris">{p.idCompra}</span>
      <b className={cn(tachada && 'line-through')}>{p.tipoComponente}</b>
      <span>× {p.cantidad}</span>
    </>
  )
}

/** Lista de líneas de los diálogos de bloque (prototipo): ID, componente, cantidad y su estado o, en «No cambian», el
 *  motivo. Con `casillas` (0.9.13) cada línea se puede desmarcar (gris, tachada y con `textoQueda`) y la cabecera lleva
 *  «Marcar todas»: marcada con todas, a medias con algunas; al pulsarla, desmarca si estaban todas y si no, marca todas. */
export function ListaLineas({ titulo, lineas, motivo, apagada = false, casillas }: Props) {
  const nMarcadas = casillas ? lineas.filter((p) => casillas.marcadas.has(p.idCompra)).length : 0
  const todas = nMarcadas === lineas.length
  return (
    <section aria-label={titulo} className="rounded-lg border border-fila-sep bg-superficie">
      <div className={cn('flex items-center gap-2 rounded-t-lg border-b border-fila-sep bg-crema px-2.5 py-1.5 text-[12px] font-bold', apagada ? 'text-texto-sub' : 'text-azul-medio')}>
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
              <li key={p.idCompra} className="flex items-center gap-2.5 border-b border-crema px-2.5 py-1.5 text-[12px] text-azul-medio last:border-b-0">
                <Datos p={p} />
                <span className="ml-auto">{motivo ? <span className="text-[11px] text-texto-sub">{motivo(p)}</span> : <BadgeEstadoPedido pedido={p} />}</span>
              </li>
            )
          }
          const marcada = casillas.marcadas.has(p.idCompra)
          return (
            <li key={p.idCompra} className="border-b border-crema last:border-b-0">
              <label className={cn('flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-[12px]', marcada ? 'text-azul-medio' : 'text-texto-sub')}>
                <Checkbox checked={marcada} onCheckedChange={(v) => casillas.onAlternar(p.idCompra, v === true)}
                  aria-label={`${p.tipoComponente} (ID ${p.idCompra})`} className="bg-superficie" />
                <Datos p={p} tachada={!marcada} />
                <span className="ml-auto">{marcada ? <BadgeEstadoPedido pedido={p} /> : <span className="text-[11px] italic">{casillas.textoQueda}</span>}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
