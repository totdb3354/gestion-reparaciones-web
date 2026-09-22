import type { ReparacionResumen, Tecnico } from '@/shared/api/client'
import { ComboNavy } from '@/shared/ui/ComboNavy'

/** Ancho del desplegable de la celda Técnico. NO es un calco: el ComboBox del JavaFX no declara ancho, solo
 *  `setMaxWidth(Double.MAX_VALUE)` (llena la celda), y ComboNavy exige un ancho numérico. 96 = el prefWidth 110 de la
 *  columna menos el padding de la celda. Elección de la web: la paridad contra las capturas no lo cubre. */
const ANCHO_COMBO = 96
/** visibleRowCount del ComboBox de la celda Técnico. */
const FILAS_COMBO = 8

/**
 * Celda Técnico: el desplegable dentro de la celda del cTecnico del JavaFX (combo de 8 filas, 11 px, que reasigna al
 * elegir y no hace nada si se elige el que ya estaba). Aquí solo se avisa por `onReasignar`: quién escribe, el aviso
 * con "Deshacer" (D2) y la congelación del sondeo mientras está abierto (D4) los cablea la página.
 */
export function CeldaTecnico({ fila, tecnicos, onReasignar }: { fila: ReparacionResumen; tecnicos: Tecnico[]; onReasignar: (idRep: string, idTec: number) => void }) {
  return (
    <ComboNavy
      valor={String(fila.idTec)}
      opciones={tecnicos.map((t) => ({ valor: String(t.idTec), etiqueta: t.nombre }))}
      onChange={(valor) => onReasignar(fila.idRep, Number(valor))}
      textoVacio={fila.nombreTecnico ?? ''}
      ancho={ANCHO_COMBO}
      tamanoTexto={11}
      visibles={FILAS_COMBO}
      aria-label={`Técnico de ${fila.idRep}`}
    />
  )
}
