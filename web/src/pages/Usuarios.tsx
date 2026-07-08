import { FormEvent, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';

interface Usuario {
  id: number; email: string; nombre: string; apellidoPaterno: string;
  activo: boolean; roles: { clave: string }[];
}

const ROLES_PERSONAL = ['ADMINISTRATIVO', 'FINANZAS', 'SUPERADMIN'] as const;
const FORM_INICIAL = { email: '', password: '', nombre: '', apellidoPaterno: '' };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [rolesElegidos, setRolesElegidos] = useState<string[]>(['ADMINISTRATIVO']);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = () => api.get<Usuario[]>('/usuarios').then((r) => setUsuarios(r.data));
  useEffect(() => { cargar(); }, []);

  const alternarRol = (rol: string) =>
    setRolesElegidos((previos) =>
      previos.includes(rol) ? previos.filter((r) => r !== rol) : [...previos, rol],
    );

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setMensaje('');
    if (rolesElegidos.length === 0) { setError('Selecciona al menos un rol'); return; }
    try {
      await api.post('/usuarios', { ...form, roles: rolesElegidos });
      setMensaje(`Cuenta ${form.email} creada`);
      setForm(FORM_INICIAL);
      setRolesElegidos(['ADMINISTRATIVO']);
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  const alternarAcceso = async (usuario: Usuario) => {
    setError('');
    try {
      await api.patch(`/usuarios/${usuario.id}`, { activo: !usuario.activo });
      cargar();
    } catch (err) { setError(mensajeDeError(err)); }
  };

  return (
    <>
      <Encabezado titulo="Usuarios del sistema" detalle="Cuentas de personal, roles y acceso (solo superadministración)" />

      <section className="panel">
        <h2>Crear cuenta de personal</h2>
        <p className="detalle" style={{ marginTop: -6, marginBottom: 12 }}>
          Los maestros se dan de alta en <b>Docentes</b> y los alumnos en <b>Alumnos</b> (ahí se crea su expediente completo).
        </p>
        <form onSubmit={crear}>
          <div className="fila">
            <div className="campo"><label>Nombre</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="campo"><label>Apellido paterno</label>
              <input required value={form.apellidoPaterno} onChange={(e) => setForm({ ...form, apellidoPaterno: e.target.value })} />
            </div>
            <div className="campo"><label>Correo</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="campo"><label>Contraseña inicial</label>
              <input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="fila" style={{ marginTop: 12, alignItems: 'center' }}>
            <span className="campo"><label>Roles</label></span>
            {ROLES_PERSONAL.map((rol) => (
              <label key={rol} className="casilla">
                <input
                  type="checkbox"
                  checked={rolesElegidos.includes(rol)}
                  onChange={() => alternarRol(rol)}
                />
                {rol}
              </label>
            ))}
            <button className="boton">Crear cuenta</button>
          </div>
        </form>
        {error && <p className="mensaje-error">{error}</p>}
        {mensaje && <p className="mensaje-ok">{mensaje}</p>}
      </section>

      <table className="tabla">
        <thead><tr><th>Correo</th><th>Nombre</th><th>Roles</th><th>Acceso</th><th className="derecha">Acciones</th></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.nombre} {u.apellidoPaterno}</td>
              <td>{u.roles.map((r) => r.clave).join(', ')}</td>
              <td>{u.activo ? <span className="sello ok">Activo</span> : <span className="sello mal">Bloqueado</span>}</td>
              <td className="derecha">
                <button className={`boton chico ${u.activo ? 'peligro' : 'secundario'}`} onClick={() => alternarAcceso(u)}>
                  {u.activo ? 'Bloquear' : 'Reactivar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
