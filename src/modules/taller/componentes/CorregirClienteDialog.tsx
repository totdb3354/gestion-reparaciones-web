import { useLayoutEffect, useState } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { fechaLocal, formatear } from '@/shared/lib/fechas'
import { useCerrojoEnvio } from '@/shared/lib/useCerrojoEnvio'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { useClientesActivos, useCorregirCliente, useTrabajosCerrados } from '../api'

const SIN = 'SIN'

type Props = { rep: ReparacionResumen | null; onCerrar: () => void }

/** «Corregir cliente» (spec 0.9.8 añadido §4): cliente correcto y, con casillas, los trabajos cerrados del mismo IMEI que
 *  tienen guardado el mismo cliente que el elegido; de entrada, marcados el elegido y los del mismo día. No toca el
 *  cliente actual del teléfono. Se cierra cuando la corrección sale bien; si falla, sigue abierto con el mensaje. */
export function CorregirClienteDialog({ rep, onCerrar }: Props) {
  const { mostrarError } = useAlerta()
  const { data: cerrados } = useTrabajosCerrados(rep?.imei ?? null)
  const { data: activos = [] } = useClientesActivos(rep !== null)
  const corregir = useCorregirCliente()
  const enviar = useCerrojoEnvio({ abierto: rep !== null, enviando: corregir.isPending })
  const [cliente, setCliente] = useState('')
  const [marcados, setMarcados] = useState<Set<string> | null>(null)

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el formulario al abrir con otra fila (patrón de DialogoIncidencia)
    if (rep) { setCliente(''); setMarcados(null) }
  }, [rep])

  const elegido = cerrados?.find((t) => t.idRep === rep?.idRep)
  const idCliGuardado = elegido ? (elegido.idCli ?? null) : undefined
  const candidatos = cerrados && idCliGuardado !== undefined ? cerrados.filter((t) => (t.idCli ?? null) === idCliGuardado) : []
  // De entrada: el elegido y los del mismo día (piezas de la misma reparación). Se fija una vez por apertura.
  const diaElegido = fechaLocal(elegido?.fechaFin)
  const seleccion = marcados ?? new Set(candidatos.filter((t) => t.idRep === rep?.idRep || fechaLocal(t.fechaFin) === diaElegido).map((t) => t.idRep))

  const guardadoAhora = cerrados === undefined ? 'cargando…' : elegido ? (elegido.cliente ?? '— Sin cliente —') : '—'

  const idCliNuevo = cliente === SIN ? null : cliente === '' ? undefined : Number(cliente)
  const listo = idCliNuevo !== undefined && idCliNuevo !== idCliGuardado && seleccion.size > 0

  function alternar(idRep: string) {
    const s = new Set(seleccion)
    if (s.has(idRep)) s.delete(idRep)
    else s.add(idRep)
    setMarcados(s)
  }

  function confirmar() {
    if (!rep || idCliNuevo === undefined) return
    const idReps = candidatos.map((t) => t.idRep).filter((id) => seleccion.has(id))
    corregir.mutate({ imei: rep.imei, idReps, idCli: idCliNuevo }, {
      onSuccess: onCerrar,
      onError: (e) => { if (!esErrorGestionadoGlobalmente(e)) mostrarError(`No se pudo corregir: ${mensajeDeError(e)}`) },
    })
  }

  return (
    <Dialog open={rep !== null} onOpenChange={(o) => { if (!o && !corregir.isPending) onCerrar() }}>
      <DialogContent aria-describedby={undefined} className="max-w-[560px] gap-2 bg-fondo-input p-4">
        <DialogHeader><DialogTitle className="text-[14px] font-bold text-azul-medio">Corregir cliente</DialogTitle></DialogHeader>
        <p className="text-[12px] text-azul-medio">IMEI {rep?.imei} · guardado ahora: {guardadoAhora}</p>
        <Label htmlFor="corregir-cliente" className="text-[12px]">Cliente correcto</Label>
        <select id="corregir-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} className="h-9 w-full rounded border border-gris-borde bg-superficie px-2 text-[13px]">
          <option value="">Selecciona cliente</option>
          <option value={SIN}>— Sin cliente —</option>
          {activos.map((c) => <option key={c.idCli} value={String(c.idCli)}>{c.nombre}</option>)}
        </select>
        {cerrados !== undefined && !elegido ? (
          <p className="text-[12px] text-azul-medio">Este trabajo ya no está cerrado o no es de este teléfono.</p>
        ) : elegido && (
          <>
          <p className="text-[12px] text-azul-medio">Trabajos cerrados de este IMEI {elegido.cliente ? `con ${elegido.cliente}` : 'sin cliente'}:</p>
          <ul className="max-h-[240px] overflow-y-auto rounded border border-gris-borde bg-superficie p-2">
            {candidatos.map((t) => (
              <li key={t.idRep}>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={seleccion.has(t.idRep)} onChange={() => alternar(t.idRep)} />
                  <span className="font-mono">{t.idRep}</span>
                  <span>{formatear(t.fechaFin, 'dd/MM/yyyy')}</span>
                  <span className="text-azul-gris">{t.descripcion ?? ''}</span>
                </label>
              </li>
            ))}
          </ul>
          </>
        )}
        <Button disabled={!listo || corregir.isPending} onClick={() => enviar(confirmar)} className="h-auto w-full rounded bg-fila-reparado-ico py-2 text-[12px] text-superficie hover:bg-fila-reparado-ico/90 disabled:bg-gris-disabled disabled:text-gris-borde disabled:opacity-100">
          Corregir {seleccion.size}
        </Button>
        <DialogFooter><Button variant="outline" disabled={corregir.isPending} onClick={onCerrar}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
