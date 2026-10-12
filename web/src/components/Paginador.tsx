interface Props {
  deshabilitado?: boolean;
  total: number;
  pagina: number;
  porPagina: number;
  onCambio: (pagina: number) => void;
}

/** Navegación paginada con rango de resultados accesible. */
export function Paginador({ total, pagina, porPagina, onCambio, deshabilitado = false }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const fin = Math.min(total, pagina * porPagina);
  return (
    <nav className="paginador" aria-label="Paginación del listado">
      <p role="status" aria-live="polite">
        {total === 0 ? 'Sin registros' : `Mostrando ${inicio}–${fin} de ${total} registros`}
      </p>
      <div className="paginador-acciones">
        <button type="button" className="boton secundario" aria-label="Ir a la página anterior"
          disabled={deshabilitado || pagina <= 1} onClick={() => onCambio(pagina - 1)}>Anterior</button>
        <span aria-label={`Página ${pagina} de ${totalPaginas}`}>Página {pagina} de {totalPaginas}</span>
        <button type="button" className="boton secundario" aria-label="Ir a la página siguiente"
          disabled={deshabilitado || pagina >= totalPaginas} onClick={() => onCambio(pagina + 1)}>Siguiente</button>
      </div>
    </nav>
  );
}
