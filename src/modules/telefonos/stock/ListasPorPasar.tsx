import type { ReactNode } from 'react'
import type { FilaAltaNsys, FilaColorNsys, FilaGradoNsys, FilaRevisarNsys } from '@/shared/api/client'
import { COMPRUEBALO, diaNsys, ETIQUETA_AVISO, queHacerAviso, SIN_PRODUCTO_NSYS, textoAvisoTaller } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { CeldaHecho } from './CeldaHecho'
import { marcada, modeloDeFila, modeloDelTaller, pendientes, textoDesde, textoPorQue, textoUltimoTrabajo, type ConHecho } from './porPasar'

/** Las cuatro listas de «Por pasar a NSYS» (spec 0.9.22 §3.2-§3.5). El IMEI abre el detalle del móvil, como en la 0.9.21. */

const CELDA = 'px-2 py-1.5 align-top'
const GRIS = 'block text-[11px] text-azul-gris'
const CAMBIA_COLOR = 'inline-block rounded border border-taller-bg bg-taller-bg px-1.5 font-bold text-taller-text'
const CAMBIA_GRADO = 'inline-block rounded border border-tipo-reparacion-bg bg-tipo-reparacion-bg px-1.5 font-bold text-tipo-reparacion-text'
const FUERA = 'mt-0.5 inline-block rounded bg-fila-solicitud-bg px-1.5 text-[10.5px] font-bold text-fila-solicitud-brd'
const PEQUENO = 'h-[26px] cursor-pointer rounded-lg border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold whitespace-nowrap text-azul-medio hover:bg-seleccion-suave disabled:cursor-not-allowed disabled:opacity-40'
const ETIQUETA: Record<string, string> = {
  SIN_COLOR: 'bg-fila-solicitud-bg text-fila-solicitud-brd', SIN_GRADO: 'bg-tipo-reparacion-bg text-tipo-reparacion-text',
  SIN_DESHACER: 'bg-urgente-bg text-fila-urgente-brd',
}

type ConHechoProps<T> = {
  filas: T[]; vacio: string; ocupado: boolean; onAbrirImei: (imeiSn: string) => void
  onMarcar: (imeis: string[]) => void; onDeshacer: (imeiSn: string) => void
}

function Imei({ imeiSn, onAbrir }: { imeiSn: string; onAbrir: (imeiSn: string) => void }) {
  return (
    <button type="button" aria-label={`Abrir ${imeiSn}`} onClick={() => onAbrir(imeiSn)}
      className="cursor-pointer font-mono text-[11.5px] text-azul-noche hover:underline">{imeiSn}</button>
  )
}

