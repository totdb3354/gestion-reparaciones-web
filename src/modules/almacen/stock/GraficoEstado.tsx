import { Cell, Pie, PieChart } from 'recharts'
import { COLORES_DONUT, type ConteosDonut } from './graficos'

const SECTORES = [
  { clave: 'ok', nombre: 'OK', color: COLORES_DONUT.ok },
  { clave: 'bajo', nombre: 'Bajo', color: COLORES_DONUT.bajo },
  { clave: 'sinStock', nombre: 'Sin stock', color: COLORES_DONUT.sinStock },
] as const

/** Calco del PieChart de 120×120 con el círculo blanco de radio 38 encima (donut), el total de 17 px en el centro con
 *  "total" de 9 px debajo, y la leyenda manual (leyendaItem :524-535): cuadrado 8×8, nombre de 9 px gris y número de
 *  12 px negrita. Sin animación, como `animated="false"` del FXML. */
export function GraficoEstado({ conteos }: { conteos: ConteosDonut }) {
  const datos = SECTORES.map((s) => ({ nombre: s.nombre, valor: conteos[s.clave], color: s.color }))
  return (
    <div className="flex flex-col items-center gap-2">
      <h2 className="self-start text-[13px] font-bold text-azul-medio">Estado del stock</h2>
      <div className="relative h-[120px] w-[120px]">
        <PieChart width={120} height={120}>
          <Pie data={datos} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" innerRadius={38} outerRadius={60} isAnimationActive={false} stroke="none">
            {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
          </Pie>
        </PieChart>
        <div data-testid="donut-total" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[17px] leading-none font-bold text-azul-medio">{conteos.total}</span>
          <span className="text-[9px] text-texto-fecha-inicio">total</span>
        </div>
      </div>
      <div data-testid="donut-leyenda" className="flex justify-center gap-4">
        {datos.map((d) => (
          <div key={d.nombre} className="flex items-start gap-1.5">
            <span aria-hidden="true" className="mt-0.5 inline-block h-2 w-2" style={{ backgroundColor: d.color }} />
            <div className="flex flex-col">
              <span className="text-[9px] text-texto-fecha-inicio">{d.nombre}</span>
              <span className="text-[12px] font-bold text-azul-medio">{d.valor}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
