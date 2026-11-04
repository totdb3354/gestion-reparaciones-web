import { Fragment, type ReactNode, useRef } from 'react'
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
  avisoDescargado, AYUDA_QR, cabeceraPedidos, cifraRevisar, cifraSubir, conTecnico, descripcion, excelRevisar, excelSubir, filtrar,
  imeiBuscado, movilesExcel, NINGUNO_TRES, NOMBRE_QR, nombreExcel, palabrasClave, pasoSubir, pendienteSubir, PIE_QR, SIN_PENDIENTE,
  sinCoincidencias, soloTres, SUBTITULO_QR, TARJETAS_QR, TEXTO_MOTIVO, TEXTO_SOLO_TRES, textoCifra, tituloA, tituloPedidos,
  TITULO_SIN_VENTAS, VACIA_QR, type Cifra, type GrupoBase, type GrupoRevisar, type GrupoSubir, type Motivo, type TarjetaQR,
} from './queRevisar'

/** `sinVentas`: no se pudieron leer los vendidos; «Pedidos 15 d» cuenta solo los de pedido y lo dice (spec §10.2). */
type Props = {
  revisar: GrupoRevisar[]; subir: GrupoSubir[]; sinVentas: boolean; cargando: boolean; error: boolean; onAbrirImei: (imeiSn: string) => void
}

/** El borde de arriba de cada tarjeta (prototipo «Qué revisar»): ámbar el de sin grado y violeta el de B. */
const BORDE: Record<TarjetaQR, string> = { revisar: 'border-t-fila-solicitud-brd', subir: 'border-t-tipo-pulido-text' }
/** La pastilla del motivo: rojo, naranja, ámbar y gris (spec §10.1). */
const MOTIVO: Record<Motivo, string> = {
  NADA: 'bg-urgente-bg text-fila-urgente-brd', NINGUN_A: 'bg-aviso-conflicto-bg text-aviso-conflicto-text', UN_A: 'bg-fila-solicitud-bg text-fila-solicitud-brd',
  CON_A: 'bg-crema text-azul-gris',
}
const PASTILLA = 'inline-block rounded px-1.5 text-[10.5px] font-bold whitespace-nowrap'
const CELDA = 'px-2 py-1.5 align-top'
const NUM = cn(CELDA, 'text-right whitespace-nowrap tabular-nums')
const GRIS = 'ml-1 text-[11px] text-azul-gris'
const SUAVE = 'text-texto-suave'
const PRIMARIO = 'h-[26px] cursor-pointer rounded-lg bg-azul-noche px-2.5 text-[12px] font-semibold whitespace-nowrap text-superficie hover:bg-azul-noche-hover disabled:cursor-not-allowed disabled:opacity-40'
const CAMBIA_GRADO = 'inline-block rounded border border-tipo-reparacion-bg bg-tipo-reparacion-bg px-1.5 font-bold text-tipo-reparacion-text'

/** «Qué revisar» (0.9.25, spec «Qué revisar» §3 y §10): dos tarjetas como «Por pasar a NSYS», la ayuda, el interruptor «Solo con 3
 *  o más sin revisar» y «⬇ Descargar Excel», y la tabla de la elegida, con una fila por modelo-color que se despliega con sus
 *  móviles. Solo se mira: las listas salen del stock que ya tiene la página y de los vendidos. */
