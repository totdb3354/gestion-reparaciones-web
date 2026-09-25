import { useQueries } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

/** Tasa de cambio para la vista previa del Total EUR de los formularios (spec 4b §6-§8): `tasa` = unidades de la divisa
 *  por 1 EUR (Frankfurter `from=EUR`), así que el importe en euros es `precio / tasa`. */
export type EstadoTasa = { tasa: number | null; cargando: boolean; error: boolean }

const TASA_EUR: EstadoTasa = { tasa: 1, cargando: false, error: false }
const UNA_HORA_MS = 3_600_000

async function pedirTasa(divisa: string): Promise<number> {
  const { data } = await api.GET('/api/tipo-cambio/{divisa}', { params: { path: { divisa } } })
  const tasa = data?.value
  if (typeof tasa !== 'number' || !(tasa > 0)) throw new Error(`Tasa no válida para ${divisa}`)
  return tasa
}

/** Una consulta por divisa distinta de EUR (`['tipo-cambio', divisa]`, 1 h de vida, sin reintentos); EUR es 1 sin
 *  petición. Silenciada: el formulario pinta "—" o "Error al obtener tasa" en su sitio, sin diálogo global. */
export function useTasas(divisas: string[]): Record<string, EstadoTasa> {
  const distintas = [...new Set(divisas)].filter((d) => d !== 'EUR')
  const consultas = useQueries({
    queries: distintas.map((divisa) => ({
      queryKey: ['tipo-cambio', divisa] as const,
      queryFn: () => pedirTasa(divisa),
      staleTime: UNA_HORA_MS,
      retry: false,
      meta: { silenciarError: true },
    })),
  })
  const resultado: Record<string, EstadoTasa> = {}
  if (divisas.includes('EUR')) resultado.EUR = TASA_EUR
  distintas.forEach((divisa, i) => {
    const c = consultas[i]
    resultado[divisa] = { tasa: c.data ?? null, cargando: c.isPending, error: c.isError }
  })
  return resultado
}

/** Atajo de una divisa (editor de pedido): null cuenta como EUR. */
export function useTasa(divisa: string | null): EstadoTasa {
  const tasas = useTasas(divisa === null ? [] : [divisa])
  return divisa === null ? TASA_EUR : tasas[divisa]
}
