import { BotonPrimario } from '@/shared/ui/Botones'
import { textoBotonGuardar, zonaGuardarVisible, type EstadoFormulario } from './estado'

/** Zona pegada al fondo con el único botón navy. Se muestra u oculta ENTERA (`zonaGuardarVisible`); el botón nunca se deshabilita:
 *  mientras un guardado está en curso, quien recibe `onPulsar` ignora el clic. whitespace-pre conserva el doble espacio de
 *  "✓  Confirmar terminar". */
export function ZonaGuardar({ estado, onPulsar }: { estado: EstadoFormulario; onPulsar: () => void }) {
  if (!zonaGuardarVisible(estado)) return null
  return (
    <div data-testid="zona-guardar" className="flex justify-end border-t border-form-zona-brd bg-form-zona-bg px-4 py-3">
      <BotonPrimario onClick={onPulsar} className="whitespace-pre">{textoBotonGuardar(estado)}</BotonPrimario>
    </div>
  )
}
