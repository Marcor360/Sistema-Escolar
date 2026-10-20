CREATE TABLE aceptaciones_institucionales (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  documento VARCHAR(32) NOT NULL,
  version_documento VARCHAR(80) NOT NULL,
  aceptado_en DATETIME(3) NOT NULL,
  CONSTRAINT uq_aceptacion_documento_version UNIQUE (usuario_id, documento, version_documento),
  CONSTRAINT fk_aceptacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
