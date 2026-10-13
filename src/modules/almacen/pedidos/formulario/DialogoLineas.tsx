import { useState, type ReactNode } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { BotonSecundario } from '@/shared/ui/Botones'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { DialogoPedidoBase } from './DialogoPedidoBase'
import type { LineaBase } from './lineas'
import { TablaLineas, type PrimeraColumna } from './TablaLineas'

/** Ancho del combo de proveedor dentro de su celda (155 px menos el padding; cabe también con el reparto proporcional de
 *  "Nuevo otro pedido"). */
const ANCHO_COMBO_PROVEEDOR = 140

type Props<L extends LineaBase> = {
  titulo: string
  primera: PrimeraColumna<L>
  barra?: ReactNode
  lineas: L[]
  proveedores: Proveedor[]
  info: string | null
  error: string | null
  bloqueado: boolean
  enviando: boolean
  onCambiar: (id: number, cambio: Partial<LineaBase>) => void
  onQuitar: (id: number) => void
  onAnadir: () => number
  onConfirmar: () => void
  onCerrar: () => void
}

/** "Nuevo otro pedido": el armazón (DialogoPedidoBase), la barra opcional, la tabla de líneas (TablaLineas) con el
 *  combo de proveedor en cada línea, en una caja de alto máximo con scroll propio, y "+ Añadir línea". La selección de
 *  línea es suya. («Nuevo pedido», desde la 0.9.9, va por recuadros de proveedor: NuevoPedidoDialog.) */
export function DialogoLineas<L extends LineaBase>({ titulo, primera, barra, lineas, proveedores, info, error, bloqueado, enviando, onCambiar, onQuitar, onAnadir, onConfirmar, onCerrar }: Props<L>) {
  const [seleccionada, setSeleccionada] = useState<number | null>(null)
  // Línea hasta la que se desplaza la caja con scroll: la de «+ Añadir línea».
  const [anadida, setAnadida] = useState<number | null>(null)
  const opciones = proveedores.map((p) => ({ valor: String(p.idProv), etiqueta: p.nombre }))

  function seleccionar(id: number) {
    setSeleccionada(id)
    setAnadida(null)
  }
  /** "+ Añadir línea" (añadirFila :496-513): añade, selecciona y desplaza hasta la línea nueva. */
  function anadir() {
    const id = onAnadir()
    setSeleccionada(id)
    setAnadida(id)
  }

  return (
    <DialogoPedidoBase titulo={titulo} nLineas={lineas.length} info={info} error={error} bloqueado={bloqueado} enviando={enviando}
      onConfirmar={onConfirmar} onCerrar={onCerrar}>
      {barra}
      {/* Alto máximo con scroll propio (ListView a prefHeight 220 de FormularioCompraView.fxml, C24; 300-420 desde la 0.9.6): con
          muchas líneas la tabla desplaza y "Cancelar"/"Confirmar pedido" quedan siempre a la vista. El popup del
          autocompletar de Componente va en un portal (CampoAutocompletar), así que el recorte de esta caja no lo
          afecta: no hace falta que el scroll lo traiga a la vista. */}
      <div className="min-h-[300px] max-h-[420px] overflow-y-auto rounded-md bg-superficie">
        <TablaLineas<L>
          primera={primera}
          proveedor={(l, n) => (
            <ComboNavy valor={l.idProv === null ? null : String(l.idProv)} opciones={opciones} onChange={(v) => onCambiar(l.id, { idProv: Number(v) })} textoVacio="" ancho={ANCHO_COMBO_PROVEEDOR} visibles={8} aria-label={`Proveedor línea ${n}`} />
          )}
          lineas={lineas}
          proveedores={proveedores}
          vacio="Añade al menos una línea"
          seleccionada={seleccionada}
          desplazarA={anadida}
          onSeleccionar={seleccionar}
          onCambiar={onCambiar}
          onQuitar={onQuitar}
        />
      </div>
      <div>
        <BotonSecundario type="button" disabled={bloqueado} onClick={anadir}>+ Añadir línea</BotonSecundario>
      </div>
    </DialogoPedidoBase>
  )
}
