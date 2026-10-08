export interface GrupoMateria {
  id: number;
  grupo: { nombre: string; ciclo: { clave: string } };
  materia: { clave: string; nombre: string };
}
export interface Actividad {
  id: number; titulo: string; tipo: string; parcial: number;
  descripcion?: string; ponderacion: number; fechaEntrega: string | null;
}
export interface Material {
  id: number; titulo: string; archivoNombre: string; archivoRuta: string;
  tamanoKb: number; createdAt: string;
}
export interface Entrega {
  id: number; estatus: string; calificacion: number | null;
  archivoRuta: string | null; comentarioAlumno: string | null; comentarioDocente: string | null; fechaEntregado: string;
  alumno: { matricula: string; usuario: { nombre: string; apellidoPaterno: string } };
}
