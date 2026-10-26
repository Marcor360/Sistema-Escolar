import { ModuloTrabajo } from './components/ModuloTrabajo';
import { Cargando } from './components/Cargando';
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { Shell } from './layout/Shell';

// Cada página se descarga solo cuando se visita (code splitting)
const TemariosPage = lazy(() => import('./pages/Temarios'));
const CicloFichaPage = lazy(() => import('./pages/CicloFicha'));
const AperturaCarteraPage = lazy(() => import('./pages/AperturaCartera'));
const ReinscribirAlumnoPage = lazy(() => import('./pages/ReinscribirAlumno'));
const RecursamientosPage = lazy(() => import('./pages/Recursamientos'));
const ProgramasEspecialesPage = lazy(() => import('./pages/ProgramasEspeciales'));
const CatalogosAcademicosPage = lazy(() => import('./pages/CatalogosAcademicos'));
const BibliotecaPage = lazy(() => import('./pages/Biblioteca'));
const OperacionesPage = lazy(() => import('./pages/Operaciones'));
const ConductaPage = lazy(() => import('./pages/Conducta'));
const AnaliticaPage = lazy(() => import('./pages/Analitica'));
const LoginPage = lazy(() => import('./pages/Login'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const AlumnosPage = lazy(() => import('./pages/Alumnos'));
const DocenteFormulario = lazy(() => import('./pages/DocenteFormulario'));
const DocentesPage = lazy(() => import('./pages/Docentes'));
const MateriasPage = lazy(() => import('./pages/Materias'));
const GruposPage = lazy(() => import('./pages/Grupos'));
const MaestroPage = lazy(() => import('./pages/Maestro'));
const CalificacionesPage = lazy(() => import('./pages/Calificaciones'));
const FinanzasPage = lazy(() => import('./pages/Finanzas'));
const UsuariosPage = lazy(() => import('./pages/Usuarios'));
const PagoCompletadoPage = lazy(() => import('./pages/PagoCompletado'));
const CalendarioPage = lazy(() => import('./pages/Calendario'));
const AvisosPage = lazy(() => import('./pages/Avisos'));
const CuentaPage = lazy(() => import('./pages/Cuenta'));
const PlantelesPage = lazy(() => import('./pages/Planteles'));
const ConfiguracionPage = lazy(() => import('./pages/Configuracion'));

export default function App() {
  const { sesion, cargando, errorInicio } = useAuth();
  if (cargando) return <Cargando />;
  if (errorInicio) return (
    <main className="login-fondo">
      <div className="login-caja">
        <h1>No se pudo comprobar tu sesión</h1>
        <p role="alert">Revisa la conexión con el servidor e inténtalo de nuevo.</p>
        <button className="boton" onClick={() => location.reload()}>Reintentar</button>
      </div>
    </main>
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pago-completado" element={<PagoCompletadoPage />} />
      {sesion ? (
        <Route element={<Shell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cuenta" element={<CuentaPage />} />

          <Route element={<RutaProtegida roles={['SUPERADMIN']} />}>
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'FINANZAS']} />}>
            <Route path="/alumnos" element={<ModuloTrabajo titulo="Alumnos" acciones={[{titulo:'Registrar alumno',detalle:'Crear expediente e invitar por correo',vista:'nuevo',roles:['FINANZAS','SUPERADMIN']},{titulo:'Consultar alumnos',detalle:'Buscar, editar, revisar historial o gestionar bajas',vista:'consulta'}]} vistas={['editar']} permisos={{editar:['ADMINISTRATIVO']}}><AlumnosPage /></ModuloTrabajo>} />
            <Route path="/planteles" element={<ModuloTrabajo titulo="Planteles" acciones={[{titulo:'Registrar plantel',detalle:'Crear una sede',vista:'nuevo',roles:['SUPERADMIN']},{titulo:'Consultar planteles',detalle:'Buscar sedes, revisar director y personal',vista:'consulta'}]} vistas={['editar', 'detalle']} permisos={{editar:['SUPERADMIN']}}><PlantelesPage /></ModuloTrabajo>} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'FINANZAS']} />}>
            <Route path="/operaciones" element={<ModuloTrabajo titulo="Importar y promover" acciones={[{titulo:'Importar expedientes',detalle:'Previsualizar y confirmar CSV o Excel',vista:'importar'},{titulo:'Promover alumnos',detalle:'Promoción autorizada entre ciclos',vista:'promover',roles:['ADMINISTRATIVO']},{titulo:'Consultar bitácora',detalle:'Operaciones académicas auditadas',vista:'consulta',roles:['ADMINISTRATIVO']}]}><OperacionesPage /></ModuloTrabajo>} />
          </Route>

          <Route element={<RutaProtegida roles={['ALUMNO','MAESTRO','ADMINISTRATIVO','FINANZAS']} />}>
            <Route path="/calendario" element={<ModuloTrabajo titulo="Calendario" acciones={[{titulo:'Consultar calendario',detalle:'Buscar eventos por intervalo y plantel',vista:'consulta'},{titulo:'Registrar evento',detalle:'Agregar un evento autorizado',vista:'nuevo',roles:['MAESTRO','ADMINISTRATIVO','FINANZAS']}]} vistas={['editar']}><CalendarioPage /></ModuloTrabajo>} />
          </Route>
          <Route element={<RutaProtegida roles={['ADMINISTRATIVO']} />}>
            <Route path="/biblioteca" element={<ModuloTrabajo titulo="Biblioteca" acciones={[{titulo:'Consultar biblioteca',detalle:'Consultar carpetas y archivos privados',vista:'consulta'},{titulo:'Crear carpeta',detalle:'Organizar documentos por plantel',vista:'carpeta-nueva'},{titulo:'Subir archivo',detalle:'Validar y guardar un archivo privado',vista:'archivo-nuevo'}]}><BibliotecaPage /></ModuloTrabajo>} />
            <Route path="/docentes" element={<DocentesPage />} />
            <Route path="/docentes/nuevo" element={<DocenteFormulario />} />
            <Route path="/docentes/:id/editar" element={<DocenteFormulario />} />
            <Route path="/materias" element={<ModuloTrabajo titulo="Materias y ciclos" acciones={[{titulo:'Registrar materia',detalle:'Clasificación y créditos',vista:'nuevo'},{titulo:'Consultar materias',detalle:'Buscar, editar y vincular planes y periodos',vista:'consulta'},{titulo:'Consultar ciclos',detalle:'Revisar preparación, activación y cierre',vista:'ciclos'},{titulo:'Preparar ciclo',detalle:'Registrar fechas sin activar el ciclo',vista:'ciclo-nuevo'}]} vistas={['editar', 'ciclo-editar', 'contextos']}><MateriasPage /></ModuloTrabajo>} />
            <Route path="/apertura-cartera" element={<AperturaCarteraPage />} />
            <Route path="/apertura-cartera/nueva" element={<AperturaCarteraPage />} />
            <Route path="/apertura-cartera/reinscribir" element={<ReinscribirAlumnoPage />} />
            <Route path="/programas-especiales" element={<ProgramasEspecialesPage />} />
            <Route path="/programas-especiales/:id" element={<ProgramasEspecialesPage />} />
            <Route path="/programas-especiales/:id/grupos/:grupo" element={<ProgramasEspecialesPage />} />
            <Route path="/catalogos-academicos" element={<CatalogosAcademicosPage />} />
            <Route path="/catalogos-academicos/:tipo/:id" element={<CatalogosAcademicosPage />} />
            <Route path="/grupos" element={<ModuloTrabajo titulo="Grupos" acciones={[{titulo:'Registrar grupo',detalle:'Preparar un grupo independiente del alta de alumnos',vista:'nuevo'},{titulo:'Consultar grupos',detalle:'Buscar, asignar materias/docentes e inscribir alumnos',vista:'consulta'}]} vistas={['editar', 'administrar']}><GruposPage /></ModuloTrabajo>} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'MAESTRO']} />}><Route path="/recursamientos" element={<RecursamientosPage />} /><Route path="/recursamientos/:id" element={<RecursamientosPage />} /></Route>
          <Route element={<RutaProtegida roles={['MAESTRO']} />}>
            <Route path="/maestro" element={<ModuloTrabajo titulo="Mis clases" acciones={[{titulo:'Consultar mis clases',detalle:'Abrir las operaciones disponibles según tu alcance',vista:'consulta'}]} vistas={['clase','actividades','actividad-nueva','actividad-editar','materiales','material-nuevo','material-editar','entregas','calificar-entrega']}><MaestroPage /></ModuloTrabajo>} />
          </Route>

          <Route element={<RutaProtegida roles={['MAESTRO', 'ADMINISTRATIVO', 'FINANZAS']} />}><Route path="/ciclos/:id" element={<CicloFichaPage />} /></Route>
          <Route element={<RutaProtegida roles={['MAESTRO', 'ADMINISTRATIVO']} />}>
            <Route path="/temarios" element={<ModuloTrabajo titulo="Temarios" acciones={[{titulo:'Consultar temarios',detalle:'Consultar temas de una clase y su publicación',vista:'consulta'},{titulo:'Crear tema',detalle:'Preparar contenido independiente de tareas',vista:'nuevo'}]} vistas={['detalle','editar','adjuntar']}><TemariosPage /></ModuloTrabajo>} />
            <Route path="/conducta" element={<ModuloTrabajo titulo="Conducta" acciones={[{titulo:'Consultar incidencias',detalle:'Historial y seguimiento interno por ciclo',vista:'consulta'},{titulo:'Registrar incidencia',detalle:'Registrar una nota interna de alumno inscrito',vista:'nuevo'}]} vistas={['seguimiento']}><ConductaPage /></ModuloTrabajo>} />
            <Route path="/calificaciones" element={<ModuloTrabajo titulo="Calificaciones" acciones={[{titulo:'Consultar calificaciones',detalle:'Notas, reportes e historial autorizado',vista:'consulta'},{titulo:'Capturar calificaciones',detalle:'Registrar o corregir notas con justificación',vista:'nuevo'},{titulo:'Importar calificaciones',detalle:'Previsualizar y confirmar un lote',vista:'importar'}]}><CalificacionesPage /></ModuloTrabajo>} />

          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO']} />}>
            <Route path="/avisos" element={<ModuloTrabajo titulo="Avisos" acciones={[{titulo:'Redactar aviso',detalle:'Preparar y enviar un comunicado autorizado',vista:'nuevo'}]}><AvisosPage /></ModuloTrabajo>} />
          </Route>

          <Route element={<RutaProtegida roles={['FINANZAS']} />}>
            <Route path="/finanzas/reinscribir" element={<ReinscribirAlumnoPage />} />
            <Route path="/finanzas" element={<ModuloTrabajo titulo="Finanzas" acciones={[{titulo:'Reinscribir alumno',detalle:'Avanzar a nuevo ciclo desde un expediente existente y cotizar la nueva cartera',vista:'reinscribir'}, {titulo:'Indicadores de cobranza',detalle:'Ingresos, alumnos con saldo y evolución por mes',vista:'indicadores'}, {titulo:'Seguimiento de alumnos sin pago',detalle:'Consultar contactos y programar avisos institucionales',vista:'contactos'}, {titulo:'Consultar cargos',detalle:'Consultar y corregir cargos existentes',vista:'cargos'},{titulo:'Asignar cargos adicionales',detalle:'Titulación, certificados, recursamiento y otros servicios autorizados (sin colegiaturas)',vista:'cargo-nuevo'},{titulo:'Fichas BBVA y registro de depósitos',detalle:'Emitir fichas PDF por cargo y aplicar pagos cotejados',vista:'fichas'}, {titulo:'Programar colegiaturas y pagos',detalle:'Previsualizar anualidad, semestres, cuatrimestre o cuotas de un concepto adicional',vista:'programaciones'}, {titulo:'Generar colegiaturas',detalle:'Previsualizar y confirmar por plantel',vista:'colegiaturas'},{titulo:'Consultar pagos',detalle:'Consultar y anular pagos según permisos',vista:'pagos'},{titulo:'Registrar pago',detalle:'Registrar una operación con idempotencia',vista:'pago-nuevo'},{titulo:'Adeudos y cobranza',detalle:'Consultar saldos, exportar y enviar avisos',vista:'adeudos'},{titulo:'Conciliación',detalle:'Resolver incidencias y consultar auditoría',vista:'conciliacion'},{titulo:'Catálogo de conceptos',detalle:'Administrar conceptos y tarifas',vista:'conceptos'}]} vistas={[]}><FinanzasPage /></ModuloTrabajo>} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO']} />}>
            <Route path="/analitica" element={<ModuloTrabajo titulo="Analítica" acciones={[{titulo:'Consultar indicadores',detalle:'Abrir las operaciones disponibles según tu alcance',vista:'consulta'}]}><AnaliticaPage /></ModuloTrabajo>} />
            <Route path="/usuarios" element={<ModuloTrabajo titulo="Usuarios" acciones={[{titulo:'Registrar personal',detalle:'Crear cuenta y asignar alcance',vista:'nuevo',roles:['SUPERADMIN']},{titulo:'Consultar usuarios',detalle:'Buscar expedientes y gestionar cuentas según permisos',vista:'consulta'}]} vistas={['editar']} permisos={{editar:['SUPERADMIN']}}><UsuariosPage /></ModuloTrabajo>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
