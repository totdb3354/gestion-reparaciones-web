import { useState, type ReactNode } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { formatearImporte, parsearDecimal, parsearEntero, simboloFormulario } from '@/shared/lib/importes'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { Checkbox } from '@/shared/ui/checkbox'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useTasas } from '../tasa'
import { totalLinea } from './conversion'
import type { LineaBase } from './lineas'

/** Columnas tras la primera (FormularioCompraView.fxml:19-25): Proveedor 155 · Cant. 55 · P.Unit. 80 · Urg. 45 ·
 *  Total EUR 90 · papelera 40 sin cabecera. */
const COLUMNAS = [
  { cabecera: 'Proveedor', ancho: 155 },
  { cabecera: 'Cant.', ancho: 55 },
  { cabecera: 'P.Unit.', ancho: 80 },
  { cabecera: 'Urg.', ancho: 45 },
  { cabecera: 'Total EUR', ancho: 90 },
  { cabecera: '', ancho: 40 },
]
/** ESTILO_EDITABLE del JavaFX (FC :321-379): caja blanca, borde #C2C8D0, radio 3, padding 5 8. */
const CLASE_EDITABLE = 'h-[26px] w-full min-w-0 rounded-[3px] border border-fila-sep bg-superficie px-2 text-[12px] text-azul-medio outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
/** Ancho del combo de proveedor dentro de su celda (155 px menos el padding; cabe también con el reparto proporcional de
 *  "Nuevo otro pedido"). */
const ANCHO_COMBO_PROVEEDOR = 140

