import type { ResumenFinancieroCartera } from '../../components/ResumenCartera';

export interface Alumno {
  id: number;
  matricula: string;
  usuario: { nombre: string; apellidoPaterno: string; apellidoMaterno: string | null };
}
export interface Trayectoria {
  financiero?: ResumenFinancieroCartera;
  academico?: {
    sinMaterias: boolean;
    pendientes: {
      grupoMateriaId: number;
      materia: string;
      calificacion: number | null;
      publicada: boolean;
      participacionId?: number;
      intento?: number;
    }[];
  };
  recursamientos?: { id: number; grupoMateriaId: number; intento: number }[];
  alumno: { id: number; matricula: string; nombre: string; plantelId: number };
  origen: {
    inscripcionId: number;
    grupo: string;
    cicloId: number;
    nivelId: number;
    carreraId: number;
    periodoAcademicoId: number;
    periodo: string;
    tipo: string;
    numero: number;
    turno: 'MATUTINO' | 'VESPERTINO';
    fechaFin: string;
  };
  advertencia: string;
}
export interface Ciclo {
  id: number;
  nombre: string;
  clave: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
}
export interface Concepto {
  id: number;
  nombre: string;
  tipo: string;
  montoBase: number;
  activo: boolean;
}
export interface Cotizacion {
  cotizacion: string;
  total: number;
  conceptos: { conceptoId: number; nombre: string; monto: number; descuento?: number }[];
}
export interface Autorizacion extends Cotizacion {
  destino: { periodo: string; tipo: string; numero: number; ciclo: string; grupoId: number | null };
  id: number;
  financieroId: number;
  venceAt: string;
}
export interface Resultado {
  id: number;
  estado: string;
  total: number;
  origenInscripcionId: number;
  periodoAcademicoId: number;
  grupoId: number | null;
  conceptos: { nombre: string; monto: number; descuento?: number }[];
}
