-- Programaciones de pago: no cambia aperturas, inscripciones ni cargos anteriores.
CREATE TABLE programaciones_cobro (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 idempotencia VARCHAR(36) NOT NULL,
 peticion_hash VARCHAR(64) NOT NULL,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 concepto_id INT NOT NULL,
 modalidad VARCHAR(16) NOT NULL,
 total DECIMAL(12,2) NOT NULL,
 cuotas TEXT NOT NULL,
 creado_por_id INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_programacion_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_programacion_contexto UNIQUE (alumno_id,ciclo_id,periodo_academico_id,concepto_id),
 CONSTRAINT fk_pc_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_pc_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_pc_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT fk_pc_periodo FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id),
 CONSTRAINT fk_pc_concepto FOREIGN KEY (concepto_id) REFERENCES conceptos_pago(id),
 CONSTRAINT fk_pc_actor FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_programacion_alumno ON programaciones_cobro(alumno_id);
CREATE INDEX idx_programacion_plantel ON programaciones_cobro(plantel_id);
