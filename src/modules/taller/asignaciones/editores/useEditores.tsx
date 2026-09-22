import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ReparacionResumen } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, StaleDataError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { SelectorLista } from '@/shared/ui/SelectorLista'
import { useClientesActivos, useEditarClienteTelefono, useEditarModeloTelefono } from '../../api'
import { MODELOS_ORDENADOS, traducirModelo } from '../../lib/modelos'
import { CLAVE_ASIGNACIONES_TODAS, useEditarComentario } from '../api'
import { EditorComentario } from './EditorComentario'

/** Mismo texto que el maestro de IMEIs para el 409 del teléfono (calco del JavaFX). No se importa de ImeisPage:
 *  arrastraría la página entera del maestro al trozo de esta vista. */
const MSG_TELEFONO_MODIFICADO = 'El teléfono fue modificado por otro usuario. Se recargan los datos.'
/** La lista de modelos es fija: se construye una vez, no en cada render. */
const OPCIONES_MODELO = MODELOS_ORDENADOS.map((m) => ({ clave: m, etiqueta: traducirModelo(m) }))
const SIN_CLIENTE_CLAVE = ''

/**
 * Los tres editores del menú contextual (spec §10): comentario de la asignación, modelo del teléfono (solo pulido)
 * y cliente del teléfono. Devuelve los tres abridores para el menú y los diálogos para pintarlos, como
 * `useAccionConDeshacer` devuelve `ejecutar` y su `aviso`: así la página queda con una línea por editor.
 *
 * Modelo y cliente no tienen componente propio: son el `SelectorLista` compartido con los dos usos que ya trae
 * (`preseleccionarActual` para el modelo, `textoNada` para el cliente), igual que los compone ImeisPage.
 *
 * OJO: esos dos escriben en el TELÉFONO, no en la asignación. Un IMEI puede tener varias filas en esta tabla (una
 * reparación y su glass, por ejemplo) y todas cambian de golpe, así que al terminar se recarga la lista entera;
 * las mutaciones del teléfono solo invalidan los historiales, que es lo que necesitaba el maestro de IMEIs.
 */
export function useEditores({ onInteraccion }: { onInteraccion: (abierto: boolean) => void }) {
  const [conComentario, setConComentario] = useState<ReparacionResumen | null>(null)
  const [conModelo, setConModelo] = useState<ReparacionResumen | null>(null)
  const [conCliente, setConCliente] = useState<ReparacionResumen | null>(null)
  const { mostrarError } = useAlerta()
  const qc = useQueryClient()
  const { data: clientesActivos = [] } = useClientesActivos()
  const guardarComentario = useEditarComentario()
  const guardarModelo = useEditarModeloTelefono()
  const guardarCliente = useEditarClienteTelefono()

  // D4, igual que el menú y los desplegables: mientras haya un diálogo abierto el sondeo se congela, o la recarga
  // mueve la fila bajo el cursor y la edición cae sobre otra.
  const hayEditor = conComentario !== null || conModelo !== null || conCliente !== null
  useEffect(() => {
    if (!hayEditor) return
    onInteraccion(true)
    return () => onInteraccion(false)
  }, [hayEditor, onInteraccion])

  /** Las escrituras sobre el teléfono no tocan la clave de esta lista: se recarga aquí, y también tras un fallo
   *  (el 409 del bloqueo optimista manda avisar Y recargar, spec §14). */
  const recargarLista = () => {
    void qc.invalidateQueries({ queryKey: CLAVE_ASIGNACIONES_TODAS })
  }
  const alFallarTelefono = (e: unknown) => {
    if (esErrorGestionadoGlobalmente(e)) return
    mostrarError(e instanceof StaleDataError ? MSG_TELEFONO_MODIFICADO : `No se pudo guardar: ${mensajeDeError(e)}`)
  }

  const dialogos = (
    <>
      <EditorComentario
        fila={conComentario}
        onCerrar={() => setConComentario(null)}
        onGuardar={(comentario) => {
          const fila = conComentario
          if (!fila) return
          setConComentario(null)
          // Va por el endpoint de reasignar (hoja de contrato §2) y ya invalida esta lista él solo.
          guardarComentario.mutate({ fila, comentario })
        }}
      />
      <SelectorLista
        abierto={conModelo !== null}
        titulo="Editar modelo"
        etiquetaLista="Selecciona el modelo:"
        placeholderBuscar="Filtrar modelo..."
        opciones={OPCIONES_MODELO}
        claveActual={conModelo?.modelo ?? null}
        preseleccionarActual
        textoSeleccionar="Guardar"
        onCancelar={() => setConModelo(null)}
        onSeleccionar={(modelo) => {
          const fila = conModelo
          if (!fila) return
          setConModelo(null)
          // `modelo` es el código interno, no el nombre traducido que se ve en la lista (hoja de contrato §4).
          guardarModelo.mutate({ imei: fila.imei, modelo }, { onSettled: recargarLista })
        }}
      />
      <SelectorLista
        abierto={conCliente !== null}
        titulo="Seleccionar cliente"
        placeholderBuscar="Buscar cliente..."
        opciones={[{ clave: SIN_CLIENTE_CLAVE, etiqueta: '— Sin cliente —' }, ...clientesActivos.map((c) => ({ clave: String(c.idCli), etiqueta: c.nombre }))]}
        claveActual={conCliente?.cliente ? (clientesActivos.find((c) => c.nombre === conCliente.cliente)?.idCli.toString() ?? null) : null}
        textoNada="Nada seleccionado"
        textoSeleccionar="Seleccionar"
        onCancelar={() => setConCliente(null)}
        onSeleccionar={(clave) => {
          const fila = conCliente
          if (!fila) return
          setConCliente(null)
          // `telefonoUpdatedAt` (el del teléfono), no el de la asignación. Si faltara, el servidor rechaza el cambio
          // y la vista avisa: mejor eso que inventar una fecha que pisaría el cambio de otro (como en api.ts).
          guardarCliente.mutate(
            { imei: fila.imei, idCli: clave === SIN_CLIENTE_CLAVE ? null : Number(clave), updatedAt: fila.telefonoUpdatedAt ?? '' },
            { onError: alFallarTelefono, onSettled: recargarLista },
          )
        }}
      />
    </>
  )

  return { editarComentario: setConComentario, editarModelo: setConModelo, editarCliente: setConCliente, dialogos }
}
