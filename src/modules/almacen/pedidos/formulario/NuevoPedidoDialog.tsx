import { useMemo, useState } from 'react'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { useProveedoresComponentes } from '../../proveedores/api'
import { useComponentesStock } from '../../stock/api'
import { useGuardarLoteCompras } from '../api'
import { DialogoLineas } from './DialogoLineas'
import { mensajeErrorGuardado } from './errores'
import {
  avisoOmitidas, cambiarLinea, cuerpoLoteCompras, lineaCompraVacia, precargaInicial, preseleccionDe, quitarLinea, siguienteId,
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
  const opciones = useMemo(() => activos.map((c) => ({ clave: String(c.idCom), etiqueta: c.tipo })), [activos])
  const [lineas, setLineas] = useState<LineaCompra[] | null>(precarga.modo === 'vacio' ? [] : null)
  const [omitidas, setOmitidas] = useState(0)
  const [error, setError] = useState<string | null>(null)
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
  const preseleccion = preseleccionDe(precarga, activos)

  function cambiar(id: number, cambio: Partial<LineaCompra>) {
    setLineas((ls) => cambiarLinea(ls ?? [], id, cambio))
    setError(null)
  }
  function quitar(id: number) {
    setLineas((ls) => quitarLinea(ls ?? [], id))
    setError(null)
  }
  function anadir(): number {
    const id = siguienteId(lineas ?? [])
    setLineas((ls) => [...(ls ?? []), lineaCompraVacia(id, preseleccion)])
    setError(null)
    return id
  }

  async function confirmar() {
    if (lineas === null) return
    const fallo = validarLineasCompra(lineas)
    if (fallo !== null) {
      setError(fallo)
      return
    }
    const origen = precarga.modo === 'solicitudes' ? { urgentes: precarga.urgentes, preventivas: precarga.preventivas } : null
    const cuerpo = cuerpoLoteCompras(lineas, origen)
    setError(null)
    try {
      await guardar.mutateAsync({ cuerpo, clave: claves.para(OPERACION, cuerpo) })
      claves.hecha(OPERACION)
      onCerrar()
    } catch (e) {
      setError(mensajeErrorGuardado(e))
    }
  }

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
      lineas={lineas ?? []}
      proveedores={proveedoresActivos}
      info={avisoOmitidas(omitidas)}
      error={error}
      bloqueado={guardar.isPending || lineas === null}
      enviando={guardar.isPending}
      onCambiar={cambiar}
      onQuitar={quitar}
      onAnadir={anadir}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  )
}
