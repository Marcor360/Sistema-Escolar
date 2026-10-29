-- Auditoría persistente sin secretos ni datos personales adicionales.
CREATE TABLE historial_roles_usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  actor_id INT NOT NULL,
  roles_antes VARCHAR(200) NOT NULL,
  roles_despues VARCHAR(200) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_historial_roles_usuario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_historial_roles_usuario_actor FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_historial_roles_usuario_fecha ON historial_roles_usuario (usuario_id, created_at);
