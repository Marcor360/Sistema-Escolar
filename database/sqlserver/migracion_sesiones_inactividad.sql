-- Mantener sesiones históricas sin destruir datos; la API exigirá nueva autenticación si está en NULL.
ALTER TABLE sesiones ADD ultima_actividad_en DATETIME2 NULL;
GO
