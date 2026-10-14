# Ejecución de la auditoría: 1.24.0-beta.2

Fecha de trabajo: 13 de octubre de 2026 (America/Mexico_City). Base `main`: `01b40b4`. Se incorporaron en una rama de trabajo los SHA `c5507c7` (#28), `5acbdf1` (#29) y `4226606` (#30). Los tres PR originales tenían CI exitosa y se combinaron sin conflictos. Este informe describe la implementación posterior; los informes de beta.1 y de auditoría conservan su contexto histórico.

La candidata añade una migración de biblioteca. No se modificó ni desplegó `main`, no se accedió a producción ni se ejecutaron migraciones sobre datos institucionales. Las bases utilizadas en las pruebas son desechables y contienen cuentas sintéticas.

## Entregas y límites de aceptación

| Orden de #29 | Resultado en esta rama | Evidencia principal |
|---|---|---|
| 01 | Auditoría conservada y complementada con estado de ejecución | #29, este informe y BETA_ACEPTACION.json |
| 02 | Alta guiada de planteles; enlaces siguientes según rol y ayuda asociada al formulario | #30, Planteles.tsx y sus pruebas |
| 03 | Usuarios adaptable y semántico, foco al formulario tras cargar edición de personal y regresiones de #31 | Usuarios.tsx/Usuarios.test.tsx; Chromium 320/375/768/1440 |
| 04 | Alta de expediente diferencia inscripción y ofrece enlace a Grupos | FormularioAlumno.tsx, Alumnos.tsx |
| 05 | Ciclos/materias muestran orden y significado de PREPARACION/ACTIVO/EN_CIERRE/CERRADO | Materias.tsx |
| 06 | Grupos muestran siguiente acción y resumen de asignaciones/docentes/inscritos | Grupos.tsx |
| 07 | Docente: clase autorizada, entregas, reintentos y acceso a notas oficiales; ignora lecturas tardías | Maestro.tsx |
| 08 | Captura e historial adaptables; P1–P3 y Final separados, foco/errores y motivo conservados | Calificaciones.tsx y regresiones |
| 09 | Plantilla XLSX de clase/parcial con ID, matrícula y grado, roster autorizado | importacion-calificaciones.service.ts |
| 10 | CSV/XLSX sin fórmulas, hasta 500 filas/5 MB; errores por fila, duplicados y 0–100 | lector existente, preview de notas y pruebas API |
| 11 | Confirmación única en transacción SERIALIZABLE; bloqueos, revalidación, historial y revisión de notas | motor compartido CalificacionesService, pruebas de atomicidad |
| 12 | Expo abre su boleta con enlace firmado de dos minutos; descarga revalida alumno y sesión | BoletaMovilController, ArchivosService y prueba de logout |
| 13 | PATCH calendario con revisión optimista y autorización de origen/destino | CalendarioService y pruebas API/UI |
| 14 | Carpetas lógicas/metadatos por plantel, entidad y migración espejo aditiva | biblioteca.entity.ts, migracion_biblioteca_privada.sql |
| 15 | Biblioteca administrativa privada con categorías, cuotas, firma MIME y antivirus obligatorio | BibliotecaService, página Biblioteca y pruebas negativas |
| 16 | Materias/notas de Expo: lectura en memoria, TTL de cinco minutos, aviso offline y limpieza por identidad/logout/refresh | cache-academica.ts y pruebas; sin persistencia académica |
| 17 | Recuperación no enumera cuentas ni asegura envío; SMTP ejercitado con simulador local | AuthService, Login y correo-simulado.spec.ts |
| 18 | Pruebas locales, matriz UAT y puertas automatizadas preparadas; aceptación institucional pendiente | BETA_ACEPTACION.json y workflow Beta acceptance gates |

Los órdenes son los del plan, no números reservados de GitHub. Las entregas se implementan en commits por área con dependencias explícitas, sin crear PR vacíos. La biblioteca es administrativa: ni Finanzas, ni docentes, ni alumnos obtienen acceso por conocer el ID o la URL. Los logos almacenados en la biblioteca no cambian automáticamente la marca pública.

## Correcciones encontradas en la revisión de #28–35

- #28: una renovación tardía podía guardar tokens después del cierre local o borrar una cuenta nueva tras un 401 anterior. Las escrituras/borrados de SecureStore se serializan y las solicitudes se asocian a la generación de sesión; se cancelan respuestas antiguas. Regresiones de logout/renovación e identidad nuevas.
- #29: se conserva como auditoría histórica, diferenciando lectura estática, implementación y aceptación externa. El estado actual es esta matriz; no se atribuyen resultados de las pruebas anteriores al SHA futuro.
- #32–35: se conservaron las guías de expediente/inscripción, los estados de éxito de grupo/materia/inscripción, los estados vacíos y regiones/captions de materias/ciclos y de captura/historial, y la revocación diferida de la descarga Excel. Se incorporaron las regresiones originales; los estados vacíos de catálogo esperan el fin de carga y no ocultan un fallo. Los cierres se realizan como sustituidos por #42.
- #31: se conservaron el caption, región semántica y foco posterior al render al editar personal; se incorporó la prueba original y una regresión de foco. Los cambios equivalentes y estas correcciones quedan en #42.
- #30: la guía queda asociada al alta y ofrece enlaces operables hacia personal, materias/ciclos y grupos/inscripciones, respetando roles.

## Contratos añadidos

- `GET /api/importaciones/calificaciones/plantilla?grupoMateriaId=…&parcial=…`: solo Administrativo/Superadmin y docente asignado. Parcial `0` = Final.
- `POST /api/importaciones/calificaciones/preview`: multipart `archivo`, `grupoMateriaId`, `parcial`, `motivo` opcional; ningún cambio académico. Retorna errores y diferencias.
- `POST /api/importaciones/calificaciones/confirmar`: `{previewId, confirmado:true}`. Preview cifrado por actor, 15 minutos, un único consumo. Rechaza notas modificadas desde el preview, periodo/ciclo cerrados o inscripción/asignación no vigente. El lote completo revierte ante fallo.
- `PATCH /api/calendario/:id`: campos a modificar y `revision` de la última lectura. HTTP 409 si fue modificado concurrentemente; no se pierde el formulario.
- `GET /api/biblioteca?plantelId=…&carpetaId=…&pagina=…`, `POST /api/biblioteca/carpetas`, `POST /api/biblioteca/archivos`, `DELETE /api/biblioteca/archivos/:id`.
- `GET /api/archivos/biblioteca/:id/enlace`: enlace de cinco minutos, ligado a sesión/versión. Descarga adjunta privada con `no-store`, MIME verificado y autorización nuevamente comprobada. La baja elimina metadatos y deja una referencia durable para limpiar disco.
- `GET /api/reportes/mis-boletas`: lista propia de ciclos, grupos e inscripciones; permite elegir boleta histórica incluso tras un traslado.
- `GET /api/reportes/mi-boleta/enlace?cicloId=…&inscripcionId=…`: identidad de alumno tomada de sesión, nunca de un ID enviado por la app. Enlace de dos minutos. El PDF vuelve a comprobar que es propio; no se guarda en caché académica.

## Biblioteca: operación y migración

Aplicar `migracion_biblioteca_privada.sql` únicamente mediante el runner documentado, con `DB_SYNC=false`, después de revisar `db:migrate:status`. MySQL y SQL Server tienen el mismo orden en el manifiesto y paridad de entidades/columnas verificada en bases desechables. La migración agrega tablas; no recrea bases ni borra información. `schema.sql` conserva paridad documental, no es un script de actualización.

Configurar `BIBLIOTECA_CUOTA_MB` (100 por defecto; de 1 a 2000), `UPLOADS_DIR` fuera del directorio publicado por IIS y permisos del proceso. Instalar `clamdscan` y un daemon ClamAV actualizado; el scanner debe poder leer la cuarentena. La app usa argumentos de proceso, nunca una orden interpolada en shell. Un timeout, fallo de scanner o detección de malware bloquea la carga. No existe un bypass de antivirus. Archivos permitidos: PNG/JPEG y PDF; fotos/logos solo imágenes. Máximo 10 MB y 500 carpetas por plantel. La cuota se valida bajo bloqueo del plantel antes de publicar metadatos.

Rollback de aplicación: volver al binario anterior y mantener tablas aditivas. No borrar la biblioteca ni sus archivos para revertir código. Las descargas antiguas expiran o se revocan al retirar el recurso/sesión. Revisar limpieza pendiente, ACL y almacenamiento si el antivirus o disco falla.

## Evidencia automatizada local

- Backend: lint sin errores, typecheck, build y 194 pruebas en 41 suites; advertencias históricas de tipos `any` en pruebas existentes.
- Web: lint, build y 87 pruebas de UI en 24 archivos.
- Expo: typecheck, 65 pruebas de flujos/caché/cliente en 11 archivos, 11 pruebas Node y exportación Android correcta. No equivale a certificación nativa.
- MySQL 8.4: 80 casos de integración, incluidos tres recorridos con Chromium/API/DB reales; se amplió el recorrido académico para incluir preview/confirmación de CSV desde UI. La ampliación pasó, y la selección de boleta propia se comprobó además contra API/MySQL reales.
- SQL Server 2022: 77 casos de integración, migraciones/paridad y nuevas pruebas negativas, sin simulación del motor.
- Chromium: pantallas nuevas a 320/375/768/1440, y recorridos existentes a 320–3840; teclado/foco, menú, tamaño de texto y movimiento reducido. Esta suite visual usa API simulada; los E2E anteriores usan API/base real.
- Carga sintética existente: 100 alumnos, tres clases, 900 notas concurrentes. MySQL p95 captura 310 ms; SQL Server 1348 ms, en ejecuciones locales. Importación existente de 500 **cuentas**: preview 94/611 ms y confirmación ~41 s (hash bcrypt). No son benchmarks de hardware institucional ni del importador nuevo de notas.
- El simulador SMTP escucha solo en loopback, usa destinatarios `.invalid` y no entrega a proveedores externos. La prueba positiva de biblioteca simula la aprobación del scanner; valida flujo/aislamiento, no eficacia de un antivirus real.

En la primera ejecución de integración se omitió crear `UPLOADS_DIR` de prueba: fallaron disponibilidad/carga de material; el resto pasó. Se corrigió la preparación de las bases y los directorios, y se repitieron las suites con éxito. El responsive detectó un desbordamiento del formulario de biblioteca a 320 px; se corrigieron los fieldsets/campos y pasó la repetición.

## Aceptación institucional pendiente

`node scripts/check-beta-gates.cjs` valida versión/estructura y muestra pendientes. `--release` rechaza la aceptación hasta que cada puerta tenga estado aprobada, fecha, SHA, aprobador y evidencias. El workflow manual no despliega, publica ni fusiona cambios.

| Puerta | Evidencia requerida para aprobar |
|---|---|
| CI del último SHA | Ocho jobs originales, ambos motores, browser, ETL y Windows sin fallos |
| Journeys web/API en staging | Jornadas completas por rol, import/export sin discrepancias, denegaciones entre planteles y bitácora |
| Android físico | Instalación, teclado, fuente ampliada, lector, red inestable, download, logout y cambio de alumno |
| iOS físico | Mismos casos y apertura/guardado de PDF bajo permisos reales del sistema |
| SMTP staging | Entrega a buzón de prueba institucional, token consumido/vencido y respuesta genérica |
| Antivirus real | Motor/firmas vigentes, archivo permitido, EICAR, caída del scanner y cuota concurrente |
| Restore operativo | Backup/restore en destino aislado, recuentos, ACL fuera de IIS, tiempos y responsables |
| UAT por roles | Firmas de Control escolar, docente, alumno, Finanzas y Superadmin sobre el SHA candidato |

No se inventaron firmas, acceso a VPS, dispositivos físicos ni correo externo. Ninguna puerta se marca aprobada por una prueba local. La candidata es revisable y verificable; la aprobación del piloto permanece pendiente de esa evidencia.
