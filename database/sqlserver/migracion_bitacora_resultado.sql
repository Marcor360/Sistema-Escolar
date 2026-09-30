-- Enriquece la bitácora de escrituras con ruta lógica, entidad y resultado HTTP.
ALTER TABLE bitacora_actividad ADD
  entidad NVARCHAR(100) NULL,
  entidad_id INT NULL,
  resultado NVARCHAR(10) NOT NULL CONSTRAINT df_bitacora_actividad_resultado DEFAULT N'EXITO',
  status_code SMALLINT NULL;
GO
