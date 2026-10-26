import { inflateRawSync } from 'node:zlib'

// xlsx.ts (0.9.22): lector mínimo de xlsx para las E2E, sin librerías. Un xlsx es un zip: se lee su directorio central, se
// descomprime lo que hace falta (cadenas compartidas, estilos y la primera hoja) y con expresiones regulares (el XML que escribe
// POI es regular) se sacan el valor y el relleno de cada celda.

/** Una celda: su valor (cadena, número o null si está vacía) y el rgb de su relleno (p. ej. 'FDE8E8', sin el alfa) o null. */
export type Celda = { valor: string | number | null; relleno: string | null }

export type Xlsx = {
  celda(ref: string): Celda
  /** Los números de fila (empiezan en 1) desde `desde` con alguna celda con valor; con `columna` ('A'), solo cuenta esa columna
   *  (la plantilla de NSYS lleva notas sueltas más a la derecha, en AN-AO). */
  filasConDatos(desde: number, columna?: string): number[]
}

/** Las entradas del zip por nombre, ya descomprimidas (método 0 guardado, 8 deflate). */
function leerZip(zip: Buffer): Map<string, Buffer> {
  // El final del directorio central (firma 0x06054b50) está en los últimos bytes, tras un comentario opcional.
  let fin = -1
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { fin = i; break }
  }
  if (fin < 0) throw new Error('no es un zip: falta el final del directorio central')
  const total = zip.readUInt16LE(fin + 10)
  let pos = zip.readUInt32LE(fin + 16)
  const entradas = new Map<string, Buffer>()
  for (let n = 0; n < total; n++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) throw new Error('directorio central del zip corrupto')
    const metodo = zip.readUInt16LE(pos + 10)
    const comprimido = zip.readUInt32LE(pos + 20)
    const largoNombre = zip.readUInt16LE(pos + 28)
    const largoExtra = zip.readUInt16LE(pos + 30)
    const largoComentario = zip.readUInt16LE(pos + 32)
    const local = zip.readUInt32LE(pos + 42)
    const nombre = zip.toString('utf8', pos + 46, pos + 46 + largoNombre)
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error(`cabecera local corrupta en ${nombre}`)
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const datos = zip.subarray(inicio, inicio + comprimido)
    if (metodo === 0) entradas.set(nombre, datos)
    else if (metodo === 8) entradas.set(nombre, inflateRawSync(datos))
    else throw new Error(`método de compresión ${metodo} no soportado (${nombre})`)
    pos += 46 + largoNombre + largoExtra + largoComentario
  }
  return entradas
}

const decodificar = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')

/** Concatena los `<t>` de un trozo (una cadena puede ir partida en `<r>`). */
const textos = (xml: string): string => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1])).join('')

const atributo = (atributos: string, nombre: string): string | null =>
  new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`).exec(atributos)?.[1] ?? null

const texto = (entradas: Map<string, Buffer>, nombre: string): string => entradas.get(nombre)?.toString('utf8') ?? ''

/** La ruta de la primera hoja según workbook.xml y sus relaciones; sheet1.xml si no se encuentra. */
function rutaPrimeraHoja(entradas: Map<string, Buffer>): string {
  const libro = texto(entradas, 'xl/workbook.xml')
  const id = /<sheet\b[^>]*\br:id="([^"]*)"/.exec(libro)?.[1]
  if (id) {
    for (const rel of texto(entradas, 'xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
      if (atributo(rel[1], 'Id') === id) {
        const destino = atributo(rel[1], 'Target')
        if (destino) return destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`
      }
    }
  }
  return 'xl/worksheets/sheet1.xml'
}

export function leerXlsx(contenido: Buffer): Xlsx {
  const entradas = leerZip(contenido)

  const compartidas = [...texto(entradas, 'xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]))

  // Relleno por estilo: cellXfs/xf[s]@fillId -> fills/fill[fillId]/patternFill/fgColor@rgb.
  const estilos = texto(entradas, 'xl/styles.xml')
  const bloqueRellenos = /<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(estilos)?.[1] ?? ''
  const rellenos = [...bloqueRellenos.matchAll(/<fill\b[^>]*>([\s\S]*?)<\/fill>/g)].map((m) => {
    const rgb = /<fgColor\b([^>]*)\/?>/.exec(m[1])
    const valor = rgb ? atributo(rgb[1], 'rgb') : null
    return valor ? (valor.length === 8 ? valor.slice(2) : valor).toUpperCase() : null
  })
  const bloqueXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(estilos)?.[1] ?? ''
  const rellenoDeEstilo = [...bloqueXfs.matchAll(/<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => {
    const id = atributo(m[1], 'fillId')
    return id === null ? null : (rellenos[Number(id)] ?? null)
  })

  const hoja = texto(entradas, rutaPrimeraHoja(entradas))
  const celdas = new Map<string, Celda>()
  for (const m of hoja.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = atributo(m[1], 'r')
    if (!ref) continue
    const tipo = atributo(m[1], 't')
    const estilo = atributo(m[1], 's')
    const cuerpo = m[2] ?? ''
    const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1]
    let valor: string | number | null = null
    if (tipo === 'inlineStr') valor = textos(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(cuerpo)?.[1] ?? '')
    else if (v !== undefined) {
      if (tipo === 's') valor = compartidas[Number(v)] ?? null
      else if (tipo === 'str' || tipo === 'b' || tipo === 'e') valor = decodificar(v)
      else valor = Number(v)
    }
    celdas.set(ref, { valor, relleno: estilo === null ? null : (rellenoDeEstilo[Number(estilo)] ?? null) })
  }

  return {
    celda: (ref) => celdas.get(ref.toUpperCase()) ?? { valor: null, relleno: null },
    filasConDatos(desde, columna) {
      const filas = new Set<number>()
      for (const [ref, c] of celdas) {
        if (columna && ref.replace(/\d+$/, '') !== columna.toUpperCase()) continue
        const fila = Number(/\d+$/.exec(ref)?.[0])
        if (fila >= desde && c.valor !== null && c.valor !== '') filas.add(fila)
      }
      return [...filas].sort((a, b) => a - b)
    },
  }
}
