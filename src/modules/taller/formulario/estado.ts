import type { AsignacionActiva, Componente, ComponentesAgrupados, DetalleEdicion, SolicitudAsignacion } from '@/shared/api/client'
import { extraerModelo, modelosDisponibles } from '../lib/modelos'
import { PREFIJO_OTRO, nombreTipo, prefijosDeFila } from '../lib/piezas'

/** Estado del formulario de reparación: fichero PURO (sin React, sin fetch, sin Date). Los componentes solo pintan lo que
 *  dicen los selectores y despachan acciones; las reglas de docs/paridad/formulario.md viven aquí. */

// ───────────────────────────── Tipos ─────────────────────────────

export type ModoFormulario = 'nuevo' | 'glass' | 'editar'
export type Categoria = 'R' | 'G'

/** Marca "✓ Guardada": vive solo en el borrador. */
export type Guardada = { idRep: string; fecha: string } // fecha 'dd/MM HH:mm' local del navegador
/** Solicitud local confirmada en esta sesión (aún no enviada). registrado = ya se envió su agotar-componente
 *  en un intento de "Terminar asignación" y no debe reenviarse. */
export type AgotadoLocal = { descripcion: string | null; registrado: boolean }
/** Solicitud ya guardada en el servidor, aplicada a la fila al abrir. Las rechazadas y las recibidas no dejan este campo. */
export type SolicitudServidor = { estado: 'pendiente' | 'enCamino'; descripcion: string | null }
export type RolFila = 'normal' | 'editada' | 'yaReparado' // 'editada' y 'yaReparado' solo en modo editar
export type OriginalEdicion = { idCom: number; cantidad: number; reutilizado: boolean; observacion: string | null }

/** Habilitado de los controles, mantenido por el reductor paso a paso como lo hace la referencia (no se deriva: así se
 *  calcan rarezas como "+" habilitado con stock 0 tras desmarcar Reutilizado). Una fila sin SKU para el modelo
 *  (opciones vacías) se pinta siempre deshabilitada y atenuada, diga lo que diga este campo. */
export type ControlesFila = { mas: boolean; menos: boolean; reutilizado: boolean; sku: boolean; observacion: boolean }

export type FilaEstado = {
  prefijo: string
  nombre: string // nombreTipo(prefijo)
  skus: Componente[] // todos los ACTIVOS del tipo
  opciones: Componente[] // skus filtrados por el modelo (todos si no hay modelo)
  idCom: number | null // SKU elegido; null si opciones está vacío
  cantidad: number
  reutilizado: boolean
  observacion: string | null
  controles: ControlesFila
  rol: RolFila
  guardada: Guardada | null
  confirmandoGuardar: boolean // "✓ Confirmar" de "✓ Guardar fila"
  guardando: boolean // llamada en vuelo: botón deshabilitado
  agotado: AgotadoLocal | null
  solicitud: SolicitudServidor | null
  recibidoPendienteUso: boolean // "✓ Recibido" aún visible
  original: OriginalEdicion | null // solo rol 'editada'
}

export type OrigenAccion = 'nueva' | 'editada' | 'yaReparada'
export type OtraAccion = {
  id: number // identidad local estable (contador del estado)
  texto: string
  origen: OrigenAccion // 'editada' y 'yaReparada' solo en modo editar
  guardada: Guardada | null
  confirmando: boolean
  guardando: boolean
  /** Tras FALLO_GUARDAR_ACCION: el texto sigue en "✓ Confirmar" (confirmando = true) pero el siguiente clic vuelve a pedir
   *  confirmación en vez de guardar. Opcional: quien construye una OtraAccion no necesita ponerlo. */
  pideOtroClic?: boolean
}

export type EdicionEstado = {
  idRep: string
  tipo: 'pieza' | 'accion'
  idTecOriginal: number
  updatedAt: string
  textoAccionOriginal: string | null // tipo 'accion'
  idComAccion: number | null // tipo 'accion': el idCom 'otro…' de la reparación editada
}

export type GuardadoEstado = {
  clics: 0 | 1 // 1 = el siguiente clic ejecuta
  textoConfirmacion: boolean // una vez true, no vuelve a false
  enCurso: boolean
}

