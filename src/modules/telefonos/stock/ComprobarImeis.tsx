import { useState } from 'react'
import { clasesUbicacion } from '@/shared/lib/telefonoNsys'
import { cn } from '@/shared/lib/utils'
import { avisar } from '@/shared/ui/avisos'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { copiarAlPortapapeles } from '@/shared/ui/copiar'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { MarcaTaller } from '@/shared/ui/MarcaTaller'
import { CLASES_PILDORA } from '@/shared/ui/pildora'
import { MAX_IMEIS, useComprobarImeis } from '../api'
import { CeldaQuien } from './CeldaQuien'
import { PildoraGrado } from './PildoraGrado'
import { quienLoTiene } from './quien'
import { analizar, cruzar, modeloYCapacidad, paraExcel, resumen, textoEstado, type Cifra } from './varios'

type Props = { abierto: boolean; textoInicial: string; onCerrar: () => void; onAbrirImei: (imeiSn: string) => void }

const TONO: Record<Cifra['tono'], string> = {
  ok: 'bg-fila-recibido-bg text-fila-recibido-brd',
  aviso: 'bg-fila-solicitud-bg text-fila-solicitud-brd',
  mal: 'bg-urgente-bg text-fila-urgente-brd',
  neutro: 'bg-badge-neutro-bg text-azul-gris',
}
const COLUMNAS = ['#', 'IMEI', 'Modelo', 'Color', 'Grado', 'Ubicación', 'Quién lo tiene', 'Estado']

/** «Comprobar una lista de IMEIs» (0.9.18, spec §4.9): se abre con el botón «Pegar varios IMEIs» o pegando varios IMEIs en
 *  el buscador, y entonces comprueba nada más abrirse. Busca en todos los móviles del espejo, también en los vendidos. */
export function ComprobarImeis({ abierto, textoInicial, onCerrar, onAbrirImei }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[88vh] w-[min(900px,94vw)] max-w-[min(900px,94vw)] flex-col gap-3 bg-superficie p-5">
        <DialogTitle className="text-[16px] font-bold text-azul-noche">Comprobar una lista de IMEIs</DialogTitle>
        {/* Hijo de DialogContent: Radix lo desmonta al cerrar, así que cada apertura empieza con lo que se pegó. */}
        <Contenido textoInicial={textoInicial} onAbrirImei={onAbrirImei} />
      </DialogContent>
    </Dialog>
  )
}

