import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

interface Materia { id: number; clave: string; nombre: string; creditos: number; descripcion?: string }
interface Ciclo { id: number; clave: string; nombre: string; activo: boolean; fechaInicio: string; fechaFin: string }

export default function MateriasPage() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [formMateria, setFormMateria] = useState({ clave: '', nombre: '', creditos: '0' });
  const [formCiclo, setFormCiclo] = useState({ clave: '', nombre: '', fechaInicio: '', fechaFin: '' });
  const [error, setError] = useState('');

  const cargar = () => {
    api.get<Materia[]>('/academico/materias').then((r) => setMaterias(r.data));
    api.get<Ciclo[]>('/academico/ciclos').then((r) => setCiclos(r.data));
  };
  useEffect(() => { cargar(); }, []);

  const crearMateria = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/academico/materias', { ...formMateria, creditos: Number(formMateria.creditos) });
      setFormMateria({ clave: '', nombre: '', creditos: '0' });
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const eliminarMateria = async (materia: Materia) => {
    if (!confirm(`¿Eliminar la materia ${materia.clave} — ${materia.nombre}? Dejará de aparecer en el catálogo.`)) return;
    setError('');
    try {
      await api.delete(`/academico/materias/${materia.id}`);
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const crearCiclo = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/academico/ciclos', { ...formCiclo, activo: true });
      setFormCiclo({ clave: '', nombre: '', fechaInicio: '', fechaFin: '' });
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Materias y ciclos" detalle="Catálogo académico" />
      {error && <p className="mensaje-error">{error}</p>}

      <section className="panel">
        <h2>Nueva materia</h2>
        <form onSubmit={crearMateria} className="fila">
          <div className="campo"><label>Clave</label>
            <input required value={formMateria.clave} onChange={(e) => setFormMateria({ ...formMateria, clave: e.target.value })} />
          </div>
          <div className="campo"><label>Nombre</label>
            <input required value={formMateria.nombre} onChange={(e) => setFormMateria({ ...formMateria, nombre: e.target.value })} />
          </div>
          <div className="campo"><label>Créditos</label>
            <input type="number" min={0} value={formMateria.creditos} onChange={(e) => setFormMateria({ ...formMateria, creditos: e.target.value })} />
          </div>
          <button className="boton">Guardar materia</button>
        </form>
      </section>

      <table className="tabla" style={{ marginBottom: 28 }}>
        <thead><tr><th>Clave</th><th>Materia</th><th>Créditos</th><th className="derecha">Acciones</th></tr></thead>
        <tbody>
          {materias.map((m) => (
            <tr key={m.id}>
              <td>{m.clave}</td><td>{m.nombre}</td><td>{m.creditos}</td>
              <td className="derecha">
                <button className="boton peligro chico" onClick={() => eliminarMateria(m)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {materias.length === 0 && <tr><td className="vacio" colSpan={3}>Sin materias en el catálogo.</td></tr>}
        </tbody>
      </table>

      <section className="panel">
        <h2>Nuevo ciclo escolar</h2>
        <form onSubmit={crearCiclo} className="fila">
          <div className="campo"><label>Clave</label>
            <input required placeholder="2026-2027" value={formCiclo.clave} onChange={(e) => setFormCiclo({ ...formCiclo, clave: e.target.value })} />
          </div>
          <div className="campo"><label>Nombre</label>
            <input required value={formCiclo.nombre} onChange={(e) => setFormCiclo({ ...formCiclo, nombre: e.target.value })} />
          </div>
          <div className="campo"><label>Inicio</label>
            <input type="date" required value={formCiclo.fechaInicio} onChange={(e) => setFormCiclo({ ...formCiclo, fechaInicio: e.target.value })} />
          </div>
          <div className="campo"><label>Fin</label>
            <input type="date" required value={formCiclo.fechaFin} onChange={(e) => setFormCiclo({ ...formCiclo, fechaFin: e.target.value })} />
          </div>
          <button className="boton">Guardar ciclo</button>
        </form>
      </section>

      <table className="tabla">
        <thead><tr><th>Clave</th><th>Ciclo</th><th>Periodo</th><th>Estado</th></tr></thead>
        <tbody>
          {ciclos.map((c) => (
            <tr key={c.id}>
              <td>{c.clave}</td><td>{c.nombre}</td>
              <td>{c.fechaInicio} — {c.fechaFin}</td>
              <td>{c.activo ? <span className="sello ok">Activo</span> : <span className="sello neutro">Cerrado</span>}</td>
            </tr>
          ))}
          {ciclos.length === 0 && <tr><td className="vacio" colSpan={4}>Sin ciclos registrados.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
