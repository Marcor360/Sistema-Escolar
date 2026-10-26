# Seguimiento, asistencias y operación · 1.27.53

Base de entrega: main tras PR #201 (1.27.52). Incluye API NestJS, web y consulta propia en Expo. Las migraciones son aditivas y no se aplican a servidores institucionales desde el desarrollo.

## Asistencias

Web → Asistencias; Expo → Inicio → Mis asistencias, trámites y pendientes. La asistencia es por **clase (grupo-materia), alumno y día escolar**; no pretende representar horarios, varias sesiones de la misma clase en un día ni asistencia global del plantel.

Solo MAESTRO con expediente activo y asignación de esa clase captura. Incluso SUPERADMIN necesita rol docente y asignación para escribir. ALUMNO solo consulta lo propio; ADMINISTRATIVO consulta sus planteles; SUPERADMIN consulta globalmente; FINANZAS no concede capacidad académica. Los roles mixtos conservan esta separación.

Estados PRESENTE, FALTA, RETARDO y JUSTIFICADA. La pantalla no presume un estado: todos los alumnos deben seleccionarse expresamente. No permite fechas futuras ni fuera del ciclo; ciclo/grupo/plantel deben estar activos. Unicidad clase/fecha/alumno, revisión optimista y transacción con locks de ciclo/clase. Cada cambio guarda autor, estado anterior/nuevo, motivo y fecha. La justificación la registra el profesor; no se adjuntan documentos ni se calculan sanciones, porcentajes mínimos o notas sin política institucional. La consulta conserva registros históricos propios aunque cambie la inscripción; las capturas exigen inscripción vigente. Consultas de hasta 366 días, paginadas en bloques de 100.

## Centro de pendientes y calidad de datos

El inicio web y el seguimiento Expo presentan conteos autorizados: actividades sin entrega del alumno, cargos por cubrir, entregas sin calificar del profesor, trámites abiertos y grupos sin nivel para personal autorizado. Los conteos informan registros del sistema; no acreditan obligaciones según horarios ni reglas institucionales nuevas.

El diagnóstico administrativo detecta expedientes activos con CURP/teléfono faltante, CURP repetida dentro de su alcance y grupos activos sin nivel, además de inscripciones activas en ciclo vigente cuyo plantel difiera del expediente. Muestra hasta 100 resultados por categoría y enlaces a los editores existentes; no fusiona alumnos, no modifica inscripciones ni infiere niveles. Revisar la información del expediente antes de confirmar una corrección en su editor.

## Trámites

El alumno solicita CONSTANCIA, CORRECCION o DOCUMENTO con detalle y clave idempotente. Folio numérico, plantel de origen, responsable, revisión e historial. Flujo SOLICITADO → EN_REVISION → RESUELTO/RECHAZADO; el alumno puede CANCELAR mientras siga SOLICITADO. Personal autorizado puede cerrar; estados terminales no se reabren automáticamente. El responsable debe tener capacidad administrativa y acceso al plantel. El mensaje de seguimiento es visible al alumno: no incluir notas internas.

La interfaz permite al administrativo asignarse el trámite; la API permite asignar otro responsable autorizado. Resolver no genera documentos oficiales, firmas, cobros ni correos externos. La lista muestra los últimos 100 trámites del alcance.

## Conciliación bancaria

Web → Seguimiento. CSV normalizado UTF-8, hasta 500 movimientos/1 MiB (sin subir el archivo bruto al servidor), columnas `folio,referencia,fecha,monto`; delimitador coma o punto y coma; fecha AAAA-MM-DD, monto positivo con punto decimal y sin separadores de miles. No se trata de un formato homologado de BBVA ni de una conexión bancaria.

Elegir plantel y alias **estable** de cuenta. Folio real del banco único por cuenta/plantel; no usar la referencia interna como folio ni cambiar alias para reimportar la misma cuenta. La vista previa detecta duplicados y propone un cargo solo si la referencia corresponde al identificador interno `IUA-C…` del plantel; no aplica pagos automáticamente. Confirmar primero la importación y después cada aplicación cotejada. Las filas importadas conservan fecha, monto, referencia y folio.

La aplicación reserva un cargo y una clave de pago persistida antes de registrar por PagosService. Un reintento recupera el mismo pago tras una interrupción; no permite cambiar de cargo una vez reservado. Valida plantel, saldo, órdenes Openpay pendientes y folio confirmado; conserva fecha civil bancaria (hora convencional de mediodía escolar). Una fila ASIGNADO tras fallo permite reintentar el mismo cargo; para una asignación errónea se requiere revisión operativa antes de cambiar datos. No hay pagos masivos sin confirmación ni borrado de movimientos.

