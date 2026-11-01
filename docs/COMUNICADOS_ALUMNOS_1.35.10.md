# Comunicados administrados para alumnos — 1.35.10

## Alcance
Aprovecha los avisos y PushService existentes; el nuevo flujo en Avisos permite crear/editar borradores, previsualizar la audiencia, publicar e inspeccionar el historial de comunicados por plantel. Se conservan los avisos rápidos existentes para no romper sus consumidores.

## Seguridad y datos
Solo ADMINISTRATIVO/SUPERADMIN desde WEB con comprobación de ScopeService. La audiencia incluye únicamente alumnos ACTIVOS cuyo usuario está activo y conserva el rol ALUMNO, en un plantel autorizado. No se envían saldos, credenciales ni datos personales. Envío transaccional e idempotente: bloqueo pesimista de la campaña, escritura de avisos internos y cambio de estado en una sola transacción. El worker PushService existente recupera las notificaciones pushPendiente tras commit; no afirma entrega al dispositivo.

## Límites
Máximo 500 alumnos por campaña; se rechaza excederlo, sin enviar parcialmente. Los comunicados ENVIADO no se reeditan; los borradores se pueden modificar. No se habilita programación por fecha ni WhatsApp/SMS. No se añade dependencia.

## Migración y aceptación
Aplica `migracion_comunicados_alumnos.sql` en MySQL/SQL Server después de respaldar y probar restauración. Requiere CI por SHA, pruebas reales concurrentes (dos publicaciones), aislamiento de planteles, audiencias, pantalla móvil con nueva notificación y UAT de comunicación institucional. No desplegar sin validar migraciones.
