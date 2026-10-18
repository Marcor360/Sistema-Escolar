-- Incremental: no modifica usuarios, tokens ni sesiones existentes.
CREATE TABLE auth_correo_outbox (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 usuario_id INT NOT NULL,
 tipo VARCHAR(16) NOT NULL,
 estado VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
 version INT NOT NULL,
 clave_id VARCHAR(40) NULL,
 token_hash VARCHAR(64) NULL,
 intentos INT NOT NULL DEFAULT 0,
 proximo_intento DATETIME NOT NULL,
 expira_en DATETIME NOT NULL,
 lease_hasta DATETIME NULL,
 claim VARCHAR(36) NULL,
 error_codigo VARCHAR(24) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_auth_outbox_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
 CONSTRAINT ck_auth_outbox_tipo CHECK (tipo IN ('ACTIVACION','RECUPERACION')),
 CONSTRAINT ck_auth_outbox_estado CHECK (estado IN ('PENDIENTE','PROCESANDO','ACEPTADO','FALLIDO','EXPIRADO','CANCELADO')),
 CONSTRAINT ck_auth_outbox_intentos CHECK (intentos >= 0 AND intentos <= 6),
 CONSTRAINT ck_auth_outbox_token CHECK ((clave_id IS NULL AND token_hash IS NULL) OR (clave_id IS NOT NULL AND token_hash IS NOT NULL))
);
CREATE INDEX idx_auth_outbox_pendiente ON auth_correo_outbox(estado,proximo_intento);
CREATE INDEX idx_auth_outbox_usuario ON auth_correo_outbox(usuario_id,tipo,expira_en);