function Contenido({ textoInicial, onAbrirImei }: { textoInicial: string; onAbrirImei: (imeiSn: string) => void }) {
  const [texto, setTexto] = useState(textoInicial)
  // Lo que se comprueba: con lo pegado, nada más abrirse; si no, al pulsar «Comprobar».
  const [pedido, setPedido] = useState(() => (textoInicial.trim() ? analizar(textoInicial) : null))
  const demasiados = pedido !== null && pedido.imeis.length > MAX_IMEIS
  const consulta = useComprobarImeis(pedido !== null && !demasiados ? pedido.imeis : [])
  const listo = pedido !== null && !demasiados && (pedido.imeis.length === 0 || consulta.data !== undefined)
  const filas = listo ? cruzar(pedido.lineas, consulta.data ?? []) : null
  const ahora = consulta.dataUpdatedAt
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <p className="text-[11.5px] text-azul-gris">
        Pega los IMEIs como vengan: uno por línea, separados por comas o copiados de una columna de Excel. Se buscan en todos los móviles de NSYS, también en los vendidos.
      </p>
      <textarea aria-label="IMEIs" value={texto} onChange={(e) => setTexto(e.target.value)}
        className="h-[88px] w-full rounded-lg border border-borde-input px-2.5 py-2 font-mono text-[12px]" />
      <div className="flex items-center gap-2">
        <BotonPrimario onClick={() => {
          const nuevo = analizar(texto)
          // Misma lista → misma clave de consulta: tras un fallo no volvería a preguntar, así que se fuerza.
          if (consulta.isError && pedido && nuevo.imeis.length === pedido.imeis.length && nuevo.imeis.every((x, i) => x === pedido.imeis[i])) void consulta.refetch()
          setPedido(nuevo)
        }}>Comprobar</BotonPrimario>
        {pedido && <span className="text-[11.5px] text-azul-gris">{`${pedido.lineas.length} ${pedido.lineas.length === 1 ? 'línea' : 'líneas'}`}</span>}
        {pedido && !demasiados && !listo && !consulta.isError && <span className="text-[11.5px] text-azul-gris">Comprobando…</span>}
        <BotonSecundario className="ml-auto" disabled={!filas} onClick={() => {
          if (!filas) return
          void copiarAlPortapapeles(paraExcel(filas, ahora))
          avisar({ texto: 'Copiado: pégalo en Excel', tipo: 'ok' })
        }}>Copiar el resultado (para Excel)</BotonSecundario>
      </div>
      {consulta.isError && <p className="text-[12px] font-bold text-fila-urgente-brd">No se pudo comprobar la lista. Pulsa «Comprobar» para intentarlo otra vez.</p>}
      {demasiados && <p className="text-[12px] font-bold text-fila-urgente-brd">{`Como mucho ${MAX_IMEIS} IMEIs por vez: hay ${pedido.imeis.length}.`}</p>}
      {filas && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {resumen(filas).map((c) => <span key={c.texto} className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', TONO[c.tono])}>{c.texto}</span>)}
          </div>
          <div className="min-h-0 overflow-auto rounded-lg border border-fila-sep">
            <table aria-label="Resultado" className="w-full border-collapse text-[12.5px] text-azul-medio">
              <thead className="sticky top-0 bg-crema">
                <tr>{COLUMNAS.map((c) => <th key={c} scope="col" className="px-2 py-1.5 text-left font-bold whitespace-nowrap">{c}</th>)}</tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const m = f.movil?.encontrado ? f.movil : null
                  const falta = !m && f.linea.tipo === 'IMEI'
                  return (
                    <tr key={f.linea.n} onClick={m ? () => onAbrirImei(m.imei) : undefined}
                      className={cn('border-t border-fila-sep', m && 'cursor-pointer hover:bg-seleccion-suave', falta && 'bg-urgente-bg', f.linea.tipo !== 'IMEI' && 'text-texto-suave')}>
                      <td className="px-2 py-1">{f.linea.n}</td>
                      <td className="px-2 py-1 font-mono text-[11.5px]">
                        {m ? (
                          <button type="button" aria-label={`Abrir ${m.imei}`} onClick={(e) => { e.stopPropagation(); onAbrirImei(m.imei) }}
                            className="cursor-pointer text-azul-noche hover:underline">{f.linea.texto}</button>
                        ) : f.linea.texto}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{m ? modeloYCapacidad(m) : ''}</td>
                      <td className="px-2 py-1">{m && <MarcaTaller nsys={m.colorNsys}>{m.color ?? ''}</MarcaTaller>}</td>
                      <td className="px-2 py-1">{m && <MarcaTaller nsys={m.gradoNsys}><PildoraGrado grado={m.grado} /></MarcaTaller>}</td>
                      <td className="px-2 py-1">{m?.ubicacion && <span className={cn(CLASES_PILDORA, clasesUbicacion(m.ubicacion))}>{m.ubicacion}</span>}</td>
                      <td className="px-2 py-1">{m && <CeldaQuien quien={quienLoTiene({ ubicacion: m.ubicacion, estado: m.estado ?? '', trabajos: m.trabajos }, ahora)} />}</td>
                      <td className={cn('px-2 py-1 font-bold whitespace-nowrap', falta && 'text-fila-urgente-brd', m && m.estado !== 'STOCK' && 'text-fila-solicitud-brd')}>{textoEstado(f)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
