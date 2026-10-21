import { useState } from 'react'
import { useBuscarMoviles } from '@/shared/api/nsys'
import { nombreModeloNsys } from '@/shared/lib/telefonoNsys'
import { MarcaTaller } from '@/shared/ui/MarcaTaller'
import { textoBuscado } from './modelo'
import { imeisEn } from './varios'

/** Buscador de IMEI en todos los móviles del espejo, también los vendidos: con 4 caracteres o más sugiere hasta 10; al
 *  elegir uno (o Enter con el IMEI exacto) se abre su detalle. Pegar más de un IMEI abre «Comprobar una lista de IMEIs» con lo pegado. */
export function BuscadorImei({ onElegir, onPegarVarios }: { onElegir: (imeiSn: string) => void; onPegarVarios: (texto: string) => void }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const limpio = texto.trim()
  const { data: encontrados = [], isFetching } = useBuscarMoviles(limpio)
  const elegir = (imeiSn: string) => {
    setAbierto(false)
    onElegir(imeiSn)
  }
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false) }}>
      <input type="search" onFocus={() => setAbierto(true)} aria-label="Buscar IMEI en todos los móviles" placeholder="Buscar IMEI en todos los móviles…" value={texto}
        onChange={(e) => {
          setTexto(e.target.value.replace(/[^A-Za-z0-9]/g, ''))
          setAbierto(true)
        }}
        onPaste={(e) => {
          // Con más de un IMEI, lo pegado va al diálogo de «Pegar varios IMEIs» (spec 0.9.18 §4.9).
          const pegado = e.clipboardData.getData('text')
          if (imeisEn(pegado) > 1) {
            e.preventDefault()
            setAbierto(false)
            onPegarVarios(pegado)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAbierto(false)
          if (e.key === 'Enter') {
            const exacto = encontrados.find((m) => m.imeiSn === limpio)
            if (exacto) elegir(exacto.imeiSn)
          }
        }}
        className="h-9 w-[240px] rounded border border-borde-input bg-superficie px-2.5 text-[12px] text-azul-medio" />
      {abierto && limpio.length >= 4 && (
        <ul aria-label="Móviles encontrados" className="absolute top-10 left-0 z-20 w-[440px] rounded-lg border border-pill-borde bg-superficie p-1 shadow-lg">
          {encontrados.length === 0 && !isFetching && <li className="px-2.5 py-1.5 text-[12px] text-azul-gris">Ningún móvil con ese IMEI</li>}
          {encontrados.map((m) => (
            <li key={m.imeiSn}>
              <button type="button" onClick={() => elegir(m.imeiSn)}
                className="w-full cursor-pointer rounded px-2.5 py-1.5 text-left text-[12px] text-azul-medio hover:bg-seleccion-suave">
                {`${m.imeiSn} · ${[nombreModeloNsys(m.modelo, m.modeloMaestro), m.capacidad].filter(Boolean).join(' ')}`}
                {m.color && <>{' '}<MarcaTaller enLinea nsys={m.colorNsys}>{m.color}</MarcaTaller></>}
                {` · ${textoBuscado(m)}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
