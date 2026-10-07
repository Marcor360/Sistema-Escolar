-- Ciclos explícitos, política configurable y módulos operativos. Baseline v1 intacto.
ALTER TABLE ciclos_escolares ADD estado NVARCHAR(15) NOT NULL CONSTRAINT df_ciclo_estado DEFAULT 'PREPARACION';
GO
UPDATE ciclos_escolares SET estado = CASE WHEN activo = 1 THEN 'ACTIVO' WHEN EXISTS (SELECT 1 FROM grupos g WHERE g.ciclo_id = ciclos_escolares.id) THEN 'CERRADO' ELSE 'PREPARACION' END;
ALTER TABLE conceptos_pago ADD aplica_recargo BIT NOT NULL CONSTRAINT df_concepto_recargo DEFAULT 0;
CREATE TABLE bitacora_academica (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  plantel_id INT NULL,
  accion NVARCHAR(40) NOT NULL,
  entidad_id INT NOT NULL,
  detalle NVARCHAR(1000) NOT NULL,
  fecha DATETIME2 NOT NULL
);
CREATE TABLE incidencias (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  alumno_id INT NOT NULL,
  grupo_id INT NOT NULL,
  registrada_por_id INT NOT NULL,
  tipo NVARCHAR(40) NOT NULL,
  gravedad NVARCHAR(10) NOT NULL,
  descripcion NVARCHAR(2000) NOT NULL,
  estado NVARCHAR(15) NOT NULL,
  fecha DATETIME2 NOT NULL
);
CREATE TABLE incidencia_seguimientos (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  incidencia_id INT NOT NULL,
  usuario_id INT NOT NULL,
  nota NVARCHAR(2000) NOT NULL,
  motivo NVARCHAR(500) NOT NULL,
  estado NVARCHAR(15) NOT NULL,
  fecha DATETIME2 NOT NULL
);
CREATE TABLE push_dispositivos (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  sesion_id NVARCHAR(36) NOT NULL,
  instalacion_id NVARCHAR(36) NOT NULL,
  token NVARCHAR(200) NOT NULL,
  activo BIT NOT NULL,
  actualizado_en DATETIME2 NOT NULL
);
CREATE TABLE push_envios (
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  notificacion_id INT NOT NULL,
  dispositivo_id INT NOT NULL,
  estado NVARCHAR(15) NOT NULL,
  intentos INT NOT NULL,
  proximo_intento DATETIME2 NOT NULL,
  ticket_id NVARCHAR(100) NULL,
  error NVARCHAR(100) NULL
);
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
  id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  nombre NVARCHAR(200) NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  proximo_intento DATETIME2 NOT NULL,
  error NVARCHAR(100) NULL
);
GO
CREATE UNIQUE INDEX uq_archivo_limpieza_nombre ON archivos_limpieza(nombre);
