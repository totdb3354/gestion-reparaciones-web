import { useEffect, useMemo, useReducer, useState } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { useClientes } from '@/shared/api/clientes'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { cn } from '@/shared/lib/utils'
import { useTecnicos } from '../../api'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { useCargaTecnicos } from '../api'
import { useGuardarLote } from './api'
import { construirLote } from './lote'
import { PanelPulido } from './PanelPulido'
import { PanelRico } from './PanelRico'
import { useEfectosModal } from './useEfectosModal'
import { contadorPestana, resumenBarra, totalEscaneados } from './estado/derivados'
import { reducir } from './estado/reductor'
import { estadoInicial, type Efecto, type Pestana } from './estado/tipos'

type Props = { tabla: ReparacionResumen[]; onCerrar: () => void; onInteraccion: (abierta: boolean) => void }

const PESTANAS: { p: Pestana; etiqueta: string }[] = [
  { p: 'REPARACION', etiqueta: 'Reparación' }, { p: 'GLASS', etiqueta: 'Glass' }, { p: 'PULIDO', etiqueta: 'Pulido' }]
const CATEGORIA: Record<string, string> = { R: 'Reparación', G: 'Glass', P: 'Pulido' }
/** Cola vacía estable: mientras cargan los clientes no se consume ningún efecto (ver abajo). */
const SIN_EFECTOS: Efecto[] = []

/** Modal "Asignar trabajos" (abrirFormularioAsignacion del JavaFX). Nada se escribe hasta "Guardar (N)", salvo el
 *  modelo decidido a mano (D3). La tabla de detrás queda congelada mientras está abierto. */
export function AsignarTrabajosDialog({ tabla, onCerrar, onInteraccion }: Props) {
  const [estado, dispatch] = useReducer(reducir, tabla, (t) =>
    estadoInicial(t.map((r) => ({ idRep: r.idRep, imei: r.imei, idTec: r.idTec, nombreTecnico: r.nombreTecnico }))))
  const { data: tecnicos = [] } = useTecnicos(true)
  const { data: carga } = useCargaTecnicos(true)
  const { data: clientes = [], isPending: cargandoClientes } = useClientes()
  const idsClientes = useMemo(() => new Set(clientes.map((c) => c.idCli)), [clientes])
  // D6: el lookup y el cliente de pulido filtran el cliente de BD contra `idsClientes` al lanzarse; lanzados antes de
  // que llegue la lista lo perderían en silencio. La cola del reductor espera hasta entonces (si la consulta falla,
  // sigue adelante sin clientes, como el JavaFX con la lista vacía).
  useEfectosModal(cargandoClientes ? SIN_EFECTOS : estado.efectos, dispatch, idsClientes)
  useEffect(() => { onInteraccion(true); return () => onInteraccion(false) }, [onInteraccion])

  const guardarLote = useGuardarLote()
  // Una clave por intento de guardado: el reintento tras un fallo (mismo cuerpo) reutiliza la clave, así el servidor
  // no duplica lo que quizá sí escribió; tras un éxito el modal se cierra y la siguiente apertura empieza de cero.
  const [claves] = useState(() => crearClavesIdempotencia())
  const [descartar, setDescartar] = useState(false)
  const { mostrarError, mostrarAviso } = useAlerta()
  const barra = resumenBarra(estado)
  const guardando = guardarLote.isPending
  const total = totalEscaneados(estado)

  const pedirCierre = () => {
    if (guardando) return
    if (total === 0) onCerrar()
    else setDescartar(true)
  }

  const guardar = async () => {
    const cuerpo = construirLote(estado)
    const clave = claves.para('lote', cuerpo)
    try {
      const r = await guardarLote.mutateAsync({ cuerpo, clave })
      claves.hecha('lote')
      onCerrar()
      if (r.conflictos.length > 0)
        mostrarAviso('Aviso', 'Algunas asignaciones no se crearon:\n\n' + r.conflictos
          .map((c) => `• ${c.imei} → ${c.nombreTecnico} (ya asignado · ${CATEGORIA[c.categoria] ?? c.categoria})`).join('\n'))
    } catch (e) {
      if (!esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e))
    }
  }

  const panel = { estado, dispatch, tecnicos, carga: carga?.pedidos ?? [], clientes }

  return (
    <>
      <Dialog open onOpenChange={(abierto) => { if (!abierto) pedirCierre() }}>
        <DialogContent className="max-h-[calc(100vh-24px)] w-[calc(100vw-32px)] max-w-[980px] overflow-y-auto bg-fondo-vista p-[26px] sm:max-w-[980px]">
          <DialogTitle className="text-[20px] font-bold text-azul-medio">Asignar trabajos</DialogTitle>
          <DialogDescription className="text-[11px] text-azul-gris">
            Elige el tipo, escanea IMEIs y configúralos. Los técnicos se mantienen entre IMEIs. Se guardan todos al final.
          </DialogDescription>
          {/* toggle-pill del JavaFX: mismas clases que el toggle Pedidos | Total de CargaTecnicosDialog */}
          <div className="inline-flex" role="group" aria-label="Tipo de trabajo">
            {PESTANAS.map(({ p, etiqueta }, i) => {
              const c = contadorPestana(estado, p)
              const activa = estado.pestana === p
              return (
                <button key={p} type="button" aria-pressed={activa}
                  onClick={() => dispatch({ tipo: 'CAMBIAR_PESTANA', pestana: p })}
                  className={cn('flex items-center gap-1.5 border border-pill-borde px-3.5 py-[5px] text-[12px] font-bold',
                    i === 0 ? 'rounded-l-3xl' : '-ml-px', i === PESTANAS.length - 1 && 'rounded-r-3xl',
                    activa ? 'border-azul-noche bg-azul-noche text-superficie' : 'bg-pill-bg text-azul-gris hover:bg-azul-medio/8')}>
                  {etiqueta}
                  {c.total > 0 && (
                    <span className={cn('rounded-[10px] px-[7px] text-[10.5px] font-bold',
                      c.pendientes > 0 ? 'bg-cola-roja-bg text-cola-roja' : 'bg-badge-neutro-bg text-azul-gris')}>{c.total}</span>
                  )}
                </button>
              )
            })}
          </div>
          {estado.avisoPrediccion && (
            <div role="status" className="flex items-center gap-2 text-[11px] text-texto-error">
              No se pudo calcular la glass automática; asígnala a mano.
              <button type="button" aria-label="Cerrar aviso" onClick={() => dispatch({ tipo: 'CERRAR_AVISO_PREDICCION' })}>✕</button>
            </div>
          )}
          {estado.pestana === 'PULIDO' ? <PanelPulido {...panel} /> : <PanelRico {...panel} />}
          <div className="flex items-center gap-3 border-t border-borde-input pt-3.5">
            <span className="text-[12px] font-bold text-azul-gris">{barra.texto}</span>
            <div className="flex-1" />
            <button type="button" disabled={!barra.guardarHabilitado || guardando} onClick={() => void guardar()}
              className="rounded-md bg-azul-medio px-[22px] py-[11px] text-[14px] font-bold text-superficie disabled:opacity-50">
              {guardando ? 'Guardando…' : `Guardar (${barra.n})`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog abierto={descartar} titulo="Descartar" descripcion={`Se descartarán los ${total} IMEIs escaneados.`}
        textoAccion="Descartar" onConfirmar={onCerrar} onCancelar={() => setDescartar(false)} />
    </>
  )
}
