import { MultiSelect } from '@/shared/ui/MultiSelect'
import { esEspecialTecnico, opciones, type Dimension, type Filtros, type Movil } from './modelo'

type Props = { moviles: Movil[]; filtros: Filtros; onCambiar: (f: Filtros) => void }

/** A la derecha de la tabla color × grado (0.9.18, spec §4.4, §4.5 y §4.7): la ayuda, los desplegables de batería,
 *  ubicación y técnico (cada opción con cuántos móviles quedarían con los demás filtros puestos) y los avisos de «Quién lo
 *  tiene», que cuentan los móviles que se ven del modelo (con el interruptor apagado, solo el stock). */
export function FiltrosMoviles({ moviles, filtros, onCambiar }: Props) {
  const desplegable = (dim: Dimension, titulo: string, todas: string) => {
    const lista = opciones(moviles, dim, filtros)
    return (
      <MultiSelect opciones={lista} clave={(o) => o.valor} etiqueta={(o) => `${o.valor} (${o.cuenta})`}
        seleccion={new Set(filtros[dim])} onChange={(s) => onCambiar({ ...filtros, [dim]: s })}
        textoVacio={`${titulo}: ${todas}`} textoPlural={(n) => `${titulo}: ${n}`} etiquetaAccesible={titulo} className="h-8 w-full min-w-0"
        separadorAntes={dim === 'tecnico' ? lista.find((o) => esEspecialTecnico(o.valor))?.valor : undefined} />
    )
  }
  const enCaja = moviles.filter((m) => m.quien.enCaja).length
  const descuadres = moviles.filter((m) => m.quien.descuadre).length
  return (
    <div className="flex w-[220px] shrink-0 flex-col gap-2">
      <p className="text-[11.5px] leading-snug text-azul-gris">
        Pulsa una casilla para ver ese color y grado; el color o el grado de la cabecera, para ver solo eso. <b>Ctrl+clic</b> suma casillas.
      </p>
      {desplegable('bateria', 'Batería', 'todas')}
      {desplegable('ubicacion', 'Ubicación', 'todas')}
      {desplegable('tecnico', 'Técnico', 'todos')}
      {enCaja > 0 && <p className="text-[12px] font-bold text-fila-solicitud-brd">{`⚠ ${enCaja} en caja de taller sin asignar`}</p>}
      {descuadres > 0 && <p className="text-[12px] font-bold text-fila-urgente-brd">{`⚠ ${descuadres} con descuadre`}</p>}
    </div>
  )
}
