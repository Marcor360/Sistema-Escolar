-- =====================================================================
-- Sistema Escolar Multiplataforma (MVP) — Esquema MySQL 8.x
-- Equivalente 1:1 con database/sqlserver/schema.sql y con las
-- entidades TypeORM del backend (naming: snake_case).
-- =====================================================================
CREATE DATABASE IF NOT EXISTS escolar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE escolar;

-- ---------- Seguridad / usuarios ----------
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(30) NOT NULL UNIQUE,          -- ALUMNO | MAESTRO | ADMINISTRATIVO | FINANZAS | SUPERADMIN
  nombre VARCHAR(80) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(120) NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  apellido_paterno VARCHAR(80) NOT NULL,
  apellido_materno VARCHAR(80) NULL,
  telefono VARCHAR(20) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  session_version INT NOT NULL DEFAULT 0,
  activacion_pendiente TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_usuarios_legacy (legacy_id)
) ENGINE=InnoDB;

CREATE TABLE planteles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(80) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(200) NULL,
  municipio VARCHAR(80) NULL,
  telefono VARCHAR(20) NULL,
  director_usuario_id INT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  CONSTRAINT fk_plantel_director FOREIGN KEY (director_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY uq_planteles_legacy (legacy_id)
) ENGINE=InnoDB;

CREATE TABLE usuario_planteles (
  usuario_id INT NOT NULL,
  plantel_id INT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, plantel_id),
  CONSTRAINT fk_up_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE usuario_roles (
  usuario_id INT NOT NULL,
  rol_id INT NOT NULL,
  PRIMARY KEY (usuario_id, rol_id),
  CONSTRAINT fk_ur_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prt_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE activacion_tokens (
  id VARCHAR(36) PRIMARY KEY,
  usuario_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  intentos INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  KEY idx_activacion_usuario (usuario_id)
) ENGINE=InnoDB;

-- ---------- Personas ----------
CREATE TABLE alumnos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  plantel_id INT NOT NULL,
  matricula VARCHAR(20) NOT NULL UNIQUE,
  curp VARCHAR(18) NULL,
  fecha_nacimiento DATE NULL,
  tutor_nombre VARCHAR(120) NULL,
  tutor_telefono VARCHAR(20) NULL,
  direccion VARCHAR(200) NULL,
  estatus VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',   -- ACTIVO | BAJA | EGRESADO
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  CONSTRAINT fk_al_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_al_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
  UNIQUE KEY uq_alumnos_legacy (legacy_id)
) ENGINE=InnoDB;

CREATE TABLE docentes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  num_empleado VARCHAR(20) NOT NULL UNIQUE,
  cedula_profesional VARCHAR(20) NULL,
  especialidad VARCHAR(120) NULL,
  estatus VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',   -- ACTIVO | BAJA
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  CONSTRAINT fk_do_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  UNIQUE KEY uq_docentes_legacy (legacy_id)
) ENGINE=InnoDB;

-- ---------- Estructura académica ----------
CREATE TABLE ciclos_escolares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(20) NOT NULL UNIQUE,               -- p.ej. 2026-1
  nombre VARCHAR(80) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 0,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_ciclos_escolares_legacy (legacy_id)
) ENGINE=InnoDB;

CREATE TABLE materias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(300) NULL,
  creditos INT NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_materias_legacy (legacy_id)
) ENGINE=InnoDB;

CREATE TABLE grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ciclo_id INT NOT NULL,
  plantel_id INT NOT NULL,
  nombre VARCHAR(40) NOT NULL,
  grado VARCHAR(20) NULL,
  turno VARCHAR(10) NULL,                          -- MATUTINO | VESPERTINO
  activo TINYINT(1) NOT NULL DEFAULT 1,             -- ver migracion_grupos_ciclo_vida.sql
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_grupo_ciclo_plantel_nombre (ciclo_id, plantel_id, nombre),
  UNIQUE KEY uq_grupos_legacy (legacy_id),
  CONSTRAINT fk_gr_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
  CONSTRAINT fk_gr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id)
) ENGINE=InnoDB;

-- Materia impartida en un grupo por un docente (1 docente por grupo-materia)
CREATE TABLE grupo_materias (
  regimen_evaluacion VARCHAR(30) NOT NULL DEFAULT 'CUATRO_PARCIALES_10',
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id INT NOT NULL,
  materia_id INT NOT NULL,
  docente_id INT NULL,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_gm (grupo_id, materia_id),
  UNIQUE KEY uq_grupo_materias_legacy (legacy_id),
  CONSTRAINT fk_gm_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_materia FOREIGN KEY (materia_id) REFERENCES materias(id),
  CONSTRAINT fk_gm_docente FOREIGN KEY (docente_id) REFERENCES docentes(id)
) ENGINE=InnoDB;

