import { Fragment, type ReactNode, useId, useRef } from 'react'
import { elegirDestino } from '@/shared/lib/descargas'
import { useStore } from '@/shared/lib/store'
import { clasesUbicacion } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { avisar } from '@/shared/ui/avisos'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { TIPO_XLSX, useDescargarExcel } from '../api'
import { CeldaQuien } from './CeldaQuien'
import { textoCapacidad, type Movil } from './modelo'
import { estadoStockTelefonos } from './estado'
import { PildoraGrado } from './PildoraGrado'
import {
  avisoDescargado, AYUDA_QR, bloquesRevisar, cifraRevisar, cifraSubir, conTecnico, cuentaRevisar, cuentaSubir, descripcion, excelRevisar,
  excelSubir, filtrar, imeiBuscado, NOMBRE_QR, nombreExcel, palabrasClave, pasoSubir, pendienteSubir, PIE_QR, PULSA_QR, SIN_PENDIENTE,
  sinCoincidencias, SUBTITULO_QR, TARJETAS_QR, textoCifra, VACIA_QR, type Cifra, type CuentaPanel, type GrupoBase, type GrupoRevisar,
  type GrupoSubir, type TarjetaQR,
} from './queRevisar'

type Props = {
  revisar: GrupoRevisar[]; subir: GrupoSubir[]; cargando: boolean; error: boolean; onAbrirImei: (imeiSn: string) => void
}

/** El borde de arriba de cada tarjeta (prototipo «Qué revisar»): ámbar el de sin grado y violeta el de B. */
const BORDE: Record<TarjetaQR, string> = { revisar: 'border-t-fila-solicitud-brd', subir: 'border-t-tipo-pulido-text' }
const CELDA = 'px-2 py-1.5 align-top'
const NUM = cn(CELDA, 'text-right whitespace-nowrap tabular-nums')
/** Las tablas ocupan lo que piden sus columnas, con un mínimo para que la columna de la izquierda no cambie de ancho (ni el panel
 *  salte) al cambiar de tarjeta o al buscar. */
const TABLA = 'w-auto min-w-[560px] border-collapse text-[12.5px] text-azul-medio'
const GRIS = 'ml-1 text-[11px] text-azul-gris'
const SUAVE = 'text-texto-suave'
const PRIMARIO = 'h-[26px] cursor-pointer rounded-lg bg-azul-noche px-2.5 text-[12px] font-semibold whitespace-nowrap text-superficie hover:bg-azul-noche-hover disabled:cursor-not-allowed disabled:opacity-40'
const CAMBIA_GRADO = 'inline-block rounded border border-tipo-reparacion-bg bg-tipo-reparacion-bg px-1.5 font-bold text-tipo-reparacion-text'
/** La raya azul de la fila elegida, en su primera celda: con el fondo de selección (el del ratón encima, en firme), para que no se
 *  confunda con la que tiene el ratón encima. */
const RAYA_ELEGIDA = 'shadow-[inset_3px_0_0_var(--color-azul-noche)]'
/** Dos columnas desde 1280 px (spec §10.14; con la columna lateral abierta, menos no cabe sin ensanchar la página): la lista con su propio desplazamiento, del ancho de su tabla (si no cabe, encoge y se
 *  desplaza también a lo ancho), y el panel en el resto, con 320 px como poco. Por debajo, una encima de la otra (el panel, como
 *  mucho el 45 % del alto). Nada de aquí ensancha la página (`min-w-0` y `contain`): lo que no cabe se desplaza en su caja. Ninguna mueve a la otra: la página no se desplaza (ocupa la ventana), así que el panel se queda arriba,
 *  a la vista, mientras se baja por la lista, y se desplaza solo si es más largo que el hueco. */
