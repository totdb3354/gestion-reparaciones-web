import { useLayoutEffect, useState } from 'react'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError } from '@/shared/api/errors'
import { cn } from '@/shared/lib/utils'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { DialogoAlmacen } from '../ui/DialogoAlmacen'
import { useGuardarParametrosPrevision, useParametrosPrevision } from './api'
import { AYUDA_PESOS, leerPesos, MSG_PESOS_NO_VALIDOS, sumaPesos } from './prevision'

type Props = { abierto: boolean; onCerrar: () => void }
type Textos = [string, string, string]

const CAMPOS = [
  { id: 'prevision-peso-1', etiqueta: 'Días 1-30 (%)' },
  { id: 'prevision-peso-2', etiqueta: 'Días 31-60 (%)' },
  { id: 'prevision-peso-3', etiqueta: 'Días 61-90 (%)' },
] as const

/**
 * Pesos de la previsión de pedidos (spec 0.9.5 §4.3), solo para el ADMIN. Tres porcentajes enteros que suman 100,
 * la suma en vivo y "Guardar" desactivado mientras no cuadren; el servidor aplica la misma regla y su 422 sale dentro.
 */
export function ParametrosPrevisionDialog({ abierto, onCerrar }: Props) {
  const { mostrarError } = useAlerta()
  const { data } = useParametrosPrevision(abierto)
  const guardar = useGuardarParametrosPrevision()
  const [textos, setTextos] = useState<Textos>(['', '', ''])
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga los campos cuando llegan los pesos guardados
    if (abierto && data) { setTextos([String(data.peso1), String(data.peso2), String(data.peso3)]); setError(null) }
  }, [abierto, data])

  const suma = sumaPesos(textos)
  const pesos = leerPesos(textos)

  function cambiar(i: 0 | 1 | 2, valor: string) {
    const nuevos: Textos = [...textos]
    nuevos[i] = valor
    setTextos(nuevos)
    setError(null)
  }

  function confirmar() {
    if (pesos === null) { setError(MSG_PESOS_NO_VALIDOS); return }
    setError(null)
    guardar.mutate(pesos, {
      onSuccess: onCerrar,
      onError: (e) => {
        if (e instanceof ReglaNegocioError) { setError(e.message); return }
        if (!esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e))
      },
    })
  }

  return (
    <DialogoAlmacen abierto={abierto} titulo="Parámetros de previsión" error={error} textoAccion="Guardar" enviando={guardar.isPending} accionDeshabilitada={pesos === null} onConfirmar={confirmar} onCancelar={onCerrar}>
      {CAMPOS.map((campo, i) => (
        <div key={campo.id} className="flex items-center justify-between gap-3">
          <Label htmlFor={campo.id} className="text-[12px] font-bold text-azul-gris">{campo.etiqueta}</Label>
          <Input id={campo.id} value={textos[i]} inputMode="numeric" onChange={(e) => cambiar(i as 0 | 1 | 2, e.target.value)} className="w-[80px] bg-superficie text-[13px] text-azul-medio" />
        </div>
      ))}
      <p className={cn('text-[12px] font-bold', suma === 100 ? 'text-azul-gris' : 'text-texto-error')}>Suma: {suma ?? '—'} %</p>
      <p className="text-[11px] text-azul-gris">{AYUDA_PESOS}</p>
    </DialogoAlmacen>
  )
}
