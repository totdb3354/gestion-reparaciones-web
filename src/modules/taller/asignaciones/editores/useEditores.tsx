import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ReparacionResumen } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, MSG_TELEFONO_MODIFICADO, StaleDataError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { SelectorLista } from '@/shared/ui/SelectorLista'
import { useClientesActivos, useEditarClienteTelefono, useEditarModeloTelefono } from '../../api'
import { MODELOS_ORDENADOS, traducirModelo } from '../../lib/modelos'
import { CLAVE_ASIGNACIONES_TODAS, useEditarComentario } from '../api'
import { EditorComentario } from './EditorComentario'

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
          // `telefonoUpdatedAt` (el del teléfono), no el de la asignación. Sin él no hay bloqueo optimista que mandar:
          // el PATCH iría con un updatedAt vacío y el servidor lo convertiría en NPE (500), que el cliente clasifica
          // como error de conexión y muestra el banner "Sin conexión con el servidor" en vez de un aviso de guardado
          // (mismo caso que ImeisPage; ver `alFallar` allí).
          if (!fila?.telefonoUpdatedAt) return
          setConCliente(null)
          guardarCliente.mutate(
            { imei: fila.imei, idCli: clave === SIN_CLIENTE_CLAVE ? null : Number(clave), updatedAt: fila.telefonoUpdatedAt },
            { onError: alFallarTelefono, onSettled: recargarLista },
          )
        }}
      />
    </>
  )

  return { editarComentario: setConComentario, editarModelo: setConModelo, editarCliente: setConCliente, dialogos }
}
