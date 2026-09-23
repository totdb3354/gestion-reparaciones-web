import { asignar, borrarModelo, cambiarChasis, cambiarComentario, cambiarPestana, cargar, decidirModelo, escanear,
  lookupResuelto, marcarTecnico, pegar, quitar } from './colas'
import { elegirCliente } from './cliente'
import { marcarLlevaGlass, prediccionFallida, prediccionResuelta } from './glass'
import { pulidoCliente, pulidoClienteBd, pulidoComentario, pulidoEscanear, pulidoPegar, pulidoQuitar, pulidoSeleccionar,
  pulidoTecArriba, pulidoTecnico } from './pulido'
import type { Accion, EstadoModal } from './tipos'

/** Solo compone: cada regla vive en su fichero y tiene allí su test. */
export function reducir(s: EstadoModal, a: Accion): EstadoModal {
  switch (a.tipo) {
    case 'CAMBIAR_PESTANA': return cambiarPestana(s, a.pestana)
    case 'ESCANEAR': return escanear(s, a.imei)
    case 'PEGAR': return pegar(s, a.texto)
    case 'CARGAR': return cargar(s, a.seq)
    case 'QUITAR': return quitar(s, a.seq)
    case 'LOOKUP_RESUELTO': return lookupResuelto(s, a.seq, a.modelo, a.idCliBd)
    case 'DECIDIR_MODELO': return decidirModelo(s, a.modelo)
    case 'BORRAR_MODELO': return borrarModelo(s)
    case 'MARCAR_TECNICO': return marcarTecnico(s, a.idTec, a.marcado, a.orden)
    case 'ELEGIR_CLIENTE': return elegirCliente(s, a.ref)
    case 'CAMBIAR_COMENTARIO': return cambiarComentario(s, a.texto)
    case 'CAMBIAR_CHASIS': return cambiarChasis(s, a.valor)
    case 'MARCAR_LLEVA_GLASS': return marcarLlevaGlass(s, a.valor)
    case 'ASIGNAR': return asignar(s)
    case 'PREDICCION_RESUELTA': return prediccionResuelta(s, a.seq, a.token, a.idTec)
    case 'PREDICCION_FALLIDA': return prediccionFallida(s, a.seq, a.token)
    case 'CERRAR_AVISO_PREDICCION': return { ...s, avisoPrediccion: false }
    case 'PULIDO_TEC_ARRIBA': return pulidoTecArriba(s, a.idTec)
    case 'PULIDO_ESCANEAR': return pulidoEscanear(s, a.imei)
    case 'PULIDO_PEGAR': return pulidoPegar(s, a.texto)
    case 'PULIDO_SELECCIONAR': return pulidoSeleccionar(s, a.seq)
    case 'PULIDO_TECNICO': return pulidoTecnico(s, a.idTec)
    case 'PULIDO_CLIENTE': return pulidoCliente(s, a.ref)
    case 'PULIDO_COMENTARIO': return pulidoComentario(s, a.texto)
    case 'PULIDO_QUITAR': return pulidoQuitar(s, a.seq)
    case 'PULIDO_CLIENTE_BD': return pulidoClienteBd(s, a.seq, a.idCli)
    case 'EFECTOS_CONSUMIDOS': return { ...s, efectos: s.efectos.filter((e) => !a.ids.includes(e.id)) }
  }
}
