import { useMemo, useState } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { BotonSecundario } from '@/shared/ui/Botones'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { useComponentesStock } from '../stock/api'
import { agruparCompartidos, nombreGrupo } from '../stock/grupos'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useGuardarPiezasProveedor } from './api'

type Props = { proveedor: Proveedor; onCerrar: () => void }

const textoMarcadas = (n: number) => (n === 1 ? '1 pieza marcada' : `${n} piezas marcadas`)

/** «Piezas que vende…» (spec 2026-10-11 §5.1): la lista del proveedor sale del listado de Stock (`proveedores` de cada
 *  pieza). Se ven las activas, una fila por grupo compartido (el master); las desactivadas que ya estaban en la lista no
 *  se ven pero se conservan al guardar. «Guardar» manda la lista entera. La página lo monta solo mientras está abierto. */
export function PiezasProveedorDialog({ proveedor, onCerrar }: Props) {
  const componentes = useComponentesStock({ activo: false })
  const guardar = useGuardarPiezasProveedor()
  const { mostrarError } = useAlerta()
  const filas = useMemo(() => agruparCompartidos((componentes.data ?? []).filter((c) => c.activo)), [componentes.data])
  const [marcadas, setMarcadas] = useState<Set<number> | null>(null)
  const [texto, setTexto] = useState('')
  const [soloMarcadas, setSoloMarcadas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Las de la lista al abrir (masters, activas o no), una sola vez cuando carga el listado.
  if (marcadas === null && componentes.isSuccess) {
    setMarcadas(new Set((componentes.data ?? [])
      .filter((c) => c.idComMaster == null && (c.proveedores ?? []).includes(proveedor.idProv))
      .map((c) => c.idCom)))
  }

  const buscado = texto.trim().toLowerCase()
  const visibles = filas.filter((f) =>
    (buscado === '' || nombreGrupo(f).toLowerCase().includes(buscado)) && (!soloMarcadas || (marcadas?.has(f.idCom) ?? false)))

  function cambiar(ids: number[], marcar: boolean) {
    setMarcadas((m) => {
      const nuevo = new Set(m ?? [])
      for (const id of ids) {
        if (marcar) nuevo.add(id)
        else nuevo.delete(id)
      }
      return nuevo
    })
    setError(null)
  }

  async function confirmar() {
    if (marcadas === null) return
    setError(null)
    try {
      await guardar.mutateAsync({ idProv: proveedor.idProv, idsCom: [...marcadas] })
      onCerrar()
    } catch (e) {
      if (e instanceof ReglaNegocioError) { setError(e.message); return }
      if (esErrorGestionadoGlobalmente(e)) return
      mostrarError(mensajeDeError(e))
    }
  }

  return (
    <DialogoAlmacen abierto ancho={640} titulo={`Piezas que vende · ${proveedor.nombre}`} error={error} textoAccion="Guardar"
      enviando={guardar.isPending} accionDeshabilitada={marcadas === null} onConfirmar={() => void confirmar()} onCancelar={onCerrar}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar pieza…" aria-label="Buscar pieza" className="w-[200px] bg-superficie" />
        <BotonSecundario type="button" onClick={() => cambiar(visibles.map((f) => f.idCom), true)}>Marcar las que se ven</BotonSecundario>
        <BotonSecundario type="button" onClick={() => cambiar(visibles.map((f) => f.idCom), false)}>Quitar las que se ven</BotonSecundario>
        <label className="flex items-center gap-1.5 text-[12px] text-azul-gris">
          <Checkbox checked={soloMarcadas} onCheckedChange={(v) => setSoloMarcadas(v === true)} aria-label="Solo las marcadas" />
          Solo las marcadas
        </label>
      </div>
      <p className="text-[12px] text-azul-gris">{textoMarcadas(marcadas?.size ?? 0)}</p>
      <div className="flex max-h-[50vh] flex-col overflow-y-auto rounded border border-fila-sep">
        {visibles.map((f) => (
          <label key={f.idCom} className="flex items-center gap-2 border-b border-fila-sep px-2 py-1 text-[13px] text-azul-medio last:border-b-0">
            <Checkbox checked={marcadas?.has(f.idCom) ?? false} onCheckedChange={(v) => cambiar([f.idCom], v === true)} aria-label={`Vende ${nombreGrupo(f)}`} />
            {nombreGrupo(f)}
          </label>
        ))}
      </div>
    </DialogoAlmacen>
  )
}
