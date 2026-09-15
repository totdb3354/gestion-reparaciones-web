import { Outlet } from 'react-router'
import { ExportableProvider } from './exportable'
import { TopBar } from './TopBar'
import { ConnectionBanner } from './ConnectionBanner'
import { SubNav } from './SubNav'

export function AppLayout() {
  return (
    <ExportableProvider>
      <div className="flex min-h-screen flex-col bg-fondo-vista">
        <TopBar />
        <ConnectionBanner />
        <div className="flex flex-1">
          <SubNav />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ExportableProvider>
  )
}
