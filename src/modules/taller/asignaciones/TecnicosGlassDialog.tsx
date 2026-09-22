import { useEffect, useLayoutEffect, useState } from 'react'
import { mensajeDeError } from '@/shared/api/errors'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useTecnicos } from '../api'
import { useMarcarTecnicoGlass } from './api'
import { cambiosGlass } from './tecnicosGlass'

type Props = {
  abierto: boolean
  /** ADMIN: los checks no se pueden tocar y el único botón es "Cerrar" (spec 3a §12). */
  soloLectura: boolean
  onCerrar: () => void
  /** Aviso de ventana abierta/cerrada: congela el sondeo de la tabla (spec 3a, D4). La Task 16 lo conecta. */
  onInteraccion: (abierta: boolean) => void
}

/** Literales del JavaFX (`abrirTecnicosGlass`): título, cabecera y la nota que explica la regla. */
const SUBTITULO = 'A quién se le asigna la glass automáticamente'
const NOTA =
  'Al marcar «Lleva glass» en una reparación, la glass va al técnico marcado aquí con menos carga hoy '
  + '(cuentan sus reparaciones y sus glass). Si no hay ninguno, la glass queda pendiente para asignarla a mano.'

/**
 * Diálogo "Técnicos de glass": un check por técnico activo con su `esGlass` actual, y al aceptar SOLO se mandan
 * los cambios (calco del JavaFX). Si alguna llamada falla el diálogo no se cierra, para que el usuario vea qué
 * pasó y pueda reintentar.
 *
 * Los checks se pintan desde `useTecnicos(true)` —la misma consulta que ya usa la vista, así que no cuesta una
 * petición extra— con encima lo que el usuario haya tocado. Esa capa es la clave de qué se ve tras un fallo
 * parcial: al fallar algo se descarta lo tocado y los checks vuelven a enseñar la lista del servidor, ya
 * recargada. Así un técnico marcado que no se llegó a guardar aparece desmarcado, que es la verdad, en vez de
 * quedarse marcado aparentando un cambio que no existe.
 */
export function TecnicosGlassDialog({ abierto, soloLectura, onCerrar, onInteraccion }: Props) {
  const { data: tecnicos = [] } = useTecnicos(true)
  const marcar = useMarcarTecnicoGlass()
  /** Solo los técnicos que el usuario ha tocado; del resto manda el `esGlass` del servidor. */
  const [marcados, setMarcados] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [abierto, onInteraccion])

  useLayoutEffect(() => {
    if (!abierto) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cada apertura arranca del estado del servidor, como el diálogo nuevo del JavaFX (patrón de CargaTecnicosDialog)
    setMarcados({})
    setError(null)
  }, [abierto])

  const aceptar = async () => {
    const cambios = cambiosGlass(tecnicos, marcados)
    // Sin diferencias no sale ninguna petición: aceptar sin tocar nada es cerrar.
    if (cambios.length === 0) {
      onCerrar()
      return
    }
    setError(null)
    setGuardando(true)
    // allSettled y no all: una que falle no debe dejar sin intentar a las demás (ni sus rechazos sin observar).
    const resultados = await Promise.allSettled(cambios.map((c) => marcar.mutateAsync(c)))
    setGuardando(false)
    const fallo = resultados.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (!fallo) {
      onCerrar()
      return
    }
    // Se descarta lo tocado para que los checks vuelvan a la lista del servidor, que `onSettled` ya está
    // recargando: lo que se guardó se ve guardado y lo que no, sin guardar.
    setMarcados({})
    setError(`No se pudo guardar: ${mensajeDeError(fallo.reason)}`)
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-[420px] gap-3 bg-superficie p-4">
        <DialogHeader>
          <DialogTitle className="text-[14px] font-bold text-azul-medio">Técnicos de glass</DialogTitle>
          <DialogDescription className="text-[13px] text-azul-medio">{SUBTITULO}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
          {tecnicos.map((t) => {
            const id = `tecnico-glass-${t.idTec}`
            return (
              <label key={t.idTec} htmlFor={id} className="flex w-fit items-center gap-2 text-[13px] text-azul-medio">
                <Checkbox
                  id={id}
                  aria-label={t.nombre}
                  disabled={soloLectura}
                  checked={marcados[t.idTec] ?? t.esGlass}
                  onCheckedChange={(v) => setMarcados((m) => ({ ...m, [t.idTec]: v === true }))}
                />
                {t.nombre}
              </label>
            )
          })}
        </div>
        <p className="text-[11px] text-texto-sub">{NOTA}</p>
        {error !== null && <p role="alert" className="text-[12px] text-texto-error">{error}</p>}
        <DialogFooter>
          {soloLectura ? (
            <BotonSecundario onClick={onCerrar}>Cerrar</BotonSecundario>
          ) : (
            <>
              <BotonSecundario onClick={onCerrar}>Cancelar</BotonSecundario>
              {/* `guardando` es local y no `marcar.isPending`: con varias mutaciones a la vez sobre el mismo hook,
                  `isPending` sigue a la última y dejaría el botón pulsable con otras aún en vuelo. */}
              <BotonPrimario disabled={guardando} onClick={() => void aceptar()}>Aceptar</BotonPrimario>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
