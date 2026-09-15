import { cn } from '@/shared/lib/utils'

/** Badge "Activo"/"Inactivo" con los colores de ClientesController.configurarTabla. */
export function StatusBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        'inline-block rounded-[10px] px-2.5 py-0.5 text-[11px] font-bold',
        activo ? 'bg-fila-reparado-bg text-fila-reparado-ico' : 'bg-fila-cancelado-bg text-fila-cancelado-text',
      )}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}
