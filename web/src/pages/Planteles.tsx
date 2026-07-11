import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';

interface Plantel {
  id: number; clave: string; nombre: string; direccion?: string; municipio?: string;
  telefono?: string; activo: boolean;
}
interface Detalle extends Plantel {
  director: { id: number; nombre: string; apellidoPaterno: string; email: string } | null;
  personal: Array<{ id: number; nombre: string; email: string; roles: string[] }>;
  conteos: { alumnos: number; grupos: number };
}

export default function PlantelesPage() {
  const { sesion } = useAuth();
  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const [planteles, setPlanteles] = useState<Plantel[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [alta, setAlta] = useState({ clave: '', nombre: '', direccion: '', municipio: '', telefono: '' });
  const [directorEmail, setDirectorEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = () => api.get<Plantel[]>('/planteles').then((r) => setPlanteles(r.data));
  const seleccionar = (id: number) => api.get<Detalle>(`/planteles/${id}`).then((r) => setDetalle(r.data));
  useEffect(() => { cargar(); }, []);

  const crear = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setMensaje('');
    try {
      const { data } = await api.post<Plantel>('/planteles', {
        ...alta,
        direccion: alta.direccion || undefined,
        municipio: alta.municipio || undefined,
        telefono: alta.telefono || undefined,
      });
      setAlta({ clave: '', nombre: '', direccion: '', municipio: '', telefono: '' });
      setMensaje('Plantel creado'); await cargar(); await seleccionar(data.id);
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const operar = async (accion: () => Promise<unknown>, texto: string) => {
    if (!detalle) return;
    setError(''); setMensaje('');
    try { await accion(); setMensaje(texto); await seleccionar(detalle.id); }
    catch (err) { setError(mensajeDeError(err)); }
  };

  return <>
    <Encabezado titulo="Planteles" detalle="Datos, dirección y personal asignado por sede" />
    {error && <p className="mensaje-error">{error}</p>}
    {mensaje && <p className="mensaje-ok">{mensaje}</p>}

    {esSuperadmin && <section className="panel">
      <h2>Nuevo plantel</h2>
      <form className="fila" onSubmit={crear}>
        <div className="campo"><label>Clave</label><input required minLength={2} maxLength={10} value={alta.clave} onChange={(e) => setAlta({ ...alta, clave: e.target.value.toUpperCase() })} /></div>
        <div className="campo"><label>Nombre</label><input required minLength={3} value={alta.nombre} onChange={(e) => setAlta({ ...alta, nombre: e.target.value })} /></div>
        <div className="campo"><label>Municipio</label><input value={alta.municipio} onChange={(e) => setAlta({ ...alta, municipio: e.target.value })} /></div>
        <div className="campo"><label>Dirección</label><input value={alta.direccion} onChange={(e) => setAlta({ ...alta, direccion: e.target.value })} /></div>
        <div className="campo"><label>Teléfono</label><input value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} /></div>
        <button className="boton">Crear</button>
      </form>
    </section>}

    <section className="panel">
      <h2>Planteles</h2>
      <table className="tabla"><thead><tr><th>Clave</th><th>Nombre</th><th>Municipio</th><th>Estatus</th><th /></tr></thead>
        <tbody>{planteles.map((p) => <tr key={p.id}><td>{p.clave}</td><td>{p.nombre}</td><td>{p.municipio ?? '—'}</td><td><span className={`sello ${p.activo ? 'ok' : 'neutro'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td><td className="derecha"><button className="boton secundario chico" onClick={() => seleccionar(p.id)}>Seleccionar</button></td></tr>)}</tbody>
      </table>
    </section>

    {detalle && <section className="panel">
      <h2>{detalle.nombre}</h2>
      <p className="detalle">{detalle.direccion || 'Sin dirección'} · {detalle.municipio || 'Sin municipio'} · {detalle.telefono || 'Sin teléfono'}</p>
      <div className="fila"><span className="sello neutro">{detalle.conteos.alumnos} alumnos</span><span className="sello neutro">{detalle.conteos.grupos} grupos</span></div>
      <h3>Director</h3>
      <p>{detalle.director ? `${detalle.director.nombre} ${detalle.director.apellidoPaterno} · ${detalle.director.email}` : 'Sin director asignado'}</p>
      <div className="fila"><div className="campo"><label>Correo del director</label><input type="email" value={directorEmail} onChange={(e) => setDirectorEmail(e.target.value)} /></div><button className="boton" onClick={() => operar(() => api.put(`/planteles/${detalle.id}/director`, { email: directorEmail }), 'Director actualizado')}>Asignar director</button></div>
      <h3>Personal asignado</h3>
      <div className="fila"><div className="campo"><label>Correo del personal</label><input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} /></div><button className="boton" onClick={() => operar(() => api.post(`/planteles/${detalle.id}/personal`, { email: personalEmail }), 'Personal agregado')}>Agregar</button></div>
      <table className="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Roles</th><th /></tr></thead><tbody>
        {detalle.personal.map((p) => <tr key={p.id}><td>{p.nombre}</td><td>{p.email}</td><td>{p.roles.join(', ')}</td><td className="derecha"><button className="boton peligro chico" onClick={() => operar(() => api.delete(`/planteles/${detalle.id}/personal/${p.id}`), 'Personal retirado')}>Quitar</button></td></tr>)}
      </tbody></table>
    </section>}
  </>;
}
