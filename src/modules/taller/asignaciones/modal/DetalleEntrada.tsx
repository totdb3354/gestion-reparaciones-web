import type { Dispatch } from 'react'
import type { Cliente, FilaCarga, Tecnico } from '@/shared/api/client'
import { BotonPrimario } from '@/shared/ui/Botones'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { Checkbox } from '@/shared/ui/checkbox'
import { MODELOS_ORDENADOS, traducirModelo } from '../../lib/modelos'
import { ListaTecnicos } from './ListaTecnicos'
import { opcionesCliente, refDeClave, valorCliente } from './opcionesCliente'
import { asignarHabilitado, entradaActual, glassAbiertaBd, promptModelo, tecnicosOcupados } from './estado/derivados'
import type { Accion, EstadoModal } from './estado/tipos'

type Props = { estado: EstadoModal; dispatch: Dispatch<Accion>; tecnicos: Tecnico[]; carga: FilaCarga[]; clientes: Cliente[] }

const ETIQUETA = 'text-[12px] font-bold text-azul-gris'
const OPCIONES_MODELO = MODELOS_ORDENADOS.map((c) => ({ clave: c, etiqueta: traducirModelo(c) }))

/** Panel derecho de Reparación y Glass; deshabilitado sin entrada cargada. */
export function DetalleEntrada({ estado, dispatch, tecnicos, carga, clientes }: Props) {
  const e = entradaActual(estado)
  const esRep = (e?.tipo ?? estado.pestana) === 'REPARACION'
  const ocupados = e ? tecnicosOcupados(estado.tabla, e.imei, e.tipo) : new Set<number>()
  const glassBd = e && e.tipo === 'REPARACION' ? glassAbiertaBd(estado.tabla, e.imei) : null
  // Activos más el que ya tenga la entrada (un inactivo de BD se muestra, D6); helper compartido con PanelPulido.
  const opciones = opcionesCliente(clientes, e?.idCli)
  const valorCli = valorCliente(e ? { idCli: e.idCli, sinCliente: e.sinCliente } : null)

  return (
    <fieldset disabled={!e} className="flex flex-col gap-2 rounded-md border border-borde-input bg-white p-4 disabled:opacity-60">
      <div key={e?.seq ?? 'vacio'} className="contents">
        <span className="text-[11px] font-bold text-azul-gris">IMEI en curso</span>
        <span data-testid="imei-en-curso" className="font-mono text-[18px] font-bold text-azul-medio">{e?.imei ?? '—'}</span>
        <span className={ETIQUETA}>Modelo de iPhone</span>
        <CampoAutocompletar aria-label="Modelo de iPhone" placeholder={e ? promptModelo(e) : 'Escribe modelo...'}
          valor={e?.modelo ?? null} opciones={OPCIONES_MODELO}
          onElegir={(modelo) => dispatch({ tipo: 'DECIDIR_MODELO', modelo })}
          onTextoCambiado={() => { if (e?.modelo) dispatch({ tipo: 'BORRAR_MODELO' }) }} />
        <ListaTecnicos tecnicos={tecnicos} carga={carga} marcados={estado.borrador.tecnicos} ocupados={ocupados}
          marcarGlass={estado.pestana === 'GLASS'}
          onMarcar={(idTec, marcado) => dispatch({ tipo: 'MARCAR_TECNICO', idTec, marcado, orden: tecnicos.map((t) => t.idTec) })} />
        <span className={ETIQUETA}>Cliente (opcional)</span>
        <CampoAutocompletar aria-label="Cliente" placeholder="Escribe cliente..." valor={valorCli} opciones={opciones}
          onElegir={(clave) => dispatch({ tipo: 'ELEGIR_CLIENTE', ref: refDeClave(clave) })} />
        <span className={ETIQUETA}>Comentario (opcional)</span>
        <textarea aria-label="Comentario" rows={2} placeholder="Instrucciones para el técnico..." value={estado.borrador.comentario}
          onChange={(ev) => dispatch({ tipo: 'CAMBIAR_COMENTARIO', texto: ev.target.value })}
          className="rounded border border-borde-input bg-white p-2 text-[13px] text-azul-medio" />
        {esRep && (
          <label className="flex items-center gap-2 text-[12px] text-azul-gris">
            <Checkbox aria-label="Reparación de chasis" checked={estado.borrador.esChasis}
              onCheckedChange={(v) => dispatch({ tipo: 'CAMBIAR_CHASIS', valor: v === true })} />
            Reparación de chasis
          </label>
        )}
        {esRep && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-azul-gris">
              <Checkbox aria-label="Lleva glass" checked={!!e?.llevaGlass} disabled={glassBd != null}
                onCheckedChange={(v) => dispatch({ tipo: 'MARCAR_LLEVA_GLASS', valor: v === true })} />
              Lleva glass
            </label>
            {glassBd && <span className="text-[10.5px] italic text-azul-gris">ya tiene glass: {glassBd}</span>}
          </div>
        )}
        <BotonPrimario className="w-full" disabled={!asignarHabilitado(estado)} onClick={() => dispatch({ tipo: 'ASIGNAR' })}>
          {e?.asignada ? 'Guardar cambios' : 'Asignar →'}
        </BotonPrimario>
      </div>
    </fieldset>
  )
}