/** Una lista con «Hecho»: la cabecera con «✓ Marcar todo (n)» (lo pendiente) y las filas marcadas en gris. */
function TablaConHecho<T extends ConHecho & { imeiSn: string }>({ nombre, columnas, celdas, filas, vacio, ocupado, onMarcar, onDeshacer }:
  Omit<ConHechoProps<T>, 'onAbrirImei'> & { nombre: string; columnas: string[]; celdas: (f: T) => ReactNode }) {
  const n = pendientes(filas).length
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-fila-sep">
      <table aria-label={nombre} className="w-full border-collapse text-[12.5px] text-azul-medio">
        <thead className="sticky top-0 bg-crema">
          <tr>
            {columnas.map((c) => <th key={c} scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>)}
            <th scope="col" className="px-2 py-1.5 text-left">
              <button type="button" disabled={n === 0 || ocupado} title="Marca como hechas todas las filas pendientes"
                onClick={() => onMarcar(pendientes(filas).map((f) => f.imeiSn))} className={PEQUENO}>{`✓ Marcar todo (${n})`}</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr><td colSpan={columnas.length + 1} className="px-2 py-3 text-[12px] text-azul-gris">{vacio}</td></tr>
          )}
          {filas.map((f) => (
            <tr key={f.imeiSn} className={cn('border-t border-fila-sep', marcada(f) && 'bg-badge-neutro-bg text-texto-suave')}>
              {celdas(f)}
              <td className={cn(CELDA, 'whitespace-nowrap')}>
                <CeldaHecho fila={f} imeiSn={f.imeiSn} ocupado={ocupado} onMarcar={() => onMarcar([f.imeiSn])} onDeshacer={() => onDeshacer(f.imeiSn)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** El producto con el color nuevo resaltado (lo que cambia). */
function Resaltado({ texto, parte }: { texto: string; parte: string | null }) {
  const i = parte ? texto.lastIndexOf(parte) : -1
  if (!parte || i < 0) return <>{texto}</>
  return <>{texto.slice(0, i)}<span className={CAMBIA_COLOR}>{parte}</span>{texto.slice(i + parte.length)}</>
}

/** «Cambio de color» (§3.2). */
export function ListaColor({ onAbrirImei, ...props }: ConHechoProps<FilaColorNsys>) {
  return (
    <TablaConHecho {...props} nombre="Cambio de color"
      columnas={['IMEI', 'Modelo', 'Color', 'En NSYS hoy', 'Poner en NSYS', 'Por qué', 'Desde']}
      celdas={(f) => (
        <>
          <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /></td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDeFila(f)}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>
            <span className={CAMBIA_COLOR}>{`${f.colorDe ?? '—'} → ${f.colorA ?? '—'}`}</span>
            {f.tambienGrado && <span className={GRIS}>también en «Cambio de grado» (después)</span>}
          </td>
          <td className={CELDA}>{f.productoNsys ?? '—'}</td>
          <td className={CELDA}>
            {f.ponerProducto
              ? <b className="text-azul-noche"><Resaltado texto={f.ponerProducto} parte={f.colorA} />{f.compruebalo && <span className="font-semibold text-fila-solicitud-brd">{` (${COMPRUEBALO})`}</span>}</b>
              : <><span className="font-semibold text-fila-solicitud-brd">{SIN_PRODUCTO_NSYS}</span><br /><span className={FUERA}>no va en la plantilla</span></>}
            <span className={GRIS}>{`grado ${f.gradoNsys || '—'} `}<span className="text-texto-suave">(el de NSYS hoy)</span></span>
          </td>
          <td className={cn(CELDA, 'min-w-[220px]')}>{f.porQue.map((p, i) => <span key={i} className="block">{textoPorQue(p)}</span>)}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{textoDesde(f.desde)}</td>
        </>
      )} />
  )
}

/** «Cambio de grado» (§3.3). */
export function ListaGrado({ onAbrirImei, ...props }: ConHechoProps<FilaGradoNsys>) {
  return (
    <TablaConHecho {...props} nombre="Cambio de grado"
      columnas={['IMEI', 'Modelo', 'Grado', 'Producto en NSYS hoy', 'Por qué', 'Desde']}
      celdas={(f) => (
        <>
          <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /></td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDeFila(f)}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>
            <span className={CAMBIA_GRADO}>{`${f.gradoDe ?? '—'} → ${f.gradoA ?? '—'}`}</span>
            {f.conColor && <span className={GRIS}>primero su cambio de color</span>}
          </td>
          <td className={CELDA}>{f.productoNsys ?? '—'}</td>
          <td className={cn(CELDA, 'min-w-[220px]')}>{f.porQue.map((p, i) => <span key={i} className="block">{textoPorQue(p)}</span>)}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{textoDesde(f.desde)}</td>
        </>
      )} />
  )
}

/** «No está en NSYS» (§3.4). */
export function ListaAltas({ onAbrirImei, ...props }: ConHechoProps<FilaAltaNsys>) {
  return (
    <TablaConHecho {...props} nombre="No está en NSYS"
      columnas={['IMEI', 'Modelo', 'Último trabajo', 'Técnico', 'Cliente', 'Trabajos', 'Desde']}
      celdas={(f) => (
        <>
          <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /></td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDelTaller(f)}<span className={GRIS}>el del taller</span></td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{textoUltimoTrabajo(f)}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{f.tecnico ?? '—'}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{f.cliente ?? '—'}</td>
          <td className={cn(CELDA, 'text-right whitespace-nowrap')}>{f.trabajos}</td>
          <td className={cn(CELDA, 'whitespace-nowrap')}>{diaNsys(f.desde)}</td>
        </>
      )} />
  )
}

type RevisarProps = { filas: FilaRevisarNsys[]; vacio: string; ocupado: boolean; onAbrirImei: (imeiSn: string) => void; onRevisado: (idAviso: number) => void }

/** «Revisar a mano» (§3.5): sin «Hecho»; «✓ Revisado» si ya estaba bien y «Corregir…», que abre el móvil. */
export function ListaRevisar({ filas, vacio, ocupado, onAbrirImei, onRevisado }: RevisarProps) {
  const columnas = ['IMEI', 'Modelo', 'Qué pasa', 'Qué hacer', 'Reparación', '']
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-fila-sep">
      <table aria-label="Revisar a mano" className="w-full border-collapse text-[12.5px] text-azul-medio">
        <thead className="sticky top-0 bg-crema">
          <tr>{columnas.map((c, i) => <th key={i} scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr><td colSpan={columnas.length} className="px-2 py-3 text-[12px] text-azul-gris">{vacio}</td></tr>
          )}
          {filas.map((f) => (
            <tr key={f.idAviso} className="border-t border-fila-sep">
              <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /></td>
              <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDeFila(f)}</td>
              <td className={cn(CELDA, 'min-w-[300px]')}>
                <span className={cn('mb-0.5 inline-block rounded px-1.5 text-[10.5px] font-bold', ETIQUETA[f.tipo])}>{ETIQUETA_AVISO[f.tipo] ?? f.tipo}</span>
                <span className="block">{textoAvisoTaller({ tipo: f.tipo, causa: f.causa, dato: f.dato, de: f.de, idRep: f.idRep, usuario: f.usuario, motivo: f.motivo })}</span>
              </td>
              <td className={cn(CELDA, 'min-w-[220px] text-[12px]')}>{queHacerAviso(f.tipo, f.dato)}</td>
              <td className={cn(CELDA, 'whitespace-nowrap')}>{f.idRep}<span className={GRIS}>{`${f.usuario ?? '—'} · ${textoDesde(f.fecha)}`}</span></td>
              <td className={cn(CELDA, 'whitespace-nowrap')}>
                <span className="flex gap-1.5">
                  <button type="button" disabled={ocupado} aria-label={`Revisado ${f.idRep} de ${f.imeiSn}`} onClick={() => onRevisado(f.idAviso)} className={PEQUENO}>✓ Revisado</button>
                  <button type="button" aria-label={`Corregir ${f.imeiSn}`} onClick={() => onAbrirImei(f.imeiSn)} className={PEQUENO}>Corregir…</button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
