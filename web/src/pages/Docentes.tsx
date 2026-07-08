import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

interface Docente {
  id: number;
  numEmpleado: string;
  especialidad?: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; email: string };
}

const FORM_INICIAL = {
  numEmpleado: '', nombre: '', apellidoPaterno: '', email: '', password: '', especialidad: '',
};

export default function DocentesPage() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [error, setError] = useState('');

  const cargar = () => api.get<Docente[]>('/docentes').then((r) => setDocentes(r.data));
  useEffect(() => { cargar(); }, []);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/docentes', { ...form, especialidad: form.especialidad || undefined });
      setForm(FORM_INICIAL);
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
        </form>
        {error && <p className="mensaje-error">{error}</p>}
      </section>

      <table className="tabla">
        <thead>
          <tr><th>Empleado</th><th>Nombre</th><th>Especialidad</th><th>Correo</th><th>Estatus</th><th /></tr>
        </thead>
        <tbody>
          {docentes.map((d) => (
            <tr key={d.id}>
              <td>{d.numEmpleado}</td>
              <td>{d.usuario.nombre} {d.usuario.apellidoPaterno}</td>
              <td>{d.especialidad ?? '—'}</td>
              <td>{d.usuario.email}</td>
              <td><span className={`sello ${d.estatus === 'ACTIVO' ? 'ok' : 'neutro'}`}>{d.estatus}</span></td>
              <td className="derecha"><button className="boton peligro chico" onClick={() => baja(d)}>Baja</button></td>
            </tr>
          ))}
          {docentes.length === 0 && <tr><td className="vacio" colSpan={6}>Sin docentes registrados.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