export type EstadoFormulario = {
  modo: ModoFormulario
  categoria: Categoria // 'G' si idAsignacion empieza por 'AG' o idRep por 'G'
  idAsignacion: string | null // nuevo y glass
  imei: string
  incidencia: string | null // idRepAnterior de todos los guardados
  modelo: string | null
  modeloBloqueado: boolean
  modelos: string[] // opciones del combo, en el orden de MODELOS_ORDENADOS
  tieneSolicitudesIniciales: boolean // hubo solicitudes (de cualquier estado): las filas nunca se ocultan
  filas: FilaEstado[]
  componentesOtro: Componente[] // grupo 'otro' completo (no se mira 'activo')
  otros: OtraAccion[]
  siguienteIdAccion: number
  edicion: EdicionEstado | null
  guardado: GuardadoEstado
  borradorRecuperado: boolean // banda azul (la pone aplicarBorrador)
  borradorDescartado: boolean // tras un guardado real: no se vuelve a escribir borrador
  /** Sube con cada cambio de datos que reprograma el autoguardado (todo menos EDITAR_DESCRIPCION_AGOTADO; pedir confirmación,
   *  iniciar o fallar un guardado no son cambios de datos y no la suben). */
  revision: number
  /** Sube cuando hay que volcar el borrador YA: FILA_GUARDADA, ACCION_GUARDADA y DESBLOQUEAR_BORRADAS con cambios. */
  volcados: number
}

// ───────────────────────────── Datos de entrada y acciones ─────────────────────────────

export type DatosNuevo = {
  modo: 'nuevo' | 'glass'
  idAsignacion: string
  imei: string
  agrupados: ComponentesAgrupados
  solicitudes: SolicitudAsignacion[] // incluye rechazadas
  incidencia: string | null
  modeloTelefono: string | null // '' o fuera de la lista = null; solo se usa si tras las solicitudes no hay modelo
}
export type DatosEditar = {
  modo: 'editar'
  idRep: string
  detalle: DetalleEdicion
  agrupados: ComponentesAgrupados
  yaReparados: number[]
  accionesYaReparadas: string[]
}

export type AccionFormulario =
  // filas y modelo
  | { tipo: 'CAMBIAR_MODELO'; modelo: string | null }
  | { tipo: 'SUMAR'; prefijo: string }
  | { tipo: 'RESTAR'; prefijo: string }
  | { tipo: 'CAMBIAR_SKU'; prefijo: string; idCom: number }
  | { tipo: 'MARCAR_REUTILIZADO'; prefijo: string; valor: boolean }
  | { tipo: 'PONER_OBSERVACION'; prefijo: string; texto: string } // recorta; vacío = sin efecto
  | { tipo: 'BORRAR_OBSERVACION'; prefijo: string }
  // guardar fila, agotado local, otras acciones y zona de guardar
  | { tipo: 'PEDIR_CONFIRMACION_FILA'; prefijo: string } // 1.er clic → "✓ Confirmar"
  | { tipo: 'INICIO_GUARDAR_FILA'; prefijo: string } // 2.º clic: guardando = true
  | { tipo: 'FILA_GUARDADA'; prefijo: string; idRep: string; fecha: string }
  | { tipo: 'FALLO_GUARDAR_FILA'; prefijo: string } // rehabilita, vuelve a "✓ Guardar fila"
  | { tipo: 'CONFIRMAR_AGOTADO'; prefijo: string; descripcion: string } // local; recorta; borra la observación
  | { tipo: 'EDITAR_DESCRIPCION_AGOTADO'; prefijo: string; descripcion: string } // NO sube revision
  | { tipo: 'CANCELAR_AGOTADO'; prefijo: string }
  | { tipo: 'AGOTADO_REGISTRADO'; prefijo: string } // agotar-componente OK en este intento
  | { tipo: 'ANADIR_ACCION' }
  | { tipo: 'ESCRIBIR_ACCION'; id: number; texto: string } // devuelve "✓ Confirmar" a "✓ Guardar"
  | { tipo: 'QUITAR_ACCION'; id: number }
  | { tipo: 'PEDIR_CONFIRMACION_ACCION'; id: number }
  | { tipo: 'INICIO_GUARDAR_ACCION'; id: number }
  | { tipo: 'ACCION_GUARDADA'; id: number; idRep: string; fecha: string }
  | { tipo: 'FALLO_GUARDAR_ACCION'; id: number } // rehabilita; el texto SIGUE en "✓ Confirmar" pero pide otro clic
  | { tipo: 'PEDIR_CONFIRMACION_GUARDAR' } // zona: 1.er clic
  | { tipo: 'INICIO_GUARDADO' } // zona: 2.º clic
  | { tipo: 'FALLO_GUARDADO' } // clics = 0, enCurso = false, el texto no vuelve
  | { tipo: 'GUARDADO_COMPLETADO' } // borradorDescartado = true
  // borrador
  | { tipo: 'REEMPLAZAR'; estado: EstadoFormulario } // resultado de aplicarBorrador; no sube revision
  | { tipo: 'DESBLOQUEAR_BORRADAS'; idsExistentes: string[] } // filas/acciones guardadas cuyo idRep ya no existe

