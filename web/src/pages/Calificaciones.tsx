import { FormEvent, useEffect, useState } from 'react';
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

export default function CalificacionesPage() {
  const { tieneRol } = useAuth();
  const [clases, setClases] = useState<GrupoMateria[]>([]);
  const [claseId, setClaseId] = useState('');
  const [parcial, setParcial] = useState('1');
  const [alumnos, setAlumnos] = useState<Inscripcion[]>([]);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    // El maestro ve sus clases; control escolar captura en cualquiera (una sola petición)
    const ruta = tieneRol('MAESTRO') && !tieneRol('ADMINISTRATIVO')
      ? '/academico/mis-grupos'
      : '/academico/grupo-materias';
    api.get<GrupoMateria[]>(ruta).then((r) => setClases(r.data));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarAlumnos = async () => {
    setMensaje(''); setError('');
    const clase = clases.find((c) => c.id === Number(claseId));
    if (!clase) return;
    const [insc, previas] = await Promise.all([
      api.get<Inscripcion[]>(`/academico/grupos/${clase.grupo.id}/alumnos`),
      api.get<Registro[]>(`/calificaciones/grupo-materia/${clase.id}`, { params: { parcial } }),
    ]);
    setAlumnos(insc.data);
    const mapa: Record<number, string> = {};
    for (const r of previas.data) mapa[r.alumnoId] = String(r.calificacion);
    setValores(mapa);
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
        items,
      });
      setMensaje(`${data.capturadas} calificaciones guardadas`);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Captura de calificaciones" detalle="Registro por grupo-materia y parcial" />

      <section className="panel">
        <div className="fila">
          <div className="campo"><label>Clase</label>
            <select value={claseId} onChange={(e) => setClaseId(e.target.value)}>
              <option value="">Selecciona…</option>
              {clases.map((c) => (
                <option key={c.id} value={c.id}>{c.grupo.nombre} · {c.materia.clave} {c.materia.nombre}</option>
              ))}
            </select>
          </div>
          <div className="campo"><label>Parcial</label>
            <select value={parcial} onChange={(e) => setParcial(e.target.value)}>
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
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <p className="mensaje-error">{error}</p>}
          {mensaje && <p className="mensaje-ok">{mensaje}</p>}
          <button className="boton">Guardar calificaciones</button>
        </form>
      )}
    </>
  );
}
