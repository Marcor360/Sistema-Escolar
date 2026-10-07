import { useCallback, useEffect, useState } from 'react';
import { api, mensajeDeError } from '../api/client';
import { Paginador } from './Paginador';
import { fechaHora } from '../utils/formato';
interface Registro { id: number; usuarioId: number; accion: string; entidadId: number; detalle: string; fecha: string }
export function BitacoraAcademica() {
  const [resultado, setResultado] = useState<{ datos: Registro[]; total: number; pagina: number }>({ datos: [], total: 0, pagina: 1 }); const [error, setError] = useState(''); const [cargando, setCargando] = useState(false);
  const cargar = useCallback(async (pagina = 1) => { setCargando(true); setError(''); try { const { data } = await api.get('/academico/bitacora', { params: { pagina, porPagina: 20 } }); setResultado(data); } catch (err) { setError(mensajeDeError(err)); } finally { setCargando(false); } }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  return <section className="panel"><h2>Bitácora académica</h2><p>Transiciones de dominio dentro de tu alcance; actores e identificadores, sin expedientes completos.</p><button disabled={cargando} onClick={() => cargar()}>Actualizar bitácora</button>{error && <p role="alert">{error}</p>}
    <table className="tabla"><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead><tbody>{resultado.datos.map((r) => <tr key={r.id}><td>{fechaHora(r.fecha)}</td><td>{r.usuarioId}</td><td>{r.accion}</td><td>{r.entidadId}</td><td>{r.detalle}</td></tr>)}</tbody></table><Paginador total={resultado.total} pagina={resultado.pagina} porPagina={20} onCambio={cargar} />
  </section>;
}
