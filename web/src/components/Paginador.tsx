interface Props {
  total: number;
  pagina: number;
  porPagina: number;
  onCambio: (pagina: number) => void;
}

/** Paginador uniforme para listados con el contrato { datos, total, pagina, porPagina }. */
export function Paginador({ total, pagina, porPagina, onCambio }: Props) {
  return (
    <div className="fila" style={{ marginTop: 14 }}>
      <button className="boton secundario" disabled={pagina <= 1} onClick={() => onCambio(pagina - 1)}>Anterior</button>
      <span>{total} registros · página {pagina}</span>
      <button className="boton secundario" disabled={pagina * porPagina >= total} onClick={() => onCambio(pagina + 1)}>Siguiente</button>
    </div>
  );
}
