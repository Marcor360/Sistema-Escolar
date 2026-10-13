/** Esqueleto accesible durante la carga diferida de páginas web. */
export function Cargando() {
  return (
    <section className="esqueleto-pagina" role="status" aria-live="polite" aria-label="Cargando contenido">
      <span className="solo-lector">Cargando contenido…</span>
      <div className="esqueleto-linea esqueleto-titulo" aria-hidden="true" />
      <div className="esqueleto-linea esqueleto-subtitulo" aria-hidden="true" />
      <div className="esqueleto-panel" aria-hidden="true">
        <div className="esqueleto-linea esqueleto-campo" />
        <div className="esqueleto-linea esqueleto-campo" />
        <div className="esqueleto-linea esqueleto-campo" />
      </div>
      <div className="esqueleto-panel esqueleto-tabla" aria-hidden="true">
        <div className="esqueleto-linea" />
        <div className="esqueleto-linea" />
        <div className="esqueleto-linea" />
      </div>
    </section>
  );
}
