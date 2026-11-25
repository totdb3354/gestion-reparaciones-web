import { Fragment, useEffect, useRef, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import { cn } from '@/shared/lib/utils'
import { StaleDataError, mensajeDeError } from '@/shared/api/errors'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { usePonerImei, useRecomendados } from '../api'
import { estadoPedidos, type FalloImei } from './estado'
import { marcarNoValido, quitarNoValido, textoNoValido, type MotivoNoValido, type NoValido } from './noValidos'
import { CIFRAS_IMEI, QUIETO_MS, SUSTITUIR_MS, luhnCuadra } from './imei'
import { CLASE_TONO, pedidoVisible, TEXTO_NIVEL, claseCelda, estaValidada, lineasAviso, partesAviso, textoMotivoValidado, tonoFila, type ParteAviso } from './filas'

export const FONDO: Record<string, string> = {
  na: 'bg-form-agotado-bg',
  mal: 'bg-[#FFE0B2]',
  rojo: 'bg-[#FFD9D9]',
}
export const TONO_PARTE: Record<ParteAviso['tono'], string> = {
  rojo: 'text-[#B42318]',
  naranja: 'text-[#B45309]',
  ambar: 'text-form-agotado-text',
}
const NIVEL: Record<1 | 2 | 3, string> = {
  1: 'bg-fila-reparado-bg text-[#2f7d3b]',
  2: 'bg-fila-modificada-bg text-[#00796B]',
  3: 'bg-[#FFE0B2] text-[#B45309]',
}

const ROJO = 'bg-[#FDE2E2]'
const MENSAJE_CORTO = `Un IMEI son ${CIFRAS_IMEI} cifras`

type Props = {
  fila: FilaVista; abierta: boolean; marcada?: boolean
  /** El último guardado de esta celda falló: se ve en rojo hasta que se guarde bien. */
  fallo?: FalloImei
  /** La última lectura no era un IMEI válido (no se guardó): rojo hasta poner un IMEI en la fila. */
  noValido?: NoValido
  onAbrir: (idFila: number, abrir: boolean) => void
  /** Tras guardar un IMEI leído (o una lectura no válida): abre la celda vacía siguiente y dice si la hay. */
  onSaltar?: (idFila: number) => boolean
}

/** La única celda editable de la tabla (spec 2026-11-25 §1): en reposo, el IMEI con su aviso o su caja; al pulsarla (si la fila es
 *  editable), la propia celda es el campo, con el contador y el ▾ de los recomendados. Nada flota salvo la lista de recomendados. */
export function CeldaImei({ fila, abierta, marcada, fallo, noValido, onAbrir, onSaltar }: Props) {
  const clase = claseCelda(fila)
  const validada = estaValidada(fila)
  const partes = partesAviso(fila)
  const lineas = lineasAviso(fila)
  const avisoValidado = validada ? `SKU validado${fila.validadaPor ? ` por ${fila.validadaPor}` : ''}: ${textoMotivoValidado(fila) ?? 'aviso de SKU'}` : null
  const textoFallo = fallo ? (fallo.duplicado ? fallo.mensaje : fallo.imei ? `No se guardó …${fallo.imei.slice(-4)} · pulsa para reintentar` : 'No se quitó el IMEI · pulsa para reintentar') : null
  const textosNoValido = noValido ? textoNoValido(noValido) : null
  const rojo = textoFallo ?? textosNoValido?.corto ?? null
  const tituloRojo = textoFallo ?? (textosNoValido ? `${textosNoValido.largo} Pulsa para revisarlo.` : null)
  const botonRef = useRef<HTMLButtonElement>(null)
  // Al cerrar el campo, el foco vuelve a la celda si se quedó en el aire (no si ya está en el campo de otra celda, tras un salto).
  const estabaAbierta = useRef(abierta)
  useEffect(() => {
    if (estabaAbierta.current && !abierta && (!document.activeElement || document.activeElement === document.body)) botonRef.current?.focus()
    estabaAbierta.current = abierta
  }, [abierta])

  const boton = (
    <button ref={botonRef} type="button" onClick={() => onAbrir(fila.idFila, true)}
      title={tituloRojo ?? [fila.imei ?? 'pulsa para poner el IMEI…', avisoValidado, ...lineas, partes.length === 0 && !avisoValidado ? fila.caja : null].filter(Boolean).join('\n')}
      className={cn('flex min-h-8 w-full cursor-pointer items-center gap-2 px-2.5 py-1 text-left font-mono text-[12.5px] hover:outline-2 hover:-outline-offset-2 hover:outline-[#9db8e8]',
        clase === 'vacia' && !rojo && 'font-sans italic text-texto-sub')}>
      {rojo
        ? <span className="min-w-0 truncate font-sans text-[12px] font-bold text-texto-error">{rojo}</span>
        : <span className="shrink-0">{fila.imei ?? 'pulsa para poner el IMEI…'}</span>}
      {!rojo && partes.length > 0 && (
        <span className="min-w-0 truncate font-sans text-[11px] font-bold">
          {partes.map((p: ParteAviso, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="font-normal text-[#b9a27a]"> · </span>}
              <span className={TONO_PARTE[p.tono]}>{p.texto}</span>
            </Fragment>
          ))}
        </span>
      )}
      {!rojo && validada && (
        <span data-validado className="shrink-0 rounded-lg bg-fila-reparado-bg px-1.5 py-px font-sans text-[10.5px] font-bold text-[#2f7d3b]">validado</span>
      )}
      {!rojo && partes.length === 0 && !validada && fila.caja && <span className="min-w-0 truncate font-sans text-[11px] text-azul-gris">{fila.caja}</span>}
    </button>
  )
  const tono = tonoFila(fila)
  return (
    <td data-imei data-editando={abierta || undefined} className={cn('relative overflow-hidden border-r border-b border-form-fila-brd p-0 last:border-r-0',
      rojo ? ROJO : FONDO[clase] ?? cn(tono && CLASE_TONO[tono], marcada && 'bg-seleccion-suave'),
      abierta && cn(rojo ? ROJO : 'bg-superficie', 'outline-2 -outline-offset-2 outline-[#2f6fe0]'))}>
      {/* La raya azul es solo color: este texto la dice a quien no la ve. Es `absolute` (sr-only): la celda es `relative` para que
          se quede dentro de ella; si no, cuelga del documento y lo alarga tanto como la tabla. */}
      {marcada && <span className="sr-only">Fila en la que estás</span>}
      {!fila.editable ? (
        // Sin edición (el histórico): solo el texto; sin IMEI, la celda queda vacía, sin invitar a ponerlo.
        fila.imei && <span className="flex min-h-8 items-center px-2.5 py-1 font-mono text-[12.5px]">{fila.imei}</span>
      ) : abierta ? (
        <CampoImei fila={fila} fallo={fallo} noValido={noValido} onCerrar={() => onAbrir(fila.idFila, false)}
          onSaltar={onSaltar ? () => onSaltar(fila.idFila) : undefined} />
      ) : boton}
    </td>
  )
}

