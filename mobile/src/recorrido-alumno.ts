export const CLAVE_GUIA_ALUMNO = "iua_guia_alumno_v1_";
export const pasosAlumno = [
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
    pantalla: "Inicio" as const,
    descripcion:
      "Abre Calendario del ciclo para consultar mes, ciclo, imagen o agenda en texto. En Mis asistencias verás solo tus registros.",
    comprobar:
      "Solo el profesor asignado captura o corrige; si hay un error, solicita revisión.",
  },
  {
    titulo: "Materias y temarios",
    pantalla: "Materias" as const,
    descripcion:
      "Abre una materia para consultar sus temas, materiales y actividades. Los archivos privados requieren sesión vigente y conexión.",
    comprobar:
      "Confirma materia, grupo y ciclo; si un enlace caduca vuelve a abrirlo desde la app.",
  },
  {
    titulo: "Entregar una actividad",
    pantalla: "Materias" as const,
    descripcion:
      "Dentro de la materia, abre la actividad, revisa instrucciones y vencimiento, adjunta el archivo y confirma una sola vez. Revisa el resultado antes de reintentar.",
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
    pantalla: "Inicio" as const,
    descripcion:
      "En Mis asistencias, trámites y pendientes abre Trámites, elige el tipo y describe tu solicitud. Revisa folio, estado e historial.",
    comprobar:
      "Solo puedes cancelar antes de que se atienda. Resolver no emite automáticamente un documento oficial.",
  },
  {
    titulo: "Preferencias y sesiones",
    pantalla: "Inicio" as const,
    descripcion:
      "Dentro de Seguimiento configura avisos opcionales y revisa tus sesiones. Puedes cerrar las otras; los correos de seguridad siguen habilitados.",
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
