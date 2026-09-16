import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { descargarCsv } from '@/shared/lib/csv'
import { useStore } from '@/shared/lib/store'
import { cn } from '@/shared/lib/utils'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { BotonSecundario } from '@/shared/ui/Botones'
import { DataTable } from '@/shared/ui/DataTable'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { MenuHistorial } from '../componentes/MenuHistorial'
import { TITULOS_BORRAR, useAccionesTrabajo } from '../componentes/useAccionesTrabajo'
import { filtrosImeis, ultimoImeiVisto } from '../estado'
import { columnasTrabajo, textoCeldaTrabajo } from '../historial/columnasTrabajo'
import { estadoIncidencia } from '../lib/filtros'
import { traducirModelo } from '../lib/modelos'
import { esAjeno, filasDetalle, textoTrabajos } from './agrupacion'
import { BarraFiltrosImeis } from './BarraFiltrosImeis'
import { FMT } from './constantes'
import { CABECERAS_DETALLE, filaDetalle } from './csvImeis'
import { useTrabajos } from './useTrabajos'

/** Detalle de un IMEI: calco de AgrupadoController en modo DETALLE (barra "← Volver · IMEI · modelo · N trabajos" y tabla de trabajos con Tipo). */
export function ImeiDetallePage() {
  const { imei = '' } = useParams()
  const navigate = useNavigate()
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const trabajos = useTrabajos()
  const [filtros] = useStore(filtrosImeis)
  // El maestro lo reselecciona al volver (también con el botón atrás del navegador).
  useEffect(() => { ultimoImeiVisto.set(imei) }, [imei])
  const detalle = useMemo(() => filasDetalle(trabajos, imei, filtros), [trabajos, imei, filtros])
  const modelo = traducirModelo(trabajos.find((t) => t.imei === imei && t.modelo)?.modelo)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const { acciones, dialogos } = useAccionesTrabajo({ tituloBorrar: TITULOS_BORRAR.trabajo, avisoReferencia: 'Este trabajo está siendo referenciado' })
  const columnas = useMemo(() => columnasTrabajo({ conTipo: true, patronFechas: FMT, tituloId: 'Id', onIrA: setSeleccionada }), [])
  const conFiltroTecnico = filtros.tecnicos.size > 0

  useRegistrarExportable(() => descargarCsv(`agrupado_${imei}`, CABECERAS_DETALLE, detalle.filas.map(filaDetalle)))

  return (
    <div className="p-10">
      <div className="mb-2 flex items-center gap-3">
        <BotonSecundario onClick={() => navigate('/reparaciones/imeis')}>← Volver</BotonSecundario>
        <span aria-hidden="true" className="h-6 w-px bg-fila-sep" />
        <span className="text-[13px] font-bold text-azul-medio">IMEI: {imei}</span>
        {modelo && <span className="text-[12px] text-azul-gris">• {modelo}</span>}
        <span className="text-[12px] text-azul-gris">{textoTrabajos(detalle, conFiltroTecnico)}</span>
      </div>
      <BarraFiltrosImeis modo="detalle" />
      <DataTable
        columns={columnas}
        data={detalle.filas}
        vacio=""
        ajuste="estirar"
        // tabla.setFixedCellSize(44), la misma tabla que el maestro
        altoFila={44}
        getRowId={(r) => r.idRep}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        filaClase={(r) => cn('border-l-8', estadoIncidencia(r) === 'abiertas' ? 'border-l-fila-incidencia-brd' : estadoIncidencia(r) === 'cerradas' ? 'border-l-fila-reparado-brd' : 'border-l-transparent', esAjeno(r, filtros) && 'opacity-45')}
        menuFila={(r, celda) => <MenuHistorial rep={r} celda={celda} texto={textoCeldaTrabajo(r, celda.columnaId, FMT)} puedeEditar={puedeEditar} acciones={acciones} />}
      />
      {dialogos}
    </div>
  )
}
