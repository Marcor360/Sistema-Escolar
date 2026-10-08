export interface Alumno {
  id: number;
  matricula: string;
  estatus: string;
  usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno?: string; email: string };
  plantel: { id: number; nombre: string } | null;
}
export interface Historial { id: number; estatus: string; grupo: { id: number; nombre: string; ciclo: { id: number; nombre: string }; plantel: { nombre: string } } }
export interface Nota { id: number; parcial: number; calificacion: number; promedioOficial: number | null; grupoMateria: { id: number; grupo: { id: number }; materia: { nombre: string } } }
export interface Plantel { id: number; nombre: string }
export interface Resultado { datos: Alumno[]; total: number; pagina: number; porPagina: number }

export const FORM_INICIAL = {
  matricula: '', nombre: '', apellidoPaterno: '', apellidoMaterno: '',
  email: '', password: '', curp: '', tutorNombre: '', tutorTelefono: '', plantelId: '',
};
