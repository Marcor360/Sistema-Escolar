import { RespuestaBoleta } from './RespuestaBoleta';
import { useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
interface Boleta {
  institucion: string;
  alumno: string;
  matricula: string;
  plantel: string;
  plan: string;
  periodo: string;
  ciclo: string;
  disponible: boolean;
  escala: string;
  aviso: string;
  promedioGeneral: number | null;
  filas: {
    clave: string;
    asignatura: string;
    creditos: number;
    seriacion: string;
    ciclo: string;
    promedioFinal: number | null;
    observaciones: string;
  }[];
}
export function BoletaEscolar({ alumnoId, inscripcionId }: { alumnoId: number; inscripcionId: number }) {
  const vigente = useRef(0);
  const [datos, setDatos] = useState<Boleta | null>(null),
    [error, setError] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [intento, setIntento] = useState(0);
  useEffect(() => {
    const turno = ++vigente.current;
    let activo = true;
    const controller = new AbortController();
    setDatos(null);
    setError('');
    void api
      .get<Boleta>(`/reportes/formatos/boleta/${alumnoId}`, { params: { inscripcionId }, signal: controller.signal })
      .then((r) => {
        if (activo) setDatos(r.data);
      })
      .catch((e) => {
        if (activo) setError(mensajeDeError(e));
      });
    return () => {
      activo = false;
      vigente.current = turno + 1;
      controller.abort();
    };
  }, [alumnoId, inscripcionId, intento]);
  const descargar = async (formato: 'excel' | 'pdf') => {
    const turno = vigente.current;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.get(`/reportes/formatos/boleta/${alumnoId}/${formato}`, {
        params: { inscripcionId },
        responseType: 'blob',
      });
      if (turno !== vigente.current) return;
      const url = URL.createObjectURL(data),
        a = document.createElement('a');
      a.href = url;
      a.download = `boleta-${alumnoId}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (turno === vigente.current) setError(mensajeDeError(e));
    } finally {
      if (turno === vigente.current) setOcupado(false);
    }
  };
  return (
    <section className="panel" aria-label="Boleta informativa">
      <h3>Boleta informativa de calificaciones finales</h3>
      {error && (
        <p role="alert">
          {error}
          <button className="boton secundario" type="button" onClick={() => setIntento((i) => i + 1)}>
            Reintentar boleta
          </button>
        </p>
      )}
      {!datos && !error && <p role="status">Cargando boleta…</p>}
      {datos && (
        <>
          <h4>{datos.institucion}</h4>
          <p>
            Plantel: {datos.plantel} · Plan: {datos.plan || 'Sin registro'} · Periodo: {datos.periodo || 'Sin registro'}
          </p>
          <p>
            {datos.alumno} · Matrícula: {datos.matricula} · Ciclo: {datos.ciclo}
          </p>
          <p>
            {datos.disponible ? 'Disponible para el alumno' : 'Borrador: faltan notas o cierres de evaluación'} ·
            Escala: {datos.escala}
          </p>
          <dl className="resumen-cartera-totales">
            <div>
              <dt>Promedio general</dt>
              <dd>{datos.promedioGeneral ?? 'Pendiente'}</dd>
            </div>
            <div>
              <dt>Materias del periodo</dt>
              <dd>{datos.filas.length}</dd>
            </div>
          </dl>
          <div className="tabla-contenedor" role="region" aria-label="Tabla de boleta" tabIndex={0}>
            <table className="tabla tabla-adaptable">
              <caption className="sr-only">Calificaciones finales por asignatura</caption>
              <thead>
                <tr>
                  <th scope="col">Asignatura</th>
                  <th scope="col">Calificación final</th>
                  <th scope="col">Observaciones y comentarios docentes</th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map((f, i) => (
                  <tr key={i}>
                    <td data-etiqueta="Asignatura">
                      <strong>{f.asignatura}</strong>
                      <p className="texto-ayuda">
                        {f.clave} · {f.creditos.toFixed(2)} créditos
                      </p>
                    </td>
                    <td data-etiqueta="Calificación final">
                      <strong>{f.promedioFinal ?? 'Pendiente'}</strong>
                    </td>
                    <td data-etiqueta="Observaciones">
                      <p className="boleta-comentario">{f.observaciones || 'Sin comentarios registrados'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="texto-ayuda">{datos.aviso}</p>
          <button className="boton secundario" type="button" disabled={ocupado} onClick={() => void descargar('excel')}>
            Descargar boleta Excel
          </button>
          <button className="boton secundario" type="button" disabled={ocupado} onClick={() => void descargar('pdf')}>
            Descargar boleta informativa PDF
          </button>
          {ocupado && <p role="status">Preparando archivo para descargar…</p>}
          <p className="texto-ayuda">La aceptación y los comentarios se conservan en el seguimiento de esta boleta.</p>
        </>
      )}
      {datos?.disponible && <RespuestaBoleta inscripcionId={inscripcionId} />}
    </section>
  );
}
