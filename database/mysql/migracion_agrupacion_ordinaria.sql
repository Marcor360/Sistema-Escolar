CREATE TABLE solicitudes_grupo_regular (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 nivel_id INT NOT NULL,
 carrera_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 turno VARCHAR(10) NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
 grupo_id INT NULL,
 CONSTRAINT uq_solicitud_alumno_ciclo UNIQUE (alumno_id,ciclo_id),
 CONSTRAINT ck_solicitud_estado CHECK (estado IN ('PENDIENTE','ASIGNADA','ANULADA')),
 CONSTRAINT ck_solicitud_turno CHECK (turno IN ('MATUTINO','VESPERTINO')),
 CONSTRAINT ck_solicitud_asignada CHECK ((estado='ASIGNADA' AND grupo_id IS NOT NULL) OR (estado <> 'ASIGNADA' AND grupo_id IS NULL))
);
CREATE INDEX idx_solicitud_cohorte ON solicitudes_grupo_regular(plantel_id,ciclo_id,periodo_academico_id,turno,estado);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_carrera FOREIGN KEY (carrera_id) REFERENCES carreras_planes(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_periodo_academico FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id);
