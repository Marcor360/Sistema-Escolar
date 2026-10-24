import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';

interface PerfilAlumno {
  usuario: { correoPersonal: string | null; telefono: string | null };
  fechaNacimiento: string | null;
  tutorNombre: string | null;
  tutorTelefono: string | null;
  direccion: string | null;
}
type Edicion = Record<'correoPersonal' | 'fechaNacimiento' | 'telefono' | 'tutorNombre' | 'tutorTelefono' | 'direccion', string>;
const campos: { clave: keyof Edicion; titulo: string; tipo?: string; maximo: number }[] = [
  { clave: 'correoPersonal', titulo: 'Correo personal', tipo: 'email', maximo: 120 },
  { clave: 'fechaNacimiento', titulo: 'Fecha de nacimiento', tipo: 'date', maximo: 10 },
  { clave: 'telefono', titulo: 'Teléfono', tipo: 'tel', maximo: 20 },
  { clave: 'tutorNombre', titulo: 'Nombre del tutor', maximo: 120 },
  { clave: 'tutorTelefono', titulo: 'Teléfono del tutor', tipo: 'tel', maximo: 20 },
  { clave: 'direccion', titulo: 'Dirección', maximo: 200 },
];
const formulario = (perfil: PerfilAlumno): Edicion => ({
  correoPersonal: perfil.usuario.correoPersonal ?? '',
  telefono: perfil.usuario.telefono ?? '',
  fechaNacimiento: perfil.fechaNacimiento ?? '',
  tutorNombre: perfil.tutorNombre ?? '',
  tutorTelefono: perfil.tutorTelefono ?? '',
  direccion: perfil.direccion ?? '',
});
export function PerfilAlumnoEditable() {
  const [datos, setDatos] = useState<Edicion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const recargar = async () => {
    setCargando(true); setError('');
    try {
      const { data } = await api.get<PerfilAlumno>('/alumnos/me/perfil');
      setDatos(formulario(data));
    } catch (e) { setError(mensajeDeError(e)); }
    finally { setCargando(false); }
  };
  useEffect(() => { void recargar(); }, []);
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!datos || guardando) return;
    setGuardando(true); setError(''); setAviso('');
    try {
      const { data } = await api.patch<PerfilAlumno>('/alumnos/me/perfil', {
        correoPersonal: datos.correoPersonal || null,
        fechaNacimiento: datos.fechaNacimiento || null,
        telefono: datos.telefono || null,
        tutorNombre: datos.tutorNombre || null,
        tutorTelefono: datos.tutorTelefono || null,
        direccion: datos.direccion || null,
      });
      setDatos(formulario(data)); setEditando(false);
      setAviso('Tus datos de contacto se guardaron correctamente.');
    } catch (e) { setError(mensajeDeError(e)); }
    finally { setGuardando(false); }
  };
  return <section className="panel" aria-label="Datos personales del alumno" aria-busy={cargando || guardando}>
    <h2>Mis datos de contacto</h2>
    <p className="texto-ayuda">Puedes actualizar tus datos y los de tu tutor. El correo institucional, CURP y matrícula no se modifican aquí.</p>
    {cargando && <p role="status">Consultando datos…</p>}
    {error && <p role="alert" className="mensaje-error">{error}</p>}
    {aviso && <p role="status">{aviso}</p>}
    {!cargando && datos && <form onSubmit={(e) => { void guardar(e); }}>
      <fieldset disabled={!editando || guardando} style={{ border: 0, margin: 0, padding: 0 }}>
        {campos.map((campo) => <div className="campo" key={campo.clave}>
          <label htmlFor={`mi-${campo.clave}`}>{campo.titulo}</label>
          <input id={`mi-${campo.clave}`} type={campo.tipo ?? 'text'}
            maxLength={campo.maximo} value={datos[campo.clave]}
            onChange={(e) => setDatos((anterior) => anterior && ({ ...anterior, [campo.clave]: e.target.value }))} />
        </div>)}
      </fieldset>
      {editando
        ? <div className="cuenta-acciones"><button className="boton" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar mis datos'}</button>
            <button className="boton secundario" type="button" disabled={guardando} onClick={() => { setEditando(false); void recargar(); }}>Cancelar</button></div>
        : <button className="boton secundario" type="button" onClick={() => { setEditando(true); setAviso(''); }}>Editar datos</button>}
    </form>}
    {!cargando && !datos && <button className="boton secundario" type="button" onClick={() => { void recargar(); }}>Reintentar</button>}
  </section>;
}
