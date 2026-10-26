# Estado de implementación — candidata 1.27.54

Corte documental: 26 de octubre de 2026. Base: `main` 1.27.53 tras integración #202. La candidata 1.27.54 añade [recorridos por área y comparativas](RECORRIDOS_COMPARATIVAS_1.27.54.md), cierra diferencias de UX y completa la vista previa de correcciones y las etiquetas de sesiones. La infraestructura de seguimiento/asistencias de #202 se conserva. No acredita despliegue, UAT, instalación de tareas ni restore institucional. La escala 0–100 y P1–P3/Final no cambia.

## Clasificación

Sistema de información escolar (SIS) multiplantel, con administración académica/financiera y funciones de aula virtual. Arquitectura de monolito modular NestJS, portal React/Vite y cliente Expo exclusivo para ALUMNO. Beta funcional avanzada, candidata a preparar un piloto controlado; pendiente de requisitos de seguridad y aceptación operativa. No es una certificación de producción ni de un ERP general.

## Funciones y límites actuales

Marca en #163: entrada web PNG/JPEG/WebP ≤20 MiB, salida/API WebP ≤10 MiB, metadatos públicos `no-store`, logos UUID con caché inmutable y revalidación web/Expo cada minuto activo. Persistencia de metadatos públicos en localStorage/SecureStore; las imágenes no se guardan como caché offline propia. Requiere UAT IIS/ACL y recompilar la app instalada. [Contrato](LOGO_WEBP_STAGING_1.27.18.md).

| Área | Implementado y localización | Pendiente |
|---|---|---|
| Identidad y acceso | Expedientes, baja/egreso/transferencia/reactivación; permisos por plantel y clase; auth y ScopeService | Altas nuevas sin contraseña predecible, pendientes hasta activación por código privado; aceptación SMTP institucional pendiente |
| Sesiones | Access 15 minutos, refresh rotativo de hasta 30 días, hash, revocación, cookie HttpOnly web y SecureStore móvil | Ensayo HTTPS, expiración y cambio de cuenta en entornos/dispositivos objetivo |
| Academia | Ciclos en preparación/activo/cierre, grupos, asignaciones, inscripción y promoción transaccional | Validación institucional de cierre/promoción y datos representativos |
| Calificaciones | P1-P3 y Final independiente; motivo/historial, cierre/reapertura, XLSX/CSV con preview cifrado y confirmación única/transaccional | Regla y formatos aceptados por control escolar; archivos institucionales |
| Asistencias | Captura por profesor asignado, consulta propia en web/Expo y administrativa por plantel, historial y revisión | UAT por clase/plantel, ciclo y Android/iOS físicos; sin reglas de sanción o nota |
| Seguimiento | Pendientes por rol, diagnóstico de datos, trámites con folio/estado/responsable, preferencias y sesiones propias | UAT de estados, alcance, accesibilidad y notificaciones reales |
| Conciliación CSV | Vista previa, folios persistidos, sugerencia por referencia interna y aplicación individual idempotente | Formato bancario institucional y aceptación contable |
| Recuperación | Scripts de respaldo diario y restore semanal aislado, hashes, copia externa opcional y alerta web de estado | Configuración/ACL/tareas en Windows, cifrado/retención externa, restore real y RPO/RTO |
| Calendario | Consulta, alta, PATCH y baja; ciclo/nivel y audiencias; vistas mensual/ciclo/imagen en web y Expo alumno; enlaces firmados privados | Migración incremental, carga institucional de imágenes, accesibilidad y UAT por nivel/plantel |
| Documentos | Boleta propia por ciclo/inscripción y enlace de dos minutos; concentrados y adeudos Excel | Formatos oficiales y abrir/guardar PDF en Android/iOS |
| Biblioteca | Administración privada por plantel; carpetas, PNG/JPEG/PDF, firma/MIME, ClamAV obligatorio, cuota y enlaces revocables | Scanner real, ACL, conservación y restore; no concede acceso a alumno/maestro |
| Importaciones | ALUMNOS/DOCENTES/PERSONAL/INSCRIPCIONES, hasta 500 filas/5 MB; plantillas legibles, IDs visibles, preview cifrado por actor de 15 minutos; alumnos nuevos válidos se confirman en transacción, existentes se omiten e inválidos se exportan para corrección | Ensayo institucional de entrega y activación por correo; cuentas nuevas permanecen pendientes sin SMTP operativo |
| Web | Recorridos guiados, tablas adaptables, teclado/foco, estados y errores; permisos revalidados en API | UAT por rol/plantel, Edge y auditoría integral de accesibilidad |
| Móvil | Cinco pestañas (Inicio, Materias, Calificaciones, Pagos y Perfil); tareas desde Materias; Perfil → Mis documentos; boletas y materiales por materia, enlaces restringidos al origen/ruta, lectura en memoria hasta cinco minutos, aislamiento por identidad | Build firmado y pruebas físicas; no guarda PDF ni firmas en caché y no confirma tareas/pagos offline |
| Finanzas | Cargos/pagos, idempotencia, cancelación/anulación, conciliación, origen estable tras traslado y cobranza auditable | Openpay sandbox real, SMTP y aceptación contable |
| Conducta y analítica | Incidencias internas, seguimiento y métricas por capacidad/alcance | Política de conservación y validación de indicadores; sin objetivos académicos implementados |
| Push | Opt-in, dispositivo/sesión, cola y recibos; deshabilitado por defecto | EAS/FCM/APNs y entrega física |
| Base | Baseline v1 y migraciones incrementales espejo según el manifiesto vigente; DB_SYNC=false, runner y pruebas de ambos motores | Estado del servidor real y ensayo en copia histórica |
| ETL | Planteles/alumnos, dry-run y siete pruebas | Esquema certweb sanitizado, TLS/mapeos/conciliación; no apto para migración general |
| Operación | Scripts Windows/IIS, despliegue manual, health live/ready, rollback de código; README informa staging 1.27.17 | Verificar versión efectiva del host, alertas, respaldo cifrado externo y restore con RPO/RTO observado |

