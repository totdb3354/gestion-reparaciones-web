import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Input } from './input'

type Props = {
  valor: string
  onChange: (v: string) => void
  placeholder: string
  'aria-label': string
  autoComplete?: string
  autoFocus?: boolean
  /** Clases del <input> (borde, radio, padding, colores de cada pantalla). */
  className?: string
  id?: string
}

/** Campo de contraseña con el botón del ojo (spec 6, G11): calco del par PasswordField/TextField del login
 *  (LoginController :70-85) y de los tres campos de CambiarPasswordView.fxml. Cada instancia guarda su propia
 *  visibilidad. `pr-11` va detrás de `className` para que un `px-*` de la pantalla no lo pise en tailwind-merge (el hueco
 *  del ojo, padding derecho 44 del FXML). */
export function CampoPassword({ valor, onChange, placeholder, 'aria-label': etiqueta, autoComplete, autoFocus, className, id }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative w-full">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={cn(className, 'pr-11')}
      />
      <button
        type="button"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
      >
        <img src={visible ? '/ojo_desactivar.png' : '/ojo_activar.png'} alt="" className="h-[18px] w-[18px]" />
      </button>
    </div>
  )
}
