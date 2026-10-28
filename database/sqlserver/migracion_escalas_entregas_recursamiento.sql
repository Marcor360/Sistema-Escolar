-- Escalas originales conservadas; nuevas capturas toman el régimen de la clase.
ALTER TABLE entregas ADD escala_maxima INT NOT NULL CONSTRAINT df_entrega_escala DEFAULT 100;
ALTER TABLE calificaciones_recursamiento ADD escala_maxima INT NOT NULL CONSTRAINT df_rec_nota_escala DEFAULT 100;
ALTER TABLE calificaciones_recursamiento ALTER COLUMN calificacion DECIMAL(9,6) NOT NULL;
ALTER TABLE historial_recursamiento ADD escala_anterior INT NOT NULL CONSTRAINT df_rec_hist_anterior DEFAULT 100,
 escala_nueva INT NOT NULL CONSTRAINT df_rec_hist_nueva DEFAULT 100;
ALTER TABLE historial_recursamiento ALTER COLUMN anterior DECIMAL(9,6) NULL;
ALTER TABLE historial_recursamiento ALTER COLUMN nueva DECIMAL(9,6) NOT NULL;
