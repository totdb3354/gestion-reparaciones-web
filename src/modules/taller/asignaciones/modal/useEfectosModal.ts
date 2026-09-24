import { useEffect, useRef, type Dispatch } from 'react'
import { guardarModelo, pedirClienteBd, pedirLookup, pedirPrediccion } from './api'
import type { Accion, Efecto } from './estado/tipos'

/** Consume la cola de salida del reductor: lanza cada efecto una sola vez (también bajo StrictMode) y despacha su
 *  resultado. El reductor decide si el resultado sigue valiendo (entrada existente, token vigente). */
export function useEfectosModal(efectos: Efecto[], dispatch: Dispatch<Accion>, idsClientes: Set<number>) {
  const lanzados = useRef(new Set<number>())
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  useEffect(() => {
    const nuevos = efectos.filter((e) => !lanzados.current.has(e.id))
    if (nuevos.length === 0) return
    const despachar = (a: Accion) => {
      if (vivo.current) dispatch(a)
    }
    for (const e of nuevos) {
      lanzados.current.add(e.id)
      void ejecutar(e)
    }
    dispatch({ tipo: 'EFECTOS_CONSUMIDOS', ids: nuevos.map((e) => e.id) })

    async function ejecutar(e: Efecto) {
      switch (e.tipo) {
        case 'lookup': {
          const r = await pedirLookup(e.imei, e.buscarModelo, idsClientes)
          despachar({ tipo: 'LOOKUP_RESUELTO', seq: e.seq, modelo: r.modelo, idCliBd: r.idCliBd })
          return
        }
        case 'clientePulido':
          despachar({ tipo: 'PULIDO_CLIENTE_BD', seq: e.seq, idCli: await pedirClienteBd(e.imei, idsClientes) })
          return
        case 'guardarModelo':
          await guardarModelo(e.imei, e.modelo)
          return
        case 'prediccion':
          try {
            const idTec = await pedirPrediccion({ imei: e.imei, conCliente: e.conCliente, verdes: e.verdes })
            despachar({ tipo: 'PREDICCION_RESUELTA', seq: e.seq, token: e.token, idTec })
          } catch {
            despachar({ tipo: 'PREDICCION_FALLIDA', seq: e.seq, token: e.token })
          }
      }
    }
  }, [efectos, dispatch, idsClientes])
}
