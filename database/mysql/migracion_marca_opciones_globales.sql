-- El runner con historial aplica una vez estas opciones globales.
ALTER TABLE configuracion_marca
  ADD COLUMN mensaje_bienvenida VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN tamano_logo VARCHAR(10) NOT NULL DEFAULT 'NORMAL';
