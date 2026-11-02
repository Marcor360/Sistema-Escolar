# Estado de implementación — candidata 1.35.15

Corte 2/nov/2026 sobre main 1.35.14 (`c10da9a`). Revisión del ciclo de alumnos, códigos tras baja/reactivación y documentación vigente. [Recorridos y resultados](BARRIDO_Y_CICLO_ALUMNOS_2026-11-02.md) y [preparación del piloto](PILOTO_PRODUCCION.md).

La actualización coordinada de sistema y Portal Alumno está integrada en main mediante #240. Su CI aprobada corresponde al SHA `74ab0d5`; no acredita ejecución en IIS ni despliegue institucional. Esta candidata no añade migraciones. [Guía de actualización](ACTUALIZACION_INTEGRAL_1.35.14.md).

Los cortes anteriores se consultan en el [historial de entregas](HISTORIAL_VERSIONES.md), sus contratos y Git. Las confirmaciones generales de logo, correo, Android y permisos se conservan; no equivalen a aceptar esta candidata.

## Clasificación

Sistema de información escolar (SIS) multiplantel, con administración académica/financiera y funciones de aula virtual. Arquitectura de monolito modular NestJS, portal React/Vite y cliente Expo exclusivo para ALUMNO. Beta funcional avanzada, candidata a preparar un piloto controlado; pendiente de requisitos de seguridad y aceptación operativa. No es una certificación de producción ni de un ERP general.

## Funciones y límites actuales

Marca en #163: entrada web PNG/JPEG/WebP ≤20 MiB, salida/API WebP ≤10 MiB, metadatos públicos `no-store`, logos UUID con caché inmutable y revalidación web/Expo cada minuto activo. Persistencia de metadatos públicos en localStorage/SecureStore; las imágenes no se guardan como caché offline propia. Requiere UAT IIS/ACL y recompilar la app instalada. [Contrato](LOGO_WEBP_STAGING_1.27.18.md).

| Área | Implementado y localización | Pendiente |
|---|---|---|
| Identidad y acceso | Expedientes, baja/egreso/transferencia/reactivación; permisos por plantel y clase; auth y ScopeService | Recepción SMTP confirmada por el solicitante para ambos proveedores; validar alta/activación y baja/retorno de esta candidata con responsables |
| Sesiones | Access 15 minutos, refresh rotativo de hasta 30 días, hash, revocación, cookie HttpOnly web y SecureStore móvil | Ensayo HTTPS, expiración y cambio de cuenta en entornos/dispositivos objetivo |
| Academia | Ciclos en preparación/activo/cierre, grupos, asignaciones, inscripción y promoción transaccional | Validación institucional de cierre/promoción y datos representativos |
| Calificaciones | Candidata P1–P4/0–10, criterios y Final manual; histórico P1–P3/0–100 conservado; auditoría, cierres y preview de importación | Decimales y aprobación manual confirmados; validar UAT vigente y formatos oficiales |
| Asistencias | Captura por profesor asignado, consulta propia en web/Expo y administrativa por plantel, historial y revisión | UAT por clase/plantel, ciclo y Android/iOS físicos; sin reglas de sanción o nota |
| Seguimiento | Pendientes por rol, diagnóstico de datos, trámites con folio/estado/responsable, preferencias y sesiones propias | UAT de estados, alcance, accesibilidad y notificaciones reales |
| Conciliación CSV | Vista previa, folios persistidos, sugerencia por referencia interna y aplicación individual idempotente | Formato bancario institucional y aceptación contable |
| Recuperación | Scripts de respaldo diario y restore semanal aislado, hashes, copia externa opcional y alerta web de estado | Configuración/ACL/tareas en Windows, cifrado/retención externa, restore real y RPO/RTO |
| Calendario | Consulta, alta, PATCH y baja; ciclo/nivel y audiencias; vistas mensual/ciclo/imagen en web y Expo alumno; enlaces firmados privados | Migración incremental, carga institucional de imágenes, accesibilidad y UAT por nivel/plantel |
| Documentos | Boleta propia por ciclo/inscripción y enlace de dos minutos; concentrados y adeudos Excel | Formatos oficiales y abrir/guardar PDF en Android/iOS |
| Biblioteca | Administración privada por plantel; carpetas, PNG/JPEG/PDF, firma/MIME, ClamAV obligatorio, cuota y enlaces revocables | Scanner real, ACL, conservación y restore; no concede acceso a alumno/maestro |
| Importaciones | ALUMNOS/DOCENTES/PERSONAL/INSCRIPCIONES, hasta 500 filas/5 MB; plantillas legibles, IDs visibles, preview cifrado por actor de 15 minutos; alumnos nuevos válidos se confirman en transacción, existentes se omiten e inválidos se exportan para corrección | Activación y recuperación confirmadas por el solicitante; validar nuevas importaciones en esta candidata |
| Web | Recorridos guiados, tablas adaptables, teclado/foco, estados y errores; permisos revalidados en API | UAT por rol/plantel, Edge y auditoría integral de accesibilidad |
| Móvil | Cinco pestañas (Inicio, Materias, Calificaciones, Pagos y Perfil); tareas desde Materias; Perfil → Mis documentos; boletas y materiales por materia, enlaces restringidos al origen/ruta, lectura en memoria hasta cinco minutos, aislamiento por identidad | Build firmado y pruebas físicas; no guarda PDF ni firmas en caché y no confirma tareas/pagos offline |
| Finanzas | Cargos/pagos, idempotencia, cancelación/anulación, conciliación, origen estable tras traslado y cobranza auditable | Openpay sandbox real y aceptación contable; correo confirmado por el solicitante |
| Conducta y analítica | Incidencias internas, seguimiento y métricas por capacidad/alcance | Política de conservación y validación de indicadores; sin objetivos académicos implementados |
| Push | Opt-in, dispositivo/sesión, cola y recibos; deshabilitado por defecto | EAS/FCM/APNs y entrega física |
| Base | Baseline v1 y migraciones incrementales espejo según el manifiesto vigente; DB_SYNC=false, runner y pruebas de ambos motores | Estado del servidor real y ensayo en copia histórica |
| ETL | Planteles/alumnos, dry-run y siete pruebas | Esquema certweb sanitizado, TLS/mapeos/conciliación; no apto para migración general |
| Operación | Scripts Windows/IIS, despliegue manual, health live/ready, rollback de código; actualizador coordinado de sistema/Portal Alumno con planificación y bloqueo exclusivo | Verificar versión efectiva del host, alertas, respaldo cifrado externo y restore con RPO/RTO observado |

