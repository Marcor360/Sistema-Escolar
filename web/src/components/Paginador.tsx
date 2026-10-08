interface Props {
  deshabilitado?: boolean;
  total: number;
  pagina: number;
  porPagina: number;
  onCambio: (pagina: number) => void;
}

/** Paginador uniforme para listados con el contrato { datos, total, pagina, porPagina }. */
export function Paginador({ total, pagina, porPagina, onCambio, deshabilitado = false }: Props) {
  return (
    <div className="fila" style={{ marginTop: 14 }}>
      <button type="button" className="boton secundario" disabled={deshabilitado || pagina <= 1} onClick={() => onCambio(pagina - 1)}>Anterior</button>
      <span>{total} registros · página {pagina}</span>
      <button type="button" className="boton secundario" disabled={deshabilitado || pagina * porPagina >= total} onClick={() => onCambio(pagina + 1)}>Siguiente</button>
    </div>
  );
}
