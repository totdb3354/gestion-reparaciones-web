import { describe, expect, it } from 'vitest'
import { solicitudPreventiva, solicitudUrgente } from '../test/fabrica'
import { componerListas, firma, lineaInfo } from './solicitudes'

const datos = () => ({
  urgPend: [solicitudUrgente({ idRc: 501 }), solicitudUrgente({ idRc: 502, idRep: 'AG20260916_2' })],
  prevPend: [solicitudPreventiva({ idSol: 701 })],
  urgRech: [solicitudUrgente({ idRc: 503, estado: 'RECHAZADA' })],
  prevRech: [solicitudPreventiva({ idSol: 702, estado: 'RECHAZADA' })],
})

describe('solicitudes del panel (ficha notificaciones.md, "Pestaña Solicitudes")', () => {
  it('componerListas: urgentes antes que preventivas en cada grupo', () => {
    const l = componerListas(datos())
    expect(l.pendientes.map((t) => `${t.clase}${t.id}:${t.grupo}`)).toEqual(['U501:pendiente', 'U502:pendiente', 'P701:pendiente'])
    expect(l.rechazadas.map((t) => `${t.clase}${t.id}:${t.grupo}`)).toEqual(['U503:rechazada', 'P702:rechazada'])
  })
  it('firma cambia con ids/grupo/clase y no con descripción, técnico o fecha', () => {
    const base = firma(componerListas(datos()))
    const retocada = datos()
    retocada.urgPend[0] = solicitudUrgente({ idRc: 501, descripcion: 'otra', nombreTecnico: 'Técnico H', fechaSolicitud: '2026-09-17T10:00:00' })
    expect(firma(componerListas(retocada))).toBe(base)
    const conNueva = datos()
    conNueva.urgPend.push(solicitudUrgente({ idRc: 504 }))
    expect(firma(componerListas(conNueva))).not.toBe(base)
    const cambiadaDeGrupo = datos()
    cambiadaDeGrupo.urgRech.push(cambiadaDeGrupo.urgPend.pop()!)
    expect(firma(componerListas(cambiadaDeGrupo))).not.toBe(base)
    // Misma cifra en otra clase: U701 no es P701
    const otraClase = datos()
    otraClase.prevPend = []
    otraClase.urgPend.push(solicitudUrgente({ idRc: 701 }))
    expect(firma(componerListas(otraClase))).not.toBe(base)
  })
  it('lineaInfo de las cuatro tarjetas (urgente rechazada sin fecha; preventiva rechazada con fecha)', () => {
    const l = componerListas(datos())
    // 07:02 UTC = 09:02 en Madrid (septiembre); 09:30 UTC = 11:30
    expect(lineaInfo(l.pendientes[0])).toBe('Técnico A  ·  16/09/2026 09:02  ·  A20260916_1')
    expect(lineaInfo(l.pendientes[2])).toBe('tecnico_n  ·  16/09/2026 11:30')
    expect(lineaInfo(l.rechazadas[0])).toBe('Técnico A  ·  A20260916_1')
    expect(lineaInfo(l.rechazadas[1])).toBe('tecnico_n  ·  16/09/2026 11:30')
  })
})
