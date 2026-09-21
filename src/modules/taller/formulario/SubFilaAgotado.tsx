import { useState, type Dispatch } from 'react'
import { cn } from '@/shared/lib/utils'
import { DialogoDescripcionSolicitud } from './DialogoDescripcionSolicitud'
import { DialogoSolicitarPieza } from './DialogoSolicitarPieza'
import { subFila, TEXTO_LIMITE, TEXTO_SIN_STOCK, type AccionFormulario, type EstadoFormulario, type FilaEstado } from './estado'

type Props = { estado: EstadoFormulario; fila: FilaEstado; dispatch: Dispatch<AccionFormulario> }

/** Sub-fila de agotado bajo una fila (sangría de 70 px). `subFila()` decide si existe, la variante, el texto confirmado y si el
 *  lápiz funciona (solo sobre la solicitud local; la ya guardada en el servidor lo muestra deshabilitado). Confirmar, editar la
 *  descripción y cancelar son acciones locales del reductor: aquí no se llama al servidor. */
export function SubFilaAgotado({ estado, fila, dispatch }: Props) {
  const [dialogo, setDialogo] = useState<'ninguno' | 'solicitar' | 'descripcion'>('ninguno')
  const sub = subFila(estado, fila)
  if (sub.tipo === 'oculta') return null
  const { prefijo, nombre: tipo } = fila
  const cerrar = () => setDialogo('ninguno')

  return (
    <div
      data-testid={`subfila-${prefijo}`}
      data-variante={sub.tipo}
      className={cn('flex items-center gap-2.5 py-1 pr-2 pl-[70px]', sub.tipo === 'confirmada' ? 'bg-recibido-bg' : 'bg-form-agotado-bg')}
    >
      <span className={cn('text-[11px] whitespace-pre-wrap', sub.tipo === 'confirmada' ? 'font-bold text-recibido-text' : 'text-form-agotado-text')}>
        {sub.tipo === 'confirmada' ? sub.texto : sub.tipo === 'limite' ? TEXTO_LIMITE : TEXTO_SIN_STOCK}
      </span>
      {sub.tipo === 'confirmada' ? (
        <button
          type="button"
          aria-label={`Editar descripción de solicitud de ${tipo}`}
          disabled={!sub.lapizHabilitado}
          onClick={() => setDialogo('descripcion')}
          className={cn('bg-transparent px-1 py-0.5', sub.lapizHabilitado ? 'cursor-pointer' : 'cursor-default')}
        >
          <img src="/editar.png" alt="" className="h-4 w-4" />
        </button>
      ) : (
        <button type="button" onClick={() => setDialogo('solicitar')} className="cursor-pointer rounded bg-ambar px-2.5 py-1 text-[11px] text-superficie">
          {sub.tipo === 'limite' ? 'Solicitar y descontar stock' : 'Solicitar pieza'}
        </button>
      )}
      <DialogoSolicitarPieza
        abierto={dialogo === 'solicitar'}
        tipo={tipo}
        variante={sub.tipo === 'limite' ? 'limite' : 'sinStock'}
        stock={sub.tipo === 'limite' ? sub.stock : 0}
        inicial={fila.agotado?.descripcion ?? ''}
        onConfirmar={(descripcion) => { dispatch({ tipo: 'CONFIRMAR_AGOTADO', prefijo, descripcion }); cerrar() }}
        onCancelar={cerrar}
      />
      <DialogoDescripcionSolicitud
        abierto={dialogo === 'descripcion'}
        inicial={fila.agotado?.descripcion ?? ''}
        onGuardar={(descripcion) => { dispatch({ tipo: 'EDITAR_DESCRIPCION_AGOTADO', prefijo, descripcion }); cerrar() }}
        onCancelarSolicitud={() => { dispatch({ tipo: 'CANCELAR_AGOTADO', prefijo }); cerrar() }}
        onCancelar={cerrar}
      />
    </div>
  )
}
