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
| Base | Baseline v1 y nueve incrementales espejo; DB_SYNC=false, runner y pruebas de ambos motores | Estado del servidor real y ensayo en copia histórica |
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

## Actualización de sesión y consultas — #46

Web y Expo cierran localmente después de 30 minutos sin interacción humana. Consultas y refresh automáticos no reinician ese plazo; se comprueba al reanudar. Web comparte actividad/cierre entre pestañas; móvil serializa escritura y limpieza de la marca temporal para que un logout anterior no borre la actividad del login nuevo.

Estado de cuenta invalida saldo anterior al recargar, después de cinco minutos o ante fallo; antes de ordenar consulta otra vez y detecta cambios. Materias retira listados de materiales al actualizar. Eventos móviles usan America/Mexico_City.

Esta política es del cliente: sin red la revocación remota no puede confirmarse y el backend conserva access de 15 minutos y refresh máximo de 30 días. No equivale a inactividad absoluta en API. [Contrato, regresiones y QA física pendiente](CIERRE_INACTIVIDAD_30M_2026-10-14.md).

## Ampliación de inactividad en API — #47–51

El conjunto añade comprobación de última señal autenticada en JWT, refresh y enlaces firmados, con revocación a los 30 minutos. Login inicializa la marca y clientes web/Expo notifican interacción limitada a un pulso por minuto. Peticiones de fondo no renuevan. La revocación es condicional frente a actividad concurrente.

Esto amplía el cierre local descrito en #46; sus límites anteriores son históricos respecto de esta entrega. Access sigue 15 minutos y refresh máximo 30 días. La señal del cliente no demuestra presencia humana. Requiere la novena migración y clientes coordinados; sesiones históricas NULL exigen reingreso. [Contrato y aceptación](SESIONES_INACTIVIDAD_PLAN.md).

## Recorridos y adjuntos del alumno — #52–56

Se amplían las regresiones API/base real: lectura propia de notas sin acceso a captura/listados del personal; entrega evaluada visible en tareas; PDF propio por inscripción con no-store y firma de contenido, rechazo de expediente ajeno; saldo después de pago parcial sin permiso para registrar pagos manuales.

Expo comprueba URI local file/content cuando está presente, tamaño finito y nombre sin rutas ni controles, conservando Unicode. El envío real valida el asset del selector nativo; las comprobaciones del servidor siguen siendo definitivas. [Detalle de privacidad](../mobile/docs/PRIVACIDAD_SELECTOR_ARCHIVOS_2026-10-14.md). No se certifica limpieza física de la copia temporal ni pruebas en dispositivos.

### Cierre IUA 11–12: navegación y recuperación de tareas

Las seis pestañas de alumno incluyen etiquetas explícitas para lectores de pantalla. Tareas conserva la última consulta como referencia ante un fallo, permite reintentar y bloquea entregas mientras se actualiza o al vencer cinco minutos. La vigencia se comprueba también después de cerrar el selector de archivos, evitando enviar con una consulta vencida durante la selección. Las pruebas cubren fallo y recuperación de red y vencimiento durante el selector. Continúa pendiente la validación en dispositivos con TalkBack, VoiceOver, fuentes ampliadas y pantallas de 320 px.

### Barrido responsivo del 15 de octubre de 2026

Se corrige el reflujo de paginación y campos financieros con texto al 200 %, se añaden regiones accesibles a quince tablas pendientes y se adaptan los diálogos a pantallas bajas. La [matriz reproducible y sus límites](BARRIDO_RESPONSIVO_2026-10-15.md) amplía las comprobaciones de navegación/listados con siete pantallas adicionales, pestañas financieras con datos largos y recuperación de contraseña. La presentación web automatizada y los contratos móviles no reemplazan QA física ni aceptación institucional.

### Activación segura: estructura y API (#60–#61)

Se incorpora la décima migración incremental, con estado pendiente default false y tokens SHA-256 de un uso. La API permite solicitar invitación genérica por SMTP y activar con contraseña validada, bloquea login/refresh/JWT/restablecimiento/descargas de cuentas pendientes y revoca sesiones previas por versión. Reemisión y consumo se serializan por usuario. Los endpoints públicos tienen límite por IP; la columna de intentos queda reservada, sin contador por cuenta implementado.

Esta etapa no conecta altas individuales/lotes ni pantallas: aún no cierra el requisito de eliminar la contraseña inicial de matrícula. No se aplica migración ni se despliega a la institución; requiere respaldo y esquema previo al código, clientes y aceptación de SMTP real. Véase [requisito y estado de implementación](REQUERIMIENTO_ACTIVACION_SEGURA.md).

Revisión adicional de #61: entrega de invitaciones en cola acotada de memoria, respuesta HTTP independiente de consultas/SMTP y emisión/aceptación SMTP serializada por usuario. Activar invalida también recuperaciones anteriores; emitir recuperación revalida estado y versión bajo bloqueo. La cola no acredita entrega ni sobrevive reinicios; ante falta de correo el titular solicita de nuevo. No cambia el pendiente de altas/clientes ni la aceptación SMTP institucional.
