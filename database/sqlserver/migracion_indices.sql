IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_alumnos_plantel' AND object_id = OBJECT_ID('alumnos'))
  CREATE INDEX idx_alumnos_plantel ON alumnos(plantel_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_grupos_plantel' AND object_id = OBJECT_ID('grupos'))
  CREATE INDEX idx_grupos_plantel ON grupos(plantel_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_eventos_plantel' AND object_id = OBJECT_ID('eventos_calendario'))
  CREATE INDEX idx_eventos_plantel ON eventos_calendario(plantel_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_eventos_fecha_inicio' AND object_id = OBJECT_ID('eventos_calendario'))
  CREATE INDEX idx_eventos_fecha_inicio ON eventos_calendario(fecha_inicio);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_usuario_planteles_usuario' AND object_id = OBJECT_ID('usuario_planteles'))
  CREATE INDEX idx_usuario_planteles_usuario ON usuario_planteles(usuario_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_inscripciones_alumno' AND object_id = OBJECT_ID('inscripciones'))
  CREATE INDEX idx_inscripciones_alumno ON inscripciones(alumno_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cargos_alumno' AND object_id = OBJECT_ID('cargos'))
  CREATE INDEX idx_cargos_alumno ON cargos(alumno_id);
