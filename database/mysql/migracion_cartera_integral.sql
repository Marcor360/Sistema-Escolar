-- Incremental: no modifica pagos, identidades ni carteras previas.
-- Precondición: conciliar CURP duplicadas (incluye expedientes archivados).
-- El índice único aborta ante duplicados; nunca fusiona ni elimina expedientes.
CREATE UNIQUE INDEX uq_alumno_curp ON alumnos(curp);
ALTER TABLE usuarios MODIFY email VARCHAR(120) NULL;
ALTER TABLE aperturas_cartera ADD contexto_json TEXT NULL;
ALTER TABLE aperturas_cartera DROP CHECK ck_apertura_estado;
ALTER TABLE aperturas_cartera ADD CONSTRAINT ck_apertura_estado CHECK (estado IN ('PENDIENTE','ABIERTA','PAUSA'));
ALTER TABLE solicitudes_grupo_regular DROP CHECK ck_solicitud_estado;
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT ck_solicitud_estado CHECK (estado IN ('PENDIENTE','ASIGNADA','ANULADA','PAUSA'));
