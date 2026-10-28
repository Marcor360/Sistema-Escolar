-- Aditiva: las aperturas/solicitudes y unicidades históricas no se modifican.
ALTER TABLE periodos_academicos ADD fecha_inicio DATE NULL;
ALTER TABLE periodos_academicos ADD fecha_fin DATE NULL;
CREATE TABLE autorizaciones_reinscripcion (
 id INT AUTO_INCREMENT PRIMARY KEY,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 financiero_id INT NOT NULL,
 cotizacion VARCHAR(64) NOT NULL,
 peticion_json TEXT NOT NULL,
 snapshot_json TEXT NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'AUTORIZADA',
 vence_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT fk_ar_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_ar_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_ar_usuario FOREIGN KEY (financiero_id) REFERENCES usuarios(id)
);
CREATE TABLE reinscripciones_periodo (
 id INT AUTO_INCREMENT PRIMARY KEY,
 idempotencia VARCHAR(36) NOT NULL,
 peticion_hash VARCHAR(64) NOT NULL,
 clave_origen VARCHAR(50) NULL,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 origen_inscripcion_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 nivel_id INT NOT NULL,
 carrera_id INT NOT NULL,
 turno VARCHAR(10) NOT NULL,
 grupo_id INT NULL,
 inscripcion_destino_id INT NULL,
 autorizacion_id INT NOT NULL,
 creado_por_id INT NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
 academico_hash VARCHAR(64) NOT NULL,
 snapshot_json TEXT NOT NULL,
 cargos_json TEXT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT uq_reinscripcion_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_reinscripcion_autorizacion UNIQUE (autorizacion_id),
 CONSTRAINT fk_rp_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_rp_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_rp_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT fk_rp_origen FOREIGN KEY (origen_inscripcion_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_rp_periodo FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id),
 CONSTRAINT fk_rp_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id),
 CONSTRAINT fk_rp_destino FOREIGN KEY (inscripcion_destino_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_rp_autorizacion FOREIGN KEY (autorizacion_id) REFERENCES autorizaciones_reinscripcion(id),
 CONSTRAINT fk_rp_usuario FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_reinscripcion_origen ON reinscripciones_periodo(clave_origen);
CREATE INDEX idx_reinscripcion_cohorte ON reinscripciones_periodo(plantel_id,ciclo_id,periodo_academico_id,turno,estado);
