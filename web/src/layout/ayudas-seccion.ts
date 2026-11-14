/** Orientación de navegación; la autorización la decide el backend. */
const ayudas: Readonly<Record<string, string>> = {
  '/': 'Consulta indicadores y pendientes según tu función. Un indicador no autoriza cambios ni sustituye la información del expediente.',
  '/boletas': 'Revisa boletas y solicitudes de atención. La respuesta de un alumno o comentario de un docente no modifica por sí sola las calificaciones oficiales.',
  '/seguimiento': 'Consulta pendientes y trámites. Un recordatorio no genera por sí solo una inscripción, un cargo ni un pago.',
  '/asistencias': 'El docente asignado registra asistencias de su clase. Administrativo consulta según plantel y el alumno consulta únicamente las suyas; una falta no altera automáticamente su calificación.',
  '/calendario': 'Publica eventos para una audiencia autorizada; revisa plantel, ciclo y fechas antes de guardar. Un evento no genera una actividad ni un cobro.',
  '/avisos': 'Prepara y revisa destinatarios antes de publicar comunicados. Guardar un borrador y enviarlo son acciones distintas.',
  '/alumnos': 'Primero se crea el expediente del alumno. La matrícula no significa que ya esté inscrito ni que tenga cargos: la apertura de cartera y asignación de grupo se gestionan aparte.',
  '/planteles': 'La consulta permite revisar las sedes autorizadas. Crear o modificar un plantel es responsabilidad de Superadmin; Director administra sus funciones permitidas sin crear nuevas sedes.',
  '/docentes': 'Registra o consulta docentes y sus planteles. Crear un docente no le asigna automáticamente una clase; Control Escolar vincula después materia, grupo y profesor.',
  '/catalogos-academicos': 'Configura niveles como Secundaria, Bachillerato, Licenciatura o Maestría; vincula programas/planes y periodos según el plantel. Un periodo académico no es un parcial.',
  '/materias': 'Registra materias del catálogo general sin exigir profesor, grupo ni plantel. Después vincúlalas con planes y grupos cuando corresponda.',
  '/grupos': 'Crea el grupo con plantel, ciclo y nombre. Puede quedar sin materias, docentes o alumnos; revisa la preparación antes de impartir clases o inscribir.',
  '/apertura-cartera': 'Control Escolar prepara y confirma la apertura del alumno. Un expediente o una solicitud en pausa no significa que existan cargos cobrables. Finanzas administra tarifas y pagos por su flujo propio.',
  '/operaciones': 'Importa datos después de previsualizar errores y duplicados. La importación académica no genera automáticamente cobros ni activa cuentas sin confirmación.',
  '/programas-especiales': 'Registra ofertas, grupos y participantes especiales por separado de los grupos regulares. Revisa fechas, autorización, materias y modalidad antes de inscribir.',
  '/recursamientos': 'Gestiona materias reprobadas y recursamientos dentro del expediente y ciclo correctos. El trámite académico no crea por sí solo una colegiatura.',
  '/maestro': 'Abre una clase asignada, publica actividades y materiales, revisa entregas y da retroalimentación. Las notas de entrega y las calificaciones oficiales se capturan en procesos diferentes.',
  '/temarios': 'Prepara contenido de estudio de cada clase. Un tema del temario no es una tarea, no recibe entregas y no modifica la nota oficial.',
  '/calificaciones': 'Captura notas de una clase autorizada, revisa régimen, parcial y escala. Una corrección requiere justificación y conserva historial.',
  '/conducta': 'Registra incidencias internas con alcance institucional. Una incidencia no sanciona automáticamente ni modifica calificaciones o cargos.',
  '/biblioteca': 'Gestiona carpetas y archivos administrativos privados del plantel. Subirlos aquí no los publica a alumnos ni maestros.',
  '/finanzas': 'Primero revisa conceptos y tarifas; después previsualiza cargos o colegiaturas, emite y registra pagos. Concepto, programación, cargo, pago y conciliación son estados diferentes.',
  '/analitica': 'Consulta indicadores por rol, plantel y periodo. Los cobros confirmados no representan automáticamente toda la utilidad ni los alumnos por carrera son siempre sumables.',
  '/usuarios': 'Gestiona cuentas y alcance institucional según tu jerarquía. Asignar una función no asigna clases ni modifica expedientes académicos.',
  '/roles-personal': 'Director o personal autorizado modifica únicamente funciones subordinadas. Crear planteles y administrar la configuración global corresponde a Superadmin.',
  '/configuracion': 'Superadmin administra identidad visual y ajustes habilitados; cambiar marca no modifica expedientes, tarifas ni permisos.',
  '/cuenta': 'Consulta tu cuenta, sesiones y opciones de seguridad. Cambiar contraseña requiere volver a verificar el acceso.',
};

export function descripcionSeccion(ruta: string): string | null {
  const coincidencia = Object.keys(ayudas)
    .filter((clave) => ruta === clave || (clave !== '/' && ruta.startsWith(clave + '/')))
    .sort((a, b) => b.length - a.length)[0];
  return coincidencia ? ayudas[coincidencia] : null;
}
