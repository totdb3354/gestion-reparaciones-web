import { horaDe, marcada, textoVolvio, type ConHecho } from './porPasar'

type Props = { fila: ConHecho; imeiSn: string; ocupado: boolean; onMarcar: () => void; onDeshacer: () => void; onDescartar?: () => void }

const BOTON = 'h-[26px] cursor-pointer rounded-lg border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold text-azul-medio hover:bg-seleccion-suave disabled:cursor-not-allowed disabled:opacity-40'

/** «Hecho» de una fila (spec 0.9.22 §3.6): el botón; marcada, «✓ Hecho 12:31» (quién, al pasar el ratón) y «deshacer»; si la
 *  importación vio NSYS igual, el botón otra vez con el aviso en rojo. En «No está en NSYS», al lado, el enlace «descartar» (pieza 3). */
export function CeldaHecho({ fila, imeiSn, ocupado, onMarcar, onDeshacer, onDescartar }: Props) {
  if (marcada(fila) && fila.hechoEn) {
    const hora = horaDe(fila.hechoEn)
    return (
      <>
        <span title={`Marcado por ${fila.hechoPor ?? '—'} a las ${hora}`}
          className="inline-block rounded-full border border-fila-recibido-brd bg-fila-recibido-bg px-2 text-[11px] font-bold whitespace-nowrap text-fila-recibido-brd">
          {`✓ Hecho ${hora}`}
        </span>
        <button type="button" disabled={ocupado} aria-label={`Deshacer Hecho de ${imeiSn}`} onClick={onDeshacer}
          className="block cursor-pointer text-[11px] text-azul-noche hover:underline disabled:opacity-40">deshacer</button>
      </>
    )
  }
  const volvio = textoVolvio(fila)
  return (
    <>
      <button type="button" disabled={ocupado} aria-label={`Hecho ${imeiSn}`} onClick={onMarcar} className={BOTON}>Hecho</button>
      {onDescartar && (
        <button type="button" disabled={ocupado} aria-label={`Descartar ${imeiSn}`} title="No va a NSYS: quitarlo de la lista (con motivo)"
          onClick={onDescartar} className="ml-2 cursor-pointer text-[11px] text-texto-suave hover:text-fila-urgente-brd disabled:cursor-not-allowed disabled:opacity-40">
          descartar
        </button>
      )}
      {volvio && <span className="mt-0.5 block max-w-[220px] text-[11px] font-bold whitespace-normal text-fila-urgente-brd">{volvio}</span>}
    </>
  )
}
