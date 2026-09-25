import { cantidadARevertir, esCompra, idPedido, nombrePedido, type Pedido } from './reglas'

export type Confirmacion = { titulo: string; descripcion: string; textoAccion: string }

/** Textos de las tres confirmaciones (spec 4b §6). "Cancelar pedido" / "Cancelar" se calca tal cual. La descripción de
 *  revertir en componentes lleva saltos de línea: ConfirmDialog los respeta (whitespace-pre-line, Task 13). */
export function confirmacionDe(accion: 'cancelar' | 'borrar' | 'revertir', p: Pedido): Confirmacion {
  const id = idPedido(p)
  const nombre = nombrePedido(p)
  switch (accion) {
    case 'cancelar':
      return { titulo: 'Cancelar pedido', descripcion: `¿Cancelar el pedido #${id} de ${nombre}?`, textoAccion: 'Cancelar pedido' }
    case 'borrar':
      return { titulo: 'Borrar pedido', descripcion: `¿Borrar el pedido pendiente #${id} de ${nombre}?`, textoAccion: 'Borrar' }
    case 'revertir': {
      const primera = `¿Revertir el pedido #${id} de ${nombre} a En camino?`
      const descripcion = esCompra(p)
        ? `${primera}\nSe descontarán ${cantidadARevertir(p)} unidad(es) del stock.\nRecuerda revisar el stock tras la operación.`
        : primera
      return { titulo: 'Revertir a En camino', descripcion, textoAccion: 'Revertir a En camino' }
    }
  }
}
