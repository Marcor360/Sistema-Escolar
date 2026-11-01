CREATE TABLE comunicados_alumnos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  plantel_id INT NOT NULL,
  creado_por_id INT NOT NULL,
  titulo NVARCHAR(150) NOT NULL,
  mensaje NVARCHAR(600) NOT NULL,
  estado NVARCHAR(20) NOT NULL CONSTRAINT df_comunicados_estado DEFAULT 'BORRADOR',
  destinatarios INT NOT NULL CONSTRAINT df_comunicados_destinatarios DEFAULT 0,
  enviado_en DATETIME2(6) NULL,
  created_at DATETIME2(6) NOT NULL CONSTRAINT df_comunicados_created DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(6) NOT NULL CONSTRAINT df_comunicados_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_comunicados_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_comunicados_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_comunicados_plantel_fecha ON comunicados_alumnos (plantel_id, created_at);
GO
