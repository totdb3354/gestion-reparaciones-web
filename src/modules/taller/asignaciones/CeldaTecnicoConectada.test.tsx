import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { renderConProviders, SESION_SUPER } from '@/test/render'
import { resumen, tecnico } from '../test/fabrica'
import { CeldaTecnicoConectada } from './CeldaTecnicoConectada'
import { useAsignacionesTodas } from './api'
import { useAccionConDeshacer } from './useAccionConDeshacer'

const TECNICOS = [tecnico({ idTec: 4, nombre: 'Técnico A' }), tecnico({ idTec: 6, nombre: 'Técnico H' })]

const FILA = resumen({ idRep: 'A20260916_1', idTec: 4, nombreTecnico: 'Técnico A', comentarioAsignacion: 'no tocar', updatedAt: '2026-09-16T07:02:00' })
/** El UPDATED_AT que deja la primera escritura (Reparacion lo lleva ON UPDATE CURRENT_TIMESTAMP). */
const UPDATED_AT_TRAS_ESCRIBIR = '2026-09-16T07:05:00'

type CuerpoReasignar = { idTec: number; comentarioAsignacion: string; updatedAt: string }

/**
 * El GET de montaje contesta al instante; cualquier GET posterior (el que dispara `onSettled` tras reasignar, o el
 * `refetchQueries` de la guarda del deshacer) se queda retenido hasta `liberarGet()`. Con esto la caché de la lista
 * llega a mostrar el `idTec` nuevo por el pintado optimista de `useReasignar` (D2, "reasigna al instante") pero SIN
 * que ninguna respuesta REAL del servidor la haya confirmado todavía: el escenario exacto que
 * `tieneReasignacionOptimistaSinConfirmar` (api.ts) existe para que la guarda de `filaParaDeshacer`
 * (CeldaTecnicoConectada) no confunda con "confirmada".
 */
function servidorConGetRetenido() {
  const estado = { fila: FILA }
  const cuerpos: CuerpoReasignar[] = []
  let primeraHecha = false
  let liberar = () => {}
  const puerta = new Promise<void>((resolve) => { liberar = resolve })
  server.use(
    http.get('*/api/reparaciones/asignaciones', async () => {
      if (primeraHecha) await puerta
      primeraHecha = true
      return HttpResponse.json([estado.fila])
    }),
    http.get('*/api/glass/asignaciones', () => HttpResponse.json([])),
    http.get('*/api/pulidos/asignaciones', () => HttpResponse.json([])),
    http.patch('*/api/reparaciones/asignaciones/:idRep', async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoReasignar
      cuerpos.push(cuerpo)
      if (cuerpo.updatedAt !== estado.fila.updatedAt) return new HttpResponse(null, { status: 409 })
      const nombre = TECNICOS.find((t) => t.idTec === cuerpo.idTec)?.nombre ?? ''
      estado.fila = { ...estado.fila, idTec: cuerpo.idTec, nombreTecnico: nombre, updatedAt: UPDATED_AT_TRAS_ESCRIBIR }
      return new HttpResponse(null, { status: 200 })
    }),
  )
  return { cuerpos, liberarGet: () => liberar() }
}

/** Mini-página: CeldaTecnicoConectada sola con su aviso, sin pasar por `crearColumnas`/`DataTable` (fuera de los
 *  límites de este arreglo). La fila sale de `useAsignacionesTodas`, no de un objeto fijo, porque el deshacer relee
 *  la fila de esa misma caché (calco del harness de columnas.test.tsx, sin tocar ese archivo). */
function Pagina() {
  const { ejecutar, aviso } = useAccionConDeshacer()
  const { data = [] } = useAsignacionesTodas()
  const fila = data.find((f) => f.idRep === FILA.idRep)
  return (
    <>
      {fila && <CeldaTecnicoConectada fila={fila} tecnicos={TECNICOS} ejecutar={ejecutar} onInteraccion={() => {}} />}
      {aviso}
    </>
  )
}

async function reasignarATecnicoH() {
  renderConProviders(<Pagina />, { sesion: SESION_SUPER })
  await userEvent.click(await screen.findByRole('combobox', { name: 'Técnico de A20260916_1' }))
  await userEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'Técnico H' }))
}

describe('CeldaTecnicoConectada: la guarda del deshacer distingue "pintado en optimista" de "confirmado por el servidor"', () => {
  it('con la recarga retenida, la celda ya muestra Técnico H (optimista) pero Deshacer sigue esperando: no manda la reversión con el camino rápido', async () => {
    const { cuerpos, liberarGet } = servidorConGetRetenido()
    await reasignarATecnicoH()
    // Pintado optimista: la celda ya muestra el técnico nuevo antes de que aterrice ninguna recarga real (D2).
    expect(screen.getByRole('combobox', { name: 'Técnico de A20260916_1' })).toHaveTextContent('Técnico H')
    await screen.findByText('A20260916_1 reasignada a Técnico H')
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    // La recarga sigue retenida: si la guarda confundiera "pintado" con "confirmado" (mirase solo idTec ===
    // idTecNuevo en la caché, que ya vale 6 por el optimismo), mandaría la reversión ya mismo. No debe.
    await new Promise((r) => setTimeout(r, 30))
    expect(cuerpos).toHaveLength(1)
    liberarGet()
    await vi.waitFor(() => expect(cuerpos).toHaveLength(2))
    // Y cuando sí manda la reversión, es con los datos confirmados por el servidor (updatedAt tras la escritura),
    // no con los de la fila capturada antes de reasignar.
    expect(cuerpos[1]).toEqual({ idTec: 4, comentarioAsignacion: 'no tocar', updatedAt: UPDATED_AT_TRAS_ESCRIBIR })
  })
})
