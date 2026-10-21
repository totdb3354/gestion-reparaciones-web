import { BotonPrimario } from '@/shared/ui/Botones'
import { textoBotonGuardar, zonaGuardarVisible, type EstadoFormulario } from './estado'

type Props = { estado: EstadoFormulario; aviso?: string | null; onPulsar: () => void }

/** Zona pegada al fondo con el único botón navy. Se muestra u oculta ENTERA (`zonaGuardarVisible`); el botón nunca se deshabilita:
 *  mientras un guardado está en curso, quien recibe `onPulsar` ignora el clic. whitespace-pre conserva el doble espacio de
 *  "✓  Confirmar terminar". Desde la 0.9.21 (pieza 2 del SKU del taller), encima del botón, una banda fina con lo que el
 *  guardado cambiará en el móvil (`aviso`): no bloquea ni añade clics. */
export function ZonaGuardar({ estado, aviso = null, onPulsar }: Props) {
  if (!zonaGuardarVisible(estado)) return null
  return (
    <div data-testid="zona-guardar" className="flex flex-col items-end gap-2 border-t border-form-zona-brd bg-form-zona-bg px-4 py-3">
      {aviso && (
        <p role="status" data-testid="banda-sku-taller" className="w-full rounded border border-taller bg-taller-bg px-3 py-1.5 text-[12.5px] text-taller-text">
          {aviso}
        </p>
      )}
      <BotonPrimario onClick={onPulsar} className="whitespace-pre">{textoBotonGuardar(estado)}</BotonPrimario>
    </div>
  )
}
