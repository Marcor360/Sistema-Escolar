-- Seguimiento aditivo de revisiones; conserva respuestas y notas originales.
CREATE TABLE boleta_atenciones (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 respuesta_id INT NOT NULL, actor_id INT NOT NULL, responsable_id INT NOT NULL,
 idempotencia VARCHAR(36) NOT NULL, peticion_hash VARCHAR(64) NOT NULL,
 estado VARCHAR(12) NOT NULL, comentario VARCHAR(2000) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT uq_boleta_atencion_clave UNIQUE(idempotencia),
 CONSTRAINT fk_boleta_atencion_respuesta FOREIGN KEY(respuesta_id) REFERENCES boleta_respuestas(id),
 CONSTRAINT fk_boleta_atencion_actor FOREIGN KEY(actor_id) REFERENCES usuarios(id),
 CONSTRAINT fk_boleta_atencion_responsable FOREIGN KEY(responsable_id) REFERENCES usuarios(id),
 CONSTRAINT ck_boleta_atencion_estado CHECK(estado IN ('PENDIENTE','EN_ATENCION','RESUELTA'))
);
CREATE INDEX idx_boleta_atencion_respuesta ON boleta_atenciones(respuesta_id,id);
