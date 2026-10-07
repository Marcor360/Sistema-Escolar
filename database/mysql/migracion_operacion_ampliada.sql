-- Ciclos explícitos, política configurable y módulos operativos. Baseline v1 intacto.
ALTER TABLE ciclos_escolares ADD estado VARCHAR(15) NOT NULL DEFAULT 'PREPARACION';
UPDATE ciclos_escolares SET estado = CASE WHEN activo = 1 THEN 'ACTIVO' WHEN EXISTS (SELECT 1 FROM grupos g WHERE g.ciclo_id = ciclos_escolares.id) THEN 'CERRADO' ELSE 'PREPARACION' END;
ALTER TABLE conceptos_pago ADD aplica_recargo BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE bitacora_academica (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  plantel_id INT NULL,
  accion VARCHAR(40) NOT NULL,
  entidad_id INT NOT NULL,
  detalle VARCHAR(1000) NOT NULL,
  fecha DATETIME NOT NULL
) ENGINE=InnoDB;
CREATE TABLE incidencias (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  grupo_id INT NOT NULL,
  registrada_por_id INT NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  gravedad VARCHAR(10) NOT NULL,
  descripcion VARCHAR(2000) NOT NULL,
  estado VARCHAR(15) NOT NULL,
  fecha DATETIME NOT NULL
) ENGINE=InnoDB;
CREATE TABLE incidencia_seguimientos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  incidencia_id INT NOT NULL,
  usuario_id INT NOT NULL,
  nota VARCHAR(2000) NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  estado VARCHAR(15) NOT NULL,
  fecha DATETIME NOT NULL
) ENGINE=InnoDB;
CREATE TABLE push_dispositivos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  sesion_id VARCHAR(36) NOT NULL,
  instalacion_id VARCHAR(36) NOT NULL,
  token VARCHAR(200) NOT NULL,
  activo BOOLEAN NOT NULL,
  actualizado_en DATETIME NOT NULL
) ENGINE=InnoDB;
CREATE TABLE push_envios (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  notificacion_id INT NOT NULL,
  dispositivo_id INT NOT NULL,
  estado VARCHAR(15) NOT NULL,
  intentos INT NOT NULL,
  proximo_intento DATETIME NOT NULL,
  ticket_id VARCHAR(100) NULL,
  error VARCHAR(100) NULL
) ENGINE=InnoDB;
CREATE UNIQUE INDEX uq_push_token ON push_dispositivos(token);
CREATE UNIQUE INDEX uq_push_notificacion_dispositivo ON push_envios(notificacion_id, dispositivo_id);
CREATE INDEX idx_push_pendientes ON push_envios(estado, proximo_intento);
CREATE INDEX idx_incidencia_alumno ON incidencias(alumno_id, grupo_id);
CREATE INDEX idx_seguimiento_incidencia ON incidencia_seguimientos(incidencia_id);
CREATE INDEX idx_academica_plantel ON bitacora_academica(plantel_id, fecha);

ALTER TABLE bitacora_academica ADD CONSTRAINT fk_bitacora_academica_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE bitacora_academica ADD CONSTRAINT fk_bitacora_academica_plantel_id FOREIGN KEY (plantel_id) REFERENCES planteles(id);
ALTER TABLE incidencias ADD CONSTRAINT fk_incidencias_alumno_id FOREIGN KEY (alumno_id) REFERENCES alumnos(id);
ALTER TABLE incidencias ADD CONSTRAINT fk_incidencias_grupo_id FOREIGN KEY (grupo_id) REFERENCES grupos(id);
ALTER TABLE incidencias ADD CONSTRAINT fk_incidencias_registrada_por_id FOREIGN KEY (registrada_por_id) REFERENCES usuarios(id);
ALTER TABLE incidencia_seguimientos ADD CONSTRAINT fk_incidencia_seguimientos_incidencia_id FOREIGN KEY (incidencia_id) REFERENCES incidencias(id);
ALTER TABLE incidencia_seguimientos ADD CONSTRAINT fk_incidencia_seguimientos_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE push_dispositivos ADD CONSTRAINT fk_push_dispositivos_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE push_dispositivos ADD CONSTRAINT fk_push_dispositivos_sesion_id FOREIGN KEY (sesion_id) REFERENCES sesiones(id) ON DELETE CASCADE;
ALTER TABLE push_envios ADD CONSTRAINT fk_push_envios_notificacion_id FOREIGN KEY (notificacion_id) REFERENCES notificaciones(id);
ALTER TABLE push_envios ADD CONSTRAINT fk_push_envios_dispositivo_id FOREIGN KEY (dispositivo_id) REFERENCES push_dispositivos(id) ON DELETE CASCADE;

CREATE TABLE archivos_limpieza (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  proximo_intento DATETIME NOT NULL,
  error VARCHAR(100) NULL
) ENGINE=InnoDB;
CREATE UNIQUE INDEX uq_archivo_limpieza_nombre ON archivos_limpieza(nombre);
