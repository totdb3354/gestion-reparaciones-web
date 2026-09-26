import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { LogActividad } from '@/shared/api/client'
import { esErrorGestionadoGlobalmente, mensajeDeError } from '@/shared/api/errors'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { CampoAutocompletar } from '@/shared/ui/CampoAutocompletar'
import { DataTable } from '@/shared/ui/DataTable'
import { Input } from '@/shared/ui/input'
import { RangoFechas } from '@/shared/ui/RangoFechas'
import { useUsuariosTecnicos } from '../api'
import { rutaVolverA } from '../navegacion'
import { useAccionesLog, useLogs } from './api'
import { COLUMNAS_LOGS, textoDetalle } from './columnas'
import { aplicarBuscador, FILTROS_LOGS_VACIOS, LIMITE_LOGS, MSG_TOPE, queryLogs, TEXTO_VACIO_LOGS, type FiltrosLogs } from './filtros'

const PREFIJO_ERROR = 'Error al cargar los logs: '
/** El popup de "Acción..."/"Técnico..." del JavaFX mide ≈250 px frente a los 150 del campo (comparación de capturas). */
const ANCHO_LISTA = 250

/** "Ver logs" (LogView.fxml + LogController de `hotfix/0.16.3`), como página del shell (G2). Solo lectura. */
export function LogsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mostrarError, mostrarTexto } = useAlerta()
  // Estado local: los filtros no sobreviven a salir de la página (calco: la ventana del JavaFX se abre siempre vacía).
  const [filtros, setFiltros] = useState<FiltrosLogs>(FILTROS_LOGS_VACIOS)
  // CampoAutocompletar no vuelve a '' solo porque `valor` pase a null: "Limpiar filtros" remonta los dos campos.
  const [limpiezas, setLimpiezas] = useState(0)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)

  const q = useMemo(() => queryLogs(filtros), [filtros])
  const { data, error, errorUpdatedAt, isFetching, refetch } = useLogs(q)
  const { data: acciones } = useAccionesLog()
  const { data: usuarios } = useUsuariosTecnicos()

  // La tabla conserva lo último que llegó bien (LogController :223-225: un fallo no toca `logsMaster`). Con otra clave
  // (cambio de filtro) `data` pasa a undefined mientras carga o si falla; aquí se ignora ese undefined. Patrón de
  // "ajustar el estado durante el render" en vez de un efecto.
  const [filas, setFilas] = useState<LogActividad[]>([])
  const [datosVistos, setDatosVistos] = useState<LogActividad[] | undefined>(undefined)
  if (data !== datosVistos) {
    setDatosVistos(data)
    if (data !== undefined) setFilas(data)
  }

  // Un aviso por fallo de carga (inicial, "Actualizar" o cambio de filtro), salvo 401 y conexión: esos los lleva la
  // política global (flujo de sesión caducada y banner), que ya se disparó en el cliente HTTP. `isFetching` evita repetir
  // el error que una clave ya fallida trae de la caché mientras se vuelve a pedir.
  useEffect(() => {
    if (!error || isFetching || esErrorGestionadoGlobalmente(error)) return
    mostrarError(PREFIJO_ERROR + mensajeDeError(error))
  }, [error, errorUpdatedAt, isFetching, mostrarError])

  const opcionesAccion = useMemo(() => (acciones ?? []).map((a) => ({ clave: a, etiqueta: a })), [acciones])
  // Calco de `sorted()` sobre `nombreUsuario` (:203-208): orden natural de String (por unidades UTF-16, sin locale), que
  // es exactamente el de `Array.prototype.sort()` sin comparador. Activos e inactivos; sin ADMIN (lo excluye el endpoint).
  const opcionesUsuario = useMemo(
    () => (usuarios ?? []).map((u) => u.nombreUsuario).sort().map((n) => ({ clave: n, etiqueta: n })),
    [usuarios],
  )
  const visibles = useMemo(() => aplicarBuscador(filas, filtros.texto), [filas, filtros.texto])

  const limpiar = () => {
    // Un solo cambio de estado = una sola clave nueva = una sola recarga (el JavaFX lanzaba hasta cinco).
    setFiltros(FILTROS_LOGS_VACIOS)
    setLimpiezas((n) => n + 1)
  }

  return (
    <div className="flex min-h-full flex-col bg-fondo-gestion">
      <header className="flex flex-col gap-4 px-12 pt-7 pb-5">
        <div className="flex items-center gap-3.5">
          <img src="/logo_inicio_sesion.png" alt="" className="h-[46px] w-[46px] object-contain" />
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold text-azul-medio">Log de actividad</h1>
            <p className="text-[12px] text-azul-gris">Registro de acciones realizadas en el sistema</p>
          </div>
        </div>
        <hr className="border-borde-input" />
      </header>

      <section className="flex flex-1 flex-col gap-2.5 px-12 pt-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            aria-label="Buscar"
            value={filtros.texto}
            onChange={(e) => setFiltros((f) => ({ ...f, texto: e.target.value }))}
            placeholder="Buscar..."
            className="w-[220px] bg-superficie"
          />
          <div className="w-[150px]">
            <CampoAutocompletar
              key={`accion-${limpiezas}`}
              valor={filtros.accion}
              opciones={opcionesAccion}
              onElegir={(accion) => setFiltros((f) => ({ ...f, accion }))}
              // Calco de :139-143: solo vaciar el texto quita la acción elegida.
              onTextoCambiado={(t) => { if (t.trim() === '') setFiltros((f) => (f.accion === null ? f : { ...f, accion: null })) }}
              placeholder="Acción..."
              aria-label="Acción"
              abrirAlEnfocar
              anchoLista={ANCHO_LISTA}
            />
          </div>
          <div className="w-[150px]">
            <CampoAutocompletar
              key={`usuario-${limpiezas}`}
              valor={filtros.usuario}
              opciones={opcionesUsuario}
              onElegir={(usuario) => setFiltros((f) => ({ ...f, usuario }))}
              onTextoCambiado={(t) => { if (t.trim() === '') setFiltros((f) => (f.usuario === null ? f : { ...f, usuario: null })) }}
              placeholder="Técnico..."
              aria-label="Técnico"
              abrirAlEnfocar
              anchoLista={ANCHO_LISTA}
            />
          </div>
          <RangoFechas desde={filtros.desde} hasta={filtros.hasta} onChange={(desde, hasta) => setFiltros((f) => ({ ...f, desde, hasta }))} />
          <BotonSecundario onClick={limpiar}>Limpiar filtros</BotonSecundario>
        </div>
        {filas.length === LIMITE_LOGS && <p className="text-[12px] text-azul-gris">{MSG_TOPE}</p>}
        <DataTable
          columns={COLUMNAS_LOGS}
          data={visibles}
          vacio={TEXTO_VACIO_LOGS}
          ajuste="estirar"
          ordenacion={false}
          getRowId={(l) => String(l.idLog)}
          seleccionada={seleccionada}
          onSeleccionar={setSeleccionada}
          onAbrir={(l) => mostrarTexto('Detalle del log', textoDetalle(l))}
        />
      </section>

      <footer className="flex items-center justify-end gap-3 px-12 pt-3 pb-5">
        <BotonPrimario onClick={() => void refetch()}>Actualizar</BotonPrimario>
        <button type="button" onClick={() => navigate(rutaVolverA(location.state))} className="cursor-pointer bg-transparent text-[12px] text-azul-gris">
          Cerrar
        </button>
      </footer>
    </div>
  )
}
