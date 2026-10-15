-- Activaciones nuevas no afectan a cuentas históricas: default false.
ALTER TABLE usuarios ADD activacion_pendiente BIT NOT NULL CONSTRAINT df_usuarios_activacion_pendiente DEFAULT 0;
GO
CREATE TABLE activacion_tokens (
  id NVARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  token NVARCHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME2 NOT NULL,
  usado BIT NOT NULL DEFAULT 0,
  intentos INT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT fk_activacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
GO
CREATE INDEX idx_activacion_usuario ON activacion_tokens(usuario_id);
GO
