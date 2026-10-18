CREATE TABLE solicitudes_grupo_regular (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 alumno_id INT NOT NULL REFERENCES alumnos(id),
 plantel_id INT NOT NULL REFERENCES planteles(id),
 ciclo_id INT NOT NULL REFERENCES ciclos_escolares(id),
 nivel_id INT NOT NULL REFERENCES niveles_academicos(id),
 carrera_id INT NOT NULL REFERENCES carreras_planes(id),
 periodo_academico_id INT NOT NULL REFERENCES periodos_academicos(id),
 turno NVARCHAR(10) NOT NULL,
 estado NVARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
 grupo_id INT NULL REFERENCES grupos(id),
 CONSTRAINT uq_solicitud_alumno_ciclo UNIQUE (alumno_id,ciclo_id),
 CONSTRAINT ck_solicitud_estado CHECK (estado IN ('PENDIENTE','ASIGNADA','ANULADA')),
 CONSTRAINT ck_solicitud_turno CHECK (turno IN ('MATUTINO','VESPERTINO')),
 CONSTRAINT ck_solicitud_asignada CHECK ((estado='ASIGNADA' AND grupo_id IS NOT NULL) OR (estado <> 'ASIGNADA' AND grupo_id IS NULL))
);
CREATE INDEX idx_solicitud_cohorte ON solicitudes_grupo_regular(plantel_id,ciclo_id,periodo_academico_id,turno,estado);
