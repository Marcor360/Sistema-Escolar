-- Activaciones nuevas no afectan a cuentas históricas: default false.
ALTER TABLE usuarios ADD activacion_pendiente TINYINT(1) NOT NULL DEFAULT 0;
CREATE TABLE activacion_tokens (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  intentos INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  KEY idx_activacion_usuario (usuario_id)
) ENGINE=InnoDB;
