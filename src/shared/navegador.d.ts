// APIs del navegador que la web usa y que `lib.dom` de TypeScript no trae en todas las versiones: solo lo imprescindible.

/** Opciones de `window.showSaveFilePicker` (File System Access; Chrome y Edge). */
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}

interface Window {
  /** Ventana "Guardar como" del sistema; no existe en todos los navegadores. */
  showSaveFilePicker?: (opciones?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}
