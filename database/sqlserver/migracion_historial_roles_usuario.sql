-- Auditoría persistente sin secretos ni datos personales adicionales.
CREATE TABLE historial_roles_usuario (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NOT NULL,
  actor_id INT NOT NULL,
  roles_antes NVARCHAR(200) NOT NULL,
  roles_despues NVARCHAR(200) NOT NULL,
  created_at DATETIME2(6) NOT NULL CONSTRAINT df_historial_roles_usuario_created_at DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_historial_roles_usuario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_historial_roles_usuario_actor FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
GO
CREATE INDEX idx_historial_roles_usuario_fecha ON historial_roles_usuario (usuario_id, created_at);
GO
