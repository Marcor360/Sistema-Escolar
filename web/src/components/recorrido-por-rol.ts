export interface PasoRecorrido {
  titulo: string;
  descripcion: string;
  destino: string;
  objetivo?: string;
  comprobar?: string;
  selector?: string;
}
interface Grupo {
  titulo: string;
  rutas: readonly string[];
}
interface Seccion {
  destino: string;
  roles: readonly string[];
}
const textos: Record<string, string> = {
  'Inicio y seguimiento':
    'Encuentra el panel, los eventos y avisos para dar seguimiento a las actividades de tu institución.',
  'Control escolar': 'Consulta alumnos, docentes, ciclos y grupos dentro del alcance de tu rol.',
  Docencia: 'Accede a tus clases, temarios y calificaciones cuando tu rol lo permita.',
  'Finanzas e informes': 'Consulta indicadores y operaciones financieras únicamente si tienes autorización.',
  Administración: 'Revisa planteles, biblioteca, usuarios y configuración según tus permisos.',
};
export function construirRecorrido(
  grupos: readonly Grupo[],
  secciones: readonly Seccion[],
  roles: readonly string[],
): PasoRecorrido[] {
  return grupos.flatMap((grupo) => {
    const rutas = grupo.rutas.filter((ruta) => {
      const seccion = secciones.find((s) => s.destino === ruta);
      return Boolean(seccion && (roles.includes('SUPERADMIN') || seccion.roles.some((rol) => roles.includes(rol))));
    });
    return rutas.length ? [{ titulo: grupo.titulo, descripcion: textos[grupo.titulo] ?? '', destino: rutas[0] }] : [];
  });
}
export function claveRecorrido(id: number, roles: readonly string[]) {
  return `escolar_recorrido_web_v2_${id}_${[...roles].sort().join('-')}`;
}

