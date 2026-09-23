import type { ReparacionResumen } from '@/shared/api/client'

/** Colas "ricas" (comparten esqueleto); Pulido va aparte. */
export type Cola = 'REPARACION' | 'GLASS'
export type Pestana = Cola | 'PULIDO'

/** Decisión de cliente de un IMEI: cliente real, o "— Sin cliente —" explícito (`sin`). {null,false} = sin cliente
 *  elegido pero decisión registrada (calco del `clienteManual.put(imei, null)` del JavaFX). */
export type RefCliente = { idCli: number | null; sin: boolean }

/** Una entrada de las colas Reparación/Glass (EntradaAsignacion del JavaFX). `seq` es único en todo el modal. */
export type Entrada = {
  seq: number
  imei: string
  tipo: Cola
  modelo: string | null
  tecnicos: number[]
  idCli: number | null
  sinCliente: boolean
  comentario: string
  esChasis: boolean
  asignada: boolean
  modeloBuscado: boolean
  buscando: boolean
  /** El lookup de modelo corrió y no encontró nada: prompt "No encontrado — selecciona manualmente". */
  modeloNoEncontrado: boolean
  llevaGlass: boolean
  auto: boolean
  calculando: boolean
  tokenPrediccion: number
}

export type FilaPulido = {
  seq: number
  imei: string
  idTec: number | null
  comentario: string
  idCli: number | null
  sinCliente: boolean
}

/** Lo que el formulario de detalle tiene "en el aire" y solo pasa a la entrada al pulsar Asignar/Guardar cambios. */
export type Borrador = { tecnicos: number[]; comentario: string; esChasis: boolean }

export type Mensaje = { texto: string; tono: 'error' | 'ok' }

/** Lo que el modal lee de la tabla de asignaciones (congelada mientras está abierto). */
export type FilaTabla = Pick<ReparacionResumen, 'idRep' | 'imei' | 'idTec' | 'nombreTecnico'>

export type VerdeEnModal = { imei: string; idTec: number; tipo: Cola; esChasis: boolean; conCliente: boolean }

/** Trabajo asíncrono que el reductor pide y `useEfectosModal` ejecuta (cola de salida). */
export type Efecto =
  | { id: number; tipo: 'lookup'; seq: number; imei: string; buscarModelo: boolean }
  | { id: number; tipo: 'clientePulido'; seq: number; imei: string }
  | { id: number; tipo: 'guardarModelo'; imei: string; modelo: string }
  | { id: number; tipo: 'prediccion'; seq: number; token: number; imei: string; conCliente: boolean; verdes: VerdeEnModal[] }

type SinId<T> = T extends unknown ? Omit<T, 'id'> : never
export type EfectoSinId = SinId<Efecto>

export type EstadoModal = {
  pestana: Pestana
  rep: Entrada[]
  glass: Entrada[]
  pulido: FilaPulido[]
  actual: number | null
  borrador: Borrador
  pulidoSel: number | null
  tecPulidoArriba: number | null
  defTecnicos: Record<Cola, number[]>
  seq: number
  clienteManual: Record<string, RefCliente>
  clienteDefault: RefCliente | null
  modeloPorImei: Record<string, string>
  mensajeScan: Mensaje | null
  mensajePulido: Mensaje | null
  avisoPrediccion: boolean
  tabla: FilaTabla[]
  efectos: Efecto[]
  sigEfecto: number
}

export type Accion =
  | { tipo: 'CAMBIAR_PESTANA'; pestana: Pestana }
  | { tipo: 'ESCANEAR'; imei: string }
  | { tipo: 'PEGAR'; texto: string }
  | { tipo: 'CARGAR'; seq: number }
  | { tipo: 'QUITAR'; seq: number }
  | { tipo: 'LOOKUP_RESUELTO'; seq: number; modelo: string | null; idCliBd: number | null }
  | { tipo: 'DECIDIR_MODELO'; modelo: string }
  | { tipo: 'BORRAR_MODELO' }
  | { tipo: 'MARCAR_TECNICO'; idTec: number; marcado: boolean }
  | { tipo: 'ELEGIR_CLIENTE'; ref: RefCliente }
  | { tipo: 'CAMBIAR_COMENTARIO'; texto: string }
  | { tipo: 'CAMBIAR_CHASIS'; valor: boolean }
  | { tipo: 'MARCAR_LLEVA_GLASS'; valor: boolean }
  | { tipo: 'ASIGNAR' }
  | { tipo: 'PREDICCION_RESUELTA'; seq: number; token: number; idTec: number | null }
  | { tipo: 'PREDICCION_FALLIDA'; seq: number; token: number }
  | { tipo: 'CERRAR_AVISO_PREDICCION' }
  | { tipo: 'PULIDO_TEC_ARRIBA'; idTec: number | null }
  | { tipo: 'PULIDO_ESCANEAR'; imei: string }
  | { tipo: 'PULIDO_PEGAR'; texto: string }
  | { tipo: 'PULIDO_SELECCIONAR'; seq: number | null }
  | { tipo: 'PULIDO_TECNICO'; idTec: number | null }
  | { tipo: 'PULIDO_CLIENTE'; ref: RefCliente }
  | { tipo: 'PULIDO_COMENTARIO'; texto: string }
  | { tipo: 'PULIDO_QUITAR'; seq: number }
  | { tipo: 'PULIDO_CLIENTE_BD'; seq: number; idCli: number | null }
  | { tipo: 'EFECTOS_CONSUMIDOS'; ids: number[] }

export function estadoInicial(tabla: FilaTabla[]): EstadoModal {
  return {
    pestana: 'REPARACION', rep: [], glass: [], pulido: [], actual: null,
    borrador: { tecnicos: [], comentario: '', esChasis: false },
    pulidoSel: null, tecPulidoArriba: null, defTecnicos: { REPARACION: [], GLASS: [] }, seq: 0,
    clienteManual: {}, clienteDefault: null, modeloPorImei: {}, mensajeScan: null, mensajePulido: null,
    avisoPrediccion: false, tabla, efectos: [], sigEfecto: 1,
  }
}
