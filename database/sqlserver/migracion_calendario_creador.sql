-- Ejecutar después de migracion_plantel_detalle.sql.
ALTER TABLE eventos_calendario ADD creado_por_id INT NULL;
GO
ALTER TABLE eventos_calendario ADD CONSTRAINT fk_evento_creador
  FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL;
GO
