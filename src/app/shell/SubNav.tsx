import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { NavLink, matchPath, useLocation } from 'react-router'
import { BadgeAsignaciones } from '@/modules/taller/asignaciones/BadgeAsignaciones'
import { BadgePendientes } from '@/modules/taller/componentes/BadgePendientes'
import { BadgeSumaLateral } from '@/modules/taller/componentes/BadgeSumaLateral'
import type { Enlace, GrupoNav, IdGrupoNav } from '@/shared/lib/enlaces'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { gruposNav } from './navegacion'
import { guardarGruposPlegados, guardarPlegada, leerGruposPlegados, leerPlegada } from './preferencias'

/** Id de la columna: el botón de plegar la señala con `aria-controls`. Las listas de los grupos van en `<id>-<grupo>`. */
const ID_COLUMNA = 'columna-lateral'
/** Con la vista de Asignaciones abierta, la suma de su grupo plegado no sondea por su cuenta (D4). */
const RUTA_ASIGNACIONES = '/reparaciones/asignaciones'

/**
 * Columna lateral con toda la navegación de la web (0.9.12, spec «Navegación por grupos»; adaptación web, sin calco en el
 * JavaFX). Cada sección es un grupo con su cabecera plegable, y plegado enseña la suma de sus números. La columna se pliega
 * con el botón redondo del borde (0.9.10): abierta mide 200 px, con icono y nombre; plegada mide 56 px, con todos los
 * iconos, una línea entre grupos y el nombre «Grupo · Pestaña» al pasar el ratón. El navegador recuerda la columna y los
 * grupos plegados. Las tablas de las vistas se recolocan solas al cambiar el ancho (ResizeObserver de DataTable).
 */
export function SubNav() {
  const { pathname } = useLocation()
  const { sesion } = useSession()
  const [plegada, setPlegada] = useState(leerPlegada)
  const [gruposPlegados, setGruposPlegados] = useState(leerGruposPlegados)
  const grupos = gruposNav(sesion, pathname)
  const alternar = () => {
    setPlegada(!plegada)
    guardarPlegada(!plegada)
  }
  const alternarGrupo = (id: IdGrupoNav) => {
    const nuevos = new Set(gruposPlegados)
    if (nuevos.has(id)) nuevos.delete(id)
    else nuevos.add(id)
    setGruposPlegados(nuevos)
    guardarGruposPlegados(nuevos)
  }
  const accion = plegada ? 'Mostrar menú lateral' : 'Ocultar menú lateral'
  return (
    <nav
      id={ID_COLUMNA}
      aria-label="Sub-navegación"
      className={cn(
        'relative shrink-0 bg-superficie transition-[width] duration-[180ms] ease-in-out motion-reduce:transition-none',
        plegada ? 'w-14' : 'w-[200px]',
      )}
    >
      {/* overflow-hidden: al desplegar, los nombres aparecen antes de que la columna termine de crecer. A la derecha se
          deja sitio para el botón, que monta sobre el borde. */}
      <div className={cn('flex flex-col overflow-hidden py-2', plegada ? 'pr-3.5 pl-1.5' : 'pr-[18px] pl-2')}>
        {/* disableHoverableContent: el nombre se va en cuanto el ratón sale del icono; si no, plegada, su tooltip (a la
            derecha del primer icono) taparía el botón de desplegar y se llevaría sus clics. */}
        <TooltipProvider disableHoverableContent>
          {grupos.map((g, i) => (
            <GrupoLateral
              key={g.id}
              grupo={g}
              primero={i === 0}
              plegada={plegada}
              grupoPlegado={gruposPlegados.has(g.id)}
              onAlternar={() => alternarGrupo(g.id)}
              pathname={pathname}
            />
          ))}
        </TooltipProvider>
      </div>
      <button
        type="button"
        onClick={alternar}
        aria-label={accion}
        title={accion}
        aria-expanded={!plegada}
        aria-controls={ID_COLUMNA}
        className="absolute top-3.5 -right-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full border border-pill-borde bg-superficie text-azul-medio shadow-sm hover:bg-seleccion-suave"
      >
        {plegada ? <ChevronRight aria-hidden className="size-3.5" /> : <ChevronLeft aria-hidden className="size-3.5" />}
      </button>
    </nav>
  )
}

type PropsGrupo = { grupo: GrupoNav; primero: boolean; plegada: boolean; grupoPlegado: boolean; onAlternar: () => void; pathname: string }

