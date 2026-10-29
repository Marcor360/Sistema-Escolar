-- Incremental: identidad de portales y respuestas inmutables a boletas.
ALTER TABLE configuracion_marca ADD nombre_administrativo VARCHAR(150) NOT NULL DEFAULT 'Sistema Escolar Administrativo', ADD nombre_portal_alumno VARCHAR(150) NOT NULL DEFAULT 'Sistema Escolar Portal Alumno';
CREATE TABLE boleta_respuestas (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 inscripcion_id INT NOT NULL, actor_id INT NOT NULL, grupo_materia_id INT NULL,
 idempotencia VARCHAR(36) NOT NULL, peticion_hash VARCHAR(64) NOT NULL, version_hash VARCHAR(64) NOT NULL,
 estado VARCHAR(12) NOT NULL, firmante_nombre VARCHAR(150) NOT NULL, firmante_tipo VARCHAR(10) NOT NULL,
 comentario VARCHAR(2000) NOT NULL DEFAULT '', snapshot_json TEXT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT uq_boleta_respuesta_clave UNIQUE(idempotencia),
 CONSTRAINT fk_boleta_respuesta_inscripcion FOREIGN KEY(inscripcion_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_boleta_respuesta_actor FOREIGN KEY(actor_id) REFERENCES usuarios(id),
 CONSTRAINT fk_boleta_respuesta_materia FOREIGN KEY(grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT ck_boleta_respuesta_estado CHECK(estado IN ('ACEPTADA','REVISION','COMENTARIO')),
 CONSTRAINT ck_boleta_respuesta_firmante CHECK(firmante_tipo IN ('ALUMNO','TUTOR','DOCENTE'))
);
CREATE INDEX idx_boleta_respuesta_inscripcion ON boleta_respuestas(inscripcion_id,id);
