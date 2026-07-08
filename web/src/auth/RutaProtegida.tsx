import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Restringe un grupo de rutas a ciertos roles (SUPERADMIN siempre pasa).
 * La API valida de nuevo en el servidor; esto evita exponer vistas sin permiso.
 */
export function RutaProtegida({ roles }: { roles: string[] }) {
  const { tieneRol } = useAuth();
  return tieneRol(...roles) ? <Outlet /> : <Navigate to="/" replace />;
}
