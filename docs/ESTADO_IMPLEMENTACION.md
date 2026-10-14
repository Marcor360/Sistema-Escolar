# Estado de implementación — 1.24.0-beta.2

Corte documental: 14 de octubre de 2026. Código de referencia: main, commit 54a5759cb098a856774e897c4f88dcccebfd2a4b, tras integrar #42, #43 y #44. Esta revisión no modifica funcionalidades, contraseñas ni bases institucionales.

## Clasificación

Sistema de información escolar (SIS) multiplantel, con administración académica/financiera y funciones de aula virtual. Arquitectura de monolito modular NestJS, portal React/Vite y cliente Expo exclusivo para ALUMNO. Beta funcional avanzada, candidata a preparar un piloto controlado; pendiente de requisitos de seguridad y aceptación operativa. No es una certificación de producción ni de un ERP general.

## Funciones y límites actuales

| Área | Implementado y localización | Pendiente |
|---|---|---|
| Identidad y acceso | Expedientes, baja/egreso/transferencia/reactivación; permisos por plantel y clase; auth y ScopeService | Sustituir la contraseña inicial derivada de matrícula; requisito confirmado del cliente, aún sin implementar |
| Sesiones | Access 15 minutos, refresh rotativo de hasta 30 días, hash, revocación, cookie HttpOnly web y SecureStore móvil | Ensayo HTTPS, expiración y cambio de cuenta en entornos/dispositivos objetivo |
| Academia | Ciclos en preparación/activo/cierre, grupos, asignaciones, inscripción y promoción transaccional | Validación institucional de cierre/promoción y datos representativos |
| Calificaciones | P1-P3 y Final independiente; motivo/historial, cierre/reapertura, XLSX/CSV con preview cifrado y confirmación única/transaccional | Regla y formatos aceptados por control escolar; archivos institucionales |
| Calendario | Consulta, alta, PATCH y baja; autorización de origen/destino y revision completa para conflictos; web conserva ámbito al editar | Uso real y posibles vistas/exportaciones futuras |
| Documentos | Boleta propia por ciclo/inscripción y enlace de dos minutos; concentrados y adeudos Excel | Formatos oficiales y abrir/guardar PDF en Android/iOS |
| Biblioteca | Administración privada por plantel; carpetas, PNG/JPEG/PDF, firma/MIME, ClamAV obligatorio, cuota y enlaces revocables | Scanner real, ACL, conservación y restore; no concede acceso a alumno/maestro |
| Importaciones | ALUMNOS/DOCENTES/PERSONAL/INSCRIPCIONES, hasta 500 filas/5 MB; plantillas legibles, IDs visibles, preview por actor 15 minutos y confirmación atómica | Activación segura de alumnos y entrega institucional del acceso |
| Web | Recorridos guiados, tablas adaptables, teclado/foco, estados y errores; permisos revalidados en API | UAT por rol/plantel, Edge y auditoría integral de accesibilidad |
| Móvil | Seis pestañas; Perfil → Mis documentos; boletas y materiales por materia, enlaces restringidos al origen/ruta, lectura en memoria hasta cinco minutos, aislamiento por identidad | Build firmado y pruebas físicas; no guarda PDF ni firmas en caché y no confirma tareas/pagos offline |
| Finanzas | Cargos/pagos, idempotencia, cancelación/anulación, conciliación, origen estable tras traslado y cobranza auditable | Openpay sandbox real, SMTP y aceptación contable |
| Conducta y analítica | Incidencias internas, seguimiento y métricas por capacidad/alcance | Política de conservación y validación de indicadores; sin objetivos académicos implementados |
| Push | Opt-in, dispositivo/sesión, cola y recibos; deshabilitado por defecto | EAS/FCM/APNs y entrega física |
| Base | Baseline v1 y ocho incrementales espejo; DB_SYNC=false, runner y pruebas de ambos motores | Estado del servidor real y ensayo en copia histórica |
| ETL | Planteles/alumnos, dry-run y siete pruebas | Esquema certweb sanitizado, TLS/mapeos/conciliación; no apto para migración general |
| Operación | Scripts Windows/IIS, despliegue manual, health live/ready, rollback de código | Instalación real, alertas, respaldo cifrado externo y restore con RPO/RTO observado |

## Evidencia técnica

- #43: backend 208 pruebas en 43 suites y web 97 en 26 archivos; lint, tipos y builds aprobados. CI de main: [38602709436](https://github.com/Marcor360/Sistema-Escolar/actions/runs/38602709436).
- #44: móvil 82 pruebas en 15 archivos, 11 auxiliares, TypeScript y export Android. Los ocho controles del PR aprobaron: [38606558189](https://github.com/Marcor360/Sistema-Escolar/actions/runs/38606558189).
- CI del merge #44, SHA de referencia: [38609744655](https://github.com/Marcor360/Sistema-Escolar/actions/runs/38609744655). Los ocho controles aprobaron para ese SHA. Cada SHA nuevo debe comprobar su propia ejecución; la evidencia no se transfiere automáticamente.
- Integración beta.2 documentada: MySQL 80 casos, SQL Server 77, recorridos Chromium/API/DB y responsive 320–3840. Son suites distintas, no una suma de cobertura única.
- Pruebas con proveedores simulados, exportación Expo y scripts Windows no certifican servicios, teléfonos ni restauración institucional.

## Orden de preparación

1. Implementar [activación segura](REQUERIMIENTO_ACTIVACION_SEGURA.md) y acordar canal de entrega.
2. Staging HTTPS y esquema conciliado; SMTP, Openpay y antivirus reales según servicios habilitados.
3. UAT por rol en al menos dos planteles; archivos/reportes institucionales y pruebas físicas Android/iOS.
4. Restore aislado, monitoreo, responsables, privacidad y aceptación formal.

[Puertas institucionales](BETA_ACEPTACION.json) conserva pendientes sin evidencia firmada. Su estado no se cambia por depurar documentación. [Ejecución beta.2](EJECUCION_BETA_1.24.0-beta.2.md) conserva la historia de las entregas; [índice](README.md) distingue guías vigentes e informes históricos.
