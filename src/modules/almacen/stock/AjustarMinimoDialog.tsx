import { useLayoutEffect, useState } from 'react'
import type { Componente } from '@/shared/api/client'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useErrorServidor } from '../ui/useErrorServidor'
import { parseEnteroNoNegativo, subtituloComponente } from './dialogos'

export const MSG_MINIMO_NO_VALIDO = 'Valor no válido (debe ser ≥ 0).'

type Props = { componente: Componente | null; enviando: boolean; errorServidor?: string | null; onConfirmar: (stockMinimo: number) => void; onCancelar: () => void }

/** El TextInputDialog nativo de ajustarMinimo (:684-699) pasa al diálogo propio con el mismo estilo que Editar stock
 *  (spec 4a §6 y S5, decisión 6): título "Ajustar mínimo" (en vez del título de ventana "Stock mínimo") y subtítulo
 *  "Componente: <tipo>   ·   Stock actual: <stock> ud(s).". Se conservan "Nuevo stock mínimo:" y el campo precargado con el
 *  mínimo. Diferencia: el error se muestra inline y el diálogo sigue abierto (el JavaFX cerraba y avisaba con un Alert). */
export function AjustarMinimoDialog({ componente, enviando, errorServidor, onConfirmar, onCancelar }: Props) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const servidor = useErrorServidor(errorServidor)
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el campo al abrir con otro componente
    if (componente) { setTexto(String(componente.stockMinimo)); setError(null) }
  }, [componente])
  function confirmar() {
    const n = parseEnteroNoNegativo(texto)
    if (n === null) { setError(MSG_MINIMO_NO_VALIDO); return }
    setError(null)
    onConfirmar(n)
  }
  return (
    <DialogoAlmacen abierto={componente !== null} titulo="Ajustar mínimo" subtitulo={componente ? subtituloComponente(componente) : undefined} error={error ?? servidor.error} textoAccion="Confirmar" enviando={enviando} onConfirmar={confirmar} onCancelar={onCancelar}>
      <Label htmlFor="ajustar-minimo-valor" className="text-[12px] font-bold text-azul-gris">Nuevo stock mínimo:</Label>
      <Input id="ajustar-minimo-valor" value={texto} onChange={(e) => { setTexto(e.target.value); servidor.ocultar() }} autoFocus className="bg-superficie text-[13px] text-azul-medio" />
    </DialogoAlmacen>
  )
}
