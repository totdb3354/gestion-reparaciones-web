import { useState, type ReactNode } from 'react'
import { ListFilter } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

/** Con más valores que estos, el desplegable lleva una caja para acortar la lista (el SKU puede tener cientos). */
const MAX_SIN_CAJA = 8

function Marco({ columna, activo, children }: { columna: string; activo: boolean; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Filtrar ${columna}${activo ? ' (filtro activo)' : ''}`} data-activo={activo || undefined}
          className={cn('ml-1.5 inline-flex size-5 cursor-pointer items-center justify-center rounded align-middle hover:bg-azul-medio/10',
            activo && 'bg-azul-medio text-superficie hover:bg-azul-medio')}>
          <ListFilter className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={2} collisionPadding={8} aria-label={`Filtro de ${columna}`}
        className="w-64 max-w-[calc(100vw-16px)] p-2 text-[12px] font-normal">
        {children}
      </PopoverContent>
    </Popover>
  )
}

function Casilla({ marcada, onCambio, texto }: { marcada: boolean; onCambio: (m: boolean) => void; texto: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-seleccion-suave">
      <Checkbox checked={marcada} onCheckedChange={(m) => onCambio(m === true)} />
      <span className="truncate">{texto}</span>
    </label>
  )
}

type PropsValores = { columna: string; valores: string[]; seleccion: Set<string>; onChange: (s: Set<string>) => void }

/** El filtro de Plataforma o SKU: los valores que hay en lo recibido, con casillas y «Todos» (sin ninguna marcada, no filtra). */
export function FiltroColumna({ columna, valores, seleccion, onChange }: PropsValores) {
  const [texto, setTexto] = useState('')
  const vistos = texto.trim() ? valores.filter((v) => v.toLowerCase().includes(texto.trim().toLowerCase())) : valores
  const activo = valores.some((v) => seleccion.has(v))
  const alternar = (v: string, marcado: boolean) => {
    const s = new Set(seleccion)
    if (marcado) s.add(v)
    else s.delete(v)
    onChange(s)
  }
  return (
    <Marco columna={columna} activo={activo}>
      {valores.length > MAX_SIN_CAJA && (
        <input aria-label={`Buscar en ${columna}`} placeholder="Acortar la lista…" value={texto} autoComplete="off"
          onChange={(e) => setTexto(e.target.value)} className="mb-1.5 h-8 w-full rounded-md border border-borde-input px-2 text-[12px]" />
      )}
      <Casilla marcada={!activo} onCambio={() => onChange(new Set())} texto="Todos" />
      <div className="max-h-64 overflow-y-auto">
        {vistos.map((v) => <Casilla key={v} marcada={seleccion.has(v)} onCambio={(m) => alternar(v, m)} texto={v} />)}
        {vistos.length === 0 && <p className="px-1.5 py-1 text-azul-gris">Ningún valor coincide.</p>}
      </div>
    </Marco>
  )
}

/** El filtro de IMEI: «Solo sin IMEI» deja las filas sin enviar y sin IMEI. */
export function FiltroSinImei({ activo, onChange }: { activo: boolean; onChange: (a: boolean) => void }) {
  return (
    <Marco columna="IMEI" activo={activo}>
      <Casilla marcada={activo} onCambio={onChange} texto="Solo sin IMEI" />
    </Marco>
  )
}
