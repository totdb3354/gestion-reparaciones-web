import { useNavigate } from 'react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { useSession } from '@/app/session/SessionProvider'
import { esAdmin } from '@/app/session/storage'
import { useExportable } from './exportable'

export function UserMenu() {
  const { sesion, logout } = useSession()
  const navigate = useNavigate()
  const exportar = useExportable()
  if (!sesion) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-white/8">
        <img src="/user.png" alt="" className="h-7 w-7" />
        <span className="text-[12px] font-bold text-crema">Hola, {sesion.nombreUsuario}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {esAdmin(sesion) && (
          <>
            <DropdownMenuItem onSelect={() => navigate('/gestion/tecnicos')}>Gestionar técnicos</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/gestion/logs')}>Ver logs</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem disabled={!exportar} onSelect={() => exportar?.()}>Descargar CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/cuenta/cambiar-password')}>Cambiar contraseña</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { logout(); navigate('/login', { replace: true }) }}>Cerrar Sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
