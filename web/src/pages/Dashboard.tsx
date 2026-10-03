import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensajeDeError } from '../api/client';
import { Encabezado } from '../components/Encabezado';
import { useDatos } from '../hooks/useDatos';
import { useAuth } from '../auth/AuthContext';
import { pesos, fechaHora } from '../utils/formato';

interface Evento {
  id: number;
  titulo: string;
  tipo: string;
  fechaInicio: string;
}

interface Resumen {
  alumnosActivos: number;
  docentesActivos: number;
  grupos: number;
  saldoPendiente: number;
  cargosConAdeudo: number;
  cobradoMes: number;
}

interface Plantel { id: number; nombre: string }

export default function DashboardPage() {
  const { sesion, tieneRol } = useAuth();
  const [plantelId, setPlantelId] = useState('');
  const { datos: planteles } = useDatos<Plantel[]>(
    () => api.get('/planteles/mios').then((r) => r.data),
    [],
  );
  const { datos: resumen, cargando, error, recargar, setDatos: setResumen, setError } = useDatos<Resumen | null>(
    () => api.get('/reportes/resumen').then((r) => r.data),
    null,
  );
  const filtrarPlantel = (valor: string) => {
    setPlantelId(valor);
    setError('');
    api.get('/reportes/resumen', { params: valor ? { plantelId: valor } : {} })
      .then((r) => setResumen(r.data))
      .catch((err) => setError(mensajeDeError(err)));
  };
  const hoy = new Date();
  const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const { datos: eventos } = useDatos<Evento[]>(
    () => api.get('/calendario', {
      params: { desde: hoy.toISOString(), hasta: en30dias.toISOString() },
    }).then((r) => r.data),
    [],
  );

  const metricas = resumen ? [
    { etiqueta: 'Alumnos activos', valor: resumen.alumnosActivos, nota: 'Matrícula vigente', tono: 'azul' },
    { etiqueta: 'Docentes activos', valor: resumen.docentesActivos, nota: 'Equipo académico', tono: 'verde' },
    { etiqueta: 'Grupos', valor: resumen.grupos, nota: 'Grupos registrados', tono: 'dorado' },
    { etiqueta: 'Cobrado este mes', valor: pesos(resumen.cobradoMes), nota: 'Ingresos del mes', tono: 'verde', dinero: true },
    { etiqueta: 'Saldo pendiente', valor: pesos(resumen.saldoPendiente), nota: 'Por cobrar', tono: 'rojo', dinero: true },
    { etiqueta: 'Cargos con adeudo', valor: resumen.cargosConAdeudo, nota: 'Requieren seguimiento', tono: 'dorado' },
  ] : [];

  const accesos = [
    ...(tieneRol('ADMINISTRATIVO') ? [
      { ruta: '/alumnos', titulo: 'Alumnos', detalle: 'Consulta y administra la matrícula' },
      { ruta: '/grupos', titulo: 'Grupos', detalle: 'Organiza grupos y ciclos escolares' },
      { ruta: '/calendario', titulo: 'Calendario', detalle: 'Revisa fechas y actividades' },
    ] : []),
    ...(tieneRol('FINANZAS') ? [
      { ruta: '/finanzas', titulo: 'Finanzas', detalle: 'Da seguimiento a cargos y pagos' },
      { ruta: '/alumnos', titulo: 'Alumnos', detalle: 'Consulta datos de familias' },
    ] : []),
    ...(tieneRol('MAESTRO') ? [
      { ruta: '/maestro', titulo: 'Mis clases', detalle: 'Consulta tus grupos y materias' },
      { ruta: '/calificaciones', titulo: 'Calificaciones', detalle: 'Captura y revisa evaluaciones' },
      { ruta: '/calendario', titulo: 'Calendario', detalle: 'Revisa fechas y actividades' },
    ] : []),
    ...(tieneRol('SUPERADMIN') ? [
      { ruta: '/configuracion', titulo: 'Configuración', detalle: 'Administra la identidad institucional' },
    ] : []),
  ].slice(0, 3);

  return (
    <>
      <div className="panel-bienvenida">
        <div>
          <p className="sobrelinea">PANEL DE CONTROL</p>
          <Encabezado titulo={`Hola${sesion?.nombre ? `, ${sesion.nombre.split(' ')[0]}` : ''}`} detalle="Aquí tienes el resumen de actividad de tu comunidad escolar." />
        </div>
        {planteles.length > 1 && (
          <div className="campo filtro-plantel">
            <label htmlFor="filtro-plantel">Plantel</label>
            <select id="filtro-plantel" value={plantelId} onChange={(e) => filtrarPlantel(e.target.value)}>
              <option value="">Todos mis planteles</option>
              {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      <section className="seccion-dashboard" aria-labelledby="titulo-resumen">
        <div className="titulo-seccion">
          <div>
            <h2 id="titulo-resumen">Resumen general</h2>
            <p>Indicadores de tu plantel</p>
          </div>
        </div>
        {cargando && <p className="estado-dashboard" role="status">Cargando indicadores…</p>}
        {error && (
          <div className="mensaje-error" role="alert">
            <span>{error}</span> <button className="boton secundario chico" onClick={recargar}>Reintentar</button>
          </div>
        )}
        {resumen && (
          <div className="kpis kpis-dashboard">
            {metricas.map((metrica) => (
              <article className={`kpi kpi-${metrica.tono}`} key={metrica.etiqueta}>
                <p className="etiqueta">{metrica.etiqueta}</p>
                <p className={`valor${metrica.dinero ? ' monto' : ''}`}>{metrica.valor}</p>
                <p className="kpi-nota">{metrica.nota}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="dashboard-columnas">
        <section className="panel panel-eventos" aria-labelledby="titulo-eventos">
          <div className="panel-cabecera">
            <div>
              <p className="sobrelinea">LO QUE SIGUE</p>
              <h2 id="titulo-eventos">Próximos eventos</h2>
            </div>
            <span className="rango-eventos">Próximos 30 días</span>
          </div>
          {eventos.length > 0 ? (
            <div className="lista-eventos">
              {eventos.slice(0, 5).map((ev) => (
                <article className="evento" key={ev.id}>
                  <div className="evento-fecha"><span>{fechaHora(ev.fechaInicio)}</span></div>
                  <div className="evento-contenido">
                    <h3>{ev.titulo}</h3>
                    <span className="sello neutro">{ev.tipo}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="vacio-eventos">
              <span className="vacio-icono" aria-hidden="true">✳</span>
              <h3>Tu agenda está despejada</h3>
              <p>Los eventos de los próximos 30 días aparecerán aquí.</p>
              {tieneRol('ADMINISTRATIVO', 'MAESTRO') && <Link to="/calendario" className="enlace-dashboard">Ir al calendario <span aria-hidden="true">→</span></Link>}
            </div>
          )}
        </section>

        {accesos.length > 0 && (
          <section className="panel panel-accesos" aria-labelledby="titulo-accesos">
            <div className="panel-cabecera">
              <div>
                <p className="sobrelinea">ATAJOS</p>
                <h2 id="titulo-accesos">Acceso rápido</h2>
              </div>
            </div>
            <div className="lista-accesos">
              {accesos.map((acceso) => (
                <Link className="acceso-rapido" to={acceso.ruta} key={acceso.ruta}>
                  <span><strong>{acceso.titulo}</strong><small>{acceso.detalle}</small></span>
                  <span className="acceso-flecha" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
