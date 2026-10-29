# Boletas y portales · candidata 1.34.0

29/oct/2026, America/Mexico_City. Trabajo local sobre la candidata 1.33.0. Sin publicación ni aceptación institucional acreditadas.

## Decisiones confirmadas

- La firma se registra con nombre completo y confirmación explícita. No se dibuja una firma ni se emite un certificado de firma electrónica.
- El alumno o padre/madre/tutor utiliza la cuenta del alumno e indica quién firma. La identidad del tutor es declarada; no existe autenticación independiente de tutores en esta versión. Se conserva el usuario autenticado que registra la respuesta.
- Se acepta la boleta o se elige **Revisión con comentarios**. Revisar exige comentarios no vacíos de hasta 2000 caracteres. Solo se responde a una boleta final publicada con los cierres que exige el régimen académico vigente.
- Cambiar calificaciones u observaciones académicas modifica la versión. La respuesta anterior permanece en el historial y no cuenta como aceptación de las nuevas notas. Reintentar exactamente la misma solicitud no duplica una respuesta; responder nuevamente conserva los eventos anteriores.

## Sistemas e interfaz

Los nombres predeterminados son **Sistema Escolar Administrativo** y **Sistema Escolar Portal Alumno**. SUPERADMIN los cambia en Configuración junto con la marca. Se mantiene separado el nombre de la institución utilizado en documentos. Los clientes conservan compatibilidad con cachés que todavía no incluyan los campos nuevos. Nombres visibles en login, navegación y títulos web; Expo mantiene el portal exclusivo para alumnos. El nombre de la aplicación instalada en el lanzador del teléfono depende de la compilación; la configuración modifica los nombres dentro de las interfaces.

Seguimiento administrativo presenta cantidades en tarjetas y enlaces con jerarquía visual, en lugar de una lista de enlaces visitados. La boleta web resume promedio y número de materias, muestra calificación/observaciones por asignatura y presenta fichas en pantallas estrechas. PDF y Excel siguen usando autorización y el origen histórico de la inscripción; en móvil los enlaces son firmados y de corta vida. Se muestra el estado de preparación de la descarga. Expo Web descarga el archivo desde el enlace firmado y conserva la pantalla si el servidor devuelve un error. El formulario muestra las calificaciones y observaciones académicas asociadas a la versión que se va a responder; sin ellas no permite firmar. La firma de recepción se consulta en Seguimiento; no convierte el PDF informativo en un documento oficial firmado o sellado.

## Entradas de autenticación separadas

Se corrigen dos bloqueos encontrados al probar contra API real: el rol DIRECTOR ya puede iniciar sesión en el sistema administrativo, y Expo Web utiliza `POST /api/auth/login-alumno-web` con contrato WEB (cookie HttpOnly) reservado a ALUMNO. `/api/auth/login` sigue rechazando alumnos en la entrada WEB administrativa. Android/iOS conservan su entrada MOVIL. La renovación de una sesión web del alumno conserva la cookie y no expone refresh en JSON. Los permisos de recursos siguen en servidor; esta separación no concede capacidades administrativas a alumnos.

## Permisos y seguimiento

`/boletas` se integra en Inicio y seguimiento y ofrece **Boletas aceptadas** y **Boletas con comentarios**. Se muestra la última respuesta por inscripción y se identifica si corresponde a una versión anterior. Abrir el detalle muestra el historial (hasta 100 eventos recientes), calificaciones autorizadas y comentarios por materia.

| Rol | Lectura | Escritura |
| --- | --- | --- |
| ALUMNO | Su inscripción, boleta publicada y respuestas propias | Aceptar o pedir revisión con nombre y confirmación; puede declarar que firma el tutor |
| MAESTRO | Inscripciones de sus clases; solo sus materias/calificaciones, comentarios propios de materia y respuestas familiares | Comentarios de hasta 2000 caracteres exclusivamente en su materia asignada |
| ADMINISTRATIVO / DIRECTOR | Boletas/respuestas de sus planteles autorizados | No firman por la familia; si también son profesores, comentan únicamente materias propias |
| SUPERADMIN | Global | Configura nombres; no suplanta al alumno ni al docente al registrar respuestas |
| FINANZAS | No recibe acceso por su rol | Ninguna operación nueva |

