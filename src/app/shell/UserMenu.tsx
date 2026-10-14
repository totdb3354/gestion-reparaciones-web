import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CambiarPasswordDialog } from '@/modules/gestion/cuenta/CambiarPasswordDialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { useSession } from '@/shared/session/SessionProvider'
import { useExportable } from '@/shared/ui/exportable'

export function UserMenu() {
  const { sesion, logout } = useSession()
  const navigate = useNavigate()
  const exportar = useExportable()
  // "Cambiar contraseña" es un diálogo sobre la vista actual (G6, calco del Stage modal): estado local, sin ruta.
  const [passwordAbierto, setPasswordAbierto] = useState(false)
  if (!sesion) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-white/8">
          <img src="/user.png" alt="" className="h-7 w-7" />
          <span className="text-[12px] font-bold text-crema">Hola, {sesion.nombreUsuario}</span>
        </DropdownMenuTrigger>
        {/* Gestión (Técnicos y Logs) está en la columna desde la 0.9.12. */}
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!exportar} onSelect={() => exportar?.()}>Descargar CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPasswordAbierto(true)}>Cambiar contraseña</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { logout(); navigate('/login', { replace: true }) }}>Cerrar Sesión</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Fuera del DropdownMenu: el menú se cierra al elegir y el diálogo sigue montado. Portal de Radix: no ocupa sitio en
          la barra (la campana y el botón siguen siendo hermanos directos, TopBar.test). */}
      <CambiarPasswordDialog abierto={passwordAbierto} onCerrar={() => setPasswordAbierto(false)} />
    </>
  )
}
