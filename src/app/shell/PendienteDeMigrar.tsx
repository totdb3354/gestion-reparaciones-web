export function PendienteDeMigrar({ nombre }: { nombre: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-azul-medio">{nombre}</h1>
      <p className="mt-2 text-azul-gris">Pendiente de migrar desde el cliente JavaFX.</p>
    </div>
  )
}
