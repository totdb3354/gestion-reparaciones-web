import { useLayoutEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

type Props = { abierto: boolean; tipo: string; variante: 'sinStock' | 'limite'; stock: number; inicial: string; onConfirmar: (descripcion: string) => void; onCancelar: () => void }

/** Diálogo "Solicitar pieza — <tipo>" (460 px). La cabecera y el botón cambian con la variante; N es el stock del SKU, no el
 *  contador. Confirmar es local: quien lo usa despacha CONFIRMAR_AGOTADO; el servidor no se entera hasta "Terminar asignación". */
export function DialogoSolicitarPieza({ abierto, tipo, variante, stock, inicial, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState(inicial)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga la descripción que hubiera cada vez que se abre
    if (abierto) setTexto(inicial)
  }, [abierto, inicial])
  const lineas =
    variante === 'sinStock'
      ? ['Sin stock disponible.', 'Se creará una solicitud PENDIENTE para que el admin gestione el pedido.']
      : [`Se descontarán ${stock} unidades de stock y quedará una solicitud PENDIENTE.`, 'La asignación permanecerá abierta hasta recibir la pieza.']
  const textoBoton = variante === 'sinStock' ? 'Confirmar: solicitar pieza' : `Confirmar: descontar ${stock} ud. de stock y solicitar`
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent aria-describedby={undefined} className="max-w-[min(460px,calc(100%-2rem))] gap-2 bg-fondo-input p-4 sm:max-w-[min(460px,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-bold text-azul-medio">{`Solicitar pieza — ${tipo}`}</DialogTitle>
        </DialogHeader>
        <div className="text-[13px] text-azul-medio">
          <p>{lineas[0]}</p>
          <p>{lineas[1]}</p>
        </div>
        <textarea
          aria-label="Descripción de la pieza"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Describe la pieza que necesitas (opcional)..."
          rows={4}
          className="w-full resize-none rounded border border-gris-borde bg-superficie p-2 text-[13px]"
        />
        <Button onClick={() => onConfirmar(texto.trim())} className="h-auto w-full rounded bg-ambar py-2 text-[12px] text-superficie hover:bg-ambar/90">
          {textoBoton}
        </Button>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
