import { useCallback, useState } from 'react'

/** Clave en localStorage de la preferencia "Texto grande" (por navegador, no por usuario: cada PC del taller la suya). */
export const CLAVE_TEXTO = 'fsgr.texto'
const GRANDE = 'grande'

/** Atributo en `<html>` que activa el zoom de globals.css (`html[data-texto="grande"] { zoom: 1.15 }`). Se usa `zoom` y no
 *  `font-size` porque la app fija muchas medidas en px (`text-[13px]`, `w-[300px]`…) que un `rem` no escalaría. */
function aplicar(grande: boolean) {
  if (grande) document.documentElement.dataset.texto = GRANDE
  else delete document.documentElement.dataset.texto
}

/** Lee la preferencia guardada; un storage inaccesible (modo privado, bloqueado) cuenta como "no". */
function leerGuardado(): boolean {
  try {
    return localStorage.getItem(CLAVE_TEXTO) === GRANDE
  } catch {
    return false
  }
}

/** Al arrancar la app (main.tsx, antes del primer render): aplica lo guardado sin parpadeo. */
export function aplicarTextoGuardado(): void {
  aplicar(leerGuardado())
}

/**
 * "Texto grande" del menú de usuario (función nueva, el JavaFX no la tiene; decisión del usuario 2026-09-27, web 0.8.3).
 * Marcar pone `data-texto="grande"` en `<html>` y guarda `fsgr.texto = 'grande'`; desmarcar quita ambos. Si el storage
 * falla, el cambio se aplica igual en la sesión y solo no se recuerda.
 */
export function useTextoGrande(): [boolean, (grande: boolean) => void] {
  const [grande, setGrande] = useState(() => document.documentElement.dataset.texto === GRANDE)
  const cambiar = useCallback((valor: boolean) => {
    aplicar(valor)
    setGrande(valor)
    try {
      if (valor) localStorage.setItem(CLAVE_TEXTO, GRANDE)
      else localStorage.removeItem(CLAVE_TEXTO)
    } catch {
      // Sin storage: vale para esta sesión del navegador.
    }
  }, [])
  return [grande, cambiar]
}
