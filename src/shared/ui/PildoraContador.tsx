/** Calco de lblContador: píldora gris (#E8EAF0 / #586376, 12 px negrita, radio 12, padding 3 10). */
export function PildoraContador({ texto }: { texto: string }) {
  return <span className="inline-block rounded-xl bg-badge-neutro-bg px-2.5 py-[3px] text-[12px] font-bold text-azul-gris">{texto}</span>
}
