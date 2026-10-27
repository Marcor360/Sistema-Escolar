-- Registro institucional único por alumno y CURP; no elimina ni mueve datos existentes.
-- Egresados anteriores requieren conciliación documental antes de completar este registro.
CREATE TABLE egresos_alumnos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  ciclo_id INT NOT NULL,
  curp NVARCHAR(18) NOT NULL,
  fecha_egreso DATETIME2 NOT NULL,
  archivar_desde DATETIME2 NOT NULL,
  estado_archivo NVARCHAR(15) NOT NULL DEFAULT 'VIGENTE',
  ruta_archivo NVARCHAR(300) NULL,
  sha256_archivo NVARCHAR(64) NULL,
  archivado_en DATETIME2 NULL,
  CONSTRAINT fk_egresos_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_egresos_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
  CONSTRAINT uq_egreso_alumno UNIQUE (alumno_id),
  CONSTRAINT uq_egreso_curp UNIQUE (curp)
);
CREATE INDEX idx_egreso_ciclo_fecha ON egresos_alumnos(ciclo_id, fecha_egreso);
