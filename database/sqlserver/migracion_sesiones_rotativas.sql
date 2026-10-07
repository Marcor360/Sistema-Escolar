-- Espejo MySQL: sesiones por dispositivo, hash de refresh rotativo.
CREATE TABLE sesiones (
  id NVARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  portal NVARCHAR(5) NOT NULL,
  refresh_hash NVARCHAR(64) NOT NULL,
  version INT NOT NULL,
  expira_en DATETIME2 NOT NULL,
  revocada BIT NOT NULL DEFAULT 0,
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
GO
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
GO

ALTER TABLE usuarios ADD password_change_required BIT NOT NULL CONSTRAINT df_usuario_password_change DEFAULT 0;
GO
