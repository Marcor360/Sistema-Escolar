-- Registro institucional único por alumno y CURP; no elimina ni mueve datos existentes.
-- Egresados anteriores requieren conciliación documental antes de completar este registro.
CREATE TABLE egresos_alumnos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  ciclo_id INT NOT NULL,
  curp VARCHAR(18) NOT NULL,
  fecha_egreso DATETIME NOT NULL,
  archivar_desde DATETIME NOT NULL,
  estado_archivo VARCHAR(15) NOT NULL DEFAULT 'VIGENTE',
  ruta_archivo VARCHAR(300) NULL,
  sha256_archivo VARCHAR(64) NULL,
  archivado_en DATETIME NULL,
  CONSTRAINT fk_egresos_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_egresos_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
  CONSTRAINT uq_egreso_alumno UNIQUE (alumno_id),
  CONSTRAINT uq_egreso_curp UNIQUE (curp)
) ENGINE=InnoDB;
CREATE INDEX idx_egreso_ciclo_fecha ON egresos_alumnos(ciclo_id, fecha_egreso);