CREATE TABLE inscripciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  grupo_id INT NOT NULL,
  fecha_inscripcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estatus VARCHAR(15) NOT NULL DEFAULT 'ACTIVA',   -- ACTIVA | BAJA
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_insc (alumno_id, grupo_id),
  UNIQUE KEY uq_inscripciones_legacy (legacy_id),
  CONSTRAINT fk_in_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_in_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id)
) ENGINE=InnoDB;

-- ---------- Trabajo académico ----------
CREATE TABLE actividades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'TAREA',       -- TAREA | EXAMEN | PROYECTO | PARTICIPACION
  parcial INT NOT NULL DEFAULT 1,
  ponderacion DECIMAL(5,2) NOT NULL DEFAULT 0,
  fecha_entrega DATETIME NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ac_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE entregas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actividad_id INT NOT NULL,
  alumno_id INT NOT NULL,
  comentario_alumno VARCHAR(500) NULL,
  archivo_nombre VARCHAR(200) NULL,
  archivo_ruta VARCHAR(300) NULL,
  escala_maxima INT NOT NULL DEFAULT 100,
  calificacion DECIMAL(9,6) NULL,
  comentario_docente VARCHAR(500) NULL,
  estatus VARCHAR(15) NOT NULL DEFAULT 'ENTREGADA', -- ENTREGADA | CALIFICADA | TARDE
  fecha_entregado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_entrega (actividad_id, alumno_id),
  CONSTRAINT fk_en_actividad FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
  CONSTRAINT fk_en_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
) ENGINE=InnoDB;

CREATE TABLE materiales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  archivo_nombre VARCHAR(200) NOT NULL,
  archivo_ruta VARCHAR(300) NOT NULL,
  mime VARCHAR(100) NULL,
  tamano_kb INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ma_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Calificación por parcial (1-3) y final (parcial = 0)
CREATE TABLE calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  escala_maxima INT NOT NULL DEFAULT 100,
  calificacion DECIMAL(11,8) NOT NULL,
  observaciones VARCHAR(300) NULL,
  capturada_por_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_calif (alumno_id, grupo_materia_id, parcial),
  CONSTRAINT fk_ca_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_ca_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_usuario FOREIGN KEY (capturada_por_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE periodos_calificacion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  estatus VARCHAR(10) NOT NULL DEFAULT 'ABIERTO',
  cerrado_por_id INT NULL,
  cerrado_at DATETIME NULL,
  reabierto_por_id INT NULL,
  reabierto_at DATETIME NULL,
  UNIQUE KEY uq_periodo_calificacion (grupo_materia_id, parcial),
  CONSTRAINT fk_periodo_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE historial_calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calificacion_id INT NOT NULL,
  alumno_id INT NOT NULL,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  escala_anterior INT NOT NULL DEFAULT 100,
  escala_nueva INT NOT NULL DEFAULT 100,
  detalle_calculo TEXT NULL,
  valor_anterior DECIMAL(11,8) NULL,
  valor_nuevo DECIMAL(11,8) NOT NULL,
  observacion_anterior VARCHAR(300) NULL,
  observacion_nueva VARCHAR(300) NULL,
  usuario_id INT NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motivo VARCHAR(300) NULL,
  KEY idx_historial_calificacion (calificacion_id),
  KEY idx_historial_periodo (grupo_materia_id, parcial)
) ENGINE=InnoDB;

CREATE TABLE eventos_calendario (
  ciclo_id INT NULL,
  nivel_id INT NULL,
  audiencia VARCHAR(20) NOT NULL DEFAULT 'ACADEMICA',
  imagen_nombre VARCHAR(100) NULL,
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  descripcion VARCHAR(400) NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'GENERAL',     -- GENERAL | EXAMEN | ENTREGA | FESTIVO | PAGO | JUNTA
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NULL,
  plantel_id INT NULL,
  grupo_id INT NULL,
  creado_por_id INT NULL,
  CONSTRAINT fk_ev_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE SET NULL,
  CONSTRAINT fk_ev_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE SET NULL,
  CONSTRAINT fk_evento_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_evento_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id)
) ENGINE=InnoDB;
CREATE INDEX idx_evento_ciclo_nivel ON eventos_calendario(ciclo_id,nivel_id);