/**
 * Un grupo de la columna.
 * - Columna abierta: una cabecera (un botón que pliega y despliega el grupo, sin navegar) y sus pestañas. Con el grupo
 *   plegado no se pintan las pestañas, la cabecera suma sus números y, si la página actual está dentro, va en navy.
 * - Columna plegada: sin cabecera, con una línea antes de cada grupo menos el primero, y todas sus pestañas aunque el
 *   grupo esté plegado.
 * La lista de pestañas va siempre en el mismo sitio del árbol, así que plegar la columna no remonta los enlaces.
 */
function GrupoLateral({ grupo: g, primero, plegada, grupoPlegado, onAlternar, pathname }: PropsGrupo) {
  const idLista = `${ID_COLUMNA}-${g.id}`
  const dentro = g.enlaces.some((e) => matchPath({ path: e.to, end: e.end ?? false }, pathname) !== null)
  return (
    <div>
      {plegada ? (
        !primero && <div aria-hidden className="mx-1 my-1.5 h-px bg-fila-sep" />
      ) : (
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={!grupoPlegado}
          aria-controls={idLista}
          className={cn(
            'flex w-full cursor-pointer items-center gap-1.5 rounded-lg py-1 pr-2.5 pl-4 text-[10.5px] font-extrabold tracking-wide whitespace-nowrap uppercase hover:bg-azul-medio/5',
            !primero && 'mt-2',
            grupoPlegado && dentro ? 'text-azul-noche' : 'text-azul-gris hover:text-azul-medio',
          )}
        >
          {g.titulo}
          {grupoPlegado && (
            <BadgeSumaLateral
              pendientes={g.enlaces.some((e) => e.badge === 'pendientes')}
              asignaciones={g.enlaces.some((e) => e.badge === 'asignaciones')}
              sondeaAsignaciones={matchPath(RUTA_ASIGNACIONES, pathname) === null}
            />
          )}
          <ChevronDown
            aria-hidden
            className={cn('ml-auto size-3.5 shrink-0 transition-transform motion-reduce:transition-none', grupoPlegado && '-rotate-90')}
          />
        </button>
      )}
      <div id={idLista}>
        {(plegada || !grupoPlegado) && g.enlaces.map((e) => <EnlaceLateral key={e.to} enlace={e} grupo={g.titulo} plegada={plegada} />)}
      </div>
    </div>
  )
}

/** Un enlace de la columna. Plegada, solo el icono: el nombre «Grupo · Pestaña» pasa al `aria-label`, porque deja de verse,
 *  y a un tooltip que sale al pasar el ratón o al llegar con el teclado. Los números van compactos, en la esquina del
 *  icono. El árbol es el mismo plegada y abierta (el tooltip, controlado, solo se abre plegada), así que plegar no remonta
 *  el enlace ni sus números y no se vuelven a pedir los contadores. */
function EnlaceLateral({ enlace: e, grupo, plegada }: { enlace: Enlace; grupo: string; plegada: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const nombre = `${grupo} · ${e.label}`
  const enlace = (
    <NavLink
      to={e.to}
      end={e.end}
      state={e.state}
      aria-label={plegada ? nombre : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex w-full items-center rounded-3xl py-2.5 text-left text-[13px] font-bold whitespace-nowrap',
          plegada ? 'justify-center' : 'px-4',
          isActive ? 'bg-azul-noche text-texto-nav-activo' : 'text-azul-medio hover:bg-azul-medio/8',
        )
      }
    >
      {({ isActive }) => (
        <>
          <e.icono aria-hidden className={cn('size-[18px] shrink-0', !plegada && 'mr-2.5')} />
          {!plegada && e.label}
          {e.badge === 'pendientes' && <BadgePendientes activo={isActive} compacto={plegada} />}
          {e.badge === 'asignaciones' && <BadgeAsignaciones activo={isActive} compacto={plegada} />}
        </>
      )}
    </NavLink>
  )
  // El disparador es un <span> que envuelve el enlace, no el propio NavLink con asChild: el Slot de Radix junta los
  // className como texto y convertiría en texto la función de className de NavLink.
  return (
    <Tooltip open={plegada && abierto} onOpenChange={(v) => setAbierto(plegada && v)}>
      <TooltipTrigger asChild>
        <span className="block">{enlace}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {nombre}
      </TooltipContent>
    </Tooltip>
  )
}
