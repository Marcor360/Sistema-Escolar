CREATE TABLE aceptaciones_institucionales (
  id NVARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  documento NVARCHAR(32) NOT NULL,
  version_documento NVARCHAR(80) NOT NULL,
  aceptado_en DATETIME2(3) NOT NULL,
  CONSTRAINT uq_aceptacion_documento_version UNIQUE (usuario_id, documento, version_documento),
  CONSTRAINT fk_aceptacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
GO
