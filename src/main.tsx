import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import '@/shared/styles/globals.css'
import { router } from '@/app/router'
import { SessionProvider } from '@/shared/session/SessionProvider'
import { comprobarSesionAlArrancar } from '@/shared/session/arranque'
import { onSesionExpirada } from '@/shared/session/expiracion'
import { borrarSesion } from '@/shared/session/storage'
import { MSG_SESION_EXPIRADA_UI } from '@/app/session/mensajes'
import { crearQueryClient } from '@/shared/api/queryClient'
import { AlertaProvider } from '@/shared/ui/AlertaProvider'

// Arranque asíncrono: la comprobación de la sesión (cerrojo de pestaña y señal de actividad) se espera ANTES de crear el
// QueryClient y la raíz de React; hasta entonces no se pinta nada ni sale ninguna petición, y nadie lee la sesión.
async function iniciar() {
  await comprobarSesionAlArrancar()

  const queryClient = crearQueryClient()

  // 401 con sesión: se borra la sesión (en todas las pestañas: vive en localStorage) y se recarga la app en /login con el
  // mensaje (equivale a volver al login del JavaFX, que descarta las vistas cacheadas). LoginPage lee y borra
  // 'fsgr.mensajeLogin', que es de esta pestaña (sessionStorage).
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
}

void iniciar()
