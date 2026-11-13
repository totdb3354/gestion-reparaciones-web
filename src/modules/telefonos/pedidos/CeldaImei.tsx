import { useEffect, useRef, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { cn } from '@/shared/lib/utils'
import { StaleDataError, mensajeDeError } from '@/shared/api/errors'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { usePonerImei, useRecomendados } from '../api'
import { estadoPedidos, type FalloImei } from './estado'
import { CIFRAS_IMEI, QUIETO_MS, SUSTITUIR_MS, luhnCuadra } from './imei'
import { EditorMarca } from './EditorMarca'
import { CLASE_TONO, TEXTO_NIVEL, claseCelda, colorMarca, textoMarca, textoMotivo, tonoFila } from './filas'

export const FONDO: Record<string, string> = {
  aviso: 'bg-form-agotado-bg',
  mal: 'bg-[#FFE0B2]',
}
const NIVEL: Record<1 | 2 | 3, string> = {
  1: 'bg-fila-reparado-bg text-[#2f7d3b]',
  2: 'bg-fila-modificada-bg text-[#00796B]',
  3: 'bg-[#FFE0B2] text-[#B45309]',
}

type Props = {
  fila: FilaVista; abierta: boolean; marcada?: boolean
  /** El último guardado de esta celda falló: se ve en rojo hasta que se guarde bien. */
  fallo?: FalloImei
  onAbrir: (idFila: number, abrir: boolean) => void
  /** Al guardar un IMEI tecleado o leído: abre la celda vacía siguiente y dice si la hay (si no, la celda actual se cierra al guardar). */
  onSaltar?: (idFila: number) => boolean
}

/** La única celda editable de la tabla (spec «Pedidos como la hoja» §3.1 y 6 bis): el IMEI de la fila, con su motivo o su caja.
 *  Al pulsarla (si la fila es editable: todas menos el histórico, enviadas incluidas) se abre el desplegable con el campo, los recomendados y «Quitar el IMEI». El
 *  desplegable es el Popover del proyecto (portal anclado a la celda): no lo recorta el scroll de la tabla, se coloca arriba
 *  si abajo no cabe y acompaña a su celda cuando la tabla se desplaza. Escape y el clic fuera lo cierran (lo hace Radix, que
 *  además devuelve el foco a la celda). */
export function CeldaImei({ fila, abierta, marcada, fallo, onAbrir, onSaltar }: Props) {
  const clase = claseCelda(fila)
  const motivo = textoMotivo(fila)
  // Un guardado fallido deja la celda en rojo (con el texto, que no depende del color) hasta que se guarde bien o se recargue la página.
  const textoFallo = fallo ? (fallo.imei ? `No se guardó …${fallo.imei.slice(-4)} · pulsa para reintentar` : 'No se quitó el IMEI · pulsa para reintentar') : ''
  // La marca (con su nota al pasar el ratón) ocupa, sin IMEI, el sitio de «pulsa para poner el IMEI…»; con IMEI va tras él.
  const marca = fila.marca ? (fila.marcaNota ? `${textoMarca(fila.marca)} — ${fila.marcaNota}` : textoMarca(fila.marca)) : null
  const boton = (
    <button type="button" title={fallo ? textoFallo : [fila.imei ?? (marca ? null : 'pulsa para poner el IMEI…'), marca, motivo ?? fila.caja].filter(Boolean).join(' · ')}
      className={cn('flex min-h-8 w-full cursor-pointer items-center gap-2 px-2.5 py-1 text-left font-mono text-[12.5px] hover:outline-2 hover:-outline-offset-2 hover:outline-[#9db8e8]',
        clase === 'vacia' && 'font-sans italic text-texto-sub')}>
      {fallo
        ? <span className="min-w-0 truncate font-sans text-[12px] font-bold text-texto-error">{textoFallo}</span>
        : (fila.imei || !fila.marca) && <span className="shrink-0">{fila.imei ?? 'pulsa para poner el IMEI…'}</span>}
      {!fallo && fila.marca && (
        <span data-marca={fila.marca} className={cn('inline-block shrink-0 rounded-lg px-2 py-px font-sans text-[11px] font-bold not-italic', colorMarca(fila.marca))}>{textoMarca(fila.marca)}</span>
      )}
      {!fallo && motivo && (
        <span className={cn('min-w-0 truncate font-sans text-[11px] font-bold', clase === 'aviso' ? 'text-form-agotado-text' : 'text-[#B45309]')}>{motivo}</span>
      )}
      {!fallo && !motivo && fila.caja && <span className="min-w-0 truncate font-sans text-[11px] text-azul-gris">{fila.caja}</span>}
    </button>
  )
  const tono = tonoFila(fila)
  return (
    // Mismos bordes (derecho e inferior) que el resto de celdas: la cuadrícula no se interrumpe en ningún estado. Dentro de la fila
    // marcada, el fondo de aviso de esta celda gana al azul suave.
    <td data-imei className={cn('relative overflow-hidden border-r border-b border-form-fila-brd p-0 last:border-r-0',
      fallo ? 'bg-[#FDE2E2]' : FONDO[clase] ?? cn(tono && CLASE_TONO[tono], marcada && 'bg-seleccion-suave'))}>
      {/* La raya azul es solo color: este texto la dice a quien no la ve. Es `absolute` (sr-only): la celda es `relative` para que
          se quede dentro de ella; si no, cuelga del documento y lo alarga tanto como la tabla (se podia desplazar la pagina entera). */}
      {marcada && <span className="sr-only">Fila en la que estás</span>}
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
            className="w-auto max-w-[calc(100vw-16px)] rounded-lg border-azul-medio bg-superficie p-2 whitespace-normal shadow-[0_8px_24px_rgba(0,18,50,.25)]">
            <Desplegable fila={fila} fallo={fallo} onCerrar={() => onAbrir(fila.idFila, false)} onSaltar={onSaltar ? () => onSaltar(fila.idFila) : undefined} />
          </PopoverContent>
        </Popover>
      )}
    </td>
  )
}

