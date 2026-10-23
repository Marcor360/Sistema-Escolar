import { esFormularioModulo } from '../components/ModuloTrabajo';
import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Cargando } from '../components/Cargando';
import { Campana } from '../components/Campana';
import { archivosBase } from '../api/client';
import { useMarca } from '../marca/MarcaContext';
import { IconoTabler, type NombreIcono } from '../components/IconoTabler';
import { RecorridoInicial } from '../components/RecorridoInicial';
import { construirRecorrido } from '../components/recorrido-por-rol';

const secciones = [
  { destino: '/biblioteca', etiqueta: 'Biblioteca', roles: ['ADMINISTRATIVO'] },
  { destino: '/operaciones', etiqueta: 'Importar y promover', roles: ['ADMINISTRATIVO'] },
  { destino: '/conducta', etiqueta: 'Conducta e incidencias', roles: ['ADMINISTRATIVO', 'MAESTRO'] },
  { destino: '/analitica', etiqueta: 'Analítica', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
  { destino: '/', etiqueta: 'Panel', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
  { destino: '/alumnos', etiqueta: 'Alumnos', roles: ['ADMINISTRATIVO', 'FINANZAS'] },
  { destino: '/planteles', etiqueta: 'Planteles', roles: ['ADMINISTRATIVO', 'FINANZAS'] },
  { destino: '/docentes', etiqueta: 'Docentes', roles: ['ADMINISTRATIVO'] },
  { destino: '/apertura-cartera', etiqueta: 'Apertura de cartera', roles: ['ADMINISTRATIVO'] },
  { destino: '/recursamientos', etiqueta: 'Recursamientos', roles: ['ADMINISTRATIVO'] },
  { destino: '/programas-especiales', etiqueta: 'Programas especiales', roles: ['ADMINISTRATIVO'] },
  { destino: '/catalogos-academicos', etiqueta: 'Catálogos académicos', roles: ['ADMINISTRATIVO'] },
  { destino: '/materias', etiqueta: 'Materias', roles: ['ADMINISTRATIVO'] },
  { destino: '/grupos', etiqueta: 'Grupos', roles: ['ADMINISTRATIVO'] },
  { destino: '/temarios', etiqueta: 'Temarios', roles: ['MAESTRO', 'ADMINISTRATIVO'] },
  { destino: '/maestro', etiqueta: 'Mis clases', roles: ['MAESTRO'] },
  { destino: '/calificaciones', etiqueta: 'Calificaciones', roles: ['MAESTRO', 'ADMINISTRATIVO'] },
  { destino: '/calendario', etiqueta: 'Calendario', roles: ['MAESTRO', 'ADMINISTRATIVO'] },
  { destino: '/avisos', etiqueta: 'Avisos', roles: ['ADMINISTRATIVO'] },
  { destino: '/finanzas', etiqueta: 'Finanzas', roles: ['FINANZAS'] },
  { destino: '/usuarios', etiqueta: 'Usuarios', roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO'] },
  { destino: '/configuracion', etiqueta: 'Configuración', roles: ['SUPERADMIN'] },
];

const gruposMenu = [
  { titulo: 'Inicio y seguimiento', rutas: ['/', '/calendario', '/avisos'] },
  { titulo: 'Control escolar', rutas: ['/alumnos', '/docentes', '/catalogos-academicos', '/apertura-cartera', '/recursamientos', '/programas-especiales', '/materias', '/grupos', '/operaciones'] },
  { titulo: 'Docencia', rutas: ['/maestro', '/temarios', '/calificaciones', '/conducta'] },
  { titulo: 'Finanzas e informes', rutas: ['/finanzas', '/analitica'] },
  { titulo: 'Administración', rutas: ['/planteles', '/biblioteca', '/usuarios', '/configuracion'] },
];

const iconosPorRuta: Record<string, NombreIcono> = {
  '/': 'layout-dashboard',
  '/biblioteca': 'book',
  '/operaciones': 'clipboard-check',
  '/conducta': 'clipboard-check',
  '/analitica': 'chart-bar',
  '/alumnos': 'users',
  '/planteles': 'building',
  '/docentes': 'school',
  '/materias': 'book',
  '/catalogos-academicos': 'book',
  '/apertura-cartera': 'coins',
  '/recursamientos': 'clipboard-check',
  '/programas-especiales': 'school',
  '/grupos': 'users',
  '/maestro': 'school',
  '/temarios': 'book',
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
  const pasosRecorrido = construirRecorrido(gruposMenu, secciones, sesion?.roles ?? []);
  const [errorCierre, setErrorCierre] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sinConexion, setSinConexion] = useState(() => navigator.onLine === false);
  const [logoFallo, setLogoFallo] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrarMenu = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);
  const contenido = useRef<HTMLElement>(null);
  const saltoContenido = useRef<HTMLAnchorElement>(null);
  const enfocarContenido = useRef(false);
  const menuAnterior = useRef(false);

  useEffect(() => {
    const actualizar = () => setSinConexion(navigator.onLine === false);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  const navegarDesdeMenu = () => {
    if (!menuAbierto) return;
    enfocarContenido.current = true;
    setMenuAbierto(false);
  };

  useEffect(() => {
    if (contenido.current) contenido.current.inert = menuAbierto;
    if (saltoContenido.current) saltoContenido.current.inert = menuAbierto;
    if (!menuAbierto && enfocarContenido.current) {
      enfocarContenido.current = false;
      contenido.current?.focus();
    } else if (!menuAbierto && menuAnterior.current) {
      if (window.matchMedia('(max-width: 800px)').matches) botonMenu.current?.focus();
      else lateral.current?.querySelector<HTMLElement>('a.active, a[href]')?.focus();
    }
    menuAnterior.current = menuAbierto;
  }, [menuAbierto]);

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);
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
  useEffect(() => {
    setLogoFallo(false);
  }, [marca.logoUrl]);
  useEffect(() => {
    if (!menuAbierto) return;
    botonCerrarMenu.current?.focus();
    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setMenuAbierto(false);
        return;
      }
      if (evento.key !== 'Tab' || !window.matchMedia('(max-width: 800px)').matches) return;
      const elementos = Array.from(
        lateral.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      );
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

  // Alta y edición tienen el mismo control de sesión/rol y un área sin navegación lateral.
  if (location.pathname === '/recursamientos/nuevo' || location.pathname === '/apertura-cartera/nueva' || /^\/programas-especiales\/(nuevo|\d+\/grupos\/nuevo)\/?$/.test(location.pathname) || /^\/docentes\/(nuevo|\d+\/editar)\/?$/.test(location.pathname) || /^\/catalogos-academicos\/(niveles|carreras|periodos)\/(nuevo|\d+)\/?$/.test(location.pathname)) {
    return <><a className="skip-link" href="#contenido-principal">Saltar al formulario</a><div id="contenido-principal" tabIndex={-1}><Suspense fallback={<Cargando />}><Outlet /></Suspense></div></>;
  }

  return (
    <div className={`shell${esFormularioModulo(new URLSearchParams(location.search).get('vista') || '') ? ' shell-enfoque' : ''}`}>
      <a ref={saltoContenido} className="skip-link" href="#contenido-principal">
        Saltar al contenido principal
      </a>
      {menuAbierto && (
        <button
          type="button"
          tabIndex={-1}
          className="menu-fondo"
          aria-label="Cerrar navegación"
          onClick={() => {
            setMenuAbierto(false);
          }}
        />
      )}
      <aside
        ref={lateral}
        className={`lateral${menuAbierto ? ' lateral-abierto' : ''}`}
        role={menuAbierto ? 'dialog' : undefined}
        aria-modal={menuAbierto ? true : undefined}
        aria-label="Menú principal"
      >
        <button ref={botonCerrarMenu} type="button" className="menu-cerrar" onClick={() => setMenuAbierto(false)}>
          <span>Cerrar menú</span> <IconoTabler nombre="x" />
        </button>
        {marca.logoUrl && !logoFallo ? (
          <img
            className="logo-marca"
            src={archivosBase + marca.logoUrl}
            alt={marca.nombreInstitucion}
            onError={() => setLogoFallo(true)}
          />
        ) : (
          <div className="monograma" aria-hidden>
            {marca.nombreCorto}
          </div>
        )}
        <p className="lateral-titulo" title={marca.nombreInstitucion}>
          {marca.nombreInstitucion}
        </p>
        <div className="menu-panel">
          <nav id="navegacion-escolar" aria-label="Navegación principal">
            {gruposMenu.map((grupo) => {
              const opciones = grupo.rutas
                .map((ruta) => secciones.find((seccion) => seccion.destino === ruta)!)
                .filter((seccion) => tieneRol(...seccion.roles));
              if (!opciones.length) return null;
              return (
                <div className="menu-grupo" key={grupo.titulo} role="group" aria-label={grupo.titulo}>
                  <p className="menu-grupo-titulo">{grupo.titulo}</p>
                  {opciones.map((s) => (
                    <NavLink key={s.destino} to={s.destino} end={s.destino === '/'} onClick={navegarDesdeMenu}>
                      <IconoTabler nombre={iconosPorRuta[s.destino]} />
                      <span>{s.etiqueta}</span>
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="lateral-pie">
            <p>{sesion?.nombre}</p>
            <NavLink to="/cuenta" className="pie-enlace" onClick={navegarDesdeMenu}>
              Mi cuenta
            </NavLink>
            <p className="rol">{sesion?.roles.join(' · ')}</p>
            <button type="button" className="boton fantasma" onClick={() => { setMenuAbierto(false); window.dispatchEvent(new Event('escolar:reiniciar-recorrido')); }}>Ver recorrido</button>
            <p className="detalle">Por seguridad, el sistema cierra la sesión tras 30 minutos sin actividad.</p>
            {errorCierre && (
              <p className="mensaje-error" role="alert">
                {errorCierre}
              </p>
            )}
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
      <main ref={contenido} className="contenido" id="contenido-principal" tabIndex={-1}>
        <div className="barra-superior">
          <button
            ref={botonMenu}
            type="button"
            className="menu-movil"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
            aria-controls="navegacion-escolar"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <IconoTabler nombre="menu-2" /> <span>Menú</span>
          </button>
          <span className="barra-contexto">
            Espacio de trabajo <strong>{sesion?.roles.join(' · ')}</strong>
          </span>
          <Campana />
        </div>
        {sinConexion && (
          <p className="mensaje-error" role="alert">
            Tu dispositivo está sin conexión. Los datos visibles pueden estar desactualizados. Conéctate y vuelve a
            cargar la sección antes de guardar cambios.
          </p>
        )}
        <GuiaSeccion ruta={location.pathname} />
        <Suspense fallback={<Cargando />}>
          <Outlet />
        </Suspense>
      </main>
      <RecorridoInicial usuarioId={sesion?.sub} roles={sesion?.roles ?? []} pasos={pasosRecorrido} />
    </div>
  );
}

const guias: Record<string, string> = {
  '/': 'Consulta indicadores y accesos de tus funciones. Selecciona un plantel para acotar el resumen.',
  '/biblioteca': 'Organiza documentos, fotos, logos y calendarios privados del plantel. Selecciona una carpeta y carga un archivo; solo el personal administrativo autorizado puede descargarlo.',
  '/operaciones':
    'Revisa una importación antes de confirmarla. La promoción mueve inscripciones entre ciclos y debe verificarse antes de ejecutarse.',
  '/conducta':
    'Registra y consulta incidencias internas. Esta información sólo está disponible para personal autorizado.',
  '/analitica':
    'Compara indicadores dentro de tus permisos. Revisa el periodo y plantel seleccionados antes de interpretar los resultados.',
  '/alumnos':
    'Busca expedientes por matrícula o plantel. Aplica los filtros para actualizar la lista; las acciones afectan al alumno seleccionado.',
  '/planteles': 'Consulta las sedes a las que tienes acceso y sus datos de contacto.',
  '/docentes': 'Consulta el directorio docente y abre una ficha para revisar sus datos.',
  '/materias': 'Administra el catálogo de materias. La asignación de docentes y grupos se realiza desde Grupos.',
  '/grupos': 'Organiza los grupos por plantel y ciclo, sus inscripciones y las materias impartidas.',
  '/maestro': 'Abre una de tus clases para publicar actividades, materiales y revisar entregas.',
  '/calificaciones':
    'Captura parciales y revisa el promedio oficial. Las correcciones requieren motivo y quedan en el historial.',
  '/calendario': 'Consulta y publica eventos. Puedes eliminar los eventos permitidos por tu rol, plantel y autoría.',
  '/avisos': 'Publica comunicaciones para los destinatarios permitidos por tus funciones.',
  '/finanzas': 'Revisa cargos, pagos y adeudos. Verifica alumno, monto y referencia antes de registrar una operación.',
  '/usuarios':
    'Gestiona o consulta cuentas dentro de tus permisos. Los roles determinan qué información y acciones puede usar cada persona.',
  '/configuracion':
    'Configura nombre, colores y logo institucionales. Los cambios también se muestran en la app del alumno.',
  '/cuenta': 'Revisa tu cuenta y cambia la contraseña. Al actualizarla tendrás que volver a iniciar sesión.',
};
function GuiaSeccion({ ruta }: { ruta: string }) {
  if (!guias[ruta]) return null;
  return (
    <details className="panel" style={{ padding: 12, marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', minHeight: 32 }}>¿Para qué sirve esta sección?</summary>
      <p>{guias[ruta]}</p>
      <p>Las opciones dependen de tus permisos. No compartas tu contraseña y cierra sesión en equipos compartidos.</p>
    </details>
  );
}