El servidor vuelve a comprobar pertenencia de alumno, plantel y asignación docente. Los comentarios docentes no editan notas ni invalidan por sí mismos la aceptación familiar. El comentario más reciente de cada materia y versión se incorpora a las observaciones de su boleta PDF/Excel; los anteriores siguen en el historial. No se envían correos o push al consultar o responder.

## Datos, contratos y migración

- `configuracion_marca.nombre_administrativo` y `nombre_portal_alumno`, longitudes 150 con valores iniciales compatibles; sin renombrar la institución.
- `boleta_respuestas`: inscripción, actor autenticado, materia cuando corresponde, clave de idempotencia, huellas de versión/petición, estado, nombre/tipo de firmante, comentarios y fecha. Las respuestas familiares conservan la fotografía académica que se revisó. Eventos aditivos; ninguna respuesta modifica o elimina otra.
- `GET /api/boletas/seguimiento`: listado paginado por estado/plantel con permisos académicos.
- `GET /api/boletas/inscripciones/:id`: estado vigente, materias autorizadas e historial privado.
- `POST /api/boletas/inscripciones/:id/responder`: ALUMNO, versión vigente, nombre, tipo ALUMNO/TUTOR, estado ACEPTADA/REVISION, comentarios y confirmado=true.
- `POST /api/boletas/inscripciones/:id/comentarios`: MAESTRO asignado, materia/version/comentarios; conserva el historial.
- Migración `database/mysql/migracion_boletas_firmadas_portales.sql` y espejo SQL Server, incluidos en el manifiesto. Aplicar incremental antes de publicar los clientes/API. No ejecutar `schema.sql` completo sobre una base existente.
- Versiones y respuestas se serializan con bloqueos del ciclo y clase según la operación; no se marca aceptada una boleta leída antes de una modificación concurrente de calificaciones.

## Evidencia y pendientes

Validación local realizada con datos ficticios:

- Backend: lint, typecheck y 101 suites / 578 pruebas unitarias aprobadas.
- Web: lint, compilación y 72 archivos / 267 pruebas aprobadas; incluyen nombres configurables y respuesta nominal del tutor.
- Expo: TypeScript, 27 archivos / 142 pruebas y 11 comprobaciones de scripts aprobadas; exportaciones web y Android aprobadas. La exportación Android no es un APK firmado.
- Integración real: el escenario nuevo de boletas pasó en MySQL 8.4 y SQL Server 2022 (1 aprobado / 131 omitidos por filtro en cada motor). Comprueba publicación, límite de 2000, comentario obligatorio, confirmación, tutor declarado, idempotencia, materia propia/ajena, observaciones de descarga, cambios de notas, historial, Director por plantel y separación de entradas web con cookie HttpOnly y renovación.
- Navegador administrativo: ocho combinaciones SUPERADMIN/MAESTRO × 360/768/1280/1920 px, sin errores JavaScript ni desbordamiento global. Reglas axe WCAG 2 A/AA y 2.1 AA ejecutadas sin infracciones reportadas. No equivale a certificación completa de accesibilidad.
- Expo Web: cuatro anchos con navegación, descarga PDF comprobada, firma nominal del tutor, revisión de 2000 caracteres, confirmación y cierre de sesión; API simulada, sin envío real a proveedores.
- Consistencia 1.34.0 aprobada: 343 consultas de cliente contrastadas con 335 rutas API; migraciones espejo coherentes; `git diff --check` sin errores.
- Los intentos iniciales de integración detectaron configuración incompleta del entorno de prueba, dependencia de un docente creado por otro caso y el bloqueo de acceso del rol Director. Se aislaron los datos de prueba y se corrigió la autenticación; los resultados anteriores corresponden a las repeticiones aprobadas. No se acredita una ejecución completa de los 132 casos ni CI remoto de un SHA nuevo.

Comandos de recorrido: `npm --prefix web run test:boletas` y, tras exportar la app, `npm --prefix mobile run test:web`. Requieren Chromium/Playwright instalado. El recorrido administrativo se añade al job E2E existente de CI. Las pruebas usan datos ficticios y bases desechables. Permanecen pendientes los 62 escenarios UAT y las 8 puertas institucionales; el escenario UAT-62 cubre firma, revisión, permisos y cambios de versión. No se certificaron dispositivos físicos ni se operaron expedientes institucionales.
