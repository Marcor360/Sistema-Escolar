-- Escalas originales conservadas; nuevas capturas toman el régimen de la clase.
ALTER TABLE entregas ADD escala_maxima INT NOT NULL DEFAULT 100;
ALTER TABLE calificaciones_recursamiento ADD escala_maxima INT NOT NULL DEFAULT 100;
ALTER TABLE calificaciones_recursamiento MODIFY calificacion DECIMAL(9,6) NOT NULL;
ALTER TABLE historial_recursamiento ADD escala_anterior INT NOT NULL DEFAULT 100, ADD escala_nueva INT NOT NULL DEFAULT 100;
ALTER TABLE historial_recursamiento MODIFY anterior DECIMAL(9,6) NULL, MODIFY nueva DECIMAL(9,6) NOT NULL;
