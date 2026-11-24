-- El reconocimiento permanece al depurar sesiones vencidas y se elimina con la cuenta.
CREATE TABLE auth_dispositivos_acceso (
  usuario_id INT NOT NULL,
  huella VARCHAR(64) NOT NULL,
  primer_evento_id VARCHAR(36) NOT NULL,
  CONSTRAINT pk_auth_dispositivos_acceso PRIMARY KEY (usuario_id, huella),
  CONSTRAINT uq_auth_dispositivos_aviso UNIQUE (primer_evento_id),
  CONSTRAINT fk_auth_dispositivos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
