import { useState } from 'react'
import type { FichaMovil } from '@/shared/api/client'
import { SIN_SKU_MAESTRO, textoPoner } from '@/shared/lib/telefonoNsys'
import { useCerrojoEnvio } from '@/shared/lib/useCerrojoEnvio'
import { avisar } from '@/shared/ui/avisos'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { useCorregirTaller, useOpcionesTaller, useVolverANsys } from './apiNsys'
import { eleccionInicial, LETRAS, ordenColores, previa, type Eleccion, type GradoElegido, type Letra } from './corregir'

type Props = { ficha: FichaMovil; abierto: boolean; onCerrar: () => void }

const CAMPO = 'h-8 rounded border border-borde-input bg-superficie px-2 text-[13px] text-azul-medio disabled:bg-gris-disabled'

/** «Corregir color, grado o batería…» (0.9.21, spec «SKU del taller» §2.3): color (los del maestro para el modelo,
 *  capacidad y eSIM), grado con «Batería nueva (100)» y «Mensaje de pieza (Ms)», motivo obligatorio y vista previa del SKU
 *  nuevo y de lo que hay que poner en NSYS. «Volver a lo de NSYS», si hay algo del taller. Se cierra cuando sale bien; si
 *  falla, sigue abierto y el error sale en el diálogo de siempre. */
export function CorregirTallerDialog({ ficha, abierto, onCerrar }: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent aria-describedby={undefined} className="flex w-[min(560px,94vw)] max-w-[min(560px,94vw)] flex-col gap-3 bg-superficie p-5">
        <DialogTitle className="text-[15px] font-bold text-azul-noche">{`Corregir ${ficha.imeiSn}`}</DialogTitle>
        {/* Hijo de DialogContent: Radix lo desmonta al cerrar, así que cada apertura empieza con lo que vale. */}
        <Contenido ficha={ficha} onCerrar={onCerrar} />
      </DialogContent>
    </Dialog>
  )
}

function Contenido({ ficha, onCerrar }: { ficha: FichaMovil; onCerrar: () => void }) {
  const opciones = useOpcionesTaller(ficha.imeiSn, true)
  const corregir = useCorregirTaller(ficha.imeiSn)
  const volver = useVolverANsys(ficha.imeiSn)
  const enviando = corregir.isPending || volver.isPending
  const enviar = useCerrojoEnvio({ abierto: true, enviando })
  const [e, setE] = useState<Eleccion>(() => eleccionInicial(ficha))
  const p = previa(ficha, e, opciones.data)
  const sinColores = opciones.data != null && opciones.data.colores.length === 0
  const colores = ordenColores(opciones.data, p.colorAntes)
  const grado = (cambio: Partial<GradoElegido>) => setE((x) => ({ ...x, grado: { ...x.grado, ...cambio } }))
  const guardar = () => corregir.mutate({ ...p.cuerpo, motivo: e.motivo.trim() }, {
    onSuccess: () => { avisar({ texto: 'Corrección guardada', tipo: 'ok' }); onCerrar() },
  })
  const aNsys = () => volver.mutate(e.motivo.trim() || null, {
    onSuccess: () => { avisar({ texto: 'Lo del taller quitado: vale lo de NSYS', tipo: 'ok' }); onCerrar() },
  })
  return (
    <>
      <div className="grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2.5 text-[12.5px] text-azul-medio">
        <label htmlFor="taller-color" className="font-semibold">Color</label>
        <select id="taller-color" className={CAMPO} value={sinColores ? '' : e.color} disabled={opciones.data == null || sinColores}
          onChange={(ev) => setE((x) => ({ ...x, color: ev.target.value }))}>
          {sinColores ? <option value="">Sin colores en el maestro</option> : colores.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label htmlFor="taller-grado" className="font-semibold">Grado</label>
        <select id="taller-grado" className={CAMPO} value={e.grado.letra} onChange={(ev) => grado({ letra: ev.target.value as Letra | '' })}>
          {e.grado.letra === '' && <option value="">—</option>}
          {LETRAS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span />
        <label className="flex items-center gap-2"><input type="checkbox" checked={e.grado.bateria} onChange={(ev) => grado({ bateria: ev.target.checked })} />Batería nueva (100)</label>
        <span />
        <label className="flex items-center gap-2"><input type="checkbox" checked={e.grado.ms} onChange={(ev) => grado({ ms: ev.target.checked })} />Mensaje de pieza (Ms)</label>
        <label htmlFor="taller-motivo" className="self-start pt-1.5 font-semibold">Motivo</label>
        <textarea id="taller-motivo" value={e.motivo} placeholder="Obligatorio: por qué se corrige" onChange={(ev) => setE((x) => ({ ...x, motivo: ev.target.value }))}
          className="h-16 resize-y rounded border border-borde-input bg-superficie px-2 py-1.5 text-[13px] text-azul-medio" />
      </div>
      <div role="region" aria-label="Vista previa" className="rounded-lg border border-taller-bg bg-taller-bg px-3 py-2 text-[12.5px] leading-relaxed text-azul-medio">
        {p.cambiaColor && <p>Color: {p.colorAntes || '—'} → <b>{p.colorFinal}</b></p>}
        {p.cambiaGrado && <p>Grado: {p.gradoAntes || '—'} → <b>{p.gradoFinal}</b></p>}
        {!p.cambiaColor && !p.cambiaGrado ? <p>Sin cambios todavía.</p> : (
          <>
            <p>SKU: {p.sku ? <b className="font-mono">{p.sku}</b> : <span className="font-semibold text-fila-solicitud-brd">{`${SIN_SKU_MAESTRO}: se guarda igual`}</span>}</p>
            <p>{`En NSYS habrá que poner: ${textoPoner(p.producto, p.gradoFinal)}`}</p>
            {p.coincideConNsys && <p className="font-semibold text-fila-recibido-brd">Coincide con NSYS: se quita lo del taller.</p>}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {ficha.porPasar && (
          <BotonSecundario disabled={enviando} title="Quita lo del taller y vuelve a lo que dice NSYS" onClick={() => enviar(aNsys)}>Volver a lo de NSYS</BotonSecundario>
        )}
        <BotonSecundario className="ml-auto" disabled={enviando} onClick={onCerrar}>Cancelar</BotonSecundario>
        <BotonPrimario disabled={!p.valido || enviando} onClick={() => enviar(guardar)}>Guardar</BotonPrimario>
      </div>
    </>
  )
}
