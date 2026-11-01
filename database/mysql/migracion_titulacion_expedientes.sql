-- Borradores institucionales: no se generan ni transmiten títulos SEP.
CREATE TABLE titulacion_expedientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  egreso_id INT NOT NULL,
  carrera_plan_id INT NOT NULL,
  creado_por_id INT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  modalidad_rvoe VARCHAR(20) NOT NULL DEFAULT 'SIN_DETERMINAR',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_titulacion_egreso_plan UNIQUE (egreso_id, carrera_plan_id),
  CONSTRAINT fk_titulacion_egreso FOREIGN KEY (egreso_id) REFERENCES egresos_alumnos(id),
  CONSTRAINT fk_titulacion_carrera FOREIGN KEY (carrera_plan_id) REFERENCES carreras_planes(id),
  CONSTRAINT fk_titulacion_actor FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_titulacion_estado ON titulacion_expedientes(estado, created_at);
