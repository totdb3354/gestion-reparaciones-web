import { useState } from 'react'
import { cerrarFormularioPedido, formularioPedido } from '@/shared/lib/formularioPedido'
import { useStore } from '@/shared/lib/store'
import { NuevoOtroPedidoDialog } from './NuevoOtroPedidoDialog'
import { NuevoPedidoDialog } from './NuevoPedidoDialog'

/** Host del shell (P1): pinta el formulario de alta que diga el store compartido. Stock actual, Pedidos y la campana (que
 *  vive en `taller` y no puede importar de `almacen`) solo llaman a `abrirNuevoPedido` / `abrirNuevoOtroPedido`. */
export function FormulariosPedido() {
  const [abierto] = useStore(formularioPedido)
  // Una apertura = un montaje: cada apertura guarda un objeto nuevo en el store, así que si se abre otro formulario con
  // uno ya abierto, `apertura` cambia, la `key` también y el diálogo empieza de cero (líneas, clave, errores).
  const [visto, setVisto] = useState(abierto)
  const [apertura, setApertura] = useState(0)
  if (abierto !== visto) {
    setVisto(abierto)
    setApertura((n) => n + 1)
  }
  if (abierto === null) return null
  if (abierto.tipo === 'otro') return <NuevoOtroPedidoDialog key={apertura} onCerrar={cerrarFormularioPedido} />
  return <NuevoPedidoDialog key={apertura} precarga={abierto.precarga} onCerrar={cerrarFormularioPedido} />
}
