import { cn } from '@/shared/lib/utils'
import { CLASES_MINI_PILDORA } from '@/shared/ui/pildora'
import { useImportacionesNsys } from '../api'
import { conHuecos, horaItems, textoCambios, textoHistorico } from './nsys'

const TEXTO: Record<string, string> = { OK: 'OK', RECHAZADO: 'RECHAZADO', ERROR: 'ERROR', EN_CURSO: 'en curso' }
const CLASES: Record<string, string> = {
  OK: 'bg-fila-recibido-bg text-fila-recibido-brd',
  RECHAZADO: 'bg-fila-solicitud-bg text-fila-solicitud-brd',
  ERROR: 'bg-urgente-bg text-fila-urgente-brd',
  EN_CURSO: 'bg-badge-neutro-bg text-azul-gris',
}

/** Las últimas importaciones del Items actual (0.9.18, spec §4.11), en el popover de la píldora de NSYS: para comprobar
 *  fichero a fichero que llega un Items cada media hora sin entrar por SSH. Con los huecos de más de 45 minutos hábiles y,
 *  al pie, el progreso del histórico. Se monta al abrir el popover y pide la lista una vez. */
export function ListaImportacionesNsys() {
  const { data, isPending, isError } = useImportacionesNsys()
  const filas = conHuecos(data?.importaciones ?? [])
  const historico = textoHistorico(data?.historico)
  return (
    <div className="text-[12px] text-azul-medio">
      <h3 className="mb-2 text-[13px] font-bold text-azul-noche">Últimas importaciones de NSYS</h3>
      {isPending && <p className="text-azul-gris">Cargando…</p>}
      {isError && <p className="text-azul-gris">No se pudo cargar la lista.</p>}
      {data && filas.length === 0 && <p className="text-azul-gris">Todavía no hay importaciones.</p>}
      {filas.length > 0 && (
        <ol aria-label="Importaciones" className="max-h-[360px] overflow-auto">
          {filas.map((f, i) => f.tipo === 'hueco' ? (
            <li key={`h${i}`} className="border-b border-fila-sep py-1 font-bold text-fila-urgente-brd">
              {`⚠ falta un Items entre ${horaItems(f.desde)} y ${horaItems(f.hasta)}`}
            </li>
          ) : (
            <li key={`i${i}`} className="border-b border-fila-sep py-1">
              <div className="flex items-center gap-2">
                <span className="w-[78px] font-mono">{horaItems(f.importacion.fechaExportacion)}</span>
                <span className={cn(CLASES_MINI_PILDORA, CLASES[f.importacion.resultado] ?? CLASES.EN_CURSO)}>
                  {TEXTO[f.importacion.resultado] ?? f.importacion.resultado}
                </span>
                {f.importacion.resultado !== 'EN_CURSO' && <span>{textoCambios(f.importacion.cambios)}</span>}
                {f.importacion.segundos != null && <span className="ml-auto text-azul-gris">{`${f.importacion.segundos} s`}</span>}
              </div>
              {f.importacion.motivo && <p className="mt-0.5 text-[11px] text-azul-gris">{f.importacion.motivo}</p>}
            </li>
          ))}
        </ol>
      )}
      {historico && <p className="mt-2 text-[11.5px] text-azul-gris">{historico}</p>}
    </div>
  )
}
