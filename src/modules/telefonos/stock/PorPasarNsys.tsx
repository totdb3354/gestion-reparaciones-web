import { useState } from 'react'
import type { TarjetasPorPasar } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { avisar } from '@/shared/ui/avisos'
import { copiarAlPortapapeles } from '@/shared/ui/copiar'
import { useDescargarPlantilla, useDescartarAlta, useDeshacerDescarte, useDeshacerHecho, useMarcarHecho, useRevisarAviso } from '../api'
import { DescartarAltaDialog } from './DescartarAltaDialog'
import { ListaAltas, ListaColor, ListaGrado, ListaRevisar } from './ListasPorPasar'
import {
  avisoCopiado, avisoDescartado, avisoPlantillaAltas, avisoPlantillaColor, AYUDA, avisoVuelve, listaGrado, paraPlantillaColor, pendientes, TARJETA_HECHO, VACIA,
  type Tarjeta, type TarjetaConHecho,
} from './porPasar'
import { TarjetasNsys } from './TarjetasNsys'

type Props = { tarjetas: TarjetasPorPasar | null; cargando: boolean; error: boolean; onAbrirImei: (imeiSn: string) => void }

const VACIAS: TarjetasPorPasar = { color: [], grado: [], altas: [], revisar: [], descartadas: [], sinGrado: [] }
const BOTON = 'h-[26px] cursor-pointer rounded-lg px-2.5 text-[12px] font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40'
const PRIMARIO = cn(BOTON, 'bg-azul-noche text-superficie hover:bg-azul-noche-hover')
const SECUNDARIO = cn(BOTON, 'border border-borde-input bg-superficie text-azul-medio hover:bg-seleccion-suave')
const PASTILLA = 'rounded px-1.5 text-[10.5px] font-bold bg-fila-solicitud-bg text-fila-solicitud-brd'
const SIN_NADA = 'No hay móviles que corregir'

/** La pestaña «Por pasar a NSYS» del stock de teléfonos desde la 0.9.22 (spec «plantillas NSYS» §3, diseño C del prototipo): arriba
 *  las cuatro tarjetas con su número y su botón; debajo, la ayuda y la lista de la elegida (la de color al entrar). Las plantillas
 *  las hace el servidor; «Copiar lista» copia para Excel. */
