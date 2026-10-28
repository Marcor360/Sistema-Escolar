-- Conserva números originales, historiales y ciclos cerrados. No recalcula notas.
ALTER TABLE grupo_materias ADD regimen_evaluacion NVARCHAR(30) NOT NULL CONSTRAINT df_gm_regimen DEFAULT 'CUATRO_PARCIALES_10';
GO
UPDATE gm SET regimen_evaluacion='LEGADO_100' FROM grupo_materias gm
JOIN grupos g ON g.id=gm.grupo_id JOIN ciclos_escolares c ON c.id=g.ciclo_id WHERE c.estado = 'CERRADO';
ALTER TABLE calificaciones ADD escala_maxima INT NOT NULL CONSTRAINT df_calificacion_escala DEFAULT 100;
ALTER TABLE calificaciones ALTER COLUMN calificacion DECIMAL(9,6) NOT NULL;
ALTER TABLE historial_calificaciones ADD escala_anterior INT NOT NULL CONSTRAINT df_hist_cal_escala_anterior DEFAULT 100,
 escala_nueva INT NOT NULL CONSTRAINT df_hist_cal_escala_nueva DEFAULT 100, detalle_calculo NVARCHAR(MAX) NULL;
ALTER TABLE historial_calificaciones ALTER COLUMN valor_anterior DECIMAL(9,6) NULL;
ALTER TABLE historial_calificaciones ALTER COLUMN valor_nuevo DECIMAL(9,6) NOT NULL;
