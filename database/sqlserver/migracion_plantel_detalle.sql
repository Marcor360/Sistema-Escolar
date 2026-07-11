-- Ejecutar después de migracion_planteles_alcance.sql.
ALTER TABLE planteles ADD
  municipio NVARCHAR(80) NULL,
  telefono NVARCHAR(20) NULL,
  director_usuario_id INT NULL;
GO

ALTER TABLE planteles ADD CONSTRAINT fk_plantel_director
  FOREIGN KEY (director_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
GO
