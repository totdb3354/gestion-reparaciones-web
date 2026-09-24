import { Link, NavLink, useLocation } from 'react-router'
import { ultimaRutaStock } from '@/modules/almacen/estado'
import { Campana } from '@/modules/taller/notificaciones/Campana'
import { APP_VERSION } from '@/shared/lib/version'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { UserMenu } from './UserMenu'

const NAV = [
  { to: '/reparaciones', label: 'Reparaciones' },
  { to: '/stock', label: 'Stock' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/clientes', label: 'Clientes' },
]

/** Calco de la navbar de MainView.fxml: navy 64 px, logo, título, 4 botones tipo píldora, usuario. */
export function TopBar() {
  const { pathname } = useLocation()
  const [rutaStock] = useStore(ultimaRutaStock)
  return (
    <header className="flex h-navbar items-center gap-2.5 bg-azul-noche px-5">
      <NavLink to="/" className="rounded-lg px-2 py-1.5 hover:bg-white/8">
        <img src="/logoNavBar.png" alt="Inicio" className="h-[38px]" />
      </NavLink>
      <span className="text-[13px] font-bold text-crema">FSGR:</span>
      <span className="hidden text-[13px] text-crema md:inline">Gestión de Stock y Reparaciones V.{APP_VERSION}</span>
      <nav className="ml-2 flex items-center gap-0.5 rounded-3xl bg-nav-switch p-[3px]">
        {NAV.map((n) => {
          // Activo en la sección y en sus subrutas (/stock/*), aunque el enlace de Stock apunte a otra pestaña.
          const activo = pathname === n.to || pathname.startsWith(`${n.to}/`)
          return (
            <Link
              key={n.to}
              // "Stock" vuelve a la última pestaña visitada (caché de vista del JavaFX, S2), no siempre a Stock actual.
              to={n.to === '/stock' ? rutaStock : n.to}
              aria-current={activo ? 'page' : undefined}
              className={cn(
                'rounded-[20px] px-4 py-1.5 text-[12px] font-bold',
                activo ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-azul-medio/8',
              )}
            >
              {n.label}
            </Link>
          )
        })}
      </nav>
      <div className="flex-1" />
      <Campana />
      <UserMenu />
    </header>
  )
}
