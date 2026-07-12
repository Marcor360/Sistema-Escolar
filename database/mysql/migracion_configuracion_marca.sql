-- Marca blanca institucional (fila única id = 1). Tabla nueva sin dependencias; idempotente.
CREATE TABLE IF NOT EXISTS configuracion_marca (
  id INT NOT NULL PRIMARY KEY,
  nombre_institucion VARCHAR(150) NOT NULL DEFAULT 'Sistema Escolar',
  nombre_corto VARCHAR(10) NOT NULL DEFAULT 'SE',
  logo_url VARCHAR(255) NULL,
  color_primario CHAR(7) NOT NULL DEFAULT '#14343B',
  color_acento CHAR(7) NOT NULL DEFAULT '#C79A3C',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO configuracion_marca (id) VALUES (1);
