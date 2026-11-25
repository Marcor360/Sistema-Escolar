ALTER TABLE egresos_alumnos ADD finalizado_en DATETIME NULL;
CREATE TABLE egreso_documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  egreso_id INT NOT NULL,
  actor_id INT NOT NULL,
  tipo VARCHAR(24) NOT NULL,
  detalle VARCHAR(600) NOT NULL,
  contexto VARCHAR(64) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  clave VARCHAR(64) NOT NULL UNIQUE,
  mime VARCHAR(40) NOT NULL,
  instantanea LONGTEXT NULL,
  contenido LONGTEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (egreso_id) REFERENCES egresos_alumnos(id),
  FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_egreso_documentos_tipo ON egreso_documentos(egreso_id,tipo,id);
