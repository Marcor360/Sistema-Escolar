import { CorreccionCalidad } from '../components/CorreccionCalidad';
import { EstadoRespaldo } from '../components/EstadoRespaldo';
import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useDatos } from '../hooks/useDatos';
import { CentroPendientes } from '../components/CentroPendientes';
import { PreferenciasSesiones } from '../components/PreferenciasSesiones';
import { ConciliacionBancaria } from '../components/ConciliacionBancaria';
import { useConfirmacion } from '../components/useConfirmacion';
interface Tramite {
  id: number;
  alumnoId: number;
  plantelId: number;
  tipo: string;
  detalle: string;
  estado: string;
  revision: number;
  responsableId: number | null;
}
function Tramites() {
  const { sesion } = useAuth(),
    alumno = sesion?.roles.includes('ALUMNO');
  const {
    datos,
    recargar,
    error: errorCarga,
  } = useDatos<Tramite[]>(() => api.get('/seguimiento/tramites').then((r) => r.data), []);
  const [tipo, setTipo] = useState('CONSTANCIA'),
    [detalle, setDetalle] = useState(''),
    [mensaje, setMensaje] = useState(''),
    [error, setError] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [historial, setHistorial] = useState<{ estado: string; mensaje: string; createdAt: string }[]>([]);
  const [seleccion, setSeleccion] = useState<Tramite | null>(null),
    [estado, setEstado] = useState('EN_REVISION');
  const clave = useRef(crypto.randomUUID()),
    confirmar = useConfirmacion();
  const crear = async (e: FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setError('');
    try {
      await api.post('/seguimiento/tramites', { clave: clave.current, tipo, detalle });
      clave.current = crypto.randomUUID();
      setDetalle('');
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  const cambiar = async (e: FormEvent) => {
    e.preventDefault();
    if (!seleccion || !(await confirmar.solicitar('¿Confirmar el cambio del trámite #' + seleccion.id + '?'))) return;
    setOcupado(true);
    setError('');
    try {
      await api.patch('/seguimiento/tramites/' + seleccion.id, {
        revision: seleccion.revision,
        estado: alumno ? 'CANCELADO' : estado,
        mensaje,
        responsableId: !alumno && estado === 'EN_REVISION' ? sesion?.sub : undefined,
      });
      setSeleccion(null);
      setHistorial([]);
      recargar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="panel">
      {confirmar.elemento}
      <h2>{alumno ? 'Mis trámites' : 'Trámites por atender'}</h2>
      <p>Solicitudes con seguimiento; resolver un trámite no emite documentos oficiales ni genera cobros.</p>
      {(error || errorCarga) && <p role="alert">{error || errorCarga}</p>}
      <button onClick={recargar} disabled={ocupado}>
        Actualizar trámites
      </button>
      {alumno && (
        <form onSubmit={crear}>
          <label>
            Tipo de solicitud
            <select value={tipo} disabled={ocupado} onChange={(e) => setTipo(e.target.value)}>
              {['CONSTANCIA', 'CORRECCION', 'DOCUMENTO'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Detalle
            <textarea
              required
              minLength={5}
              maxLength={600}
              value={detalle}
              disabled={ocupado}
              onChange={(e) => setDetalle(e.target.value)}
            />
          </label>
          <button disabled={ocupado}>Enviar solicitud</button>
        </form>
      )}
      {datos.map((t) => (
        <article key={t.id}>
          <h3>
            Folio #{t.id} · {t.tipo} · {t.estado}
          </h3>
          <p>{t.detalle}</p>
          <p>
            {!alumno && 'Alumno ' + t.alumnoId + ' · Plantel ' + t.plantelId + ' · '}Responsable:{' '}
            {t.responsableId ?? 'Por asignar'}
          </p>
          <button
            disabled={ocupado}
            onClick={() => {
              setSeleccion(t);
              setHistorial([]);
              void api
                .get('/seguimiento/tramites/' + t.id + '/historial')
                .then((r) => setHistorial(r.data))
                .catch((e) => setError(mensajeDeError(e)));
            }}
          >
            Consultar seguimiento
          </button>
        </article>
      ))}
      {seleccion && (
        <section>
          <h3>Seguimiento del folio #{seleccion.id}</h3>
          <ul>
            {historial.map((h, i) => (
              <li key={i}>
                {h.estado}: {h.mensaje}
              </li>
            ))}
          </ul>
          {!['RESUELTO', 'RECHAZADO', 'CANCELADO'].includes(seleccion.estado) &&
            (!alumno || seleccion.estado === 'SOLICITADO') && (
              <form onSubmit={cambiar}>
                {!alumno && (
                  <label>
                    Nuevo estado
                    <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                      <option value="EN_REVISION">En revisión — asignarme</option>
                      <option value="RESUELTO">Resuelto</option>
                      <option value="RECHAZADO">Rechazado</option>
                    </select>
                  </label>
                )}
                <label>
                  Mensaje para el alumno
                  <textarea
                    required
                    minLength={5}
                    maxLength={600}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                  />
                </label>
                <button disabled={ocupado}>{alumno ? 'Cancelar solicitud' : 'Guardar seguimiento'}</button>
              </form>
            )}
        </section>
      )}
    </section>
  );
}
function Calidad() {
  const { datos, error, recargar } = useDatos<{
    incompletos: { id: number; matricula: string }[];
    duplicados: { curp: string; cantidad: number }[];
    gruposSinNivel: { id: number; nombre: string }[];
    inscripcionesInconsistentes:{id:number;alumnoId:number;grupoId:number}[];
  }>(() => api.get('/seguimiento/calidad').then((r) => r.data), {
    incompletos: [],
    duplicados: [],
    gruposSinNivel: [],
    inscripcionesInconsistentes: [],
  });
  return (
    <section className="panel">
      <h2>Calidad de datos</h2>
      <p>
        Diagnóstico de hasta 100 resultados por categoría. Revisa el expediente antes de corregir; no se fusionan
        alumnos automáticamente.
      </p>
      {error && <p role="alert">{error}</p>}
      <button onClick={recargar}>Revisar datos</button>
      <CorreccionCalidad alumnos={datos.incompletos} alGuardar={recargar}/>
      <h3>Expedientes con CURP o teléfono pendiente</h3>
      {datos.incompletos.map((a) => (
        <p key={a.id}>
          <Link to={'/alumnos?vista=editar&id=' + a.id}>{a.matricula}</Link>
        </p>
      ))}
      <h3>CURP repetida dentro del alcance</h3>
      {datos.duplicados.map((d) => (
        <p key={d.curp}>
          {d.curp} · {d.cantidad} expedientes
        </p>
      ))}
      <h3>Inscripciones vigentes con plantel distinto al expediente</h3>
      {datos.inscripcionesInconsistentes.map(i=><p key={i.id}><Link to={'/alumnos?vista=editar&id='+i.alumnoId}>Revisar expediente e inscripción #{i.id}</Link></p>)}
      <h3>Grupos sin nivel</h3>
      {datos.gruposSinNivel.map((g) => (
        <p key={g.id}>
          <Link to={'/grupos?vista=editar&id=' + g.id}>{g.nombre}</Link>
        </p>
      ))}
    </section>
  );
}
export default function SeguimientoPage() {
  const { sesion } = useAuth();
  const administrativo = sesion?.roles.some((r) => ['ADMINISTRATIVO', 'SUPERADMIN'].includes(r));
  const fin = sesion?.roles.some((r) => ['FINANZAS', 'SUPERADMIN'].includes(r));
  return (
    <>
      <h1>Seguimiento y pendientes</h1>
      <CentroPendientes />
      {(administrativo || sesion?.roles.includes('ALUMNO')) && <Tramites />}
      {administrativo && <Calidad />}
      {fin && <ConciliacionBancaria />}
      {sesion?.roles.includes('SUPERADMIN') && <EstadoRespaldo />}
      <PreferenciasSesiones />
    </>
  );
}
