-- Ciclo de vida de grupos: baja lógica.
ALTER TABLE grupos
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;
