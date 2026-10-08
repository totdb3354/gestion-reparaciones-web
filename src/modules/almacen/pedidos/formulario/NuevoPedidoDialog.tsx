import { useMemo, useState } from 'react'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { BotonSecundario } from '@/shared/ui/Botones'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { useProveedoresComponentes } from '../../proveedores/api'
import { useComponentesStock } from '../../stock/api'
import { agruparCompartidos, nombreGrupo } from '../../stock/grupos'
import { useGuardarLoteCompras } from '../api'
import { DialogoLineas } from './DialogoLineas'
import { mensajeErrorGuardado } from './errores'
import {
  aplicarPrevision, aplicarProveedorATodas, rellenarProveedorVacio, avisoOmitidas, avisoSinPedido, cambiarLinea, cuantasPrevision, cuerpoLoteCompras, lineaCompraVacia, precargaInicial, quitarLinea, siguienteId,
  validarLineasCompra, type LineaCompra,
} from './lineas'

const OPERACION = 'compras:lote'

type Props = { precarga: PrecargaPedido; onCerrar: () => void }

/** "Nuevo pedido" (FormularioCompraController, spec §6): modal en el sitio (P1) con la precarga del store. Un único
 *  POST /api/compras/lote con Idempotency-Key (P5): misma clave mientras el cuerpo no cambie, nueva tras un éxito. */
