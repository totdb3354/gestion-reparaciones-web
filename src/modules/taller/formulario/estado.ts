import type {
  AgotarRequest, AsignacionActiva, Componente, ComponentesAgrupados, DetalleEdicion, EditarReparacionRequest, FilaReparacion,
  GuardarFilaRequest, InsertarCompletaRequest, SolicitudAsignacion,
} from '@/shared/api/client'
import { MODELOS_ORDENADOS, extraerModelo, modelosDisponibles } from '../lib/modelos'
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

// ───────────────────────────── Solicitudes ya guardadas ─────────────────────────────

const RECHAZADA = 'RECHAZADA'
const GESTIONADA = 'GESTIONADA'

function textoONull(texto: string | null | undefined): string | null {
  const recortado = (texto ?? '').trim()
  return recortado === '' ? null : recortado
}

/** Aplica una solicitud NO rechazada a su fila y selecciona su SKU (aunque el filtro de modelo lo hubiera dejado fuera).
 *  Orden de evaluación: recibido (GESTIONADA con stock) → en camino → pendiente (también GESTIONADA sin stock). */
function aplicarSolicitud(fila: FilaEstado, sol: SolicitudAsignacion): FilaEstado {
  const c = fila.skus.find((s) => s.idCom === sol.idCom)
  if (c === undefined) return fila
  const opciones = fila.opciones.some((o) => o.idCom === c.idCom) ? fila.opciones : [...fila.opciones, c]
  const normal: FilaEstado = {
    ...fila,
    opciones,
    idCom: c.idCom,
    cantidad: 0,
    reutilizado: false,
    solicitud: null,
    recibidoPendienteUso: false,
    controles: controlesIniciales(c),
  }
  if (sol.estadoSolicitud === GESTIONADA && c.stock > 0) return { ...normal, recibidoPendienteUso: true }
  return {
    ...normal,
    solicitud: { estado: sol.enCamino ? 'enCamino' : 'pendiente', descripcion: textoONull(sol.descripcionSolicitud) },
    // Con solicitud guardada "Añadir observación" sigue activo; "Reutilizado", solo si no está en camino.
    controles: { mas: false, menos: false, reutilizado: !sol.enCamino, sku: false, observacion: true },
  }
}

function aplicarSolicitudes(filas: FilaEstado[], solicitudes: SolicitudAsignacion[]): FilaEstado[] {
  return solicitudes.reduce(
    (acc, sol) => acc.map((f) => (f.skus.some((s) => s.idCom === sol.idCom) ? aplicarSolicitud(f, sol) : f)),
    filas,
  )
}

/** Una rechazada no deja marca: solo preselecciona su SKU si está entre las opciones del modelo. */
function preseleccionarRechazada(fila: FilaEstado, idCom: number): FilaEstado {
  const c = fila.opciones.find((o) => o.idCom === idCom)
  if (c === undefined || fila.solicitud !== null) return fila
  return { ...fila, idCom: c.idCom, controles: controlesIniciales(c) }
}

/** Primer modelo deducible del SKU de alguna solicitud (de cualquier estado, también rechazadas). */
function modeloDeSolicitudes(filas: FilaEstado[], solicitudes: SolicitudAsignacion[]): string | null {
  for (const sol of solicitudes) {
    for (const fila of filas) {
      const c = fila.skus.find((s) => s.idCom === sol.idCom)
      const modelo = c ? extraerModelo(c.tipo, fila.prefijo) : null
      if (modelo !== null) return modelo
    }
  }
  return null
}

/** El combo debe poder mostrar el modelo fijado aunque ningún SKU activo lo aporte: se inserta en su sitio del catálogo. */
function conModeloEnLista(modelos: string[], modelo: string | null): string[] {
  if (modelo === null || modelos.includes(modelo)) return modelos
  return MODELOS_ORDENADOS.filter((m) => m === modelo || modelos.includes(m))
}

