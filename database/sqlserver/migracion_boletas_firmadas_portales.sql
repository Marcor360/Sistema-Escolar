-- Incremental: conserva expedientes, calificaciones y respuestas anteriores.
ALTER TABLE configuracion_marca ADD nombre_administrativo NVARCHAR(150) NOT NULL CONSTRAINT df_marca_nombre_admin DEFAULT N'Sistema Escolar Administrativo', nombre_portal_alumno NVARCHAR(150) NOT NULL CONSTRAINT df_marca_nombre_alumno DEFAULT N'Sistema Escolar Portal Alumno';
CREATE TABLE boleta_respuestas (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 inscripcion_id INT NOT NULL, actor_id INT NOT NULL, grupo_materia_id INT NULL,
 idempotencia NVARCHAR(36) NOT NULL, peticion_hash NVARCHAR(64) NOT NULL, version_hash NVARCHAR(64) NOT NULL,
 estado NVARCHAR(12) NOT NULL, firmante_nombre NVARCHAR(150) NOT NULL, firmante_tipo NVARCHAR(10) NOT NULL,
 comentario NVARCHAR(2000) NOT NULL CONSTRAINT df_boleta_respuesta_comentario DEFAULT N'', snapshot_json NVARCHAR(MAX) NULL, created_at DATETIME2 NOT NULL CONSTRAINT df_boleta_respuesta_fecha DEFAULT SYSUTCDATETIME(),
 CONSTRAINT uq_boleta_respuesta_clave UNIQUE(idempotencia),
 CONSTRAINT fk_boleta_respuesta_inscripcion FOREIGN KEY(inscripcion_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_boleta_respuesta_actor FOREIGN KEY(actor_id) REFERENCES usuarios(id),
 CONSTRAINT fk_boleta_respuesta_materia FOREIGN KEY(grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT ck_boleta_respuesta_estado CHECK(estado IN ('ACEPTADA','REVISION','COMENTARIO')),
 CONSTRAINT ck_boleta_respuesta_firmante CHECK(firmante_tipo IN ('ALUMNO','TUTOR','DOCENTE'))
);
CREATE INDEX idx_boleta_respuesta_inscripcion ON boleta_respuestas(inscripcion_id,id);