// ───────────────────────────── Filas: construcción ─────────────────────────────

const CONTROLES_APAGADOS: ControlesFila = { mas: false, menos: false, reutilizado: false, sku: false, observacion: false }

type BaseFila = Pick<FilaEstado, 'prefijo' | 'nombre' | 'skus'>

function opcionesPara(base: BaseFila, modelo: string | null): Componente[] {
  return modelo === null ? base.skus : base.skus.filter((c) => extraerModelo(c.tipo, base.prefijo) === modelo)
}

/** Controles de una fila recién puesta sobre un SKU: "-" apagado, "+" según stock, el resto encendido. */
function controlesIniciales(c: Componente | null): ControlesFila {
  if (c === null) return CONTROLES_APAGADOS
  return { mas: c.stock > 0, menos: false, reutilizado: true, sku: true, observacion: true }
}

/** Fila en su estado inicial para un modelo: SKU por defecto = el primero con stock o, si ninguno, el primero. */
function filaLimpia(base: BaseFila, modelo: string | null): FilaEstado {
  const opciones = opcionesPara(base, modelo)
  const elegido = opciones.find((c) => c.stock > 0) ?? opciones[0] ?? null
  return {
    prefijo: base.prefijo,
    nombre: base.nombre,
    skus: base.skus,
    opciones,
    idCom: elegido ? elegido.idCom : null,
    cantidad: 0,
    reutilizado: false,
    observacion: null,
    controles: controlesIniciales(elegido),
    rol: 'normal',
    guardada: null,
    confirmandoGuardar: false,
    guardando: false,
    agotado: null,
    solicitud: null,
    recibidoPendienteUso: false,
    original: null,
  }
}

// ───────────────────────────── Estado inicial ─────────────────────────────

type DatosBase = {
  modo: ModoFormulario
  categoria: Categoria
  idAsignacion: string | null
  imei: string
  incidencia: string | null
  agrupados: ComponentesAgrupados
  glass: boolean
}

/** Estado sin modelo: una fila por tipo (orden de prefijosDeFila), todos los SKU activos como opciones. */
function estadoBase(d: DatosBase): EstadoFormulario {
  const bases: BaseFila[] = prefijosDeFila(d.agrupados, d.glass).map((prefijo) => ({
    prefijo,
    nombre: nombreTipo(prefijo),
    skus: (d.agrupados[prefijo] ?? []).filter((c) => c.activo),
  }))
  return {
    modo: d.modo,
    categoria: d.categoria,
    idAsignacion: d.idAsignacion,
    imei: d.imei,
    incidencia: d.incidencia,
    modelo: null,
    modeloBloqueado: false,
    modelos: modelosDisponibles(bases.map((b) => ({ prefijo: b.prefijo, skus: b.skus }))),
    tieneSolicitudesIniciales: false,
    filas: bases.map((b) => filaLimpia(b, null)),
    componentesOtro: d.agrupados[PREFIJO_OTRO] ?? [],
    otros: [],
    siguienteIdAccion: 1,
    edicion: null,
    guardado: { clics: 0, textoConfirmacion: false, enCurso: false },
    borradorRecuperado: false,
    borradorDescartado: false,
    revision: 0,
    volcados: 0,
  }
}

function inicialNuevo(datos: DatosNuevo): EstadoFormulario {
  const base = estadoBase({
    modo: datos.modo,
    categoria: datos.idAsignacion.startsWith('AG') ? 'G' : 'R',
    idAsignacion: datos.idAsignacion,
    imei: datos.imei,
    incidencia: datos.incidencia,
    agrupados: datos.agrupados,
    glass: datos.modo === 'glass',
  })
  const telefono = datos.modeloTelefono !== null && base.modelos.includes(datos.modeloTelefono) ? datos.modeloTelefono : null
  if (telefono === null) return base
  return { ...base, modelo: telefono, modeloBloqueado: true, filas: base.filas.map((f) => filaLimpia(f, telefono)) }
}

function inicialEditar(datos: DatosEditar): EstadoFormulario {
  const glass = datos.idRep.startsWith('G')
  return estadoBase({
    modo: 'editar',
    categoria: glass ? 'G' : 'R',
    idAsignacion: null,
    imei: datos.detalle.imei,
    incidencia: null,
    agrupados: datos.agrupados,
    glass,
  })
}

