-- Ejecutar una sola vez (MySQL 8 no soporta IF NOT EXISTS en CREATE INDEX).
CREATE INDEX idx_cargos_alumno ON cargos(alumno_id);
