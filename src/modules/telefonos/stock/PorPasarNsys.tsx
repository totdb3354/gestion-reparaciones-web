import type { FilaPorPasar } from '@/shared/api/client'
import { SIN_PRODUCTO_NSYS, SIN_SKU_MAESTRO } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { avisar } from '@/shared/ui/avisos'
import { BotonSecundario } from '@/shared/ui/Botones'
import { copiarAlPortapapeles } from '@/shared/ui/copiar'
import { modeloDeFila, paraExcel, textoDesde, textoPorQue } from './porPasar'

type Props = { filas: FilaPorPasar[]; cargando: boolean; onAbrirImei: (imeiSn: string) => void }

const COLUMNAS = ['IMEI', 'Modelo', 'En NSYS hoy', 'Poner en NSYS', 'SKU nuevo', 'Por qué', 'Desde']
const CELDA = 'px-2 py-1.5 align-top'
const GRIS = 'block text-[11px] text-azul-gris'

/** La pestaña «Por pasar a NSYS» del stock de teléfonos (0.9.21, spec «SKU del taller» §2.4; variante «A · se vacía sola»
 *  del prototipo): lo que hay que cambiar a mano en NSYS, de cualquier modelo, los más antiguos primero. Sin botones por fila:
 *  cada una se va sola cuando la importación ve NSYS igual. El IMEI abre su detalle. */
export function PorPasarNsys({ filas, cargando, onAbrirImei }: Props) {
  return (
    <section aria-label="Por pasar a NSYS" className="flex min-h-0 flex-1 flex-col gap-2 rounded-md bg-superficie p-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <p className="text-[11.5px] text-azul-gris">
          Lo que hay que cambiar a mano en NSYS (producto y grado de cada móvil). Cada fila desaparece sola cuando la importación (cada 30 min) ve NSYS igual.
        </p>
        <BotonSecundario className="ml-auto" disabled={filas.length === 0} onClick={() => {
          void copiarAlPortapapeles(paraExcel(filas))
          avisar({ texto: 'Copiado: pégalo en Excel', tipo: 'ok' })
        }}>Exportar a Excel</BotonSecundario>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-fila-sep">
        <table aria-label="Móviles por pasar a NSYS" className="w-full border-collapse text-[12.5px] text-azul-medio">
          <thead className="sticky top-0 bg-crema">
            <tr>{COLUMNAS.map((c) => <th key={c} scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={COLUMNAS.length} className="px-2 py-3 text-[12px] text-azul-gris">
                  {cargando ? 'Cargando…' : 'Nada por pasar: NSYS está al día con el taller.'}
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.imeiSn} className="border-t border-fila-sep">
                <td className={cn(CELDA, 'font-mono text-[11.5px]')}>
                  <button type="button" aria-label={`Abrir ${f.imeiSn}`} onClick={() => onAbrirImei(f.imeiSn)}
                    className="cursor-pointer text-azul-noche hover:underline">{f.imeiSn}</button>
                </td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDeFila(f)}</td>
                <td className={CELDA}>{f.productoNsys ?? '—'}<span className={GRIS}>{`grado ${f.gradoNsys || '—'}`}</span></td>
                <td className={CELDA}>
                  {f.ponerProducto ? <b className="text-azul-noche">{f.ponerProducto}</b> : <span className="font-semibold text-fila-solicitud-brd">{SIN_PRODUCTO_NSYS}</span>}
                  <span className={GRIS}>grado <b className="text-azul-noche">{f.ponerGrado || '—'}</b></span>
                </td>
                <td className={cn(CELDA, 'font-mono text-[11.5px]')}>{f.sku ?? <i className="font-sans text-fila-solicitud-brd">{SIN_SKU_MAESTRO}</i>}</td>
                <td className={cn(CELDA, 'min-w-[220px]')}>{f.porQue.map((p, i) => <span key={i} className="block">{textoPorQue(p)}</span>)}</td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>{textoDesde(f.desde)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
