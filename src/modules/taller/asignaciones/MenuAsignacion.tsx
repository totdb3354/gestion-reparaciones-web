import { useEffect } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { ContextMenuItem } from '@/shared/ui/context-menu'
import type { CeldaPulsada } from '@/shared/ui/DataTable'
import { MenuCopiarCelda } from '@/shared/ui/MenuCopiarCelda'
// El texto que copia cada columna es el mismo que en Pendientes del técnico y las columnas comparten id
// (Task 7), así que se reutiliza su cálculo en vez de duplicar la tabla de la hoja de contrato §6.
import { textoCeldaPendiente } from '../pendientes/textoCelda'
import { useChasis, useUrgente } from './api'
import { tipoDe } from './filtros'
import type { AccionReversible } from './useAccionConDeshacer'

type Props = {
  fila: ReparacionResumen
  celda: CeldaPulsada
  /** ADMIN (spec §12): solo "Copiar celda"; desaparecen los editores y los dos interruptores. */
  soloLectura: boolean
  ejecutar: (accion: AccionReversible) => void
  /** Los editores son la Task 12; aquí solo están los ítems que los abren. */
  onEditarComentario: (fila: ReparacionResumen) => void
  onEditarModelo: (fila: ReparacionResumen) => void
  onEditarCliente: (fila: ReparacionResumen) => void
  /** Aviso de menú abierto/cerrado (spec 3a, D4). Debe ser estable entre renders: es la dependencia del efecto. */
  onInteraccion: (abierto: boolean) => void
}

/**
 * Menú contextual de la tabla de asignaciones (spec §10), calco del `setOnShowing` de
 * PendientesSuperTecnicoController: los ítems dependen de la categoría de la fila y del rol, y el texto de los dos
 * interruptores alterna según el estado de la fila.
 *
 * Se aparta del JavaFX en dos puntos, y en los dos manda la spec: el urgente no se ofrece en un pulido (el pulido
 * no tiene urgente en el servidor, hoja de contrato §1, aunque el JavaFX pinte el ítem), y urgente y chasis se
 * escriben con vuelta atrás (D2) en vez de a pelo.
 */
export function MenuAsignacion({ fila, celda, soloLectura, ejecutar, onEditarComentario, onEditarModelo, onEditarCliente, onInteraccion }: Props) {
  const urgente = useUrgente()
  const chasis = useChasis()
  const tipo = tipoDe(fila.idRep)
  const esRep = tipo === 'REPARACION'
  const esPulido = tipo === 'PULIDO'

  // Radix solo monta el contenido del menú mientras está abierto, así que montarse y desmontarse ES abrirse y
  // cerrarse. Así el aviso no exige que DataTable exponga el onOpenChange de su ContextMenu.
  useEffect(() => {
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [onInteraccion])

  function alternarUrgente() {
    const nuevo = !fila.urgente
    // El servidor propaga el urgente a todas las asignaciones abiertas del IMEI (una A… y su AG… hermana cambian a la
    // vez), así que el aviso nombra el teléfono y no la fila: el usuario ve cambiar dos filas y el texto debe decir
    // por qué. La inversa deshace las dos, porque es la misma escritura con el valor contrario. El chasis no se
    // propaga (el servidor actualiza solo esa fila) y por eso su aviso sí nombra la fila.
    ejecutar({
      texto: nuevo ? `IMEI ${fila.imei} marcado como urgente` : `IMEI ${fila.imei} ya no es urgente`,
      hacer: () => urgente.mutateAsync({ idRep: fila.idRep, urgente: nuevo }),
      deshacer: () => urgente.mutateAsync({ idRep: fila.idRep, urgente: !nuevo }),
    })
  }

  function alternarChasis() {
    const nuevo = !fila.esChasis
    ejecutar({
      texto: nuevo ? `${fila.idRep} marcada como chasis` : `${fila.idRep} ya no es chasis`,
      hacer: () => chasis.mutateAsync({ idRep: fila.idRep, esChasis: nuevo }),
      deshacer: () => chasis.mutateAsync({ idRep: fila.idRep, esChasis: !nuevo }),
    })
  }

  return (
    <>
      <MenuCopiarCelda texto={textoCeldaPendiente(fila, celda.columnaId)} celda={celda} />
      {!soloLectura && (
        <>
          <ContextMenuItem onSelect={() => onEditarComentario(fila)}>Editar comentario</ContextMenuItem>
          {/* Solo el pulido: reparación y glass cambian de modelo por el modal de piezas. */}
          {esPulido && <ContextMenuItem onSelect={() => onEditarModelo(fila)}>Editar modelo</ContextMenuItem>}
          <ContextMenuItem onSelect={() => onEditarCliente(fila)}>Editar cliente</ContextMenuItem>
          {/* Los dos interruptores van después de los "Editar…", como en el JavaFX. */}
          {!esPulido && <ContextMenuItem onSelect={alternarUrgente}>{fila.urgente ? 'Quitar urgente' : 'Marcar urgente'}</ContextMenuItem>}
          {esRep && <ContextMenuItem onSelect={alternarChasis}>{fila.esChasis ? 'Quitar chasis' : 'Marcar chasis'}</ContextMenuItem>}
        </>
      )}
    </>
  )
}
