interface AccionModulo {
  titulo: string;
  detalle: string;
  ejecutar: () => void;
}

export function PanelAccionesModulo({ titulo, acciones }: { titulo: string; acciones: AccionModulo[] }) {
  return (
    <section className="panel" aria-label={titulo}>
      <h2>{titulo}</h2>
      <p className="texto-ayuda">Selecciona la operación que deseas realizar.</p>
      <div className="rejilla-formulario">
        {acciones.map((accion) => (
          <button
            key={accion.titulo}
            type="button"
            className="boton secundario"
            onClick={accion.ejecutar}
            style={{ minHeight: 72, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
          >
            <strong>{accion.titulo}</strong>
            <span>{accion.detalle}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
