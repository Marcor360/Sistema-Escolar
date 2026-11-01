CREATE TABLE comunicados_alumnos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plantel_id INT NOT NULL,
  creado_por_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje VARCHAR(600) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  destinatarios INT NOT NULL DEFAULT 0,
  enviado_en DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_comunicados_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_comunicados_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_comunicados_plantel_fecha ON comunicados_alumnos (plantel_id, created_at);