export function estadoInicial(datos: DatosNuevo | DatosEditar): EstadoFormulario {
  return datos.modo === 'editar' ? inicialEditar(datos) : inicialNuevo(datos)
}

// ───────────────────────────── Selectores de fila ─────────────────────────────

/** false = "Selecciona un modelo de iPhone para continuar". */
export function filasVisibles(e: EstadoFormulario): boolean {
  return e.modo === 'editar' || e.tieneSolicitudesIniciales || e.modelo !== null
}

/** El SKU elegido. */
export function componenteDe(fila: FilaEstado): Componente | null {
  return fila.opciones.find((c) => c.idCom === fila.idCom) ?? null
}

/** null → "—". */
export function stockDe(fila: FilaEstado): number | null {
  const c = componenteDe(fila)
  return c ? c.stock : null
}

/** Tipo sin SKU para el modelo: opacidad 0,4 y todo deshabilitado. */
export function filaSinSku(fila: FilaEstado): boolean {
  return fila.opciones.length === 0
}

export function filaActiva(fila: FilaEstado): boolean {
  return fila.cantidad > 0 || fila.reutilizado || (fila.agotado !== null && fila.solicitud === null)
}

// ───────────────────────────── Reductor ─────────────────────────────

/** Fila que no admite NINGÚN cambio: guardada, con agotado confirmado, ya reparada, sin SKU o con su guardado en vuelo. */
function bloqueada(fila: FilaEstado): boolean {
  return fila.guardada !== null || fila.agotado !== null || fila.rol === 'yaReparado' || fila.guardando || filaSinSku(fila)
}

/** Aplica `cambio` a la primera fila de ese prefijo. `cambio` devuelve null si la acción no procede (mismo estado).
 *  Todo cambio de fila anula el "✓ Confirmar" pendiente, apaga "✓ Recibido" si la fila pasa a activa y sube revision. */
function cambiarFila(estado: EstadoFormulario, prefijo: string, cambio: (fila: FilaEstado) => FilaEstado | null): EstadoFormulario {
  const indice = estado.filas.findIndex((f) => f.prefijo === prefijo)
  if (indice < 0) return estado
  const nueva = cambio(estado.filas[indice])
  if (nueva === null) return estado
  const fila: FilaEstado = {
    ...nueva,
    confirmandoGuardar: false,
    recibidoPendienteUso: nueva.recibidoPendienteUso && !filaActiva(nueva),
  }
  return { ...estado, filas: estado.filas.map((f, i) => (i === indice ? fila : f)), revision: estado.revision + 1 }
}

function sumar(fila: FilaEstado): FilaEstado | null {
  const c = componenteDe(fila)
  if (bloqueada(fila) || fila.solicitud !== null || c === null || !fila.controles.mas || fila.cantidad >= c.stock) return null
  const cantidad = fila.cantidad + 1
  return { ...fila, cantidad, controles: { ...fila.controles, mas: cantidad < c.stock, menos: true, reutilizado: false } }
}

function restar(fila: FilaEstado): FilaEstado | null {
  const c = componenteDe(fila)
  if (bloqueada(fila) || fila.solicitud !== null || c === null || !fila.controles.menos || fila.cantidad <= 0) return null
  const cantidad = fila.cantidad - 1
  return {
    ...fila,
    cantidad,
    controles: {
      ...fila.controles,
      mas: cantidad < c.stock,
      menos: cantidad > 0,
      reutilizado: cantidad === 0 ? true : fila.controles.reutilizado,
    },
  }
}

function cambiarSku(fila: FilaEstado, idCom: number): FilaEstado | null {
  const c = fila.opciones.find((o) => o.idCom === idCom)
  if (bloqueada(fila) || fila.solicitud !== null || !fila.controles.sku || c === undefined || idCom === fila.idCom) return null
  // En la fila en edición, volver al componente original ni pone a 0 ni toca "+".
  const esElOriginal = fila.original !== null && fila.original.idCom === idCom
  const seVacia = !esElOriginal && fila.cantidad > c.stock
  const cantidad = seVacia ? 0 : fila.cantidad
  const controles: ControlesFila = { ...fila.controles }
  if (seVacia) {
    controles.reutilizado = true
    controles.menos = false
  }
  if (!fila.reutilizado && !esElOriginal) controles.mas = cantidad < c.stock
  return { ...fila, idCom, cantidad, controles }
}