type Props<L extends LineaBase> = {
  titulo: string
  primera: { cabecera: string; ancho: number; celda: (linea: L, n: number) => ReactNode }
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

/** Armazón de "Nuevo pedido" y "Nuevo otro pedido" (FormularioCompraView.fxml / FormularioOtroPedidoView.fxml): modal de
 *  700 px, título de 24 px, tabla de líneas con celdas siempre editables (P8), "+ Añadir línea", línea de información,
 *  línea de error (P6) y "Cancelar" / "Confirmar pedido". La divisa de cada línea es la de su proveedor; sin proveedor la
 *  línea se calcula como EUR (tasa 1.0 por defecto de LineaCompra). Sin atajos de teclado (el JavaFX no tenía). */
export function DialogoLineas<L extends LineaBase>({ titulo, primera, lineas, proveedores, info, error, bloqueado, enviando, onCambiar, onQuitar, onAnadir, onConfirmar, onCerrar }: Props<L>) {
  const [seleccionada, setSeleccionada] = useState<number | null>(null)
  const [anadida, setAnadida] = useState<number | null>(null)
  // C25: si el diálogo ya nace con líneas (precarga desde Stock/campana con la caché caliente), Radix enfoca Y
  // SELECCIONA el primer campo tabulable al abrirse (@radix-ui/react-focus-scope, focusFirst({ select: true })):
  // el Componente de la línea 1 queda con el texto en azul, y teclear lo pisa. El JavaFX no autoenfoca ese campo.
  // Con el diálogo vacío (alta manual u "Otros") no hay ninguna línea todavía en el primer render, así que el
  // foco automático de Radix no cae sobre un campo con texto y se deja como estaba (calco). El valor se congela
  // en el primer render: es justo el que ve el efecto de montaje de FocusScope, que solo corre una vez.
  const [huboPrecarga] = useState(() => lineas.length > 0)
  const porId = new Map(proveedores.map((p) => [p.idProv, p]))
  const divisaDe = (l: LineaBase): string => (l.idProv === null ? undefined : porId.get(l.idProv)?.divisa) ?? 'EUR'
  const tasas = useTasas(Array.from(new Set(lineas.map(divisaDe))))
  const opciones = proveedores.map((p) => ({ valor: String(p.idProv), etiqueta: p.nombre }))
  const anchos = [primera.ancho, ...COLUMNAS.map((c) => c.ancho)]
  const suma = anchos.reduce((a, b) => a + b, 0)

  function totalDe(l: L): string {
    const total = totalLinea(parsearDecimal(l.precio), tasas[divisaDe(l)]?.tasa ?? null, parsearEntero(l.cantidad))
    return total === null ? '—' : formatearImporte(total, '€')
  }
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
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !enviando) onCerrar() }}>
      <DialogContent
        aria-describedby={undefined}
        // Sin seleccionar texto en una precarga (C25): igual de accesible que el comportamiento por defecto de Radix
        // (el propio diálogo recibe el foco, sin tocar ningún campo), pero sin pisar lo precargado al teclear.
        onOpenAutoFocus={huboPrecarga ? (e) => { e.preventDefault(); (e.target as HTMLElement).focus() } : undefined}
        className="max-h-[calc(100vh-24px)] w-[700px] max-w-[min(700px,calc(100%-2rem))] gap-4 overflow-y-auto bg-fondo-vista p-7 sm:max-w-[min(700px,calc(100%-2rem))]"
      >
        <DialogTitle className="text-2xl font-bold text-azul-medio">{titulo}</DialogTitle>
        {/* Alto máximo con scroll propio (calco del ListView a prefHeight 220 de FormularioCompraView.fxml, C24): con
            muchas líneas la tabla desplaza y "Cancelar"/"Confirmar pedido" quedan siempre a la vista. El popup del
            autocompletar es absolute dentro de esta misma caja, así que si la fila abierta queda fuera del recorte
            visible, el propio scroll (o el desplazamiento del campo al enfocarlo) la trae a la vista. */}
        <div className="min-h-[220px] max-h-[260px] overflow-y-auto rounded-md bg-superficie">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              {anchos.map((a, i) => <col key={i} style={{ width: `${(a / suma) * 100}%` }} />)}
            </colgroup>
            <TableHeader className="bg-crema">
              <TableRow className="hover:bg-transparent">
                {[primera.cabecera, ...COLUMNAS.map((c) => c.cabecera)].map((c, i) => (
                  <TableHead key={i} className="h-8 px-1 text-[12px] font-bold text-azul-medio">{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={anchos.length} className="py-8 text-center text-azul-gris">Añade al menos una línea</TableCell>
                </TableRow>
              )}
              {lineas.map((l, i) => {
                const n = i + 1
                return (
                  <TableRow
                    key={l.id}
                    ref={l.id === anadida ? (el: HTMLTableRowElement | null) => { el?.scrollIntoView({ block: 'nearest' }) } : undefined}
                    data-state={l.id === seleccionada ? 'selected' : undefined}
                    // Enfocar cualquier campo de la fila la selecciona (FC :203-205); el foco burbujea en React.
                    onFocus={() => seleccionar(l.id)}
                    onClick={() => seleccionar(l.id)}
                    className="group border-b border-fila-sep hover:bg-transparent data-[state=selected]:border-b-fila-selected-brd data-[state=selected]:bg-azul-medio data-[state=selected]:text-crema"
                  >
                    <TableCell className="px-1 py-1">{primera.celda(l, n)}</TableCell>
                    <TableCell className="px-1 py-1">
                      <ComboNavy valor={l.idProv === null ? null : String(l.idProv)} opciones={opciones} onChange={(v) => onCambiar(l.id, { idProv: Number(v) })} textoVacio="" ancho={ANCHO_COMBO_PROVEEDOR} visibles={8} aria-label={`Proveedor línea ${n}`} />
                    </TableCell>
                    <TableCell className="px-1 py-1">
                      <input aria-label={`Cantidad línea ${n}`} value={l.cantidad} onChange={(e) => onCambiar(l.id, { cantidad: e.target.value })} className={CLASE_EDITABLE} />
                    </TableCell>
                    <TableCell className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <input aria-label={`Precio línea ${n}`} value={l.precio} onChange={(e) => onCambiar(l.id, { precio: e.target.value })} className={CLASE_EDITABLE} />
                        <span className="shrink-0 text-[12px]">{simboloFormulario(divisaDe(l))}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-1 py-1 text-center">
                      <Checkbox aria-label={`Urgente línea ${n}`} checked={l.urgente} onCheckedChange={(v) => onCambiar(l.id, { urgente: v === true })} className="bg-superficie" />
                    </TableCell>
                    <TableCell className="px-1 py-1 text-[12px]">{totalDe(l)}</TableCell>
                    <TableCell className="px-1 py-1 text-center">
                      <button type="button" aria-label={`Quitar línea ${n}`} onClick={(e) => { e.stopPropagation(); onQuitar(l.id) }} className="cursor-pointer bg-transparent">
                        <img src="/borrar.png" alt="" className="h-[25px] w-[25px]" />
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
        <div>
          <BotonSecundario type="button" disabled={bloqueado} onClick={anadir}>+ Añadir línea</BotonSecundario>
        </div>
        {info !== null && <p role="status" className="text-[11px] text-azul-gris">{info}</p>}
        {error !== null && <p role="alert" className="text-[11px] text-texto-error">{error}</p>}
        <div className="flex justify-end gap-2.5">
          <BotonSecundario type="button" disabled={enviando} onClick={onCerrar}>Cancelar</BotonSecundario>
          <BotonPrimario type="button" disabled={bloqueado} onClick={onConfirmar}>Confirmar pedido</BotonPrimario>
        </div>
      </DialogContent>
    </Dialog>
  )
}
