import { useMemo, useState } from 'react'
import { StaleDataError } from '@/shared/api/errors'
import { crearClavesIdempotencia } from '@/shared/lib/clavesIdempotencia'
import type { PrecargaPedido } from '@/shared/lib/formularioPedido'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { ComboNavy } from '@/shared/ui/ComboNavy'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { useProveedoresComponentes } from '../../proveedores/api'
import { useComponentesStock } from '../../stock/api'
import { agruparCompartidos, nombreGrupo } from '../../stock/grupos'
import { useCompras, useGuardarLoteCompras } from '../api'
import { agruparEnBloques, situacion } from '../bloques/reglas'
import { destinoElegido, destinosDelCuerpo, opcionesDestino } from './destinos'
import { DialogoPedidoBase } from './DialogoPedidoBase'
import { mensajeErrorGuardado } from './errores'
import {
  aplicarPrevision, avisoNadaQuePedir, avisoOmitidas, avisoRepetida, avisoSinLista, avisoSinPedido, cambiarLinea, cuantasPrevision, cuerpoLoteCompras,
  elegirPieza, lineaCompraVacia, ponerCantidadesPrevistas, precargaInicial, quitarLinea, siguienteId, sinLista, type LineaBase, type LineaCompra,
} from './lineas'
import { DestinoRecuadro, RecuadroProveedor, RecuadroRepartir } from './RecuadroProveedor'
import {
  avisoYaEstaba, lineasDe, opcionesOtroProveedor, opcionesPasarA, pasarA, POR_REPARTIR, recuadrosDelPedido, repartirLineas, tambienVa,
  textoConfirmar, textoQuitarRecuadro, validarPedido, type ClaveRecuadro,
} from './recuadros'
import { TablaLineas } from './TablaLineas'

const OPERACION = 'compras:lote'

type Props = { precarga: PrecargaPedido; onCerrar: () => void }

/** El conjunto sin `clave`: desplegar un recuadro. */
function sinClave(plegados: ReadonlySet<ClaveRecuadro>, clave: ClaveRecuadro): ReadonlySet<ClaveRecuadro> {
  const resto = new Set(plegados)
  resto.delete(clave)
  return resto
}

/** "Nuevo pedido" (FormularioCompraController, spec §6): modal en el sitio (P1) con la precarga del store. Un único
 *  POST /api/compras/lote con Idempotency-Key (P5): misma clave mientras el cuerpo no cambie, nueva tras un éxito.
 *  0.9.9 (spec 2026-10-13 varios proveedores): un recuadro por proveedor, que es su bloque, con su destino en la
 *  cabecera; lo precargado se reparte solo al proveedor que vende cada pieza y lo demás espera en «Por repartir». Modo
 *  «Añadir líneas» de un bloque (precarga `bloque`): un único recuadro con proveedor y destino fijos. */
