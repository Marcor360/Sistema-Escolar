-- Ejecutar después de migracion_planteles_alcance.sql.
ALTER TABLE planteles
  ADD COLUMN municipio VARCHAR(80) NULL,
  ADD COLUMN telefono VARCHAR(20) NULL,
  ADD COLUMN director_usuario_id INT NULL;

ALTER TABLE planteles
  ADD CONSTRAINT fk_plantel_director
  FOREIGN KEY (director_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
