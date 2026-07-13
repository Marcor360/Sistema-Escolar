-- Ciclo de vida de grupos: baja lógica.
ALTER TABLE grupos ADD
  activo BIT NOT NULL CONSTRAINT df_grupos_activo DEFAULT 1;
GO
