import { Fragment, useState, type ReactNode } from 'react'
import { clasesUbicacion } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { avisar } from '@/shared/ui/avisos'
import { copiarAlPortapapeles } from '@/shared/ui/copiar'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { CeldaQuien } from './CeldaQuien'
import { textoCapacidad, type Movil } from './modelo'
import { PildoraGrado } from './PildoraGrado'
import {
  AYUDA_QR, avisoCopiadoLista, cifraRevisar, cifraSubir, conTecnico, descripcion, NOMBRE_QR, pasoSubir, pendienteSubir, PIE_QR, SIN_PENDIENTE,
  SUBTITULO_QR, TARJETAS_QR, TEXTO_MOTIVO, textoCifra, textoRevisar, textoSubir, tituloA, VACIA_QR,
  type Cifra, type GrupoBase, type GrupoRevisar, type GrupoSubir, type Motivo, type TarjetaQR,
} from './queRevisar'

type Props = { revisar: GrupoRevisar[]; subir: GrupoSubir[]; cargando: boolean; error: boolean; onAbrirImei: (imeiSn: string) => void }

/** El borde de arriba de cada tarjeta (prototipo «Qué revisar»): ámbar el de sin grado y violeta el de B. */
const BORDE: Record<TarjetaQR, string> = { revisar: 'border-t-fila-solicitud-brd', subir: 'border-t-tipo-pulido-text' }
/** La pastilla del motivo: rojo, naranja y ámbar. */
const MOTIVO: Record<Motivo, string> = {
  NADA: 'bg-urgente-bg text-fila-urgente-brd', NINGUN_A: 'bg-aviso-conflicto-bg text-aviso-conflicto-text', UN_A: 'bg-fila-solicitud-bg text-fila-solicitud-brd',
}
const PASTILLA = 'inline-block rounded px-1.5 text-[10.5px] font-bold whitespace-nowrap'
const CELDA = 'px-2 py-1.5 align-top'
const NUM = cn(CELDA, 'text-right whitespace-nowrap tabular-nums')
const GRIS = 'ml-1 text-[11px] text-azul-gris'
const SUAVE = 'text-texto-suave'
const BOTON = 'h-[26px] cursor-pointer rounded-lg border border-borde-input bg-superficie px-2.5 text-[12px] font-semibold whitespace-nowrap text-azul-medio hover:bg-seleccion-suave disabled:cursor-not-allowed disabled:opacity-40'
const CAMBIA_GRADO = 'inline-block rounded border border-tipo-reparacion-bg bg-tipo-reparacion-bg px-1.5 font-bold text-tipo-reparacion-text'

/** «Qué revisar» (0.9.25, spec «Qué revisar» §3): dos tarjetas como «Por pasar a NSYS», la ayuda y la tabla de la elegida, con una
 *  fila por modelo-color que se despliega con sus móviles. Solo se mira: las listas salen del stock que ya tiene la página. */
export function VistaQueRevisar({ revisar, subir, cargando, error, onAbrirImei }: Props) {
  const [elegida, setElegida] = useState<TarjetaQR>('revisar')
  // Lo desplegado, por tarjeta y modelo-color: sigue desplegado cuando el sondeo trae el stock nuevo.
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(new Set())
  const alternar = (clave: string) => setAbiertos((s) => {
    const nuevo = new Set(s)
    if (nuevo.has(clave)) nuevo.delete(clave)
    else nuevo.add(clave)
    return nuevo
  })
  const cifras: Record<TarjetaQR, Cifra> = { revisar: cifraRevisar(revisar), subir: cifraSubir(subir) }
  const copiar = (t: TarjetaQR) => {
    void copiarAlPortapapeles(t === 'revisar' ? textoRevisar(revisar) : textoSubir(subir))
    avisar({ texto: avisoCopiadoLista(cifras[t].grupos), tipo: 'ok' })
  }
  const lista = elegida === 'revisar' ? revisar : subir
  const mensaje = cargando ? 'Cargando…' : error ? 'No se pudo cargar el stock de teléfonos.' : lista.length === 0 ? VACIA_QR[elegida] : null
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
            <div>
              <button type="button" disabled={cifras[t].grupos === 0} title={cifras[t].grupos === 0 ? SIN_PENDIENTE : undefined}
                onClick={(e) => { e.stopPropagation(); copiar(t) }} className={BOTON}>
                {`Copiar lista${cifras[t].grupos > 0 ? ` (${cifras[t].grupos})` : ''}`}
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="max-w-[880px] shrink-0 text-[11.5px] leading-snug text-azul-gris">{AYUDA_QR[elegida]}</p>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-fila-sep">
        {mensaje !== null ? <p className="p-4 text-[12px] text-azul-gris">{mensaje}</p>
          : elegida === 'revisar' ? <TablaRevisar grupos={revisar} abiertos={abiertos} onAlternar={alternar} onAbrirImei={onAbrirImei} />
            : <TablaSubir grupos={subir} abiertos={abiertos} onAlternar={alternar} onAbrirImei={onAbrirImei} />}
      </div>
      <p className="shrink-0 text-[11.5px] text-azul-gris">{PIE_QR}</p>
    </section>
  )
}

type TablaProps<G> = { grupos: G[]; abiertos: ReadonlySet<string>; onAlternar: (clave: string) => void; onAbrirImei: (imeiSn: string) => void }

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

function TablaRevisar({ grupos, abiertos, onAlternar, onAbrirImei }: TablaProps<GrupoRevisar>) {
  const columnas = ['Motivo', 'Modelo', 'Cap.', 'Color', 'Sin grado', 'A en stock', 'Con grado']
  return (
    <table aria-label="Revisar sin grado" className="w-full border-collapse text-[12.5px] text-azul-medio">
      <Cabecera columnas={columnas} desdeDerecha={4} />
      <tbody>
        {grupos.map((g) => {
          const clave = `revisar|${g.clave}`
          const abierto = abiertos.has(clave)
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
                <CeldaA g={g} />
                <td className={NUM}>{g.conGrado}</td>
              </tr>
              {abierto && <Moviles g={g} columnas={columnas.length} onAbrirImei={onAbrirImei} grado={(m) => <PildoraGrado grado={m.grado} />} />}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function TablaSubir({ grupos, abiertos, onAlternar, onAbrirImei }: TablaProps<GrupoSubir>) {
  const columnas = ['Modelo', 'Cap.', 'Color', 'A en stock', 'B', 'B100']
  return (
    <table aria-label="Subir B a A" className="w-full border-collapse text-[12.5px] text-azul-medio">
      <Cabecera columnas={columnas} desdeDerecha={3} />
      <tbody>
        {grupos.map((g) => {
          const clave = `subir|${g.clave}`
          const abierto = abiertos.has(clave)
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
              {abierto && <Moviles g={g} columnas={columnas.length} onAbrirImei={onAbrirImei} grado={(m) => <span className={CAMBIA_GRADO}>{pasoSubir(m)}</span>} />}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

/** Los móviles de un modelo-color desplegado (spec §3.3): IMEI, grado, ubicación, días y quién lo tiene; el del técnico, en gris. */
function Moviles({ g, columnas, grado, onAbrirImei }: { g: GrupoBase; columnas: number; grado: (m: Movil) => ReactNode; onAbrirImei: (imeiSn: string) => void }) {
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
              <tr key={`${m.imeiSn}|${m.lote}`} className={cn('border-t border-fila-sep', conTecnico(m) && SUAVE)}>
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
