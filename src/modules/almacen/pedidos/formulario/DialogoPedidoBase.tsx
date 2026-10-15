import { useState, type ReactNode } from 'react'
import type { Blocker } from 'react-router'
import { useAvisoAlSalir } from '@/shared/lib/useAvisoAlSalir'
import { BotonPrimario, BotonSecundario } from '@/shared/ui/Botones'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
import { GuardiaAtras } from '@/shared/ui/GuardiaAtras'
import { textoDescartar } from './lineas'

type Props = {
  titulo: string
  /** Líneas del pedido. Con alguna, F5 o cerrar la pestaña avisan y Atrás pide «Descartar». */
  nLineas: number
  /** Precarga (0.9.9): el diálogo se abre con líneas que aún pueden estar cargando. Si se pasa, decide C25 en lugar de
   *  «había líneas en el primer render» (con la caché de proveedores fría, las líneas llegan después). */
  conPrecarga?: boolean
  info: string | null
  error: string | null
  bloqueado: boolean
  enviando: boolean
  /** Texto del botón de confirmar (0.9.9: «Confirmar pedido (n bloques)» con varios proveedores). */
  textoConfirmar?: string
  onConfirmar: () => void
  onCerrar: () => void
  /** A la izquierda de la fila de botones (0.9.9: «+ Otro proveedor» de «Nuevo pedido»). */
  pieIzquierda?: ReactNode
  /** Lo de en medio: las líneas (una tabla o los recuadros de proveedor) y «+ Añadir línea». */
  children: ReactNode
}

/** Armazón de «Nuevo pedido» (FormularioCompraView.fxml; desde la 0.9.15 también con los otros, que tenían su formulario
 *  aparte, FormularioOtroPedidoView.fxml): modal de
 *  880 px (700 en el JavaFX; más grande desde la 0.9.6), título de 24 px, lo de en medio, línea de información, línea de
 *  error (P6) y «Cancelar» / «Confirmar pedido». Sin atajos de teclado (el JavaFX no tenía). */
export function DialogoPedidoBase({ titulo, nLineas, conPrecarga, info, error, bloqueado, enviando, textoConfirmar = 'Confirmar pedido', onConfirmar, onCerrar, pieIzquierda, children }: Props) {
  // C25: si el diálogo ya nace con líneas (precarga desde Stock/campana con la caché caliente), Radix enfoca Y
  // SELECCIONA el primer campo tabulable al abrirse (@radix-ui/react-focus-scope, focusFirst({ select: true })):
  // el Componente de la línea 1 queda con el texto en azul, y teclear lo pisa. El JavaFX no autoenfoca ese campo.
  // Con el diálogo vacío (alta manual u "Otros") no hay ninguna línea todavía en el primer render, así que el
  // foco automático de Radix no cae sobre un campo con texto y se deja como estaba (calco). El valor se congela
  // en el primer render: es justo el que ve el efecto de montaje de FocusScope, que solo corre una vez.
  const [huboPrecarga] = useState(() => conPrecarga ?? nLineas > 0)
  // F5, cerrar la pestaña o salir de la web con líneas en el pedido: el navegador pregunta (el pedido aún no se ha guardado).
  useAvisoAlSalir(nLineas > 0)
  // Atrás (y Adelante) del navegador con líneas en el pedido: se para la navegación y se pide confirmación "Descartar",
  // como en "Asignar trabajos". Diferencia deliberada con el JavaFX (decisión del usuario 2026-09-27, web 0.8.5): la ✕ y
  // "Cancelar" siguen cerrando sin preguntar, como su cancelar() (FormularioCompraController.java:558).
  const [bloqueo, setBloqueo] = useState<Blocker | null>(null)
  const atrasBloqueado = bloqueo?.state === 'blocked'

  return (
    <>
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !enviando) onCerrar() }}>
      <DialogContent
        aria-describedby={undefined}
        // Sin seleccionar texto en una precarga (C25): igual de accesible que el comportamiento por defecto de Radix
        // (el propio diálogo recibe el foco, sin tocar ningún campo), pero sin pisar lo precargado al teclear.
        onOpenAutoFocus={huboPrecarga ? (e) => { e.preventDefault(); (e.target as HTMLElement).focus() } : undefined}
        className="max-h-[calc(100vh-24px)] w-[880px] max-w-[min(880px,calc(100%-2rem))] gap-4 overflow-y-auto bg-fondo-vista p-7"
      >
        <DialogTitle className="text-2xl font-bold text-azul-medio">{titulo}</DialogTitle>
        {children}
        {info !== null && <p role="status" className="text-[11px] text-azul-gris">{info}</p>}
        {error !== null && <p role="alert" className="text-[11px] text-texto-error">{error}</p>}
        <div className="flex items-center gap-2.5">
          {pieIzquierda}
          <div className="ml-auto flex gap-2.5">
            <BotonSecundario type="button" disabled={enviando} onClick={onCerrar}>Cancelar</BotonSecundario>
            <BotonPrimario type="button" disabled={bloqueado} onClick={onConfirmar}>{textoConfirmar}</BotonPrimario>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {nLineas > 0 && <GuardiaAtras activa={!enviando} onBloqueo={setBloqueo} />}
    <ConfirmDialog abierto={atrasBloqueado} titulo="Descartar" descripcion={textoDescartar(nLineas)} textoAccion="Descartar"
      onConfirmar={() => {
        // Como en "Asignar trabajos": se cierra el diálogo (y con él sus líneas) antes de dejar seguir la navegación.
        onCerrar()
        if (bloqueo?.state === 'blocked') bloqueo.proceed()
      }}
      onCancelar={() => { if (bloqueo?.state === 'blocked') bloqueo.reset() }} />
    </>
  )
}
