import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import '@/shared/styles/globals.css'
import { router } from '@/app/router'
import { SessionProvider } from '@/app/session/SessionProvider'
import { onSesionExpirada } from '@/app/session/expiracion'
import { borrarSesion } from '@/app/session/storage'
import { MSG_SESION_EXPIRADA_UI } from '@/app/session/mensajes'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: 0 } },
})

// 401 con sesión: se borra la sesión y se recarga la app en /login con el mensaje (equivale a volver al
// login del JavaFX, que descarta las vistas cacheadas). LoginPage lee y borra 'fsgr.mensajeLogin'.
onSesionExpirada(() => {
  borrarSesion()
  sessionStorage.setItem('fsgr.mensajeLogin', MSG_SESION_EXPIRADA_UI)
  window.location.assign('/login')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