/** Con lo que empieza el texto del 409 del servidor cuando el IMEI ya está en otro pedido. */
const PREFIJO_DUPLICADO = 'Este IMEI ya está'

function CampoImei({ fila, fallo, noValido, onCerrar, onSaltar }: { fila: FilaVista; fallo?: FalloImei; noValido?: NoValido; onCerrar: () => void; onSaltar?: () => boolean }) {
  // Reabrir una celda en rojo trae lo que falló: la lectura no válida (para sustituirla o «Guardar igual») o el IMEI cuyo guardado
  // falló (Enter reintenta con la misma clave).
  const [texto, setTexto] = useState(noValido?.imei ?? (fallo && !fallo.duplicado ? fallo.imei ?? '' : ''))
  const [corto, setCorto] = useState(false)
  const [ver, setVer] = useState(false)
  const recomendados = useRecomendados(fila.idFila, ver)
  const poner = usePonerImei()
  const [claves] = useState(() => crearClavesIdempotencia())
  const [anterior] = useState(() => fila.imei ?? '')
  // Abierta sobre una lectura no válida: es revisión; otra lectura no válida aquí no salta.
  const [revision] = useState(() => !!noValido)
  // Guardado en vuelo (referencia y no `poner.isPending`: el Enter del lector llega antes de que React pinte «pendiente»).
  const enCurso = useRef(false)
  const ultimaEntrada = useRef(0)
  const quieto = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(quieto.current), [])
  // Pulsar fuera de la celda la cierra; no la lista de recomendados ni un diálogo. Perder el foco sin pulsar (otra ventana) no.
  useEffect(() => {
    const alPulsar = (ev: PointerEvent) => {
      const t = ev.target as Element | null
      if (!t || caja.current?.closest('td')?.contains(t)) return
      if (t.closest?.('[data-slot="popover-content"],[role="dialog"],[role="alertdialog"]')) return
      onCerrar()
    }
    document.addEventListener('pointerdown', alPulsar, true)
    return () => document.removeEventListener('pointerdown', alPulsar, true)
  }, [onCerrar])

  // Si falla, NO sale el diálogo global (es modal, roba el foco en mitad de una lectura y no dice de qué pedido es): el fallo se apunta en
  // `estadoPedidos` (celda en rojo + aviso con el pedido) con la clave de idempotencia, para reintentar con la misma. Con `salto` (IMEI
  // tecleado o leído) la celda siguiente vacía se abre al momento, sin esperar al servidor, y esta se desmonta con el guardado en vuelo:
  // por eso todo va en la promesa (`mutateAsync`) y no en los callbacks de `mutate`, que un componente desmontado no recibe. Sin celda a
  // la que saltar (o si se eligió un recomendado, «Guardar igual» o quitar), se cierra al guardar y, si falla, se queda abierta para
  // reintentar con Enter. Guardar bien quita también la marca de lectura no válida de la fila.
  const guardar = (imei: string | null, salto = false) => {
    if (enCurso.current || poner.isPending) return
    enCurso.current = true
    const idFila = fila.idFila
    const operacion = `imei:${idFila}`
    const clave = fallo && !fallo.duplicado && fallo.imei === imei ? fallo.clave : claves.para(operacion, { imei })
    const salta = salto && !!onSaltar && onSaltar()
    poner.mutateAsync({ idFila, imei, imeiAnterior: anterior, clave }).then(
      () => {
        claves.hecha(operacion); enCurso.current = false
        quitarNoValido(idFila)
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
        if (e instanceof StaleDataError && e.message.startsWith(PREFIJO_DUPLICADO)) {
          // 409 por IMEI duplicado: el servidor dice en qué pedido (o fila sin asociar) está ya. La celda queda en rojo con ese texto tal
          // cual; no se reintenta (volvería a fallar) y no hay nada que recargar.
          const mensaje = e.message
          estadoPedidos.set((s) => ({ ...s, fallosImei: { ...s.fallosImei, [idFila]: { imei, clave, mensaje, duplicado: true } }, avisoImei: `Pedido ${pedidoVisible(fila) ?? idFila}: ${mensaje}` }))
          return
        }
        if (e instanceof StaleDataError) {
          // 409: otra persona cambió el IMEI. Reintentar mandaría el mismo `imeiAnterior` y volvería a fallar: no queda estado de fallo
          // (el hook ya recarga las filas en el acto) y solo sale el aviso. La celda se cierra; al reabrirla toma el IMEI de ahora.
          const aviso = `Pedido ${pedidoVisible(fila) ?? idFila}: ${mensajeDeError(e)}`
          estadoPedidos.set((s) => {
            const resto = { ...s.fallosImei }
            delete resto[idFila]
            return { ...s, fallosImei: resto, avisoImei: aviso }
          })
          if (!salta) onCerrar()
          return
        }
        const mensaje = `No se guardó el IMEI del pedido ${pedidoVisible(fila) ?? idFila}. Vuelve a abrir su celda.`
        estadoPedidos.set((s) => ({ ...s, fallosImei: { ...s.fallosImei, [idFila]: { imei, clave, mensaje } }, avisoImei: mensaje }))
      },
    )
  }
  // Una lectura que no es un IMEI válido no se guarda ni frena: rojo, aviso arriba y a la siguiente (spec §2). En revisión, se cierra.
  const noValida = (cifras: string, motivo: MotivoNoValido) => {
    const nv = { imei: cifras, motivo, imeiFila: fila.imei ?? null }
    marcarNoValido(fila.idFila, nv)
    const { largo } = textoNoValido({ ...nv, en: 0 })
    estadoPedidos.set((s) => ({ ...s, avisoImei: `Pedido ${pedidoVisible(fila) ?? fila.idFila}: ${largo}` }))
    const salta = !revision && !!onSaltar && onSaltar()
    if (!salta) onCerrar()
  }
  const comprobar = (cifras: string) => {
    if (enCurso.current) return
    // La lectura no válida que se está revisando: se decide con «Guardar igual» o leyendo otra.
    if (noValido && cifras === noValido.imei) return
    if (cifras.length > CIFRAS_IMEI) { noValida(cifras, 'mas'); return }
    // Un IMEI cuyo guardado falló ya pasó la comprobación (o se guardó igual): Enter lo reintenta sin volver a mirarla.
    const reintento = !!fallo && !fallo.duplicado && fallo.imei === cifras
    if (!reintento && !luhnCuadra(cifras)) { noValida(cifras, 'luhn'); return }
    guardar(cifras, true)
  }
  const enviar = () => {
    if (enCurso.current) return
    clearTimeout(quieto.current)
    // Vacío: quita el IMEI si lo hay; sin IMEI es el Enter del lector en la celda recién abierta y no hace nada.
    if (texto.length === 0) { if (fila.imei) guardar(null); return }
    if (texto.length < CIFRAS_IMEI) { setCorto(true); return }
    comprobar(texto)
  }
  // Solo cifras (también al pegar). Con 15 o más se espera un momento quieto (QUIETO_MS) y se comprueba, para que toda la ráfaga del
  // lector (y su Enter) caiga aquí. Con la lectura no válida en el campo, lo que llega tras una pausa (SUSTITUIR_MS) es otra lectura.
  const cambiar = (valor: string) => {
    if (enCurso.current) return
    const ahora = Date.now()
    const pausa = ahora - ultimaEntrada.current
    ultimaEntrada.current = ahora
    clearTimeout(quieto.current)
    let cifras = valor.replace(/\D/g, '')
    if (noValido && texto === noValido.imei && pausa >= SUSTITUIR_MS && valor.startsWith(texto)) {
      const nuevas = valor.slice(texto.length).replace(/\D/g, '')
      if (nuevas !== '') cifras = nuevas
    }
    setTexto(cifras)
    setCorto(false)
    if (cifras.length >= CIFRAS_IMEI) quieto.current = setTimeout(() => comprobar(cifras), QUIETO_MS)
  }
  const lecturaMala = !!noValido && texto === noValido.imei
  const enRojo = corto || lecturaMala || texto.length > CIFRAS_IMEI

  return (
    <div ref={caja} className={cn('flex h-8 items-center gap-1.5 pr-1 pl-2.5', enRojo && ROJO)}
      title={corto ? MENSAJE_CORTO : lecturaMala && noValido ? textoNoValido(noValido).largo : undefined}>
      <input autoFocus aria-label="IMEI" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={texto} readOnly={poner.isPending}
        placeholder={fila.imei ? 'Lee otro, o vacía y Enter para quitar' : 'Lee o escribe el IMEI'}
        onChange={(e) => cambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); enviar() }
          // Con la lista abierta, Escape cierra solo la lista (Radix); si no, cierra la celda.
          else if (e.key === 'Escape') { e.preventDefault(); if (ver) setVer(false); else onCerrar() }
        }}
        className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-[12px] placeholder:text-texto-sub placeholder:italic" />
      {corto && <span role="alert" className="sr-only">{MENSAJE_CORTO}</span>}
      {poner.isPending && <span className="shrink-0 text-[11px] text-azul-gris italic">guardando…</span>}
      {lecturaMala && noValido?.motivo === 'luhn' && (
        <button type="button" disabled={poner.isPending} onClick={() => guardar(texto)} title="Guardar este IMEI aunque la cifra de control no cuadre"
          className="h-6 shrink-0 cursor-pointer rounded-md border border-[#e0a0a0] bg-superficie px-1.5 text-[11px] font-bold text-texto-error">Guardar igual</button>
      )}
      {/* El contador es una ayuda a la vista: oculto al lector de pantalla para que no lea cada cifra. */}
      <span aria-hidden="true" data-contador className={cn('shrink-0 font-mono text-[11px]', enRojo ? 'font-bold text-texto-error' : 'text-azul-gris')}>{texto.length}/{CIFRAS_IMEI}</span>
      <Popover open={ver} onOpenChange={setVer}>
        <PopoverTrigger asChild>
          {/* Sin robar el foco al campo: el lector puede seguir leyendo con la lista abierta. */}
          <button type="button" aria-label="Ver recomendados" title="Ver recomendados" onMouseDown={(e) => e.preventDefault()}
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-borde-input bg-superficie text-[11px] text-azul-medio aria-expanded:bg-azul-medio aria-expanded:text-superficie">▾</button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={2} collisionPadding={8} aria-label="Recomendados"
          onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-[680px] max-w-[calc(100vw-16px)] rounded-lg border-azul-medio bg-superficie p-2 whitespace-normal shadow-[0_8px_24px_rgba(0,18,50,.25)]">
          <ListaRecomendados fila={fila} recomendados={recomendados} ocupado={poner.isPending} onElegir={(imei) => guardar(imei)} />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Los recomendados de la fila (los de hoy, sin cambios): la caja delante, el IMEI, «es …» en nivel 3 y el nivel. Elegir uno lo guarda. */
