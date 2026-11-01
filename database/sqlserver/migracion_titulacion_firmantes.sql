-- Solo metadatos de firmantes; NUNCA almacenar claves privadas ni contraseñas aquí.
CREATE TABLE titulacion_firmantes (
  id INT IDENTITY(1,1) PRIMARY KEY,
  plantel_id INT NOT NULL,
  nombre NVARCHAR(160) NOT NULL,
  cargo NVARCHAR(100) NOT NULL,
  curp NVARCHAR(18) NOT NULL,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE NULL,
  certificado_sha256 NVARCHAR(64) NULL,
  estado NVARCHAR(25) NOT NULL CONSTRAINT df_titulacion_firmante_estado DEFAULT N'PENDIENTE_VALIDACION',
  registrado_por_id INT NOT NULL,
  created_at DATETIME2(6) NOT NULL CONSTRAINT df_titulacion_firmante_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_titulacion_firmante_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_titulacion_firmante_actor FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id)
);
GO
CREATE INDEX idx_titulacion_firmantes_plantel ON titulacion_firmantes(plantel_id, estado);
GO