CREATE TABLE notificaciones (
    push_pendiente BOOLEAN NOT NULL DEFAULT FALSE,
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje VARCHAR(600) NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'GENERAL',     -- GENERAL | ACADEMICA | FINANCIERA
  leida TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_no_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Finanzas ----------
CREATE TABLE conceptos_pago (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  tipo VARCHAR(20) NOT NULL,                       -- INSCRIPCION | COLEGIATURA | RECARGO | DESCUENTO | BECA | OTRO
  monto_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  UNIQUE KEY uq_conceptos_pago_legacy (legacy_id)
) ENGINE=InnoDB;

CREATE TABLE cargos (
    plantel_id INT NOT NULL,
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  concepto_id INT NOT NULL,
  ciclo_id INT NULL,
  periodo CHAR(7) NULL,                            -- YYYY-MM (colegiaturas)
  clave_generacion VARCHAR(80) NULL,               -- clave estable para evitar colegiaturas duplicadas concurrentes
  descripcion VARCHAR(200) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,      -- descuentos y becas aplicados
  recargo DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_vencimiento DATE NULL,
  estatus VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',-- PENDIENTE | PARCIAL | PAGADO | VENCIDO | CANCELADO
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  KEY idx_cargo_alumno (alumno_id),
  KEY idx_cargo_periodo (periodo),
  UNIQUE KEY uq_cargos_clave_generacion (clave_generacion),
  KEY idx_cargos_alumno (alumno_id),               -- ver migracion_indices.sql
  UNIQUE KEY uq_cargos_legacy (legacy_id),
  CONSTRAINT fk_cg_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_cg_concepto FOREIGN KEY (concepto_id) REFERENCES conceptos_pago(id),
  CONSTRAINT fk_cg_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id)
) ENGINE=InnoDB;

CREATE TABLE ordenes_pago (
    plantel_id INT NOT NULL,
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  cargo_id INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  proveedor VARCHAR(20) NOT NULL DEFAULT 'OPENPAY',
  id_externo VARCHAR(60) NULL,                     -- id del cargo en la pasarela
  url_pago VARCHAR(300) NULL,
  estatus VARCHAR(15) NOT NULL DEFAULT 'CREADA',   -- CREADA | PENDIENTE | COMPLETADA | FALLIDA | CANCELADA | EXPIRADA
  expira_en DATETIME NULL,
  payload_webhook TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orden_externo (id_externo),
  CONSTRAINT fk_op_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_op_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id)
) ENGINE=InnoDB;

CREATE TABLE pagos (
    plantel_id INT NOT NULL,
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  cargo_id INT NULL,
  orden_pago_id INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo VARCHAR(15) NOT NULL,                     -- EFECTIVO | TRANSFERENCIA | TARJETA | PASARELA
  referencia VARCHAR(60) NULL,
  clave_idempotencia VARCHAR(36) NULL,
  estatus VARCHAR(15) NOT NULL DEFAULT 'CONFIRMADO',-- CONFIRMADO | PENDIENTE | FALLIDO | CANCELADO
  fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registrado_por_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  KEY idx_pago_alumno (alumno_id),
  UNIQUE KEY uq_pagos_orden_pago (orden_pago_id),
  UNIQUE KEY uq_pagos_clave_idempotencia (clave_idempotencia),
  UNIQUE KEY uq_pagos_legacy (legacy_id),
  CONSTRAINT fk_pg_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_pg_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  CONSTRAINT fk_pg_orden FOREIGN KEY (orden_pago_id) REFERENCES ordenes_pago(id),
  CONSTRAINT fk_pg_usuario FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE plantillas_correo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(30) NOT NULL UNIQUE,
  asunto VARCHAR(150) NOT NULL,
  cuerpo_html TEXT NOT NULL
) ENGINE=InnoDB;

