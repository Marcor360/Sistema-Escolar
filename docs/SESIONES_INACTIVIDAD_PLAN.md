# PR IUA-01: columna de última actividad

Se añade `sesiones.ultima_actividad_en` (nullable) a los dos motores. El campo representa última interacción humana confirmada mediante el nuevo contrato autenticado, no el último request HTTP. No se alteran datos históricos; las sesiones anteriores, cuyo valor permanece NULL, deberán reautenticarse cuando se active el control del siguiente PR.

**Despliegue:** revisar `db:migrate:status`, respaldar y ensayar el runner sobre copia aislada, aplicar esta migración aditiva **antes** del backend que la lee. `schema.sql` es documental. No activar `DB_SYNC=true`. La app y web no acceden directamente a la base. La aceptación del piloto requiere verificación en MySQL y SQL Server reales.

## Integración de #47–51

Los cinco PR son una cadena del mismo contrato. #51 se reorienta a main para validar e integrar esquema, API, clientes y regresiones juntos, conservando las correcciones de #46. No habilitar el backend por separado de los clientes.

- Login inicia ultimaActividadEn; JWT y refresh rechazan y revocan sesiones cuya última señal confirmada supera 30 minutos. NULL histórico requiere login nuevo. Fechas futuras no prolongan acceso.
- POST /auth/actividad usa hora del servidor, JWT vigente y actualización condicional: dueño/sesión, versión, expiración absoluta y ventana vigente. No puede reactivar una sesión vencida o revocada.
- Web y Expo envían señales tras interacción y como máximo una por minuto; no por polling, refresh o reanudación. Atrás físico móvil usa el mismo registro.
- Descargas firmadas también verifican actividad, aunque el enlace no haya caducado. La revocación del guard es condicional para no sobrescribir una actividad concurrente.
- Regresiones de frontera/carreras y escenario API/base real comprueban actividad, polling y denegación de acceso/refresh en ambos motores.

La API verifica la señal autenticada recibida, no puede demostrar que provenga de una persona ni impedir que un cliente modificado la genere. El plazo se mide desde la última señal aceptada; el envío limitado a un minuto y la precisión del motor pueden adelantar el cierre respecto de la última interacción local. No son nuevas vigencias de JWT: access sigue 15 minutos y refresh máximo 30 días.

Aplicar migracion_sesiones_inactividad.sql después de biblioteca, mediante runner incremental y sobre copia/ventana aprobada. No aplicar en datos institucionales desde esta revisión. Rollback de aplicación conserva la columna aditiva; volver al backend anterior elimina el control de inactividad de API y requiere evaluación explícita, no se considera equivalente.

QA física y aceptación institucional pendientes. No se integran los PR #52–58, que tienen otro alcance.
