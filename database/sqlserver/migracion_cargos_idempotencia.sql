-- Cambio incremental: agrega una clave única nullable para colegiaturas generadas.
-- Los cargos existentes quedan en NULL y no se modifican.
ALTER TABLE cargos ADD clave_generacion NVARCHAR(80) NULL;
CREATE UNIQUE INDEX uq_cargos_clave_generacion ON cargos(clave_generacion)
  WHERE clave_generacion IS NOT NULL;
