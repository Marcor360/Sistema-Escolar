-- Cambio incremental: agrega una clave única nullable para colegiaturas generadas.
-- Los cargos existentes quedan en NULL y no se modifican.
ALTER TABLE cargos
  ADD COLUMN clave_generacion VARCHAR(80) NULL,
  ADD UNIQUE KEY uq_cargos_clave_generacion (clave_generacion);
