/** Calco del ImageView borrar.png (25 px, cursor de mano) de las papeleras del supertécnico. */
export function BotonPapelera({ onClick, etiqueta = 'Borrar asignación' }: { onClick: () => void; etiqueta?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={etiqueta} className="cursor-pointer">
      <img src="/borrar.png" alt="" className="h-[25px] w-[25px]" />
    </button>
  )
}
