export const CLAVE_GUIA_ALUMNO = "iua_guia_alumno_v1_";
export type PantallaAlumno = 'Inicio' | 'Materias' | 'Calificaciones' | 'Pagos' | 'Perfil' | 'Calendario' | 'Tramites';
export type VistaSeguimientoAlumno = 'pendientes' | 'asistencias' | 'tramites' | 'preferencias' | 'sesiones';
export interface PasoAlumno {
  titulo: string; pantalla: PantallaAlumno; descripcion: string; comprobar: string;
  subpantalla?: 'MisMaterias' | 'MisTareas'; vista?: VistaSeguimientoAlumno;
}
export const pasosAlumno: PasoAlumno[] = [
  {
    titulo: "Tu inicio y pendientes",
    pantalla: "Inicio" as const,
    descripcion:
      "Revisa actividades sin entrega, cargos, avisos y eventos. Desliza para actualizar; un mensaje de error no equivale a una lista vacía.",
    comprobar:
      "Abre Mis asistencias, trámites y pendientes para consultar tu seguimiento.",
  },
  {
    titulo: "Calendario y asistencias propias",
    pantalla: "Calendario",
    descripcion:
      "Consulta el calendario escolar para consultar mes, ciclo, imagen o agenda en texto. En Mis asistencias verás solo tus registros.",
    comprobar:
      "Solo el profesor asignado captura o corrige; si hay un error, solicita revisión.",
  },
  {
    titulo: "Materias y temarios",
    pantalla: "Materias",
    subpantalla: "MisMaterias",
    descripcion:
      "Abre una materia para consultar sus temas y materiales. Usa Tareas y entregas para ver las actividades. Los archivos privados requieren sesión vigente y conexión.",
    comprobar:
      "Confirma materia, grupo y ciclo; si un enlace caduca vuelve a abrirlo desde la app.",
  },
  {
    titulo: "Entregar una actividad",
    pantalla: "Materias",
    subpantalla: "MisTareas",
    descripcion:
      "En Tareas y entregas, elige la actividad. Revisa instrucciones y vencimiento, elige Entregar archivo o escribe una respuesta y confirma una sola vez. Revisa el resultado antes de reintentar.",
    comprobar: "Esta guía no envía tareas ni adjunta archivos por ti.",
  },
  {
    titulo: "Consultar calificaciones",
    pantalla: "Calificaciones" as const,
    descripcion:
      "Consulta tus parciales y boletas disponibles por ciclo. Una nota pendiente no es cero; la app no cambia reglas de evaluación.",
    comprobar:
      "Verifica el ciclo e inscripción de la boleta antes de descargarla.",
  },
  {
    titulo: "Revisar estado de cuenta",
    pantalla: "Pagos" as const,
    descripcion:
      "Distingue cargos, pagos aplicados y saldo. Consulta la ficha o instrucciones vigentes; tener un comprobante no significa que el depósito ya esté aplicado.",
    comprobar:
      "Conserva el comprobante y solicita revisión a Finanzas cuando corresponda.",
  },
  {
    titulo: "Solicitudes y seguimiento",
    pantalla: "Tramites",
    vista: "tramites",
    descripcion:
      "En Ventanilla de trámites elige el tipo y describe tu solicitud. Revisa folio, estado e historial.",
    comprobar:
      "Solo puedes cancelar antes de que se atienda. Resolver no emite automáticamente un documento oficial.",
  },
  {
    titulo: "Preferencias y sesiones",
    pantalla: "Tramites",
    vista: "preferencias",
    descripcion:
      "En Mi seguimiento escolar abre Preferencias de avisos y después Sesiones abiertas. Configura avisos opcionales y revisa tus sesiones. Puedes cerrar las otras; los correos de seguridad siguen habilitados.",
    comprobar:
      "La consulta siempre corresponde a tu cuenta; no se muestra información de otros alumnos.",
  },
  {
    titulo: "Perfil, documentos y ayuda",
    pantalla: "Perfil" as const,
    descripcion:
      "Revisa tus datos, documentos y ajustes de acceso. Cierra sesión en dispositivos compartidos. Desde aquí puedes repetir este recorrido.",
    comprobar:
      "La app es exclusiva del alumno y no contiene herramientas de personal.",
  },
];
const oyentes = new Set<() => void>();
export function repetirRecorridoAlumno() {
  oyentes.forEach((f) => f());
}
export function escucharRecorridoAlumno(f: () => void) {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}
