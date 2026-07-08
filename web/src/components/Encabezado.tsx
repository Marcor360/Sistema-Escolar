/** Encabezado de página con el doble filete institucional. */
export function Encabezado({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <header className="encabezado">
      <h1>{titulo}</h1>
      <p className="detalle">{detalle}</p>
    </header>
  );
}
