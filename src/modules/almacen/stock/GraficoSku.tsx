import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import type { Componente } from '@/shared/api/client'
import { estadoStock } from '@/shared/lib/semaforoStock'
import { COLOR_BARRA_PEDIDO, colorBarraStock, ticksEjeY } from './graficos'

/** Calco de mostrarPlaceholderSku / cargarChartSku (:537-598): título "Selecciona un componente" y "↑ Haz clic en una
 *  fila" sin selección; con ella, el tipo (sin "(compartido)") y dos barras, "Stock" del color del semáforo y "Pedido"
 *  azul, eje Y "Unidades" de 0 al máximo (1 si ambos 0) con las marcas del JavaFX (ticksEjeY), tooltip con el valor.
 *  La rejilla discontinua y el fondo alterno de columnas del BarChart no se reproducen (diferencia aceptada). */
export function GraficoSku({ componente, enCamino }: { componente: Componente | null; enCamino: number }) {
  if (!componente) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-azul-medio">Selecciona un componente</h2>
        <p className="py-8 text-center text-[11px] text-gris-borde">↑ Haz clic en una fila</p>
      </div>
    )
  }
  const datos = [{ nombre: 'Stock', valor: componente.stock, color: colorBarraStock(estadoStock(componente)) }, { nombre: 'Pedido', valor: enCamino, color: COLOR_BARRA_PEDIDO }]
  const ticks = ticksEjeY(Math.max(componente.stock, enCamino))
  const maximo = ticks[ticks.length - 1]
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[13px] font-bold text-azul-medio">{componente.tipo}</h2>
      <div role="img" aria-label={`Stock ${componente.stock}, Pedido ${enCamino}`}>
        <BarChart width={208} height={260} data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, maximo]} ticks={ticks} interval="preserveEnd" allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: 'Unidades', angle: -90, position: 'insideLeft', fontSize: 10 }} />
          <Tooltip cursor={false} content={TooltipSoloValor} />
          <Bar dataKey="valor" isAnimationActive={false}>
            {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
          </Bar>
        </BarChart>
      </div>
    </div>
  )
}

/** Calco del Tooltip del JavaFX (:584-596): caja oscura pequeña solo con el número, sin la categoría ni el nombre de la serie. */
function TooltipSoloValor({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ value?: unknown }> }) {
  if (!active || !payload?.length) return null
  return <div className="rounded bg-azul-medio px-2 py-1 text-[11px] text-crema">{String(payload[0].value)}</div>
}
