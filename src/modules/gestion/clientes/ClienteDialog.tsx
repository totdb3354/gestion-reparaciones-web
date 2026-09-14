import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

type Props = {
  abierto: boolean
  titulo: 'Nuevo cliente' | 'Editar cliente'
  etiqueta: 'Nombre del cliente:' | 'Nombre:'
  valorInicial?: string
  onAceptar: (nombre: string) => void
  onCancelar: () => void
}

/** Calco de los TextInputDialog de ClientesController. Acepta con Enter; nombre recortado; vacío no hace nada. */
export function ClienteDialog({ abierto, titulo, etiqueta, valorInicial = '', onAceptar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(valorInicial)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el campo al reabrir el diálogo con otro valor inicial (patrón "Adjusting state" de React); no hay alternativa sin efecto que no complique el componente
    if (abierto) setNombre(valorInicial)
  }, [abierto, valorInicial])
  function aceptar() {
    const n = nombre.trim()
    if (n === '') return
    onAceptar(n)
  }
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={(e) => { e.preventDefault(); aceptar() }}>
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
          </DialogHeader>
          <div className="my-4 flex items-center gap-3">
            <Label htmlFor="cliente-nombre">{etiqueta}</Label>
            <Input id="cliente-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
            <Button type="submit">Aceptar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
