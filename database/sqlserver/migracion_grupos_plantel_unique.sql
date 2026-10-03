-- Permite repetir nombre de grupo entre planteles dentro del mismo ciclo.
-- Agrega primero la nueva clave: si hay duplicados dentro de un plantel,
-- SQL Server aborta sin retirar la restricción anterior.
ALTER TABLE grupos
  ADD CONSTRAINT uq_grupo_ciclo_plantel_nombre UNIQUE (ciclo_id, plantel_id, nombre);
GO

ALTER TABLE grupos
  DROP CONSTRAINT uq_grupo_ciclo_nombre;
GO
