# Estado de implementación — candidata 1.27.19

Corte documental: 21 de octubre de 2026. Base: `main` 1.27.18 (`fd2b9dc`), tras integrar #163. La candidata 1.27.19 depura documentación y actualiza metadatos de versión; conserva el comportamiento funcional. [Contrato de marca](LOGO_WEBP_STAGING_1.27.18.md) e [informes retirados](HISTORIAL.md). La versión del código no acredita despliegue ni aceptación institucional.

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
| Calendario | Consulta, alta, PATCH y baja; autorización de origen/destino y revision completa para conflictos; web conserva ámbito al editar | Uso real y posibles vistas/exportaciones futuras |
| Documentos | Boleta propia por ciclo/inscripción y enlace de dos minutos; concentrados y adeudos Excel | Formatos oficiales y abrir/guardar PDF en Android/iOS |
| Biblioteca | Administración privada por plantel; carpetas, PNG/JPEG/PDF, firma/MIME, ClamAV obligatorio, cuota y enlaces revocables | Scanner real, ACL, conservación y restore; no concede acceso a alumno/maestro |
| Importaciones | ALUMNOS/DOCENTES/PERSONAL/INSCRIPCIONES, hasta 500 filas/5 MB; plantillas legibles, IDs visibles, preview por actor 15 minutos y confirmación atómica | Ensayo institucional de entrega y activación por correo; cuentas nuevas permanecen pendientes sin SMTP operativo |
| Web | Recorridos guiados, tablas adaptables, teclado/foco, estados y errores; permisos revalidados en API | UAT por rol/plantel, Edge y auditoría integral de accesibilidad |
| Móvil | Cinco pestañas (Inicio, Materias, Calificaciones, Pagos y Perfil); tareas desde Materias; Perfil → Mis documentos; boletas y materiales por materia, enlaces restringidos al origen/ruta, lectura en memoria hasta cinco minutos, aislamiento por identidad | Build firmado y pruebas físicas; no guarda PDF ni firmas en caché y no confirma tareas/pagos offline |
| Finanzas | Cargos/pagos, idempotencia, cancelación/anulación, conciliación, origen estable tras traslado y cobranza auditable | Openpay sandbox real, SMTP y aceptación contable |
| Conducta y analítica | Incidencias internas, seguimiento y métricas por capacidad/alcance | Política de conservación y validación de indicadores; sin objetivos académicos implementados |
| Push | Opt-in, dispositivo/sesión, cola y recibos; deshabilitado por defecto | EAS/FCM/APNs y entrega física |
| Base | Baseline v1 y 19 incrementales espejo según el manifiesto; DB_SYNC=false, runner y pruebas de ambos motores | Estado del servidor real y ensayo en copia histórica |
| ETL | Planteles/alumnos, dry-run y siete pruebas | Esquema certweb sanitizado, TLS/mapeos/conciliación; no apto para migración general |
| Operación | Scripts Windows/IIS, despliegue manual, health live/ready, rollback de código; README informa staging 1.27.17 | Verificar versión efectiva del host, alertas, respaldo cifrado externo y restore con RPO/RTO observado |

## Evidencia técnica

- [CI de #163, ejecución 39644029772](https://github.com/Marcor360/Sistema-Escolar/actions/runs/39644029772): ocho jobs aprobados para `301d7f1a94bdd296b7048cfb9be41e9fb03925c0`, integrado mediante `fd2b9dc`. Incluye backend/web/mobile, MySQL, SQL Server, ETL, scripts Windows y recorridos web.
- Verificación local de esa entrega: backend 365 pruebas en 68 suites; web 200 en 50 archivos; móvil 117 en 21 archivos y 11 controles auxiliares; lint/tipos/build web satisfactorios. Son resultados de ese código, no una ejecución nueva de cada versión.
- La CI de 1.27.19 debe comprobar su SHA final; los resultados previos no certifican commits posteriores. Las pruebas automatizadas no certifican IIS/ACL, teléfonos, proveedores externos ni restore institucional.

## Pendientes actuales

| Pendiente | Fuente y validación necesaria |
|---|---|
| Logo en staging (#106) | [Contrato WebP/IIS](LOGO_WEBP_STAGING_1.27.18.md): POST real, GET 200, permisos y persistencia tras reinicio/redeploy. |
| Correo institucional (#107) | [SMTP staging](SMTP_STAGING_IUA.md) y [dominio compartido](SMTP_DOMINIO_COMPARTIDO_MICROSOFT365.md): recepción real y seguimiento de entrega. |
| Permisos definitivos (#140) | [Matriz de acceso](MATRIZ_ACCESO.md), revisión por institución/plantel. |
| Evaluación, escala y actas (#139) | [Plan condicionado](PLAN_CALIFICACIONES_ACTAS_1.28.0.md); conservar escala vigente y no emitir actas oficiales sin norma/firmas aprobadas. |
| Accesibilidad y app física (#141) | [Matriz UAT](UAT_MATRIZ_2026-10-15.json), Android/iOS, lectores de pantalla, red y sesiones. |
| Operación y datos | [Puertas beta](BETA_ACEPTACION.json): SMTP, antivirus real, restore y UAT. ETL requiere esquema sanitizado, TLS y conciliación. |

Las ocho puertas institucionales y los trece escenarios UAT permanecen pendientes. El consentimiento institucional y la política de inscripción ordinaria conservan su habilitación explícita; esta limpieza no los activa. Staging 1.27.17 sigue siendo la última versión informada por el operador en README; no se obtuvo evidencia nueva del host. La app instalada requiere compilación/actualización para ejecutar cambios nuevos.
