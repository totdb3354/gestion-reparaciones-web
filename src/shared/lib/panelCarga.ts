import { ANCLA_DE_FABRICA, anclaValida, type Ancla } from './anclaPanel'
import { crearStore, crearStoreLeido, useStore } from './store'

/**
 * Panel flotante «Carga de técnicos» (spec 0.9.20): lo que recuerda el navegador (estado, alcance y sitio) y el aviso de un
 * solo uso con el que el panel pide a Asignaciones el filtro de un técnico. En shared porque lo usan la barra azul (app), el
 * marco y Asignaciones (módulo taller).
 */

export type EstadoPanelCarga = 'abierto' | 'minimizado' | 'cerrado'
export type AlcancePanelCarga = 'pedidos' | 'total'
export type PanelCarga = { estado: EstadoPanelCarga; alcance: AlcancePanelCarga; ancla: Ancla }

/** Clave de localStorage. Es del navegador, no del usuario (en el taller se comparten PCs), y cerrar sesión no la borra. */
export const CLAVE_PANEL_CARGA = 'panelCarga'

/** De fábrica: abierto, en Pedidos, abajo a la derecha a 16 px. */
export const PANEL_DE_FABRICA: PanelCarga = { estado: 'abierto', alcance: 'pedidos', ancla: ANCLA_DE_FABRICA }

/** Lo guardado, campo a campo: lo que no se pueda leer o no tenga forma válida se queda en lo de fábrica. */
function leerGuardado(): unknown {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PANEL_CARGA) ?? 'null')
  } catch {
    return null
  }
}

export function leerPanelCarga(): PanelCarga {
  const guardado = leerGuardado()
  const o = typeof guardado === 'object' && guardado !== null ? (guardado as Record<string, unknown>) : {}
  const estado = o.estado
  const alcance = o.alcance
  return {
    estado: estado === 'abierto' || estado === 'minimizado' || estado === 'cerrado' ? estado : PANEL_DE_FABRICA.estado,
    alcance: alcance === 'pedidos' || alcance === 'total' ? alcance : PANEL_DE_FABRICA.alcance,
    ancla: anclaValida(o.ancla) ?? PANEL_DE_FABRICA.ancla,
  }
}

/** Si no se puede guardar (modo privado, almacenamiento bloqueado), la elección dura lo que la página. */
function guardar(panel: PanelCarga) {
  try {
    localStorage.setItem(CLAVE_PANEL_CARGA, JSON.stringify(panel))
  } catch {
    // sin almacenamiento: dura lo que la página
  }
}

/** Se relee al reiniciar los stores (cierre de sesión): lo recordado sigue siendo lo del navegador. */
export const panelCarga = crearStoreLeido(leerPanelCarga)

function cambiar(cambio: Partial<PanelCarga>) {
  const nuevo = { ...panelCarga.get(), ...cambio }
  panelCarga.set(nuevo)
  guardar(nuevo)
}

export const abrirPanelCarga = () => cambiar({ estado: 'abierto' })
export const minimizarPanelCarga = () => cambiar({ estado: 'minimizado' })
export const cerrarPanelCarga = () => cambiar({ estado: 'cerrado' })
export const cambiarAlcancePanelCarga = (alcance: AlcancePanelCarga) => cambiar({ alcance })
/** Se llama al SOLTAR un arrastre, no en cada movimiento. */
export const moverPanelCarga = (ancla: Ancla) => cambiar({ ancla })
/** Botón «Carga» de la barra azul: abierto → cerrado; minimizado o cerrado → abierto. */
export const alternarPanelCarga = () => cambiar({ estado: panelCarga.get().estado === 'abierto' ? 'cerrado' : 'abierto' })

export function usePanelCarga(): PanelCarga {
  return useStore(panelCarga)[0]
}

/** Aviso de un solo uso: el técnico que se ha pulsado en el panel, a la espera de que Asignaciones ponga su filtro. */
const filtroTecnicoPedido = crearStore<number | null>(null)

/** Pulsar un técnico en el panel. */
export function pedirFiltroPorTecnico(idTec: number): void {
  filtroTecnicoPedido.set(idTec)
}

/** Para Asignaciones: entrega a `aplicar` el técnico pedido, ahora (si se pidió desde otra pantalla antes de montarse la
 *  vista) y cada vez que se pida después, y lo vacía al entregarlo. Devuelve la baja. */
export function recibirFiltroPorTecnico(aplicar: (idTec: number) => void): () => void {
  function entregar() {
    const idTec = filtroTecnicoPedido.get()
    if (idTec === null) return
    filtroTecnicoPedido.set(null)
    aplicar(idTec)
  }
  entregar()
  const baja = filtroTecnicoPedido.subscribe(entregar)
  return () => {
    baja()
  }
}
