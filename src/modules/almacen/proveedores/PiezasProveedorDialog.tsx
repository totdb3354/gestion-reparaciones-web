import { useState } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError } from '@/shared/api/errors'
import { traducirModelo } from '@/shared/lib/modelos'
import { nombreTipoPieza } from '@/shared/lib/tiposPieza'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Checkbox } from '@/shared/ui/checkbox'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useGuardarPiezasProveedor, usePiezasProveedor } from './api'
import {
  AYUDA_PIEZAS, cuerpoGuardar, estadoInicial, fijarVendidos, marcarTipo, textoBoton, textoRecuento, textoSinModelos, vendidos,
  type EstadoTipos,
} from './piezasPorTipo'

type Props = { proveedor: Proveedor; onCerrar: () => void }

/** «Piezas que vende…» por tipo de pieza (spec 2026-10-12 §5.1): un renglón por tipo con su casilla y el desplegable de
 *  modelos (todos marcados de entrada; los desmarcados quedan excluidos). «Guardar» manda todo. La página lo monta solo
 *  mientras está abierto. */
export function PiezasProveedorDialog({ proveedor, onCerrar }: Props) {
  const piezas = usePiezasProveedor(proveedor.idProv)
  const guardar = useGuardarPiezasProveedor()
  const { mostrarError } = useAlerta()
  const [estado, setEstado] = useState<EstadoTipos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tipos = piezas.data ?? []

  // Una sola vez, con datos frescos: con la caché ya cargada, `isSuccess` es true al montar con datos viejos.
  if (estado === null && piezas.isSuccess && !piezas.isFetching) setEstado(estadoInicial(piezas.data))

  function cambiar(nuevo: EstadoTipos) {
    setEstado(nuevo)
    setError(null)
  }

  async function confirmar() {
    if (estado === null) return
    setError(null)
    try {
      await guardar.mutateAsync({ idProv: proveedor.idProv, cuerpo: cuerpoGuardar(tipos, estado) })
      onCerrar()
    } catch (e) {
      if (e instanceof ReglaNegocioError) { setError(e.message); return }
      if (esErrorGestionadoGlobalmente(e)) return
      mostrarError(mensajeDeError(e))
    }
  }

  return (
    <DialogoAlmacen abierto ancho={640} titulo={`Piezas que vende · ${proveedor.nombre}`} subtitulo={AYUDA_PIEZAS} error={error}
      textoAccion="Guardar" enviando={guardar.isPending} accionDeshabilitada={estado === null}
      onConfirmar={() => void confirmar()} onCancelar={onCerrar}>
      {estado === null ? (
        <p role="status" className="text-[12px] text-azul-gris">
          {piezas.isError ? 'No se ha podido cargar la lista de piezas.' : 'Cargando piezas…'}
        </p>
      ) : (
        <>
          <p className="text-[12px] text-azul-gris">{textoRecuento(estado, tipos.length)}</p>
          <div className="flex flex-col rounded border border-fila-sep bg-superficie">
            {tipos.map((t) => {
              const excluidos = estado.get(t.prefijo)
              const nombre = nombreTipoPieza(t.prefijo)
              return (
                <div key={t.prefijo} data-prefijo={t.prefijo}
                  className="flex min-h-12 items-center gap-2.5 border-b border-fila-sep px-2.5 py-2 last:border-b-0">
                  <label className="flex w-[150px] shrink-0 items-center gap-2 text-[13px] text-azul-medio">
                    <Checkbox checked={excluidos !== undefined} onCheckedChange={(v) => cambiar(marcarTipo(estado, t.prefijo, v === true))}
                      aria-label={`Vende ${nombre}`} />
                    {nombre}
                  </label>
                  {/* Se corta con «…» al ancho que quede; la lista entera, al pasar el ratón. */}
                  <span title={textoSinModelos(t, excluidos) || undefined} className="min-w-0 flex-1 truncate text-[11.5px] text-texto-sub">
                    {textoSinModelos(t, excluidos)}
                  </span>
                  <MultiSelect opciones={t.modelos} clave={(m) => m} etiqueta={(m) => traducirModelo(m)} seleccion={vendidos(t, excluidos)}
                    onChange={(s) => cambiar(fijarVendidos(estado, t, s))} textoVacio="No lo vende" textoPlural={(n) => `${n} modelos`}
                    texto={textoBoton(t, excluidos)} opcionTodas="Todos los modelos" deshabilitado={excluidos === undefined}
                    etiquetaAccesible={`Modelos de ${nombre}`} className="h-8 w-[190px] min-w-[190px] shrink-0" />
                </div>
              )
            })}
          </div>
        </>
      )}
    </DialogoAlmacen>
  )
}
