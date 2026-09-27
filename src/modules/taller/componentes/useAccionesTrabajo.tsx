import { useState, type ReactNode } from 'react'
import type { ReparacionResumen } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { referenciadora, useAnadirIncidencia, useBorrarReparacion, useCancelarIncidencia } from '../api'
import { DialogoIncidencia } from './DialogoIncidencia'
import type { AccionesHistorial } from './MenuHistorial'

const OPERACION_INCIDENCIA = 'incidencia'

export const TITULOS_BORRAR = { historial: 'Borrar reparación', trabajo: 'Borrar trabajo' } as const

export function descripcionBorrado(idRep: string): string {
  return `Se borrará ${idRep}. Los componentes usados volverán a stock y, si resolvía una incidencia, esta quedará activa de nuevo. Escribe el motivo.`
}

type Opciones = {
  /** Título y texto del botón del diálogo de borrado: "Borrar reparación" (Historial) o "Borrar trabajo" (detalle de IMEIs) */
  tituloBorrar: string
  /** Primera frase del aviso de referencia: "Esta reparación está siendo referenciada" o "Este trabajo está siendo referenciado" */
  avisoReferencia: string
}

/** Acciones del menú de un trabajo del historial y sus diálogos, compartidas por HistorialPage e ImeiDetallePage:
 *  borrar (comprobación de referencia → aviso "No se puede borrar", o ConfirmDialog con motivo → DELETE),
 *  añadir incidencia (DialogoIncidencia → POST; "No se pudo guardar: <msg>" si falla) y cancelar incidencia (ConfirmDialog → DELETE). */
export function useAccionesTrabajo({ tituloBorrar, avisoReferencia }: Opciones): { acciones: Omit<AccionesHistorial, 'editar'>; dialogos: ReactNode } {
  const { mostrarError, mostrarAviso } = useAlerta()
  const [aBorrar, setABorrar] = useState<ReparacionResumen | null>(null)
  const [aCancelar, setACancelar] = useState<ReparacionResumen | null>(null)
  const [conIncidencia, setConIncidencia] = useState<ReparacionResumen | null>(null)
  const borrar = useBorrarReparacion()
  const anadir = useAnadirIncidencia()
  // Clave de reintento de "Añadir incidencia": la misma mientras el cuerpo (con el idRep) no cambie; nueva tras guardar bien.
  const [claves] = useState(() => crearClavesIdempotencia())
  const cancelar = useCancelarIncidencia()

  async function pedirBorrado(rep: ReparacionResumen) {
    try {
      const ref = await referenciadora(rep.idRep)
      if (ref) {
        mostrarAviso('No se puede borrar', `${avisoReferencia}. La reparación ${ref} apunta a esta. Bórrala primero.`)
        return
      }
      setABorrar(rep)
    } catch (e) {
      if (!esErrorGestionadoGlobalmente(e)) mostrarError(mensajeDeError(e))
    }
  }

  const acciones: Omit<AccionesHistorial, 'editar'> = { borrar: (r) => void pedirBorrado(r), anadirIncidencia: setConIncidencia, cancelarIncidencia: setACancelar }
  const dialogos = (
    <>
      <ConfirmDialog abierto={aBorrar !== null} conMotivo titulo={tituloBorrar} descripcion={aBorrar ? descripcionBorrado(aBorrar.idRep) : ''} textoAccion={tituloBorrar}
        onCancelar={() => setABorrar(null)} onConfirmar={(motivo) => { if (aBorrar && motivo) borrar.mutate({ idRep: aBorrar.idRep, motivo }); setABorrar(null) }} />
      <ConfirmDialog abierto={aCancelar !== null} titulo="Borrar incidencia" descripcion="Esta acción solo es válida si fue un error al añadirla." textoAccion="Borrar incidencia"
        onCancelar={() => setACancelar(null)} onConfirmar={() => { if (aCancelar) cancelar.mutate(aCancelar.idRep); setACancelar(null) }} />
      {/* Se cierra solo cuando el POST sale bien; si falla, el diálogo sigue abierto con lo escrito (calco del JavaFX). */}
      <DialogoIncidencia rep={conIncidencia} enviando={anadir.isPending} onCerrar={() => setConIncidencia(null)}
        onGuardar={(comentario, idTec) => {
          if (!conIncidencia) return
          const rep = conIncidencia
          const cuerpo = { idRep: rep.idRep, comentario, imei: rep.imei, idTec }
          anadir.mutate({ ...cuerpo, clave: claves.para(OPERACION_INCIDENCIA, cuerpo) }, {
            onSuccess: () => { claves.hecha(OPERACION_INCIDENCIA); setConIncidencia(null) },
            onError: (e) => { if (!esErrorGestionadoGlobalmente(e)) mostrarError(`No se pudo guardar: ${mensajeDeError(e)}`) },
          })
        }} />
    </>
  )
  return { acciones, dialogos }
}