function ListaRecomendados({ fila, recomendados, ocupado, onElegir }: {
  fila: FilaVista; recomendados: ReturnType<typeof useRecomendados>; ocupado: boolean; onElegir: (imei: string) => void
}) {
  return (
    <>
      <div className="mb-1 px-0.5 text-[11px] font-bold tracking-wide text-azul-gris uppercase">Recomendados{fila.sku && <> para <span className="font-mono normal-case">{fila.sku}</span></>} · dónde buscarlo</div>
      {recomendados.isPending && <p className="px-2 py-1.5 text-[12px] text-azul-gris">Cargando…</p>}
      {recomendados.isError && <p className="px-2 py-1.5 text-[12px] text-azul-gris">No se pudieron cargar los recomendados.</p>}
      {recomendados.data?.length === 0 && <p className="px-2 py-1.5 text-[12px] text-azul-gris">No hay ningún móvil de ese modelo y capacidad libre en stock.</p>}
      {recomendados.data?.map((c) => (
        <button key={c.imei} type="button" disabled={ocupado} onClick={() => onElegir(c.imei)}
          className="grid w-full cursor-pointer grid-cols-[150px_118px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-seleccion-suave">
          <span className="justify-self-start rounded-md bg-[#eef0f3] px-2 py-px font-bold [overflow-wrap:anywhere]">{c.caja}</span>
          <span className="font-mono text-[12.5px] font-bold">{c.imei}</span>
          <span className="font-mono text-[11.5px] [overflow-wrap:anywhere] text-azul-gris">{c.nivel === 3 && (c.sku ? <>es {c.sku}</> : <span className="font-sans italic">SKU sin identificar</span>)}</span>
          <span className={cn('rounded-lg px-2 py-px text-[11px] font-bold whitespace-nowrap', NIVEL[c.nivel as 1 | 2 | 3])}>{TEXTO_NIVEL[c.nivel as 1 | 2 | 3]}</span>
        </button>
      ))}
    </>
  )
}
