import { NavLink } from 'react-router'
import { IndicadorNsys } from '@/modules/telefonos/IndicadorNsys'
import { Campana } from '@/modules/taller/notificaciones/Campana'
import { BotonPanelCarga } from '@/modules/taller/asignaciones/panel/BotonPanelCarga'
import { APP_VERSION } from '@/shared/lib/version'
import { UserMenu } from './UserMenu'

/** Barra superior navy de 64 px (calco de la navbar de MainView.fxml): logo, título con la versión, campana y usuario. Desde
 *  la 0.9.14 (spec «Navegación por grupos») ya no lleva los botones de sección: toda la navegación va en la columna.
 *  Desde la 0.9.18, el aviso «NSYS sin datos» para el supertécnico y el admin.
 *  Desde la 0.9.20, el botón «Carga» del panel de carga de técnicos. */
export function TopBar() {
  return (
    <header className="flex h-navbar items-center gap-2.5 bg-azul-noche px-5">
      <NavLink to="/" className="rounded-lg px-2 py-1.5 hover:bg-white/8">
        <img src="/logoNavBar.png" alt="Inicio" className="h-[38px]" />
      </NavLink>
      <span className="text-[13px] font-bold text-crema">FSGR:</span>
      <span className="hidden text-[13px] text-crema md:inline">Gestión de Stock y Reparaciones V.{APP_VERSION}</span>
      <div className="flex-1" />
      <IndicadorNsys />
      <BotonPanelCarga />
      <Campana />
      <UserMenu />
    </header>
  )
}
