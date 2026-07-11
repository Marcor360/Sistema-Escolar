import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { Shell } from './layout/Shell';

// Cada página se descarga solo cuando se visita (code splitting)
const LoginPage = lazy(() => import('./pages/Login'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const AlumnosPage = lazy(() => import('./pages/Alumnos'));
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

export default function App() {
  const { sesion, cargando } = useAuth();
  if (cargando) return null;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pago-completado" element={<PagoCompletadoPage />} />
      {sesion ? (
        <Route element={<Shell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cuenta" element={<CuentaPage />} />

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO', 'FINANZAS']} />}>
            <Route path="/alumnos" element={<AlumnosPage />} />
            <Route path="/planteles" element={<PlantelesPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['ADMINISTRATIVO']} />}>
            <Route path="/docentes" element={<DocentesPage />} />
            <Route path="/materias" element={<MateriasPage />} />
            <Route path="/grupos" element={<GruposPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['MAESTRO']} />}>
            <Route path="/maestro" element={<MaestroPage />} />
          </Route>

          <Route element={<RutaProtegida roles={['MAESTRO', 'ADMINISTRATIVO']} />}>
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
