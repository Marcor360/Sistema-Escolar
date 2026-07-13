-- =====================================================================
-- Sistema Escolar Multiplataforma (MVP) — Esquema SQL Server 2019+
-- Equivalente 1:1 con database/mysql/schema.sql.
-- Nota: updated_at lo administra la aplicación (TypeORM @UpdateDateColumn).
-- =====================================================================
IF DB_ID('escolar') IS NULL CREATE DATABASE escolar;
GO
USE escolar;
GO

-- ---------- Seguridad / usuarios ----------
CREATE TABLE roles (
  id INT IDENTITY(1,1) PRIMARY KEY,
  clave NVARCHAR(30) NOT NULL UNIQUE,          -- ALUMNO | MAESTRO | ADMINISTRATIVO | FINANZAS | SUPERADMIN
  nombre NVARCHAR(80) NOT NULL
);

CREATE TABLE usuarios (
  id INT IDENTITY(1,1) PRIMARY KEY,
  email NVARCHAR(120) NOT NULL UNIQUE,
  password_hash NVARCHAR(100) NOT NULL,
  nombre NVARCHAR(80) NOT NULL,
  apellido_paterno NVARCHAR(80) NOT NULL,
  apellido_materno NVARCHAR(80) NULL,
  telefono NVARCHAR(20) NULL,
  activo BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  deleted_at DATETIME2 NULL,
  legacy_id BIGINT NULL                            -- ver migracion_legacy_id.sql (índice único filtrado)
);
CREATE UNIQUE INDEX uq_usuarios_legacy ON usuarios(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE planteles (
  id INT IDENTITY(1,1) PRIMARY KEY,
  clave NVARCHAR(80) NOT NULL UNIQUE,
  nombre NVARCHAR(150) NOT NULL,
  direccion NVARCHAR(200) NULL,
  municipio NVARCHAR(80) NULL,
  telefono NVARCHAR(20) NULL,
  director_usuario_id INT NULL,
  activo BIT NOT NULL DEFAULT 1,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT fk_plantel_director FOREIGN KEY (director_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_planteles_legacy ON planteles(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE usuario_planteles (
  usuario_id INT NOT NULL,
  plantel_id INT NOT NULL,
  activo BIT NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, plantel_id),
  CONSTRAINT fk_up_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE CASCADE
);

CREATE TABLE usuario_roles (
  usuario_id INT NOT NULL,
  rol_id INT NOT NULL,
  PRIMARY KEY (usuario_id, rol_id),
  CONSTRAINT fk_ur_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NOT NULL,
  token NVARCHAR(64) NOT NULL UNIQUE,
  expira_en DATETIME2 NOT NULL,
  usado BIT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT fk_prt_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ---------- Personas ----------
CREATE TABLE alumnos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  plantel_id INT NOT NULL,
  matricula NVARCHAR(20) NOT NULL UNIQUE,
  curp NVARCHAR(18) NULL,
  fecha_nacimiento DATE NULL,
  tutor_nombre NVARCHAR(120) NULL,
  tutor_telefono NVARCHAR(20) NULL,
  direccion NVARCHAR(200) NULL,
  estatus NVARCHAR(20) NOT NULL DEFAULT 'ACTIVO',   -- ACTIVO | BAJA | EGRESADO
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  deleted_at DATETIME2 NULL,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT fk_al_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_al_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id)
);
CREATE UNIQUE INDEX uq_alumnos_legacy ON alumnos(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE docentes (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  num_empleado NVARCHAR(20) NOT NULL UNIQUE,
  cedula_profesional NVARCHAR(20) NULL,
  especialidad NVARCHAR(120) NULL,
  estatus NVARCHAR(20) NOT NULL DEFAULT 'ACTIVO',   -- ACTIVO | BAJA
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  deleted_at DATETIME2 NULL,
  legacy_id BIGINT NULL,                           -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT fk_do_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX uq_docentes_legacy ON docentes(legacy_id) WHERE legacy_id IS NOT NULL;

-- ---------- Estructura académica ----------
CREATE TABLE ciclos_escolares (
  id INT IDENTITY(1,1) PRIMARY KEY,
  clave NVARCHAR(20) NOT NULL UNIQUE,
  nombre NVARCHAR(80) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  activo BIT NOT NULL DEFAULT 0,
  legacy_id BIGINT NULL                            -- ver migracion_legacy_id.sql (índice único filtrado)
);
CREATE UNIQUE INDEX uq_ciclos_escolares_legacy ON ciclos_escolares(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE materias (
  id INT IDENTITY(1,1) PRIMARY KEY,
  clave NVARCHAR(20) NOT NULL UNIQUE,
  nombre NVARCHAR(120) NOT NULL,
  descripcion NVARCHAR(300) NULL,
  creditos INT NOT NULL DEFAULT 0,
  activo BIT NOT NULL DEFAULT 1,
  legacy_id BIGINT NULL                            -- ver migracion_legacy_id.sql (índice único filtrado)
);
CREATE UNIQUE INDEX uq_materias_legacy ON materias(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE grupos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  ciclo_id INT NOT NULL,
  plantel_id INT NOT NULL,
  nombre NVARCHAR(40) NOT NULL,
  grado NVARCHAR(20) NULL,
  turno NVARCHAR(10) NULL,                          -- MATUTINO | VESPERTINO
  activo BIT NOT NULL DEFAULT 1,                     -- ver migracion_grupos_ciclo_vida.sql
  legacy_id BIGINT NULL,                            -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT uq_grupo_ciclo_nombre UNIQUE (ciclo_id, nombre),
  CONSTRAINT fk_gr_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id),
  CONSTRAINT fk_gr_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id)
);
CREATE UNIQUE INDEX uq_grupos_legacy ON grupos(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE grupo_materias (
  id INT IDENTITY(1,1) PRIMARY KEY,
  grupo_id INT NOT NULL,
  materia_id INT NOT NULL,
  docente_id INT NULL,
  legacy_id BIGINT NULL,                            -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT uq_gm UNIQUE (grupo_id, materia_id),
  CONSTRAINT fk_gm_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_materia FOREIGN KEY (materia_id) REFERENCES materias(id),
  CONSTRAINT fk_gm_docente FOREIGN KEY (docente_id) REFERENCES docentes(id)
);
CREATE UNIQUE INDEX uq_grupo_materias_legacy ON grupo_materias(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE inscripciones (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  grupo_id INT NOT NULL,
  fecha_inscripcion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  estatus NVARCHAR(15) NOT NULL DEFAULT 'ACTIVA',   -- ACTIVA | BAJA
  legacy_id BIGINT NULL,                            -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT uq_insc UNIQUE (alumno_id, grupo_id),
  CONSTRAINT fk_in_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_in_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);
CREATE UNIQUE INDEX uq_inscripciones_legacy ON inscripciones(legacy_id) WHERE legacy_id IS NOT NULL;

-- ---------- Trabajo académico ----------
CREATE TABLE actividades (
  id INT IDENTITY(1,1) PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  titulo NVARCHAR(150) NOT NULL,
  descripcion NVARCHAR(MAX) NULL,
  tipo NVARCHAR(20) NOT NULL DEFAULT 'TAREA',       -- TAREA | EXAMEN | PROYECTO | PARTICIPACION
  parcial INT NOT NULL DEFAULT 1,
  ponderacion DECIMAL(5,2) NOT NULL DEFAULT 0,
  fecha_entrega DATETIME2 NULL,
  activo BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT fk_ac_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
);

CREATE TABLE entregas (
  id INT IDENTITY(1,1) PRIMARY KEY,
  actividad_id INT NOT NULL,
  alumno_id INT NOT NULL,
  comentario_alumno NVARCHAR(500) NULL,
  archivo_nombre NVARCHAR(200) NULL,
  archivo_ruta NVARCHAR(300) NULL,
  calificacion DECIMAL(5,2) NULL,
  comentario_docente NVARCHAR(500) NULL,
  estatus NVARCHAR(15) NOT NULL DEFAULT 'ENTREGADA', -- ENTREGADA | CALIFICADA | TARDE
  fecha_entregado DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT uq_entrega UNIQUE (actividad_id, alumno_id),
  CONSTRAINT fk_en_actividad FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
  CONSTRAINT fk_en_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
);

CREATE TABLE materiales (
  id INT IDENTITY(1,1) PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  titulo NVARCHAR(150) NOT NULL,
  archivo_nombre NVARCHAR(200) NOT NULL,
  archivo_ruta NVARCHAR(300) NOT NULL,
  mime NVARCHAR(100) NULL,
  tamano_kb INT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT fk_ma_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
);

CREATE TABLE calificaciones (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,                              -- 1..3, 0 = final
  calificacion DECIMAL(5,2) NOT NULL,
  observaciones NVARCHAR(300) NULL,
  capturada_por_id INT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT uq_calif UNIQUE (alumno_id, grupo_materia_id, parcial),
  CONSTRAINT fk_ca_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_ca_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_usuario FOREIGN KEY (capturada_por_id) REFERENCES usuarios(id)
);

CREATE TABLE eventos_calendario (
  id INT IDENTITY(1,1) PRIMARY KEY,
  titulo NVARCHAR(150) NOT NULL,
  descripcion NVARCHAR(400) NULL,
  tipo NVARCHAR(30) NOT NULL DEFAULT 'GENERAL',
  fecha_inicio DATETIME2 NOT NULL,
  fecha_fin DATETIME2 NULL,
  plantel_id INT NULL,
  grupo_id INT NULL,
  creado_por_id INT NULL,
  CONSTRAINT fk_ev_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE SET NULL,
  CONSTRAINT fk_ev_plantel FOREIGN KEY (plantel_id) REFERENCES planteles(id) ON DELETE SET NULL,
  CONSTRAINT fk_evento_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE notificaciones (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo NVARCHAR(150) NOT NULL,
  mensaje NVARCHAR(600) NOT NULL,
  tipo NVARCHAR(30) NOT NULL DEFAULT 'GENERAL',
  leida BIT NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT fk_no_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ---------- Finanzas ----------
CREATE TABLE conceptos_pago (
  id INT IDENTITY(1,1) PRIMARY KEY,
  clave NVARCHAR(20) NOT NULL UNIQUE,
  nombre NVARCHAR(120) NOT NULL,
  tipo NVARCHAR(20) NOT NULL,                       -- INSCRIPCION | COLEGIATURA | RECARGO | DESCUENTO | BECA | OTRO
  monto_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo BIT NOT NULL DEFAULT 1,
  legacy_id BIGINT NULL                            -- ver migracion_legacy_id.sql (índice único filtrado)
);
CREATE UNIQUE INDEX uq_conceptos_pago_legacy ON conceptos_pago(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE cargos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  concepto_id INT NOT NULL,
  ciclo_id INT NULL,
  periodo CHAR(7) NULL,                             -- YYYY-MM
  descripcion NVARCHAR(200) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  recargo DECIMAL(12,2) NOT NULL DEFAULT 0,
  fecha_vencimiento DATE NULL,
  estatus NVARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',-- PENDIENTE | PARCIAL | PAGADO | VENCIDO | CANCELADO
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  legacy_id BIGINT NULL,                            -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT fk_cg_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_cg_concepto FOREIGN KEY (concepto_id) REFERENCES conceptos_pago(id),
  CONSTRAINT fk_cg_ciclo FOREIGN KEY (ciclo_id) REFERENCES ciclos_escolares(id)
);
CREATE INDEX idx_cargo_alumno ON cargos(alumno_id);
CREATE INDEX idx_cargo_periodo ON cargos(periodo);
CREATE INDEX idx_cargos_alumno ON cargos(alumno_id); -- ver migracion_indices.sql
CREATE UNIQUE INDEX uq_cargos_legacy ON cargos(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE ordenes_pago (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  cargo_id INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  descripcion NVARCHAR(200) NOT NULL,
  proveedor NVARCHAR(20) NOT NULL DEFAULT 'OPENPAY',
  id_externo NVARCHAR(60) NULL,
  url_pago NVARCHAR(300) NULL,
  estatus NVARCHAR(15) NOT NULL DEFAULT 'CREADA',   -- CREADA | PENDIENTE | COMPLETADA | FALLIDA | CANCELADA | EXPIRADA
  expira_en DATETIME2 NULL,
  payload_webhook NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT fk_op_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_op_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id)
);
CREATE INDEX idx_orden_externo ON ordenes_pago(id_externo);

CREATE TABLE pagos (
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  cargo_id INT NULL,
  orden_pago_id INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo NVARCHAR(15) NOT NULL,                     -- EFECTIVO | TRANSFERENCIA | TARJETA | PASARELA
  referencia NVARCHAR(60) NULL,
  estatus NVARCHAR(15) NOT NULL DEFAULT 'CONFIRMADO',
  fecha_pago DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  registrado_por_id INT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  legacy_id BIGINT NULL,                            -- ver migracion_legacy_id.sql (índice único filtrado)
  CONSTRAINT fk_pg_alumno FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
  CONSTRAINT fk_pg_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  CONSTRAINT fk_pg_orden FOREIGN KEY (orden_pago_id) REFERENCES ordenes_pago(id),
  CONSTRAINT fk_pg_usuario FOREIGN KEY (registrado_por_id) REFERENCES usuarios(id)
);
CREATE INDEX idx_pago_alumno ON pagos(alumno_id);
CREATE UNIQUE INDEX uq_pagos_legacy ON pagos(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE plantillas_correo (
  id INT IDENTITY(1,1) PRIMARY KEY,
  clave NVARCHAR(30) NOT NULL UNIQUE,
  asunto NVARCHAR(150) NOT NULL,
  cuerpo_html NVARCHAR(MAX) NOT NULL
);

-- ---------- Bitácoras ----------
CREATE TABLE bitacora_financiera (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NULL,
  accion NVARCHAR(60) NOT NULL,
  entidad NVARCHAR(40) NOT NULL,
  entidad_id INT NULL,
  detalle NVARCHAR(500) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE bitacora_actividad (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NULL,
  metodo NVARCHAR(8) NOT NULL,
  ruta NVARCHAR(200) NOT NULL,
  ip NVARCHAR(45) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- ---------- Configuración institucional ----------
CREATE TABLE configuracion_marca (
  id INT NOT NULL PRIMARY KEY,
  nombre_institucion NVARCHAR(150) NOT NULL CONSTRAINT df_marca_nombre DEFAULT 'Sistema Escolar',
  nombre_corto NVARCHAR(10) NOT NULL CONSTRAINT df_marca_corto DEFAULT 'SE',
  logo_url NVARCHAR(255) NULL,
  color_primario CHAR(7) NOT NULL CONSTRAINT df_marca_primario DEFAULT '#14343B',
  color_acento CHAR(7) NOT NULL CONSTRAINT df_marca_acento DEFAULT '#C79A3C',
  actualizado_en DATETIME2 NOT NULL CONSTRAINT df_marca_actualizado DEFAULT SYSUTCDATETIME()
);

INSERT INTO configuracion_marca (id) VALUES (1);
GO
