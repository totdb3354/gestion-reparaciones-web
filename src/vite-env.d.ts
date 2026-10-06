declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** 'preproduccion' en la imagen de preprod (argumento de construcción del Dockerfile); sin definir en producción. */
  readonly VITE_ENTORNO?: string
}
