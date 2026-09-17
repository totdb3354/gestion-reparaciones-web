import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from './button'

/** Calco de .btn-primary: navy, radio 24, 12 px negrita, padding 8 16. */
export function BotonPrimario({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn('h-auto rounded-3xl bg-azul-noche px-4 py-2 text-[12px] font-bold text-texto-nav-activo hover:bg-azul-noche-hover disabled:opacity-50', className)} {...props} />
}

/** Calco de .btn-secondary: crema, borde navy, radio 24, 12 px negrita, hover #E8EAF0. */
export function BotonSecundario({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button variant="outline" className={cn('h-auto rounded-3xl border-azul-noche bg-crema px-4 py-2 text-[12px] font-bold text-azul-noche shadow-none hover:bg-badge-neutro-bg hover:text-azul-noche', className)} {...props} />
}