const COLUMNAS = 'flex min-h-0 min-w-0 flex-1 flex-col gap-3 [contain:inline-size] xl:flex-row'
const LISTA = 'min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-fila-sep'
const PANEL = 'max-h-[45%] min-h-0 shrink-0 overflow-y-auto rounded-lg border border-fila-sep xl:max-h-full xl:max-w-[820px] xl:min-w-[320px] xl:flex-1 xl:self-start'

/** La columna «Grado» de los móviles del panel: su pastilla en «Revisar sin grado» y el paso en «Subir B a A». */
const gradoRevisar = (m: Movil) => <PildoraGrado grado={m.grado} />
const gradoSubir = (m: Movil) => <span className={CAMBIA_GRADO}>{pasoSubir(m)}</span>

/** Lo que enseña el panel: el modelo-color elegido, su cuenta y cómo se pinta el grado de sus móviles. */
type Detalle = { g: GrupoBase; cuenta: CuentaPanel; grado: (m: Movil) => ReactNode }

/** «Qué revisar» (0.9.25, spec «Qué revisar» §3 y §10): dos tarjetas como «Por pasar a NSYS», la ayuda y «⬇ Descargar Excel», y
 *  debajo la tabla de la elegida, con una fila por modelo-color, y a su derecha el panel con los móviles del modelo-color elegido
 *  (§10.14). Solo se mira: las listas salen del stock que ya tiene la página. */
