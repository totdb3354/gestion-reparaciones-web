import { useIsFetching, useIsMutating, type Query } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { FormulariosPedido } from '@/modules/almacen/pedidos/formulario/FormulariosPedido'
import { VigilanciaInactividad } from '@/shared/session/VigilanciaInactividad'
import { CapaCarga } from '@/shared/ui/CapaCarga'
import { AvisoVersion } from '@/shared/version/AvisoVersion'
import { ExportableProvider } from '@/shared/ui/exportable'
import { TopBar } from './TopBar'
import { ConnectionBanner } from './ConnectionBanner'
import { SubNav } from './SubNav'

/** Carga INICIAL de una consulta (`pending`: aún sin datos ni error), no los refrescos de fondo ni los sondeos, que ya tienen
 *  datos. Las consultas marcadas `sinCapa` (sondeos del propio shell: campana y badges del lateral) no cuentan. */
const esCargaInicial = (q: Query) => q.state.status === 'pending' && q.meta?.sinCapa !== true

/** Overlay de carga (CapaCarga) activo mientras alguna vista hace su carga inicial o hay una escritura en curso. */
function useCapaActiva(): boolean {
  const cargando = useIsFetching({ predicate: esCargaInicial }) > 0
  const escribiendo = useIsMutating() > 0
  return cargando || escribiendo
}

export function AppLayout() {
  const capaActiva = useCapaActiva()
  return (
    <ExportableProvider>
      <div aria-busy={capaActiva || undefined} className="flex min-h-screen flex-col bg-fondo-vista">
        <TopBar />
        <ConnectionBanner />
        <div className="flex flex-1">
          <SubNav />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
      {/* Formularios de alta de pedido (P1): modal sobre la vista actual, abierto desde el store compartido. */}
      <FormulariosPedido />
      <CapaCarga activa={capaActiva} />
      {/* Aquí y no en main.tsx: solo existe con sesión abierta, que es justo cuando hay algo que vigilar. */}
      <VigilanciaInactividad />
      <AvisoVersion />
    </ExportableProvider>
  )
}