const MENSAJE_ERROR = {
  mas: `Hay más de ${CIFRAS_IMEI} cifras: lee un solo IMEI`,
  luhn: 'La cifra de control no cuadra: revisa el IMEI',
  corto: `Un IMEI son ${CIFRAS_IMEI} cifras`,
} as const
type ErrorImei = keyof typeof MENSAJE_ERROR

function Desplegable({ fila, fallo, onCerrar, onSaltar }: { fila: FilaVista; fallo?: FalloImei; onCerrar: () => void; onSaltar?: () => boolean }) {
  // Si esta celda falló antes y se reabre, el campo viene con ese IMEI y Enter reintenta con la misma clave.
  const [texto, setTexto] = useState(fallo?.imei ?? '')
  const [error, setError] = useState<ErrorImei | null>(null)
  // Los recomendados no se piden ni se enseñan hasta que se desplieguen; cada vez que se abre una celda empieza plegado.
  const [ver, setVer] = useState(false)
  const recomendados = useRecomendados(fila.idFila, ver)
  const poner = usePonerImei()
  const [claves] = useState(() => crearClavesIdempotencia())
  // Lo que la fila tenía en pantalla al abrir la celda: el servidor lo compara con lo que hay (409 si otra persona lo cambió).
  const [anterior] = useState(() => fila.imei ?? '')
  // Hay un guardado en vuelo. Es una referencia y no `poner.isPending` porque un lector de códigos teclea las cifras y su Enter de
  // golpe: ese Enter llega antes de que React haya pintado el estado «pendiente» y no debe mandar un segundo guardado.
  const enCurso = useRef(false)
  // Instante de la última entrada (para distinguir una lectura nueva de la continuación de la anterior) y temporizador del momento quieto.
  const ultimaEntrada = useRef(0)
  const quieto = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(quieto.current), [])

  // Si falla, NO sale el diálogo global (es modal, roba el foco en mitad de una lectura y no dice de qué pedido es): el fallo se apunta en
  // `estadoPedidos` (celda en rojo + aviso con el pedido) con la clave de idempotencia, para reintentar con la misma. Con `salto` (IMEI
  // tecleado o leído) la celda siguiente vacía se abre al momento, sin esperar al servidor, y esta se desmonta con el guardado en vuelo:
  // por eso todo va en la promesa (`mutateAsync`) y no en los callbacks de `mutate`, que un componente desmontado no recibe. Sin celda a
  // la que saltar (o si se eligió un recomendado, o «Quitar»), se cierra al guardar y, si falla, se queda abierta para reintentar con Enter.
  const guardar = (imei: string | null, salto = false) => {
    if (enCurso.current || poner.isPending) return
    enCurso.current = true
    const idFila = fila.idFila
    const operacion = `imei:${idFila}`
    const clave = fallo && fallo.imei === imei ? fallo.clave : claves.para(operacion, { imei })
    const salta = salto && !!onSaltar && onSaltar()
    poner.mutateAsync({ idFila, imei, imeiAnterior: anterior, clave }).then(
      () => {
        claves.hecha(operacion); enCurso.current = false
        estadoPedidos.set((s) => {
          if (!(idFila in s.fallosImei)) return s
          const resto = { ...s.fallosImei }
          delete resto[idFila]
          return { ...s, fallosImei: resto }
        })
        if (!salta) onCerrar()
      },
      (e: unknown) => {
        enCurso.current = false
        if (e instanceof StaleDataError) {
          // 409: otra persona cambió el IMEI. Reintentar mandaría el mismo `imeiAnterior` y volvería a fallar: no queda estado de fallo
          // (el hook ya recarga las filas en el acto, para ver el IMEI de la otra persona) y solo sale el aviso. La celda se cierra
          // (si se saltó, ya está cerrada): al reabrirla toma el IMEI de ahora.
          const aviso = `Pedido ${fila.pedido ?? idFila}: ${mensajeDeError(e)}`
          estadoPedidos.set((s) => {
            const resto = { ...s.fallosImei }
            delete resto[idFila]
            return { ...s, fallosImei: resto, avisoImei: aviso }
          })
          if (!salta) onCerrar()
          return
        }
        const mensaje = `No se guardó el IMEI del pedido ${fila.pedido ?? idFila}. Vuelve a abrir su celda.`
        estadoPedidos.set((s) => ({ ...s, fallosImei: { ...s.fallosImei, [idFila]: { imei, clave, mensaje } }, avisoImei: mensaje }))
      },
    )
  }
  // Antes de guardar un IMEI de 15 cifras (solo o con Enter) se comprueba su cifra de control. Un IMEI que ya falló al guardar (pasó la
  // comprobación o se guardó igualmente) no se vuelve a comprobar: Enter lo reintenta.
  const comprobarYGuardar = (cifras: string) => {
    if (!(fallo && fallo.imei === cifras) && !luhnCuadra(cifras)) { setError('luhn'); return }
    setError(null)
    guardar(cifras, true)
  }
  const enviar = () => {
    if (enCurso.current) return
    clearTimeout(quieto.current)
    // El Enter que manda el lector llega a la celda recién abierta, vacía: no es un error.
    if (texto.length === 0) return
    if (texto.length > CIFRAS_IMEI) { setError('mas'); return }
    if (texto.length < CIFRAS_IMEI) { setError('corto'); return }
    // El Enter NO fuerza un IMEI con la cifra de control mala: el lector manda su Enter solo y anularía la comprobación.
    comprobarYGuardar(texto)
  }
  // Solo cifras (también al pegar, y sin los espacios o saltos que pueda mandar el lector). NO se corta: con más de 15 es un error (dos
  // IMEI en un código, o cifras de más) y no se guarda. Con exactamente 15 se espera un momento quieto (QUIETO_MS) antes de guardar, para
  // que toda la ráfaga del lector, y su Enter, caiga en esta celda; si llega más entrada, el temporizador se anula.
  // En error, una entrada que llega tras una pausa (SUSTITUIR_MS) es otra lectura: sustituye a lo que había.
  const cambiar = (valor: string) => {
    if (enCurso.current) return
    const ahora = Date.now()
    const pausa = ahora - ultimaEntrada.current
    ultimaEntrada.current = ahora
    clearTimeout(quieto.current)
    let cifras = valor.replace(/\D/g, '')
    if ((error === 'mas' || error === 'luhn') && pausa >= SUSTITUIR_MS && valor.startsWith(texto)) {
      const nuevas = valor.slice(texto.length).replace(/\D/g, '')
      if (nuevas !== '') cifras = nuevas
    }
    setTexto(cifras)
    if (cifras.length > CIFRAS_IMEI) { setError('mas'); return }
    setError(null)
    if (cifras.length === CIFRAS_IMEI) quieto.current = setTimeout(() => comprobarYGuardar(cifras), QUIETO_MS)
  }
  const roja = error === 'mas' || error === 'luhn'

  return (
    <div className={ver ? 'w-[680px] max-w-full' : 'w-[360px] max-w-full'}>
      <div className="relative">
        <input autoFocus aria-label="IMEI" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
          placeholder="Lee o escribe el IMEI (15 cifras)" value={texto}
          readOnly={poner.isPending}
          onChange={(e) => cambiar(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar() } }}
          className="h-8 w-full rounded-md border border-borde-input pr-14 pl-2 font-mono text-[13px]" />
        {/* El contador es solo una ayuda a la vista: oculto al lector de pantalla para que no lea cada cifra. */}
        <span aria-hidden="true" data-contador className={cn('pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[11px]', roja ? 'font-bold text-texto-error' : 'text-azul-gris')}>{texto.length}/{CIFRAS_IMEI}</span>
      </div>
      {error && <p role="alert" className="mt-1 text-[12px] font-bold text-texto-error">{MENSAJE_ERROR[error]}</p>}
      {error === 'luhn' && (
        <button type="button" onClick={() => guardar(texto)}
          className="mt-1 h-6 cursor-pointer rounded-md border border-borde-input bg-superficie px-2 text-[11.5px] font-semibold">Guardar igualmente</button>
      )}
      {/* Debajo del campo y sin enfocarse solo: el foco se queda en el IMEI para el lector de códigos. */}
      <EditorMarca fila={fila} onHecho={onCerrar} />
      <button type="button" aria-expanded={ver} onClick={() => setVer((v) => !v)}
        className="mt-1 cursor-pointer bg-transparent px-0.5 text-[11.5px] text-azul-medio underline underline-offset-2">{ver ? 'Ocultar recomendados' : 'Ver recomendados'}</button>
      {ver && <>
      <div className="mt-1 mb-1 px-0.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">Recomendados{fila.sku && <> para <span className="font-mono normal-case">{fila.sku}</span></>} · dónde buscarlo</div>
      {recomendados.isPending && <p className="px-2 py-1.5 text-[12px] text-azul-gris">Cargando…</p>}
      {recomendados.isError && <p className="px-2 py-1.5 text-[12px] text-azul-gris">No se pudieron cargar los recomendados.</p>}
      {recomendados.data?.length === 0 && (
        <p className="px-2 py-1.5 text-[12px] text-azul-gris">No hay ningún móvil de ese modelo y capacidad libre en stock.</p>
      )}
      {recomendados.data?.map((c) => (
        <button key={c.imei} type="button" disabled={poner.isPending} onClick={() => guardar(c.imei)}
          className="grid w-full cursor-pointer grid-cols-[150px_118px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-seleccion-suave">
          {/* Lo que la persona se lleva al almacén es la caja: va delante y resaltada. */}
          <span className="justify-self-start rounded-md bg-[#eef0f3] px-2 py-px font-bold [overflow-wrap:anywhere]">{c.caja}</span>
          <span className="font-mono text-[12.5px] font-bold">{c.imei}</span>
          <span className="font-mono text-[11.5px] [overflow-wrap:anywhere] text-azul-gris">{c.nivel === 3 && (c.sku ? <>es {c.sku}</> : <span className="font-sans italic">SKU sin identificar</span>)}</span>
          <span className={cn('rounded-lg px-2 py-px text-[11px] font-bold whitespace-nowrap', NIVEL[c.nivel as 1 | 2 | 3])}>{TEXTO_NIVEL[c.nivel as 1 | 2 | 3]}</span>
        </button>
      ))}
      </>}
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