/** Orden del modelo: el de las solicitudes → el del teléfono (que bloquea el combo). Fijar el modelo resetea las filas,
 *  así que las solicitudes se aplican DESPUÉS de fijarlo (las tres pasadas de la referencia: aplicar, fijar, reaplicar). */
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
  const vivas = datos.solicitudes.filter((s) => s.estadoSolicitud !== RECHAZADA)
  const rechazadas = datos.solicitudes.filter((s) => s.estadoSolicitud === RECHAZADA)
  const deSolicitud = modeloDeSolicitudes(base.filas, datos.solicitudes)
  const telefono =
    deSolicitud === null && datos.modeloTelefono !== null && base.modelos.includes(datos.modeloTelefono) ? datos.modeloTelefono : null
  const modelo = deSolicitud ?? telefono
  const filtradas = modelo === null ? base.filas : base.filas.map((f) => filaLimpia(f, modelo))
  const conSolicitudes = aplicarSolicitudes(filtradas, vivas)
  const filas = rechazadas.reduce((acc, sol) => acc.map((f) => preseleccionarRechazada(f, sol.idCom)), conSolicitudes)
  return {
    ...base,
    modelo,
    modelos: conModeloEnLista(base.modelos, modelo),
    // Solo bloquean el combo el modelo del teléfono y las solicitudes activas (pendiente o en camino).
    modeloBloqueado: telefono !== null || filas.some((f) => f.solicitud !== null),
    tieneSolicitudesIniciales: datos.solicitudes.length > 0,
    filas,
  }
}

/** Busca un componente en el catálogo completo (también inactivos y el grupo 'otro'): la reparación editada puede ser de un SKU
 *  que ya no está activo y no por eso se pierde su fila. */
function buscarComponente(agrupados: ComponentesAgrupados, idCom: number): { prefijo: string; componente: Componente } | null {
  for (const prefijo of Object.keys(agrupados)) {
    const componente = agrupados[prefijo].find((c) => c.idCom === idCom)
    if (componente) return { prefijo, componente }
  }
  return null
}

/** Fila en edición: SKU, cantidad, "Reutilizado" y observación originales. "+" apagado con stock ≤ 0; si era reutilizada,
 *  "+" y "-" apagados; si no y cantidad > 0, "Reutilizado" apagado. */
function filaEditada(base: BaseFila, c: Componente, modelo: string | null, detalle: DetalleEdicion): FilaEstado {
  const skus = base.skus.some((s) => s.idCom === c.idCom) ? base.skus : [...base.skus, c]
  const limpia = filaLimpia({ prefijo: base.prefijo, nombre: base.nombre, skus }, modelo)
  const opciones = limpia.opciones.some((o) => o.idCom === c.idCom) ? limpia.opciones : [...limpia.opciones, c]
  const cantidad = Math.max(0, detalle.cantidad)
  const reutilizado = detalle.esReutilizado
  const observacion = textoONull(detalle.observacion)
  return {
    ...limpia,
    skus,
    opciones,
    idCom: c.idCom,
    cantidad,
    reutilizado,
    observacion,
    controles: {
      mas: !reutilizado && c.stock > 0,
      menos: !reutilizado && cantidad > 0,
      reutilizado: reutilizado || cantidad === 0,
      sku: true,
      observacion: true,
    },
    rol: 'editada',
    original: { idCom: c.idCom, cantidad, reutilizado, observacion },
  }
}

/** Modo edición: el modelo es el del SKU editado (pieza o acción 'otro…') y el combo queda siempre bloqueado. Las filas de
 *  otros tipos con algún SKU (de cualquier modelo, activo o no) ya reparado en el IMEI salen como 'yaReparado'. */
