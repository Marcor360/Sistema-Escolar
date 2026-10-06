import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';

interface GrupoMateria {
  id: number;
  grupo: { id: number; nombre: string };
  materia: { clave: string; nombre: string };
}
interface Inscripcion {
  alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } };
}
interface Registro { alumnoId: number; parcial: number; calificacion: number }
interface EstadoPeriodo { estatus: 'ABIERTO' | 'CERRADO' }
interface CambioCalificacion {
  id: number; alumnoId: number; valorAnterior: number | null; valorNuevo: number;
  usuarioId: number; fecha: string; motivo: string | null;
}

export default function CalificacionesPage() {
  const { tieneRol } = useAuth();
  const [clases, setClases] = useState<GrupoMateria[]>([]);
  const [claseId, setClaseId] = useState('');
  const [parcial, setParcial] = useState('1');
  const [alumnos, setAlumnos] = useState<Inscripcion[]>([]);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [estadoPeriodo, setEstadoPeriodo] = useState<EstadoPeriodo['estatus'] | null>(null);
  const [historial, setHistorial] = useState<CambioCalificacion[]>([]);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarClases = useCallback(() => {
    // El maestro ve sus clases; control escolar captura en cualquiera (una sola petición)
    const ruta = tieneRol('MAESTRO') && !tieneRol('ADMINISTRATIVO')
      ? '/academico/mis-grupos'
      : '/academico/grupo-materias';
    api.get<GrupoMateria[]>(ruta)
      .then((r) => setClases(r.data))
      .catch((err) => setError(mensajeDeError(err)));
  }, [tieneRol]);

  useEffect(() => { cargarClases(); }, [cargarClases]);

  const cargarAlumnos = async () => {
    setMensaje(''); setError('');
    setAlumnos([]); setValores({}); setEstadoPeriodo(null); setHistorial([]);
    const clase = clases.find((c) => c.id === Number(claseId));
    if (!clase) return;
    try {
      const [insc, previas, estado, cambios] = await Promise.all([
        api.get<Inscripcion[]>(`/academico/grupos/${clase.grupo.id}/alumnos`),
        api.get<Registro[]>(`/calificaciones/grupo-materia/${clase.id}`, { params: { parcial } }),
        api.get<EstadoPeriodo>(`/calificaciones/periodos/${clase.id}/${parcial}`),
        api.get<CambioCalificacion[]>(`/calificaciones/periodos/${clase.id}/${parcial}/historial`),
      ]);
      setAlumnos(insc.data);
      setEstadoPeriodo(estado.data.estatus);
      setHistorial(cambios.data);
      const mapa: Record<number, string> = {};
      for (const r of previas.data) mapa[r.alumnoId] = String(r.calificacion);
      setValores(mapa);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const cambiarEstado = async () => {
    if (!claseId || estadoPeriodo === null) return;
    setError(''); setMensaje('');
    const siguiente = estadoPeriodo === 'ABIERTO' ? 'CERRADO' : 'ABIERTO';
    try {
      const { data } = await api.patch<EstadoPeriodo>(`/calificaciones/periodos/${claseId}/${parcial}`, {
        estatus: siguiente,
      });
      setEstadoPeriodo(data.estatus);
      setMensaje(`Periodo ${data.estatus.toLowerCase()}`);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  /** Concentrado de la clase (parciales, final y promedio) en Excel. */
  const descargarExcel = async () => {
    setError('');
    try {
      const { data } = await api.get(`/reportes/grupo-materias/${claseId}/calificaciones.xlsx`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'calificaciones.xlsx';
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setMensaje('');
    const items = alumnos
      .filter((a) => valores[a.alumno.id] !== undefined && valores[a.alumno.id] !== '')
      .map((a) => ({ alumnoId: a.alumno.id, calificacion: Number(valores[a.alumno.id]) }));
    if (items.length === 0) { setError('Captura al menos una calificación'); return; }
    try {
      const { data } = await api.post('/calificaciones/captura', {
        grupoMateriaId: Number(claseId),
        parcial: Number(parcial),
        motivo: motivo.trim() || undefined,
        items,
      });
      setMensaje(`${data.capturadas} calificaciones guardadas`);
      setMotivo('');
      const { data: cambios } = await api.get<CambioCalificacion[]>(
        `/calificaciones/periodos/${claseId}/${parcial}/historial`,
      );
      setHistorial(cambios);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Captura de calificaciones" detalle="Registro por grupo-materia y parcial" />
      {error && <p className="mensaje-error" role="alert">{error}</p>}
      {mensaje && <p className="mensaje-ok" role="status">{mensaje}</p>}

      <section className="panel">
        <div className="fila">
          <div className="campo"><label>Clase</label>
            <select value={claseId} onChange={(e) => {
              setClaseId(e.target.value); setAlumnos([]); setValores({}); setEstadoPeriodo(null); setHistorial([]);
            }}>
              <option value="">Selecciona…</option>
              {clases.map((c) => (
                <option key={c.id} value={c.id}>{c.grupo.nombre} · {c.materia.clave} {c.materia.nombre}</option>
              ))}
            </select>
          </div>
          <div className="campo"><label>Parcial</label>
            <select value={parcial} onChange={(e) => {
              setParcial(e.target.value); setAlumnos([]); setValores({}); setEstadoPeriodo(null); setHistorial([]);
            }}>
              <option value="1">Parcial 1</option><option value="2">Parcial 2</option>
              <option value="3">Parcial 3</option><option value="0">Final</option>
            </select>
          </div>
          <button className="boton secundario" onClick={cargarAlumnos} disabled={!claseId}>Cargar lista</button>
          <button type="button" className="boton secundario" onClick={descargarExcel} disabled={!claseId}>
            Descargar Excel
          </button>
        </div>
      </section>

      {estadoPeriodo && (
        <section className="panel">
          <p role="status">Periodo {estadoPeriodo.toLowerCase()}</p>
          {tieneRol('ADMINISTRATIVO') && (
            <button type="button" className="boton secundario" onClick={cambiarEstado}>
              {estadoPeriodo === 'ABIERTO' ? 'Cerrar periodo' : 'Reabrir periodo'}
            </button>
          )}
        </section>
      )}

      {alumnos.length > 0 && (
        <form onSubmit={guardar}>
          <table className="tabla" style={{ marginBottom: 14 }}>
            <thead><tr><th>Matrícula</th><th>Alumno</th><th style={{ width: 140 }}>Calificación</th></tr></thead>
            <tbody>
              {alumnos.map((i) => (
                <tr key={i.alumno.id}>
                  <td>{i.alumno.matricula}</td>
                  <td>{i.alumno.usuario.nombre} {i.alumno.usuario.apellidoPaterno}</td>
                  <td>
                    <input
                      type="number" min={0} max={100} step={0.1} style={{ minWidth: 90, width: 90 }}
                      value={valores[i.alumno.id] ?? ''}
                      onChange={(e) => setValores({ ...valores, [i.alumno.id]: e.target.value })}
                      disabled={estadoPeriodo === 'CERRADO'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="campo">
            <label htmlFor="motivo-calificacion">Motivo de la captura o corrección (opcional)</label>
            <input id="motivo-calificacion" maxLength={300} value={motivo}
              onChange={(e) => setMotivo(e.target.value)} disabled={estadoPeriodo === 'CERRADO'} />
          </div>
          <button className="boton" disabled={estadoPeriodo === 'CERRADO'}>Guardar calificaciones</button>
        </form>
      )}

      {historial.length > 0 && (
        <section className="panel">
          <h2>Historial reciente del periodo</h2>
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Alumno</th><th>Anterior</th><th>Nueva</th><th>Usuario</th><th>Motivo</th></tr></thead>
            <tbody>{historial.map((cambio) => (
              <tr key={cambio.id}>
                <td>{new Date(cambio.fecha).toLocaleString('es-MX')}</td>
                <td>{alumnos.find((i) => i.alumno.id === cambio.alumnoId)?.alumno.matricula ?? cambio.alumnoId}</td>
                <td>{cambio.valorAnterior ?? '—'}</td>
                <td>{cambio.valorNuevo}</td>
                <td>{cambio.usuarioId}</td>
                <td>{cambio.motivo ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
