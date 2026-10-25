import { describe, expect, it } from 'vitest'
import { eventoRastro } from '../test/fabrica'
import { fechaRastro, hayAntesDelHistorico, textoRevision, verEvento } from './rastro'

describe('textos del rastro (spec pieza 1 §9.3)', () => {
  it('fechas: con hora o solo el día', () => {
    expect(fechaRastro('2026-09-12T13:01:00', false)).toBe('12/09/2026 13:01')
    expect(fechaRastro('2023-03-14T00:00:00', true)).toBe('14/03/2023')
  })

  it('cada tipo de evento', () => {
    expect(verEvento(eventoRastro())).toMatchObject({ titulo: 'Pasa a Listos', detalle: 'Desde: Taller · Glass', color: 'bg-fila-recibido-brd' })
    expect(verEvento(eventoRastro({ a: null, aNsys: 'Pedidos realizados', de: 'Listos' })).titulo).toBe('De pedido (vendido, pendiente de envío)')
    expect(verEvento(eventoRastro({ a: null, aNsys: 'Desguace' })).titulo).toBe('Pasa a Desguace · sale del stock')
    expect(verEvento(eventoRastro({ tipo: 'ENTRADA', de: null, a: null, aNsys: null, soloDia: true })).titulo).toBe('Entra en el lote BT-9001')
    expect(verEvento(eventoRastro({ tipo: 'REENTRADA', a: 'BT-9002' })).titulo).toBe('Vuelve a entrar (lote BT-9002)')
    expect(verEvento(eventoRastro({ tipo: 'GRADO', de: 'C100', a: 'A100' }))).toMatchObject({ titulo: 'Se le pone el grado A · batería nueva', detalle: 'Antes: C · batería nueva' })
    expect(verEvento(eventoRastro({ tipo: 'GRADO', de: 'C', a: 'B' }))).toMatchObject({ titulo: 'Se le pone el grado B', detalle: 'Antes: C' })
    expect(verEvento(eventoRastro({ tipo: 'PRODUCTO', de: 'Blue', a: 'Pink' })).detalle).toBe('Blue → Pink')
    expect(verEvento(eventoRastro({ tipo: 'ESTADO', de: 'InProcess', a: 'Available' })).titulo).toBe('Estado en NSYS: Available')
    expect(verEvento(eventoRastro({ tipo: 'VENTA', soloDia: true })).detalle).toBe('Del fichero de NSYS: solo se sabe el día')
    expect(verEvento(eventoRastro({ tipo: 'VENTA_DESHECHA', a: 'Available' })).titulo).toBe('Venta deshecha en NSYS')
    expect(verEvento(eventoRastro({ tipo: 'CORRECCION', lote: 'BT-1345', loteAnterior: 'BT-1333', de: '512GB Amarillo · A', a: '512GB Negro · A100', aNsys: null })))
      .toMatchObject({ titulo: 'Corrección en NSYS (lote BT-1333 → BT-1345)', detalle: '512GB Amarillo · A → 512GB Negro · A100', color: 'bg-ambar' })
    expect(verEvento(eventoRastro({ fuente: 'ERP', tipo: 'TRABAJO_ASIGNADO', idRep: 'AG1', tecnico: 'Técnico 3', categoria: 'GLASS' })).titulo)
      .toBe('Trabajo de glass asignado a Técnico 3')
    expect(verEvento(eventoRastro({ fuente: 'ERP', tipo: 'TRABAJO_TERMINADO', idRep: 'G1', tecnico: 'Técnico 3', categoria: 'GLASS' })))
      .toMatchObject({ titulo: 'Glass terminado', detalle: 'Técnico 3' })
  })

  it('la nota del histórico sale si hay eventos de antes de dic. 2023', () => {
    expect(hayAntesDelHistorico([eventoRastro(), eventoRastro({ fecha: '2023-03-14T00:00:00', soloDia: true })])).toBe(true)
    expect(hayAntesDelHistorico([eventoRastro({ fecha: '2023-12-01T09:00:00' })])).toBe(false)
  })

  it('el cambio de caja que es la revisión: «Revisado → caja», con su marca (spec 0.9.18 §5.3)', () => {
    expect(verEvento(eventoRastro({ de: 'En revisión', a: 'Taller · Pulir', aNsys: 'CAJA PULIR', revision: 'ENTRADA' })))
      .toMatchObject({ titulo: 'Revisado → Taller · Pulir', detalle: 'Desde: En revisión', revision: true })
    expect(verEvento(eventoRastro({ de: 'Devolución', a: 'Listos', revision: 'DEVOLUCION' })).titulo).toBe('Revisado (devolución) → Listos')
    expect(verEvento(eventoRastro({ de: 'En revisión', a: null, aNsys: 'Desguace', revision: 'ENTRADA' })).titulo).toBe('Revisado → Desguace')
    expect(verEvento(eventoRastro()).revision).toBeFalsy()
  })

  it('la ficha: pendiente de revisar, revisado o nada (spec 0.9.18 §5.2)', () => {
    const ahora = new Date('2026-10-19T10:00:00Z')
    const sin = { revisadoEl: null, revisadoDevolucion: false, pendienteRevisionDesde: null }
    expect(textoRevision({ ...sin, pendienteRevisionDesde: '2026-10-15' }, ahora)).toBe('Pendiente de revisar desde hace 4 días')
    expect(textoRevision({ ...sin, pendienteRevisionDesde: '2026-10-18' }, ahora)).toBe('Pendiente de revisar desde hace 1 día')
    expect(textoRevision({ ...sin, pendienteRevisionDesde: '2026-10-19' }, ahora)).toBe('Pendiente de revisar desde hoy')
    expect(textoRevision({ ...sin, revisadoEl: '2026-10-17T10:31:00' }, ahora)).toBe('Revisado el 17/10/2026, hacia las 10:31')
    expect(textoRevision({ ...sin, revisadoEl: '2026-10-17T10:31:00', revisadoDevolucion: true }, ahora))
      .toBe('Revisado (devolución) el 17/10/2026, hacia las 10:31')
    expect(textoRevision(sin, ahora)).toBeNull()
  })

  it('lo del taller (spec 0.9.21 §2.4)', () => {
    const taller = (p: Parameters<typeof eventoRastro>[0]) =>
      eventoRastro({ fuente: 'TALLER', lote: null, aNsys: null, tecnico: 'Supertécnico 1', origen: 'MANO', ...p })
    expect(verEvento(taller({ tipo: 'TALLER_CAMBIO', dato: 'COLOR', de: 'Azul', a: 'Rojo', motivo: 'chasis rojo' })))
      .toMatchObject({ titulo: 'Taller: color Azul → Rojo (a mano · Supertécnico 1 · «chasis rojo»)', detalle: null, color: 'bg-taller' })
    expect(verEvento(taller({ tipo: 'TALLER_VUELTA', dato: 'GRADO', de: 'A100', a: 'B', motivo: null })).titulo)
      .toBe('Vuelve a lo de NSYS: grado A100 → B (a mano · Supertécnico 1)')
    expect(verEvento(taller({ tipo: 'TALLER_PASADO', dato: 'GRADO', de: 'A100', a: 'A100' })).titulo).toBe('Pasado a NSYS: grado A100')
    expect(verEvento(taller({ tipo: 'TALLER_MANDA_NSYS', dato: 'COLOR', de: 'Rojo', a: 'Verde' })).titulo)
      .toBe('Manda NSYS: color Verde (el del taller, Rojo, deja de valer)')
  })

  it('lo que hacen las reparaciones (spec 0.9.21 pieza 2 §2.5)', () => {
    const rep = (p: Parameters<typeof eventoRastro>[0]) =>
      eventoRastro({ fuente: 'TALLER', lote: null, aNsys: null, tecnico: 'Técnico 2', origen: 'REPARACION', idRep: 'R20261021_3', ...p })
    expect(verEvento(rep({ tipo: 'TALLER_CAMBIO', dato: 'COLOR', de: 'Azul', a: 'Rojo', motivo: 'chasis chai13red nuevo' })))
      .toMatchObject({ titulo: 'Taller: color Azul → Rojo (reparación R20261021_3 · Técnico 2 · chasis chai13red nuevo)', color: 'bg-taller' })
    expect(verEvento(rep({ tipo: 'TALLER_VUELTA', dato: 'COLOR', de: 'Rojo', a: 'Azul', motivo: 'chasis chai13blue nuevo' })).titulo)
      .toBe('Vuelve a lo de NSYS: color Rojo → Azul (reparación R20261021_3 · Técnico 2 · chasis chai13blue nuevo)')
    expect(verEvento(rep({ tipo: 'TALLER_SIN_COLOR', dato: 'COLOR', de: 'chai13xxx', motivo: 'chasis chai13xxx nuevo' })))
      .toMatchObject({ titulo: 'Taller: el color del chasis chai13xxx no se puede deducir: lo corregirá un supertécnico (reparación R20261021_3 · Técnico 2)', color: 'bg-ambar' })
    expect(verEvento(rep({ tipo: 'TALLER_SIN_COLOR', dato: 'COLOR', de: 'tapai13xxx' })).titulo)
      .toContain('el color de la tapa tapai13xxx no se puede deducir')
    expect(verEvento(rep({ tipo: 'TALLER_SIN_GRADO', dato: 'GRADO', de: 'ID', motivo: 'batería bati13 nueva' })).titulo)
      .toBe('Taller: el grado (ID) no se puede calcular: lo corregirá un supertécnico (reparación R20261021_3 · Técnico 2 · batería bati13 nueva)')
    expect(verEvento(rep({ tipo: 'TALLER_DESHECHO_BORRADA', dato: 'COLOR', de: 'Rojo', a: 'Azul' })))
      .toMatchObject({ titulo: 'Se deshace: color Rojo → Azul (se borró la reparación R20261021_3 · Técnico 2)', color: 'bg-taller' })
    expect(verEvento(rep({ tipo: 'TALLER_DESHECHO_EDITADA', dato: 'GRADO', de: 'A', a: 'B' })).titulo)
      .toBe('Se deshace: grado A → B (se editó la reparación R20261021_3 · Técnico 2)')
    expect(verEvento(rep({ tipo: 'TALLER_SIN_DESHACER_BORRADA', dato: 'COLOR', de: 'Rojo' })))
      .toMatchObject({ titulo: 'Se borró la reparación R20261021_3 que cambió el color; corrígelo a mano si hace falta (Técnico 2)', color: 'bg-ambar' })
    expect(verEvento(rep({ tipo: 'TALLER_SIN_DESHACER_EDITADA', dato: 'GRADO', de: 'A' })).titulo)
      .toBe('Se editó la reparación R20261021_3 que cambió el grado; corrígelo a mano si hace falta (Técnico 2)')
  })

  it('un aviso revisado: «Revisado por …» con lo que era (0.9.22 §3.5)', () => {
    const rep = (p: Parameters<typeof eventoRastro>[0]) => eventoRastro({
      fuente: 'TALLER', lote: null, aNsys: null, tecnico: 'Técnico 2', origen: 'REPARACION', idRep: 'R20261021_3', ...p,
    })
    expect(verEvento(rep({ tipo: 'TALLER_REVISADO_SIN_COLOR', dato: 'COLOR', tecnico: 'Supertécnico 1', origen: 'MANO' })))
      .toMatchObject({ titulo: 'Revisado por Supertécnico 1: color sin deducir (reparación R20261021_3)', color: 'bg-verde-ok' })
    expect(verEvento(rep({ tipo: 'TALLER_REVISADO_SIN_GRADO', dato: 'GRADO', tecnico: 'Supertécnico 1' })).titulo)
      .toBe('Revisado por Supertécnico 1: grado sin calcular (reparación R20261021_3)')
    expect(verEvento(rep({ tipo: 'TALLER_REVISADO_SIN_DESHACER', dato: 'COLOR', tecnico: 'Supertécnico 1' })).titulo)
      .toBe('Revisado por Supertécnico 1: no se pudo deshacer (reparación R20261021_3)')
  })
})
