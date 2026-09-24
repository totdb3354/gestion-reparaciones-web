import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import type { Componente } from '@/shared/api/client'
import { estadoStock } from '@/shared/lib/semaforoStock'
import { COLOR_BARRA_PEDIDO, colorBarraStock } from './graficos'

/** Calco de mostrarPlaceholderSku / cargarChartSku (:537-598): título "Selecciona un componente" y "↑ Haz clic en una
 *  fila" sin selección; con ella, el tipo (sin "(compartido)") y dos barras, "Stock" del color del semáforo y "Pedido"
 *  azul, eje Y "Unidades" de 0 al máximo (1 si ambos 0), tooltip con el valor. */
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
  const maximo = Math.max(componente.stock, enCamino, 1)
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[13px] font-bold text-azul-medio">{componente.tipo}</h2>
      <div role="img" aria-label={`Stock ${componente.stock}, Pedido ${enCamino}`}>
        <BarChart width={208} height={140} data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, maximo]} allowDecimals={false} tick={{ fontSize: 10 }} label={{ value: 'Unidades', angle: -90, position: 'insideLeft', fontSize: 10 }} />
          <Tooltip separator="" formatter={(v: unknown) => [String(v), '']} />
          <Bar dataKey="valor" isAnimationActive={false}>
            {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
          </Bar>
        </BarChart>
      </div>
    </div>
  )
}
