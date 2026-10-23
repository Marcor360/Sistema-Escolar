-- El runner con historial aplica una vez estas opciones globales.
ALTER TABLE configuracion_marca
  ADD mensaje_bienvenida NVARCHAR(180) NOT NULL CONSTRAINT df_marca_mensaje DEFAULT '',
      tamano_logo NVARCHAR(10) NOT NULL CONSTRAINT df_marca_tamano_logo DEFAULT 'NORMAL';
GO
