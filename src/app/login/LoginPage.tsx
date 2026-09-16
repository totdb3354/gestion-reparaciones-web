import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { APP_VERSION } from '@/shared/lib/version'
import { useSession } from '@/shared/session/SessionProvider'

const inputCls =
  'h-auto rounded-lg border-borde-input bg-superficie px-3.5 py-3 text-[13px] md:text-[13px] text-azul-medio placeholder:text-texto-suave'

export function LoginPage() {
  const { login } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  // Mensaje pendiente (sesión expirada, dejado por main.tsx antes de recargar) o de una navegación interna.
  const [error, setError] = useState<string | null>(
    () => sessionStorage.getItem('fsgr.mensajeLogin') ?? (location.state as { mensaje?: string } | null)?.mensaje ?? null,
  )
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    sessionStorage.removeItem('fsgr.mensajeLogin')
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (usuario.trim() === '' || password === '') {
      setError('Introduce usuario y contraseña.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await login(usuario.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo-login px-4">
      <form onSubmit={onSubmit} className="flex w-full max-w-[340px] flex-col items-center" noValidate>
        <img src="/logo_inicio_sesion.png" alt="" className="mb-3.5 h-[58px] w-[58px]" />
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[22px] font-bold text-azul-medio">FSGR</span>
          <span className="pt-1 text-[11px] text-texto-suave">v{APP_VERSION}</span>
        </div>
        <div className="mb-8 text-center text-[20px] leading-tight text-azul-medio">
          <div>Gestión de Stock y</div>
          <div>Reparaciones</div>
        </div>
        <Input className={`mb-2.5 ${inputCls}`} placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus autoComplete="username" />
        <div className="relative mb-1.5 w-full">
          <Input
            className={`pr-11 ${inputCls}`}
            placeholder="Contraseña"
            type={verPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setVerPassword((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
          >
            <img src={verPassword ? '/ojo_desactivar.png' : '/ojo_activar.png'} alt="" className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className={`mb-2.5 w-full text-[11px] text-texto-error ${error ? '' : 'invisible'}`} role="alert">
          {error ?? ' '}
        </p>
        <Button
          type="submit"
          disabled={enviando}
          className="mt-4.5 mb-3.5 h-auto w-full rounded-3xl bg-azul-noche py-3.5 text-[13px] font-bold text-crema hover:bg-azul-noche-hover"
        >
          Iniciar Sesión
        </Button>
      </form>
    </div>
  )
}
