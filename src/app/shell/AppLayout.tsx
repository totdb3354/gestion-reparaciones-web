import { Outlet } from 'react-router'
import { ExportableProvider } from './exportable'
import { TopBar } from './TopBar'
import { ConnectionBanner } from './ConnectionBanner'

export function AppLayout() {
  return (
    <ExportableProvider>
      <div className="flex min-h-screen flex-col bg-fondo-vista">
        <TopBar />
        <ConnectionBanner />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </ExportableProvider>
  )
}
