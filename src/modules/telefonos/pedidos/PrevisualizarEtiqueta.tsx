import { useEffect, useState } from 'react'
import type { FilaVista } from '@/shared/api/client'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { MSG_ETIQUETA_SHIPPYPRO, MSG_ETIQUETA_SIN, useEtiquetaPdf } from '../api'
import { EtiquetaEstado } from './TablaFilas'
import { estadoPantalla } from './filas'

const MSG_GENERICO = 'No se pudo cargar la etiqueta.'
const AVISO = 'Previsualización. Imprimir desde aquí no marca el pedido como enviado: imprime la etiqueta desde ShippyPro.'

/** El texto del error: el del servidor para el 404 y el 502; para cualquier otro, uno genérico. */
const textoError = (e: unknown) => (e instanceof Error && (e.message === MSG_ETIQUETA_SIN || e.message === MSG_ETIQUETA_SHIPPYPRO) ? e.message : MSG_GENERICO)

/** El PDF de la etiqueta. Solo existe con el diálogo abierto (Radix desmonta el contenido al cerrar): la consulta no se guarda al
 *  desmontar y la URL del objeto se libera al cerrar o al cambiar de PDF. */
function VistaPdf({ idFila }: { idFila: number }) {
  const q = useEtiquetaPdf(idFila)
  const blob = q.data
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    // La URL del objeto es un recurso externo que hay que crear y liberar con el efecto; no se puede derivar en el pintado.
    setUrl(u) // eslint-disable-line react-hooks/set-state-in-effect
    return () => { URL.revokeObjectURL(u); setUrl(null) }
  }, [blob])

  if (q.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 p-2 text-[13px]">
        <p className="m-0 font-semibold">{textoError(q.error)}</p>
        <button type="button" onClick={() => void q.refetch()} className="h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold">Reintentar</button>
      </div>
    )
  }
  if (q.isPending || q.isFetching || !url) return <p role="status" className="m-0 p-2 text-[13px] text-azul-gris">Cargando la etiqueta…</p>
  return (
    <>
      <iframe title="Etiqueta" src={url} className="min-h-0 w-full flex-1 rounded-md border border-borde-input bg-white" />
      <p className="m-0 text-[12px] text-azul-gris">¿No se ve? <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-azul-medio underline">Abrir en una pestaña nueva</a></p>
    </>
  )
}

/** «Previsualizar etiqueta» (spec v2 §3.2): el PDF de la etiqueta en un diálogo. Solo enseña: no imprime ni marca nada. Se monta con
 *  `key` por fila, así cambiar de fila cierra el diálogo. */
export function PrevisualizarEtiqueta({ fila: f }: { fila: FilaVista }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="mt-2 h-7 cursor-pointer rounded-md border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold text-azul-medio">Previsualizar etiqueta</button>
      </DialogTrigger>
      <DialogContent sobrePanelCarga className="flex h-[88vh] w-[min(820px,94vw)] max-w-[min(820px,94vw)] flex-col gap-2.5 bg-superficie p-5">
        <DialogTitle>Previsualización de la etiqueta</DialogTitle>
        <DialogDescription className="m-0 rounded-md border border-[#e0b24a] bg-[#fff6dc] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#6b4a00]">{AVISO}</DialogDescription>
        <div className="flex items-center gap-2 text-[12.5px]">
          <EtiquetaEstado fila={f} estado={estadoPantalla(f)} conDetalle={false} />
          <span className="font-semibold">{f.pedido}</span>
        </div>
        <VistaPdf idFila={f.idFila} />
      </DialogContent>
    </Dialog>
  )
}