export function PorPasarNsys({ tarjetas, cargando, error, onAbrirImei }: Props) {
  const [elegida, setElegida] = useState<Tarjeta>('color')
  const t = tarjetas ?? VACIAS
  const marcar = useMarcarHecho()
  const deshacer = useDeshacerHecho()
  const revisar = useRevisarAviso()
  const descargar = useDescargarPlantilla()
  const descartar = useDescartarAlta()
  const recuperar = useDeshacerDescarte()
  const [aDescartar, setADescartar] = useState<string | null>(null)
  const ocupado = marcar.isPending || deshacer.isPending || descartar.isPending || recuperar.isPending
  const sinProducto = pendientes(t.color).filter((f) => f.ponerProducto === null).length
  const vacio = cargando ? 'Cargando…' : error ? 'No se pudo cargar la lista.' : VACIA[elegida]

  const conHecho = (cual: TarjetaConHecho) => ({
    vacio, ocupado, onAbrirImei,
    onMarcar: (imeis: string[]) => { if (imeis.length > 0) marcar.mutate({ tarjeta: TARJETA_HECHO[cual], imeis }) },
    onDeshacer: (imeiSn: string) => deshacer.mutate({ tarjeta: TARJETA_HECHO[cual], imeiSn }),
  })

  const compruebalo = paraPlantillaColor(t.color).filter((f) => f.compruebalo).length
  const bajar = (cual: 'color' | 'altas') => descargar.mutate(cual, {
    onSuccess: ({ nombre, filas }) => avisar({
      texto: cual === 'color' ? avisoPlantillaColor(nombre, filas, sinProducto, compruebalo) : avisoPlantillaAltas(nombre, filas),
      tipo: 'ok',
    }),
  })

  function boton(cual: Tarjeta) {
    if (cual === 'color' || cual === 'altas') {
      const n = cual === 'color' ? paraPlantillaColor(t.color).length : pendientes(t.altas).length
      return (
        <button type="button" disabled={n === 0 || descargar.isPending} title={n === 0 ? SIN_NADA : `${n} ${n === 1 ? 'móvil' : 'móviles'}`}
          onClick={(e) => { e.stopPropagation(); bajar(cual) }} className={PRIMARIO}>
          {`⬇ Descargar plantilla${n > 0 ? ` (${n})` : ''}`}
        </button>
      )
    }
    if (cual === 'grado') {
      const n = pendientes(t.grado).length
      return (
        <button type="button" disabled={n === 0} title={n === 0 ? SIN_NADA : 'IMEI, producto y grado, para pegar'}
          onClick={(e) => {
            e.stopPropagation()
            void copiarAlPortapapeles(listaGrado(t.grado))
            avisar({ texto: avisoCopiado(n), tipo: 'ok' })
          }} className={SECUNDARIO}>
          {`Copiar lista${n > 0 ? ` (${n})` : ''}`}
        </button>
      )
    }
    const n = t.revisar.length
    return (
      <button type="button" disabled={n === 0} title={n === 0 ? SIN_NADA : undefined}
        onClick={(e) => { e.stopPropagation(); setElegida('revisar') }} className={SECUNDARIO}>Ver</button>
    )
  }

  return (
    <section aria-label="Por pasar a NSYS" className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-md bg-superficie p-3">
      <TarjetasNsys tarjetas={t} elegida={elegida} onElegir={setElegida} boton={boton} />
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <p className="max-w-[880px] text-[11.5px] leading-snug text-azul-gris">{AYUDA[elegida]}</p>
        {elegida === 'color' && sinProducto > 0 && <span className={PASTILLA}>{`${sinProducto} sin producto en NSYS: no van en la plantilla`}</span>}
        {elegida === 'grado' && <span className={PASTILLA}>en NSYS se cambian uno a uno: «Copiar lista» para tenerlos delante y «Hecho» al acabar cada uno</span>}
        {elegida === 'revisar' && <span className={PASTILLA}>se va con «Revisado» (queda quién y cuándo) o al corregirlo</span>}
      </div>
      {elegida === 'color' && <ListaColor filas={t.color} {...conHecho('color')} />}
      {elegida === 'grado' && <ListaGrado filas={t.grado} {...conHecho('grado')} />}
      {/* `?? []` en `descartadas`: un servidor anterior a la pieza 3 (vuelta atrás) no lo manda. */}
      {elegida === 'altas' && (
        <ListaAltas filas={t.altas} {...conHecho('altas')} descartadas={t.descartadas ?? []} onDescartar={setADescartar}
          onRecuperar={(imeiSn) => recuperar.mutate({ imeiSn }, { onSuccess: () => avisar({ texto: avisoVuelve(imeiSn), tipo: 'ok' }) })} />
      )}
      {elegida === 'revisar' && (
        <ListaRevisar filas={t.revisar} vacio={vacio} ocupado={revisar.isPending} onAbrirImei={onAbrirImei}
          onRevisado={(idAviso) => revisar.mutate(idAviso, { onSuccess: () => avisar({ texto: 'Revisado: sale de la lista (queda en el rastro)', tipo: 'ok' }) })} />
      )}
      <DescartarAltaDialog imeiSn={aDescartar} enviando={descartar.isPending} onCerrar={() => setADescartar(null)}
        onDescartar={(motivo) => {
          const imeiSn = aDescartar
          if (imeiSn === null) return
          descartar.mutate({ imeiSn, motivo }, {
            onSuccess: () => { setADescartar(null); avisar({ texto: avisoDescartado(imeiSn), tipo: 'ok' }) },
          })
        }} />
    </section>
  )
}
