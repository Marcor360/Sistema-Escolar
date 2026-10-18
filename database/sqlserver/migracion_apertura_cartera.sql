CREATE TABLE aperturas_cartera (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 idempotencia NVARCHAR(36) NOT NULL,
 peticion_hash NVARCHAR(64) NOT NULL,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 solicitud_id INT NULL,
 creado_por_id INT NOT NULL,
 estado NVARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
 conceptos NVARCHAR(MAX) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_apertura_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_apertura_alumno_ciclo UNIQUE (alumno_id,ciclo_id),
 CONSTRAINT ck_apertura_estado CHECK (estado IN ('PENDIENTE','ABIERTA')),
 CONSTRAINT fk_ac_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_ac_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_ac_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT fk_ac_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_grupo_regular(id),
 CONSTRAINT fk_ac_usuario FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_apertura_solicitud ON aperturas_cartera(solicitud_id) WHERE solicitud_id IS NOT NULL;
