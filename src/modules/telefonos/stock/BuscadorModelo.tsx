import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { aplicarSku, MAX_SUGERENCIAS, resolverEnter, type Destino, type Resultado, type SugerenciaSku } from './buscador'
import { normalizar, textoCapacidad, type ModeloLista, type Movil } from './modelo'

type Props = {
  lista: ModeloLista[]
  moviles: Movil[]
  texto: string
  sugerencias: SugerenciaSku[]
  onTexto: (texto: string) => void
  onAbrir: (destino: Destino) => void
}

/** El buscador de la columna lateral (0.9.18, spec §4.2): escribir filtra la lista de modelos y, a partir de 2 caracteres,
 *  enseña los SKU en stock que empiezan así (hasta 7). Elegir uno (clic, o flechas y Enter) abre su modelo y su capacidad
 *  con ese SKU exacto; Enter sin elegir abre el modelo escrito o filtra por los SKU que empiezan así. Escape borra. */
export function BuscadorModelo({ lista, moviles, texto, sugerencias, onTexto, onAbrir }: Props) {
  const [marcada, setMarcada] = useState(-1)
  const [aviso, setAviso] = useState<string | null>(null)
  const vistas = sugerencias.slice(0, MAX_SUGERENCIAS)
  const largo = normalizar(texto).length
  const modelosConSku = new Set(sugerencias.map((s) => s.modelo)).size
  const escribir = (t: string) => {
    onTexto(t)
    setMarcada(-1)
    setAviso(null)
  }
  const resolver = (r: Resultado) => {
    if ('aviso' in r) {
      setAviso(r.aviso)
      return
    }
    escribir('')
    onAbrir(r.destino)
  }
  return (
    <div>
      <input aria-label="Buscar modelo o SKU" placeholder="Buscar modelo o SKU…" value={texto} autoComplete="off"
        onChange={(e) => escribir(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && vistas.length > 0) {
            e.preventDefault()
            setMarcada((i) => Math.min(i + 1, vistas.length - 1))
          } else if (e.key === 'ArrowUp' && vistas.length > 0) {
            e.preventDefault()
            setMarcada((i) => Math.max(i - 1, -1))
          } else if (e.key === 'Enter' && texto.trim()) {
            e.preventDefault()
            resolver(marcada >= 0 && vistas[marcada] ? aplicarSku(moviles, vistas[marcada].sku, true) : resolverEnter(lista, moviles, texto))
          } else if (e.key === 'Escape' && texto) {
            escribir('')
          }
        }}
        className="h-8 w-full rounded-md border border-borde-input px-2.5 text-[12.5px]" />
      {aviso && <p className="mt-1.5 text-[11.5px] font-bold text-fila-solicitud-brd">{aviso}</p>}
      {vistas.length > 0 && (
        <div className="mt-1.5 rounded-lg border border-borde-input bg-superficie p-1">
          <p className="mx-1.5 mt-0.5 mb-1 text-[10.5px] font-bold text-azul-gris">SKU EN STOCK</p>
          <ul aria-label="SKU en stock">
            {vistas.map((s, i) => (
              <li key={s.sku}>
                <button type="button" aria-current={i === marcada || undefined} onClick={() => resolver(aplicarSku(moviles, s.sku, true))}
                  className={cn('w-full cursor-pointer rounded-md px-1.5 py-1 text-left', i === marcada ? 'bg-seleccion-suave' : 'hover:bg-seleccion-suave')}>
                  <span className="block font-mono text-[11.5px] break-all text-azul-medio"><b className="text-azul-noche">{s.sku.slice(0, largo)}</b>{s.sku.slice(largo)}</span>
                  <span className="flex text-[11px] text-azul-gris">{`${s.modelo} · ${textoCapacidad(s.capacidad)}`}<b className="ml-auto text-azul-medio">{s.cuenta}</b></span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-1.5 pt-1 pb-0.5 text-[11px] text-azul-gris">
            {`${sugerencias.length > MAX_SUGERENCIAS ? `y ${sugerencias.length - MAX_SUGERENCIAS} más · ` : ''}${modelosConSku > 1 ? `Hay SKU de ${modelosConSku} modelos: elige uno o escribe más` : 'Enter: todos los que empiezan así'}`}
          </p>
        </div>
      )}
    </div>
  )
}
