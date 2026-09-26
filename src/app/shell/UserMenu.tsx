import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CambiarPasswordDialog } from '@/modules/gestion/cuenta/CambiarPasswordDialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { useTextoGrande } from '@/shared/lib/useTextoGrande'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdmin } from '@/shared/session/storage'
import { useExportable } from '@/shared/ui/exportable'

export function UserMenu() {
  const { sesion, logout } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const exportar = useExportable()
  // "Cambiar contraseña" es un diálogo sobre la vista actual (G6, calco del Stage modal): estado local, sin ruta.
  const [passwordAbierto, setPasswordAbierto] = useState(false)
  // "Texto grande": función nueva de la web (el JavaFX no la tiene), zoom del 115 % guardado en este navegador.
  const [textoGrande, setTextoGrande] = useTextoGrande()
  if (!sesion) return null
  return (
    <>
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
          <DropdownMenuItem onSelect={() => setPasswordAbierto(true)}>Cambiar contraseña</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={textoGrande} onCheckedChange={(v) => setTextoGrande(v === true)}>Texto grande</DropdownMenuCheckboxItem>
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
