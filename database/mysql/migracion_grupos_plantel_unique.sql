-- Permite repetir nombre de grupo entre planteles dentro del mismo ciclo.
-- Agrega primero la nueva clave: si hay duplicados dentro de un plantel,
-- MySQL aborta sin retirar la restricción anterior.
ALTER TABLE grupos
  ADD UNIQUE KEY uq_grupo_ciclo_plantel_nombre (ciclo_id, plantel_id, nombre);

ALTER TABLE grupos
  DROP INDEX uq_grupo_ciclo_nombre;
