import type { Proveedor } from '@/shared/api/client'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { textoLineas, type Bloque } from '../bloques/reglas'
import { destinoElegido, opcionesDestino, proveedoresDeLineas, VALOR_NUEVO } from './destinos'
import type { LineaCompra } from './lineas'

type Props = {
  lineas: LineaCompra[]
  proveedores: Proveedor[]
  bloques: Map<string, Bloque>
  elegidos: Record<number, number | null>
  onElegir: (idProv: number, idBloque: number | null) => void
  /** «Añadir líneas» de un bloque: destino fijo. */
  fijo: { idBloque: number; nombre: string } | null
  /** Los pedidos aún no han llegado (no se sabe qué bloques hay abiertos). */
  cargando: boolean
}

function Flecha() {
  return <span aria-hidden className="text-texto-sub">→</span>
}

/** Resumen «Bloques» al pie de «Nuevo pedido» (spec §6.6, prototipo): a qué bloque va cada proveedor de las líneas. */
export function ResumenBloques({ lineas, proveedores, bloques, elegidos, onElegir, fijo, cargando }: Props) {
  const nombre = (idProv: number) => proveedores.find((p) => p.idProv === idProv)?.nombre ?? `Proveedor ${idProv}`
  const sinProveedor = lineas.filter((l) => l.idProv === null).length
  let contenido
  if (fijo) {
    contenido = lineas.length > 0
      ? <p className="flex flex-wrap items-center gap-2"><b>{fijo.nombre}</b> ({textoLineas(lineas.length)}) <Flecha /> <b>Bloque {fijo.idBloque}</b> <span className="text-azul-gris">(fijado)</span></p>
      : <p className="text-azul-gris">Añade líneas para ver su destino.</p>
  } else if (lineas.length === 0) {
    contenido = <p className="text-azul-gris">Añade líneas: aquí verás a qué bloque van.</p>
  } else {
    contenido = (
      <>
        {proveedoresDeLineas(lineas).map(({ idProv, n }) => {
          const opciones = opcionesDestino(bloques, idProv)
          const valor = destinoElegido(bloques, idProv, elegidos)
          return (
            <div key={idProv} className="flex flex-wrap items-center gap-2 py-1">
              <b>{nombre(idProv)}</b> ({textoLineas(n)}) <Flecha />
              {cargando ? (
                <span className="text-azul-gris">Cargando bloques…</span>
              ) : opciones.length > 0 ? (
                <ComboNavy valor={valor === null ? VALOR_NUEVO : String(valor)} opciones={opciones}
                  onChange={(v) => onElegir(idProv, v === VALOR_NUEVO ? null : Number(v))} textoVacio="" ancho={300} visibles={8}
                  aria-label={`Bloque de ${nombre(idProv)}`} />
              ) : (
                <span><b>Bloque nuevo</b> <span className="text-azul-gris">(no tiene ninguno abierto)</span></span>
              )}
            </div>
          )
        })}
        {sinProveedor > 0 && <p className="text-azul-gris">{textoLineas(sinProveedor)} sin proveedor todavía</p>}
        <p className="mt-1.5 text-[11px] text-azul-gris">
          Solo se ofrecen bloques abiertos (sin nada confirmado). Para sumar a uno ya confirmado: ⋮ del bloque → «Añadir líneas…».
        </p>
      </>
    )
  }
  return (
    <section aria-label="Bloques" className="rounded-[10px] border border-borde-input bg-superficie px-3 py-2.5 text-[12px] text-azul-medio">
      <h3 className="mb-1.5 font-bold">Bloques</h3>
      {contenido}
    </section>
  )
}
