export interface Ciclo { id: number; clave: string; activo: boolean; estado: string }
export interface Plantel { id: number; nombre: string }
export interface Grupo { id: number; nombre: string; grado?: string; turno?: string; ciclo: Ciclo; plantel: Plantel | null }
export interface ResultadoGrupos { datos: Grupo[]; total: number; pagina: number; porPagina: number }
export interface Materia { id: number; clave: string; nombre: string }
export interface Docente { id: number; numEmpleado: string; usuario: { nombre: string; apellidoPaterno: string } }
export interface GrupoMateria { id: number; materia: Materia; docente: Docente | null }
export interface Inscripcion { id: number; alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
export interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }
