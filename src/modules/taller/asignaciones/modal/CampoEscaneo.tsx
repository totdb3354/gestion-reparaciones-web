import { useState } from 'react'

type Props = {
  etiqueta: string
  onImei: (imei: string) => boolean
  onPegado: (texto: string) => void
  autoFocus?: boolean
  /** Se llama en cada cambio con 15 dígitos o menos, antes de entregar: así un repetido vuelve a pintar su
   *  mensaje después de limpiarlo (el mensaje bajo el campo se borra en cuanto se teclea, calco del JavaFX). */
  onTeclear?: () => void
}

/** Campo de escaneo del modal: solo dígitos; a los 15 se entrega solo (el lector de códigos es un teclado); más de 15
 *  es un pegado. Un IMEI incompleto + Enter no hace nada y se queda en el campo (calco del código, D6). */
export function CampoEscaneo({ etiqueta, onImei, onPegado, autoFocus, onTeclear }: Props) {
  const [texto, setTexto] = useState('')
  const entregar = (digitos: string) => {
    if (digitos.length > 15) { onPegado(digitos); setTexto(''); return }
    onTeclear?.()
    if (digitos.length === 15) { setTexto(onImei(digitos) ? '' : digitos); return }
    setTexto(digitos)
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-bold text-azul-gris">{etiqueta}</span>
      <input
        value={texto}
        autoFocus={autoFocus}
        placeholder="Escanea o escribe el IMEI (15 dígitos)..."
        onChange={(ev) => entregar(ev.target.value.replace(/\D/g, ''))}
        onKeyDown={(ev) => { if (ev.key === 'Enter' && texto.length === 15) entregar(texto) }}
        className="rounded border border-borde-input bg-white p-[11px] text-[14px] text-azul-medio"
      />
    </label>
  )
}
