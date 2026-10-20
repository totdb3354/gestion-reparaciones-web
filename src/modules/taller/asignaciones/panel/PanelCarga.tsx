import { useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { CargaTecnicosRespuesta } from '@/shared/api/client'
import {
  abrirPanelCarga, cambiarAlcancePanelCarga, cerrarPanelCarga, minimizarPanelCarga, moverPanelCarga, pedirFiltroPorTecnico,
  usePanelCarga, type EstadoPanelCarga, type PanelCarga as Recordado,
} from '@/shared/lib/panelCarga'
import { cn } from '@/shared/lib/utils'
import { ATRIBUTO_ENCIMA_DE_VENTANAS } from '@/shared/ui/dialog'
import { useSession } from '@/shared/session/SessionProvider'
import { esAdminOSuperTecnico } from '@/shared/session/storage'
import { useCargaTecnicos } from '../api'
import { altoMiniBarra, CLASE_BARRA_NIVEL, cuantosAlta, nivelCarga, ordenarPorCarga, pctTotal } from '../carga'
import { FilaTecnico } from './FilaTecnico'
import { ToggleAlcance } from './ToggleAlcance'
import { useArrastre } from './useArrastre'
import { useColocarAnclado } from './useColocarAnclado'

const RUTA_ASIGNACIONES = '/reparaciones/asignaciones'
const MSG_ERROR = 'No se pudo cargar la carga de técnicos.'
const MSG_SIN_TECNICOS = 'Sin técnicos activos'
/** Nombre accesible de la lista: puede haber otras listas en la pantalla. */
const ETIQUETA_LISTA = 'Carga por técnico'
/** Hay una ventana abierta si existe su fondo oscuro (el mismo criterio que usa la capa CSS del panel). */
const hayVentanaAbierta = () => document.querySelector('[data-slot="dialog-overlay"]') !== null

/** Panel flotante «Carga de técnicos» (spec 0.9.20): en cualquier pantalla, solo para supertécnico y admin; para el resto
 *  no monta nada ni pide nada. Abierto, minimizado (pastilla) o cerrado, según lo que recuerde el navegador. */
export function PanelCarga() {
  const { sesion } = useSession()
  if (!esAdminOSuperTecnico(sesion)) return null
  return <PanelCargaVisible />
}

function PanelCargaVisible() {
  const recordado = usePanelCarga()
  // Abierto o minimizado pide (la pastilla enseña datos); cerrado, nada.
  const consulta = useCargaTecnicos(recordado.estado !== 'cerrado')
  // Ratón encima (o arrastrando): se pinta la última copia, para que ninguna fila se mueva bajo el cursor. Se apunta en QUÉ
  // estado entró el ratón: al minimizar o cerrar con el ratón encima, el `pointerleave` no llega (la caja desaparece), y así
  // la pastilla o el panel nuevos no se quedan congelados. Además, en cada cambio de estado se olvida el «encima»: si no, al
  // volver a ese estado desde fuera (teclado, botón de la barra azul) sin pasar el ratón, el panel seguiría congelado.
  const [encimaDe, setEncimaDe] = useState<EstadoPanelCarga | null>(null)
  const [estadoVisto, setEstadoVisto] = useState(recordado.estado)
  if (estadoVisto !== recordado.estado) {
    setEstadoVisto(recordado.estado)
    setEncimaDe(null)
  }
  const datos = useCongelado(consulta.data, encimaDe === recordado.estado)
  const raton = { onPointerEnter: () => setEncimaDe(recordado.estado), onPointerLeave: () => setEncimaDe(null) }

  if (recordado.estado === 'cerrado') return null
  if (recordado.estado === 'minimizado') return <Pastilla recordado={recordado} datos={datos} {...raton} />
  return <Ventana recordado={recordado} datos={datos} error={consulta.isError} {...raton} />
}

/** `valor`, salvo mientras `congelado`: entonces, el último que se pintó. Solo congela si ya hay algo pintado (`copia`
 *  definida): con el ratón encima durante la primera carga no hay nada que conservar y los datos salen al llegar. Ajuste de
 *  estado durante el render, sin efecto. */
function useCongelado<T>(valor: T, congelado: boolean): T {
  const [copia, setCopia] = useState(valor)
  const congela = congelado && copia !== undefined
  if (!congela && copia !== valor) setCopia(valor)
  return congela ? copia : valor
}

/** Pulsar un técnico: Asignaciones con su filtro en solitario; el panel sigue abierto (spec 0.9.20 §2). Con una ventana
 *  abierta fuera de Asignaciones no hace nada: navegar la cerraría y se perdería lo que tuviera sin guardar. En Asignaciones
 *  sí: filtra la tabla de detrás y la ventana no se toca. */
function useElegirTecnico() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (idTec: number) => {
    if (hayVentanaAbierta() && pathname !== RUTA_ASIGNACIONES) return
    pedirFiltroPorTecnico(idTec)
    if (pathname !== RUTA_ASIGNACIONES) navigate(RUTA_ASIGNACIONES)
  }
}

