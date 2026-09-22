import type { Tecnico } from '@/shared/api/client'
import { TIPO_TRABAJO } from '@/shared/lib/tipoTrabajo'
import { BotonSecundario } from '@/shared/ui/Botones'
import { FiltroImei } from '@/shared/ui/FiltroImei'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { FILTROS_VACIOS, type EstadoAsignacion, type EstadoFiltros, type TipoTrabajo } from './filtros'

const OPCIONES_TIPO: { clave: TipoTrabajo; etiqueta: string }[] = (Object.keys(TIPO_TRABAJO) as TipoTrabajo[]).map((t) => ({
  clave: t,
  etiqueta: TIPO_TRABAJO[t].etiqueta,
}))

/** Las tres casillas de "Estado" del JavaFX; mismos textos que las de Pendientes del técnico. */
const OPCIONES_ESTADO: { clave: EstadoAsignacion; etiqueta: string }[] = [
  { clave: 'SOLICITUD', etiqueta: 'Solicitudes pieza' },
  { clave: 'INCIDENCIA', etiqueta: 'Incidencias' },
  { clave: 'ASIGNACION', etiqueta: 'Asignaciones' },
]

type Props = {
  valor: EstadoFiltros
  onCambio: (f: EstadoFiltros) => void
  tecnicos: Tecnico[]
  /** Clientes presentes en lo cargado, con el centinela SIN_CLIENTE delante si hay filas sin cliente. */
  clientes: string[]
  /** Aviso de desplegable abierto/cerrado: congela el sondeo (spec 3a, D4) para que la tabla no se recargue
   *  bajo el cursor. La Task 16 lo conecta; aquí solo se emite. */
  onInteraccion: (abierta: boolean) => void
}

/**
 * Los cinco filtros de la vista de asignaciones, calco del FlowPane del JavaFX (IMEI · Técnico · Cliente · Tipo ·
 * Estado · Limpiar). Es presentación pura: filtra `aplicarFiltros` de ./filtros con lo que devuelva `onCambio`,
 * en memoria y sin volver al servidor (spec 3a, D7).
 */
export function BarraFiltros({ valor, onCambio, tecnicos, clientes, onInteraccion }: Props) {
  // "Todos marcados" y "ninguno marcado" filtran exactamente igual (aplicarFiltros no filtra con la lista vacía),
  // así que el estado guarda [] y el desplegable lo pinta con todas las casillas: es el arranque "Todos" del
  // JavaFX sin duplicar la lista en el estado, y el cliente que aparezca en la siguiente carga entra ya marcado.
  const clientesMarcados = valor.clientes.length === 0 ? clientes : valor.clientes

  function cambiarClientes(seleccion: Set<string>) {
    // Volver a marcarlos todos (o quedarse sin ninguno, que filtra igual) devuelve al estado "sin filtro".
    const todos = seleccion.size === 0 || clientes.every((c) => seleccion.has(c))
    onCambio({ ...valor, clientes: todos ? [] : [...seleccion] })
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <FiltroImei valor={valor.imei} onChange={(imei) => onCambio({ ...valor, imei })} />
      <MultiSelect
        opciones={tecnicos}
        clave={(t) => String(t.idTec)}
        etiqueta={(t) => t.nombre}
        seleccion={new Set(valor.tecnicos.map(String))}
        onChange={(s) => onCambio({ ...valor, tecnicos: [...s].map(Number) })}
        textoVacio="Técnico"
        textoPlural={(n) => `${n} técnicos`}
        onOpenChange={onInteraccion}
        className="min-w-[130px]"
      />
      <MultiSelect
        opciones={clientes}
        clave={(c) => c}
        etiqueta={(c) => c}
        seleccion={new Set(clientesMarcados)}
        onChange={cambiarClientes}
        textoVacio="Cliente"
        textoPlural={(n) => `${n} clientes`}
        textoTodas="Todos"
        onOpenChange={onInteraccion}
        className="min-w-[150px]"
      />
      <MultiSelect
        opciones={OPCIONES_TIPO}
        clave={(o) => o.clave}
        etiqueta={(o) => o.etiqueta}
        seleccion={new Set<string>(valor.tipos)}
        onChange={(s) => onCambio({ ...valor, tipos: [...s] as TipoTrabajo[] })}
        textoVacio="Tipo"
        textoPlural={(n) => `${n} tipos`}
        onOpenChange={onInteraccion}
        className="min-w-[130px]"
      />
      <MultiSelect
        opciones={OPCIONES_ESTADO}
        clave={(o) => o.clave}
        etiqueta={(o) => o.etiqueta}
        seleccion={new Set<string>(valor.estados)}
        onChange={(s) => onCambio({ ...valor, estados: [...s] as EstadoAsignacion[] })}
        textoVacio="Estado"
        textoPlural={(n) => `${n} filtros`}
        onOpenChange={onInteraccion}
        className="min-w-[130px]"
      />
      <BotonSecundario onClick={() => onCambio(FILTROS_VACIOS)}>Limpiar filtros</BotonSecundario>
    </div>
  )
}
