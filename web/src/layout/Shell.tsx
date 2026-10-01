import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Cargando } from '../components/Cargando';
import { Campana } from '../components/Campana';
import { archivosBase } from '../api/client';
import { useMarca } from '../marca/MarcaContext';

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
  { destino: '/configuracion', etiqueta: 'Configuración', roles: ['SUPERADMIN'] },
];

export function Shell() {
  const { sesion, logout, tieneRol } = useAuth();
  const navigate = useNavigate();
  const { marca } = useMarca();

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>
      <aside className="lateral">
        {marca.logoUrl
          ? <img className="logo-marca" src={archivosBase + marca.logoUrl} alt={marca.nombreInstitucion} />
          : <div className="monograma" aria-hidden>{marca.nombreCorto}</div>}
        <p className="lateral-titulo">{marca.nombreInstitucion}</p>
        <nav aria-label="Navegación principal">
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
      <main className="contenido" id="contenido-principal" tabIndex={-1}>
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