## Preferencias, sesiones y calendario

Preferencias GENERAL/ACADEMICA/FINANCIERA para push y correo opcional. La bandeja interna siempre conserva los avisos; push sigue sujeto a permiso del dispositivo y proveedor habilitado. Se revalida preferencia antes de transmitir push ya encolado. La cobranza opcional respeta correo FINANCIERA y registra OMITIDO; activación, recuperación y avisos de seguridad no se silencian. Guardar preferencias no envía correos ni activa proveedores.

Cada cuenta consulta portal, última actividad y expiración de sus sesiones, y puede revocar las otras individualmente. No se exponen refresh hashes, tokens ni IP. Para salir de la sesión actual se usa Cerrar sesión. El portal no identifica modelo físico de dispositivo.

Calendario: selector del evento para editar alcance/ciclo/nivel/audiencia y contenido, sustitución de imagen con revisión y limpieza persistida del archivo anterior, eliminación confirmada, historial de autor/acción/alcance, sincronización de cuadrícula/listado, carga/reintento y agenda en texto. La imagen requiere título; para acceso a todas las fechas registrar también los eventos digitales. Aviso optativo académico a alumnos actualmente inscritos del ámbito; mensaje genérico sin datos privados y cola persistida. No hay difusión automática a docentes o personal de audiencias internas.

Exportación `.ics` de eventos autorizados visibles, sin imágenes ni URLs firmadas. Importación con vista previa/confirmación de hasta 100 eventos con UID; admite fechas completas y UTC, rechaza recurrencias o TZID sin convertir. Los UID repetidos en el mismo ciclo/nivel/plantel se omiten al reimportar: editar explícitamente un evento para actualizarlo. Una importación no dispara avisos por cada fila.

## Recuperación operativa

`Backup-Escolar.ps1`: respaldo SQL + uploads con servicio detenido para consistencia, manifiesto SHA-256, estado seguro y copia externa opcional. MySQL usa cuenta exclusiva y TLS VERIFY_IDENTITY; SQL Server local usa TLS validado, COPY_ONLY y CHECKSUM/VERIFYONLY. El host y las cuentas deben permitir el procedimiento; no se instala ni ejecuta desde la API.

`Register-EscolarBackup.ps1`: registro manual elevado de tarea diaria a las 03:00 del host; requiere zona America/Mexico_City, ACL restrictivas para config/backups, ventana de interrupción aceptada y cuenta exclusiva en backup.env. La tarea usa SYSTEM; la copia externa requiere permisos de esa identidad. No basta crear la tarea: comprobar su resultado y ensayar una ejecución controlada.

`Test-EscolarBackup.ps1`: valida hashes, crea/restaura una base **nueva** con prefijo escolar_staging_restore_ y extrae uploads en un directorio nuevo; se niega a sobrescribir bases o archivos existentes. MySQL importa el SQL con TLS; SQL Server local restaura con MOVE y ejecuta CHECKDB. Ambos comprueban la tabla usuarios y el conteo de archivos del ZIP. Sin parámetros selecciona el último manifest y genera un destino único. `Register-EscolarBackup.ps1 -IncludeWeeklyRestore` añade, por invocación operativa explícita, un ensayo los domingos a las 05:00 del host. Requiere usuario RESTORE con privilegios para bases aisladas, certificados y espacio; conserva bases/archivos para inspección y limpieza operativa. El restore técnico aún exige UAT de conteos, descargas y conciliación; VERIFYONLY por sí solo **no** acredita restauración. Los scripts no borran respaldos, bases de ensayo ni uploads.

`BACKUP_STATUS_PATH` permite a SUPERADMIN consultar estado/antigüedad; alerta cuando no hay éxito en 36 horas, falta configuración o el archivo no está disponible. No hay monitor externo ni envío de alertas fuera del portal: un host apagado requiere supervisión externa institucional. Configurar almacenamiento externo cifrado/ACL, retención y RPO/RTO según la institución; no se asume cifrado por el script ni se acredita restore en este PR.

## Base de datos y validación

Incremental espejo `migracion_seguimiento_asistencias.sql`: asistencias e historial, trámites e historial, preferencias, movimientos bancarios, historial de calendario y clave nullable de importación con índice único compatible con SQL Server. Entidades y schema documental sincronizados; baseline v1 intacto. Aplicar mediante el runner, con respaldo y restore comprobado, nunca schema.sql completo ni DB_SYNC=true.

Pruebas automatizadas y sus resultados se registran en el PR. UAT-32–36 permanecen pendientes. No acredita despliegue IIS, instalación de tareas, recepción SMTP, dispositivos Android/iOS físicos ni aceptación contable/institucional.
