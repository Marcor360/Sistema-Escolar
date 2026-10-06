-- Cierre por grupo-materia/parcial y trazabilidad de cada captura.
CREATE TABLE periodos_calificacion (
  id INT IDENTITY(1,1) PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  estatus NVARCHAR(10) NOT NULL DEFAULT 'ABIERTO',
  cerrado_por_id INT NULL,
  cerrado_at DATETIME2 NULL,
  reabierto_por_id INT NULL,
  reabierto_at DATETIME2 NULL,
  CONSTRAINT uq_periodo_calificacion UNIQUE (grupo_materia_id, parcial),
  CONSTRAINT fk_periodo_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
);
GO

CREATE TABLE historial_calificaciones (
  id INT IDENTITY(1,1) PRIMARY KEY,
  calificacion_id INT NOT NULL,
  alumno_id INT NOT NULL,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  valor_anterior DECIMAL(5,2) NULL,
  valor_nuevo DECIMAL(5,2) NOT NULL,
  observacion_anterior NVARCHAR(300) NULL,
  observacion_nueva NVARCHAR(300) NULL,
  usuario_id INT NOT NULL,
  fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  motivo NVARCHAR(300) NULL
);
GO

CREATE INDEX idx_historial_calificacion ON historial_calificaciones(calificacion_id);
GO
CREATE INDEX idx_historial_periodo ON historial_calificaciones(grupo_materia_id, parcial);
GO
