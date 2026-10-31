-- Cola de notificaciones de seguridad, sin contraseñas, códigos ni correos en la tabla.
CREATE TABLE auth_correo_eventos (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 usuario_id INT NOT NULL,
 tipo VARCHAR(24) NOT NULL,
 estado VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
 intentos INT NOT NULL DEFAULT 0,
 proximo_intento DATETIME NOT NULL,
 lease_hasta DATETIME NULL,
 claim VARCHAR(36) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_auth_eventos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
 CONSTRAINT ck_auth_eventos_tipo CHECK (tipo IN ('INGRESO','RECUPERACION_EXITOSA','CAMBIO_PASSWORD')),
 CONSTRAINT ck_auth_eventos_estado CHECK (estado IN ('PENDIENTE','PROCESANDO','ENVIADO','FALLIDO')),
 CONSTRAINT ck_auth_eventos_intentos CHECK (intentos >= 0 AND intentos <= 5)
);
CREATE INDEX idx_auth_eventos_pendientes ON auth_correo_eventos(estado,proximo_intento);
