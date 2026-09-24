import { useEffect, useMemo, useState } from 'react'
import type { Proveedor } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError, ReglaNegocioError } from '@/shared/api/errors'
import { descargarCsv } from '@/shared/lib/csv'
import { useStore } from '@/shared/lib/store'
import { useInteraccionesAbiertas } from '@/shared/lib/useInteraccionesAbiertas'
import { useSession } from '@/shared/session/SessionProvider'
import { esSuperTecnico } from '@/shared/session/storage'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { BotonPrimario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/DataTable'
import { EtiquetaActualizado } from '@/shared/ui/EtiquetaActualizado'
import { useRegistrarExportable } from '@/shared/ui/exportable'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { useBorrarProveedor, useCrearProveedor, useEditarProveedor, useProveedoresComponentes, useSetActivoProveedor } from './api'
import { CABECERAS_CSV_PROVEEDORES, claseFilaProveedor, crearColumnasProveedores, filaCsvProveedor } from './columnas'
import { EditarProveedorDialog } from './EditarProveedorDialog'
import { filtroProveedores, seleccionProveedores } from './estado'
import { MenuProveedor } from './MenuProveedor'
import { NuevoProveedorDialog } from './NuevoProveedorDialog'

type Dialogo = { tipo: 'nuevo' } | { tipo: 'editar'; p: Proveedor } | { tipo: 'borrar'; p: Proveedor } | null

/** Pestaña "Proveedores" de StockView.fxml (spec 4a §6): sin buscador ni "Limpiar filtros", filtro solo de activos. */
export function ProveedoresPage() {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const { mostrarError } = useAlerta()
  const { hayAlguna, marcar } = useInteraccionesAbiertas()
  const [seleccion, setSeleccion] = useStore(filtroProveedores)
  const [seleccionada, setSeleccionada] = useStore(seleccionProveedores)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  // Texto de un 422 del servidor para el diálogo de alta o edición abierto (spec §8): se pinta dentro, que sigue abierto.
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const { data = [], dataUpdatedAt, refetch } = useProveedoresComponentes({ activo: !hayAlguna })
  const crear = useCrearProveedor()
  const editar = useEditarProveedor()
  const setActivo = useSetActivoProveedor()
  const borrar = useBorrarProveedor()
  useEffect(() => {
    if (!dialogo) return
    marcar(true)
    return () => marcar(false)
  }, [dialogo, marcar])

  const activos = useMemo(() => data.filter((p) => p.activo), [data])
  const visibles = useMemo(() => (seleccion.size === 0 ? data : data.filter((p) => seleccion.has(p.nombre))), [data, seleccion])
  const columnas = useMemo(() => crearColumnasProveedores(), [])
  useRegistrarExportable(() => descargarCsv('proveedores', CABECERAS_CSV_PROVEEDORES, visibles.map(filaCsvProveedor)))

  function cerrarDialogo() {
    setDialogo(null)
    setErrorServidor(null)
  }

  /** Alta y edición (silencian el diálogo global): el 422 va al diálogo, que sigue abierto; el resto se avisa con el
   *  mapeo común, salvo lo que ya gestiona el mecanismo global (401, sin conexión). */
  function alFallarDialogo(e: unknown) {
    if (e instanceof ReglaNegocioError) { setErrorServidor(e.message); return }
    if (esErrorGestionadoGlobalmente(e)) return
    mostrarError(mensajeDeError(e))
  }

  return (
    <div className="p-5">
      <h1 className="mb-3 text-2xl font-bold text-azul-medio">Proveedores</h1>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <MultiSelect opciones={activos} clave={(p) => p.nombre} etiqueta={(p) => p.nombre} seleccion={seleccion} onChange={setSeleccion} textoVacio="Proveedor" textoPlural={(n) => `${n} proveedores`} onOpenChange={marcar} className="min-w-[160px]" />
        {puedeEditar && <BotonPrimario className="ml-6" onClick={() => setDialogo({ tipo: 'nuevo' })}>Nuevo proveedor</BotonPrimario>}
      </div>
      <DataTable
        columns={columnas}
        data={visibles}
        vacio="Sin proveedores"
        getRowId={(p) => String(p.idProv)}
        seleccionada={seleccionada}
        onSeleccionar={setSeleccionada}
        filaClase={claseFilaProveedor}
        altoFila={35}
        ordenacion={false}
        menuFila={puedeEditar ? (p) => (
          <MenuProveedor p={p} onToggle={(x) => setActivo.mutate({ idProv: x.idProv, activo: !x.activo })} onEditar={(x) => setDialogo({ tipo: 'editar', p: x })} onBorrar={(x) => setDialogo({ tipo: 'borrar', p: x })} onInteraccion={marcar} />
        ) : undefined}
      />
      <EtiquetaActualizado actualizadoEn={dataUpdatedAt} onRecargar={() => refetch({ throwOnError: true })} />
      <NuevoProveedorDialog
        abierto={dialogo?.tipo === 'nuevo'}
        enviando={crear.isPending}
        errorServidor={errorServidor}
        onCancelar={cerrarDialogo}
        onConfirmar={(nombre) => { setErrorServidor(null); crear.mutate(nombre, { onSuccess: cerrarDialogo, onError: alFallarDialogo }) }}
      />
      <EditarProveedorDialog
        proveedor={dialogo?.tipo === 'editar' ? dialogo.p : null}
        enviando={editar.isPending}
        errorServidor={errorServidor}
        onCancelar={cerrarDialogo}
        onConfirmar={(datos) => {
          if (dialogo?.tipo !== 'editar') return
          setErrorServidor(null)
          editar.mutate({ idProv: dialogo.p.idProv, ...datos }, { onSuccess: cerrarDialogo, onError: alFallarDialogo })
        }}
      />
      <ConfirmDialog
        abierto={dialogo?.tipo === 'borrar'}
        titulo="Borrar proveedor"
        descripcion={dialogo?.tipo === 'borrar' ? `¿Eliminar el proveedor "${dialogo.p.nombre}"?` : ''}
        textoAccion="Borrar"
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => { if (dialogo?.tipo !== 'borrar') return; const id = dialogo.p.idProv; setDialogo(null); borrar.mutate(id) }}
      />
    </div>
  )
}