export interface AreaRecorrido {
  id: string;
  titulo: string;
  resumen: string;
  pasos: PasoRecorrido[];
}
const paso = (titulo: string, destino: string, descripcion: string, comprobar: string): PasoRecorrido => ({
  titulo,
  destino,
  descripcion,
  comprobar,
});
const catalogo: (AreaRecorrido & { roles: string[] })[] = [
  { id: 'direccion', titulo: 'Dirección y revisión de boletas', roles: ['DIRECTOR'], resumen: 'Consultar revisiones académicas y funciones de personal dentro del plantel.', pasos: [
    paso('Revisar boletas pendientes', '/boletas', 'Filtra boletas pendientes de aceptación o con comentarios y abre el expediente correspondiente.', 'Verifica ciclo, alumno y versión de la boleta antes de dar seguimiento.'),
    paso('Consultar funciones del personal', '/roles-personal', 'Revisa las funciones y el alcance del personal del plantel. Los cambios se realizan solo mediante las acciones autorizadas.', 'Una función institucional y un permiso de acceso son conceptos distintos.'),
  ] },
  { id: 'servicios-academicos', titulo: 'Boletas, recursamientos y programas', roles: ['ADMINISTRATIVO'], resumen: 'Revisiones académicas y ofertas especiales conservando el historial.', pasos: [
    paso('Revisar boletas', '/boletas', 'Filtra las boletas pendientes o con comentarios y abre la revisión del alumno.', 'Comprueba ciclo, alumno y versión antes de responder.'),
    paso('Consultar recursamientos', '/recursamientos', 'Busca al alumno y revisa sus intentos y la materia inscrita antes de preparar otro recursamiento.', 'El grupo principal y las notas históricas se conservan.'),
    paso('Revisar programas especiales', '/programas-especiales', 'Consulta el programa, sus grupos y participantes antes de registrar una oferta nueva.', 'Revisa las fechas y el plantel; no confundas este grupo con el grupo regular.'),
  ] },
  { id: 'comunidad', titulo: 'Biblioteca, calendario y avisos', roles: ['ADMINISTRATIVO'], resumen: 'Organizar documentos y preparar comunicaciones para la audiencia correcta.', pasos: [
    paso('Consultar biblioteca', '/biblioteca?vista=consulta', 'Revisa las carpetas del plantel antes de crear otra. Para cargar un documento utiliza Subir archivo y comprueba su destino.', 'La biblioteca administrativa no publica documentos automáticamente al alumnado.'),
    paso('Revisar calendario', '/calendario?vista=consulta', 'Consulta el ciclo y la audiencia. Registra un evento solo después de comprobar las fechas existentes.', 'Verifica quién verá el evento antes de guardar.'),
    paso('Preparar un aviso', '/avisos?vista=nuevo', 'Redacta el aviso, selecciona el plantel y revisa los destinatarios antes de enviarlo.', 'Guardar un borrador y enviar el comunicado son acciones diferentes.'),
  ] },
  {
    id: 'carga-academica', titulo: 'Cargar materias, grupos y alumnos', roles: ['ADMINISTRATIVO'],
    resumen: 'Orden de preparación, asignación de materias e importaciones con revisión previa.',
    pasos: [
      paso('1. Revisar el orden de carga', '/operaciones?vista=preparar', 'Consulta la guía y ubica qué datos ya existen antes de crear otros.', 'Revisa tu plantel y coordina el alta de alumnos con el rol autorizado.'),
      paso('2. Preparar ciclo y oferta', '/materias?vista=ciclos', 'Revisa fechas y estado del ciclo. La oferta académica relaciona nivel, plan y periodo.', 'Crear un ciclo no crea materias, grupos o inscripciones.'),
      paso('3. Registrar y vincular materias', '/materias?vista=consulta', 'Busca la clave para evitar duplicados. Registra las materias que falten y vincúlalas con sus planes y periodos.', 'Una materia del catálogo se asigna después a cada grupo.'),
      paso('4. Asignar materias y docentes', '/grupos?vista=consulta', 'Crea el grupo si falta. En Administrar, asigna materias y revisa los profesores pendientes.', 'Comprueba plantel, ciclo, turno y contexto académico del grupo.'),
      paso('5. Revisar la importación', '/operaciones?vista=importar', 'Descarga la plantilla del tipo autorizado, complétala y previsualiza el archivo. Revisa errores y duplicados antes de confirmar.', 'Materias y grupos se registran en sus módulos; no admiten esta plantilla de expedientes.'),
      paso('6. Verificar e inscribir', '/apertura-cartera', 'Para una inscripción ordinaria revisa el expediente existente y la previsualización de cartera antes de confirmar.', 'La importación académica de inscripciones no genera cargos por sí sola.'),
    ],
  },
  {
    id: 'finanzas',
    titulo: 'Finanzas y cobranza',
    roles: ['FINANZAS'],
    resumen: 'Cartera, programación, fichas, pagos, conciliación y análisis de ingresos.',
    pasos: [
      paso(
        '1. Revisar pendientes financieros',
        '/seguimiento?seccion=pendientes',
        'Revisa cargos pendientes y movimientos por conciliar dentro de tus planteles. Un pendiente es una señal para revisar, no una autorización de cobro.',
        'Comprueba el plantel y la fecha antes de operar.',
      ),
      paso(
        '2. Consultar cargos y saldos',
        '/finanzas?vista=cargos',
        'Filtra los cargos del alumno. Distingue monto, descuento, recargo, aplicado y saldo. Un cargo cancelado no debe volver a cobrarse.',
        'Verifica que el expediente y el cargo correspondan al alumno.',
      ),
      paso(
        '3. Programar cuotas',
        '/finanzas?vista=programaciones',
        'Previsualiza el total autorizado por nivel y periodo. Guarda la programación y emite cada cuota solo cuando corresponda. Reintentar una emisión conserva el cargo existente.',
        'Revisa concepto, periodo, total y vencimientos antes de confirmar.',
      ),
      paso(
        '4. Fichas y depósitos',
        '/finanzas?vista=fichas',
        'Consulta la ficha del cargo y coteja el depósito real. El identificador IUA es interno; registra el folio del banco, no ese identificador.',
        'No apliques un pago solo porque existe una ficha PDF.',
      ),
      paso(
        '5. Registrar y revisar pagos',
        '/finanzas?vista=pagos',
        'Consulta pagos confirmados y sus referencias. Para registrar uno nuevo usa la operación correspondiente y revisa el saldo y las órdenes pendientes.',
        'Una anulación requiere revisión; no borres evidencias de una operación.',
      ),
      paso(
        '6. Conciliar movimientos bancarios',
        '/seguimiento?seccion=conciliacion',
        'Carga el CSV normalizado, elige un alias estable de cuenta, previsualiza y confirma la importación. Después aplica cada movimiento al cargo cotejado.',
        'Un movimiento ASIGNADO permite reintentar el mismo cargo; evita crear otro pago manual.',
      ),
      paso(
        '7. Cobranza y preferencias',
        '/finanzas?vista=adeudos',
        'Revisa adeudos y destinatarios antes de enviar avisos. Las preferencias de correo opcional se respetan; un envío aceptado por el proveedor no prueba su recepción.',
        'No envíes avisos de prueba a destinatarios reales.',
      ),
      paso(
        '8. Comparar ingresos',
        '/analitica?vista=consulta',
        'Consulta gráficas separadas de cobros por plantel y carrera. Cambia entre barras y líneas, revisa valores exactos y periodo. Los ingresos no equivalen a utilidad.',
        'Los importes sin carrera identificada permanecen separados.',
      ),
    ],
  },
  {
    id: 'control',
    titulo: 'Administración y control escolar',
    roles: ['ADMINISTRATIVO'],
    resumen: 'Expedientes, ciclos, grupos, inscripciones, trámites, calidad y calendario.',
    pasos: [
      paso(
        '1. Revisar expedientes pendientes',
        '/seguimiento?seccion=calidad',
        'El diagnóstico señala datos faltantes, CURP repetida, grupos sin nivel e inscripciones inconsistentes. Revisa antes de corregir; no se fusionan expedientes automáticamente.',
        'Consulta la vista previa de la corrección y verifica el alumno.',
      ),
      paso(
        '2. Consultar alumnos',
        '/alumnos?vista=consulta',
        'Busca por matrícula o nombre y abre el expediente autorizado. Revisa información de contacto y plantel antes de editar.',
        'Distingue baja, egreso y traslado; no crees otro alumno para corregir el existente.',
      ),
      paso(
        '3. Preparar ciclos y catálogos',
        '/materias?vista=ciclos',
        'Prepara el siguiente ciclo sin activarlo anticipadamente. Revisa niveles, carreras y periodos configurados por la institución.',
        'Activar o cerrar un ciclo es una operación distinta de cambiar sus fechas.',
      ),
      paso(
        '4. Crear alumno y cartera',
        '/apertura-cartera',
        'Crea alumno y cartera sin correo institucional, o selecciona un expediente existente sin cartera. Revisa el total y el calendario de cuotas antes de confirmar.',
        'Sin grupo, la nueva cartera queda en pausa sin cargos ni agrupación automática. No dupliques al alumno.',
      ),
      paso(
        '5. Asignar correo de acceso',
        '/usuarios?vista=consulta&tipo=ALUMNO&sinCorreo=true',
        'Filtra alumnos sin correo institucional. Asigna una dirección institucional existente y el proveedor para solicitar el código de activación.',
        'Verifica alumno y plantel. Asignar la dirección no crea un buzón ni confirma que el código haya llegado.',
      ),
      paso(
        '6. Administrar grupos e inscripciones',
        '/grupos?vista=consulta',
        'Abre el grupo correcto, comprueba ciclo/nivel/carrera y revisa la inscripción antes de asignar materias o promover.',
        'Las importaciones requieren vista previa y confirmación; verifica filas rechazadas.',
      ),
      paso(
        '7. Consultar asistencias',
        '/asistencias',
        'Selecciona la clase y el intervalo para consultar asistencia e historial. ADMINISTRATIVO no captura: solo el profesor asignado registra o corrige.',
        'Verifica el alcance por plantel y no infieras sanciones por faltas.',
      ),
      paso(
        '8. Atender trámites',
        '/seguimiento?seccion=tramites',
        'Consulta el folio, asígnate la revisión y registra un mensaje para el alumno. Resolver un trámite no emite por sí mismo una constancia oficial.',
        'El historial y el responsable deben permitir seguir cada solicitud.',
      ),
      paso(
        '9. Publicar calendarios',
        '/calendario?vista=consulta',
        'Elige ciclo, nivel y audiencia. Revisa el plantel y el resumen antes de publicar fechas o imagen; usa agenda para lectura accesible.',
        'Las fechas internas no deben publicarse como académicas.',
      ),
      paso(
        '10. Analizar inscripciones',
        '/analitica?vista=consulta',
        'Consulta alumnos distintos por plantel/carrera y la evolución mensual. Una persona puede figurar en más de una carrera; los conteos no siempre se suman.',
        'Distingue inscripción vigente, participación histórica y nuevas inscripciones.',
      ),
    ],
  },
  {
    id: 'docencia',
    titulo: 'Docencia y seguimiento de clases',
    roles: ['MAESTRO'],
    resumen: 'Temarios, materiales, actividades, asistencias y evaluación de tus clases.',
    pasos: [
      paso(
        '1. Abrir mis clases',
        '/maestro?vista=consulta',
        'Consulta únicamente tus grupos-materia asignados y vigentes. Abre una clase para gestionar sus recursos.',
        'Confirma grupo, materia y ciclo antes de capturar.',
      ),
      paso(
        '2. Preparar temarios',
        '/temarios?vista=consulta',
        'Organiza temas de la clase y su publicación. Un temario es diferente de una tarea con entrega.',
        'Selecciona una clase real antes de crear o adjuntar contenido.',
      ),
      paso(
        '3. Publicar actividades y materiales',
        '/maestro?vista=consulta',
        'Abre la clase y elige Actividades o Materiales. Define instrucciones, fecha y archivos antes de publicar.',
        'Evita duplicados al reintentar; revisa las entregas existentes antes de editar.',
      ),
      paso(
        '4. Registrar asistencias',
        '/asistencias',
        'Selecciona tu clase y un día del ciclo. Marca explícitamente el estado de cada alumno, escribe el motivo y guarda. Para corregir, recarga la revisión actual.',
        'Solo tú como profesor asignado puedes capturar; no se generan calificaciones por asistencia.',
      ),
      paso(
        '5. Capturar y revisar notas',
        '/calificaciones?vista=consulta',
        'Revisa el régimen y la escala de la clase, los participantes y el motivo de corrección. En el esquema 0–10, P1–P4 aportan 25 % cada uno y Final manual sustituye el promedio.',
        'No inventes ponderaciones ni cambies una escala institucional.',
      ),
      paso(
        '6. Atender pendientes de clase',
        '/seguimiento?seccion=pendientes',
        'Revisa entregas sin calificar y vuelve a la clase correspondiente. Consulta alertas sin enviar mensajes ni modificar notas desde el recorrido.',
        'Comprueba lo que está pendiente frente al listado real.',
      ),
      paso(
        '7. Consultar avance',
        '/analitica?vista=consulta',
        'Consulta captura, promedios oficiales y entregas de tus clases. Tener también FINANZAS no amplía el acceso académico.',
        'Los indicadores no sustituyen el acta ni la revisión de cada alumno.',
      ),
    ],
  },
  {
    id: 'supervision',
    titulo: 'Superadministración y operación',
    roles: ['SUPERADMIN'],
    resumen: 'Alcance institucional, configuración, seguridad y recuperación.',
    pasos: [
      paso(
        '1. Revisar sedes y permisos',
        '/planteles?vista=consulta',
        'Comprueba planteles, responsables y cuentas de personal. Usa el mínimo alcance necesario por usuario.',
        'El acceso global de SUPERADMIN no concede captura de asistencias sin ser profesor asignado.',
      ),
      paso(
        '2. Administrar personal',
        '/usuarios?vista=consulta',
        'Consulta roles y planteles asignados. Una cuenta ALUMNO no debe combinarse con personal.',
        'Verifica identidad y atribuciones antes de cambiar permisos.',
      ),
      paso(
        '3. Revisar configuración institucional',
        '/configuracion',
        'Revisa marca, cuenta bancaria y ajustes autorizados. No cambies reglas de operación solo para completar esta guía.',
        'La configuración visible no acredita despliegue ni entrega de correo.',
      ),
      paso(
        '4. Supervisar recuperación',
        '/seguimiento?seccion=respaldo',
        'Revisa antigüedad y resultado del respaldo. La instalación de tareas, copia externa y restore real requiere el procedimiento operativo de Windows.',
        'Un archivo generado o VERIFYONLY no acreditan recuperación institucional.',
      ),
      paso(
        '5. Comparar planteles y carreras',
        '/analitica?vista=consulta',
        'Compara ingresos y demanda en gráficas independientes. Revisa también la cobertura de cargos sin carrera y las tablas exactas.',
        'No interpretes ingresos como utilidad ni cero como un dato faltante.',
      ),
    ],
  },
  {
    id: 'cuenta',
    titulo: 'Mi cuenta, avisos y seguridad',
    roles: ['ADMINISTRATIVO', 'FINANZAS', 'MAESTRO', 'SUPERADMIN', 'ALUMNO', 'DIRECTOR'],
    resumen: 'Preferencias, sesiones propias y repetición de las guías.',
    pasos: [
      paso(
        'Preferencias y sesiones',
        '/seguimiento?seccion=preferencias',
        'Configura avisos opcionales y revisa tus sesiones abiertas. Puedes revocar otras sesiones; para salir de esta usa Cerrar sesión.',
        'Los avisos de activación y recuperación permanecen habilitados.',
      ),
      paso(
        'Repetir un recorrido',
        '/cuenta',
        'Puedes volver a abrir las guías desde Mi cuenta o el menú. El recorrido explica las herramientas; nunca guarda formularios ni confirma operaciones.',
        'Elige otra área para profundizar en sus herramientas.',
      ),
    ],
  },
];
export function recorridosPorArea(secciones: readonly Seccion[], roles: readonly string[]): AreaRecorrido[] {
  return catalogo
    .filter((a) => a.roles.some((r) => roles.includes(r)) || roles.includes('SUPERADMIN'))
    .map((a) => ({
      ...a,
      pasos: a.pasos.filter((p) => {
        const ruta = p.destino.split('?')[0];
        const seccion = secciones.find((s) => s.destino === ruta);
        return (
          ruta === '/cuenta' ||
          (!!seccion && (roles.includes('SUPERADMIN') || seccion.roles.some((r) => roles.includes(r))))
        );
      }).map((p, indice) => ({ ...p, titulo: `${indice + 1}. ${p.titulo.replace(/^\d+\.\s*/, '')}` })),
    }))
    .filter((a) => a.pasos.length);
}
