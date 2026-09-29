import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useCambiarPassword } from '@/modules/gestion/cuenta/api'
import { validarCambioPassword } from '@/modules/gestion/cuenta/validacion'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useCerrojoEnvio } from '@/shared/lib/useCerrojoEnvio'
import { useSession } from '@/shared/session/SessionProvider'
import { VigilanciaInactividad } from '@/shared/session/VigilanciaInactividad'
import { Button } from '@/shared/ui/button'
import { CampoPassword } from '@/shared/ui/CampoPassword'

/** Los mismos campos que el diálogo del menú de usuario (CambiarPasswordView.fxml :24-105), sobre el fondo del login. */
const CLASE_CAMPO =
  'h-auto rounded-lg border-borde-input bg-superficie py-[13px] pr-11 pl-3.5 text-[13px] md:text-[13px] text-azul-medio placeholder:text-texto-suave'

export const TITULO = 'Cambia tu contraseña'
export const EXPLICACION =
  'Has entrado con una contraseña temporal que te ha entregado el administrador. Elige una contraseña propia para seguir: es la que quedará asociada a tu nombre en el registro de actividad.'

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-[11px] font-bold text-etiqueta-password">{etiqueta}</span>
      {children}
    </div>
  )
}

/**
 * Cambio obligatorio de la contraseña temporal (spec sp7b §5.4, D10). Vive dentro de `RequireSesion` pero fuera de
 * `AppLayout`: es la única pantalla que la sesión puede ver mientras la marca esté puesta, así que no lleva navegación ni
 * ninguna salida (`RequireSesion` devuelve aquí cualquier otra ruta). Comparte validaciones, textos y llamada con el
 * diálogo del menú de usuario; la contraseña temporal no se guarda en ninguna parte, solo viaja en este formulario.
 */
export function CambioObligatorioPage() {
  const { olvidarPasswordTemporal } = useSession()
  const navigate = useNavigate()
  const cambiar = useCambiarPassword()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const enviando = cambiar.isPending
  // Cerrojo síncrono: `isPending` llega tarde y un doble clic en Guardar enviaría dos veces.
  const enviar = useCerrojoEnvio({ abierto: true, enviando, error })

  /** Igual que el diálogo del menú de usuario: valida sin trim, envía y deja el error en la línea. Con éxito, la sesión
   *  deja de estar retenida y la aplicación se abre; un error deja los campos como estaban. El 401 y el corte de conexión
   *  los lleva la política global (sesión caducada, banner y diálogo del MutationCache). */
  const guardar = () => {
    if (enviando) return
    setError(null)
    const fallo = validarCambioPassword(actual, nueva, confirmar)
    if (fallo !== null) {
      setError(fallo)
      return
    }
    cambiar.mutate(
      { passwordActual: actual, passwordNueva: nueva },
      {
        onSuccess: () => {
          olvidarPasswordTemporal()
          navigate('/', { replace: true })
        },
        onError: (e) => {
          if (!esErrorGestionadoGlobalmente(e)) setError(mensajeDeError(e))
        },
      },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo-login px-4 py-10">
      {/* Esta pantalla queda fuera de AppLayout, que es donde vive la vigilancia: se monta aqui tambien para que
          quedarse en ella no deje la sesion abierta para siempre en un PC compartido (spec sp7b 6.1). */}
      <VigilanciaInactividad />
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); enviar(guardar) }}
        className="flex w-full max-w-[380px] flex-col items-center gap-4 rounded-lg bg-superficie p-6"
      >
        <img src="/logo_inicio_sesion.png" alt="" className="h-[46px] w-[46px] object-contain" />
        <h1 className="text-[18px] font-bold text-azul-medio">{TITULO}</h1>
        <p className="text-center text-[12px] leading-relaxed text-azul-gris">{EXPLICACION}</p>
        <Campo etiqueta="Contraseña actual">
          <CampoPassword valor={actual} onChange={setActual} placeholder="Contraseña actual" aria-label="Contraseña actual" autoComplete="current-password" autoFocus className={CLASE_CAMPO} />
        </Campo>
        <Campo etiqueta="Nueva contraseña">
          <CampoPassword valor={nueva} onChange={setNueva} placeholder="Nueva contraseña" aria-label="Nueva contraseña" autoComplete="new-password" className={CLASE_CAMPO} />
        </Campo>
        <Campo etiqueta="Confirmar nueva contraseña">
          <CampoPassword valor={confirmar} onChange={setConfirmar} placeholder="Confirmar contraseña" aria-label="Confirmar nueva contraseña" autoComplete="new-password" className={CLASE_CAMPO} />
        </Campo>
        {/* Ocupa su hueco aunque esté vacía, para que la línea de error no mueva el botón al aparecer. */}
        <p role="alert" className="min-h-4 w-full text-[12px] text-error-password">
          {error ?? ''}
        </p>
        <Button type="submit" disabled={enviando} className="h-auto w-full rounded-3xl bg-azul-noche py-3 text-[13px] font-bold text-crema hover:bg-azul-noche-hover">
          Guardar
        </Button>
      </form>
    </div>
  )
}
