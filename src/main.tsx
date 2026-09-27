import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import '@/shared/styles/globals.css'
import { router } from '@/app/router'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { onSesionExpirada } from '@/shared/session/expiracion'
import { borrarSesion } from '@/shared/session/storage'
import { MSG_SESION_EXPIRADA_UI } from '@/app/session/mensajes'
import { crearQueryClient } from '@/shared/api/queryClient'
import { AlertaProvider } from '@/shared/ui/AlertaProvider'

const queryClient = crearQueryClient()

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
        <AlertaProvider>
          <RouterProvider router={router} />
        </AlertaProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)
