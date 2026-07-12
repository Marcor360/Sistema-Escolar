-- Marca blanca institucional (fila única id = 1). Tabla nueva sin dependencias; idempotente.
IF OBJECT_ID('configuracion_marca', 'U') IS NULL
BEGIN
  CREATE TABLE configuracion_marca (
    id INT NOT NULL PRIMARY KEY,
    nombre_institucion NVARCHAR(150) NOT NULL CONSTRAINT df_marca_nombre DEFAULT 'Sistema Escolar',
    nombre_corto NVARCHAR(10) NOT NULL CONSTRAINT df_marca_corto DEFAULT 'SE',
    logo_url NVARCHAR(255) NULL,
    color_primario CHAR(7) NOT NULL CONSTRAINT df_marca_primario DEFAULT '#14343B',
    color_acento CHAR(7) NOT NULL CONSTRAINT df_marca_acento DEFAULT '#C79A3C',
    actualizado_en DATETIME2 NOT NULL CONSTRAINT df_marca_actualizado DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM configuracion_marca WHERE id = 1)
  INSERT INTO configuracion_marca (id) VALUES (1);
GO