export function VistaQueRevisar({ revisar, subir, sinVentas, cargando, error, onAbrirImei }: Props) {
  const [{ queRevisar }, setEstado] = useStore(estadoStockTelefonos)
  const elegida = queRevisar.tarjeta
  // Lo desplegado, por tarjeta y modelo-color: sigue desplegado cuando el sondeo trae el stock nuevo y al volver del detalle del IMEI.
  const abiertos: ReadonlySet<string> = new Set(queRevisar.abiertos)
  const setElegida = (tarjeta: TarjetaQR) => setEstado((e) => ({ ...e, queRevisar: { ...e.queRevisar, tarjeta } }))
  const alternar = (clave: string) => setEstado((e) => {
    const previos = e.queRevisar.abiertos
    return { ...e, queRevisar: { ...e.queRevisar, abiertos: previos.includes(clave) ? previos.filter((c) => c !== clave) : [...previos, clave] } }
  })
  const alternarTres = () => setEstado((e) => ({ ...e, queRevisar: { ...e.queRevisar, soloTres: !e.queRevisar.soloTres } }))
  const cifras: Record<TarjetaQR, Cifra> = { revisar: cifraRevisar(revisar), subir: cifraSubir(subir) }
  // La caja de arriba (spec §3.6) y el interruptor (spec §10.1) filtran las tablas y el Excel; las tarjetas siguen con todo.
  const palabras = palabrasClave(queRevisar.buscar)
  const buscadosRevisar = filtrar(revisar, palabras)
  const visiblesRevisar = soloTres(buscadosRevisar, queRevisar.soloTres)
  const visiblesSubir = filtrar(subir, palabras)
  const todas = elegida === 'revisar' ? revisar : subir
  const buscadas = elegida === 'revisar' ? buscadosRevisar : visiblesSubir
  const visibles = elegida === 'revisar' ? visiblesRevisar : visiblesSubir
  const mensaje = cargando ? 'Cargando…' : error ? 'No se pudo cargar el stock de teléfonos.' : todas.length === 0 ? VACIA_QR[elegida]
    : buscadas.length === 0 ? sinCoincidencias(queRevisar.buscar) : visibles.length === 0 ? NINGUNO_TRES : null
  const nExcel = movilesExcel(visibles)
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
      const hoja = elegida === 'revisar' ? excelRevisar(visiblesRevisar, sinVentas) : excelSubir(visiblesSubir)
      descargar.mutate({ hoja, nombre, destino }, { onSuccess: () => avisar({ texto: avisoDescargado(hoja.filas.length), tipo: 'ok' }) })
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
          {elegida === 'revisar' && (
            <button type="button" role="switch" aria-checked={queRevisar.soloTres} onClick={alternarTres}
              className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-azul-medio">
              <span className={cn('relative h-[18px] w-[34px] rounded-full transition-colors', queRevisar.soloTres ? 'bg-verde-ok' : 'bg-pill-borde')}>
                <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-superficie transition-[left]', queRevisar.soloTres ? 'left-[18px]' : 'left-[2px]')} />
              </span>
              {TEXTO_SOLO_TRES}
            </button>
          )}
          <button type="button" disabled={nExcel === 0 || descargar.isPending} title={nExcel === 0 ? SIN_PENDIENTE : undefined}
            onClick={() => void bajar()} className={PRIMARIO}>
            {`⬇ Descargar Excel${nExcel > 0 ? ` (${nExcel})` : ''}`}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-fila-sep">
        {mensaje !== null ? <p className="p-4 text-[12px] text-azul-gris">{mensaje}</p>
          : elegida === 'revisar'
            ? <TablaRevisar grupos={visiblesRevisar} palabras={palabras} abiertos={abiertos} onAlternar={alternar} onAbrirImei={onAbrirImei} sinVentas={sinVentas} />
            : <TablaSubir grupos={visiblesSubir} palabras={palabras} abiertos={abiertos} onAlternar={alternar} onAbrirImei={onAbrirImei} />}
      </div>
      <p className="shrink-0 text-[11.5px] text-azul-gris">{PIE_QR}</p>
    </section>
  )
}

type TablaProps<G> = { grupos: G[]; palabras: readonly string[]; abiertos: ReadonlySet<string>; onAlternar: (clave: string) => void; onAbrirImei: (imeiSn: string) => void }

/** `titulos`: el texto al pasar el ratón de alguna cabecera, por su nombre. */
function Cabecera({ columnas, desdeDerecha, titulos = {} }: { columnas: string[]; desdeDerecha: number; titulos?: Record<string, string> }) {
  return (
    <thead className="sticky top-0 bg-crema">
      <tr>
        {columnas.map((c, i) => (
          <th key={c} scope="col" title={titulos[c]} className={cn('px-2 py-1.5 font-bold whitespace-nowrap', i >= desdeDerecha ? 'text-right' : 'text-left')}>{c}</th>
        ))}
      </tr>
    </thead>
  )
}

/** El triángulo que despliega o pliega la fila; la fila entera también lo hace. */
function Desplegar({ g, abierto, onAlternar }: { g: GrupoBase; abierto: boolean; onAlternar: () => void }) {
  return (
    <button type="button" aria-expanded={abierto} aria-label={`Ver los móviles de ${descripcion(g)}`}
      onClick={(e) => { e.stopPropagation(); onAlternar() }} className="mr-1.5 cursor-pointer text-[10px] text-azul-gris">
      {abierto ? '▾' : '▸'}
    </button>
  )
}

/** Un número con, en gris, «+1 con técnico» si hay. */
function Cuenta({ n, tecnico }: { n: number; tecnico: number }) {
  return <>{n}{tecnico > 0 && <span className={GRIS}>{`+${tecnico} con técnico`}</span>}</>
}

function CeldaA({ g }: { g: GrupoBase }) {
  return <td className={NUM} title={tituloA(g)}>{g.a}{g.a > 0 && <span className={GRIS}>{g.gradosA.join(', ')}</span>}</td>
}

