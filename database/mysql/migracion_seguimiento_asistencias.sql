-- Seguimiento y asistencias: migración aditiva; no modifica calificaciones ni registros previos.

CREATE TABLE asistencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  alumno_id INT NOT NULL,
  plantel_id INT NOT NULL,
  fecha DATE NOT NULL,
  estado VARCHAR(15) NOT NULL,
  capturado_por_id INT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asistencias_grupo_materia_id FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
  CONSTRAINT fk_asistencias_alumno_id FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_asistencias_plantel_id FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_asistencias_capturado_por_id FOREIGN KEY (capturado_por_id) REFERENCES usuarios(id),
  CONSTRAINT uq_asistencia_clase_fecha_alumno UNIQUE (grupo_materia_id, fecha, alumno_id)
) ENGINE=InnoDB;

CREATE TABLE asistencias_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asistencia_id INT NOT NULL,
  usuario_id INT NOT NULL,
  anterior VARCHAR(15) NULL,
  nuevo VARCHAR(15) NOT NULL,
  motivo VARCHAR(250) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asistencias_historial_asistencia_id FOREIGN KEY (asistencia_id) REFERENCES asistencias(id),
  CONSTRAINT fk_asistencias_historial_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE tramites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  plantel_id INT NOT NULL,
  clave VARCHAR(36) NOT NULL,
  tipo VARCHAR(25) NOT NULL,
  detalle VARCHAR(600) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'SOLICITADO',
  responsable_id INT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tramites_alumno_id FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_tramites_plantel_id FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_tramites_responsable_id FOREIGN KEY (responsable_id) REFERENCES usuarios(id),
  CONSTRAINT uq_tramite_clave UNIQUE (clave)
) ENGINE=InnoDB;

CREATE TABLE tramites_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id INT NOT NULL,
  usuario_id INT NOT NULL,
  estado VARCHAR(20) NOT NULL,
  mensaje VARCHAR(600) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tramites_historial_tramite_id FOREIGN KEY (tramite_id) REFERENCES tramites(id),
  CONSTRAINT fk_tramites_historial_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE preferencias_notificacion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  push BOOLEAN NOT NULL DEFAULT 1,
  correo BOOLEAN NOT NULL DEFAULT 1,
  CONSTRAINT fk_preferencias_notificacion_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT uq_preferencia_usuario_tipo UNIQUE (usuario_id, tipo)
) ENGINE=InnoDB;

CREATE TABLE movimientos_bancarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  huella VARCHAR(64) NOT NULL,
  plantel_id INT NOT NULL,
  cuenta VARCHAR(40) NOT NULL,
  folio VARCHAR(60) NOT NULL,
  referencia VARCHAR(60) NOT NULL,
  fecha DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  clave_pago VARCHAR(36) NOT NULL,
  cargo_id INT NULL,
  pago_id INT NULL,
  estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movimientos_bancarios_plantel_id FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  CONSTRAINT fk_movimientos_bancarios_cargo_id FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  CONSTRAINT fk_movimientos_bancarios_pago_id FOREIGN KEY (pago_id) REFERENCES pagos(id),
  CONSTRAINT uq_movimiento_huella UNIQUE (huella),
  CONSTRAINT uq_movimiento_clave_pago UNIQUE (clave_pago)
) ENGINE=InnoDB;

CREATE INDEX idx_asistencia_alumno_fecha ON asistencias(alumno_id, fecha);

CREATE INDEX idx_tramite_plantel_estado ON tramites(plantel_id, estado);
ALTER TABLE eventos_calendario ADD clave_importacion VARCHAR(64) NULL;
CREATE UNIQUE INDEX uq_evento_importacion ON eventos_calendario(clave_importacion);
CREATE TABLE calendario_historial (
 id INT AUTO_INCREMENT PRIMARY KEY,
 evento_id INT NOT NULL, usuario_id INT NOT NULL, plantel_id INT NULL,
 accion VARCHAR(20) NOT NULL, alcance VARCHAR(600) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
