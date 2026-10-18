import { Cargando } from './components/Cargando';
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { Shell } from './layout/Shell';

// Cada página se descarga solo cuando se visita (code splitting)
const AperturaCarteraPage = lazy(() => import('./pages/AperturaCartera'));
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
            <Route path="/alumnos" element={<AlumnosPage />} />
            <Route path="/planteles" element={<PlantelesPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'FINANZAS']} />}>
            <Route path="/operaciones" element={<OperacionesPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO']} />}>
            <Route path="/biblioteca" element={<BibliotecaPage />} />
            <Route path="/docentes" element={<DocentesPage />} />
            <Route path="/docentes/nuevo" element={<DocenteFormulario />} />
            <Route path="/docentes/:id/editar" element={<DocenteFormulario />} />
            <Route path="/materias" element={<MateriasPage />} />
            <Route path="/apertura-cartera" element={<AperturaCarteraPage />} />
            <Route path="/apertura-cartera/nueva" element={<AperturaCarteraPage />} />
            <Route path="/programas-especiales" element={<ProgramasEspecialesPage />} />
            <Route path="/programas-especiales/:id" element={<ProgramasEspecialesPage />} />
            <Route path="/programas-especiales/:id/grupos/:grupo" element={<ProgramasEspecialesPage />} />
            <Route path="/catalogos-academicos" element={<CatalogosAcademicosPage />} />
            <Route path="/catalogos-academicos/:tipo/:id" element={<CatalogosAcademicosPage />} />
            <Route path="/grupos" element={<GruposPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'MAESTRO']} />}><Route path="/recursamientos" element={<RecursamientosPage />} /><Route path="/recursamientos/:id" element={<RecursamientosPage />} /></Route>
          <Route element={<RutaProtegida roles={['MAESTRO']} />}>
            <Route path="/maestro" element={<MaestroPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['MAESTRO', 'ADMINISTRATIVO']} />}>
            <Route path="/conducta" element={<ConductaPage />} />
            <Route path="/calificaciones" element={<CalificacionesPage />} />
            <Route path="/calendario" element={<CalendarioPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO']} />}>
            <Route path="/avisos" element={<AvisosPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['FINANZAS']} />}>
            <Route path="/finanzas" element={<FinanzasPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO']} />}>
            <Route path="/analitica" element={<AnaliticaPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
