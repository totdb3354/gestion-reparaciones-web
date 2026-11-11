import { useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { usePonerImei, useRecomendados } from '../api'
import { CLASE_TONO, TEXTO_NIVEL, claseCelda, textoMotivo, tonoFila } from './filas'

export const FONDO: Record<string, string> = {
  aviso: 'bg-form-agotado-bg',
  mal: 'bg-[#FFE0B2]',
}
const NIVEL: Record<1 | 2 | 3, string> = {
  1: 'bg-fila-reparado-bg text-[#2f7d3b]',
  2: 'bg-fila-modificada-bg text-[#00796B]',
  3: 'bg-[#FFE0B2] text-[#B45309]',
}

type Props = { fila: FilaVista; abierta: boolean; marcada?: boolean; elegida?: boolean; onAbrir: (idFila: number, abrir: boolean) => void }

/** La única celda editable de la tabla (spec «Pedidos como la hoja» §3.1 y 6 bis): el IMEI de la fila, con su motivo o su caja.
 *  Al pulsarla (si la fila es editable: todas menos el histórico, enviadas incluidas) se abre el desplegable con el campo, los recomendados y «Quitar el IMEI». El
 *  desplegable es el Popover del proyecto (portal anclado a la celda): no lo recorta el scroll de la tabla, se coloca arriba
 *  si abajo no cabe y acompaña a su celda cuando la tabla se desplaza. Escape y el clic fuera lo cierran (lo hace Radix, que
 *  además devuelve el foco a la celda). */
export function CeldaImei({ fila, abierta, marcada, elegida, onAbrir }: Props) {
  const clase = claseCelda(fila)
  const motivo = textoMotivo(fila)
  const boton = (
    <button type="button" title={[fila.imei ?? 'pulsa para poner el IMEI…', motivo ?? fila.caja].filter(Boolean).join(' · ')}
      className={cn('flex min-h-8 w-full cursor-pointer items-center gap-2 px-2.5 py-1 text-left font-mono text-[12.5px] hover:outline-2 hover:-outline-offset-2 hover:outline-[#9db8e8]',
        clase === 'vacia' && 'font-sans italic text-texto-sub')}>
      <span className="shrink-0">{fila.imei ?? 'pulsa para poner el IMEI…'}</span>
      {motivo && (
        <span className={cn('min-w-0 truncate font-sans text-[11px] font-bold', clase === 'aviso' ? 'text-form-agotado-text' : 'text-[#B45309]')}>{motivo}</span>
      )}
      {!motivo && fila.caja && <span className="min-w-0 truncate font-sans text-[11px] text-azul-gris">{fila.caja}</span>}
    </button>
  )
  const tono = tonoFila(fila)
  return (
    <td data-imei className={cn('relative overflow-hidden p-0', FONDO[clase] ?? (tono && CLASE_TONO[tono]),
      elegida && 'shadow-[inset_0_1px_0_#2f6fe0,inset_0_-1px_0_#2f6fe0]')}>
      {/* La raya azul es solo color: este texto la dice a quien no la ve. Es `absolute` (sr-only): la celda es `relative` para que
          se quede dentro de ella; si no, cuelga del documento y lo alarga tanto como la tabla (se podia desplazar la pagina entera). */}
      {marcada && <span className="sr-only">Última fila abierta</span>}
      {!fila.editable ? (
        // Sin edición (el histórico): solo el texto; sin IMEI, la celda queda vacía, sin invitar a ponerlo.
        fila.imei && <span className="flex min-h-8 items-center px-2.5 py-1 font-mono text-[12.5px]">{fila.imei}</span>
      ) : (
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
            className="w-[600px] max-w-[calc(100vw-16px)] rounded-lg border-azul-medio bg-superficie p-2 whitespace-normal shadow-[0_8px_24px_rgba(0,18,50,.25)]">
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
  const [claves] = useState(() => crearClavesIdempotencia())

  // Si falla, la política global ya abre el diálogo de error: el desplegable se queda abierto para reintentar.
  const guardar = (imei: string | null) => {
    if (poner.isPending) return
    const operacion = `imei:${fila.idFila}`
    poner.mutate({ idFila: fila.idFila, imei, clave: claves.para(operacion, { imei }) }, { onSuccess: () => { claves.hecha(operacion); onCerrar() } })
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
      <div className="mt-1.5 mb-1 px-0.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">Recomendados{fila.sku && <> para <span className="font-mono normal-case">{fila.sku}</span></>} · dónde buscarlo</div>
      {recomendados.isPending && <p className="px-2 py-1.5 text-[12px] text-azul-gris">Cargando…</p>}
      {recomendados.isError && <p className="px-2 py-1.5 text-[12px] text-azul-gris">No se pudieron cargar los recomendados.</p>}
      {recomendados.data?.length === 0 && (
        <p className="px-2 py-1.5 text-[12px] text-azul-gris">No hay ningún móvil de ese modelo y capacidad libre en stock.</p>
      )}
      {recomendados.data?.map((c) => (
        <button key={c.imei} type="button" disabled={poner.isPending} onClick={() => guardar(c.imei)}
          className="grid w-full cursor-pointer grid-cols-[112px_118px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-seleccion-suave">
          {/* Lo que la persona se lleva al almacén es la caja: va delante y resaltada. */}
          <span title={c.caja ?? undefined} className="truncate rounded-md bg-[#eef0f3] px-2 py-px font-bold">{c.caja}</span>
          <span className="font-mono text-[12.5px] font-bold">{c.imei}</span>
          <span className="font-mono text-[11.5px] [overflow-wrap:anywhere] text-azul-gris">{c.nivel === 3 && <>es {c.sku}</>}</span>
          <span className={cn('rounded-lg px-2 py-px text-[11px] font-bold whitespace-nowrap', NIVEL[c.nivel as 1 | 2 | 3])}>{TEXTO_NIVEL[c.nivel as 1 | 2 | 3]}</span>
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
