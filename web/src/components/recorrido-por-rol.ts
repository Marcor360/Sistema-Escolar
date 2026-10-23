export interface PasoRecorrido { titulo: string; descripcion: string; destino: string }
interface Grupo { titulo: string; rutas: readonly string[] }
interface Seccion { destino: string; roles: readonly string[] }
const textos: Record<string, string> = {
  'Inicio y seguimiento': 'Encuentra el panel, los eventos y avisos para dar seguimiento a las actividades de tu institución.',
  'Control escolar': 'Consulta alumnos, docentes, ciclos y grupos dentro del alcance de tu rol.',
  'Docencia': 'Accede a tus clases, temarios y calificaciones cuando tu rol lo permita.',
  'Finanzas e informes': 'Consulta indicadores y operaciones financieras únicamente si tienes autorización.',
  'Administración': 'Revisa planteles, biblioteca, usuarios y configuración según tus permisos.',
};
export function construirRecorrido(grupos: readonly Grupo[], secciones: readonly Seccion[], roles: readonly string[]): PasoRecorrido[] {
  return grupos.flatMap(grupo => {
    const rutas = grupo.rutas.filter(ruta => {
      const seccion = secciones.find(s => s.destino === ruta);
      return Boolean(seccion && (roles.includes('SUPERADMIN') || seccion.roles.some(rol => roles.includes(rol))));
    });
    return rutas.length ? [{ titulo: grupo.titulo, descripcion: textos[grupo.titulo] ?? '', destino: rutas[0] }] : [];
  });
}
export function claveRecorrido(id: number, roles: readonly string[]) {
  return `escolar_recorrido_web_v1_${id}_${[...roles].sort().join('-')}`;
}
