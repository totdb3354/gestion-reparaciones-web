import { useState, type ReactNode } from 'react'
import { ListFilter } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'
import { OPCIONES_ENVIADO, textoTienda } from './filas'
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

function Casilla({ marcada, onCambio, texto, n }: { marcada: boolean; onCambio: (m: boolean) => void; texto: string; n?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-seleccion-suave">
      <Checkbox checked={marcada} onCheckedChange={(m) => onCambio(m === true)} />
      <span className="truncate">{texto}</span>
      {n !== undefined && <span className="ml-auto pl-3 text-[11px] text-azul-gris">{n}</span>}
    </label>
  )
}

type PropsValores = { columna: string; valores: string[]; seleccion: Set<string>; onChange: (s: Set<string>) => void }

/** El filtro de Plataforma o SKU: los valores que hay en lo recibido, con casillas y «Todos» (sin ninguna marcada, no filtra). */
export function FiltroColumna({ columna, valores: recibidos, seleccion, onChange }: PropsValores) {
  const [texto, setTexto] = useState('')
  // Un valor elegido que ya no está entre las filas sigue en la lista, marcado y con recuento 0, para poder desmarcarlo.
  const ausentes = [...seleccion].filter((v) => !recibidos.includes(v)).sort((a, b) => a.localeCompare(b, 'es'))
  const valores = [...recibidos, ...ausentes]
  const vistos = texto.trim() ? valores.filter((v) => v.toLowerCase().includes(texto.trim().toLowerCase())) : valores
  const activo = seleccion.size > 0
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
        {vistos.map((v) => <Casilla key={v} marcada={seleccion.has(v)} onCambio={(m) => alternar(v, m)} texto={v} n={ausentes.includes(v) ? 0 : undefined} />)}
        {vistos.length === 0 && <p className="px-1.5 py-1 text-azul-gris">Ningún valor coincide.</p>}
      </div>
    </Marco>
  )
}

/** El filtro de Plataforma: una casilla por tienda (no por cliente) que tenga filas entre las recibidas, con su recuento; «Todos» (sin
 *  ninguna marcada, no filtra). Un cliente concreto se busca por su nombre en el buscador. */
export function FiltroTienda({ tiendas: presentes, seleccion, onChange }: {
  tiendas: { valor: string; texto: string; n: number }[]; seleccion: Set<string>; onChange: (s: Set<string>) => void
}) {
  // Una tienda elegida que ya no tiene filas sigue en la lista, marcada y con recuento 0, para poder desmarcarla.
  const tiendas = [...presentes, ...[...seleccion].filter((v) => !presentes.some((t) => t.valor === v)).map((v) => ({ valor: v, texto: textoTienda(v), n: 0 }))]
  const activo = seleccion.size > 0
  return (
    <Marco columna="Plataforma" activo={activo}>
      <Casilla marcada={!activo} onCambio={() => onChange(new Set())} texto="Todos" />
      {tiendas.map((t) => (
        <Casilla key={t.valor} marcada={seleccion.has(t.valor)} texto={t.texto} n={t.n}
          onCambio={(m) => { const s = new Set(seleccion); if (m) s.add(t.valor); else s.delete(t.valor); onChange(s) }} />
      ))}
    </Marco>
  )
}

/** El filtro de «Enviado»: Pendientes, Etiqueta generada, Enviados, Ya no pendientes e Histórico de la hoja, cada uno con su
 *  recuento (sin ninguna marcada, no filtra). */
export function FiltroEnviado({ seleccion, onChange, recuentos }: {
  seleccion: Set<string>; onChange: (s: Set<string>) => void; recuentos: Record<string, number>
}) {
  return (
    <Marco columna="Enviado" activo={seleccion.size > 0}>
      {OPCIONES_ENVIADO.map((o) => (
        <Casilla key={o.valor} marcada={seleccion.has(o.valor)} texto={o.texto} n={recuentos[o.valor] ?? 0}
          onCambio={(m) => { const s = new Set(seleccion); if (m) s.add(o.valor); else s.delete(o.valor); onChange(s) }} />
      ))}
    </Marco>
  )
}

/** El filtro de IMEI: «Solo sin IMEI» deja las filas editables sin IMEI (las enviadas también) y «No cuadran», las del IMEI en naranja. */
export function FiltroImei({ sinImei, noCuadran, onSinImei, onNoCuadran }: {
  sinImei: boolean; noCuadran: boolean; onSinImei: (a: boolean) => void; onNoCuadran: (a: boolean) => void
}) {
  return (
    <Marco columna="IMEI" activo={sinImei || noCuadran}>
      <Casilla marcada={sinImei} onCambio={onSinImei} texto="Solo sin IMEI" />
      <Casilla marcada={noCuadran} onCambio={onNoCuadran} texto="No cuadran" />
    </Marco>
  )
}
