-- Sesiones por dispositivo; solo se persiste el hash del refresh rotativo.
CREATE TABLE sesiones (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  portal VARCHAR(5) NOT NULL,
  refresh_hash VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  expira_en DATETIME NOT NULL,
  revocada BOOLEAN NOT NULL DEFAULT FALSE,
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE usuarios ADD password_change_required BOOLEAN NOT NULL DEFAULT FALSE;
