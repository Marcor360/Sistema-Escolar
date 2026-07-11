import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Cargando } from '../components/Cargando';
import { Campana } from '../components/Campana';

const secciones = [
  { destino: '/', etiqueta: 'Panel', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
  { destino: '/alumnos', etiqueta: 'Alumnos', roles: ['ADMINISTRATIVO', 'FINANZAS'] },
  { destino: '/planteles', etiqueta: 'Planteles', roles: ['ADMINISTRATIVO', 'FINANZAS'] },
  { destino: '/docentes', etiqueta: 'Docentes', roles: ['ADMINISTRATIVO'] },
  { destino: '/materias', etiqueta: 'Materias', roles: ['ADMINISTRATIVO'] },
  { destino: '/grupos', etiqueta: 'Grupos', roles: ['ADMINISTRATIVO'] },
  { destino: '/maestro', etiqueta: 'Mis clases', roles: ['MAESTRO'] },
  { destino: '/calificaciones', etiqueta: 'Calificaciones', roles: ['MAESTRO', 'ADMINISTRATIVO'] },
  { destino: '/calendario', etiqueta: 'Calendario', roles: ['MAESTRO', 'ADMINISTRATIVO'] },
  { destino: '/avisos', etiqueta: 'Avisos', roles: ['ADMINISTRATIVO'] },
  { destino: '/finanzas', etiqueta: 'Finanzas', roles: ['FINANZAS'] },
  { destino: '/usuarios', etiqueta: 'Usuarios', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
];

export function Shell() {
  const { sesion, logout, tieneRol } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="lateral">
        <div className="monograma" aria-hidden>SE</div>
        <p className="lateral-titulo">Sistema Escolar</p>
        <nav>
          {secciones
            .filter((s) => tieneRol(...s.roles))
            .map((s) => (
              <NavLink key={s.destino} to={s.destino} end={s.destino === '/'}>
                {s.etiqueta}
              </NavLink>
            ))}
        </nav>
        <div className="lateral-pie">
          <p>{sesion?.nombre}</p>
          <NavLink to="/cuenta" className="pie-enlace">Mi cuenta</NavLink>
          <p className="rol">{sesion?.roles.join(' · ')}</p>
          <button
            className="boton fantasma"
            onClick={() => { logout(); navigate('/login'); }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="contenido">
        <div className="barra-superior">
          <Campana />
        </div>
        <Suspense fallback={<Cargando />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
