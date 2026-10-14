import { useEffect, useRef, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useConfirmacion } from './useConfirmacion';
interface Preview {
  previewId: string | null;
  registros: number;
  errores: { fila: number; mensaje: string }[];
  diferencias: { alumnoId: number; anterior: number | null; nueva: number }[];
  sinCambios: number;
}
function invalidar(ref: { current: number }) {
  ref.current++;
}
export function ImportarCalificaciones({
  claseId,
  parcial,
  deshabilitado,
  alConfirmar,
}: {
  claseId: string;
  parcial: string;
  deshabilitado: boolean;
  alConfirmar: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [motivo, setMotivo] = useState(''),
    [error, setError] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [mensaje, setMensaje] = useState('');
  const archivo = useRef<HTMLInputElement>(null),
    contexto = useRef(0),
    confirmacion = useConfirmacion();
  useEffect(() => {
    contexto.current++;
    setPreview(null);
    setError('');
    setMensaje('');
    setMotivo('');
    if (archivo.current) archivo.current.value = '';
    return () => {
      invalidar(contexto);
    };
  }, [claseId, parcial]);
  const plantilla = async () => {
    if (!claseId || ocupado) return;
    const actual = contexto.current;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.get(`/reportes/grupo-materias/${claseId}/plantilla-calificaciones.xlsx`, {
        params: { parcial: Number(parcial) },
        responseType: 'blob',
      });
      if (actual !== contexto.current) return;
      const url = URL.createObjectURL(data),
        a = document.createElement('a');
      a.href = url;
      a.download = `plantilla-calificaciones-${claseId}-${parcial}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (actual === contexto.current) setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  const previsualizar = async () => {
    const f = archivo.current?.files?.[0];
    if (!f || ocupado) return;
    const actual = contexto.current;
    setOcupado(true);
    setError('');
    setMensaje('');
    setPreview(null);
    try {
      const datos = new FormData();
      datos.append('archivo', f);
      datos.append('grupoMateriaId', claseId);
      datos.append('parcial', parcial);
      datos.append('motivo', motivo.trim());
      const { data } = await api.post<Preview>('/importaciones/calificaciones/preview', datos);
      if (actual === contexto.current) setPreview(data);
    } catch (err) {
      if (actual === contexto.current) setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  const confirmar = async () => {
    const actual = contexto.current;
    if (
      !preview?.previewId ||
      ocupado ||
      !(await confirmacion.solicitar(
        `¿Confirmar ${preview.diferencias.length} cambios de calificación? Se guardarán juntos y quedarán en el historial.`,
      ))
    )
      return;
    if (actual !== contexto.current) return;
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.post('/importaciones/calificaciones/confirmar', {
        previewId: preview.previewId,
        confirmado: true,
      });
      if (actual !== contexto.current) return;
      setPreview(null);
      setMensaje(`${data.capturadas} notas importadas; ${data.sinCambios} sin cambios.`);
      alConfirmar();
    } catch (err) {
      if (actual === contexto.current) setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel" aria-label="Importación de calificaciones">
      {confirmacion.elemento}
      <h2>Importar calificaciones</h2>
      <p>
        Descarga la plantilla de esta clase y parcial. Conserva los identificadores y elimina las filas pendientes. CSV
        o XLSX, hasta 500 alumnos y 5 MB. La previsualización vence en 15 minutos.
      </p>
      <button type="button" disabled={!claseId || ocupado} onClick={plantilla}>Descargar plantilla XLSX</button>
      <fieldset disabled={deshabilitado || ocupado} className="grupo-formulario" style={{ border: 0 }}>
        <legend>Archivo y motivo</legend>
        <div className="campo">
          <label htmlFor="archivo-notas">Archivo de calificaciones</label>
          <input id="archivo-notas" ref={archivo} type="file" accept=".csv,.xlsx" onChange={() => setPreview(null)} />
        </div>
        <div className="campo">
          <label htmlFor="motivo-importacion">Motivo si corrige notas existentes</label>
          <input
            id="motivo-importacion"
            value={motivo}
            maxLength={300}
            onChange={(e) => {
              setMotivo(e.target.value);
              setPreview(null);
            }}
          />
        </div>
        <button type="button" onClick={previsualizar}>
          Previsualizar sin guardar
        </button>
      </fieldset>
      {ocupado && <p role="status">Procesando archivo…</p>}
      {error && <p role="alert">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {preview && (
        <>
          <p>
            {preview.registros} filas; {preview.diferencias.length} cambios; {preview.sinCambios ?? 0} sin cambios.
          </p>
          <ul>
            {preview.errores.map((e) => (
              <li key={e.fila}>
                Fila {e.fila}: {e.mensaje}
              </li>
            ))}
          </ul>
          <div className="tabla-contenedor" role="region" aria-label="Diferencias de importación" tabIndex={0}>
            <table className="tabla tabla-adaptable">
              <thead>
                <tr>
                  <th scope="col">Alumno ID</th>
                  <th scope="col">Anterior</th>
                  <th scope="col">Nueva</th>
                </tr>
              </thead>
              <tbody>
                {preview.diferencias.map((d) => (
                  <tr key={d.alumnoId}>
                    <td data-etiqueta="Alumno ID">{d.alumnoId}</td>
                    <td data-etiqueta="Anterior">{d.anterior ?? 'Pendiente'}</td>
                    <td data-etiqueta="Nueva">{d.nueva}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={deshabilitado || ocupado || !preview.previewId} onClick={confirmar}>
            Confirmar importación
          </button>
        </>
      )}
    </section>
  );
}