export function NuevoPedidoDialog({ precarga, onCerrar }: Props) {
  const componentes = useComponentesStock({ activo: false })
  const proveedores = useProveedoresComponentes({ activo: false })
  // Los bloques salen de los pedidos (sin sondeo: con el formulario abierto las vistas no refrescan).
  const compras = useCompras({ activo: false })
  const bloques = useMemo(() => agruparEnBloques(compras.data ?? []), [compras.data])
  const fijo = precarga.modo === 'bloque' ? precarga : null
  const activos = useMemo(() => (componentes.data ?? []).filter((c) => c.activo), [componentes.data])
  const proveedoresActivos = useMemo(() => (proveedores.data ?? []).filter((p) => p.activo), [proveedores.data])
  const idsActivos = useMemo(() => new Set(proveedoresActivos.map((p) => p.idProv)), [proveedoresActivos])
  const opciones = useMemo(() => agruparCompartidos(activos).map((f) => ({ clave: String(f.idCom), etiqueta: nombreGrupo(f) })), [activos])
  const [lineas, setLineas] = useState<LineaCompra[] | null>(precarga.modo === 'vacio' || fijo ? [] : null)
  // Recuadros que siguen aunque se queden sin líneas (solo los quita su ×): los elegidos a mano, los del reparto de la
  // precarga y los de «Pasar a…». En «Añadir líneas», el del bloque.
  const [anadidos, setAnadidos] = useState<number[]>(fijo ? [fijo.idProv] : [])
  const [plegados, setPlegados] = useState<ReadonlySet<ClaveRecuadro>>(() => new Set())
  // Recuadro con el error de «Confirmar» (borde rojo) y recuadro que se trae a la vista.
  const [marcado, setMarcado] = useState<ClaveRecuadro | null>(null)
  const [aLaVista, setALaVista] = useState<ClaveRecuadro | null>(null)
  // Recuadro con líneas que se va a quitar: espera la confirmación.
  const [quitando, setQuitando] = useState<number | null>(null)
  // Una línea seleccionada para todo el diálogo. La de juntar una repetida va por petición (marca), porque el clic en la
  // opción del autocompletar burbujea hasta la fila que desaparece y la seleccionaría después.
  const [seleccionada, setSeleccionada] = useState<number | null>(null)
  const [desplazarA, setDesplazarA] = useState<number | null>(null)
  const [peticion, setPeticion] = useState<{ id: number; marca: number } | null>(null)
  const [marcaVista, setMarcaVista] = useState<number | null>(null)
  if (peticion && peticion.marca !== marcaVista) {
    setMarcaVista(peticion.marca)
    setSeleccionada(peticion.id)
    setDesplazarA(peticion.id)
  }
  const [omitidas, setOmitidas] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sinPedido, setSinPedido] = useState(0)
  // Destino elegido a mano por proveedor (idBloque o null = bloque nuevo).
  const [elegidos, setElegidos] = useState<Record<number, number | null>>({})
  const [sinListaVistas, setSinListaVistas] = useState(0)
  const [nadaQuePedir, setNadaQuePedir] = useState(false)
  const [repetida, setRepetida] = useState<string | null>(null)
  // «Añadir previsión…» de un bloque: se aplica una vez, cuando el listado de Stock ha cargado (bien o mal).
  const [previsionPendiente, setPrevisionPendiente] = useState(fijo?.prevision === true)
  // «Pedir» y «Pedir todas las piezas» (2026-10-13): su «Pedir 60 d» se pone una vez, con la lista fresca.
  const [cantidadesPendientes, setCantidadesPendientes] = useState(precarga.modo === 'componentes')
  // Una instancia por apertura: el host remonta el diálogo en cada apertura (key), así que no sobrevive a un éxito.
  const [claves] = useState(() => crearClavesIdempotencia())
  const guardar = useGuardarLoteCompras()
  const bloqueFijo = fijo ? bloques.get(String(fijo.idBloque)) : undefined
  const nombreFijo = fijo ? proveedoresActivos.find((p) => p.idProv === fijo.idProv)?.nombre ?? bloqueFijo?.nombreProveedor ?? '' : ''
  const nombreProv = (idProv: number) => (fijo !== null && idProv === fijo.idProv ? nombreFijo : proveedoresActivos.find((p) => p.idProv === idProv)?.nombre ?? `Proveedor ${idProv}`)
  const nombrePieza = (idCom: number) => opciones.find((o) => o.clave === String(idCom))?.etiqueta ?? ''

  // Precarga una sola vez, cuando la lista de componentes termina de cargar (bien o mal): patrón "ajustar el estado
  // durante el render" (CampoAutocompletar, useErrorServidor), sin useEffect + setState. Espera también a los
  // proveedores: el reparto automático necesita saber cuáles están activos.
  // Si la carga falla, `activos` queda vacío y toda solicitud parecería "omitida" (falso: no se ha podido leer la
  // lista, no es que estén desactivados). El diálogo global de error ya avisa del fallo, así que aquí no se cuenta
  // ninguna omitida y no sale la línea de información.
  if (lineas === null && (componentes.isSuccess || componentes.isError) && (proveedores.isSuccess || proveedores.isError)) {
    const inicial = precargaInicial(precarga, activos)
    const repartidas = repartirLineas(inicial.lineas, activos, idsActivos)
    setLineas(repartidas)
    // Los recuadros del reparto se quedan aunque se quite su última línea: solo la × los quita.
    const ids = repartidas.flatMap((l) => (l.idProv === null ? [] : [l.idProv]))
    setAnadidos((a) => [...new Set([...a, ...ids])])
    setOmitidas(componentes.isError ? 0 : inicial.omitidas)
  }
  // «Pedir» y «Pedir todas las piezas» (2026-10-13): las líneas salen ya (C25); su «Pedir 60 d», con la lista fresca.
  if (cantidadesPendientes && lineas !== null && ((componentes.isSuccess && !componentes.isFetching) || componentes.isError)) {
    setCantidadesPendientes(false)
    if (componentes.isSuccess) setLineas(ponerCantidadesPrevistas(lineas, activos))
  }
  // Con la caché de Stock ya cargada, `isSuccess` es true con datos viejos: se espera a que acabe la recarga.
  if (previsionPendiente && fijo && lineas !== null && ((componentes.isSuccess && !componentes.isFetching) || componentes.isError)) {
    setPrevisionPendiente(false)
    if (componentes.isSuccess) {
      const r = aplicarPrevision(lineas, activos, fijo.idProv)
      setLineas(r.lineas)
      setSinPedido(r.sinPedido)
      setSinListaVistas(sinLista(activos))
      setNadaQuePedir(r.lineas.length === lineas.length)
    }
  }

  const todas = lineas ?? []
  const recuadros = fijo ? [fijo.idProv] : recuadrosDelPedido(todas, anadidos, nombreProv)
  const porRepartir = lineasDe(todas, POR_REPARTIR)
  const nBloques = recuadros.filter((idProv) => lineasDe(todas, idProv).length > 0).length
  const opcionesOtro = fijo ? [] : opcionesOtroProveedor(proveedoresActivos, recuadros, bloques)

  /** Tocar las líneas borra los avisos, el error y la marca del recuadro. */
  function limpiarAvisos() {
    setError(null)
    setSinPedido(0)
    setSinListaVistas(0)
    setNadaQuePedir(false)
    setRepetida(null)
    setMarcado(null)
    setALaVista(null)
  }
  function seleccionar(id: number) {
    setSeleccionada(id)
    setDesplazarA(null)
    // El recuadro añadido o con error se trae a la vista una sola vez.
    setALaVista(null)
  }
  function cambiar(id: number, cambio: Partial<LineaBase>) {
    setLineas((ls) => cambiarLinea<LineaCompra>(ls ?? [], id, cambio))
    limpiarAvisos()
  }
  /** Elegir la pieza de una línea: lo que falta y, si la pieza ya estaba en su recuadro, se junta en esa línea. */
  function elegir(id: number, idCom: number) {
    const linea = todas.find((l) => l.id === id)
    const r = elegirPieza(todas, id, idCom, activos)
    setLineas(r.lineas)
    limpiarAvisos()
    if (r.repetida === null || linea === undefined) return
    const { id: queda, n } = r.repetida
    setRepetida(avisoRepetida(nombrePieza(idCom), linea.idProv === null ? null : nombreProv(linea.idProv), n))
    setPeticion((p) => ({ id: queda, marca: (p?.marca ?? 0) + 1 }))
  }
  function quitar(id: number) {
    setLineas((ls) => quitarLinea(ls ?? [], id))
    limpiarAvisos()
  }
  /** «+ Añadir línea» de un recuadro: vacía, de ese proveedor; queda seleccionada y a la vista. */
  function anadir(idProv: number) {
    const id = siguienteId(todas)
    setLineas((ls) => [...(ls ?? []), { ...lineaCompraVacia(id), idProv }])
    limpiarAvisos()
    setSeleccionada(id)
    setDesplazarA(id)
  }
  function anadirPrevision(idProv: number) {
    const r = aplicarPrevision(todas, activos, idProv)
    setLineas(r.lineas)
    limpiarAvisos()
    setSinPedido(r.sinPedido)
    setSinListaVistas(sinLista(activos))
  }
  function pasar(id: number, idProv: number) {
    const linea = todas.find((l) => l.id === id)
    const r = pasarA(todas, id, idProv)
    setLineas(r.lineas)
    // Como los de «+ Otro proveedor»: el recuadro se queda hasta que se pulse su ×.
    setAnadidos((a) => (a.includes(idProv) ? a : [...a, idProv]))
    limpiarAvisos()
    setPlegados((p) => sinClave(p, idProv))
    if (r.repetida && linea !== undefined && linea.idCom !== null) setRepetida(avisoYaEstaba(nombrePieza(linea.idCom), nombreProv(idProv)))
  }
  /** «¿A qué proveedor pides?» y «+ Otro proveedor»: su recuadro, desplegado y a la vista. */
  function anadirProveedor(idProv: number) {
    setAnadidos((a) => (a.includes(idProv) ? a : [...a, idProv]))
    setPlegados((p) => sinClave(p, idProv))
    limpiarAvisos()
    setALaVista(idProv)
  }
  function quitarRecuadro(idProv: number) {
    setLineas((ls) => (ls ?? []).filter((l) => l.idProv !== idProv))
    setAnadidos((a) => a.filter((x) => x !== idProv))
    setQuitando(null)
    limpiarAvisos()
  }
  function pedirQuitar(idProv: number) {
    setALaVista(null)
    if (lineasDe(todas, idProv).length > 0) setQuitando(idProv)
    else quitarRecuadro(idProv)
  }
  function plegar(clave: ClaveRecuadro) {
    setALaVista(null)
    setPlegados((p) => (p.has(clave) ? sinClave(p, clave) : new Set([...p, clave])))
  }

  async function confirmar() {
    if (lineas === null) return
    const fallo = validarPedido(lineas, recuadros, nombreProv)
    if (fallo !== null) {
      setError(fallo.error)
      setMarcado(fallo.recuadro)
      const clave = fallo.recuadro
      if (clave !== null) {
        setPlegados((p) => sinClave(p, clave))
        setALaVista(clave)
      }
      return
    }
    const origen = precarga.modo === 'solicitudes' ? { urgentes: precarga.urgentes, preventivas: precarga.preventivas } : null
    // Sin la lista de pedidos no se sabe qué bloques hay abiertos: null y que el servidor aplique su regla por defecto.
    const destinos = fijo ? [{ idProv: fijo.idProv, idBloque: fijo.idBloque }] : compras.isSuccess ? destinosDelCuerpo(lineas, bloques, elegidos) : null
    const cuerpo = cuerpoLoteCompras(lineas, origen, activos, destinos)
    setError(null)
    try {
      await guardar.mutateAsync({ cuerpo, clave: claves.para(OPERACION, cuerpo) })
      claves.hecha(OPERACION)
      onCerrar()
    } catch (e) {
      // Un 409 de destino (el bloque ya no existe): los recuadros tienen que ofrecer los bloques de ahora.
      if (e instanceof StaleDataError) void compras.refetch()
      setError(mensajeErrorGuardado(e))
    }
  }

  const bloqueado = guardar.isPending || lineas === null
  const info = [avisoOmitidas(omitidas), avisoSinPedido(sinPedido), avisoSinLista(sinListaVistas), nadaQuePedir ? avisoNadaQuePedir(nombreFijo) : null, repetida].filter((t) => t !== null).join(' ') || null
  const primera = {
    cabecera: 'Componente',
    ancho: 175,
    celda: (l: LineaCompra, n: number) => (
      // Fila seleccionada: el campo navy lleva el borde rgba(255,255,255,0.35) del JavaFX (FC :459-473).
      <div className="rounded-full group-data-[state=selected]:ring-1 group-data-[state=selected]:ring-white/35">
        <CampoAutocompletar valor={l.idCom === null ? null : String(l.idCom)} opciones={opciones} onElegir={(c) => elegir(l.id, Number(c))} placeholder="Escribe componente..." aria-label={`Componente línea ${n}`} />
      </div>
    ),
  }
  /** Tabla de un recuadro; en «Por repartir», con «Pasar a…» en la columna Proveedor. */
  function tabla(suyas: LineaCompra[], conPasarA: boolean) {
    return (
      <TablaLineas<LineaCompra>
        primera={primera}
        proveedor={conPasarA ? (l, n) => (
          <ComboNavy valor={null} opciones={opcionesPasarA(l.idCom, activos, proveedoresActivos)} onChange={(v) => pasar(l.id, Number(v))}
            textoVacio="Pasar a…" ancho={140} visibles={8} aria-label={`Pasar a línea ${n}`} />
        ) : null}
        lineas={suyas}
        proveedores={proveedoresActivos}
        vacio="Añade líneas o «Añadir previsión»."
        seleccionada={seleccionada}
        desplazarA={desplazarA}
        onSeleccionar={seleccionar}
        onCambiar={cambiar}
        onQuitar={quitar}
      />
    )
  }
  function destinoDe(idProv: number) {
    if (fijo) return <DestinoRecuadro nombre={nombreFijo} fijado={fijo.idBloque} />
    return (
      <DestinoRecuadro nombre={nombreProv(idProv)} opciones={opcionesDestino(bloques, idProv)} valor={destinoElegido(bloques, idProv, elegidos)} cargando={compras.isPending}
        onElegir={(idBloque) => {
          // Cambiar el destino es tocar el pedido: quita el error y la marca.
          setElegidos((e) => ({ ...e, [idProv]: idBloque }))
          setError(null)
          setMarcado(null)
          setALaVista(null)
        }} />
    )
  }
  const vacio = lineas !== null && !fijo && recuadros.length === 0 && porRepartir.length === 0

  return (
    <DialogoPedidoBase titulo={fijo ? `Añadir líneas · Bloque ${fijo.idBloque}` : 'Nuevo pedido'} nLineas={todas.length} info={info} error={error}
      bloqueado={bloqueado} enviando={guardar.isPending} textoConfirmar={textoConfirmar(nBloques)} onConfirmar={() => void confirmar()} onCerrar={onCerrar}>
      {fijo && (
        <p className="text-[12px] text-azul-gris">
          {nombreFijo}{bloqueFijo ? ` · ${situacion(bloqueFijo)}` : ''} · las líneas nuevas entran como pendientes y el bloque mostrará «Confirmar bloque (n)».
        </p>
      )}
      {/* Alto máximo con scroll propio (C24, 520 px desde los recuadros): con muchas líneas la caja desplaza y "Cancelar"/
          "Confirmar pedido" quedan siempre a la vista. Los popups (autocompletar, combos) van en un portal. */}
      <div className="flex max-h-[520px] min-h-[300px] flex-col gap-2.5 overflow-y-auto">
        {vacio ? (
          <div className="flex flex-col items-center gap-2.5 rounded-[10px] bg-superficie px-4 py-9 text-center">
            <p className="text-[13px] font-bold text-azul-medio">¿A qué proveedor pides?</p>
            <ComboNavy valor={null} opciones={opcionesOtro} onChange={(v) => anadirProveedor(Number(v))} textoVacio="Elige el proveedor…" ancho={280} visibles={8} aria-label="Proveedor" />
            <p className="text-[12px] text-azul-gris">Luego puedes pedir a otros con «+ Otro proveedor»: cada uno va en su bloque.</p>
          </div>
        ) : (
          <>
            {porRepartir.length > 0 && (
              <RecuadroRepartir nLineas={porRepartir.length} plegado={plegados.has(POR_REPARTIR)} onPlegar={() => plegar(POR_REPARTIR)}
                marcado={marcado === POR_REPARTIR} aLaVista={aLaVista === POR_REPARTIR}>
                {tabla(porRepartir, true)}
              </RecuadroRepartir>
            )}
            {recuadros.map((idProv) => {
              const suyas = lineasDe(todas, idProv)
              return (
                <RecuadroProveedor key={idProv} nombre={nombreProv(idProv)} divisa={proveedoresActivos.find((p) => p.idProv === idProv)?.divisa ?? 'EUR'}
                  nLineas={suyas.length} destino={destinoDe(idProv)} nPrevision={cuantasPrevision(activos, idProv, todas)}
                  previsionDeshabilitada={bloqueado || componentes.isFetching} onPrevision={() => anadirPrevision(idProv)}
                  onQuitar={fijo ? undefined : () => pedirQuitar(idProv)} bloqueado={bloqueado} onAnadir={() => anadir(idProv)}
                  avisos={tambienVa(todas, idProv, nombrePieza, nombreProv)} plegado={plegados.has(idProv)} onPlegar={() => plegar(idProv)}
                  marcado={marcado === idProv} aLaVista={aLaVista === idProv}>
                  {tabla(suyas, false)}
                </RecuadroProveedor>
              )
            })}
            {opcionesOtro.length > 0 && lineas !== null && (
              <div>
                <ComboNavy valor={null} opciones={opcionesOtro} onChange={(v) => anadirProveedor(Number(v))} textoVacio="+ Otro proveedor" ancho={260} visibles={8} aria-label="Otro proveedor" />
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog abierto={quitando !== null} titulo="Quitar proveedor"
        descripcion={quitando === null ? '' : textoQuitarRecuadro(nombreProv(quitando), lineasDe(todas, quitando).length)}
        textoAccion="Quitar" onConfirmar={() => { if (quitando !== null) quitarRecuadro(quitando) }} onCancelar={() => setQuitando(null)} />
    </DialogoPedidoBase>
  )
}
