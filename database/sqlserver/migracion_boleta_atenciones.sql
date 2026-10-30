-- Seguimiento aditivo, sin cascadas ni cambios de calificaciones.
CREATE TABLE boleta_atenciones (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 respuesta_id INT NOT NULL, actor_id INT NOT NULL, responsable_id INT NOT NULL,
 idempotencia NVARCHAR(36) NOT NULL, peticion_hash NVARCHAR(64) NOT NULL,
 estado NVARCHAR(12) NOT NULL, comentario NVARCHAR(2000) NOT NULL,
 created_at DATETIME2 NOT NULL CONSTRAINT df_boleta_atencion_fecha DEFAULT SYSUTCDATETIME(),
 CONSTRAINT uq_boleta_atencion_clave UNIQUE(idempotencia),
 CONSTRAINT fk_boleta_atencion_respuesta FOREIGN KEY(respuesta_id) REFERENCES boleta_respuestas(id),
 CONSTRAINT fk_boleta_atencion_actor FOREIGN KEY(actor_id) REFERENCES usuarios(id),
 CONSTRAINT fk_boleta_atencion_responsable FOREIGN KEY(responsable_id) REFERENCES usuarios(id),
 CONSTRAINT ck_boleta_atencion_estado CHECK(estado IN ('PENDIENTE','EN_ATENCION','RESUELTA'))
);
CREATE INDEX idx_boleta_atencion_respuesta ON boleta_atenciones(respuesta_id,id);
