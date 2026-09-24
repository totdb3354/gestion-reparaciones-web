import type { Dispatch } from 'react'
import type { Cliente, FilaCarga, Tecnico } from '@/shared/api/client'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { cn } from '@/shared/lib/utils'
import { formatearPct, pctTotal } from '../carga'
import { CampoEscaneo } from './CampoEscaneo'
import { MensajeEscaneo } from './MensajeEscaneo'
import { opcionesCliente, refDeClave, valorCliente } from './opcionesCliente'
import type { Accion, EstadoModal, FilaPulido } from './estado/tipos'

type Props = { estado: EstadoModal; dispatch: Dispatch<Accion>; tecnicos: Tecnico[]; carga: FilaCarga[]; clientes: Cliente[] }

const ETIQUETA = 'text-[12px] font-bold text-azul-gris'

/** Panel de Pulido (construirPulidoPane): técnico de arriba, escaneo, lista y detalle que se aplica al momento. */
export function PanelPulido({ estado, dispatch, tecnicos, carga, clientes }: Props) {
  const opcionesTec = tecnicos.map((t) => {
    const f = carga.find((x) => x.idTec === t.idTec)
    return { valor: String(t.idTec), etiqueta: `${t.nombre} (P${formatearPct(f ? pctTotal(f) : 0)})` }
  })
  const nombreTec = (id: number | null) => tecnicos.find((t) => t.idTec === id)?.nombre
  const nombreCli = (f: FilaPulido) => (f.sinCliente ? 'sin cliente' : clientes.find((c) => c.idCli === f.idCli)?.nombre ?? '—')
  const sel = estado.pulido.find((f) => f.seq === estado.pulidoSel)
  // Activos más el que ya tenga la fila seleccionada (un inactivo de BD se muestra, D6); helper compartido con DetalleEntrada.
  const opciones = opcionesCliente(clientes, sel?.idCli)
  const n = estado.pulido.length

  return (
    <div className="flex flex-col gap-2">
      <span className={ETIQUETA}>Técnico (se aplica a los IMEIs que escanees)</span>
      <ComboNavy aria-label="Técnico para los IMEIs que escanees" valor={estado.tecPulidoArriba == null ? null : String(estado.tecPulidoArriba)}
        opciones={opcionesTec} onChange={(v) => dispatch({ tipo: 'PULIDO_TEC_ARRIBA', idTec: Number(v) })} textoVacio="" ancho={344} />
      <hr className="border-borde-input" />
      <CampoEscaneo etiqueta="Escanear IMEI → pulido"
        onTeclear={() => dispatch({ tipo: 'LIMPIAR_MENSAJE', panel: 'pulido' })}
        onImei={(imei) => { const repetido = estado.pulido.some((f) => f.imei === imei); dispatch({ tipo: 'PULIDO_ESCANEAR', imei }); return !repetido }}
        onPegado={(texto) => dispatch({ tipo: 'PULIDO_PEGAR', texto })} />
      <MensajeEscaneo mensaje={estado.mensajePulido} />
      <hr className="border-borde-input" />
      <span className={cn('text-[11.5px] font-bold', n === 0 ? 'text-azul-gris' : 'text-recibido-text')}>
        {n === 0 ? 'Nada añadido aún' : `${n} en pulido`}
      </span>
      <div className="flex flex-wrap gap-[18px]">
        <div className="max-h-[300px] w-[300px] min-w-[280px] shrink-0 overflow-y-auto rounded-md border border-cola-verde-brd bg-white">
          {estado.pulido.map((f) => (
            <div key={f.seq} onClick={() => dispatch({ tipo: 'PULIDO_SELECCIONAR', seq: f.seq })}
              className={cn('flex cursor-pointer items-center gap-2 border-b border-pill-buscando-bg p-2', f.seq === estado.pulidoSel && 'bg-pulido-sel-bg')}>
              <div className="flex flex-1 flex-col gap-px">
                <span className="font-mono text-[12px] font-bold text-azul-medio">{f.imei}</span>
                {f.idTec == null
                  ? <span className="text-[11px] font-bold text-cola-roja">(sin técnico) · {nombreCli(f)}</span>
                  : <span className="text-[11px] text-azul-gris">{nombreTec(f.idTec)} · {nombreCli(f)}</span>}
              </div>
              <button type="button" aria-label={`Quitar ${f.imei}`} className="px-1 text-[12px] text-cola-quitar hover:text-cola-roja"
                onClick={(ev) => { ev.stopPropagation(); dispatch({ tipo: 'PULIDO_QUITAR', seq: f.seq }) }}>✕</button>
            </div>
          ))}
        </div>
        <fieldset disabled={!sel} className="flex min-w-[280px] flex-1 flex-col gap-2 rounded-md border border-borde-input bg-white p-4 disabled:opacity-60">
          <div key={sel?.seq ?? 'vacio'} className="contents">
            <span className="text-[11px] font-bold text-azul-gris">IMEI en curso</span>
            <span data-testid="imei-pulido" className="font-mono text-[18px] font-bold text-azul-medio">{sel?.imei ?? '—'}</span>
            <span className={ETIQUETA}>Técnico</span>
            <ComboNavy aria-label="Técnico del pulido" valor={sel?.idTec == null ? null : String(sel.idTec)} opciones={opcionesTec}
              onChange={(v) => dispatch({ tipo: 'PULIDO_TECNICO', idTec: Number(v) })} textoVacio="" ancho={344} disabled={!sel} />
            <span className={ETIQUETA}>Cliente (opcional)</span>
            <CampoAutocompletar aria-label="Cliente" placeholder="Escribe cliente..." opciones={opciones}
              valor={valorCliente(sel ? { idCli: sel.idCli, sinCliente: sel.sinCliente } : null)}
              onElegir={(clave) => dispatch({ tipo: 'PULIDO_CLIENTE', ref: refDeClave(clave) })} />
            <span className={ETIQUETA}>Comentario</span>
            <textarea aria-label="Comentario del pulido" rows={2} placeholder="Instrucciones para el técnico..." value={sel?.comentario ?? ''}
              onChange={(ev) => dispatch({ tipo: 'PULIDO_COMENTARIO', texto: ev.target.value })}
              className="rounded border border-borde-input bg-white p-2 text-[13px] text-azul-medio" />
          </div>
        </fieldset>
      </div>
    </div>
  )
}
