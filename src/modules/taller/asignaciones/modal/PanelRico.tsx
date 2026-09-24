import type { Dispatch } from 'react'
import type { Cliente, FilaCarga, Tecnico } from '@/shared/api/client'
import { CampoEscaneo } from './CampoEscaneo'
import { DetalleEntrada } from './DetalleEntrada'
import { FilaCola } from './FilaCola'
import { MensajeEscaneo } from './MensajeEscaneo'
import { filasCola, imeiEnColaActiva } from './estado/derivados'
import type { Accion, Entrada, EstadoModal } from './estado/tipos'

type Props = { estado: EstadoModal; dispatch: Dispatch<Accion>; tecnicos: Tecnico[]; carga: FilaCarga[]; clientes: Cliente[] }

/** Reparación y Glass comparten esqueleto: escaneo, listas roja y verde de la cola activa, y detalle. */
export function PanelRico(props: Props) {
  const { estado, dispatch, tecnicos } = props
  if (estado.pestana === 'PULIDO') return null
  const { rojas, verdes } = filasCola(estado, estado.pestana)
  // En el orden de la lista de técnicos, como el JavaFX
  const nombres = (e: Entrada) => tecnicos.filter((t) => e.tecnicos.includes(t.idTec)).map((t) => t.nombre).join(', ')
  const fila = (e: Entrada) => (
    <FilaCola key={e.seq} e={e} nombresTecnicos={nombres(e)} seleccionada={e.seq === estado.actual}
      onCargar={() => dispatch({ tipo: 'CARGAR', seq: e.seq })} onQuitar={() => dispatch({ tipo: 'QUITAR', seq: e.seq })} />
  )
  return (
    <div className="flex flex-col gap-3">
      <CampoEscaneo etiqueta="Escanear IMEI → pendiente de asignar" autoFocus
        onTeclear={() => dispatch({ tipo: 'LIMPIAR_MENSAJE', panel: 'rico' })}
        onImei={(imei) => { const repetido = imeiEnColaActiva(estado, imei); dispatch({ tipo: 'ESCANEAR', imei }); return !repetido }}
        onPegado={(texto) => dispatch({ tipo: 'PEGAR', texto })} />
      <MensajeEscaneo mensaje={estado.mensajeScan} />
      <hr className="border-borde-input" />
      <div className="flex flex-wrap gap-[18px]">
        <div className="flex w-[300px] shrink-0 flex-col gap-1.5">
          <span className="text-[11.5px] font-bold text-cola-roja">Pendiente de asignar ({rojas.length})</span>
          <div className="max-h-[220px] min-h-[34px] overflow-y-auto rounded-md border border-cola-roja-brd bg-white">{rojas.map(fila)}</div>
          <span className="pt-2.5 text-[11.5px] font-bold text-recibido-text">Asignados ({verdes.length}) · sin guardar</span>
          <div className="max-h-[220px] min-h-[34px] overflow-y-auto rounded-md border border-cola-verde-brd bg-white">{verdes.map(fila)}</div>
        </div>
        <div className="min-w-[280px] flex-1"><DetalleEntrada {...props} /></div>
      </div>
    </div>
  )
}
