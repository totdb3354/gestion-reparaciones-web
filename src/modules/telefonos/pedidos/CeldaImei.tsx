import { useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { usePonerImei, useRecomendados } from '../api'
import { TEXTO_NIVEL, claseCelda, textoMotivo } from './filas'

const FONDO: Record<string, string> = {
  aviso: 'bg-form-agotado-bg',
  mal: 'bg-[#FFE0B2]',
}
const NIVEL: Record<1 | 2 | 3, string> = {
  1: 'bg-fila-reparado-bg text-[#2f7d3b]',
  2: 'bg-fila-modificada-bg text-[#00796B]',
  3: 'bg-[#FFE0B2] text-[#B45309]',
}

type Props = { fila: FilaVista; abierta: boolean; onAbrir: (idFila: number, abrir: boolean) => void }

/** La única celda editable de la tabla (spec «Pedidos como la hoja» §3.1): el IMEI de la fila, con su motivo o su caja. Al
 *  pulsarla (si la fila no está enviada) se abre el desplegable con el campo, los recomendados y «Quitar el IMEI». El
 *  desplegable es el Popover del proyecto (portal anclado a la celda): no lo recorta el scroll de la tabla, se coloca arriba
 *  si abajo no cabe y acompaña a su celda cuando la tabla se desplaza. Escape y el clic fuera lo cierran (lo hace Radix, que
 *  además devuelve el foco a la celda). */
export function CeldaImei({ fila, abierta, onAbrir }: Props) {
  const clase = claseCelda(fila)
  const motivo = textoMotivo(fila)
  const boton = (
    <button type="button" disabled={clase === 'enviada'}
      className={cn('flex min-h-8 w-full items-center gap-2 px-2.5 py-1 text-left font-mono text-[12.5px]',
        clase === 'enviada' ? 'cursor-default' : 'cursor-pointer hover:outline-2 hover:-outline-offset-2 hover:outline-[#9db8e8]',
        clase === 'vacia' && 'font-sans italic text-texto-sub')}>
      {fila.imei ?? 'pulsa para poner el IMEI…'}
      {clase !== 'enviada' && motivo && (
        <span className={cn('font-sans text-[11px] font-bold', clase === 'aviso' ? 'text-form-agotado-text' : 'text-[#B45309]')}>{motivo}</span>
      )}
      {clase !== 'enviada' && !motivo && fila.caja && <span className="font-sans text-[11px] text-azul-gris">{fila.caja}</span>}
    </button>
  )
  return (
    <td className={cn('min-w-[290px] p-0', FONDO[clase])}>
      {clase === 'enviada' ? boton : (
        <Popover open={abierta} onOpenChange={(o) => onAbrir(fila.idFila, o)}>
          <PopoverTrigger asChild>{boton}</PopoverTrigger>
          <PopoverContent align="start" sideOffset={2} collisionPadding={8} hideWhenDetached aria-label="Poner el IMEI"
            // Pasar el foco a otro sitio no lo cierra (si falla el PUT, el diálogo de error roba el foco; y al pulsar otra celda, la
            // que se cierra devolvía el foco a la suya y cerraba la nueva). Lo cierran Escape, el clic fuera y «Cerrar»; el
            // diálogo de error tampoco cuenta como «fuera».
            onFocusOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => { if ((e.target as Element | null)?.closest?.('[role="dialog"],[role="alertdialog"]')) e.preventDefault() }}
            // Al cerrar, el foco vuelve a la celda, salvo que ya esté en el desplegable de otra celda recién abierta.
            onCloseAutoFocus={(e) => { if (document.activeElement?.closest('[data-slot="popover-content"]')) e.preventDefault() }}
            className="w-[470px] max-w-[calc(100vw-16px)] rounded-lg border-azul-medio bg-superficie p-2 whitespace-normal shadow-[0_8px_24px_rgba(0,18,50,.25)]">
            <Desplegable fila={fila} onCerrar={() => onAbrir(fila.idFila, false)} />
          </PopoverContent>
        </Popover>
      )}
    </td>
  )
}

function Desplegable({ fila, onCerrar }: { fila: FilaVista; onCerrar: () => void }) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recomendados = useRecomendados(fila.idFila)
  const poner = usePonerImei()

  // Si falla, la política global ya abre el diálogo de error: el desplegable se queda abierto para reintentar.
  const guardar = (imei: string | null) => {
    if (poner.isPending) return
    poner.mutate({ idFila: fila.idFila, imei }, { onSuccess: onCerrar })
  }
  const enviar = () => {
    const imei = texto.trim()
    if (!/^\d{15}$/.test(imei)) { setError('Un IMEI son 15 cifras'); return }
    setError(null)
    guardar(imei)
  }

  return (
    <div>
      <input autoFocus aria-label="IMEI" inputMode="numeric" placeholder="Escribe o lee el IMEI y pulsa Enter" value={texto}
        readOnly={poner.isPending}
        onChange={(e) => { setTexto(e.target.value); setError(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar() } }}
        className="h-8 w-full rounded-md border border-borde-input px-2 font-mono text-[13px]" />
      {error && <p role="alert" className="mt-1 text-[12px] font-bold text-texto-error">{error}</p>}
      <div className="mt-1.5 mb-1 px-0.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">Recomendados{fila.sku ? ` para ${fila.sku}` : ''}</div>
      {recomendados.isPending && <p className="px-2 py-1.5 text-[12px] text-azul-gris">Cargando…</p>}
      {recomendados.isError && <p className="px-2 py-1.5 text-[12px] text-azul-gris">No se pudieron cargar los recomendados.</p>}
      {recomendados.data?.length === 0 && (
        <p className="px-2 py-1.5 text-[12px] text-azul-gris">No hay ningún móvil de ese modelo, capacidad y color libre en stock.</p>
      )}
      {recomendados.data?.map((c) => (
        <button key={c.imei} type="button" disabled={poner.isPending} onClick={() => guardar(c.imei)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-seleccion-suave">
          <span className="font-mono text-[12.5px] font-bold">{c.imei}</span>
          <span>{c.caja}</span>
          {c.nivel === 3 && <span className="text-azul-gris">es {c.sku}</span>}
          <span className={cn('ml-auto rounded-lg px-2 py-px text-[11px] font-bold', NIVEL[c.nivel as 1 | 2 | 3])}>{TEXTO_NIVEL[c.nivel as 1 | 2 | 3]}</span>
        </button>
      ))}
      <div className="mt-1.5 flex gap-2">
        {fila.imei && (
          <button type="button" disabled={poner.isPending} onClick={() => guardar(null)}
            className="h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold">Quitar el IMEI</button>
        )}
        <button type="button" onClick={onCerrar}
          className="h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold">Cerrar</button>
      </div>
    </div>
  )
}
