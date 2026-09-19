import { useState, type Dispatch, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { claseStock } from '../lib/piezas'
import { DialogoObservacionFila } from './DialogoObservacionFila'
import { botonDerecho, filaSinSku, stockDe, type AccionFormulario, type BotonDerecho, type EstadoFormulario, type FilaEstado } from './estado'

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

function estadoDeFila(fila: FilaEstado): EstadoFila {
  if (fila.guardada !== null) return 'guardada'
  if (filaSinSku(fila)) return 'sinSku'
  if (fila.rol === 'editada') return 'editada'
  if (fila.rol === 'yaReparado') return 'yaReparado'
  return 'normal'
}

/** Etiqueta deshabilitada del botón derecho ("✓ Guardada …", "⚠ En camino", "✓ Recibido"): 11 px, radio 0, padding 4 10, con sus
 *  colores aunque esté disabled. */
const CLASE_ETIQUETA = 'h-[27px] rounded-none px-2.5 py-1 text-[11px]'

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
    // 'yaReparado' pendiente de la Task 18.
    default:
      return null
  }
}

/** Una fila de componente: contador con "+" y "-", nombre, combo SKU, stock, "Reutilizado", observación y botón derecho; debajo,
 *  `children` (la sub-fila de agotado). No decide nada: el habilitado sale de `fila.controles` (una fila sin SKU para el modelo o
 *  ya guardada se pinta siempre deshabilitada), el botón derecho de `botonDerecho()` y cada gesto es un `dispatch`. */
export function FilaComponente({ estado, fila, dispatch, onGuardarFila, children }: Props) {
  const [dialogoObservacion, setDialogoObservacion] = useState(false)
  const { prefijo, nombre: tipo } = fila
  const estadoFila = estadoDeFila(fila)
  const inerte = estadoFila === 'sinSku' || estadoFila === 'guardada'
  const stock = stockDe(fila)
  const clasesMasMenos = 'h-[18px] w-[35px] cursor-pointer rounded-none bg-gris-borde p-0 text-[14px] leading-none font-bold text-gris-disabled disabled:cursor-default disabled:opacity-40'

  return (
    <div data-testid={`fila-${prefijo}`} data-estado={estadoFila} className={cn('border-b', CLASES_ESTADO[estadoFila])}>
      <div className="flex min-h-[37px] items-center">
        <div className="flex w-[70px] shrink-0 items-center">
          <span data-testid={`contador-${prefijo}`} className={cn('w-[34px] text-center font-[family-name:Inter,system-ui,sans-serif] text-[20px] font-normal', fila.cantidad > 0 ? 'text-texto-incidencia' : 'text-gris-borde')}>
            {fila.cantidad}
          </span>
          <div className="flex w-[35px] flex-col">
            <button type="button" aria-label={`Sumar ${tipo}`} disabled={inerte || !fila.controles.mas} onClick={() => dispatch({ tipo: 'SUMAR', prefijo })} className={clasesMasMenos}>+</button>
            <button type="button" aria-label={`Restar ${tipo}`} disabled={inerte || !fila.controles.menos} onClick={() => dispatch({ tipo: 'RESTAR', prefijo })} className={clasesMasMenos}>-</button>
          </div>
        </div>
        <span className="w-[100px] shrink-0 px-2.5 text-[12px]">{tipo}</span>
        <div className="w-[170px] shrink-0">
          <ComboNavy
            aria-label={`SKU de ${tipo}`}
            valor={fila.idCom === null ? null : String(fila.idCom)}
            opciones={fila.opciones.map((c) => ({ valor: String(c.idCom), etiqueta: c.tipo, clase: claseStock(c) }))}
            onChange={(valor) => dispatch({ tipo: 'CAMBIAR_SKU', prefijo, idCom: Number(valor) })}
            textoVacio="—"
            ancho={170}
            tamanoTexto={11}
            visibles={8}
            disabled={inerte || !fila.controles.sku}
          />
        </div>
        <span data-testid={`stock-${prefijo}`} className="w-[70px] shrink-0 px-2.5 text-center text-[12px]">{stock ?? '—'}</span>
        <label className="flex w-[110px] shrink-0 items-center gap-1.5 px-2.5 text-[12px]">
          <Checkbox
            aria-label={`Reutilizado ${tipo}`}
            checked={fila.reutilizado}
            disabled={inerte || !fila.controles.reutilizado}
            onCheckedChange={(valor) => dispatch({ tipo: 'MARCAR_REUTILIZADO', prefijo, valor: valor === true })}
          />
          Reutilizado
        </label>
        <div className="flex w-[280px] max-w-[280px] shrink-0 items-center gap-1 px-2.5">
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
    </div>
  )
}
