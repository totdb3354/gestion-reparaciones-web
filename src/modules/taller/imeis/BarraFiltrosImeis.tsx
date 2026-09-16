import { useStore } from '@/shared/lib/store'
import { BotonSecundario } from '@/shared/ui/Botones'
import { FiltroImei } from '@/shared/ui/FiltroImei'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { RangoFechas } from '@/shared/ui/RangoFechas'
import { useTecnicos } from '../api'
import { FILTROS_IMEIS_VACIOS, filtrosImeis } from '../estado'
import { OPCIONES_INCIDENCIAS } from '../historial/constantes'
import type { EstadoIncidencia } from '../lib/filtros'

/** En el maestro solo hay dos casillas: "Incidencia" (alguna abierta) y "Normal"; la de "Cerradas" se oculta. */
// eslint-disable-next-line react-refresh/only-export-components -- constante compartida por el propio componente, patrón del proyecto
export const OPCIONES_INCIDENCIAS_MAESTRO: { clave: EstadoIncidencia; etiqueta: string }[] = [
  { clave: 'abiertas', etiqueta: 'Incidencia' },
  { clave: 'sin', etiqueta: 'Normal' },
]

type Props = { modo: 'maestro' | 'detalle'; opcionesCliente?: string[] }

/** Los mismos controles en maestro y detalle, sobre el mismo store (los filtros sobreviven al ir y volver del detalle).
 *  Maestro: IMEI · Técnico · Cliente · Desde · Hasta · Incidencias(2) · Limpiar. Detalle: Técnico · Desde · Hasta · Incidencias(3) · Limpiar. */
export function BarraFiltrosImeis({ modo, opcionesCliente = [] }: Props) {
  const [f, setF] = useStore(filtrosImeis)
  const { data: tecnicos = [] } = useTecnicos()
  const maestro = modo === 'maestro'
  const opcionesInc = maestro ? OPCIONES_INCIDENCIAS_MAESTRO : OPCIONES_INCIDENCIAS
  const incidencias = maestro ? new Set([...f.incidencias].filter((k) => k !== 'cerradas')) : f.incidencias
  return (
    <div className="mb-2 flex flex-wrap items-center gap-3">
      {maestro && <FiltroImei valor={f.imei} onChange={(imei) => setF({ ...f, imei })} />}
      <MultiSelect opciones={tecnicos} clave={(t) => String(t.idTec)} etiqueta={(t) => t.nombre} seleccion={new Set([...f.tecnicos].map(String))}
        onChange={(s) => setF({ ...f, tecnicos: new Set([...s].map(Number)) })} textoVacio="Técnico" textoPlural={(n) => `${n} técnicos`} className="min-w-[130px]" />
      {maestro && (
        <MultiSelect opciones={opcionesCliente} clave={(c) => c} etiqueta={(c) => c} seleccion={f.clientes} onChange={(clientes) => setF({ ...f, clientes })}
          textoVacio="Cliente" textoPlural={(n) => `${n} clientes`} className="min-w-[150px]" />
      )}
      <RangoFechas desde={f.desde} hasta={f.hasta} onChange={(desde, hasta) => setF({ ...f, desde, hasta })} />
      <MultiSelect opciones={opcionesInc} clave={(o) => o.clave} etiqueta={(o) => o.etiqueta} seleccion={incidencias as Set<string>}
        onChange={(s) => setF({ ...f, incidencias: s as Set<EstadoIncidencia> })} textoVacio="Incidencias" textoPlural={(n) => `${n} filtros`} textoTodas="Todas" className="min-w-[130px]" />
      <BotonSecundario onClick={() => setF(FILTROS_IMEIS_VACIOS)}>Limpiar filtros</BotonSecundario>
    </div>
  )
}
