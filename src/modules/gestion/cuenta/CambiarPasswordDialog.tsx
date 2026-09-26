import { useState, type ReactNode } from 'react'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Button } from '@/shared/ui/button'
import { CampoPassword } from '@/shared/ui/CampoPassword'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { useCambiarPassword } from './api'
import { MSG_EXITO, TITULO_EXITO, validarCambioPassword } from './validacion'

type Props = { abierto: boolean; onCerrar: () => void }

/** Campo de CambiarPasswordView.fxml (:24-105): fondo blanco, borde #D4D8DE, radio 8, padding 13 44 13 14 (44 a la derecha
 *  para el ojo), 13 px, texto #2C3B54, prompt #A0A8B4: los del login, que CampoPassword ya pinta con el ojo a la derecha. */
const CLASE_CAMPO =
  'h-auto rounded-lg border-borde-input bg-superficie py-[13px] pr-11 pl-3.5 text-[13px] md:text-[13px] text-azul-medio placeholder:text-texto-suave'

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-etiqueta-password">{etiqueta}</span>
      {children}
    </div>
  )
}

/** "Cambiar contraseña" (spec §6.3, G6): diálogo de 380 px sobre la vista actual, sin el marco de DialogoAlmacen: barra
 *  navy con el título y cuerpo blanco. No se cierra mientras responde (el JavaFX congela la ventana en la llamada). */
export function CambiarPasswordDialog({ abierto, onCerrar }: Props) {
  const cambiar = useCambiarPassword()
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o && !cambiar.isPending) onCerrar() }}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        // El Stage modal del JavaFX no se cierra pulsando fuera: quedan Esc y "Cancelar".
        onInteractOutside={(e) => e.preventDefault()}
        className="w-[380px] max-w-[min(380px,calc(100%-2rem))] gap-0 overflow-hidden border-0 bg-superficie p-0"
      >
        <div className="bg-azul-noche px-5 py-4">
          <DialogTitle className="text-[15px] leading-normal font-bold text-white">Cambiar contraseña</DialogTitle>
        </div>
        {/* Hijo de DialogContent: Radix lo desmonta al cerrar, así que cada apertura empieza con los campos vacíos. */}
        <Cuerpo cambiar={cambiar} onCerrar={onCerrar} />
      </DialogContent>
    </Dialog>
  )
}

function Cuerpo({ cambiar, onCerrar }: { cambiar: ReturnType<typeof useCambiarPassword>; onCerrar: () => void }) {
  const { mostrarAviso } = useAlerta()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const enviando = cambiar.isPending

  /** Calco de `guardar` (:78-110): oculta el error, valida sin trim, envía y, con éxito, cierra y avisa. Un error deja
   *  los campos como estaban. 401 y conexión los lleva la política global (sesión caducada, banner y diálogo de
   *  conexión del MutationCache): no se repiten en la línea. */
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
          onCerrar()
          mostrarAviso(TITULO_EXITO, MSG_EXITO)
        },
        onError: (e) => {
          if (!esErrorGestionadoGlobalmente(e)) setError(mensajeDeError(e))
        },
      },
    )
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); guardar() }} className="flex flex-col gap-4 bg-superficie p-6">
      <Campo etiqueta="Contraseña actual">
        <CampoPassword valor={actual} onChange={setActual} placeholder="Contraseña actual" aria-label="Contraseña actual" autoComplete="current-password" autoFocus className={CLASE_CAMPO} />
      </Campo>
      <Campo etiqueta="Nueva contraseña">
        <CampoPassword valor={nueva} onChange={setNueva} placeholder="Nueva contraseña" aria-label="Nueva contraseña" autoComplete="new-password" className={CLASE_CAMPO} />
      </Campo>
      <Campo etiqueta="Confirmar nueva contraseña">
        {/* Placeholder "Confirmar contraseña", distinto de su etiqueta: calco (CambiarPasswordView.fxml :84, :89). */}
        <CampoPassword valor={confirmar} onChange={setConfirmar} placeholder="Confirmar contraseña" aria-label="Confirmar nueva contraseña" autoComplete="new-password" className={CLASE_CAMPO} />
      </Campo>
      {error !== null && <p role="alert" className="text-[12px] text-error-password">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={enviando}
          onClick={onCerrar}
          className="h-auto rounded-md border-fila-sep bg-superficie px-[18px] py-2 text-[13px] font-normal text-azul-medio shadow-none hover:bg-superficie"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando} className="h-auto rounded-md bg-azul-noche px-[18px] py-2 text-[13px] font-bold text-white hover:bg-azul-noche-hover">
          Guardar
        </Button>
      </div>
    </form>
  )
}
