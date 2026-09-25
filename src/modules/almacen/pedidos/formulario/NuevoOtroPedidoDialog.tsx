import { useMemo, useState } from 'react'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { useProveedoresComponentes } from '../../proveedores/api'
import { useGuardarLoteOtros } from '../api'
import { DialogoLineas } from './DialogoLineas'
import { mensajeErrorGuardado } from './errores'
import { cambiarLinea, cuerpoLoteOtros, lineaOtroVacia, quitarLinea, siguienteId, validarLineasOtro, type LineaOtro } from './lineas'

const OPERACION = 'compras-otros:lote'

type Props = { onCerrar: () => void }

/** "Nuevo otro pedido" (FormularioOtroPedidoController, inventario §11): la tabla de "Nuevo pedido" con Concepto de texto
 *  libre (FO :178-182, sin popup) en vez de Componente. Solo carga proveedores. Un POST /api/compras-otros/lote. */
export function NuevoOtroPedidoDialog({ onCerrar }: Props) {
  const { data: proveedores } = useProveedoresComponentes({ activo: false })
  const proveedoresActivos = useMemo(() => (proveedores ?? []).filter((p) => p.activo), [proveedores])
  const [lineas, setLineas] = useState<LineaOtro[]>([])
  const [error, setError] = useState<string | null>(null)
  const [claves] = useState(() => crearClavesIdempotencia())
  const guardar = useGuardarLoteOtros()

  function cambiar(id: number, cambio: Partial<LineaOtro>) {
    setLineas((ls) => cambiarLinea(ls, id, cambio))
    setError(null)
  }
  function quitar(id: number) {
    setLineas((ls) => quitarLinea(ls, id))
    setError(null)
  }
  function anadir(): number {
    const id = siguienteId(lineas)
    setLineas((ls) => [...ls, lineaOtroVacia(id)])
    setError(null)
    return id
  }

  async function confirmar() {
    const fallo = validarLineasOtro(lineas)
    if (fallo !== null) {
      setError(fallo)
      return
    }
    const cuerpo = cuerpoLoteOtros(lineas)
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
    <DialogoLineas<LineaOtro>
      titulo="Nuevo otro pedido"
      primera={{
        cabecera: 'Concepto',
        ancho: 200,
        celda: (l, n) => (
          <input
            aria-label={`Concepto línea ${n}`}
            value={l.concepto}
            placeholder="Escribe concepto..."
            onChange={(e) => cambiar(l.id, { concepto: e.target.value })}
            className="w-full rounded-full bg-azul-noche px-3 py-1 text-[12px] font-bold text-crema outline-none placeholder:text-crema/45 group-data-[state=selected]:ring-1 group-data-[state=selected]:ring-white/35"
          />
        ),
      }}
      lineas={lineas}
      proveedores={proveedoresActivos}
      info={null}
      error={error}
      bloqueado={guardar.isPending}
      enviando={guardar.isPending}
      onCambiar={cambiar}
      onQuitar={quitar}
      onAnadir={anadir}
      onConfirmar={() => void confirmar()}
      onCerrar={onCerrar}
    />
  )
}
