import { useEffect } from 'react'
import type { EventoRastro } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { hayAntesDelHistorico, NOTA_ANTES_DEL_HISTORICO, verEvento } from './rastro'

const LEYENDA: [string, string][] = [
  ['bg-texto-suave', 'Lote'], ['bg-ambar', 'Revisión'], ['bg-tipo-reparacion-text', 'Taller'], ['bg-fila-recibido-brd', 'Listos'],
  ['bg-fila-urgente-brd', 'De pedido'], ['bg-azul-noche', 'Vendido'], ['bg-fila-solicitud-brd', 'Devolución'], ['bg-gris-borde', 'No cuenta como stock'],
]

type Props = { imei: string; eventos: EventoRastro[]; onCerrar: () => void; onIrATrabajo: (idRep: string) => void }

/** El rastro del teléfono en un panel lateral sobre la vista de trabajos (0.9.17, spec §9.3; opción A del prototipo):
 *  línea de tiempo del más reciente al más antiguo. Un evento de taller resalta su fila en la tabla de detrás. */
export function PanelRastro({ imei, eventos, onCerrar, onIrATrabajo }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])
  return (
    <aside role="dialog" aria-label="Rastro" className="fixed inset-y-0 right-0 z-40 flex w-[min(500px,42vw)] min-w-[380px] flex-col bg-superficie shadow-[-6px_0_24px_rgba(0,18,50,0.25)]">
      <header className="flex items-center gap-2.5 border-b border-fila-sep px-[18px] py-3.5">
        <h2 className="text-[15px] font-bold text-azul-noche">Rastro</h2>
        <span className="font-mono text-[12px] text-azul-gris">{imei}</span>
        <button type="button" aria-label="Cerrar el rastro" onClick={onCerrar} className="ml-auto cursor-pointer text-xl text-azul-gris">×</button>
      </header>
      <div className="flex-1 overflow-auto px-[18px] py-3">
        <ul aria-hidden className="mb-2 flex flex-wrap gap-3 text-[11px] text-azul-gris">
          {LEYENDA.map(([color, texto]) => (
            <li key={texto} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', color)} />{texto}</li>
          ))}
        </ul>
        <p className="mb-3 text-[11.5px] text-azul-gris">Las horas de NSYS son las de la exportación en que se vio el cambio (± 30 min). Las del ERP son exactas.</p>
        {eventos.length === 0 && <p className="text-[12px] text-azul-gris">Todavía no hay eventos.</p>}
        <ol className="relative ml-2.5 border-l-[3px] border-fila-sep pl-6">
          {eventos.map((e, i) => {
            const v = verEvento(e)
            const idRep = e.idRep
            return (
              <li key={i} className="relative mb-3">
                <span aria-hidden className={cn('absolute top-[3px] -left-[35px] h-3.5 w-3.5 rounded-full border-[3px] border-superficie', v.color)} />
                <div className="text-[11px] font-bold text-azul-gris">
                  {v.fecha}
                  <span className={cn('ml-1.5 rounded px-1.5 text-[9.5px] font-extrabold', e.fuente === 'ERP' ? 'bg-recibido-bg text-recibido-text' : 'bg-badge-neutro-bg text-azul-gris')}>{e.fuente}</span>
                </div>
                {idRep
                  ? <button type="button" onClick={() => onIrATrabajo(idRep)} className="cursor-pointer text-left text-[13px] font-bold text-azul-noche underline decoration-dotted">{v.titulo}</button>
                  : <div className="text-[13px] font-bold text-azul-noche">{v.titulo}</div>}
                {v.detalle && <div className="text-[12px] text-azul-medio">{v.detalle}</div>}
              </li>
            )
          })}
        </ol>
        {hayAntesDelHistorico(eventos) && <p className="mt-1 text-[11.5px] text-azul-gris italic">{NOTA_ANTES_DEL_HISTORICO}</p>}
      </div>
    </aside>
  )
}
