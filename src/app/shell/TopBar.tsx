import { NavLink } from 'react-router'
import { APP_VERSION } from '@/shared/lib/version'
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
  return (
    <header className="flex h-navbar items-center gap-2.5 bg-azul-noche px-5">
      <NavLink to="/" className="rounded-lg px-2 py-1.5 hover:bg-white/8">
        <img src="/logoNavBar.png" alt="Inicio" className="h-[38px]" />
      </NavLink>
      <span className="text-[13px] font-bold text-crema">FSGR:</span>
      <span className="hidden text-[13px] text-crema md:inline">Gestión de Stock y Reparaciones V.{APP_VERSION}</span>
      <nav className="ml-2 flex items-center gap-0.5 rounded-3xl bg-nav-switch p-[3px]">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cn(
                'rounded-[20px] px-4 py-1.5 text-[12px] font-bold',
                isActive ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-azul-medio/8',
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1" />
      {/* Campana de solicitudes (solo SUPERTECNICO): llega con el sub-proyecto 2 */}
      <UserMenu />
    </header>
  )
}
