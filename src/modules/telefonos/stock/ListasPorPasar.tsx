import { useState, type ReactNode } from 'react'
import type { FilaAltaNsys, FilaColorNsys, FilaDescartadaNsys, FilaGradoNsys, FilaRevisarNsys, FilaSinGradoNsys } from '@/shared/api/client'
import { COMPRUEBALO, diaNsys, ETIQUETA_AVISO, queHacerAviso, SIN_PRODUCTO_NSYS, textoAvisoTaller } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { CeldaHecho } from './CeldaHecho'
import {
  ETIQUETA_SIN_GRADO, marcada, modeloDeFila, modeloDelTaller, pendientes, QUE_HACER_SIN_GRADO, textoBateriaDeFila, textoDescartado, textoDescartadoAntes,
  textoDesde, textoGradoNsys, textoPorQue, textoUltimoTrabajo, textoUltimoTrabajoSinGrado, textoVerDescartados, textoVuelta, type ConHecho,
} from './porPasar'

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

const AMBAR = 'mt-0.5 block max-w-[260px] text-[11px] whitespace-normal text-ambar-grafico'

/** La línea ámbar de un vendido o de baja que ha vuelto (0.9.22 pieza 4 §7); nada en un móvil en la empresa. */
function Vuelta({ f }: { f: { vendidoEn: string | null; bajaEn: string | null; vueltoDesde: string | null } }) {
  const texto = textoVuelta(f)
  return texto ? <span className={AMBAR}>{texto}</span> : null
}

