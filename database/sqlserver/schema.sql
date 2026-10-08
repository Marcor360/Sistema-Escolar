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
  session_version INT NOT NULL DEFAULT 0,
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
  CONSTRAINT uq_grupo_ciclo_plantel_nombre UNIQUE (ciclo_id, plantel_id, nombre),
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
    push_pendiente BIT NOT NULL DEFAULT 0,
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
    plantel_id INT NOT NULL,
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  concepto_id INT NOT NULL,
  ciclo_id INT NULL,
  periodo CHAR(7) NULL,                             -- YYYY-MM
  clave_generacion NVARCHAR(80) NULL,
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
CREATE UNIQUE INDEX uq_cargos_clave_generacion ON cargos(clave_generacion) WHERE clave_generacion IS NOT NULL;
CREATE INDEX idx_cargos_alumno ON cargos(alumno_id); -- ver migracion_indices.sql
CREATE UNIQUE INDEX uq_cargos_legacy ON cargos(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE ordenes_pago (
    plantel_id INT NOT NULL,
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
    plantel_id INT NOT NULL,
  id INT IDENTITY(1,1) PRIMARY KEY,
  alumno_id INT NOT NULL,
  cargo_id INT NULL,
  orden_pago_id INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo NVARCHAR(15) NOT NULL,                     -- EFECTIVO | TRANSFERENCIA | TARJETA | PASARELA
  referencia NVARCHAR(60) NULL,
  clave_idempotencia NVARCHAR(36) NULL,
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
CREATE UNIQUE INDEX uq_pagos_orden_pago ON pagos(orden_pago_id) WHERE orden_pago_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pagos_clave_idempotencia ON pagos(clave_idempotencia) WHERE clave_idempotencia IS NOT NULL;
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
  plantel_id INT NULL,
  usuario_id INT NULL,
  accion NVARCHAR(60) NOT NULL,
  entidad NVARCHAR(40) NOT NULL,
  entidad_id INT NULL,
  detalle NVARCHAR(500) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE periodos_calificacion (
  id INT IDENTITY(1,1) PRIMARY KEY,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  estatus NVARCHAR(10) NOT NULL DEFAULT 'ABIERTO',
  cerrado_por_id INT NULL,
  cerrado_at DATETIME2 NULL,
  reabierto_por_id INT NULL,
  reabierto_at DATETIME2 NULL,
  CONSTRAINT uq_periodo_calificacion UNIQUE (grupo_materia_id, parcial),
  CONSTRAINT fk_periodo_gm FOREIGN KEY (grupo_materia_id) REFERENCES grupo_materias(id) ON DELETE CASCADE
);

CREATE TABLE historial_calificaciones (
  id INT IDENTITY(1,1) PRIMARY KEY,
  calificacion_id INT NOT NULL,
  alumno_id INT NOT NULL,
  grupo_materia_id INT NOT NULL,
  parcial INT NOT NULL,
  valor_anterior DECIMAL(5,2) NULL,
  valor_nuevo DECIMAL(5,2) NOT NULL,
  observacion_anterior NVARCHAR(300) NULL,
  observacion_nueva NVARCHAR(300) NULL,
  usuario_id INT NOT NULL,
  fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  motivo NVARCHAR(300) NULL
);
CREATE INDEX idx_historial_calificacion ON historial_calificaciones(calificacion_id);
CREATE INDEX idx_historial_periodo ON historial_calificaciones(grupo_materia_id, parcial);
CREATE INDEX idx_bitacora_financiera_plantel ON bitacora_financiera(plantel_id, created_at DESC);

CREATE TABLE bitacora_actividad (
  id INT IDENTITY(1,1) PRIMARY KEY,
  usuario_id INT NULL,
  metodo NVARCHAR(8) NOT NULL,
  ruta NVARCHAR(200) NOT NULL,
  entidad NVARCHAR(100) NULL,
  entidad_id INT NULL,
  resultado NVARCHAR(10) NOT NULL DEFAULT N'EXITO',
  status_code SMALLINT NULL,
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

-- Espejo MySQL: sesiones por dispositivo, hash de refresh rotativo.
CREATE TABLE sesiones (
  id NVARCHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  portal NVARCHAR(5) NOT NULL,
  refresh_hash NVARCHAR(64) NOT NULL,
  version INT NOT NULL,
  expira_en DATETIME2 NOT NULL,
  revocada BIT NOT NULL DEFAULT 0,
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
GO
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
GO

ALTER TABLE usuarios ADD password_change_required BIT NOT NULL CONSTRAINT df_usuario_password_change DEFAULT 0;
GO

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

ALTER TABLE cargos ADD CONSTRAINT fk_cargos_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_cargo_plantel ON cargos(plantel_id);

ALTER TABLE pagos ADD CONSTRAINT fk_pagos_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_pago_plantel ON pagos(plantel_id);

ALTER TABLE ordenes_pago ADD CONSTRAINT fk_ordenes_pago_plantel_origen FOREIGN KEY (plantel_id) REFERENCES planteles(id);
CREATE INDEX idx_orden_pago_plantel ON ordenes_pago(plantel_id);

CREATE TABLE cobranza_envios (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 clave VARCHAR(64) NOT NULL,
 plantel_id INT NOT NULL, usuario_id INT NOT NULL, actor_id INT NOT NULL,
 saldo DECIMAL(12,2) NOT NULL,
 estado VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE', intentos INT NOT NULL DEFAULT 0,
 proximo_intento DATETIME2 NOT NULL, error VARCHAR(80) NULL,
 created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
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
GO
CREATE INDEX idx_importacion_actor_expira ON importacion_previews(actor_id,expira);
GO
CREATE TABLE importacion_filas (
 id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
 preview_id VARCHAR(36) NOT NULL,
 posicion INT NOT NULL,
 contenido VARCHAR(8000) NOT NULL,
 CONSTRAINT fk_importacion_fila_preview FOREIGN KEY (preview_id) REFERENCES importacion_previews(id) ON DELETE CASCADE
);
GO
CREATE UNIQUE INDEX uq_importacion_fila ON importacion_filas(preview_id,posicion);
GO
