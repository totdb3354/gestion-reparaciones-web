import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

  // `onInteraccion` va por ref y NO en las dependencias del efecto: con el consumidor real (Task 16) un padre que
  // lo pasara como flecha en línea cambiaría su identidad en cada render, el efecto se rearmaría y el aviso
  // parpadearía (false→true por render), descongelando el sondeo a ratos. Con la ref sale UNA vez al abrir y una
  // al cerrar, pase lo que pase con la identidad de la función.
  const avisar = useRef(onInteraccion)
  useLayoutEffect(() => {
    avisar.current = onInteraccion
  })
  useEffect(() => {
    if (!abierto) return
    avisar.current(true)
    return () => avisar.current(false)
  }, [abierto])

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
    // Se descarta lo tocado para que los checks vuelvan a la lista del servidor. En este punto ya ha aterrizado
    // de verdad (no solo se ha disparado): `useMarcarTecnicoGlass` devuelve la promesa de la invalidación en su
    // `onSettled`, así que cada `mutateAsync` no resuelve hasta que el refetch de `useTecnicos` está en la
    // caché, y el `await Promise.allSettled(...)` de más arriba no sigue hasta que TODOS lo están. Lo que se
    // guardó se ve guardado y lo que no, sin guardar; sin ese await se vería el instante con la caché vieja.
    setMarcados({})
    setError(`No se pudo guardar: ${mensajeDeError(fallo.reason)}`)
  }

  return (
    // `!guardando` también aquí: sin él, Escape, el overlay y la X del diálogo cierran igual que si no hubiera
    // guardado en curso, y un PATCH que falle después de cerrado ya no tiene dónde pintar el error (el diálogo
    // global está silenciado a propósito, ver `useMarcarTecnicoGlass`). Es el mismo cierre que ya bloqueaba
    // "Aceptar"; aquí cubre las otras tres puertas de salida.
    <Dialog open={abierto} onOpenChange={(o) => !o && !guardando && onCerrar()}>
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
              {/* Igual que "Aceptar": mientras hay PATCHes en vuelo, "Cancelar" tampoco puede cerrar (mismo motivo
                  que el `onOpenChange` de arriba: un fallo tras el cierre no se vería por ningún sitio). */}
              <BotonSecundario disabled={guardando} onClick={onCerrar}>Cancelar</BotonSecundario>
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
