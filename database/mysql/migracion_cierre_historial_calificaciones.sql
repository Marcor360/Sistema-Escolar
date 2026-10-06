-- Cierre por grupo-materia/parcial y trazabilidad de cada captura.
CREATE TABLE periodos_calificacion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  estatus VARCHAR(10) NOT NULL DEFAULT 'ABIERTO',
  cerrado_por_id INT NULL,
  cerrado_at DATETIME NULL,
  reabierto_por_id INT NULL,
  reabierto_at DATETIME NULL,
  UNIQUE KEY uq_periodo_calificacion (grupo_materia_id, parcial),
  CONSTRAINT fk_periodo_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE historial_calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calificacion_id INT NOT NULL,
  alumno_id INT NOT NULL,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  valor_anterior DECIMAL(5,2) NULL,
  valor_nuevo DECIMAL(5,2) NOT NULL,
  observacion_anterior VARCHAR(300) NULL,
  observacion_nueva VARCHAR(300) NULL,
  usuario_id INT NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo VARCHAR(300) NULL,
  KEY idx_historial_calificacion (calificacion_id),
  KEY idx_historial_periodo (grupo_materia_id, parcial)
) ENGINE=InnoDB;
