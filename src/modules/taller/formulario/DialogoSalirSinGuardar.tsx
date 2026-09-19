import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'

/** Calco del ConfirmDialog que la referencia abre al cerrar la edición con cambios: caja de 400 px, título rojo con ✕
 *  (equivale a "Cancelar"), acción destructiva arriba y "Cancelar" debajo, sin cuenta atrás. ConfirmDialog ya cumple
 *  medidas y colores de la ficha. */
export function DialogoSalirSinGuardar({ abierto, onSalir, onCancelar }: { abierto: boolean; onSalir: () => void; onCancelar: () => void }) {
  return (
    <ConfirmDialog
      abierto={abierto}
      titulo="Salir sin guardar"
      descripcion="Tienes cambios sin guardar que se perderán si cierras el formulario."
      textoAccion="Salir sin guardar"
      onConfirmar={onSalir}
      onCancelar={onCancelar}
    />
  )
}
