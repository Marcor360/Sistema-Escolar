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
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  apellido_paterno VARCHAR(80) NOT NULL,
  apellido_materno VARCHAR(80) NULL,
  telefono VARCHAR(20) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
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
  UNIQUE KEY uq_grupo_ciclo_nombre (ciclo_id, nombre),
  UNIQUE KEY uq_grupos_legacy (legacy_id),
  CONSTRAINT fk_gr_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
  CONSTRAINT fk_gr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id)
) ENGINE=InnoDB;

-- Materia impartida en un grupo por un docente (1 docente por grupo-materia)
CREATE TABLE grupo_materias (
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
  calificacion DECIMAL(5,2) NULL,
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
  calificacion DECIMAL(5,2) NOT NULL,
  observaciones VARCHAR(300) NULL,
  capturada_por_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_calif (alumno_id, grupo_materia_id, parcial),
  CONSTRAINT fk_ca_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_ca_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_usuario FOREIGN KEY (capturada_por_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE eventos_calendario (
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
  CONSTRAINT fk_evento_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notificaciones (
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
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  concepto_id INT NOT NULL,
  ciclo_id INT NULL,
  periodo CHAR(7) NULL,                            -- YYYY-MM (colegiaturas)
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
  KEY idx_cargos_alumno (alumno_id),               -- ver migracion_indices.sql
  UNIQUE KEY uq_cargos_legacy (legacy_id),
  CONSTRAINT fk_cg_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_cg_concepto FOREIGN KEY (concepto_id) REFERENCES conceptos_pago(id),
  CONSTRAINT fk_cg_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id)
) ENGINE=InnoDB;

CREATE TABLE ordenes_pago (
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
  id INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  cargo_id INT NULL,
  orden_pago_id INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo VARCHAR(15) NOT NULL,                     -- EFECTIVO | TRANSFERENCIA | TARJETA | PASARELA
  referencia VARCHAR(60) NULL,
  estatus VARCHAR(15) NOT NULL DEFAULT 'CONFIRMADO',-- CONFIRMADO | PENDIENTE | FALLIDO | CANCELADO
  fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registrado_por_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql
  KEY idx_pago_alumno (alumno_id),
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
  usuario_id INT NULL,
  accion VARCHAR(60) NOT NULL,
  entidad VARCHAR(40) NOT NULL,
  entidad_id INT NULL,
  detalle VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE bitacora_actividad (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  metodo VARCHAR(8) NOT NULL,
  ruta VARCHAR(200) NOT NULL,
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
