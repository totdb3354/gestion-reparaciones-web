import { useCallback, useId, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Usuario } from '@/shared/api/client'
import { useAlerta } from '@/shared/ui/AlertaProvider'
import { Button } from '@/shared/ui/button'
import { ComboNavy, type OpcionCombo } from '@/shared/ui/ComboNavy'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { DataTable } from '@/shared/ui/DataTable'
import { Input } from '@/shared/ui/input'
import { useUsuariosTecnicos } from '../api'
import { rutaVolverA } from '../navegacion'
import { consultarTieneReparaciones, useCambiarActivo, useEliminar, useRegistrar } from './api'
import { columnasTecnicos } from './columnas'
import { mensajeInline } from './errores'
import {
  MSG_ERROR_CARGA, MSG_ERROR_COMPROBAR, MSG_ERROR_ELIMINAR, MSG_ERROR_ESTADO, MSG_ERROR_REGISTRO, TEXTO_VACIO_TABLA, TITULO_ELIMINAR,
  TITULO_NO_ELIMINAR, textoEliminar, textoNoEliminar,
} from './textos'
import { cuerpoAlta, duplicadosEnVivo, rolDe, ROLES, validarAlta, type DatosAlta } from './validacion'

const FORMULARIO_VACIO: DatosAlta = { nombreTecnico: '', nombreUsuario: '', password: '', confirmar: '', rol: 'TECNICO' }
const OPCIONES_ROL: OpcionCombo[] = ROLES.map((r) => ({ valor: r, etiqueta: r }))
const SIN_USUARIOS: Usuario[] = []

type CampoTexto = 'nombreTecnico' | 'nombreUsuario' | 'password' | 'confirmar'
/** Fila de campos de RegisterView.fxml :32-77 (etiqueta, prompt y tipo). Las contraseñas no llevan ojo (PasswordField). */
const CAMPOS: { clave: CampoTexto; etiqueta: string; placeholder: string; tipo: 'text' | 'password'; autoComplete: string }[] = [
  { clave: 'nombreTecnico', etiqueta: 'Nombre del técnico', placeholder: 'Nombre visible en reparaciones', tipo: 'text', autoComplete: 'off' },
  { clave: 'nombreUsuario', etiqueta: 'Nombre de usuario', placeholder: 'Credencial de login', tipo: 'text', autoComplete: 'off' },
  { clave: 'password', etiqueta: 'Contraseña', placeholder: 'Contraseña', tipo: 'password', autoComplete: 'new-password' },
  { clave: 'confirmar', etiqueta: 'Confirmar', placeholder: 'Repite la contraseña', tipo: 'password', autoComplete: 'new-password' },
]
/** Estilo inline común de los cuatro campos: blanco, borde #D4D8DE, radio 8, padding 10 12, 13 px, texto #2C3B54,
 *  prompt #A0A8B4. El `md:text-[13px]` pisa el `md:text-sm` del Input de shadcn. */
const CLASE_CAMPO = 'h-auto rounded-lg border-borde-input bg-superficie px-3 py-2.5 text-[13px] md:text-[13px] text-azul-medio placeholder:text-texto-suave'

/** "Gestionar técnicos" (spec 6, §6.1): calco de RegisterView.fxml y RegisterController de hotfix/0.16.3 como página del
 *  shell (G2). La línea de error inline recoge la validación del alta y los fallos de carga, candado y borrado; se vacía al
 *  empezar cada acción y enseña el message del servidor en 404/409/422 (G9). Sin sondeo, sin CSV, sin ordenación. */
