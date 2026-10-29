-- Borradores institucionales: no se generan ni transmiten títulos SEP.
CREATE TABLE titulacion_expedientes (
  id INT IDENTITY(1,1) PRIMARY KEY,
  egreso_id INT NOT NULL,
  carrera_plan_id INT NOT NULL,
  creado_por_id INT NOT NULL,
  estado NVARCHAR(20) NOT NULL CONSTRAINT df_titulacion_estado DEFAULT N'BORRADOR',
  modalidad_rvoe NVARCHAR(20) NOT NULL CONSTRAINT df_titulacion_rvoe DEFAULT N'SIN_DETERMINAR',
  created_at DATETIME2(6) NOT NULL CONSTRAINT df_titulacion_created DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(6) NOT NULL CONSTRAINT df_titulacion_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT uq_titulacion_egreso_plan UNIQUE (egreso_id, carrera_plan_id),
  CONSTRAINT fk_titulacion_egreso FOREIGN KEY (egreso_id) REFERENCES egresos_alumnos(id),
  CONSTRAINT fk_titulacion_carrera FOREIGN KEY (carrera_plan_id) REFERENCES carreras_planes(id),
  CONSTRAINT fk_titulacion_actor FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
GO
CREATE INDEX idx_titulacion_estado ON titulacion_expedientes(estado, created_at);
GO
