import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Cargando } from '../components/Cargando';
import { Campana } from '../components/Campana';
import { archivosBase } from '../api/client';
import { useMarca } from '../marca/MarcaContext';
import { IconoTabler, type NombreIcono } from '../components/IconoTabler';

const secciones = [
  { destino: '/operaciones', etiqueta: 'Importar y promover', roles: ['ADMINISTRATIVO'] },
  { destino: '/conducta', etiqueta: 'Conducta e incidencias', roles: ['ADMINISTRATIVO', 'MAESTRO'] },
  { destino: '/analitica', etiqueta: 'Analítica', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
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

const iconosPorRuta: Record<string, NombreIcono> = {
  '/': 'layout-dashboard',
  '/operaciones': 'clipboard-check',
  '/conducta': 'clipboard-check',
  '/analitica': 'chart-bar',
  '/alumnos': 'users',
  '/planteles': 'building',
  '/docentes': 'school',
  '/materias': 'book',
  '/grupos': 'users',
  '/maestro': 'school',
  '/calificaciones': 'clipboard-check',
  '/calendario': 'calendar',
  '/avisos': 'bell',
  '/finanzas': 'coins',
  '/usuarios': 'users',
  '/configuracion': 'settings',
};

export function Shell() {
  const { sesion, logout, tieneRol } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { marca } = useMarca();
  const [errorCierre, setErrorCierre] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [logoFallo, setLogoFallo] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrarMenu = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);

  useEffect(() => { setMenuAbierto(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuAbierto) return;
    const consulta = window.matchMedia('(max-width: 800px)');
    if (!consulta.matches) return;
    const desplazamientoAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const cerrarEnEscritorio = () => {
      if (!consulta.matches) setMenuAbierto(false);
    };
    consulta.addEventListener('change', cerrarEnEscritorio);
    return () => {
      document.body.style.overflow = desplazamientoAnterior;
      consulta.removeEventListener('change', cerrarEnEscritorio);
    };
  }, [menuAbierto]);
  useEffect(() => { setLogoFallo(false); }, [marca.logoUrl]);
  useEffect(() => {
    if (!menuAbierto) return;
    botonCerrarMenu.current?.focus();
    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
        botonMenu.current?.focus();
        return;
      }
      if (evento.key !== 'Tab' || !window.matchMedia('(max-width: 800px)').matches) return;
      const elementos = Array.from(lateral.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
      if (!elementos.length) return;
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [menuAbierto]);

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido-principal">Saltar al contenido principal</a>
      {menuAbierto && <button type="button" className="menu-fondo" aria-label="Cerrar navegación" onClick={() => { setMenuAbierto(false); botonMenu.current?.focus(); }} />}
      <aside ref={lateral} className={`lateral${menuAbierto ? ' lateral-abierto' : ''}`} role={menuAbierto ? 'dialog' : undefined} aria-modal={menuAbierto ? true : undefined} aria-label="Menú principal">
        <button ref={botonCerrarMenu} type="button" className="menu-cerrar" onClick={() => { setMenuAbierto(false); botonMenu.current?.focus(); }}>Cerrar menú <IconoTabler nombre="x" /></button>
        {marca.logoUrl && !logoFallo
          ? <img className="logo-marca" src={archivosBase + marca.logoUrl} alt={marca.nombreInstitucion} onError={() => setLogoFallo(true)} />
          : <div className="monograma" aria-hidden>{marca.nombreCorto}</div>}
        <p className="lateral-titulo" title={marca.nombreInstitucion}>{marca.nombreInstitucion}</p>
        <div className="menu-panel">
          <nav id="navegacion-escolar" aria-label="Navegación principal">
            {secciones
              .filter((s) => tieneRol(...s.roles))
              .map((s) => (
                <NavLink key={s.destino} to={s.destino} end={s.destino === '/'} onClick={() => { setMenuAbierto(false); document.getElementById('contenido-principal')?.focus(); }}>
                  <IconoTabler nombre={iconosPorRuta[s.destino]} />
                  <span>{s.etiqueta}</span>
                </NavLink>
              ))}
          </nav>
          <div className="lateral-pie">
            <p>{sesion?.nombre}</p>
            <NavLink to="/cuenta" className="pie-enlace">Mi cuenta</NavLink>
            <p className="rol">{sesion?.roles.join(' · ')}</p>
            {errorCierre && <p className="mensaje-error" role="alert">{errorCierre}</p>}
            <button
              className="boton fantasma"
              onClick={async () => {
                setErrorCierre('');
                try {
                  await logout();
                  navigate('/login');
                } catch {
                  setErrorCierre('No se pudo cerrar la sesión en el servidor. Inténtalo de nuevo.');
                }
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <main className="contenido" id="contenido-principal" tabIndex={-1}>
        <div className="barra-superior">
          <button ref={botonMenu} type="button" className="menu-movil" aria-label="Abrir menú" aria-expanded={menuAbierto} aria-controls="navegacion-escolar" onClick={() => setMenuAbierto((abierto) => !abierto)}><IconoTabler nombre="menu-2" /> <span>Menú</span></button>
          <span className="barra-contexto">Espacio de trabajo <strong>{sesion?.roles.join(' · ')}</strong></span>
          <Campana />
        </div>
        <Suspense fallback={<Cargando />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