function TablaRevisar({ grupos, palabras, abiertos, onAlternar, onAbrirImei, sinVentas }: TablaProps<GrupoRevisar> & { sinVentas: boolean }) {
  const pedidos = cabeceraPedidos(sinVentas)
  const columnas = ['Motivo', 'Modelo', 'Cap.', 'Color', 'Sin grado', pedidos, 'A en stock', 'Con grado']
  return (
    <table aria-label="Revisar sin grado" className="w-full border-collapse text-[12.5px] text-azul-medio">
      <Cabecera columnas={columnas} desdeDerecha={4} titulos={sinVentas ? { [pedidos]: TITULO_SIN_VENTAS } : {}} />
      <tbody>
        {grupos.map((g) => {
          const clave = `revisar|${g.clave}`
          const abierto = abiertos.has(clave) || g.moviles.some((m) => imeiBuscado(m, palabras))
          return (
            <Fragment key={g.clave}>
              <tr onClick={() => onAlternar(clave)} className={cn('cursor-pointer border-t border-fila-sep hover:bg-seleccion-suave', g.pendientes === 0 && SUAVE)}>
                <td className={cn(CELDA, 'whitespace-nowrap')}>
                  <Desplegar g={g} abierto={abierto} onAlternar={() => onAlternar(clave)} />
                  <span className={cn(PASTILLA, MOTIVO[g.motivo], g.pendientes === 0 && 'opacity-60')}>{TEXTO_MOTIVO[g.motivo]}</span>
                </td>
                <td className={CELDA}>{g.modelo}</td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>{textoCapacidad(g.capacidad)}</td>
                <td className={CELDA}>{g.color}</td>
                <td className={NUM}><Cuenta n={g.pendientes} tecnico={g.conTecnico} /></td>
                <td className={NUM} title={tituloPedidos(g, sinVentas)}>{g.pedidos}</td>
                <CeldaA g={g} />
                <td className={NUM}>{g.conGrado}</td>
              </tr>
              {abierto && <Moviles g={g} palabras={palabras} columnas={columnas.length} onAbrirImei={onAbrirImei} grado={(m) => <PildoraGrado grado={m.grado} />} />}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function TablaSubir({ grupos, palabras, abiertos, onAlternar, onAbrirImei }: TablaProps<GrupoSubir>) {
  const columnas = ['Modelo', 'Cap.', 'Color', 'A en stock', 'B', 'B100']
  return (
    <table aria-label="Subir B a A" className="w-full border-collapse text-[12.5px] text-azul-medio">
      <Cabecera columnas={columnas} desdeDerecha={3} />
      <tbody>
        {grupos.map((g) => {
          const clave = `subir|${g.clave}`
          const abierto = abiertos.has(clave) || g.moviles.some((m) => imeiBuscado(m, palabras))
          return (
            <Fragment key={g.clave}>
              <tr onClick={() => onAlternar(clave)} className={cn('cursor-pointer border-t border-fila-sep hover:bg-seleccion-suave', !pendienteSubir(g) && SUAVE)}>
                <td className={cn(CELDA, 'whitespace-nowrap')}><Desplegar g={g} abierto={abierto} onAlternar={() => onAlternar(clave)} />{g.modelo}</td>
                <td className={cn(CELDA, 'whitespace-nowrap')}>{textoCapacidad(g.capacidad)}</td>
                <td className={CELDA}>{g.color}</td>
                <CeldaA g={g} />
                <td className={NUM}><Cuenta n={g.b} tecnico={g.bTecnico} /></td>
                <td className={NUM}><Cuenta n={g.b100} tecnico={g.b100Tecnico} /></td>
              </tr>
              {abierto && <Moviles g={g} palabras={palabras} columnas={columnas.length} onAbrirImei={onAbrirImei} grado={(m) => <span className={CAMBIA_GRADO}>{pasoSubir(m)}</span>} />}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

/** Los móviles de un modelo-color desplegado (spec §3.3): IMEI, grado, ubicación, días y quién lo tiene; el del técnico, en gris. */
function Moviles({ g, palabras, columnas, grado, onAbrirImei }: { g: GrupoBase; palabras: readonly string[]; columnas: number; grado: (m: Movil) => ReactNode; onAbrirImei: (imeiSn: string) => void }) {
  return (
    <tr className="bg-crema/40">
      <td colSpan={columnas} className="px-6 pt-1 pb-2">
        <table aria-label={`Móviles de ${descripcion(g)}`} className="w-full max-w-[820px] border-collapse text-[12px]">
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
      </td>
    </tr>
  )
}
