import type { ColumnDef } from '@tanstack/react-table'
import { onTestFinished, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- listas mixtas de columnas, como en DataTable
type Columna = ColumnDef<any, any>

const idDe = (c: Columna) => c.id ?? ('accessorKey' in c ? String(c.accessorKey) : '')

/** Reparto de las columnas en el ajuste 'fluido' de DataTable: fijas las que declaran `maxSize === size`, y las que
 *  absorben el ancho sobrante las que no declaran `maxSize`. `otras` recoge cualquier columna con un tope distinto de su
 *  `size` (ninguna tabla lo usa hoy). Los ids salen de `id` o, si no lo hay, de `accessorKey`. */
export function repartoFluido(columnas: Columna[]) {
  return {
    fijas: columnas.filter((c) => c.maxSize !== undefined && c.maxSize === c.size).map(idDe),
    absorben: columnas.filter((c) => c.maxSize === undefined).map(idDe),
    otras: columnas.filter((c) => c.maxSize !== undefined && c.maxSize !== c.size).map(idDe),
  }
}

/** jsdom no maqueta: hace que el contenedor de scroll de cada DataTable (el que lleva `contain-inline-size`) mida `ancho`
 *  px en cuanto se observa, para ver el reparto del ajuste 'fluido' en px. Los demás ResizeObserver (Radix) no reciben
 *  nada. Se deshace solo al terminar el test. */
export function simularAnchoDeTabla(ancho: number) {
  class ResizeObserverConAncho {
    private readonly cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe(el: Element) {
      if (el.classList.contains('contain-inline-size')) {
        this.cb([{ target: el, contentRect: { width: ancho } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverConAncho)
  onTestFinished(() => {
    vi.unstubAllGlobals()
  })
}

/** Ancho en px de cada `<col>` de la tabla (en el orden de las columnas). */
export function anchosDeColumnas(contenedor: ParentNode): number[] {
  return Array.from(contenedor.querySelectorAll('col')).map((c) => parseFloat((c as HTMLElement).style.width))
}
