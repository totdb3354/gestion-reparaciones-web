import { useState, type Dispatch, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { PREFIJO_CHASIS, PREFIJOS_CON_COLOR } from '../lib/colores'
import { DialogoObservacionFila } from './DialogoObservacionFila'
import { DialogoSolicitarPieza } from './DialogoSolicitarPieza'
import {
  botonDerecho, botonNueva, chasisResaltados, filaEditadaInvalida, filaSinSku, marcaPieza, muestraEleccion, previsionStock,
  reutilizadaJuntoASolicitud, stockDe,
  type AccionFormulario, type BotonDerecho, type EstadoFormulario, type FilaEstado, type MarcaPieza, type PrevisionStock,
} from './estado'
import { TEXTO_SIN_COLOR, opcionesSku } from './opcionesSku'

type Props = { estado: EstadoFormulario; fila: FilaEstado; dispatch: Dispatch<AccionFormulario>; onGuardarFila: (prefijo: string) => void; children?: ReactNode }

type EstadoFila = 'normal' | 'guardada' | 'editada' | 'yaReparado' | 'sinSku'

/** Fondo y borde inferior por estado (valor de data-estado). */
const CLASES_ESTADO: Record<EstadoFila, string> = {
  normal: 'bg-fondo-input border-form-fila-brd',
  sinSku: 'bg-fondo-input border-form-fila-brd opacity-40',
  guardada: 'bg-form-guardada-bg border-fila-reparado-brd',
  editada: 'bg-fila-edicion-bg border-fila-edicion-brd',
  yaReparado: 'bg-fila-reparado-bg border-fila-reparado-brd',
}

/** El orden reconcilia con `botonDerecho` (estado.ts): una fila "ya reparada" se pinta así aunque su tipo no tenga SKU
 *  para el modelo elegido (opciones vacías) — la reparación es de OTRO modelo del mismo tipo, no de este. */
function estadoDeFila(fila: FilaEstado): EstadoFila {
  if (fila.rol === 'yaReparado') return 'yaReparado'
  if (fila.guardada !== null) return 'guardada'
  if (filaSinSku(fila)) return 'sinSku'
  if (fila.rol === 'editada') return 'editada'
  return 'normal'
}

/** Etiqueta deshabilitada del botón derecho ("✓ Guardada …", "⚠ En camino", "✓ Recibido"): 11 px, radio 0, padding 4 10, con sus
 *  colores aunque esté disabled. */
const CLASE_ETIQUETA = 'h-[27px] rounded-none px-2.5 py-1 text-[11px]'

/** Previsión de stock ("5 → 4"): de la fila editada y, desde la 0.9.19, de una Nueva sin guardar. Rojo si baja, verde si
 *  sube, gris si queda igual. */
const COLOR_TENDENCIA: Record<PrevisionStock['tendencia'], string> = { baja: 'text-rojo-cancelar', sube: 'text-verde-ok', igual: 'text-azul-gris' }

function BotonDerechoFila({ boton, prefijo, onGuardarFila }: { boton: BotonDerecho; prefijo: string; onGuardarFila: (prefijo: string) => void }) {
  const testid = `boton-derecho-${prefijo}`
  switch (boton.tipo) {
    case 'guardarFila':
      return (
        <button
          type="button"
          data-testid={testid}
          disabled={boton.deshabilitado}
          onClick={() => onGuardarFila(prefijo)}
          className="h-[27px] cursor-pointer rounded bg-azul-noche px-2.5 py-1 text-[11px] font-bold text-superficie disabled:cursor-default disabled:opacity-50"
        >
          {boton.texto}
        </button>
      )
    case 'guardada':
      return (
        <button type="button" data-testid={testid} disabled className={cn(CLASE_ETIQUETA, 'bg-recibido-bg text-recibido-text')}>
          {boton.texto}
        </button>
      )
    case 'enCamino':
      return (
        <button type="button" data-testid={testid} disabled className={cn(CLASE_ETIQUETA, 'bg-tipo-reparacion-bg text-tipo-reparacion-text')}>
          ⚠ En camino
        </button>
      )
    case 'recibido':
      return (
        <button type="button" data-testid={testid} disabled className={cn(CLASE_ETIQUETA, 'bg-recibido-bg text-recibido-text')}>
          ✓ Recibido
        </button>
      )
    case 'yaReparado':
      // whitespace-pre conserva los dos espacios del literal; entre llaves para que el formateador no los toque.
      return <span data-testid={testid} className="px-2.5 text-[11px] font-bold whitespace-pre text-verde-ok">{'✓  Ya reparado'}</span>
    case 'ninguno':
      return null
  }
}

const CLASE_ELEGIR =
  'h-[27px] flex-1 cursor-pointer rounded-[3px] border bg-superficie text-[11.5px] font-semibold disabled:cursor-default disabled:opacity-40'

/** Celda del SKU sin elegir (spec 0.9.19 §2): «+ Nueva» (o «Solicitar pieza» si ningún SKU de la fila tiene stock; en edición,
 *  «+ Nueva» deshabilitado) y «↺ Reutilizada». */
function CeldaEleccion({ estado, fila, dispatch, inerte, onSolicitar }: {
  estado: EstadoFormulario; fila: FilaEstado; dispatch: Dispatch<AccionFormulario>; inerte: boolean; onSolicitar: () => void
}) {
  const { prefijo, nombre: tipo } = fila
  const izquierda = botonNueva(estado, fila)
  return (
    <div className="flex w-[240px] gap-1.5">
      {izquierda === 'solicitar' ? (
        <button type="button" aria-label={`Solicitar pieza ${tipo}`} disabled={inerte} onClick={onSolicitar}
          className={cn(CLASE_ELEGIR, 'border-ambar bg-form-agotado-bg text-form-agotado-text')}>
          Solicitar pieza
        </button>
      ) : (
        <button type="button" aria-label={`Nueva ${tipo}`} disabled={inerte || izquierda === 'deshabilitada'}
          title={izquierda === 'deshabilitada' ? 'Sin stock' : undefined}
          onClick={() => dispatch({ tipo: 'ELEGIR', prefijo, eleccion: 'nueva' })}
          className={cn(CLASE_ELEGIR, 'border-azul-noche text-azul-noche')}>
          + Nueva
        </button>
      )}
      <button type="button" aria-label={`Reutilizada ${tipo}`} disabled={inerte || !fila.controles.reutilizado}
        onClick={() => dispatch({ tipo: 'ELEGIR', prefijo, eleccion: 'reutilizada' })}
        className={cn(CLASE_ELEGIR, 'border-recibido-text text-recibido-text')}>
        ↺ Reutilizada
      </button>
    </div>
  )
}

const CLASES_MARCA: Record<MarcaPieza['tipo'], string> = {
  nueva: 'bg-tipo-reparacion-bg text-tipo-reparacion-text',
  reutilizada: 'bg-recibido-bg text-recibido-text',
  solicitada: 'bg-form-agotado-bg text-form-agotado-text',
}
const TEXTO_MARCA: Record<MarcaPieza['tipo'], string> = { nueva: '+ Nueva', reutilizada: '↺ Reutilizada', solicitada: 'Solicitada' }

/** Columna «Pieza» (0.9.19; antes la casilla «Reutilizado»): la marca de la elección con su «×», o el «↺ Reutilizada» de una
 *  solicitud guardada pendiente. */
function CeldaPieza({ fila, dispatch, inerte }: { fila: FilaEstado; dispatch: Dispatch<AccionFormulario>; inerte: boolean }) {
  const { prefijo, nombre: tipo } = fila
  const marca = marcaPieza(fila)
  return (
    <div className="flex w-[140px] shrink-0 items-center px-2.5">
      {marca !== null && (
        <span data-testid={`marca-${prefijo}`}
          className={cn('inline-flex h-6 items-center gap-0.5 rounded-xl pl-2.5 text-[11px] font-bold whitespace-nowrap', marca.quitar && !inerte ? 'pr-1' : 'pr-2.5', CLASES_MARCA[marca.tipo])}>
          {TEXTO_MARCA[marca.tipo]}
          {marca.quitar && !inerte && (
            <button type="button" aria-label={`Volver atrás ${tipo}`} title={marca.tipo === 'solicitada' ? 'Volver atrás: cancela la solicitud y la fila queda como al principio' : 'Volver atrás: la fila queda como al principio'}
              onClick={() => dispatch({ tipo: 'VOLVER', prefijo })}
              className="h-[18px] w-[18px] cursor-pointer rounded-full bg-transparent p-0 text-[13px] leading-none hover:bg-black/10">
              ×
            </button>
          )}
        </span>
      )}
      {reutilizadaJuntoASolicitud(fila) && (
        <button type="button" aria-label={`Reutilizada ${tipo}`} onClick={() => dispatch({ tipo: 'ELEGIR', prefijo, eleccion: 'reutilizada' })}
          className="h-6 cursor-pointer rounded-xl border border-recibido-text bg-superficie px-2 text-[11px] font-bold whitespace-nowrap text-recibido-text">
          ↺ Reutilizada
        </button>
      )}
    </div>
  )
}

/** Una fila de componente: contador con "+" y "-", nombre, celda del SKU (los dos botones de la elección o el combo), stock,
 *  columna «Pieza», observación y botón derecho; debajo, `children` (la sub-fila de agotado). No decide nada: el habilitado
 *  sale de `fila.eleccion` y `fila.controles` (una fila sin SKU para el modelo o ya guardada se pinta siempre deshabilitada),
 *  el botón derecho de `botonDerecho()` y cada gesto es un `dispatch`. */
export function FilaComponente({ estado, fila, dispatch, onGuardarFila, children }: Props) {
  const [dialogoObservacion, setDialogoObservacion] = useState(false)
  const [dialogoSolicitar, setDialogoSolicitar] = useState(false)
  const { prefijo, nombre: tipo } = fila
  const estadoFila = estadoDeFila(fila)
  const inerte = estadoFila === 'sinSku' || estadoFila === 'guardada'
  const stock = stockDe(fila)
  // Edición: un cambio que deja la fila editada sin elegir no se puede guardar → contador en rojo y negrita.
  const invalida = fila.rol === 'editada' && filaEditadaInvalida(estado)
  const prevision = previsionStock(estado, fila)
  const nueva = fila.eleccion === 'nueva'
  const clasesMasMenos = 'h-[18px] w-[35px] cursor-pointer rounded-none bg-gris-borde p-0 text-[14px] leading-none font-bold text-gris-disabled disabled:cursor-default disabled:opacity-40'
  // «Solicitar pieza» directo: con el SKU puesto abre el diálogo de siempre; en chasis o tapa sin color elige «Nueva» y la
  // banda de pedirla sale al elegir el color.
  const solicitar = () => (fila.idCom === null ? dispatch({ tipo: 'ELEGIR', prefijo, eleccion: 'nueva' }) : setDialogoSolicitar(true))

  return (
    <div data-testid={`fila-${prefijo}`} data-estado={estadoFila} className={cn('border-b', CLASES_ESTADO[estadoFila])}>
      <div className="flex min-h-[37px] items-center">
        <div className="flex w-[70px] shrink-0 items-center">
          <span data-testid={`contador-${prefijo}`} className={cn('w-[34px] text-center font-[family-name:Inter,system-ui,sans-serif] text-[20px] font-normal', invalida ? 'font-bold text-rojo-cancelar' : fila.cantidad > 0 ? 'text-texto-incidencia' : 'text-gris-borde')}>
            {fila.eleccion === 'reutilizada' ? '—' : fila.cantidad}
          </span>
          <div className="flex w-[35px] flex-col">
            <button type="button" aria-label={`Sumar ${tipo}`} disabled={inerte || !nueva || !fila.controles.mas} onClick={() => dispatch({ tipo: 'SUMAR', prefijo })} className={clasesMasMenos}>+</button>
            <button type="button" aria-label={`Restar ${tipo}`} disabled={inerte || !nueva || !fila.controles.menos} onClick={() => dispatch({ tipo: 'RESTAR', prefijo })} className={clasesMasMenos}>-</button>
          </div>
        </div>
        <span className="w-[100px] shrink-0 px-2.5 text-[12px]">{tipo}</span>
        <div className="w-[240px] shrink-0">
          {muestraEleccion(fila) ? (
            <CeldaEleccion estado={estado} fila={fila} dispatch={dispatch} inerte={inerte} onSolicitar={solicitar} />
          ) : (
            <ComboNavy
              aria-label={`SKU de ${tipo}`}
              valor={fila.idCom === null ? null : String(fila.idCom)}
              opciones={opcionesSku(fila, prefijo === PREFIJO_CHASIS ? chasisResaltados(estado) : new Set())}
              onChange={(valor) => dispatch({ tipo: 'CAMBIAR_SKU', prefijo, idCom: Number(valor) })}
              textoVacio={PREFIJOS_CON_COLOR.includes(prefijo) && fila.opciones.length > 0 && fila.rol === 'normal' ? TEXTO_SIN_COLOR : '—'}
              ancho={240}
              tamanoTexto={11}
              visibles={8}
              disabled={inerte || !fila.controles.sku}
            />
          )}
        </div>
        <span data-testid={`stock-${prefijo}`} className={cn('w-[70px] shrink-0 px-2.5 text-center text-[12px]', prevision !== null && ['font-bold', COLOR_TENDENCIA[prevision.tendencia]])}>
          {prevision !== null ? prevision.texto : (stock ?? '—')}
        </span>
        <CeldaPieza fila={fila} dispatch={dispatch} inerte={inerte} />
        <div className="flex w-[250px] max-w-[250px] shrink-0 items-center gap-1 px-2.5">
          {fila.observacion === null ? (
            <button
              type="button"
              disabled={inerte || !fila.controles.observacion}
              onClick={() => setDialogoObservacion(true)}
              className="flex h-[27px] cursor-pointer items-center gap-1.5 rounded-none bg-form-obs-bg px-2.5 py-1 text-[11px] text-gris-disabled disabled:cursor-default disabled:opacity-40"
            >
              <img src="/editar.png" alt="" className="h-3.5 w-3.5" />
              Añadir observación
            </button>
          ) : (
            <>
              <span title={fila.observacion} className="min-w-0 truncate text-[12px] text-texto-incidencia">{fila.observacion}</span>
              <button
                type="button"
                aria-label={`Borrar observación de ${tipo}`}
                disabled={inerte || !fila.controles.observacion}
                onClick={() => dispatch({ tipo: 'BORRAR_OBSERVACION', prefijo })}
                className="shrink-0 cursor-pointer bg-transparent px-1 py-0.5 disabled:cursor-default disabled:opacity-40"
              >
                <img src="/borrar.png" alt="" className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        <div className="ml-auto shrink-0 pr-2.5">
          <BotonDerechoFila boton={botonDerecho(estado, fila)} prefijo={prefijo} onGuardarFila={onGuardarFila} />
        </div>
      </div>
      {children}
      <DialogoObservacionFila
        abierto={dialogoObservacion}
        tipo={tipo}
        inicial={fila.observacion ?? ''}
        onGuardar={(texto) => { dispatch({ tipo: 'PONER_OBSERVACION', prefijo, texto }); setDialogoObservacion(false) }}
        onCancelar={() => setDialogoObservacion(false)}
      />
      <DialogoSolicitarPieza
        abierto={dialogoSolicitar}
        tipo={tipo}
        variante="sinStock"
        stock={0}
        inicial=""
        onConfirmar={(descripcion) => { dispatch({ tipo: 'CONFIRMAR_AGOTADO', prefijo, descripcion }); setDialogoSolicitar(false) }}
        onCancelar={() => setDialogoSolicitar(false)}
      />
    </div>
  )
}
