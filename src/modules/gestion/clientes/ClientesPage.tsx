import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useSession } from '@/app/session/SessionProvider'
import { esSuperTecnico } from '@/app/session/storage'
import type { Cliente } from '@/shared/api/client'
import { StaleDataError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ContextMenuItem } from '@/shared/ui/context-menu'
import { DataTable } from '@/shared/ui/DataTable'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { ClienteDialog } from './ClienteDialog'
import { tieneTelefonos, useBorrarCliente, useClientes, useCrearCliente, useEditarCliente, useSetActivoCliente } from './api'

const MSG_MODIFICADO = 'El cliente fue modificado por otro usuario. Se recargan los datos.'

const columnas: ColumnDef<Cliente>[] = [
  { accessorKey: 'nombre', header: 'Nombre' },
  { accessorKey: 'activo', header: 'Estado', cell: ({ row }) => <StatusBadge activo={row.original.activo} /> },
]

type Dialogo = { tipo: 'nuevo' } | { tipo: 'editar'; cliente: Cliente } | { tipo: 'borrar'; cliente: Cliente } | null

/** Contenido del menú contextual. Radix solo lo monta al abrirse, así que el useEffect equivale a la consulta
 *  tiene-telefonos que el JavaFX hace al seleccionar la fila: "Borrar" aparece solo si no tiene teléfonos. */
function MenuCliente({ c, onToggle, onEditar, onBorrar }: { c: Cliente; onToggle: () => void; onEditar: () => void; onBorrar: () => void }) {
  const { mostrarError } = useAlerta()
  const [borrable, setBorrable] = useState(false)
  useEffect(() => {
    let vivo = true
    tieneTelefonos(c.idCli)
      .then((tiene) => { if (vivo) setBorrable(!tiene) })
      .catch((e: unknown) => { if (vivo) mostrarError(e instanceof Error ? e.message : String(e)) })
    return () => { vivo = false }
  }, [c.idCli, mostrarError])
  return (
    <>
      <ContextMenuItem onSelect={onToggle}>{c.activo ? 'Desactivar' : 'Activar'}</ContextMenuItem>
      <ContextMenuItem onSelect={onEditar}>Editar</ContextMenuItem>
      {borrable && <ContextMenuItem onSelect={onBorrar}>Borrar</ContextMenuItem>}
    </>
  )
}

export function ClientesPage() {
  const { sesion } = useSession()
  const puedeEditar = esSuperTecnico(sesion)
  const { mostrarError } = useAlerta()
  const { data: clientes = [] } = useClientes()
  const crear = useCrearCliente()
  const editar = useEditarCliente()
  const setActivo = useSetActivoCliente()
  const borrar = useBorrarCliente()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [dialogo, setDialogo] = useState<Dialogo>(null)

  const activos = useMemo(() => clientes.filter((c) => c.activo), [clientes])
  const visibles = useMemo(
    () => (seleccion.size === 0 ? clientes : clientes.filter((c) => seleccion.has(c.nombre))),
    [clientes, seleccion],
  )

  /** Crear y borrar muestran el mensaje recibido (p. ej. el 409 "tiene teléfonos asociados" del servidor). */
  function tratarError(e: unknown) {
    mostrarError(e instanceof Error ? e.message : String(e))
  }
  /** Editar y activar: cualquier 409 es el aviso de modificado por otro usuario, como en el JavaFX. */
  function tratarErrorEdicion(e: unknown) {
    mostrarError(e instanceof StaleDataError ? MSG_MODIFICADO : e instanceof Error ? e.message : String(e))
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-azul-medio">Clientes</h1>
        <MultiSelect
          opciones={activos}
          clave={(c) => c.nombre}
          etiqueta={(c) => c.nombre}
          seleccion={seleccion}
          onChange={setSeleccion}
          textoVacio="Cliente"
          textoPlural={(n) => `${n} clientes`}
        />
        {puedeEditar && (
          <Button className="ml-auto rounded-3xl bg-azul-noche px-4 text-[12px] font-bold text-white hover:bg-azul-noche-hover" onClick={() => setDialogo({ tipo: 'nuevo' })}>
            Nuevo cliente
          </Button>
        )}
      </div>

      <DataTable
        columns={columnas}
        data={visibles}
        vacio="Sin clientes"
        getRowId={(c) => String(c.idCli)}
        filaClase={(c) => (c.activo ? 'border-l-8 border-l-fila-reparado-brd' : 'border-l-8 border-l-transparent')}
        menuFila={
          puedeEditar
            ? (c) => (
                <MenuCliente
                  c={c}
                  onToggle={() => setActivo.mutate({ idCli: c.idCli, activo: !c.activo, updatedAt: c.updatedAt }, { onError: tratarErrorEdicion })}
                  onEditar={() => setDialogo({ tipo: 'editar', cliente: c })}
                  onBorrar={() => setDialogo({ tipo: 'borrar', cliente: c })}
                />
              )
            : undefined
        }
      />

      <ClienteDialog
        abierto={dialogo?.tipo === 'nuevo'}
        titulo="Nuevo cliente"
        etiqueta="Nombre del cliente:"
        onCancelar={() => setDialogo(null)}
        onAceptar={(nombre) => { setDialogo(null); crear.mutate(nombre, { onError: tratarError }) }}
      />
      <ClienteDialog
        abierto={dialogo?.tipo === 'editar'}
        titulo="Editar cliente"
        etiqueta="Nombre:"
        valorInicial={dialogo?.tipo === 'editar' ? dialogo.cliente.nombre : ''}
        onCancelar={() => setDialogo(null)}
        onAceptar={(nombre) => {
          if (dialogo?.tipo !== 'editar') return
          const c = dialogo.cliente
          setDialogo(null)
          if (nombre === c.nombre) return
          editar.mutate({ idCli: c.idCli, nombre, updatedAt: c.updatedAt }, { onError: tratarErrorEdicion })
        }}
      />
      <ConfirmDialog
        abierto={dialogo?.tipo === 'borrar'}
        titulo="Borrar cliente"
        descripcion={dialogo?.tipo === 'borrar' ? `¿Seguro que quieres borrar el cliente "${dialogo.cliente.nombre}"? Esta acción no se puede deshacer.` : ''}
        textoAccion="Borrar"
        onCancelar={() => setDialogo(null)}
        onConfirmar={() => {
          if (dialogo?.tipo !== 'borrar') return
          const id = dialogo.cliente.idCli
          setDialogo(null)
          borrar.mutate(id, { onError: tratarError })
        }}
      />
    </div>
  )
}