function marcarReutilizado(fila: FilaEstado, valor: boolean): FilaEstado | null {
  if (bloqueada(fila) || !fila.controles.reutilizado || valor === fila.reutilizado) return null
  if (valor) return { ...fila, reutilizado: true, controles: { ...fila.controles, mas: false, menos: false } }
  // Al desmarcar, "+" se enciende SIN mirar el stock (con stock 0 el clic no suma); en una fila con solicitud sigue apagado.
  return { ...fila, reutilizado: false, controles: { ...fila.controles, mas: fila.solicitud === null, menos: fila.cantidad > 0 } }
}

function ponerObservacion(fila: FilaEstado, texto: string): FilaEstado | null {
  const recortado = texto.trim()
  if (bloqueada(fila) || !fila.controles.observacion || recortado === '' || recortado === fila.observacion) return null
  return { ...fila, observacion: recortado }
}

function borrarObservacion(fila: FilaEstado): FilaEstado | null {
  if (bloqueada(fila) || !fila.controles.observacion || fila.observacion === null) return null
  return { ...fila, observacion: null }
}

/** Reaplica el filtro a todas las filas y RESETEA las que no están guardadas, en vuelo ni con solicitud activa. */
function cambiarModelo(estado: EstadoFormulario, modelo: string | null): EstadoFormulario {
  if (estado.modeloBloqueado || modelo === estado.modelo) return estado
  if (modelo !== null && !estado.modelos.includes(modelo)) return estado
  const filas = estado.filas.map((fila) => {
    if (fila.guardada !== null || fila.guardando || fila.solicitud !== null) return fila
    const limpia = filaLimpia(fila, modelo)
    // "✓ Recibido" sobrevive al reseteo salvo que la fila se quede sin SKU para el modelo.
    return { ...limpia, recibidoPendienteUso: fila.recibidoPendienteUso && !filaSinSku(limpia) }
  })
  return { ...estado, modelo, filas, revision: estado.revision + 1 }
}

export function reducir(estado: EstadoFormulario, accion: AccionFormulario): EstadoFormulario {
  switch (accion.tipo) {
    case 'CAMBIAR_MODELO':
      return cambiarModelo(estado, accion.modelo)
    case 'SUMAR':
      return cambiarFila(estado, accion.prefijo, sumar)
    case 'RESTAR':
      return cambiarFila(estado, accion.prefijo, restar)
    case 'CAMBIAR_SKU':
      return cambiarFila(estado, accion.prefijo, (f) => cambiarSku(f, accion.idCom))
    case 'MARCAR_REUTILIZADO':
      return cambiarFila(estado, accion.prefijo, (f) => marcarReutilizado(f, accion.valor))
    case 'PONER_OBSERVACION':
      return cambiarFila(estado, accion.prefijo, (f) => ponerObservacion(f, accion.texto))
    case 'BORRAR_OBSERVACION':
      return cambiarFila(estado, accion.prefijo, borrarObservacion)
    default:
      return estado
  }
}

// ───────────────────────────── Selectores de cabecera ─────────────────────────────

export function etiquetaImei(e: EstadoFormulario): string {
  return `IMEI: ${e.imei}`
}

/** Título de la pestaña del navegador y nombre accesible del diálogo. */
export function tituloPestana(e: EstadoFormulario): string {
  return `Nueva reparación — IMEI ${e.imei}`
}

const CATEGORIAS_CONFLICTO = ['Reparación', 'Glass', 'Pulido'] as const

function categoriaConflicto(idRep: string): (typeof CATEGORIAS_CONFLICTO)[number] {
  if (idRep.startsWith('AG')) return 'Glass'
  if (idRep.startsWith('AP')) return 'Pulido'
  return 'Reparación'
}

/** Texto de la banda de conflicto, o null si el IMEI no tiene más asignaciones abiertas que la propia. */
export function textoConflicto(activas: AsignacionActiva[], idAsignacionPropia: string, idTecSesion: number | null): string | null {
  const ajenas = activas.filter((a) => a.idRep !== idAsignacionPropia)
  if (ajenas.length === 0) return null
  const grupos = CATEGORIAS_CONFLICTO.map((categoria) => {
    const nombres = ajenas
      .filter((a) => categoriaConflicto(a.idRep) === categoria)
      .map((a) => (idTecSesion !== null && a.idTec === idTecSesion ? `${a.nombreTecnico} (tú)` : a.nombreTecnico))
    return nombres.length === 0 ? null : `${categoria}: ${nombres.join(', ')}`
  }).filter((g): g is string => g !== null)
  return `⚠ Este IMEI también está asignado a — ${grupos.join(' · ')}`
}
