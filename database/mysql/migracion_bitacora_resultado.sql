-- Enriquece la bitácora de escrituras con ruta lógica, entidad y resultado HTTP.
ALTER TABLE bitacora_actividad
  ADD COLUMN entidad VARCHAR(100) NULL,
  ADD COLUMN entidad_id INT NULL,
  ADD COLUMN resultado VARCHAR(10) NOT NULL DEFAULT 'EXITO',
  ADD COLUMN status_code SMALLINT NULL;
