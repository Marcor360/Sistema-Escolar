# Auditoría UX/UI orientada a beta — 13 de octubre de 2026

Base revisada: `main` versión 1.23.5. Estado de #28: candidata `1.24.0-beta.1` en revisión, CI verde en el SHA `c5507c7`. Esta auditoría distingue **funcionalidad comprobable por lectura de código**, **brecha detectada** y **validación no realizada**. No se ha realizado una sesión con usuarios, prueba de dispositivo real ni acceso al VPS.

## 1. Referencias de diseño y seguridad

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/): navegación por teclado, foco visible, reflujo y tamaños de objetivo; usar AA como puerta de aceptación.
- [GOV.UK, corregir errores](https://design-system.service.gov.uk/patterns/validation/): conservar respuestas y señalar el campo y el resumen del problema al intentar continuar.
- [GOV.UK, tareas en secuencia](https://design-system.service.gov.uk/patterns/step-by-step-navigation/): revelar prerequisitos y pasos con un orden que responda a la necesidad del usuario.
- [NN/g, reconocimiento frente a recuerdo](https://www.nngroup.com/articles/recognition-and-recall/): seleccionar plantel, ciclo, grupo y materia con su contexto legible.
- [OWASP, carga de archivos](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): autorización, almacenamiento fuera de webroot, listas permitidas, contenido real, cuotas y malware.
- [Expo, almacenamiento](https://docs.expo.dev/develop/user-interface/store-data/): SecureStore para secretos pequeños; no usarlo como almacén de grandes registros académicos.

## 2. Flujo institucional esperado

**Configuración inicial (SUPERADMIN):** crear plantel → revisar datos → crear/ubicar personal → asignar acceso por plantel → configurar identidad visual. El cierre de la operación debe indicar la siguiente acción.

**Preparación académica (ADMINISTRATIVO):** definir ciclo en preparación → materias → docentes → grupos del plantel/ciclo → asignar materias y docente → registrar alumnos → inscribirlos en el grupo vigente. Distinguir creación de expediente e inscripción. Nunca trasladar lógica de gestión a Expo.

**Trabajo docente (MAESTRO):** ver solamente grupos-materia asignados → abrir periodo P1/P2/P3 o Final → capturar/buscar por matrícula → distinguir pendiente/guardada/corregida → justificar correcciones → descargar concentración. El cierre/reapertura es administrativo, no del docente.

**Alumno (Expo):** iniciar sesión y cambiar contraseña temporal → inicio académico → materias y tareas → calificaciones por materia y periodo → boleta del ciclo autorizado → perfil y pagos. Reintentos y estados de red sin mostrar datos de otra sesión. Los archivos no deben quedar expuestos públicamente.

**Operación masiva:** descargar plantilla → completar fuera del sistema → seleccionar plantel/clase/periodo → adjuntar → previsualizar diferencias/errores → confirmar con razón si corrige → consultar resultado y bitácora; transacción atómica, bloqueo de periodo y autorización nuevamente verificados en API.

## 3. Evidencia del repositorio y brechas

| ID | Severidad | Evidencia actual (main) | Hallazgo / impacto |
|---|---|---|---|
| UX-01 | Media | `web/src/pages/Planteles.tsx:50-78` | El alta no presenta una secuencia de configuración ni una acción siguiente clara. |
| UX-02 | Media | `web/src/pages/Usuarios.tsx:84-113` | Tabla de usuarios aún no usa el componente adaptable; lectura difícil en móvil. |
| UX-03 | Media | `web/src/features/alumnos/FormularioAlumno.tsx:32-52`; `web/src/pages/Alumnos.tsx:110-125` | El alta de expediente no comunica suficientemente que la inscripción se realiza aparte. |
| UX-04 | Media | `web/src/pages/Grupos.tsx:135-176` | Alta → asignación → inscripción existen, pero deben mostrar prerequisitos y estado final por paso. |
| UX-05 | Media | `web/src/pages/Calificaciones.tsx:85-106` | Tabla de captura/historial poco adaptable; errores visibles en fila, pero falta confirmar accesibilidad completa. |
| FUN-01 | Alta | `backend/src/reportes/reportes.controller.ts:29-38`, `backend/src/reportes/reportes.service.ts:101-161` | Exportación XLSX existe; no hay ruta de **importación de calificaciones** en `importaciones.controller.ts` ni tipo CALIFICACIONES en `importaciones.dto.ts`. |
| FUN-02 | Media | `backend/src/reportes/reportes.controller.ts:23-28`; `mobile/src/screens/Calificaciones.tsx:19-77` | PDF de boleta existe con auth Bearer, pero no hay descarga desde la app del alumno. Diseñar enlace temporal autorizado o descarga autenticada en la app. |
| FUN-03 | Media | `backend/src/calendario/calendario.controller.ts:17-35` | Sólo GET/POST/DELETE; editar evento no está disponible. |
| FUN-04 | Alta | `backend/src/archivos/archivos.controller.ts:13-38`; `backend/src/archivos/archivos.service.ts:183-195` | Hay descarga privada firmada, pero ninguna biblioteca general con carpetas lógicas, cuotas o organización por recurso/plantel. |
| SEG-01 | Alta | `backend/src/common/upload.config.ts:9-30` | Cargar material/entregas no equivale a poder aceptar fotos institucionales sin política de validación, cuotas, antivirus y conservación. |
| MOB-01 | Alta | `mobile/App.tsx:62-91` en main | Fallo de SecureStore en carga de marca puede dejar arranque bloqueado. #28 incorpora corrección; verificar una vez integrado. |
| OPS-01 | Alta | `backend/src/auth/auth.controller.ts:87-98`, `backend/.env.example:36-43` | Sin SMTP configurado no se puede verificar entrega de recuperación por email; no prometer envío real. |
| QA-01 | Alta | `docs/AUDITORIA_ESTADO_1.23.5_2026-10-13.md` | CI e integración están documentadas, pero faltan pruebas de dispositivo real, aceptación de usuario, red inestable y restore operativo. |

Las ubicaciones citadas son del estado `main` inspeccionado. No afirmar que una función no existe en una rama no inspeccionada. Los hallazgos UX son resultado de revisión estática y deben contrastarse con usuarios antes de atribuirles tasas de error.

## 4. Plan de 18 PR revisables

Los números siguientes son **secuencia propuesta**, no números de GitHub reservados. **#28 queda como dependencia previa** de los cambios móviles que intersecten sus archivos. No crear PR vacíos para alcanzar el objetivo.

| Orden | Entrega independiente | Dependencia | Criterio de aceptación |
|---|---|---|---|
| 01 | Auditoría y matriz de journeys | main | Evidencias archivo/línea y criterios verificables. |
| 02 | Alta de planteles guiada | main | Alta → detalle → siguiente acción; roles y errores. |
| 03 | Gestión de usuarios responsive | main | Creación/corrección; rol/plantel, teclado, 320 px, tabla adaptable. |
| 04 | Alta de alumno y siguiente inscripción | main | Diferenciar expediente de matrícula/grupo; conservar datos ante error. |
| 05 | Ciclos y materias: dependencia visible | main | Estado PREPARACION/VIGENTE/CERRADO explicado, errores claros. |
| 06 | Grupos: pasos de asignación e inscripción | main | Crear → asignar materia/docente → inscribir sin confusión. |
| 07 | Recorrido del maestro | main | Materias, actividades, entrega y calificaciones de clase autorizada. |
| 08 | Calificaciones web accesibles | main | Parcial y Final claros, corrección con motivo, responsive. |
| 09 | Plantilla XLSX para calificaciones | 08 | Identificadores estables, grado/parcial explícitos, sin datos de otros planteles. |
| 10 | Preview de carga de calificaciones XLSX/CSV | 09 | Errores por fila, duplicados y nota 0–100, id y acceso verificados. |
| 11 | Confirmación transaccional de calificaciones | 10 | No cambios parciales, bloqueo de periodo/ciclo, historial y motivo. |
| 12 | Boleta PDF descargable en Expo | #28 | Sólo propia, recurso revocable/autorizado, estado descarga y red. |
| 13 | Edición de calendario | main | DTO PATCH, autorización origen/destino, fechas y concurrencia. |
| 14 | Carpetas lógicas y metadatos de biblioteca | main | Entidades/migraciones espejo, aislamiento plantel, pruebas negativas. |
| 15 | Biblioteca: fotos/logo/calendarios | 14 | Upload privado, firma MIME, antivirus/cuota, descarga segura y UX web. |
| 16 | Caché académica de lectura Expo | #28 | Almacén cifrado o retención mínima, TTL, invalidación por identidad, offline visible. |
| 17 | Recuperación de correo con simulador/staging | main | Respuesta no enumerativa, token único, sin SMTP no se anuncia entrega. |
| 18 | Beta/UAT, permisos, rendimiento y release gates | 01-17 | E2E web+API, CI MySQL/SQL Server, Android/iOS físicos, restore y evidencia. |

Para aceptar la beta: cero fallos críticos/altos sin mitigar; jornadas completas por rol; no filtración cruzada de alumnos; calificaciones exportadas e importadas sin discrepancias; PDF correcto; almacenamiento fuera de IIS; cierre y promoción probados; UAT firmada por responsables.

## 5. Matriz de ejecución y escenarios obligatorios

| Journey | Perfil | Camino feliz | Fallo/negativa necesaria |
|---|---|---|---|
| Alta plantel | SUPERADMIN | Crear y ver detalle, director y personal | Clave repetida, usuario no autorizado, rol multi-plantel |
| Cuenta personal | SUPERADMIN | Asignar rol, planteles, reingresar | Rol no autorizado, sin plantel, sesión vieja revocada |
| Alumno | ADMINISTRATIVO | Crear expediente e inscribirlo | CURP/correo repetidos, plantel ajeno, baja |
| Clase | ADMINISTRATIVO | Asignar materia y maestro | Materia/grupo ajenos, ciclo cerrado |
| Notas | MAESTRO | Capturar parcial, confirmar, descargar XLSX | Docente ajeno, nota >100, periodo cerrado |
| Notas en lote | MAESTRO | Preview → confirmar → bitácora | Archivo alterado, fila duplicada, simultaneidad, rollback |
| Boleta | ALUMNO | Ver y descargar sólo propia | Otro alumno, enlace revocado/expirado, conexión ausente |
| Agenda | ADMINISTRATIVO / MAESTRO | Crear y corregir evento permitido | Fecha final anterior; cambiar a grupo ajeno |
| Carpeta/foto | ADMINISTRATIVO | Crear carpeta, subir foto, compartir autorizado | Path traversal, MIME falso, cuota, descarga ajena |
| Recuperación | Usuario | Solicitud genérica y token válido | Usuario inexistente, sin SMTP, token consumido/vencido |
| Expo | ALUMNO | Inicio, materias, tareas, notas, pagos | Sin red, token renovado, logout, cambio de alumno |

Cada PR funcional: lint, typecheck, build y tests afectados; integración de motores si toca backend/SQL; responsive 320/375/768/1440; teclado y lector; descripción de archivos tocados, riesgos y rollback. **No mezclar una migración irreversible con una entrega UI.** Las acciones de promoción/finanzas siempre se confirman explícitamente.

## 6. Estado del informe

Informe auditado contra código y documentación públicos mediante GitHub. **No ejecutados aquí:** `npm ci`, `lint`, `typecheck`, `build`, pruebas de integración ni tests visuales en dispositivo. La CI del PR #28 reporta éxito, pero está sobre un SHA distinto de main y no certifica las PR futuras. En ningún momento se accedió a datos institucionales ni se alteró servidor.