export function VistaQueRevisar({ revisar, subir, cargando, error, onAbrirImei }: Props) {
  const [{ queRevisar }, setEstado] = useStore(estadoStockTelefonos)
  const elegida = queRevisar.tarjeta
  const idPanel = useId()
  const setElegida = (tarjeta: TarjetaQR) => setEstado((e) => ({ ...e, queRevisar: { ...e.queRevisar, tarjeta } }))
  // Lo elegido es de cada tarjeta y vive en el estado de la página: sigue al volver del detalle del IMEI, al cambiar de tarjeta
  // y cuando el sondeo trae el stock nuevo. Volver a pulsar el elegido no lo quita.
  const elegir = (clave: string) => setEstado((e) => ({
    ...e, queRevisar: { ...e.queRevisar, elegido: { ...e.queRevisar.elegido, [e.queRevisar.tarjeta]: clave } },
  }))
  const cifras: Record<TarjetaQR, Cifra> = { revisar: cifraRevisar(revisar), subir: cifraSubir(subir) }
  // La caja de arriba (spec §3.6) filtra las tablas y el Excel; las tarjetas siguen con todo.
  const palabras = palabrasClave(queRevisar.buscar)
  const visiblesRevisar = filtrar(revisar, palabras)
  const visiblesSubir = filtrar(subir, palabras)
  const todas = elegida === 'revisar' ? revisar : subir
  const visibles = elegida === 'revisar' ? visiblesRevisar : visiblesSubir
  const mensaje = cargando ? 'Cargando…' : error ? 'No se pudo cargar el stock de teléfonos.' : todas.length === 0 ? VACIA_QR[elegida]
    : visibles.length === 0 ? sinCoincidencias(queRevisar.buscar) : null
  // El panel enseña el elegido de la tarjeta si está en lo que se ve; si un Items nuevo o la búsqueda lo quitan, «Pulsa…» (lo
  // guardado se queda: si vuelve a salir, vuelve a estar elegido).
  const enRevisar = visiblesRevisar.find((g) => g.clave === queRevisar.elegido.revisar)
  const enSubir = visiblesSubir.find((g) => g.clave === queRevisar.elegido.subir)
  const detalle: Detalle | null = elegida === 'revisar'
    ? (enRevisar ? { g: enRevisar, cuenta: cuentaRevisar(enRevisar), grado: gradoRevisar } : null)
    : (enSubir ? { g: enSubir, cuenta: cuentaSubir(enSubir), grado: gradoSubir } : null)
  // Lo que llevará el Excel de la tarjeta elegida (spec §10.12): el N del botón son sus filas.
  const hoja = elegida === 'revisar' ? excelRevisar(visiblesRevisar) : excelSubir(visiblesSubir)
  const nExcel = hoja.filas.length
  const descargar = useDescargarExcel()
  // Como las plantillas de NSYS (0.9.22.1): «Guardar como» en el mismo clic y después el Excel del servidor. Cancelar no pide nada.
  // Mientras «Guardar como» está abierto, otro clic no abre otro (la mutación apaga el botón, pero solo desde que se lanza).
  const abierto = useRef(false)
  const bajar = async () => {
    if (abierto.current) return
    abierto.current = true
    try {
      const nombre = nombreExcel(elegida)
      const destino = await elegirDestino(nombre, TIPO_XLSX)
      if (destino === 'cancelado') return
      descargar.mutate({ hoja, nombre, destino }, { onSuccess: () => avisar({ texto: avisoDescargado(nExcel), tipo: 'ok' }) })
    } finally {
      abierto.current = false
    }
  }
  return (
    <section aria-label="Qué revisar" className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-md bg-superficie p-3">
      <div className="grid shrink-0 grid-cols-[repeat(2,minmax(0,340px))] gap-2.5">
        {TARJETAS_QR.map((t) => (
          <article key={t} aria-label={NOMBRE_QR[t]} onClick={() => setElegida(t)}
            className={cn('flex cursor-pointer flex-col gap-1.5 rounded-lg border-[1.5px] border-t-4 bg-superficie px-3 py-2.5', BORDE[t],
              elegida === t ? 'border-x-azul-noche border-b-azul-noche shadow-[0_0_0_2px_rgba(7,26,58,0.12)]' : 'border-x-fila-sep border-b-fila-sep hover:border-x-borde-input hover:border-b-borde-input')}>
            <button type="button" aria-pressed={elegida === t} onClick={() => setElegida(t)}
              className="cursor-pointer self-start text-left text-[13px] font-bold text-azul-medio">{NOMBRE_QR[t]}</button>
            <p className="text-[26px] leading-none font-extrabold text-azul-noche">
              {cifras[t].grupos}{' '}<small className="text-[12px] font-semibold text-azul-gris">{textoCifra(cifras[t])}</small>
            </p>
            <p className="text-[11.5px] leading-snug text-azul-gris">{SUBTITULO_QR[t]}</p>
          </article>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <p className="max-w-[880px] text-[11.5px] leading-snug text-azul-gris">{AYUDA_QR[elegida]}</p>
        <div className="ml-auto flex items-center gap-3">
          <button type="button" disabled={nExcel === 0 || descargar.isPending} title={nExcel === 0 ? SIN_PENDIENTE : undefined}
            onClick={() => void bajar()} className={PRIMARIO}>
            {`⬇ Descargar Excel${nExcel > 0 ? ` (${nExcel})` : ''}`}
          </button>
        </div>
      </div>
      <div className={COLUMNAS}>
        <div className={cn(LISTA, mensaje === null && 'xl:flex-initial')}>
          {mensaje !== null ? <p className="p-4 text-[12px] text-azul-gris">{mensaje}</p>
            : elegida === 'revisar'
              ? <TablaRevisar grupos={visiblesRevisar} elegido={queRevisar.elegido.revisar} panel={idPanel} onElegir={elegir} />
              : <TablaSubir grupos={visiblesSubir} elegido={queRevisar.elegido.subir} panel={idPanel} onElegir={elegir} />}
        </div>
        {/* Sin filas (cargando, vacío o sin coincidencias) no hay nada que elegir: sin panel. Con otro elegido, el panel se pinta de
            nuevo (la clave) para que empiece arriba y no donde se quedó el anterior. */}
        {mensaje === null && <Panel key={detalle?.g.clave ?? ''} id={idPanel} detalle={detalle} palabras={palabras} onAbrirImei={onAbrirImei} />}
      </div>
      <p className="shrink-0 text-[11.5px] text-azul-gris">{PIE_QR}</p>
    </section>
  )
}

type TablaProps<G> = { grupos: G[]; elegido: string | null; panel: string; onElegir: (clave: string) => void }

function Cabecera({ columnas, desdeDerecha }: { columnas: string[]; desdeDerecha: number }) {
  return (
    <thead className="sticky top-0 bg-crema">
      <tr>
        {columnas.map((c, i) => (
          <th key={c} scope="col" className={cn('px-2 py-1.5 font-bold whitespace-nowrap', i >= desdeDerecha ? 'text-right' : 'text-left')}>{c}</th>
        ))}
      </tr>
    </thead>
  )
}

/** Una fila de modelo-color (spec §10.14): pulsarla, o su botón con el teclado, la elige y sus móviles salen en el panel. La
 *  elegida va resaltada; el botón dice cuál es (`aria-current`) y a qué panel lleva (`aria-controls`). */
function FilaGrupo({ g, elegido, panel, gris, onElegir, children }: {
  g: GrupoBase; elegido: boolean; panel: string; gris: boolean; onElegir: (clave: string) => void; children: ReactNode
}) {
  return (
    <tr onClick={() => onElegir(g.clave)}
      className={cn('cursor-pointer border-t border-fila-sep hover:bg-seleccion-suave', elegido && 'bg-seleccion-suave', gris && SUAVE)}>
      <td className={cn(CELDA, 'whitespace-nowrap', elegido && RAYA_ELEGIDA)}>
        <button type="button" aria-current={elegido ? 'true' : undefined} aria-controls={panel} aria-label={`Ver los móviles de ${descripcion(g)}`}
          onClick={(e) => { e.stopPropagation(); onElegir(g.clave) }}
          className={cn('mr-1.5 cursor-pointer text-[10px]', elegido ? 'text-azul-noche' : 'text-azul-gris')}>▸</button>
        {g.modelo}
      </td>
      <td className={cn(CELDA, 'whitespace-nowrap')}>{textoCapacidad(g.capacidad)}</td>
      <td className={cn(CELDA, 'whitespace-nowrap')}>{g.color}</td>
      {children}
    </tr>
  )
}

/** Un número en negrita con, en gris, «+1 con técnico» si hay. */
function Cuenta({ n, tecnico }: { n: number; tecnico: number }) {
  return <><span className="font-bold">{n}</span>{tecnico > 0 && <span className={GRIS}>{`+${tecnico} con técnico`}</span>}</>
}

/** «Revisar sin grado» (spec §10.10): como «Solo n/a» de la hoja, sin motivo, «A en stock» ni «Con grado» (todo sería «Nada con
 *  grado», 0 y 0). */
function TablaRevisar({ grupos, elegido, panel, onElegir }: TablaProps<GrupoRevisar>) {
  const columnas = ['Modelo', 'Cap.', 'Color', 'Sin grado']
  return (
    <table aria-label="Revisar sin grado" className={TABLA}>
      <Cabecera columnas={columnas} desdeDerecha={3} />
      <tbody>
        {bloquesRevisar(grupos).map((b) => (
          <Fragment key={b.titulo}>
            <tr className="border-t border-fila-sep bg-crema/60">
              <td colSpan={columnas.length} className={cn(CELDA, 'font-bold whitespace-nowrap text-azul-noche')}>{b.titulo}</td>
            </tr>
            {b.grupos.map((g) => (
              <FilaGrupo key={g.clave} g={g} elegido={g.clave === elegido} panel={panel} gris={g.pendientes === 0} onElegir={onElegir}>
                <td className={NUM}><Cuenta n={g.pendientes} tecnico={g.conTecnico} /></td>
              </FilaGrupo>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

function TablaSubir({ grupos, elegido, panel, onElegir }: TablaProps<GrupoSubir>) {
  return (
    <table aria-label="Subir B a A" className={TABLA}>
      <Cabecera columnas={['Modelo', 'Cap.', 'Color', 'B', 'B100']} desdeDerecha={3} />
      <tbody>
        {grupos.map((g) => (
          <FilaGrupo key={g.clave} g={g} elegido={g.clave === elegido} panel={panel} gris={!pendienteSubir(g)} onElegir={onElegir}>
            <td className={NUM}><Cuenta n={g.b} tecnico={g.bTecnico} /></td>
            <td className={NUM}><Cuenta n={g.b100} tecnico={g.b100Tecnico} /></td>
          </FilaGrupo>
        ))}
      </tbody>
    </table>
  )
}

/** El panel de la derecha (spec §10.14): el título con la descripción del modelo-color elegido y su cuenta («· 20 sin grado» o
 *  «· 1 B · 2 B100», y en gris «· +2 con técnico»), pegado arriba al desplazar el panel, y debajo sus móviles. Sin elegido,
 *  cómo elegir uno. */
function Panel({ id, detalle, palabras, onAbrirImei }: {
  id: string; detalle: Detalle | null; palabras: readonly string[]; onAbrirImei: (imeiSn: string) => void
}) {
  return (
    <section id={id} aria-label="Móviles del modelo-color" className={PANEL}>
      {detalle === null ? <p className="p-4 text-[12px] text-azul-gris">{PULSA_QR}</p> : (
        <>
          <h2 aria-live="polite" className="sticky top-0 border-b border-fila-sep bg-superficie px-3 py-2 text-[13px] font-semibold text-azul-medio">
            <span className="font-bold text-azul-noche">{descripcion(detalle.g)}</span>
            {` · ${detalle.cuenta.texto}`}
            {/* El separador fuera del <span>: el nombre accesible del título quita los espacios del borde de cada elemento. */}
            {detalle.cuenta.tecnico > 0 && <>{' · '}<span className="text-azul-gris">{`+${detalle.cuenta.tecnico} con técnico`}</span></>}
          </h2>
          <Moviles g={detalle.g} palabras={palabras} grado={detalle.grado} onAbrirImei={onAbrirImei} />
        </>
      )}
    </section>
  )
}

/** Los móviles del modelo-color elegido (spec §3.3 y §10.14): IMEI, grado, ubicación, días y quién lo tiene; el del técnico, en
 *  gris, y el del IMEI buscado, resaltado. */
function Moviles({ g, palabras, grado, onAbrirImei }: { g: GrupoBase; palabras: readonly string[]; grado: (m: Movil) => ReactNode; onAbrirImei: (imeiSn: string) => void }) {
  return (
    <div className="px-1.5 pt-1 pb-2">
      <table aria-label={`Móviles de ${descripcion(g)}`} className="w-full border-collapse text-[12px] text-azul-medio">
        <thead>
          <tr>
            {['IMEI', 'Grado', 'Ubicación', 'Días en stock', 'Quién lo tiene'].map((c) => (
              <th key={c} scope="col" className="px-2 py-1 text-left text-[11px] font-bold text-azul-gris">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.moviles.map((m) => (
            <tr key={`${m.imeiSn}|${m.lote}`} className={cn('border-t border-fila-sep', conTecnico(m) && SUAVE, imeiBuscado(m, palabras) && 'bg-amarillo/40')}>
              <td className="px-2 py-1">
                <button type="button" aria-label={`Abrir ${m.imeiSn}`} onClick={() => onAbrirImei(m.imeiSn)}
                  className="cursor-pointer font-mono text-[11.5px] text-azul-noche hover:underline">{m.imeiSn}</button>
              </td>
              <td className="px-2 py-1">{grado(m)}</td>
              <td className="px-2 py-1"><span className={cn(CLASES_PILDORA, clasesUbicacion(m.ubicacion))}>{m.ubicacion ?? '—'}</span></td>
              <td className="px-2 py-1 tabular-nums">{m.dias ?? '—'}</td>
              <td className="px-2 py-1"><CeldaQuien quien={m.quien} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
