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
  const rolPrincipal = sesion?.roles.includes('SUPERADMIN') ? 'SUPERADMIN'
    : sesion?.roles.includes('ADMINISTRATIVO') ? 'ADMINISTRATIVO'
    : sesion?.roles.includes('FINANZAS') ? 'FINANZAS' : 'MAESTRO';
  const contextoRol = {
    SUPERADMIN: { titulo: 'Supervisión institucional', detalle: 'Configuración, indicadores y seguimiento de la institución.' },
    ADMINISTRATIVO: { titulo: 'Control escolar', detalle: 'Consulta alumnos, docentes, grupos y próximas actividades.' },
    FINANZAS: { titulo: 'Gestión financiera', detalle: 'Revisa cobranza, saldos pendientes y operaciones financieras.' },
    MAESTRO: { titulo: 'Espacio docente', detalle: 'Accede a tus clases, evaluaciones y actividades del calendario.' },
  }[rolPrincipal];
  const puedeVerResumen = tieneRol('SUPERADMIN', 'ADMINISTRATIVO', 'FINANZAS');
  const { datos: planteles } = useDatos<Plantel[]>(
    () => api.get('/planteles/mios').then((r) => r.data),
    [],
  );
  const { datos: resumen, cargando, error, recargar, setDatos: setResumen, setError } = useDatos<Resumen | null>(
    () => puedeVerResumen ? api.get('/reportes/resumen').then((r) => r.data) : Promise.resolve(null),
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

  const metricasVisibles = metricas.filter((metrica) =>
    rolPrincipal === 'SUPERADMIN' ||
    (rolPrincipal === 'FINANZAS' ? ['Cobrado este mes', 'Saldo pendiente', 'Cargos con adeudo'].includes(metrica.etiqueta) :
      ['Alumnos activos', 'Docentes activos', 'Grupos'].includes(metrica.etiqueta)),
  );

  const accesos = [
    ...(rolPrincipal === 'ADMINISTRATIVO' ? [
      { ruta: '/operaciones', titulo: 'Importar alumnos', detalle: 'Carga masiva y revisión previa de registros' },
      { ruta: '/alumnos', titulo: 'Alumnos', detalle: 'Consulta y administra la matrícula' },
      { ruta: '/grupos', titulo: 'Grupos', detalle: 'Organiza grupos y ciclos escolares' },
      { ruta: '/calendario', titulo: 'Calendario', detalle: 'Revisa fechas y actividades' },
    ] : []),
    ...(rolPrincipal === 'FINANZAS' ? [
      { ruta: '/finanzas', titulo: 'Finanzas', detalle: 'Da seguimiento a cargos y pagos' },
      { ruta: '/alumnos', titulo: 'Alumnos', detalle: 'Consulta datos de familias' },
    ] : []),
    ...(rolPrincipal === 'MAESTRO' ? [
      { ruta: '/maestro', titulo: 'Mis clases', detalle: 'Consulta tus grupos y materias' },
      { ruta: '/calificaciones', titulo: 'Calificaciones', detalle: 'Captura y revisa evaluaciones' },
      { ruta: '/calendario', titulo: 'Calendario', detalle: 'Revisa fechas y actividades' },
    ] : []),
    ...(rolPrincipal === 'SUPERADMIN' ? [
      { ruta: '/configuracion', titulo: 'Configuración', detalle: 'Administra la identidad institucional' },
    ] : []),
  ].slice(0, 3);

  return (
    <>
      <div className="panel-bienvenida">
        <div>
          <p className="sobrelinea">{contextoRol.titulo.toUpperCase()}</p>
          <Encabezado titulo={`Hola${sesion?.nombre ? `, ${sesion.nombre.split(' ')[0]}` : ''}`} detalle={contextoRol.detalle} />
        </div>
        {puedeVerResumen && planteles.length > 1 && (
          <div className="campo filtro-plantel">
            <label htmlFor="filtro-plantel">Plantel</label>
            <select id="filtro-plantel" value={plantelId} onChange={(e) => filtrarPlantel(e.target.value)}>
              <option value="">Todos mis planteles</option>
              {planteles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      {puedeVerResumen && <section className="seccion-dashboard" aria-labelledby="titulo-resumen">
        <div className="titulo-seccion">
          <div>
            <h2 id="titulo-resumen">{rolPrincipal === 'FINANZAS' ? 'Resumen financiero' : 'Resumen general'}</h2>
            <p>{rolPrincipal === 'FINANZAS' ? 'Cobranza y saldos de tus planteles' : 'Indicadores de tu plantel'}</p>
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
            {metricasVisibles.map((metrica) => (
              <article className={`kpi kpi-${metrica.tono}`} key={metrica.etiqueta}>
                <p className="etiqueta">{metrica.etiqueta}</p>
                <p className={`valor${metrica.dinero ? ' monto' : ''}`}>{metrica.valor}</p>
                <p className="kpi-nota">{metrica.nota}</p>
              </article>
            ))}
          </div>
        )}
      </section>}

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
