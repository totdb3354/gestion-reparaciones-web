import { useEffect, useState } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { ConexionError, mensajeDeError, mensajeSinConexion } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { ContextMenuItem } from '@/shared/ui/context-menu'
import { tienePedidos } from './api'

type Props = {
  p: Proveedor
  onToggle: (p: Proveedor) => void
  onEditar: (p: Proveedor) => void
  onBorrar: (p: Proveedor) => void
  onInteraccion: (abierto: boolean) => void
}

/** Calco del menú de proveedor (:1694-1713), solo SUPERTECNICO. "Borrar" aparece si `tiene-pedidos` es falso; la
 *  consulta se hace al abrir el menú (Radix monta el contenido al abrirse), no en cada clic de fila (S6). Mismo patrón que
 *  MenuCliente de la vista Clientes. */
export function MenuProveedor({ p, onToggle, onEditar, onBorrar, onInteraccion }: Props) {
  const { mostrarError } = useAlerta()
  const [borrable, setBorrable] = useState(false)
  useEffect(() => {
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])
  useEffect(() => {
    let vivo = true
    tienePedidos(p.idProv)
      .then((tiene) => { if (vivo) setBorrable(!tiene) })
      .catch((e: unknown) => {
        if (!vivo) return
        mostrarError(e instanceof ConexionError ? mensajeSinConexion(e) : mensajeDeError(e))
      })
    return () => { vivo = false }
  }, [p.idProv, mostrarError])
  return (
    <>
      <ContextMenuItem onSelect={() => onToggle(p)}>{p.activo ? 'Desactivar' : 'Activar'}</ContextMenuItem>
      <ContextMenuItem onSelect={() => onEditar(p)}>Editar</ContextMenuItem>
      {borrable && <ContextMenuItem onSelect={() => onBorrar(p)}>Borrar</ContextMenuItem>}
    </>
  )
}