type PropsVista = {
  recordado: Recordado
  datos: CargaTecnicosRespuesta | undefined
  onPointerEnter: () => void
  onPointerLeave: () => void
}

/** Capa del panel y la pastilla (spec 0.9.20 §2, «Capas»): z-30 normalmente (bajo la campana, el rastro y los menús); con
 *  una ventana abierta (existe su fondo oscuro), por encima de ella (z-[55]) y por debajo de la capa de carga (z-[60]). */
const CAPA = 'z-30 [body:has([data-slot=dialog-overlay])_&]:z-[55]'
const ENCIMA = { [ATRIBUTO_ENCIMA_DE_VENTANAS]: '' }

function Ventana({ recordado, datos, error, onPointerEnter, onPointerLeave }: PropsVista & { error: boolean }) {
  const cajaRef = useRef<HTMLElement>(null)
  useColocarAnclado(cajaRef, recordado.ancla)
  const asa = useArrastre(cajaRef, moverPanelCarga)
  const elegir = useElegirTecnico()
  const filas = datos ? ordenarPorCarga(datos[recordado.alcance]) : null
  return (
    <section
      ref={cajaRef}
      aria-label="Carga de técnicos"
      data-testid="panel-carga"
      {...ENCIMA}
      style={{ pointerEvents: 'auto' }}
      // Con una ventana abierta, tocar el panel no mueve el foco: se queda en el campo de la ventana (si no, Radix lo
      // devuelve ahí con el texto entero seleccionado y lo medio escrito se pisaría). Sin ventana, los botones toman el
      // foco como siempre. Los eventos de puntero, los clics y los arrastres no cambian.
      onMouseDown={(e) => { if (hayVentanaAbierta()) e.preventDefault() }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(CAPA, 'fixed flex w-[340px] flex-col rounded-[10px] border border-pill-borde bg-superficie shadow-lg')}
    >
      <div
        {...asa}
        title="Arrastra para moverlo"
        className="flex cursor-grab touch-none items-center gap-2 border-b border-carga-pista py-2 pr-2.5 pl-3 select-none"
      >
        <span aria-hidden className="text-[12px] tracking-[-2px] text-texto-sub">⋮⋮</span>
        <h2 className="text-[13px] font-bold whitespace-nowrap text-azul-medio">Carga de técnicos</h2>
        <ToggleAlcance valor={recordado.alcance} onCambio={cambiarAlcancePanelCarga} />
        <span className="flex-1" />
        <BotonIcono etiqueta="Minimizar el panel de carga" titulo="Minimizar" onClick={minimizarPanelCarga}>–</BotonIcono>
        <BotonIcono etiqueta="Cerrar el panel de carga" titulo="Cerrar" onClick={cerrarPanelCarga}>×</BotonIcono>
      </div>
      <div
        // Con una ventana abierta, el bloqueo de scroll de Radix (oyente en `document`) cancela la rueda y el arrastre
        // táctil fuera de ella. Parar la propagación evita que lleguen y el navegador desplaza la lista de forma nativa
        // (suave, con inercia, táctil), con o sin ventana. Mismo patrón que `noCancelarDesplazamiento` en shared/ui/popover.tsx.
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="max-h-[min(400px,calc(100vh-140px))] min-h-[60px] overflow-y-auto px-2 py-1.5"
      >
        {filas === null ? (
          error ? (
            <p role="alert" className="py-4 text-center text-[12.5px] text-texto-error">{MSG_ERROR}</p>
          ) : (
            <p className="py-4 text-center text-[12.5px] text-azul-gris">Cargando…</p>
          )
        ) : filas.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-azul-gris">{MSG_SIN_TECNICOS}</p>
        ) : (
          // group/carga: al pasar el ratón por la lista, las demás filas se atenúan (como en la ventana de antes). La
          // separación es padding de cada <li>, no `gap` del <ul>, para que no haya hueco que atenúe sin resaltar nada.
          <ul aria-label={ETIQUETA_LISTA} className="group/carga flex flex-col">
            {filas.map((f) => (
              <li key={f.idTec} className="py-[3px] transition-opacity duration-150 group-hover/carga:opacity-35 hover:opacity-100!">
                <FilaTecnico fila={f} alcance={recordado.alcance} onElegir={() => elegir(f.idTec)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function BotonIcono({ etiqueta, titulo, onClick, children }: { etiqueta: string; titulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-no-arrastre
      aria-label={etiqueta}
      title={titulo}
      onClick={onClick}
      className="flex size-6 cursor-pointer items-center justify-center rounded-md text-[15px] leading-none text-azul-gris hover:bg-pill-bg hover:text-azul-noche"
    >
      {children}
    </button>
  )
}

/** Minimizado: «Carga», una mini-barra por técnico (en el orden de la lista) y cuántos están al 90 % o más. La pastilla
 *  entera es el asa; un clic sin arrastrar la abre. Sin datos, solo «Carga». Abre el contenedor, no el botón interior:
 *  `useArrastre` captura el puntero en la pastilla y el navegador manda entonces el clic al contenedor, no al botón. El
 *  botón sigue ahí para el teclado: Intro o Espacio sobre él lanzan un clic que sube hasta el contenedor. */
function Pastilla({ recordado, datos, onPointerEnter, onPointerLeave }: PropsVista) {
  const cajaRef = useRef<HTMLDivElement>(null)
  useColocarAnclado(cajaRef, recordado.ancla)
  const asa = useArrastre(cajaRef, moverPanelCarga)
  const filas = datos ? ordenarPorCarga(datos[recordado.alcance]) : null
  const altas = filas ? cuantosAlta(filas) : 0
  return (
    <div
      ref={cajaRef}
      {...asa}
      data-testid="pastilla-carga"
      {...ENCIMA}
      style={{ pointerEvents: 'auto' }}
      // Igual que en el panel: con una ventana abierta, tocar la pastilla no le quita el foco a su campo.
      onMouseDown={(e) => { if (hayVentanaAbierta()) e.preventDefault() }}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('[data-no-arrastre]')) return
        abrirPanelCarga()
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      title="Clic: abrir el panel · arrastra para moverla"
      className={cn(
        CAPA,
        'fixed flex cursor-grab touch-none items-center gap-2 rounded-[20px] bg-azul-noche py-[7px] pr-2 pl-3.5 text-[12px] font-bold whitespace-nowrap text-superficie shadow-lg select-none hover:bg-azul-noche-hover',
      )}
    >
      <button type="button" aria-label="Abrir el panel de carga" className="flex cursor-pointer items-center gap-2">
        <span>Carga</span>
        {filas !== null && (
          <>
            <span aria-hidden className="flex h-4 items-end gap-0.5">
              {filas.map((f) => (
                <i
                  key={f.idTec}
                  className={cn('block w-1 rounded-[1px]', f.sinJornada ? 'bg-texto-sub' : CLASE_BARRA_NIVEL[nivelCarga(pctTotal(f))])}
                  style={{ height: `${altoMiniBarra(f)}px` }}
                />
              ))}
            </span>
            <span title="Técnicos al 90 % o más" className={cn('rounded-[10px] px-[7px] py-px text-[11px]', altas > 0 ? 'bg-carga-alta' : 'bg-white/18')}>
              {altas} al 90 %+
            </span>
          </>
        )}
      </button>
      <button
        type="button"
        data-no-arrastre
        onClick={cerrarPanelCarga}
        aria-label="Cerrar el panel de carga"
        title="Cerrar"
        className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-white/12 text-[12px] leading-none"
      >
        ×
      </button>
    </div>
  )
}
