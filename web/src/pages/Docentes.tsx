import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

interface Docente {
  id: number;
  numEmpleado: string;
  especialidad?: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; email: string };
  planteles: string[];
}
interface Plantel { id: number; nombre: string }

const FORM_INICIAL = {
  numEmpleado: '', nombre: '', apellidoPaterno: '', email: '', password: '', especialidad: '',
};

export default function DocentesPage() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [plantelIds, setPlantelIds] = useState<number[]>([]);
  const [filtroPlantel, setFiltroPlantel] = useState('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');

  const cargar = (plantelId = filtroPlantel) => api.get<Docente[]>('/docentes', { params: plantelId ? { plantelId } : {} }).then((r) => setDocentes(r.data));
  useEffect(() => { cargar(); api.get<Plantel[]>('/planteles/mios').then((r) => setPlanteles(r.data)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/docentes', { ...form, plantelIds, especialidad: form.especialidad || undefined });
      setForm(FORM_INICIAL);
      setPlantelIds([]);
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const dar = (campo: keyof typeof FORM_INICIAL) => ({
    value: form[campo],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [campo]: e.target.value }),
  });

  const baja = async (docente: Docente) => {
    if (!confirm(`¿Dar de baja al docente ${docente.numEmpleado}?`)) return;
    await api.delete(`/docentes/${docente.id}`);
    cargar();
  };

  return (
    <>
      <Encabezado titulo="Docentes" detalle="Plantilla docente y cuentas de acceso" />

      <section className="panel">
        <h2>Registrar docente</h2>
        <form onSubmit={crear}>
          <div className="fila">
            <div className="campo"><label>Núm. empleado</label><input required {...dar('numEmpleado')} /></div>
            <div className="campo"><label>Nombre</label><input required {...dar('nombre')} /></div>
            <div className="campo"><label>Apellido paterno</label><input required {...dar('apellidoPaterno')} /></div>
            <div className="campo"><label>Especialidad</label><input {...dar('especialidad')} /></div>
            <div className="campo"><label>Correo</label><input type="email" required {...dar('email')} /></div>
            <div className="campo"><label>Contraseña inicial</label><input required minLength={8} {...dar('password')} /></div>
            <button className="boton">Guardar docente</button>
          </div>
          <div className="fila" style={{ marginTop: 12 }}>
            <span className="campo"><label>Planteles</label></span>
            {planteles.map((p) => <label className="casilla" key={p.id}><input type="checkbox" required={plantelIds.length === 0} checked={plantelIds.includes(p.id)} onChange={() => setPlantelIds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id])} />{p.nombre}</label>)}
          </div>
        </form>
        {error && <p className="mensaje-error">{error}</p>}
      </section>

      <div className="fila" style={{ marginBottom: 12 }}><div className="campo"><label>Filtrar por plantel</label><select value={filtroPlantel} onChange={(e) => setFiltroPlantel(e.target.value)}><option value="">Todos</option>{planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div><button className="boton secundario" onClick={() => cargar()}>Aplicar</button></div>

      <table className="tabla">
        <thead>
          <tr><th>Empleado</th><th>Nombre</th><th>Planteles</th><th>Especialidad</th><th>Correo</th><th>Estatus</th><th /></tr>
        </thead>
        <tbody>
          {docentes.map((d) => (
            <tr key={d.id}>
              <td>{d.numEmpleado}</td>
              <td>{d.usuario.nombre} {d.usuario.apellidoPaterno}</td>
              <td>{d.planteles.join(', ') || '—'}</td>
              <td>{d.especialidad ?? '—'}</td>
              <td>{d.usuario.email}</td>
              <td><span className={`sello ${d.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{d.estatus}</span></td>
              <td className="derecha"><button className="boton peligro chico" onClick={() => baja(d)}>Baja</button></td>
            </tr>
          ))}
          {docentes.length === 0 && <tr><td className="vacio" colSpan={7}>Sin docentes registrados.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