function inicialEditar(datos: DatosEditar): EstadoFormulario {
  const glass = datos.idRep.startsWith('G')
  const base = estadoBase({
    modo: 'editar',
    categoria: glass ? 'G' : 'R',
    idAsignacion: null,
    imei: datos.detalle.imei,
    incidencia: null,
    agrupados: datos.agrupados,
    glass,
  })
  const hallado = buscarComponente(datos.agrupados, datos.detalle.idCom)
  const esAccion = hallado !== null && hallado.prefijo === PREFIJO_OTRO
  const modelo = hallado === null ? null : extraerModelo(hallado.componente.tipo, hallado.prefijo)
  const filas = base.filas.map((fila): FilaEstado => {
    if (hallado !== null && !esAccion && fila.prefijo === hallado.prefijo) return filaEditada(fila, hallado.componente, modelo, datos.detalle)
    const limpia = filaLimpia(fila, modelo)
    const yaReparado = (datos.agrupados[fila.prefijo] ?? []).some((c) => datos.yaReparados.includes(c.idCom))
    return yaReparado ? { ...limpia, rol: 'yaReparado', controles: CONTROLES_APAGADOS } : limpia
  })
  const linea = (id: number, texto: string, origen: OrigenAccion): OtraAccion => ({
    id, texto, origen, guardada: null, confirmando: false, guardando: false,
  })
  const otros = datos.accionesYaReparadas.map((texto, i) => linea(i + 1, texto, 'yaReparada'))
  if (esAccion) otros.push(linea(otros.length + 1, datos.detalle.observacion ?? '', 'editada'))
  return {
    ...base,
    modelo,
    modeloBloqueado: true,
    modelos: conModeloEnLista(base.modelos, modelo),
    filas,
    otros,
    siguienteIdAccion: otros.length + 1,
    edicion: {
      idRep: datos.idRep,
      tipo: esAccion ? 'accion' : 'pieza',
      idTecOriginal: datos.detalle.idTec,
      updatedAt: datos.detalle.updatedAt,
      textoAccionOriginal: esAccion ? (datos.detalle.observacion ?? '').trim() : null,
      idComAccion: esAccion ? datos.detalle.idCom : null,
    },
  }
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

// ───────────────────────────── Reductor: guardar fila y agotado local ─────────────────────────────

/** Como cambiarFila, pero para pasos que NO son cambios de datos (confirmaciones, envíos en vuelo): no toca revision. */
function sustituirFila(estado: EstadoFormulario, prefijo: string, cambio: (fila: FilaEstado) => FilaEstado | null): EstadoFormulario {
  const indice = estado.filas.findIndex((f) => f.prefijo === prefijo)
  if (indice < 0) return estado
  const nueva = cambio(estado.filas[indice])
  if (nueva === null) return estado
  return { ...estado, filas: estado.filas.map((f, i) => (i === indice ? nueva : f)) }
}

function pedirConfirmacionFila(estado: EstadoFormulario, prefijo: string): EstadoFormulario {
  return sustituirFila(estado, prefijo, (fila) => {
    const boton = botonDerecho(estado, fila)
    if (boton.tipo !== 'guardarFila' || boton.deshabilitado || fila.confirmandoGuardar) return null
    return { ...fila, confirmandoGuardar: true }
  })
}

function inicioGuardarFila(estado: EstadoFormulario, prefijo: string): EstadoFormulario {
  return sustituirFila(estado, prefijo, (fila) => (fila.confirmandoGuardar && !fila.guardando ? { ...fila, guardando: true } : null))
}

function filaGuardada(estado: EstadoFormulario, prefijo: string, guardada: Guardada): EstadoFormulario {
  const siguiente = sustituirFila(estado, prefijo, (fila) =>
    fila.guardada !== null
      ? null
      : { ...fila, guardada, guardando: false, confirmandoGuardar: false, recibidoPendienteUso: false, controles: CONTROLES_APAGADOS },
  )
  return siguiente === estado ? estado : { ...siguiente, volcados: estado.volcados + 1 }
}

function falloGuardarFila(estado: EstadoFormulario, prefijo: string): EstadoFormulario {
  return sustituirFila(estado, prefijo, (fila) => (fila.guardando ? { ...fila, guardando: false, confirmandoGuardar: false } : null))
}

/** Confirmar es LOCAL: bloquea la fila, borra su observación y deja el contador en lo que se enviará a agotar-componente
 *  (0 en "sin stock", el stock en "límite"). Solo procede si la sub-fila ofrece alguna de las dos variantes. */
function confirmarAgotado(estado: EstadoFormulario, prefijo: string, descripcion: string): EstadoFormulario {
  return cambiarFila(estado, prefijo, (fila) => {
    const variante = subFila(estado, fila)
    if (fila.guardando || (variante.tipo !== 'sinStock' && variante.tipo !== 'limite')) return null
    return {
      ...fila,
      cantidad: variante.tipo === 'limite' ? variante.stock : 0,
      observacion: null,
      agotado: { descripcion: textoONull(descripcion), registrado: false },
      controles: CONTROLES_APAGADOS,
    }
  })
}

/** Un agotado ya registrado en el servidor no se edita ni se cancela desde aquí. */
function editarDescripcionAgotado(estado: EstadoFormulario, prefijo: string, descripcion: string): EstadoFormulario {
  return sustituirFila(estado, prefijo, (fila) =>
    fila.agotado === null || fila.agotado.registrado ? null : { ...fila, agotado: { ...fila.agotado, descripcion: textoONull(descripcion) } },
  )
}

function cancelarAgotado(estado: EstadoFormulario, prefijo: string): EstadoFormulario {
  return cambiarFila(estado, prefijo, (fila) => {
    if (fila.agotado === null || fila.agotado.registrado) return null
    const stock = stockDe(fila) ?? 0
    return {
      ...fila,
      agotado: null,
      cantidad: 0,
      controles: { mas: !fila.reutilizado && stock > 0, menos: false, reutilizado: true, sku: true, observacion: true },
    }
  })
}

function agotadoRegistrado(estado: EstadoFormulario, prefijo: string): EstadoFormulario {
  return sustituirFila(estado, prefijo, (fila) =>
    fila.agotado === null || fila.agotado.registrado ? null : { ...fila, agotado: { ...fila.agotado, registrado: true } },
  )
}

// ───────────────────────────── Reductor: otras acciones ─────────────────────────────

/** `cuenta` = es un cambio de datos (sube revision). */
function cambiarAccion(estado: EstadoFormulario, id: number, cuenta: boolean, cambio: (accion: OtraAccion) => OtraAccion | null): EstadoFormulario {
  const actual = estado.otros.find((a) => a.id === id)
  const nueva = actual ? cambio(actual) : null
  if (nueva === null) return estado
  return { ...estado, otros: estado.otros.map((a) => (a.id === id ? nueva : a)), revision: estado.revision + (cuenta ? 1 : 0) }
}

/** Línea que el usuario puede tocar: ni guardada, ni "✓ Ya reparada", ni con su guardado en vuelo. */
function accionEditable(a: OtraAccion): boolean {
  return a.guardada === null && a.origen !== 'yaReparada' && !a.guardando
}

function anadirAccion(estado: EstadoFormulario): EstadoFormulario {
  if (!anadirAccionHabilitado(estado)) return estado
  const linea: OtraAccion = { id: estado.siguienteIdAccion, texto: '', origen: 'nueva', guardada: null, confirmando: false, guardando: false }
  return { ...estado, otros: [...estado.otros, linea], siguienteIdAccion: estado.siguienteIdAccion + 1, revision: estado.revision + 1 }
}

function quitarAccion(estado: EstadoFormulario, id: number): EstadoFormulario {
  const linea = estado.otros.find((a) => a.id === id)
  if (linea === undefined || linea.origen !== 'nueva' || !accionEditable(linea)) return estado
  return { ...estado, otros: estado.otros.filter((a) => a.id !== id), revision: estado.revision + 1 }
}

function pedirConfirmacionAccion(estado: EstadoFormulario, id: number): EstadoFormulario {
  if (estado.modo === 'editar' || idComOtro(estado) === null) return estado
  return cambiarAccion(estado, id, false, (a) => {
    if (a.origen !== 'nueva' || !accionEditable(a) || a.texto.trim() === '' || !accionPideConfirmacion(a)) return null
    return { ...a, confirmando: true, pideOtroClic: false }
  })
}

// ───────────────────────────── Reductor: zona de guardar ─────────────────────────────

function pedirConfirmacionGuardar(estado: EstadoFormulario): EstadoFormulario {
  if (!zonaGuardarVisible(estado) || estado.guardado.enCurso || estado.guardado.clics === 1) return estado
  return { ...estado, guardado: { ...estado.guardado, clics: 1, textoConfirmacion: true } }
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
    case 'PEDIR_CONFIRMACION_FILA':
      return pedirConfirmacionFila(estado, accion.prefijo)
    case 'INICIO_GUARDAR_FILA':
      return inicioGuardarFila(estado, accion.prefijo)
    case 'FILA_GUARDADA':
      return filaGuardada(estado, accion.prefijo, { idRep: accion.idRep, fecha: accion.fecha })
    case 'FALLO_GUARDAR_FILA':
      return falloGuardarFila(estado, accion.prefijo)
    case 'CONFIRMAR_AGOTADO':
      return confirmarAgotado(estado, accion.prefijo, accion.descripcion)
    case 'EDITAR_DESCRIPCION_AGOTADO':
      return editarDescripcionAgotado(estado, accion.prefijo, accion.descripcion)
    case 'CANCELAR_AGOTADO':
      return cancelarAgotado(estado, accion.prefijo)
    case 'AGOTADO_REGISTRADO':
      return agotadoRegistrado(estado, accion.prefijo)
    case 'ANADIR_ACCION':
      return anadirAccion(estado)
    case 'ESCRIBIR_ACCION':
      return cambiarAccion(estado, accion.id, true, (a) =>
        !accionEditable(a) || a.texto === accion.texto ? null : { ...a, texto: accion.texto, confirmando: false, pideOtroClic: false },
      )
    case 'QUITAR_ACCION':
      return quitarAccion(estado, accion.id)
    case 'PEDIR_CONFIRMACION_ACCION':
      return pedirConfirmacionAccion(estado, accion.id)
    case 'INICIO_GUARDAR_ACCION':
      return cambiarAccion(estado, accion.id, false, (a) =>
        a.confirmando && !accionPideConfirmacion(a) && accionEditable(a) ? { ...a, guardando: true } : null,
      )
    case 'ACCION_GUARDADA': {
      const guardada: Guardada = { idRep: accion.idRep, fecha: accion.fecha }
      const siguiente = cambiarAccion(estado, accion.id, false, (a) =>
        a.guardada !== null ? null : { ...a, texto: a.texto.trim(), guardada, confirmando: false, guardando: false, pideOtroClic: false },
      )
      return siguiente === estado ? estado : { ...siguiente, volcados: estado.volcados + 1 }
    }
    case 'FALLO_GUARDAR_ACCION':
      // El texto sigue en "✓ Confirmar" (confirmando = true), pero el siguiente clic vuelve a pedir confirmación.
      return cambiarAccion(estado, accion.id, false, (a) =>
        a.guardando ? { ...a, guardando: false, confirmando: true, pideOtroClic: true } : null,
      )
    case 'PEDIR_CONFIRMACION_GUARDAR':
      return pedirConfirmacionGuardar(estado)
    case 'INICIO_GUARDADO':
      return estado.guardado.clics === 1 && !estado.guardado.enCurso ? { ...estado, guardado: { ...estado.guardado, enCurso: true } } : estado
    case 'FALLO_GUARDADO':
      // El texto "✓  Confirmar terminar" no vuelve atrás, pero hacen falta otros dos clics.
      return estado.guardado.enCurso ? { ...estado, guardado: { ...estado.guardado, clics: 0, enCurso: false } } : estado
    case 'GUARDADO_COMPLETADO':
      return { ...estado, borradorDescartado: true }
    default:
      return estado
  }
}

