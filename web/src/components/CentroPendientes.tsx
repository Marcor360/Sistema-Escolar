import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useDatos } from '../hooks/useDatos';
export function CentroPendientes() {
  const { datos, error, cargando, recargar } = useDatos<{ titulo: string; cantidad: number; ruta: string }[]>(
    () => api.get('/seguimiento/pendientes').then((r) => r.data),
    [],
  );
  return (
    <section className="panel" aria-label="Centro de pendientes">
      <h2>Mis pendientes</h2>
      {cargando ? (
        <p role="status">Consultando pendientes…</p>
      ) : (
        datos.map((d) => (
          <p key={d.titulo}>
            <Link to={d.ruta}>
              {d.titulo}: {d.cantidad}
            </Link>
          </p>
        ))
      )}
      {error && <p role="alert">{error}</p>}
      <button onClick={recargar} disabled={cargando}>
        Actualizar pendientes
      </button>
    </section>
  );
}
