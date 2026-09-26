import type { ColumnDef } from '@tanstack/react-table'
import type { Usuario } from '@/shared/api/client'
import { BadgeEstadoUsuario } from './BadgeEstadoUsuario'
import { TOOLTIP_ACTIVAR, TOOLTIP_DESACTIVAR } from './textos'

/** prefWidth de RegisterView.fxml :105-109. La de acciones es la última (80): en el JavaFX absorbe el sobrante
 *  (CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN); aquí lo que sobra queda en la columna de relleno del DataTable. */
export const ANCHOS_TECNICOS = { tecnico: 160, usuario: 130, rol: 110, estado: 90, acciones: 80 } as const

type Acciones = { onToggle: (u: Usuario) => void; onEliminar: (u: Usuario) => void }

/** Columnas de "Técnicos registrados" (RegisterController.configurarTabla :97-186). El rol va tal cual (TECNICO /
 *  SUPERTECNICO). Acciones (:138-182): candado transparente de 18 px (abierto = tiene acceso) con tooltip, 4 px y la
 *  papelera de 22 px sin tooltip, en todas las filas (el filtro "tiene reparaciones" se hace al pulsar). El clic también
 *  selecciona la fila, como en el JavaFX. */
export function columnasTecnicos({ onToggle, onEliminar }: Acciones): ColumnDef<Usuario>[] {
  return [
    { id: 'tecnico', header: 'Técnico', size: ANCHOS_TECNICOS.tecnico, accessorFn: (u) => u.nombreTecnico },
    { id: 'usuario', header: 'Usuario', size: ANCHOS_TECNICOS.usuario, accessorFn: (u) => u.nombreUsuario },
    { id: 'rol', header: 'Rol', size: ANCHOS_TECNICOS.rol, accessorFn: (u) => u.rol },
    { id: 'estado', header: 'Estado', size: ANCHOS_TECNICOS.estado, cell: ({ row }) => <BadgeEstadoUsuario activo={row.original.activo} /> },
    {
      id: 'acciones',
      header: '',
      size: ANCHOS_TECNICOS.acciones,
      cell: ({ row }) => {
        const u = row.original
        const tooltip = u.activo ? TOOLTIP_DESACTIVAR : TOOLTIP_ACTIVAR
        return (
          <div className="flex items-center justify-center gap-1">
            <button type="button" aria-label={tooltip} title={tooltip} onClick={() => onToggle(u)} className="cursor-pointer px-1.5 py-1">
              <img src={u.activo ? '/Unlock.png' : '/Lock.png'} alt="" className="h-[18px] w-[18px]" />
            </button>
            <button type="button" aria-label="Eliminar" onClick={() => onEliminar(u)} className="cursor-pointer">
              <img src="/borrar.png" alt="" className="h-[22px] w-[22px]" />
            </button>
          </div>
        )
      },
    },
  ]
}
