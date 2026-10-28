import { useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Encabezado } from '../components/Encabezado';

type RolPersonal = 'FINANZAS' | 'ADMINISTRATIVO' | 'DIRECTOR';
interface Cuenta {
  id: number;
  nombre: string;
  correo: string;
  roles: string[];
  planteles: string[];
  activo: boolean;
}
interface Resultado { datos: Cuenta[]; total: number; pagina: number; porPagina: number }

export default function RolesPersonalPage() {
  const { sesion } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Resultado>({ datos: [], total: 0, pagina: 1, porPagina: 10 });
  const [seleccion, setSeleccion] = useState<Cuenta | null>(null);
  const [roles, setRoles] = useState<RolPersonal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const esSuperadmin = sesion?.roles.includes('SUPERADMIN') ?? false;
  const esDirector = sesion?.roles.includes('DIRECTOR') ?? false;
  const puedeEditar = esSuperadmin || esDirector || (sesion?.roles.includes('ADMINISTRATIVO') ?? false);
  const opciones: RolPersonal[] = esSuperadmin
    ? ['FINANZAS', 'ADMINISTRATIVO', 'DIRECTOR']
    : esDirector ? ['FINANZAS', 'ADMINISTRATIVO'] : ['FINANZAS'];

  const consultar = useCallback(async (paginaSolicitada: number) => {
    setCargando(true); setError('');
    try {
      const { data } = await api.get<Resultado>('/usuarios/listado', {
        params: { tipo: 'ADMINISTRATIVO', pagina: paginaSolicitada, porPagina: 10 },
      });
      setResultado(data);
    } catch (err) { setError(mensajeDeError(err)); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { if (puedeEditar) void consultar(pagina); }, [consultar, pagina, puedeEditar]);

  const editar = (cuenta: Cuenta) => {
    setSeleccion(cuenta);
    setRoles(cuenta.roles.filter((rol): rol is RolPersonal => opciones.includes(rol as RolPersonal)));
    setMensaje(''); setError('');
  };

  const guardar = async () => {
    if (!seleccion || guardando) return;
    const conservados = seleccion.roles.filter((rol) => rol === 'MAESTRO');
    const propuesta = [...new Set([...conservados, ...roles])];
    if (propuesta.length === 0) { setError('Debe conservarse al menos una función de personal.'); return; }
    if (!window.confirm('¿Confirmas el cambio de funciones? Se cerrarán las sesiones del usuario.')) return;
    setGuardando(true); setError(''); setMensaje('');
    try {
      await api.patch(`/usuarios/${seleccion.id}/roles`, { roles: propuesta });
      setSeleccion(null);
      setMensaje('Roles actualizados. Las sesiones previas se han revocado.');
      await consultar(pagina);
    } catch (err) { setError(mensajeDeError(err)); }
    finally { setGuardando(false); }
  };

  return <main>
    <Encabezado titulo="Asignación de funciones" detalle="Gestiona roles subordinados del personal sin modificar expedientes académicos." />
    <p>Los roles docentes se gestionan desde el expediente de Docentes. Esta pantalla no convierte alumnos en empleados ni permite modificar una cuenta de igual o mayor jerarquía.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {mensaje && <p role="status">{mensaje}</p>}
    {cargando ? <p role="status">Consultando personal…</p> : (
      <section className="panel" aria-label="Personal registrado">
        <h2>Personal institucional</h2>
        {resultado.datos.length === 0 ? <p>No se encontraron cuentas para consultar.</p> : (
          <div className="tabla-scroll">
            <table>
              <thead><tr><th>Persona</th><th>Funciones</th><th>Planteles</th><th>Acción</th></tr></thead>
              <tbody>{resultado.datos.map((cuenta) => (
                <tr key={cuenta.id}>
                  <td>{cuenta.nombre}<div>{cuenta.correo}</div></td>
                  <td>{cuenta.roles.join(', ')}</td>
                  <td>{cuenta.planteles.join(', ') || 'Sin asignación'}</td>
                  <td><button type="button" className="boton secundario chico"
                    disabled={!cuenta.activo || cuenta.id === sesion?.sub || cuenta.roles.includes('SUPERADMIN') && !esSuperadmin || cuenta.roles.includes('DIRECTOR') && !esSuperadmin || cuenta.roles.includes('ADMINISTRATIVO') && !esSuperadmin && !esDirector}
                    onClick={() => editar(cuenta)}>Modificar funciones</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="fila">
          <button type="button" className="boton secundario" disabled={pagina <= 1 || cargando} onClick={() => setPagina((v) => v - 1)}>Anterior</button>
          <span>Página {pagina}</span>
          <button type="button" className="boton secundario" disabled={pagina * resultado.porPagina >= resultado.total || cargando} onClick={() => setPagina((v) => v + 1)}>Siguiente</button>
        </div>
      </section>
    )}
    {seleccion && <section className="panel" aria-label="Modificar funciones">
      <h2>Funciones de {seleccion.nombre}</h2>
      <p>Solo puedes cambiar las funciones que tu nivel permite asignar. Los permisos se verificarán nuevamente en el servidor.</p>
      <fieldset disabled={guardando}>
        <legend>Funciones autorizadas</legend>
        {opciones.map((rol) => <label key={rol} className="casilla">
          <input type="checkbox" checked={roles.includes(rol)}
            onChange={(event) => setRoles((actual) => event.target.checked ? [...actual, rol] : actual.filter((v) => v !== rol))} /> {rol}
        </label>)}
      </fieldset>
      <div className="fila">
        <button className="boton" type="button" disabled={guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar funciones'}</button>
        <button className="boton secundario" type="button" disabled={guardando} onClick={() => setSeleccion(null)}>Cancelar</button>
      </div>
    </section>}
  </main>;
}