/** Una lista con «Hecho»: la cabecera con «✓ Marcar todo (n)» (lo pendiente) y las filas marcadas en gris. */
function TablaConHecho<T extends ConHecho & { imeiSn: string }>({ nombre, columnas, celdas, filas, vacio, ocupado, onMarcar, onDeshacer, onDescartar }:
  Omit<ConHechoProps<T>, 'onAbrirImei'> & { nombre: string; columnas: string[]; celdas: (f: T) => ReactNode; onDescartar?: (imeiSn: string) => void }) {
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
                <CeldaHecho fila={f} imeiSn={f.imeiSn} ocupado={ocupado} onMarcar={() => onMarcar([f.imeiSn])} onDeshacer={() => onDeshacer(f.imeiSn)}
                  onDescartar={onDescartar ? () => onDescartar(f.imeiSn) : undefined} />
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
          <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /><Vuelta f={f} /></td>
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
          <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /><Vuelta f={f} /></td>
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

/** «Ver descartados (n)» de «No está en NSYS» (pieza 3 §5.3): plegado al entrar; desplegado, en gris, con «deshacer». Solo se
 *  pinta con descartados (sin ellos se desmonta y vuelve plegado). */
function Descartados({ filas, ocupado, onRecuperar }: { filas: FilaDescartadaNsys[]; ocupado: boolean; onRecuperar: (imeiSn: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const columnas = ['IMEI', 'Modelo', 'Último trabajo', 'Descartado', 'Motivo', '']
  return (
    <div className="shrink-0">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}
        className="cursor-pointer text-[12px] text-azul-gris hover:underline">{textoVerDescartados(filas.length, abierto)}</button>
      {abierto && (
        <div className="mt-1.5 max-h-[220px] overflow-auto rounded-lg border border-fila-sep">
          <table aria-label="Descartados" className="w-full border-collapse bg-badge-neutro-bg text-[12.5px] text-texto-suave">
            <thead>
              <tr>{columnas.map((c, i) => <th key={i} scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.imeiSn} className="border-t border-fila-sep">
                  <td className={cn(CELDA, 'font-mono text-[11.5px] whitespace-nowrap')}>{f.imeiSn}</td>
                  <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDelTaller(f)}</td>
                  <td className={cn(CELDA, 'whitespace-nowrap')}>{textoUltimoTrabajo(f)}</td>
                  <td className={cn(CELDA, 'whitespace-nowrap')}>{textoDescartado(f)}</td>
                  <td className={cn(CELDA, 'italic')}>{`«${f.motivo}»`}</td>
                  <td className={cn(CELDA, 'whitespace-nowrap')}>
                    <button type="button" disabled={ocupado} aria-label={`Deshacer descarte de ${f.imeiSn}`} onClick={() => onRecuperar(f.imeiSn)}
                      className="cursor-pointer text-[11px] text-azul-noche hover:underline disabled:opacity-40">deshacer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type AltasProps = ConHechoProps<FilaAltaNsys> & {
  descartadas: FilaDescartadaNsys[]; onDescartar: (imeiSn: string) => void; onRecuperar: (imeiSn: string) => void
}

/** «No está en NSYS» (§3.4), con «descartar» en cada fila sin marca y «Ver descartados» al pie (pieza 3). */
export function ListaAltas({ onAbrirImei, descartadas, onDescartar, onRecuperar, ...props }: AltasProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <TablaConHecho {...props} nombre="No está en NSYS" onDescartar={onDescartar}
        columnas={['IMEI', 'Modelo', 'Último trabajo', 'Técnico', 'Cliente', 'Trabajos', 'Desde']}
        celdas={(f) => (
          <>
            <td className={CELDA}>
              <Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} />
              {textoDescartadoAntes(f) && <span className={AMBAR}>{textoDescartadoAntes(f)}</span>}
            </td>
            <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDelTaller(f)}<span className={GRIS}>el del taller</span></td>
            <td className={cn(CELDA, 'whitespace-nowrap')}>{textoUltimoTrabajo(f)}</td>
            <td className={cn(CELDA, 'whitespace-nowrap')}>{f.tecnico ?? '—'}</td>
            <td className={cn(CELDA, 'whitespace-nowrap')}>{f.cliente ?? '—'}</td>
            <td className={cn(CELDA, 'text-right whitespace-nowrap')}>{f.trabajos}</td>
            <td className={cn(CELDA, 'whitespace-nowrap')}>{diaNsys(f.desde)}</td>
          </>
        )} />
      {descartadas.length > 0 && <Descartados filas={descartadas} ocupado={props.ocupado} onRecuperar={onRecuperar} />}
    </div>
  )
}

type RevisarProps = {
  filas: FilaRevisarNsys[]; sinGrado: FilaSinGradoNsys[]; vacio: string; ocupado: boolean
  onAbrirImei: (imeiSn: string) => void; onRevisado: (idAviso: number) => void
}

/** «Revisar a mano» (§3.5): primero las filas «Sin grado en NSYS» (pieza 4: sin «Revisado»; se van solas al tener grado) y
 *  después los avisos, con «✓ Revisado» si ya estaba bien. «Corregir…» abre el móvil. */
export function ListaRevisar({ filas, sinGrado, vacio, ocupado, onAbrirImei, onRevisado }: RevisarProps) {
  const columnas = ['IMEI', 'Modelo', 'Qué pasa', 'Qué hacer', 'Reparación', '']
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-fila-sep">
      <table aria-label="Revisar a mano" className="w-full border-collapse text-[12.5px] text-azul-medio">
        <thead className="sticky top-0 bg-crema">
          <tr>{columnas.map((c, i) => <th key={i} scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.length === 0 && sinGrado.length === 0 && (
            <tr><td colSpan={columnas.length} className="px-2 py-3 text-[12px] text-azul-gris">{vacio}</td></tr>
          )}
          {sinGrado.map((f) => {
            const bateria = textoBateriaDeFila(f)
            return (
              <tr key={`sin-grado-${f.imeiSn}`} className="border-t border-fila-sep">
                <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /><Vuelta f={f} /></td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>{modeloDeFila(f)}</td>
                <td className={cn(CELDA, 'min-w-[300px]')}>
                  <span className={cn('mb-0.5 inline-block rounded px-1.5 text-[10.5px] font-bold', ETIQUETA.SIN_GRADO)}>{ETIQUETA_SIN_GRADO}</span>
                  <span className="block">{textoGradoNsys(f)}</span>
                  {bateria && <span className={GRIS}>{bateria}</span>}
                </td>
                <td className={cn(CELDA, 'min-w-[220px] text-[12px]')}>{QUE_HACER_SIN_GRADO}</td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>{textoUltimoTrabajoSinGrado(f)}</td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>
                  <button type="button" aria-label={`Corregir ${f.imeiSn}`} onClick={() => onAbrirImei(f.imeiSn)} className={PEQUENO}>Corregir…</button>
                </td>
              </tr>
            )
          })}
          {filas.map((f) => (
            <tr key={f.idAviso} className="border-t border-fila-sep">
              <td className={CELDA}><Imei imeiSn={f.imeiSn} onAbrir={onAbrirImei} /><Vuelta f={f} /></td>
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