## Cambios consolidados y evidencia técnica

- #180–182: correo GoDaddy/Microsoft 365 por usuario, correo personal y proveedor en importación; carga parcial sin duplicados y perfil propio editable web/Expo. El proveedor es obligatorio en cada fila de alumno en el contrato actual.
- #183–185: diálogos legibles, tutorial navegable repetible desde Configuración y teléfono del alumno junto a los correos.
- #186: activación Expo por correo/código/contraseña; espera de reenvío de 60 segundos persistida. El backend conserva código y caducidad, serializa solicitudes y mantiene respuesta genérica. La aceptación del proveedor no demuestra recepción.
- [CI de #186](https://github.com/Marcor360/Sistema-Escolar/actions/runs/40061064901): 8 jobs aprobados para `325c2dac4f251a72d895c549d64bc711ebc7a26b`, integrado mediante `e4b815e`. Incluye MySQL, SQL Server y recorridos con API/base reales. Estos resultados corresponden a ese SHA, no certifican automáticamente esta candidata.
- Cada entrega valida su SHA final. CI no certifica IIS/ACL, teléfonos, recepción de correo, proveedores externos ni restauración institucional.

## Pendientes actuales

| Pendiente | Fuente y validación necesaria |
|---|---|
| Logo en staging (#106) | [Contrato WebP/IIS](LOGO_WEBP_STAGING_1.27.18.md): POST real, GET 200, permisos y persistencia tras reinicio/redeploy. |
| Correo institucional (#107) | [SMTP staging](SMTP_STAGING_IUA.md) y [dominio compartido](SMTP_DOMINIO_COMPARTIDO_MICROSOFT365.md): recepción real y seguimiento de entrega. |
| Permisos definitivos (#140) | [Matriz de acceso](MATRIZ_ACCESO.md), revisión por institución/plantel. |
| Evaluación, escala y actas (#139) | [Plan condicionado](PLAN_CALIFICACIONES_ACTAS_1.28.0.md); conservar escala vigente y no emitir actas oficiales sin norma/firmas aprobadas. |
| Accesibilidad y app física (#141) | [Matriz UAT](UAT_MATRIZ_2026-10-15.json), Android/iOS, lectores de pantalla, red y sesiones. |
| Operación y datos | [Puertas beta](BETA_ACEPTACION.json): SMTP, antivirus real, restore y UAT. ETL requiere esquema sanitizado, TLS y conciliación. |

Las puertas institucionales y los escenarios UAT conservan sus estados registrados en las matrices. El consentimiento institucional y la política de inscripción ordinaria conservan su habilitación explícita; esta entrega no los activa. El informe histórico de staging 1.27.17 no acredita la versión actual del host; comprobar health y release activa. No se obtuvo evidencia nueva del servidor. La app instalada requiere compilación/actualización para ejecutar cambios nuevos.
