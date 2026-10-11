import type { CompraComponente } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { BadgeEstadoPedido } from '../BadgeEstadoPedido'

type Props = { titulo: string; lineas: CompraComponente[]; motivo?: (p: CompraComponente) => string; apagada?: boolean }

/** Lista de líneas de los diálogos de bloque (prototipo): ID, componente, cantidad y su estado o, en «No cambian», el
 *  motivo. */
export function ListaLineas({ titulo, lineas, motivo, apagada = false }: Props) {
  return (
    <section aria-label={titulo} className="rounded-lg border border-fila-sep bg-superficie">
      <h4 className={cn('rounded-t-lg border-b border-fila-sep bg-crema px-2.5 py-1.5 text-[12px] font-bold', apagada ? 'text-texto-sub' : 'text-azul-medio')}>{titulo}</h4>
      <ul>
        {lineas.map((p) => (
          <li key={p.idCompra} className="flex items-center gap-2.5 border-b border-crema px-2.5 py-1.5 text-[12px] text-azul-medio last:border-b-0">
            <span className="text-azul-gris">{p.idCompra}</span>
            <b>{p.tipoComponente}</b>
            <span>× {p.cantidad}</span>
            <span className="ml-auto">{motivo ? <span className="text-[11px] text-texto-sub">{motivo(p)}</span> : <BadgeEstadoPedido pedido={p} />}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
