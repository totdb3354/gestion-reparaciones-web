/** Compone un UUID v4 a partir de 16 bytes aleatorios (RFC 4122 §4.4): fuerza la versión (4) y la variante (10xx). */
function desdeBytesAleatorios(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** Identificador único para una operación (UUID v4). Usa `crypto.randomUUID` cuando existe; si no, lo compone con
 *  `crypto.getRandomValues`. Nunca `Math.random` (no es criptográficamente aleatorio). */
export function claveUnica(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return desdeBytesAleatorios(crypto.getRandomValues(new Uint8Array(16)))
}
