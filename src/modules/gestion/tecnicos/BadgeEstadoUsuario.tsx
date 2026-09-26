import { cn } from '@/shared/lib/utils'

/** Badge de la columna Estado (RegisterController :106-131): "Activo" #2E7D32 sobre #D4EDDA, "Inactivo" #B03040 sobre
 *  #F5E6E6, radio 10, padding 3 10, 11 px negrita. Conserva sus colores en la fila seleccionada, como en el JavaFX. */
export function BadgeEstadoUsuario({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        'inline-block rounded-[10px] px-2.5 py-[3px] text-[11px] font-bold',
        activo ? 'bg-badge-usuario-activo-bg text-badge-usuario-activo-text' : 'bg-badge-usuario-inactivo-bg text-badge-usuario-inactivo-text',
      )}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}
