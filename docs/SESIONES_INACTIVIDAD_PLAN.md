# PR IUA-01: columna de última actividad

Se añade `sesiones.ultima_actividad_en` (nullable) a los dos motores. El campo representa última interacción humana confirmada mediante el nuevo contrato autenticado, no el último request HTTP. No se alteran datos históricos; las sesiones anteriores, cuyo valor permanece NULL, deberán reautenticarse cuando se active el control del siguiente PR.

**Despliegue:** revisar `db:migrate:status`, respaldar y ensayar el runner sobre copia aislada, aplicar esta migración aditiva **antes** del backend que la lee. `schema.sql` es documental. No activar `DB_SYNC=true`. La app y web no acceden directamente a la base. La aceptación del piloto requiere verificación en MySQL y SQL Server reales.
