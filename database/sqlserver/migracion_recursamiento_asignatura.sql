CREATE TABLE participaciones_asignatura (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 idempotencia NVARCHAR(36) NOT NULL,
 alumno_id INT NOT NULL,
 grupo_materia_id INT NOT NULL,
 inscripcion_principal_id INT NOT NULL,
 cupo_total_confirmado INT NOT NULL,
 intento INT NOT NULL,
 estado NVARCHAR(12) NOT NULL DEFAULT 'ACTIVA',
 activo_clave NVARCHAR(80) NULL,
 created_at DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_participacion_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_participacion_intento UNIQUE (alumno_id,grupo_materia_id,intento),
 CONSTRAINT fk_pa_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_pa_clase FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT fk_pa_principal FOREIGN KEY (inscripcion_principal_id) REFERENCES inscripciones(id),
 CONSTRAINT ck_pa_intento CHECK (intento >= 1 AND cupo_total_confirmado BETWEEN 1 AND 10000),
 CONSTRAINT ck_pa_estado CHECK (estado IN ('ACTIVA','BAJA','FINALIZADA')),
 CONSTRAINT ck_pa_activa CHECK ((estado='ACTIVA' AND activo_clave IS NOT NULL) OR (estado<>'ACTIVA' AND activo_clave IS NULL))
);
CREATE TABLE cupos_recursamiento (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 grupo_materia_id INT NOT NULL,
 cupo_total_manual INT NOT NULL,
 CONSTRAINT uq_cupo_clase UNIQUE (grupo_materia_id),
 CONSTRAINT fk_cr_clase FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT ck_cr_cupo CHECK (cupo_total_manual BETWEEN 1 AND 10000)
);
CREATE TABLE calificaciones_recursamiento (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 participacion_id INT NOT NULL,
 parcial INT NOT NULL,
 calificacion DECIMAL(5,2) NOT NULL,
 capturada_por_id INT NOT NULL,
 updated_at DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_nota_recursamiento UNIQUE (participacion_id,parcial),
 CONSTRAINT fk_nrec_participacion FOREIGN KEY (participacion_id) REFERENCES participaciones_asignatura(id),
 CONSTRAINT fk_nrec_usuario FOREIGN KEY (capturada_por_id) REFERENCES usuarios(id),
 CONSTRAINT ck_nrec_valores CHECK (parcial BETWEEN 0 AND 3 AND calificacion BETWEEN 0 AND 100)
);
CREATE TABLE historial_recursamiento (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 participacion_id INT NOT NULL,
 parcial INT NOT NULL,
 anterior DECIMAL(5,2) NULL,
 nueva DECIMAL(5,2) NOT NULL,
 usuario_id INT NOT NULL,
 motivo NVARCHAR(400) NOT NULL,
 created_at DATETIME2 NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_hrec_participacion FOREIGN KEY (participacion_id) REFERENCES participaciones_asignatura(id),
 CONSTRAINT fk_hrec_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_participacion_activa ON participaciones_asignatura(activo_clave) WHERE activo_clave IS NOT NULL;
