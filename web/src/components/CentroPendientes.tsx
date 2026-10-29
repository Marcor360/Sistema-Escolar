import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
interface Pendiente {
  titulo: string;
  cantidad: number;
  ruta: string;
}
export function CentroPendientes() {
  const { sesion } = useAuth();
  const puedeFiltrar = !!sesion?.roles.some((r) => ['SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS'].includes(r));
  const [planteles, setPlanteles] = useState<{ id: number; nombre: string }[]>([]);
  const [plantelId, setPlantelId] = useState(''),
    [datos, setDatos] = useState<Pendiente[]>([]),
    [error, setError] = useState(''),
    [errorPlanteles, setErrorPlanteles] = useState(''),
    [cargando, setCargando] = useState(true),
    [intento, setIntento] = useState(0);
  const selectorId = useId();
  useEffect(() => {
    if (!puedeFiltrar) return;
    let vigente = true;
    setErrorPlanteles('');
    api
      .get('/planteles/mios')
      .then((r) => {
        if (vigente) setPlanteles(r.data);
      })
      .catch((e) => {
        if (vigente) setErrorPlanteles(mensajeDeError(e));
      });
    return () => {
      vigente = false;
    };
  }, [puedeFiltrar, intento]);
  useEffect(() => {
    let vigente = true;
    setDatos([]);
    setCargando(true);
    setError('');
    api
      .get('/seguimiento/pendientes', { params: puedeFiltrar && plantelId ? { plantelId } : {} })
      .then((r) => {
        if (vigente) setDatos(r.data);
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [plantelId, puedeFiltrar, intento]);
  return (
    <section className="panel" aria-label="Centro de pendientes">
      <h2>Mis pendientes</h2>
      {puedeFiltrar && (
        <div className="campo">
          <label htmlFor={selectorId}>Plantel de los pendientes</label>
          <select id={selectorId} value={plantelId} onChange={(e) => setPlantelId(e.target.value)}>
            <option value="">Todos mis planteles autorizados</option>
            {planteles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {cargando ? (
        <p role="status">Consultando pendientes…</p>
      ) : (
        <ul className="pendientes-lista">
          {datos.map((d) => (
            <li key={d.titulo}>
              <Link to={d.ruta}>
                {d.titulo}: <strong>{d.cantidad}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!cargando && !error && !datos.length && <p>No hay categorías de pendientes para tu cuenta.</p>}
      {(error || errorPlanteles) && <p role="alert">{error || errorPlanteles}</p>}
      <button onClick={() => setIntento((v) => v + 1)} disabled={cargando}>
        Actualizar pendientes
      </button>
    </section>
  );
}
