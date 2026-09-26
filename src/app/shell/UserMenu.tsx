import { useLocation, useNavigate } from 'react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin } from '@/shared/session/storage'
import { useExportable } from '@/shared/ui/exportable'

export function UserMenu() {
  const { sesion, logout } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
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
            <DropdownMenuItem onSelect={() => navigate('/gestion/tecnicos', { state: { volverA: pathname } })}>Gestionar técnicos</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/gestion/logs', { state: { volverA: pathname } })}>Ver logs</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem disabled={!exportar} onSelect={() => exportar?.()}>Descargar CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { /* Task 12: abre CambiarPasswordDialog en el sitio (spec 6, G6) */ }}>Cambiar contraseña</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { logout(); navigate('/login', { replace: true }) }}>Cerrar Sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
