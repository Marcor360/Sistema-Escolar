-- Solo metadatos de firmantes; NUNCA almacenar claves privadas ni contraseñas aquí.
CREATE TABLE titulacion_firmantes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plantel_id INT NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  cargo VARCHAR(100) NOT NULL,
  curp VARCHAR(18) NOT NULL,
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE NULL,
  certificado_sha256 VARCHAR(64) NULL,
  estado VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
  registrado_por_id INT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_titulacion_firmante_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_titulacion_firmante_actor FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_titulacion_firmantes_plantel ON titulacion_firmantes(plantel_id, estado);
