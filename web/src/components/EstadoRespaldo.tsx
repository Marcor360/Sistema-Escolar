import { api } from '../api/client';
import { useDatos } from '../hooks/useDatos';
export function EstadoRespaldo() {
  const { datos, error, recargar } = useDatos<{ estado: string; vencido: boolean; ultimoExito: string | null }>(
    () => api.get('/seguimiento/respaldo').then((r) => r.data),
    { estado: 'CONSULTANDO', vencido: false, ultimoExito: null },
  );
  return (
    <section className="panel">
      <h2>Recuperación operativa</h2>
      {error && <p role="alert">{error}</p>}
      <p role={datos.vencido || datos.estado === 'ERROR' ? 'alert' : 'status'}>
        Respaldo: {datos.estado}
        {datos.vencido ? ' · Falta un respaldo exitoso de las últimas 36 horas' : ''}
      </p>
      <p>Último éxito: {datos.ultimoExito ? new Date(datos.ultimoExito).toLocaleString('es-MX') : 'Sin evidencia'}</p>
      <p>
        Un respaldo completado requiere ensayo de restauración y validación de archivos antes de acreditar recuperación.
      </p>
      <button onClick={recargar}>Actualizar estado</button>
    </section>
  );
}