export function NuevoPedidoDialog({ precarga, onCerrar }: Props) {
  const componentes = useComponentesStock({ activo: false })
  const { data: proveedores } = useProveedoresComponentes({ activo: false })
  const activos = useMemo(() => (componentes.data ?? []).filter((c) => c.activo), [componentes.data])
  const proveedoresActivos = useMemo(() => (proveedores ?? []).filter((p) => p.activo), [proveedores])
  const opciones = useMemo(() => agruparCompartidos(activos).map((f) => ({ clave: String(f.idCom), etiqueta: nombreGrupo(f) })), [activos])
  const [lineas, setLineas] = useState<LineaCompra[] | null>(precarga.modo === 'vacio' ? [] : null)
  const [omitidas, setOmitidas] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Pedido automático (spec 0.9.6 §4.4): proveedor general y cuántas marcadas hay que pedir.
  const [idProvGeneral, setIdProvGeneral] = useState<number | null>(null)
  const [sinPedido, setSinPedido] = useState(0)
  const nPrevision = useMemo(() => cuantasPrevision(activos), [activos])
  const opcionesProveedor = useMemo(() => proveedoresActivos.map((p) => ({ valor: String(p.idProv), etiqueta: p.nombre })), [proveedoresActivos])
  // Una instancia por apertura: el host remonta el diálogo en cada apertura (key), así que no sobrevive a un éxito.
  const [claves] = useState(() => crearClavesIdempotencia())
  const guardar = useGuardarLoteCompras()

  // Precarga una sola vez, cuando la lista de componentes termina de cargar (bien o mal): patrón "ajustar el estado
  // durante el render" (CampoAutocompletar, useErrorServidor), sin useEffect + setState.
  // Si la carga falla, `activos` queda vacío y toda solicitud parecería "omitida" (falso: no se ha podido leer la
  // lista, no es que estén desactivados). El diálogo global de error ya avisa del fallo, así que aquí no se cuenta
  // ninguna omitida y no sale la línea de información.
  if (lineas === null && (componentes.isSuccess || componentes.isError)) {
    const inicial = precargaInicial(precarga, activos)
    setLineas(inicial.lineas)
    setOmitidas(componentes.isError ? 0 : inicial.omitidas)
  }

  function cambiar(id: number, cambio: Partial<LineaCompra>) {
    setLineas((ls) => cambiarLinea(ls ?? [], id, cambio))
    setError(null)
    setSinPedido(0)
  }
  function quitar(id: number) {
    setLineas((ls) => quitarLinea(ls ?? [], id))
    setError(null)
    setSinPedido(0)
  }
  function anadir(): number {
    const id = siguienteId(lineas ?? [])
    // Vacía, también si se abrió con "Pedir": calco de anadirLinea() { añadirFila(null); } (FormularioCompraController :496);
    // con el proveedor general si hay uno elegido (0.9.6).
    setLineas((ls) => [...(ls ?? []), { ...lineaCompraVacia(id), idProv: idProvGeneral }])
    setError(null)
    setSinPedido(0)
    return id
  }
  function anadirPrevision() {
    const r = aplicarPrevision(lineas ?? [], activos, idProvGeneral)
    setLineas(r.lineas)
    setSinPedido(r.sinPedido)
    setError(null)
  }
  /** Elegirlo rellena al momento las líneas sin proveedor; las que ya tienen uno solo cambian con «Aplicar a todas». */
  function elegirProveedorGeneral(idProv: number) {
    setIdProvGeneral(idProv)
    setLineas((ls) => rellenarProveedorVacio(ls ?? [], idProv))
    setError(null)
  }
  function aplicarATodas() {
    if (idProvGeneral === null) return
    setLineas((ls) => aplicarProveedorATodas(ls ?? [], idProvGeneral))
    setError(null)
  }

  async function confirmar() {
    if (lineas === null) return
    const fallo = validarLineasCompra(lineas)
    if (fallo !== null) {
      setError(fallo)
      return
    }
    const origen = precarga.modo === 'solicitudes' ? { urgentes: precarga.urgentes, preventivas: precarga.preventivas } : null
    const cuerpo = cuerpoLoteCompras(lineas, origen, activos)
    setError(null)
    try {
      await guardar.mutateAsync({ cuerpo, clave: claves.para(OPERACION, cuerpo) })
      claves.hecha(OPERACION)
      onCerrar()
    } catch (e) {
      setError(mensajeErrorGuardado(e))
    }
  }

  const bloqueado = guardar.isPending || lineas === null
  const info = [avisoOmitidas(omitidas), avisoSinPedido(sinPedido)].filter((t) => t !== null).join(' ') || null

  return (
    <DialogoLineas<LineaCompra>
      titulo="Nuevo pedido"
      primera={{
        cabecera: 'Componente',
        ancho: 175,
        celda: (l, n) => (
          // Fila seleccionada: el campo navy lleva el borde rgba(255,255,255,0.35) del JavaFX (FC :459-473).
          <div className="rounded-full group-data-[state=selected]:ring-1 group-data-[state=selected]:ring-white/35">
            <CampoAutocompletar valor={l.idCom === null ? null : String(l.idCom)} opciones={opciones} onElegir={(c) => cambiar(l.id, { idCom: Number(c) })} placeholder="Escribe componente..." aria-label={`Componente línea ${n}`} />
          </div>
        ),
      }}
      barra={
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12px] font-bold text-azul-medio">Proveedor:</span>
          <ComboNavy valor={idProvGeneral === null ? null : String(idProvGeneral)} opciones={opcionesProveedor} onChange={(v) => elegirProveedorGeneral(Number(v))} textoVacio="" ancho={160} visibles={8} aria-label="Proveedor general" />
          <BotonSecundario type="button" disabled={bloqueado || idProvGeneral === null || (lineas ?? []).length === 0} onClick={aplicarATodas}>Aplicar a todas</BotonSecundario>
          <BotonSecundario type="button" disabled={bloqueado || nPrevision === 0} onClick={anadirPrevision}>Añadir previsión ({nPrevision})</BotonSecundario>
        </div>
      }
      lineas={lineas ?? []}
      proveedores={proveedoresActivos}
      info={info}
      error={error}
      bloqueado={bloqueado}
      enviando={guardar.isPending}
      onCambiar={cambiar}
      onQuitar={quitar}
      onAnadir={anadir}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  )
}
