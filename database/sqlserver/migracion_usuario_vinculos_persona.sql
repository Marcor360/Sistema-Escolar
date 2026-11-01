-- Identidades de acceso separadas de una persona que estudia y trabaja; sin mover expedientes.
CREATE TABLE usuario_vinculos_persona (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_usuario_id INT NOT NULL,
  personal_usuario_id INT NOT NULL,
  autorizado_por_id INT NOT NULL,
  motivo NVARCHAR(200) NOT NULL,
  created_at DATETIME2(6) NOT NULL CONSTRAINT df_vinculo_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_vinculo_alumno_usuario UNIQUE (alumno_usuario_id),
  CONSTRAINT uq_vinculo_personal_usuario UNIQUE (personal_usuario_id),
  CONSTRAINT fk_vinculo_alumno_usuario FOREIGN KEY (alumno_usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_vinculo_personal_usuario FOREIGN KEY (personal_usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_vinculo_autorizado_por FOREIGN KEY (autorizado_por_id) REFERENCES usuarios(id)
);
GO
