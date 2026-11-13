import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { FONDO } from './CeldaImei'
import { CLASE_TONO, colorMarca } from './filas'
import { COLOR_ETIQUETA, ETIQUETA } from './TablaFilas'

/** Una línea de la ayuda: la muestra (con el estilo real de la tabla, si la hay) y la idea en una frase. */
function Linea({ muestra, children }: { muestra?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex w-40 shrink-0 items-center">{muestra}</span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

const celda = (clase: string | undefined, texto: string) => (
  <span className={cn('inline-block rounded-sm border border-form-fila-brd px-2 py-px font-mono text-[11.5px]', clase)}>{texto}</span>
)

/** Botón «?» discreto del encabezado de «Pedidos»: abre «Cómo se lee esta tabla», con los colores y las etiquetas reales. */
export function AyudaPedidos() {
  return (
    <Popover>
      <PopoverTrigger aria-label="Ayuda de Pedidos" title="Cómo se lee esta tabla"
        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full border border-borde-input bg-superficie text-[12px] font-bold text-azul-gris hover:border-[#9db8e8] hover:bg-seleccion-suave">?</PopoverTrigger>
      <PopoverContent align="start" aria-label="Cómo se lee esta tabla" className="w-[540px] max-w-[calc(100vw-16px)] rounded-lg border border-fila-sep bg-superficie p-3 text-[12px] shadow-md">
        <h2 className="mb-2 text-[13px] font-bold text-azul-medio">Cómo se lee esta tabla</h2>
        <ul className="flex flex-col gap-1.5">
          <Linea>Las filas las crea el ERP desde ShippyPro. Solo se teclea el IMEI.</Linea>
          <Linea muestra={celda(FONDO.aviso, '350000000000001')}>IMEI en ámbar: vale, pero con un aviso.</Linea>
          <Linea muestra={celda(FONDO.mal, '350000000000002')}>IMEI en naranja: no cuadra con el pedido. Mira el motivo.</Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.PENDIENTE)}>Pendiente</span>}>Aún no se ha preparado el envío.</Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.GENERADA)}>Etiqueta generada</span>}>La etiqueta existe pero no se ha impreso: el móvil sigue en el almacén.</Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.ENVIADO)}>Enviado</span>}>La etiqueta se imprimió.</Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.FALTA_ENVIAR)}>Falta por enviar</span>}>
            Envío parcial de una web: este móvil sale después que el resto del pedido. Se marca a mano en el panel de la fila y cuenta
            como pendiente. Se quita sola al sincronizar su IMEI con la web (Fonestockroom) o a mano con «Ya ha salido».
          </Linea>
          <Linea muestra={<span className={cn(ETIQUETA, colorMarca('ESPERA_STOCK'))}>En espera de stock</span>}>
            Marca: no hay ese móvil en el stock. Cuenta como pendiente y el lector no salta a ella; se quita sola al poner un IMEI.
          </Linea>
          <Linea muestra={<span className={cn(ETIQUETA, colorMarca('EN_REVISION'))}>En revisión</span>}>
            Marca: hay algo que aclarar antes de enviarlo. Cuenta como pendiente y el lector no salta a ella; se quita a mano.
          </Linea>
          <Linea muestra={<span className={cn(ETIQUETA, colorMarca('PENDIENTE_COLOR'))}>Pendiente de color</span>}>
            Marca: solo enseña su etiqueta y su nota; no cambia los contadores ni el lector.
          </Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.CANCELADO)}>Cancelado</span>}>
            Marca: el cliente anula ese móvil y el resto del pedido sigue. No cuenta como pendiente y el lector no salta a ella.
          </Linea>
          <Linea>Las marcas se ponen en la celda del IMEI (debajo del campo) o en el panel de la fila, con una nota si quieres. Una fila con marca no va al bot de vendidos.</Linea>
          <Linea muestra={
            <span className="flex items-baseline gap-1.5 text-[12px]">i13128AzulA<span className="font-sans text-[10px] text-azul-gris">1/3</span></span>
          }>El móvil es uno de los de un pedido de varios.</Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.NO_PENDIENTE)}>Ya no está pendiente</span>}>El pedido ya no está pendiente en ShippyPro.</Linea>
          <Linea muestra={<span className={cn(ETIQUETA, COLOR_ETIQUETA.HISTORICO)}>De la hoja</span>}>
            <span className={cn('mr-1.5 rounded-sm px-1.5 py-px text-[11px]', CLASE_TONO.gris)}>Fila en gris</span>
            Histórico de la hoja: no se edita.
          </Linea>
          <Linea>El IMEI se puede poner, cambiar o quitar también en las filas enviadas.</Linea>
          <Linea muestra={<span aria-hidden className="inline-block h-5 w-full max-w-24 rounded-sm bg-seleccion-suave shadow-[inset_4px_0_0_#2f6fe0]" />}>La fila en azul es la última que has tocado: te ayuda a encontrarla al volver.</Linea>
        </ul>
      </PopoverContent>
    </Popover>
  )
}
