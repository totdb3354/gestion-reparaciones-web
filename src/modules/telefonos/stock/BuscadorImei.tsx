import { useState } from 'react'
import { useBuscarMoviles } from '@/shared/api/nsys'
import { descripcionMovil, nombreMovilNsys } from '@/shared/lib/telefonoNsys'
import { MarcaTaller } from '@/shared/ui/MarcaTaller'
import { textoBuscado } from './modelo'
import { imeisEn } from './varios'

/** Buscador de IMEI en todos los móviles del espejo, también los vendidos: con 4 caracteres o más sugiere hasta 10; al
 *  elegir uno (o Enter con el IMEI exacto) se abre su detalle. Pegar más de un IMEI abre «Comprobar una lista de IMEIs» con lo pegado. Con `palabras` (0.9.25, «Qué revisar»), lo escrito lo guarda quien llama y
 *  filtra su lista por palabras clave: admite espacios y solo sugiere IMEIs si son solo cifras (6 o más). */
type Palabras = { texto: string; onTexto: (texto: string) => void }

export function BuscadorImei({ onElegir, onPegarVarios, palabras }: { onElegir: (imeiSn: string) => void; onPegarVarios: (texto: string) => void; palabras?: Palabras }) {
  const [propio, setPropio] = useState('')
  const texto = palabras ? palabras.texto : propio
  const setTexto = palabras ? palabras.onTexto : setPropio
  const [abierto, setAbierto] = useState(false)
  // Con palabras clave, las sugerencias de IMEI solo con cifras (6 o más): con «13 pro» o un SKU no estorban.
  const limpio = palabras ? (/^\d{6,}$/.test(texto.trim()) ? texto.trim() : '') : texto.trim()
  const { data: encontrados = [], isFetching } = useBuscarMoviles(limpio)
  const elegir = (imeiSn: string) => {
    setAbierto(false)
    onElegir(imeiSn)
  }
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false) }}>
      <input type="search" onFocus={() => setAbierto(true)} aria-label={palabras ? 'Buscar IMEI, modelo o SKU en Qué revisar' : 'Buscar IMEI en todos los móviles'}
        placeholder={palabras ? 'Buscar IMEI, modelo o SKU…' : 'Buscar IMEI en todos los móviles…'} value={texto}
        onChange={(e) => {
          setTexto(palabras ? e.target.value : e.target.value.replace(/[^A-Za-z0-9]/g, ''))
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
                {`${m.imeiSn} · ${descripcionMovil(nombreMovilNsys(m), m.capacidad)}`}
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
