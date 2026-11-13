export interface Ciclo { id: number; clave: string; activo: boolean; estado: string }
export interface Plantel { id: number; nombre: string }
export interface PreparacionGrupo { asignadas: number; sinDocente: number; inscritos: number; esperadas: number | null; pendientes: number | null }
export interface Grupo { preparacion?: PreparacionGrupo; nivelId?: number | null; carreraId?: number | null; periodoAcademicoId?: number | null; id: number; nombre: string; grado?: string; turno?: string; ciclo: Ciclo; plantel: Plantel | null }
export interface ResultadoGrupos { datos: Grupo[]; total: number; pagina: number; porPagina: number }
export interface Materia { id: number; clave: string; nombre: string }
export interface Docente { id: number; numEmpleado: string; usuario: { nombre: string; apellidoPaterno: string } }
export interface GrupoMateria { id: number; materia: Materia; docente: Docente | null }
export interface Inscripcion { id: number; alumno: { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } } }
export interface Alumno { id: number; matricula: string; usuario: { nombre: string; apellidoPaterno: string } }