// ───────────────────────────── Selectores de cabecera ─────────────────────────────

export function etiquetaImei(e: EstadoFormulario): string {
  if (e.edicion === null) return `IMEI: ${e.imei}`
  return `IMEI: ${e.imei}  ·  Editando ${e.edicion.tipo === 'accion' ? 'acción ' : ''}${e.edicion.idRep}`
}

/** Título de la pestaña del navegador y nombre accesible del diálogo. */
export function tituloPestana(e: EstadoFormulario): string {
  return e.edicion === null ? `Nueva reparación — IMEI ${e.imei}` : `Editar reparación — ${e.edicion.idRep}`
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

// ───────────────────────────── Selectores: botón derecho y sub-fila ─────────────────────────────

export type BotonDerecho =
  | { tipo: 'ninguno' }
  | { tipo: 'guardarFila'; texto: '✓ Guardar fila' | '✓ Confirmar'; deshabilitado: boolean }
  | { tipo: 'guardada'; texto: string } // '✓ Guardada dd/MM HH:mm'
  | { tipo: 'enCamino' } // '⚠ En camino'
  | { tipo: 'recibido' } // '✓ Recibido'
  | { tipo: 'yaReparado' } // '✓  Ya reparado'

export function botonDerecho(e: EstadoFormulario, fila: FilaEstado): BotonDerecho {
  if (fila.rol === 'yaReparado') return { tipo: 'yaReparado' }
  if (fila.guardada !== null) return { tipo: 'guardada', texto: `✓ Guardada ${fila.guardada.fecha}` }
  // Una fila sin SKU para el modelo no enseña nada, tampoco un "✓ Recibido" anterior.
  if (filaSinSku(fila)) return { tipo: 'ninguno' }
  if (fila.solicitud !== null) return fila.solicitud.estado === 'enCamino' ? { tipo: 'enCamino' } : { tipo: 'ninguno' }
  if (fila.agotado !== null || e.modo === 'editar') return { tipo: 'ninguno' }
  if (filaActiva(fila)) {
    return { tipo: 'guardarFila', texto: fila.confirmandoGuardar ? '✓ Confirmar' : '✓ Guardar fila', deshabilitado: fila.guardando }
  }
  return fila.recibidoPendienteUso ? { tipo: 'recibido' } : { tipo: 'ninguno' }
}

export type SubFila =
  | { tipo: 'oculta' }
  | { tipo: 'sinStock' } // texto y botón "Solicitar pieza"
  | { tipo: 'limite'; stock: number } // texto y botón "Solicitar y descontar stock"
  | { tipo: 'confirmada'; texto: string; lapizHabilitado: boolean } // lapizHabilitado = solicitud local

export const TEXTO_SIN_STOCK = '⚠  Sin stock disponible. Solicita la pieza para que el admin gestione el pedido.'
export const TEXTO_LIMITE = '⚠  Stock agotado. Puedes descontar los componentes fallidos y solicitar reposición.'
const TEXTO_SOLICITUD_PENDIENTE = '✓  Solicitud de reposición pendiente'

function conDescripcion(texto: string, descripcion: string | null): string {
  return descripcion === null ? texto : `${texto} — ${descripcion}`
}

/** Siempre 'oculta' en modo editar y en una fila guardada. En la variante límite y en su etiqueta confirmada, N es el
 *  STOCK del SKU, no el contador. El lápiz solo funciona sobre la solicitud local aún sin registrar. */
export function subFila(e: EstadoFormulario, fila: FilaEstado): SubFila {
  if (e.modo === 'editar' || fila.guardada !== null || filaSinSku(fila)) return { tipo: 'oculta' }
  if (fila.solicitud !== null) {
    return { tipo: 'confirmada', texto: conDescripcion(TEXTO_SOLICITUD_PENDIENTE, fila.solicitud.descripcion), lapizHabilitado: false }
  }
  const stock = stockDe(fila) ?? 0
  if (fila.agotado !== null) {
    const texto = stock > 0 ? `✓  ${stock} uds. se descontarán al guardar — solicitud pendiente` : TEXTO_SOLICITUD_PENDIENTE
    return { tipo: 'confirmada', texto: conDescripcion(texto, fila.agotado.descripcion), lapizHabilitado: !fila.agotado.registrado }
  }
  if (stock === 0) return { tipo: 'sinStock' }
  if (!fila.reutilizado && fila.cantidad >= stock) return { tipo: 'limite', stock }
  return { tipo: 'oculta' }
}

// ───────────────────────────── Selectores: otras acciones y zona de guardar ─────────────────────────────

/** Componente 'otro' cuyo SKU da el modelo elegido (no se mira 'activo'): el idCom de todas las acciones. */
export function idComOtro(e: EstadoFormulario): number | null {
  if (e.modelo === null) return null
  const c = e.componentesOtro.find((o) => extraerModelo(o.tipo, PREFIJO_OTRO) === e.modelo)
  return c ? c.idCom : null
}

export function otrasAccionesVisible(e: EstadoFormulario): boolean {
  return idComOtro(e) !== null
}

/** Badge: líneas guardadas, "✓ Ya reparada" o con texto. */
export function contadorAcciones(e: EstadoFormulario): number {
  return e.otros.filter((a) => a.guardada !== null || a.origen === 'yaReparada' || a.texto.trim() !== '').length
}

export function anadirAccionHabilitado(e: EstadoFormulario): boolean {
  return otrasAccionesVisible(e) && !e.otros.some((a) => a.guardada === null && a.origen !== 'yaReparada' && a.texto.trim() === '')
}

/** true = el siguiente clic en "✓ Guardar" / "✓ Confirmar" de la línea debe PEDIR confirmación (no guardar todavía). */
export function accionPideConfirmacion(a: OtraAccion): boolean {
  return !a.confirmando || a.pideOtroClic === true
}

/** Acciones nuevas con texto que se enviarán al guardar (solo cuentan si el modelo tiene componente 'otro'). */
function accionesPendientes(e: EstadoFormulario): OtraAccion[] {
  if (idComOtro(e) === null) return []
  return e.otros.filter((a) => a.origen === 'nueva' && a.guardada === null && a.texto.trim() !== '')
}

/** Se muestra u oculta la zona ENTERA. Una solicitud cargada del servidor no la muestra por sí sola. */
export function zonaGuardarVisible(e: EstadoFormulario): boolean {
  if (e.modo === 'editar') return zonaVisibleEnEdicion(e)
  return (
    e.filas.some((f) => f.guardada !== null || filaActiva(f)) ||
    e.otros.some((a) => a.guardada !== null) ||
    accionesPendientes(e).length > 0
  )
}

export function textoBotonGuardar(e: EstadoFormulario): string {
  if (e.guardado.textoConfirmacion) return '✓  Confirmar terminar'
  return e.modo === 'editar' ? 'Guardar cambios' : 'Terminar asignación'
}

// ───────────────────────────── Selectores: modo edición ─────────────────────────────

function filaEnEdicion(e: EstadoFormulario): FilaEstado | null {
  return e.filas.find((f) => f.rol === 'editada') ?? null
}

function accionEnEdicion(e: EstadoFormulario): OtraAccion | null {
  return e.otros.find((a) => a.origen === 'editada') ?? null
}

/** Hay cambio si varía cantidad, SKU, "Reutilizado" u observación respecto al original. */
export function hayCambioEnFilaEditada(e: EstadoFormulario): boolean {
  const fila = filaEnEdicion(e)
  if (fila === null || fila.original === null) return false
  const o = fila.original
  return fila.cantidad !== o.cantidad || fila.idCom !== o.idCom || fila.reutilizado !== o.reutilizado || fila.observacion !== o.observacion
}

/** Cambio sin uso (cantidad 0 y sin "Reutilizado"): contador en rojo y zona de guardar oculta. */
export function filaEditadaInvalida(e: EstadoFormulario): boolean {
  const fila = filaEnEdicion(e)
  return fila !== null && hayCambioEnFilaEditada(e) && fila.cantidad === 0 && !fila.reutilizado
}

/** La acción editada con el texto vacío invalida todo el guardado. */
export function accionEditadaInvalida(e: EstadoFormulario): boolean {
  const accion = accionEnEdicion(e)
  return accion !== null && accion.texto.trim() === ''
}

function hayCambioEnAccionEditada(e: EstadoFormulario): boolean {
  const accion = accionEnEdicion(e)
  if (accion === null || e.edicion === null) return false
  const texto = accion.texto.trim()
  return texto !== '' && texto !== e.edicion.textoAccionOriginal
}

/** Filas que no son la editada ni están ya reparadas y que se han activado: se guardan como reparaciones nuevas. */
function filasNuevasEnEdicion(e: EstadoFormulario): FilaEstado[] {
  return e.filas.filter((f) => f.rol === 'normal' && !filaSinSku(f) && filaActiva(f))
}

function zonaVisibleEnEdicion(e: EstadoFormulario): boolean {
  if (filaEditadaInvalida(e) || accionEditadaInvalida(e)) return false
  return (
    hayCambioEnFilaEditada(e) || hayCambioEnAccionEditada(e) || filasNuevasEnEdicion(e).length > 0 || accionesPendientes(e).length > 0
  )
}

/** Solo en edición se pregunta al cerrar; un cambio inválido oculta la zona y por eso se pierde sin preguntar. */
export function hayCambiosSinGuardar(e: EstadoFormulario): boolean {
  return e.modo === 'editar' && zonaGuardarVisible(e)
}

export type PrevisionStock = { texto: string; tendencia: 'baja' | 'sube' | 'igual' }

/** "<stock> → <previsto>" de la fila editada: previsto = stock + devuelto − descontado. Devuelto = la cantidad original si el
 *  SKU sigue siendo el original y no era reutilizada; descontado = 0 con "Reutilizado", si no la cantidad. */
export function previsionStock(e: EstadoFormulario, fila: FilaEstado): PrevisionStock | null {
  const stock = stockDe(fila)
  if (e.modo !== 'editar' || fila.rol !== 'editada' || fila.original === null || stock === null) return null
  const devuelto = fila.idCom === fila.original.idCom && !fila.original.reutilizado ? fila.original.cantidad : 0
  const descontado = fila.reutilizado ? 0 : fila.cantidad
  const previsto = stock + devuelto - descontado
  return { texto: `${stock} → ${previsto}`, tendencia: previsto < stock ? 'baja' : previsto > stock ? 'sube' : 'igual' }
}

// ───────────────────────────── Cuerpos de las llamadas ─────────────────────────────
// Los campos sin valor viajan como null (el contrato marca todas las propiedades como required).

export function filaDeCuerpo(fila: FilaEstado): FilaReparacion {
  if (fila.idCom === null) throw new Error(`La fila ${fila.prefijo} no tiene SKU: no se puede enviar`)
  return {
    idCom: fila.idCom,
    cantidad: fila.cantidad,
    reutilizado: fila.reutilizado,
    observacion: fila.observacion,
    prefijo: fila.prefijo,
    esSolicitud: false,
    descripcionSolicitud: null,
    estadoSolicitud: null,
    enCamino: false,
  }
}

export function filaDeAccion(idCom: number, texto: string): FilaReparacion {
  return {
    idCom,
    cantidad: 0,
    reutilizado: false,
    observacion: texto.trim(),
    prefijo: PREFIJO_OTRO,
    esSolicitud: false,
    descripcionSolicitud: null,
    estadoSolicitud: null,
    enCamino: false,
  }
}

/** Una fila de cuerpo por cada acción nueva con texto (ninguna si el modelo no tiene componente 'otro'). */
function filasDeAcciones(e: EstadoFormulario): FilaReparacion[] {
  const idCom = idComOtro(e)
  return idCom === null ? [] : accionesPendientes(e).map((a) => filaDeAccion(idCom, a.texto))
}

/** "✓ Guardar fila": una sola fila, con el técnico de la sesión (el servidor toma el del token) y la incidencia si la hay. */
export function cuerpoGuardarFila(e: EstadoFormulario, prefijo: string, idTecSesion: number): GuardarFilaRequest {
  const fila = e.filas.find((f) => f.prefijo === prefijo)
  if (fila === undefined) throw new Error(`No existe la fila ${prefijo}`)
  return { filas: [filaDeCuerpo(fila)], imei: e.imei, idTec: idTecSesion, idRepAnterior: e.incidencia }
}

/** "✓ Guardar" de una acción; null si el modelo no tiene componente 'otro', la línea no existe o no tiene texto. */
export function cuerpoGuardarAccion(e: EstadoFormulario, id: number, idTecSesion: number): GuardarFilaRequest | null {
  const idCom = idComOtro(e)
  const accion = e.otros.find((a) => a.id === id)
  if (idCom === null || accion === undefined || accion.texto.trim() === '') return null
  return { filas: [filaDeAccion(idCom, accion.texto)], imei: e.imei, idTec: idTecSesion, idRepAnterior: e.incidencia }
}

export type PlanTerminar = {
  agotados: { prefijo: string; cuerpo: AgotarRequest }[] // solo los NO registrados, en orden de filas
  completa: InsertarCompletaRequest | null // null = sin filas que enviar y hubo agotado nuevo (registrado o no)
}

/** "Terminar asignación": primero un agotar-componente por cada agotado local aún sin registrar (un reintento no repite los
 *  ya registrados); después `completa` con las filas no guardadas activas (también las de solicitud cargada con
 *  "Reutilizado") y las acciones pendientes. Con `filas` vacía se envía igualmente (cierra la asignación), salvo que hubiera
 *  algún agotado nuevo: entonces la asignación queda abierta con su solicitud y `completa` no se llama. Sin `categoria`. */
export function planTerminar(e: EstadoFormulario, idTecSesion: number): PlanTerminar {
  const conAgotado = e.filas.filter((f) => f.guardada === null && f.agotado !== null)
  const agotados = conAgotado.flatMap((f) =>
    f.agotado === null || f.agotado.registrado || f.idCom === null
      ? []
      : [{ prefijo: f.prefijo, cuerpo: { idCom: f.idCom, cantidad: f.cantidad, descripcion: f.agotado.descripcion } }],
  )
  const filas = [
    ...e.filas.filter((f) => f.guardada === null && f.agotado === null && !filaSinSku(f) && filaActiva(f)).map(filaDeCuerpo),
    ...filasDeAcciones(e),
  ]
  if (filas.length === 0 && conAgotado.length > 0) return { agotados, completa: null }
  return {
    agotados,
    completa: { filas, imei: e.imei, idTec: idTecSesion, idRepAnterior: e.incidencia, idAsignacion: e.idAsignacion, categoria: null },
  }
}

export type PlanGuardarCambios = {
  editarAccion: EditarReparacionRequest | null // paso 0
  editarFila: EditarReparacionRequest | null // paso 1
  completaFilas: InsertarCompletaRequest | null // paso 2
  completaAcciones: InsertarCompletaRequest | null // paso 3
}

/** "Guardar cambios", en orden. Las filas y acciones nuevas conservan el técnico ORIGINAL de la reparación editada y van
 *  sin idAsignacion ni idRepAnterior; `categoria` es 'G' solo si se edita una G…. */
export function planGuardarCambios(e: EstadoFormulario): PlanGuardarCambios {
  const edicion = e.edicion
  if (e.modo !== 'editar' || edicion === null) return { editarAccion: null, editarFila: null, completaFilas: null, completaAcciones: null }
  const completa = (filas: FilaReparacion[]): InsertarCompletaRequest | null =>
    filas.length === 0
      ? null
      : {
          filas,
          imei: e.imei,
          idTec: edicion.idTecOriginal,
          idRepAnterior: null,
          idAsignacion: null,
          categoria: edicion.idRep.startsWith('G') ? 'G' : null,
        }
  const accion = accionEnEdicion(e)
  const fila = filaEnEdicion(e)
  return {
    editarAccion:
      accion !== null && edicion.idComAccion !== null && hayCambioEnAccionEditada(e)
        ? {
            idComNuevo: edicion.idComAccion,
            esReutilizadoNuevo: false,
            observacionNueva: accion.texto.trim(),
            nNuevas: 0,
            updatedAt: edicion.updatedAt,
          }
        : null,
    editarFila:
      fila !== null && fila.idCom !== null && hayCambioEnFilaEditada(e)
        ? {
            idComNuevo: fila.idCom,
            esReutilizadoNuevo: fila.reutilizado,
            observacionNueva: fila.observacion,
            nNuevas: fila.cantidad,
            updatedAt: edicion.updatedAt,
          }
        : null,
    completaFilas: completa(filasNuevasEnEdicion(e).map(filaDeCuerpo)),
    completaAcciones: completa(filasDeAcciones(e)),
  }
}
