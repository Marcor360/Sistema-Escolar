-- Conserva los valores existentes. Promedios de cuatro notas con seis decimales: hasta ocho decimales exactos.
ALTER TABLE calificaciones MODIFY calificacion DECIMAL(11,8) NOT NULL;
ALTER TABLE historial_calificaciones MODIFY valor_anterior DECIMAL(11,8) NULL;
ALTER TABLE historial_calificaciones MODIFY valor_nuevo DECIMAL(11,8) NOT NULL;
