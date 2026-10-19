import { cn } from '@/shared/lib/utils'
import { BarraReparto } from './BarraReparto'
import {
  casilla, casillaElegida, colorElegido, gradoElegido, matriz, muestraColor, pulsarCasilla, pulsarColor, pulsarGrado, tituloCasilla,
  type Filtros, type Movil,
} from './modelo'
import { PildoraGrado } from './PildoraGrado'

type Props = { moviles: Movil[]; filtros: Filtros; onCambiar: (f: Filtros) => void }

const TOTAL = 'bg-pill-bg text-center font-bold text-azul-medio'

/** La tabla color × grado (0.9.18, spec §4.4), en lugar de los chips de color y de grado: una fila por color, una columna
 *  por grado y cada casilla con su número y la barrita listos / taller / revisión. Cuenta solo el stock y respeta los demás
 *  filtros, pero no su propia selección: se ve entera, con lo elegido resaltado. */
export function MatrizColorGrado({ moviles, filtros, onCambiar }: Props) {
  const m = matriz(moviles, filtros)
  if (m.colores.length === 0) return <p className="px-1.5 py-5 text-[11.5px] text-azul-gris">No hay móviles en stock con estos filtros.</p>
  return (
    <table aria-label="Color y grado" className="border-separate border-spacing-0 text-[12.5px] text-azul-medio">
      <thead>
        <tr>
          <th scope="col" className="border-b border-fila-sep px-1.5 py-1 text-left text-[11px] font-semibold text-azul-gris">color \ grado</th>
          {m.grados.map((g) => (
            <th key={g} scope="col" className={cn('border-b border-fila-sep px-1 py-1 text-center', gradoElegido(filtros, g) && 'bg-azul-noche')}>
              <button type="button" aria-label={`Grado ${g}`} aria-pressed={gradoElegido(filtros, g)} onClick={() => onCambiar(pulsarGrado(filtros, g))} className="cursor-pointer">
                <PildoraGrado grado={g} />
              </button>
            </th>
          ))}
          <th scope="col" className={cn('w-[50px] border-b border-fila-sep', TOTAL)}>Total</th>
        </tr>
      </thead>
      <tbody>
        {m.colores.map((c) => (
          <tr key={c}>
            <th scope="row" className={cn('border-b border-pill-bg py-0.5 pr-2.5 pl-1 text-left font-semibold whitespace-nowrap', colorElegido(filtros, c) && 'bg-azul-noche text-superficie')}>
              <button type="button" aria-label={`Color ${c}`} aria-pressed={colorElegido(filtros, c)} onClick={() => onCambiar(pulsarColor(filtros, c))}
                className="inline-flex cursor-pointer items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-pill-borde" style={{ background: muestraColor(c) }} />
                {c}
              </button>
            </th>
            {m.grados.map((g) => {
              const n = casilla(m, c, g)
              const elegida = casillaElegida(filtros, c, g)
              return (
                <td key={g} className={cn('relative h-[29px] w-12 border-b border-pill-bg p-0 text-center', elegida && 'bg-azul-noche text-superficie')}>
                  {n.total === 0 ? <span aria-hidden className="text-texto-suave">·</span> : (
                    <button type="button" aria-label={`${c} ${g}: ${n.total}`} aria-pressed={elegida} title={tituloCasilla(c, g, n)}
                      onClick={(e) => onCambiar(pulsarCasilla(filtros, c, g, e.ctrlKey || e.metaKey))}
                      className={cn('h-full w-full cursor-pointer font-bold', !elegida && 'hover:bg-seleccion-suave')}>
                      {n.total}
                      <BarraReparto reparto={n.reparto} className="absolute inset-x-[9px] bottom-1 h-[3px] rounded-sm" />
                    </button>
                  )}
                </td>
              )
            })}
            <td className={cn('border-b border-pill-bg', TOTAL)}>{m.porColor.get(c) ?? 0}</td>
          </tr>
        ))}
        <tr>
          <th scope="row" className={cn('px-1 text-left', TOTAL)}>Total</th>
          {m.grados.map((g) => <td key={g} className={TOTAL}>{m.porGrado.get(g) ?? 0}</td>)}
          <td className={TOTAL}>{m.total}</td>
        </tr>
      </tbody>
    </table>
  )
}