export function TecnicosPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mostrarAviso } = useAlerta()
  const idBase = useId()
  const { data: usuarios = SIN_USUARIOS, isError, errorUpdatedAt } = useUsuariosTecnicos()
  const registrar = useRegistrar()
  const { mutate: mutarActivo } = useCambiarActivo()
  const { mutate: mutarEliminar } = useEliminar()
  const [form, setForm] = useState<DatosAlta>(FORMULARIO_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [errorCargaVisto, setErrorCargaVisto] = useState(0)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null)

  // Cada fallo de carga (el inicial o la recarga tras una escritura) trae un errorUpdatedAt nuevo: se pinta
  // "Error al cargar los usuarios." en la línea aunque una acción la hubiera vaciado. Patrón "ajustar estado al cambiar
  // una prop" durante el render (como useErrorServidor), sin useEffect + setState.
  if (isError && errorUpdatedAt !== errorCargaVisto) {
    setErrorCargaVisto(errorUpdatedAt)
    setError(MSG_ERROR_CARGA)
  }

  const dup = duplicadosEnVivo(usuarios, form.nombreTecnico, form.nombreUsuario)
  const hayDuplicado = dup.tecnico !== null || dup.usuario !== null

  const alternarActivo = useCallback(
    (u: Usuario) => {
      setError(null)
      mutarActivo({ idTec: u.idTec, activar: !u.activo }, { onError: (e) => setError(mensajeInline(e, MSG_ERROR_ESTADO, [404])) })
    },
    [mutarActivo],
  )

  /** Papelera (RegisterController :220-248): comprueba en cada clic; con datos asociados solo informa, sin ellos confirma. */
  const pedirEliminar = useCallback(
    async (u: Usuario) => {
      setError(null)
      let tiene: boolean
      try {
        tiene = await consultarTieneReparaciones(u.idTec)
      } catch (e) {
        setError(mensajeInline(e, MSG_ERROR_COMPROBAR, [404]))
        return
      }
      if (tiene) mostrarAviso(TITULO_NO_ELIMINAR, textoNoEliminar(u.nombreTecnico))
      else setAEliminar(u)
    },
    [mostrarAviso],
  )

  const columnas = useMemo(
    () => columnasTecnicos({ onToggle: alternarActivo, onEliminar: (u) => { void pedirEliminar(u) } }),
    [alternarActivo, pedirEliminar],
  )

  function cambiar(clave: CampoTexto, valor: string) {
    setForm((f) => ({ ...f, [clave]: valor }))
  }

  function onRegistrar() {
    setError(null)
    const fallo = validarAlta(form)
    if (fallo !== null) {
      setError(fallo)
      return
    }
    registrar.mutate(cuerpoAlta(form), {
      onSuccess: () => setForm(FORMULARIO_VACIO),
      onError: (e) => setError(mensajeInline(e, MSG_ERROR_REGISTRO, [409, 422])),
    })
  }

  function confirmarEliminar() {
    const u = aEliminar
    setAEliminar(null)
    if (u === null) return
    mutarEliminar({ idTec: u.idTec, idUsu: u.idUsu }, { onError: (e) => setError(mensajeInline(e, MSG_ERROR_ELIMINAR, [404, 409])) })
  }

  return (
    <div className="flex min-h-full flex-col bg-fondo-gestion">
      <div className="flex flex-col gap-4 px-12 pt-7 pb-5">
        <div className="flex items-center gap-3.5">
          <img src="/logo_inicio_sesion.png" alt="" className="h-[46px] w-[46px] object-contain" />
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold text-azul-medio">Gestión de usuarios</h1>
            <p className="text-[12px] text-azul-gris">Registra o elimina accesos al sistema</p>
          </div>
        </div>

        <div className="flex gap-3">
          {CAMPOS.map((c) => {
            const id = `${idBase}-${c.clave}`
            const aviso = c.clave === 'nombreTecnico' ? dup.tecnico : c.clave === 'nombreUsuario' ? dup.usuario : null
            return (
              <div key={c.clave} className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <label htmlFor={id} className="text-[11px] font-bold text-azul-gris">
                  {c.etiqueta}
                </label>
                <Input
                  id={id}
                  type={c.tipo}
                  autoComplete={c.autoComplete}
                  value={form[c.clave]}
                  onChange={(e) => cambiar(c.clave, e.target.value)}
                  placeholder={c.placeholder}
                  className={CLASE_CAMPO}
                />
                {aviso !== null && <p className="text-[10px] text-texto-error">{aviso}</p>}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Ocupa su hueco aunque esté vacía (lblError visible=false pero managed) y empuja el combo y el botón a la derecha. */}
          <p role="alert" className="min-h-4 min-w-0 flex-1 text-[11px] text-texto-error">
            {error ?? ''}
          </p>
          <ComboNavy
            valor={form.rol}
            opciones={OPCIONES_ROL}
            onChange={(v) => setForm((f) => ({ ...f, rol: rolDe(v) }))}
            textoVacio="TECNICO"
            ancho={130}
            aria-label="Rol"
          />
          <Button
            type="button"
            disabled={hayDuplicado || registrar.isPending}
            onClick={onRegistrar}
            className="h-auto rounded-3xl bg-azul-noche px-6 py-2.5 text-[13px] font-bold text-crema hover:bg-azul-noche-hover"
          >
            Registrar técnico
          </Button>
        </div>
        <hr className="border-borde-input" />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-12 pt-4">
        <h2 className="text-[13px] font-bold text-azul-medio">Técnicos registrados</h2>
        <DataTable
          columns={columnas}
          data={usuarios}
          vacio={TEXTO_VACIO_TABLA}
          getRowId={(u) => String(u.idTec)}
          seleccionada={seleccionada}
          onSeleccionar={setSeleccionada}
          ordenacion={false}
          altoFila={35}
          // Calco de CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN: la de acciones (candado y papelera centrados) se queda el sobrante.
          ajuste="ultima"
        />
      </div>

      <div className="flex justify-end px-12 pt-3 pb-5">
        <button type="button" onClick={() => navigate(rutaVolverA(location.state))} className="cursor-pointer text-[12px] text-azul-gris">
          Cerrar
        </button>
      </div>

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo={TITULO_ELIMINAR}
        descripcion={aEliminar !== null ? textoEliminar(aEliminar.nombreTecnico) : ''}
        textoAccion="Eliminar"
        onCancelar={() => setAEliminar(null)}
        onConfirmar={confirmarEliminar}
      />
    </div>
  )
}
