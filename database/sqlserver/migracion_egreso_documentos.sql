ALTER TABLE egresos_alumnos ADD finalizado_en DATETIME2 NULL;
CREATE TABLE egreso_documentos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  egreso_id INT NOT NULL REFERENCES egresos_alumnos(id),
  actor_id INT NOT NULL REFERENCES usuarios(id),
  tipo NVARCHAR(24) NOT NULL,
  detalle NVARCHAR(600) NOT NULL,
  contexto NVARCHAR(64) NOT NULL,
  sha256 NVARCHAR(64) NOT NULL,
  clave NVARCHAR(64) NOT NULL UNIQUE,
  mime NVARCHAR(40) NOT NULL,
  instantanea NVARCHAR(MAX) NULL,
  contenido VARCHAR(MAX) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX idx_egreso_documentos_tipo ON egreso_documentos(egreso_id,tipo,id);