-- ---------- Bitácoras ----------
CREATE TABLE bitacora_financiera (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plantel_id INT NULL,
  usuario_id INT NULL,
  accion VARCHAR(60) NOT NULL,
  entidad VARCHAR(40) NOT NULL,
  entidad_id INT NULL,
  detalle VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bitacora_financiera_plantel (plantel_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE bitacora_actividad (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  metodo VARCHAR(8) NOT NULL,
  ruta VARCHAR(200) NOT NULL,
  entidad VARCHAR(100) NULL,
  entidad_id INT NULL,
  resultado VARCHAR(10) NOT NULL DEFAULT 'EXITO',
  status_code SMALLINT NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Configuración institucional ----------
CREATE TABLE configuracion_marca (
  id INT NOT NULL PRIMARY KEY,
  nombre_institucion VARCHAR(150) NOT NULL DEFAULT 'Sistema Escolar',
  nombre_corto VARCHAR(10) NOT NULL DEFAULT 'SE',
  logo_url VARCHAR(255) NULL,
  color_primario CHAR(7) NOT NULL DEFAULT '#14343B',
  color_acento CHAR(7) NOT NULL DEFAULT '#C79A3C',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO configuracion_marca (id) VALUES (1);

-- Sesiones por dispositivo; solo se persiste el hash del refresh rotativo.
CREATE TABLE sesiones (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  portal VARCHAR(5) NOT NULL,
  refresh_hash VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  expira_en DATETIME NOT NULL,
  ultima_actividad_en DATETIME NULL,
  revocada BOOLEAN NOT NULL DEFAULT FALSE,
  KEY idx_sesiones_usuario (usuario_id),
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE usuarios ADD password_change_required BOOLEAN NOT NULL DEFAULT FALSE;

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

ALTER TABLE cargos ADD CONSTRAINT fk_cargos_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_cargo_plantel ON cargos(plantel_id);

ALTER TABLE pagos ADD CONSTRAINT fk_pagos_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_pago_plantel ON pagos(plantel_id);

ALTER TABLE ordenes_pago ADD CONSTRAINT fk_ordenes_pago_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_orden_pago_plantel ON ordenes_pago(plantel_id);

CREATE TABLE cobranza_envios (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 clave VARCHAR(64) NOT NULL,
 plantel_id INT NOT NULL, usuario_id INT NOT NULL, actor_id INT NOT NULL,
 saldo DECIMAL(12,2) NOT NULL,
 estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE', intentos INT NOT NULL DEFAULT 0,
 proximo_intento DATETIME NOT NULL, error VARCHAR(80) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_cobranza_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_cobranza_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
 CONSTRAINT fk_cobranza_actor FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_cobranza_clave ON cobranza_envios(clave);

-- 1.18.0: previews compartidos, cifrados y consumidos transaccionalmente.
CREATE TABLE importacion_previews (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 actor_id INT NOT NULL,
 tipo VARCHAR(15) NOT NULL,
 expira DATETIME NOT NULL,
 CONSTRAINT fk_importacion_preview_actor FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_importacion_actor_expira ON importacion_previews(actor_id,expira);
CREATE TABLE importacion_filas (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 preview_id VARCHAR(36) NOT NULL,
 posicion INT NOT NULL,
 contenido VARCHAR(8000) NOT NULL,
 CONSTRAINT fk_importacion_fila_preview FOREIGN KEY (preview_id) REFERENCES importacion_previews(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_importacion_fila ON importacion_filas(preview_id,posicion);

-- Biblioteca privada: migración aditiva, sin alterar ni recrear datos existentes.
CREATE TABLE biblioteca_carpetas (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 padre_id INT NULL,
 nombre VARCHAR(120) NOT NULL,
 CONSTRAINT fk_biblioteca_carpeta_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_biblioteca_carpeta_padre FOREIGN KEY (padre_id) REFERENCES biblioteca_carpetas(id)
);
CREATE INDEX idx_biblioteca_carpeta_plantel ON biblioteca_carpetas(plantel_id,padre_id);
CREATE TABLE biblioteca_archivos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 carpeta_id INT NOT NULL,
 titulo VARCHAR(150) NOT NULL,
 archivo_nombre VARCHAR(200) NOT NULL,
 archivo_ruta VARCHAR(200) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 bytes INT NOT NULL,
 categoria VARCHAR(20) NOT NULL,
 creado_por_id INT NOT NULL,
 creado_at DATETIME NOT NULL,
 CONSTRAINT fk_biblioteca_archivo_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_biblioteca_archivo_carpeta FOREIGN KEY (carpeta_id) REFERENCES biblioteca_carpetas(id),
 CONSTRAINT ck_biblioteca_bytes CHECK (bytes > 0 AND bytes <= 10485760),
 CONSTRAINT ck_biblioteca_categoria CHECK (categoria IN ('FOTO','LOGO','CALENDARIO','DOCUMENTO'))
);
CREATE INDEX idx_biblioteca_archivo_plantel ON biblioteca_archivos(plantel_id,carpeta_id);

-- Paridad documental de catálogos académicos (#97).
-- Aditiva: sin catálogo precargado; grupos históricos conservan contexto NULL.
CREATE TABLE niveles_academicos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave VARCHAR(20) NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_niveles_academicos_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_nivel_plantel_clave UNIQUE (plantel_id,clave)
);
CREATE TABLE carreras_planes (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave VARCHAR(20) NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 nivel_id INT NOT NULL,
 version_plan VARCHAR(40) NOT NULL,
 CONSTRAINT fk_carrera_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id),
 CONSTRAINT fk_carreras_planes_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_carrera_plan UNIQUE (plantel_id,nivel_id,clave,version_plan)
);
CREATE TABLE periodos_academicos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave VARCHAR(20) NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 carrera_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 tipo VARCHAR(16) NOT NULL,
 numero INT NOT NULL,
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
 CONSTRAINT fk_periodo_carrera FOREIGN KEY (carrera_id) REFERENCES carreras_planes(id),
 CONSTRAINT fk_periodo_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT ck_periodo_tipo CHECK (tipo IN ('ANUAL','SEMESTRAL','CUATRIMESTRAL')),
 CONSTRAINT ck_periodo_numero CHECK (numero BETWEEN 1 AND 1000),
 CONSTRAINT fk_periodos_academicos_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_periodo_carrera_ciclo_clave UNIQUE (carrera_id,ciclo_id,clave),
 CONSTRAINT uq_periodo_carrera_ciclo_numero UNIQUE (carrera_id,ciclo_id,tipo,numero)
);
ALTER TABLE grupos ADD nivel_id INT NULL, ADD carrera_id INT NULL, ADD periodo_academico_id INT NULL;
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_nivel_id FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id);
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_carrera_id FOREIGN KEY (carrera_id) REFERENCES carreras_planes(id);
ALTER TABLE grupos ADD CONSTRAINT fk_grupos_periodo_academico_id FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id);
ALTER TABLE grupos ADD CONSTRAINT ck_grupo_contexto_completo CHECK ((nivel_id IS NULL AND carrera_id IS NULL AND periodo_academico_id IS NULL) OR (nivel_id IS NOT NULL AND carrera_id IS NOT NULL AND periodo_academico_id IS NOT NULL));
CREATE INDEX idx_grupos_contexto ON grupos(plantel_id,nivel_id,carrera_id,periodo_academico_id);

-- Paridad documental de programas especiales (#98).
-- Grupos existentes REGULAR; programas manuales sin nuevos alumnos, cargos ni cuentas.
CREATE TABLE programas_especiales (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 clave VARCHAR(20) NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 tipo VARCHAR(24) NOT NULL,
 fecha_inicio DATE NOT NULL,
 fecha_fin DATE NOT NULL,
 estado VARCHAR(16) NOT NULL DEFAULT 'ACTIVO',
 CONSTRAINT uq_programa_plantel_ciclo_clave UNIQUE (plantel_id,ciclo_id,clave),
 CONSTRAINT fk_programa_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_programa_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT ck_programa_tipo CHECK (tipo IN ('DIPLOMADO','CERTIFICACION','ESPECIALIZACION','EXTRACURRICULAR')),
 CONSTRAINT ck_programa_estado CHECK (estado IN ('ACTIVO','CERRADO','CANCELADO')),
 CONSTRAINT ck_programa_fechas CHECK (fecha_inicio <= fecha_fin)
);
ALTER TABLE grupos ADD tipo VARCHAR(12) NOT NULL DEFAULT 'REGULAR', ADD programa_especial_id INT NULL, ADD cupo_manual INT NULL;
ALTER TABLE grupos ADD CONSTRAINT fk_grupo_programa FOREIGN KEY (programa_especial_id) REFERENCES programas_especiales(id);
ALTER TABLE grupos ADD CONSTRAINT ck_grupo_modalidad CHECK ((tipo = 'REGULAR' AND programa_especial_id IS NULL AND cupo_manual IS NULL) OR (tipo = 'ESPECIAL' AND programa_especial_id IS NOT NULL AND cupo_manual IS NOT NULL AND cupo_manual BETWEEN 1 AND 10000));
CREATE INDEX idx_grupo_programa ON grupos(programa_especial_id,tipo);

-- Agrupación ordinaria incremental
CREATE TABLE solicitudes_grupo_regular (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 nivel_id INT NOT NULL,
 carrera_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 turno VARCHAR(10) NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
 grupo_id INT NULL,
 CONSTRAINT uq_solicitud_alumno_ciclo UNIQUE (alumno_id,ciclo_id),
 CONSTRAINT ck_solicitud_estado CHECK (estado IN ('PENDIENTE','ASIGNADA','ANULADA','PAUSA')),
 CONSTRAINT ck_solicitud_turno CHECK (turno IN ('MATUTINO','VESPERTINO')),
 CONSTRAINT ck_solicitud_asignada CHECK ((estado='ASIGNADA' AND grupo_id IS NOT NULL) OR (estado <> 'ASIGNADA' AND grupo_id IS NULL))
);
CREATE INDEX idx_solicitud_cohorte ON solicitudes_grupo_regular(plantel_id,ciclo_id,periodo_academico_id,turno,estado);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_carrera FOREIGN KEY (carrera_id) REFERENCES carreras_planes(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_periodo_academico FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id);
ALTER TABLE solicitudes_grupo_regular ADD CONSTRAINT fk_sgr_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id);

-- Apertura de cartera incremental
CREATE TABLE aperturas_cartera (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 idempotencia VARCHAR(36) NOT NULL,
 peticion_hash VARCHAR(64) NOT NULL,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 solicitud_id INT NULL,
 creado_por_id INT NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
 contexto_json TEXT NULL,
 conceptos TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_apertura_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_apertura_alumno_ciclo UNIQUE (alumno_id,ciclo_id),
 CONSTRAINT ck_apertura_estado CHECK (estado IN ('PENDIENTE','ABIERTA','PAUSA')),
 CONSTRAINT fk_ac_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_ac_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_ac_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT fk_ac_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_grupo_regular(id),
 CONSTRAINT fk_ac_usuario FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_apertura_solicitud ON aperturas_cartera(solicitud_id);

-- Recursamiento incremental
CREATE TABLE participaciones_asignatura (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 idempotencia VARCHAR(36) NOT NULL,
 alumno_id INT NOT NULL,
 grupo_materia_id INT NOT NULL,
 inscripcion_principal_id INT NOT NULL,
 cupo_total_confirmado INT NOT NULL,
 intento INT NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'ACTIVA',
 activo_clave VARCHAR(80) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_participacion_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_participacion_intento UNIQUE (alumno_id,grupo_materia_id,intento),
 CONSTRAINT fk_pa_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_pa_clase FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT fk_pa_principal FOREIGN KEY (inscripcion_principal_id) REFERENCES inscripciones(id),
 CONSTRAINT ck_pa_intento CHECK (intento >= 1 AND cupo_total_confirmado BETWEEN 1 AND 10000),
 CONSTRAINT ck_pa_estado CHECK (estado IN ('ACTIVA','BAJA','FINALIZADA')),
 CONSTRAINT ck_pa_activa CHECK ((estado='ACTIVA' AND activo_clave IS NOT NULL) OR (estado<>'ACTIVA' AND activo_clave IS NULL))
);
CREATE TABLE cupos_recursamiento (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 grupo_materia_id INT NOT NULL,
 cupo_total_manual INT NOT NULL,
 CONSTRAINT uq_cupo_clase UNIQUE (grupo_materia_id),
 CONSTRAINT fk_cr_clase FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT ck_cr_cupo CHECK (cupo_total_manual BETWEEN 1 AND 10000)
);
CREATE TABLE calificaciones_recursamiento (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 participacion_id INT NOT NULL,
 parcial INT NOT NULL,
 calificacion DECIMAL(5,2) NOT NULL,
 capturada_por_id INT NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_nota_recursamiento UNIQUE (participacion_id,parcial),
 CONSTRAINT fk_nrec_participacion FOREIGN KEY (participacion_id) REFERENCES participaciones_asignatura(id),
 CONSTRAINT fk_nrec_usuario FOREIGN KEY (capturada_por_id) REFERENCES usuarios(id),
 CONSTRAINT ck_nrec_valores CHECK (parcial BETWEEN 0 AND 3 AND calificacion BETWEEN 0 AND 100)
);
CREATE TABLE historial_recursamiento (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 participacion_id INT NOT NULL,
 parcial INT NOT NULL,
 anterior DECIMAL(9,6) NULL,
 nueva DECIMAL(9,6) NOT NULL,
 usuario_id INT NOT NULL,
 motivo VARCHAR(400) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_hrec_participacion FOREIGN KEY (participacion_id) REFERENCES participaciones_asignatura(id),
 CONSTRAINT fk_hrec_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_participacion_activa ON participaciones_asignatura(activo_clave);

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
CREATE INDEX idx_auth_outbox_expira ON auth_correo_outbox(expira_en);

-- Sin clasificar ni duplicar materias históricas.
ALTER TABLE materias ADD tipo VARCHAR(16) NULL;
ALTER TABLE materias ADD CONSTRAINT ck_materia_tipo CHECK (tipo IS NULL OR tipo IN ('OBLIGATORIA','OPTATIVA','ADICIONAL','COMPLEMENTARIA'));
CREATE TABLE materia_contextos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 materia_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT 1,
 CONSTRAINT uq_materia_periodo UNIQUE (materia_id,periodo_academico_id),
 CONSTRAINT fk_materia_contexto_materia FOREIGN KEY (materia_id) REFERENCES materias(id),
 CONSTRAINT fk_materia_contexto_periodo FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id)
);

-- Temarios independientes (migracion_temarios.sql)
-- Dominio independiente: no genera actividades, inscripciones ni calificaciones.
CREATE TABLE temas (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 grupo_materia_id INT NOT NULL,
 indice INT NOT NULL,
 titulo VARCHAR(150) NOT NULL,
 contenido TEXT NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'BORRADOR',
 desde DATETIME NULL,
 hasta DATETIME NULL,
 parcial INT NULL,
 enlace VARCHAR(1000) NULL,
 revision INT NOT NULL DEFAULT 1,
 creador_id INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_tema_clase_indice UNIQUE (grupo_materia_id, indice),
 CONSTRAINT ck_tema_estado CHECK (estado IN ('BORRADOR','PUBLICADO','CANCELADO')),
 CONSTRAINT ck_tema_numeros CHECK (indice BETWEEN 1 AND 10000 AND revision >= 1 AND (parcial IS NULL OR parcial BETWEEN 1 AND 3)),
 CONSTRAINT ck_tema_fechas CHECK (desde IS NULL OR hasta IS NULL OR hasta >= desde),
 CONSTRAINT fk_tema_clase FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT fk_tema_creador FOREIGN KEY (creador_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_tema_publicacion ON temas(grupo_materia_id, estado, desde);
CREATE TABLE tema_adjuntos (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 tema_id INT NOT NULL,
 archivo_nombre VARCHAR(200) NOT NULL,
 archivo_ruta VARCHAR(300) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 tamano_kb INT NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT 1,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_tema_adjunto FOREIGN KEY (tema_id) REFERENCES temas(id)
);
CREATE INDEX idx_tema_adjunto ON tema_adjuntos(tema_id, activo);

CREATE TABLE tema_revisiones (
 id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
 tema_id INT NOT NULL,
 revision INT NOT NULL,
 usuario_id INT NOT NULL,
 accion VARCHAR(40) NOT NULL,
 detalle TEXT NOT NULL,
 fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_tema_revision UNIQUE (tema_id,revision),
 CONSTRAINT fk_revision_tema FOREIGN KEY (tema_id) REFERENCES temas(id),
 CONSTRAINT fk_revision_tema_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Aceptaciones institucionales versionadas (migracion_aceptaciones_institucionales.sql)
CREATE TABLE aceptaciones_institucionales (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  documento VARCHAR(32) NOT NULL,
  version_documento VARCHAR(80) NOT NULL,
  aceptado_en DATETIME(3) NOT NULL,
  CONSTRAINT uq_aceptacion_documento_version UNIQUE (usuario_id, documento, version_documento),
  CONSTRAINT fk_aceptacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- El catálogo de niveles se define después del calendario en este esquema documental.
ALTER TABLE eventos_calendario ADD CONSTRAINT fk_evento_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id);

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

ALTER TABLE sesiones ADD dispositivo VARCHAR(100) NOT NULL DEFAULT 'Dispositivo no identificado';

-- Aditiva: conserva entregas, adjuntos, comentarios y calificaciones existentes.
ALTER TABLE entregas ADD respuesta_texto VARCHAR(3000) NULL;

-- Registro institucional único por alumno y CURP; no elimina ni mueve datos existentes.
-- Egresados anteriores requieren conciliación documental antes de completar este registro.
CREATE TABLE egresos_alumnos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  ciclo_id INT NOT NULL,
  curp VARCHAR(18) NOT NULL,
  fecha_egreso DATETIME NOT NULL,
  archivar_desde DATETIME NOT NULL,
  estado_archivo VARCHAR(15) NOT NULL DEFAULT 'VIGENTE',
  ruta_archivo VARCHAR(300) NULL,
  sha256_archivo VARCHAR(64) NULL,
  archivado_en DATETIME NULL,
  CONSTRAINT fk_egresos_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_egresos_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
  CONSTRAINT uq_egreso_alumno UNIQUE (alumno_id),
  CONSTRAINT uq_egreso_curp UNIQUE (curp)
) ENGINE=InnoDB;
CREATE INDEX idx_egreso_ciclo_fecha ON egresos_alumnos(ciclo_id, fecha_egreso);

ALTER TABLE egresos_alumnos ADD fecha_documental DATE NULL;

-- Reinscripción por periodo (1.29.0)
CREATE TABLE autorizaciones_reinscripcion (
 id INT AUTO_INCREMENT PRIMARY KEY,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 financiero_id INT NOT NULL,
 cotizacion VARCHAR(64) NOT NULL,
 peticion_json TEXT NOT NULL,
 snapshot_json TEXT NOT NULL,
 estado VARCHAR(12) NOT NULL DEFAULT 'AUTORIZADA',
 vence_at DATETIME(6) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT fk_ar_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_ar_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_ar_usuario FOREIGN KEY (financiero_id) REFERENCES usuarios(id)
);
CREATE TABLE reinscripciones_periodo (
 id INT AUTO_INCREMENT PRIMARY KEY,
 idempotencia VARCHAR(36) NOT NULL,
 peticion_hash VARCHAR(64) NOT NULL,
 clave_origen VARCHAR(50) NULL,
 alumno_id INT NOT NULL,
 plantel_id INT NOT NULL,
 ciclo_id INT NOT NULL,
 origen_inscripcion_id INT NOT NULL,
 periodo_academico_id INT NOT NULL,
 nivel_id INT NOT NULL,
 carrera_id INT NOT NULL,
 turno VARCHAR(10) NOT NULL,
 grupo_id INT NULL,
 inscripcion_destino_id INT NULL,
 autorizacion_id INT NOT NULL,
 creado_por_id INT NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
 academico_hash VARCHAR(64) NOT NULL,
 snapshot_json TEXT NOT NULL,
 cargos_json TEXT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT uq_reinscripcion_idempotencia UNIQUE (idempotencia),
 CONSTRAINT uq_reinscripcion_autorizacion UNIQUE (autorizacion_id),
 CONSTRAINT fk_rp_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
 CONSTRAINT fk_rp_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT fk_rp_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
 CONSTRAINT fk_rp_origen FOREIGN KEY (origen_inscripcion_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_rp_periodo FOREIGN KEY (periodo_academico_id) REFERENCES periodos_academicos(id),
 CONSTRAINT fk_rp_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id),
 CONSTRAINT fk_rp_destino FOREIGN KEY (inscripcion_destino_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_rp_autorizacion FOREIGN KEY (autorizacion_id) REFERENCES autorizaciones_reinscripcion(id),
 CONSTRAINT fk_rp_usuario FOREIGN KEY (creado_por_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_reinscripcion_origen ON reinscripciones_periodo(clave_origen);
CREATE INDEX idx_reinscripcion_cohorte ON reinscripciones_periodo(plantel_id,ciclo_id,periodo_academico_id,turno,estado);

-- Extensión de calendario institucional (referencia; usar runner incremental).
-- Aditiva: eventos anteriores conservan marcador NULL; no se crean fechas ni eventos.
CREATE TABLE calendario_marcadores (
 id INT AUTO_INCREMENT PRIMARY KEY,
 plantel_id INT NOT NULL,
 clave VARCHAR(50) NOT NULL,
 nombre VARCHAR(150) NOT NULL,
 color VARCHAR(7) NOT NULL,
 forma VARCHAR(15) NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 CONSTRAINT fk_calendario_marcador_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id),
 CONSTRAINT uq_calendario_marcador_plantel UNIQUE (plantel_id, clave)
);
ALTER TABLE eventos_calendario ADD marcador_clave VARCHAR(50) NULL;

CREATE UNIQUE INDEX uq_alumno_curp ON alumnos(curp);

-- Incremental: identidad de portales y respuestas inmutables a boletas.
ALTER TABLE configuracion_marca ADD nombre_administrativo VARCHAR(150) NOT NULL DEFAULT 'Sistema Escolar Administrativo', ADD nombre_portal_alumno VARCHAR(150) NOT NULL DEFAULT 'Sistema Escolar Portal Alumno';
CREATE TABLE boleta_respuestas (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 inscripcion_id INT NOT NULL, actor_id INT NOT NULL, grupo_materia_id INT NULL,
 idempotencia VARCHAR(36) NOT NULL, peticion_hash VARCHAR(64) NOT NULL, version_hash VARCHAR(64) NOT NULL,
 estado VARCHAR(12) NOT NULL, firmante_nombre VARCHAR(150) NOT NULL, firmante_tipo VARCHAR(10) NOT NULL,
 comentario VARCHAR(2000) NOT NULL DEFAULT '', snapshot_json TEXT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CONSTRAINT uq_boleta_respuesta_clave UNIQUE(idempotencia),
 CONSTRAINT fk_boleta_respuesta_inscripcion FOREIGN KEY(inscripcion_id) REFERENCES inscripciones(id),
 CONSTRAINT fk_boleta_respuesta_actor FOREIGN KEY(actor_id) REFERENCES usuarios(id),
 CONSTRAINT fk_boleta_respuesta_materia FOREIGN KEY(grupo_materia_id) REFERENCES grupo_materias(id),
 CONSTRAINT ck_boleta_respuesta_estado CHECK(estado IN ('ACEPTADA','REVISION','COMENTARIO')),
 CONSTRAINT ck_boleta_respuesta_firmante CHECK(firmante_tipo IN ('ALUMNO','TUTOR','DOCENTE'))
);
CREATE INDEX idx_boleta_respuesta_inscripcion ON boleta_respuestas(inscripcion_id,id);

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