## Cambios consolidados y evidencia técnica

- #180–182: correo GoDaddy/Microsoft 365 por usuario, correo personal y proveedor en importación; carga parcial sin duplicados y perfil propio editable web/Expo. El proveedor es obligatorio en cada fila de alumno en el contrato actual.
- #183–185: diálogos legibles, tutorial navegable repetible desde Configuración y teléfono del alumno junto a los correos.
- #186: activación Expo por correo/código/contraseña; espera de reenvío de 60 segundos persistida. El backend conserva código y caducidad, serializa solicitudes y mantiene respuesta genérica. La aceptación del proveedor no demuestra recepción.
- [CI de #186](https://github.com/Marcor360/Sistema-Escolar/actions/runs/40061064901): 8 jobs aprobados para `325c2dac4f251a72d895c549d64bc711ebc7a26b`, integrado mediante `e4b815e`. Incluye MySQL, SQL Server y recorridos con API/base reales. Estos resultados corresponden a ese SHA, no certifican automáticamente esta candidata.
- Cada entrega valida su SHA final. CI no certifica IIS/ACL, teléfonos, recepción de correo, proveedores externos ni restauración institucional.

## Pendientes actuales

- #210: UAT de la candidata y formatos oficiales; decimales y aprobación manual confirmados; implementación y aprobación explícita de #139 en PR #209; no es falta de aprobación general del reglamento.
- #152/#177: funcionalidad integrada en cartera y reinscripción; no son desarrollo pendiente. Validar los recorridos institucionales de la candidata vigente.
- #158: protección de main. #179: proveedor y consentimiento para WhatsApp/llamadas.
- Operación: comprobar versión desplegada, restore aislado, antivirus y conciliación de datos históricos.

Logo (#106), correo (#107), permisos (#140) y aceptación de Android (#141) fueron confirmados por el solicitante y cerrados en GitHub. No convertir estas confirmaciones generales en aprobación de todos los casos UAT ni de iOS. Las matrices conservan los escenarios y pendientes por versión; las pruebas automatizadas no los aprueban por sí solas. No se ha desplegado ni aplicado migraciones institucionales desde este trabajo.
