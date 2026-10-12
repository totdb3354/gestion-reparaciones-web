import { useMemo, useState } from 'react'
import { StaleDataError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { BotonSecundario } from '@/shared/ui/Botones'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { useProveedoresComponentes } from '../../proveedores/api'
import { useComponentesStock } from '../../stock/api'
import { agruparCompartidos, nombreGrupo } from '../../stock/grupos'
import { useCompras, useGuardarLoteCompras } from '../api'
import { agruparEnBloques, situacion } from '../bloques/reglas'
import { destinosDelCuerpo } from './destinos'
import { DialogoLineas } from './DialogoLineas'
import { mensajeErrorGuardado } from './errores'
import {
  aplicarPrevision, aplicarProveedorATodas, rellenarProveedorVacio, avisoNadaQuePedir, avisoOmitidas, avisoSinLista, avisoSinPedido, sinLista, cambiarLinea, cuantasPrevision, cuerpoLoteCompras, lineaCompraVacia, precargaInicial, quitarLinea, siguienteId,
  validarLineasCompra, type LineaCompra,
} from './lineas'
import { ResumenBloques } from './ResumenBloques'

const OPERACION = 'compras:lote'

type Props = { precarga: PrecargaPedido; onCerrar: () => void }

/** "Nuevo pedido" (FormularioCompraController, spec §6): modal en el sitio (P1) con la precarga del store. Un único
 *  POST /api/compras/lote con Idempotency-Key (P5): misma clave mientras el cuerpo no cambie, nueva tras un éxito.
 *  0.9.9: resumen «Bloques» al pie (a qué bloque va cada proveedor) y modo «Añadir líneas» de un bloque (precarga
 *  `bloque`: proveedor y destino fijos). */
export function NuevoPedidoDialog({ precarga, onCerrar }: Props) {
  const componentes = useComponentesStock({ activo: false })
  const { data: proveedores } = useProveedoresComponentes({ activo: false })
  // 0.9.9: los bloques salen de los pedidos (sin sondeo: con el formulario abierto las vistas no refrescan).
  const compras = useCompras({ activo: false })
  const bloques = useMemo(() => agruparEnBloques(compras.data ?? []), [compras.data])
  const fijo = precarga.modo === 'bloque' ? precarga : null
  const activos = useMemo(() => (componentes.data ?? []).filter((c) => c.activo), [componentes.data])
  const proveedoresActivos = useMemo(() => (proveedores ?? []).filter((p) => p.activo), [proveedores])
  const opciones = useMemo(() => agruparCompartidos(activos).map((f) => ({ clave: String(f.idCom), etiqueta: nombreGrupo(f) })), [activos])
  const [lineas, setLineas] = useState<LineaCompra[] | null>(precarga.modo === 'vacio' || fijo ? [] : null)
  const [omitidas, setOmitidas] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Pedido automático (spec 0.9.6 §4.4): proveedor general y cuántas marcadas hay que pedir. En «Añadir líneas», el del bloque.
  const [idProvGeneral, setIdProvGeneral] = useState<number | null>(fijo ? fijo.idProv : null)
  const [sinPedido, setSinPedido] = useState(0)
  // 0.9.9: destino elegido a mano por proveedor (idBloque o null = bloque nuevo).
  const [elegidos, setElegidos] = useState<Record<number, number | null>>({})
  const nPrevision = useMemo(() => cuantasPrevision(activos, idProvGeneral), [activos, idProvGeneral])
  const [sinListaVistas, setSinListaVistas] = useState(0)
  const [nadaQuePedir, setNadaQuePedir] = useState(false)
  // «Añadir previsión…» de un bloque: se aplica una vez, cuando el listado de Stock ha cargado (bien o mal).
  const [previsionPendiente, setPrevisionPendiente] = useState(fijo?.prevision === true)
  const opcionesProveedor = useMemo(() => proveedoresActivos.map((p) => ({ valor: String(p.idProv), etiqueta: p.nombre })), [proveedoresActivos])
  // Una instancia por apertura: el host remonta el diálogo en cada apertura (key), así que no sobrevive a un éxito.
  const [claves] = useState(() => crearClavesIdempotencia())
  const guardar = useGuardarLoteCompras()
  const bloqueFijo = fijo ? bloques.get(String(fijo.idBloque)) : undefined
  const nombreFijo = fijo ? proveedoresActivos.find((p) => p.idProv === fijo.idProv)?.nombre ?? bloqueFijo?.nombreProveedor ?? '' : ''

  const nombrePrevision = fijo ? nombreFijo : proveedoresActivos.find((p) => p.idProv === idProvGeneral)?.nombre ?? ''

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
  // Con la caché de Stock ya cargada, `isSuccess` es true con datos viejos: se espera a que acabe la recarga.
  if (previsionPendiente && fijo && lineas !== null && ((componentes.isSuccess && !componentes.isFetching) || componentes.isError)) {
    setPrevisionPendiente(false)
    if (componentes.isSuccess) {
      const r = aplicarPrevision(lineas, activos, fijo.idProv)
      setLineas(r.lineas)
      setSinPedido(r.sinPedido)
      setSinListaVistas(sinLista(activos))
      setNadaQuePedir(r.lineas.length === lineas.length)
    }
  }

  function cambiar(id: number, cambio: Partial<LineaCompra>) {
    setLineas((ls) => cambiarLinea(ls ?? [], id, cambio))
    setError(null)
    setSinPedido(0)
    setSinListaVistas(0)
    setNadaQuePedir(false)
  }
  function quitar(id: number) {
    setLineas((ls) => quitarLinea(ls ?? [], id))
    setError(null)
    setSinPedido(0)
    setSinListaVistas(0)
    setNadaQuePedir(false)
  }
  function anadir(): number {
    const id = siguienteId(lineas ?? [])
    // Vacía, también si se abrió con "Pedir": calco de anadirLinea() { añadirFila(null); } (FormularioCompraController :496);
    // con el proveedor general si hay uno elegido (0.9.6), que en «Añadir líneas» es el del bloque.
    setLineas((ls) => [...(ls ?? []), { ...lineaCompraVacia(id), idProv: idProvGeneral }])
    setError(null)
    setSinPedido(0)
    setSinListaVistas(0)
    setNadaQuePedir(false)
    return id
  }
  function anadirPrevision() {
    if (idProvGeneral === null) return
    const r = aplicarPrevision(lineas ?? [], activos, idProvGeneral)
    setLineas(r.lineas)
    setSinPedido(r.sinPedido)
    setSinListaVistas(sinLista(activos))
    setNadaQuePedir(false)
    setError(null)
  }
  /** Elegirlo rellena al momento las líneas sin proveedor; las que ya tienen uno solo cambian con «Aplicar a todas». */
  function elegirProveedorGeneral(idProv: number) {
    setIdProvGeneral(idProv)
    setLineas((ls) => rellenarProveedorVacio(ls ?? [], idProv))
    setError(null)
    setSinPedido(0)
    setSinListaVistas(0)
    setNadaQuePedir(false)
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
    // Sin la lista de pedidos no se sabe qué bloques hay abiertos: null y que el servidor aplique su regla por defecto.
    const destinos = fijo ? [{ idProv: fijo.idProv, idBloque: fijo.idBloque }] : compras.isSuccess ? destinosDelCuerpo(lineas, bloques, elegidos) : null
    const cuerpo = cuerpoLoteCompras(lineas, origen, activos, destinos)
    setError(null)
    try {
      await guardar.mutateAsync({ cuerpo, clave: claves.para(OPERACION, cuerpo) })
      claves.hecha(OPERACION)
      onCerrar()
    } catch (e) {
      // Un 409 de destino (el bloque ya no existe): el resumen tiene que ofrecer los bloques de ahora.
      if (e instanceof StaleDataError) void compras.refetch()
      setError(mensajeErrorGuardado(e))
    }
  }

  const bloqueado = guardar.isPending || lineas === null
  const info = [avisoOmitidas(omitidas), avisoSinPedido(sinPedido), avisoSinLista(sinListaVistas), nadaQuePedir ? avisoNadaQuePedir(nombrePrevision) : null].filter((t) => t !== null).join(' ') || null
  const botonPrevision = idProvGeneral === null
    ? <BotonSecundario type="button" disabled title="Elige antes el proveedor">Añadir previsión</BotonSecundario>
    : <BotonSecundario type="button" disabled={bloqueado || nPrevision === 0 || componentes.isFetching} onClick={anadirPrevision}>Añadir previsión de {nombrePrevision} ({nPrevision})</BotonSecundario>

  return (
    <DialogoLineas<LineaCompra>
      titulo={fijo ? `Añadir líneas · Bloque ${fijo.idBloque}` : 'Nuevo pedido'}
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
        fijo ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] text-azul-gris">
              {nombreFijo}{bloqueFijo ? ` · ${situacion(bloqueFijo)}` : ''} · las líneas nuevas entran como pendientes y el bloque mostrará «Confirmar bloque (n)».
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[12px] font-bold text-azul-medio">Proveedor:</span>
              <span className="rounded-full bg-nav-switch px-2.5 py-1 text-[12px] font-bold text-azul-medio">{nombreFijo}</span>
              {botonPrevision}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[12px] font-bold text-azul-medio">Proveedor:</span>
            <ComboNavy valor={idProvGeneral === null ? null : String(idProvGeneral)} opciones={opcionesProveedor} onChange={(v) => elegirProveedorGeneral(Number(v))} textoVacio="" ancho={160} visibles={8} aria-label="Proveedor general" />
            <BotonSecundario type="button" disabled={bloqueado || idProvGeneral === null || (lineas ?? []).length === 0} onClick={aplicarATodas}>Aplicar a todas</BotonSecundario>
            {botonPrevision}
          </div>
        )
      }
      lineas={lineas ?? []}
      proveedores={proveedoresActivos}
      proveedorFijo={fijo ? nombreFijo : undefined}
      pie={
        <ResumenBloques lineas={lineas ?? []} proveedores={proveedoresActivos} bloques={bloques} elegidos={elegidos}
          onElegir={(idProv, idBloque) => { setElegidos((e) => ({ ...e, [idProv]: idBloque })); setError(null) }}
          fijo={fijo ? { idBloque: fijo.idBloque, nombre: nombreFijo } : null} cargando={compras.isPending} />
      }
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
